import asyncio
import json
import logging
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import AsyncSessionLocal
from models import Task, TaskStatus, UsageLog

logger = logging.getLogger("task_worker")

_queue: asyncio.Queue[int] | None = None


def _tokens_from_headers(headers) -> int:
    """Read the upstream's reported usage.

    Services that do not report usage, or report something unparseable, are
    billed one unit rather than zero, so an unmetered service can never be
    used for free.
    """
    raw = headers.get("X-Tokens-Used")
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return 1


def get_queue() -> asyncio.Queue[int]:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    return _queue


async def _process_task(task_id: int, client: httpx.AsyncClient) -> None:
    async with AsyncSessionLocal() as db:
        # task.service is read below; a lazy load on an async session raises
        # MissingGreenlet, so the relationship is eager-loaded up front.
        task = await db.scalar(
            select(Task).options(selectinload(Task.service)).where(Task.id == task_id)
        )
        if not task:
            logger.error("Task %s not found", task_id)
            return

        task.status = TaskStatus.processing
        await db.commit()

        try:
            headers = json.loads(task.request_headers) if task.request_headers else {}
            target_url = f"{task.service.base_url.rstrip('/')}/{task.request_path.lstrip('/')}"
            if task.request_query:
                target_url = f"{target_url}?{task.request_query}"

            resp = await client.request(
                method=task.request_method,
                url=target_url,
                content=task.request_body,
                headers=headers,
            )

            tokens_used = _tokens_from_headers(resp.headers)

            task.status = TaskStatus.completed
            task.response_status_code = resp.status_code
            task.response_body = resp.content
            task.response_content_type = resp.headers.get("content-type")
            task.tokens_used = tokens_used
            task.completed_at = datetime.now(UTC)

            log = UsageLog(
                api_key_id=task.api_key_id,
                service_id=task.service_id,
                tokens_used=tokens_used,
                status="success" if resp.is_success else "error",
            )
            db.add(log)
            await db.commit()

        except Exception as exc:
            logger.exception("Task %s failed", task_id)
            task.status = TaskStatus.failed
            task.error_message = str(exc)[:1000]
            task.completed_at = datetime.now(UTC)

            log = UsageLog(
                api_key_id=task.api_key_id,
                service_id=task.service_id,
                tokens_used=0,
                status="error",
            )
            db.add(log)
            await db.commit()


async def start_worker() -> asyncio.Task:
    async def _worker():
        client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
        try:
            while True:
                task_id = await get_queue().get()
                try:
                    await _process_task(task_id, client)
                except Exception:
                    logger.exception("Unhandled error processing task %s", task_id)
                finally:
                    get_queue().task_done()
        finally:
            await client.aclose()

    return asyncio.create_task(_worker())
