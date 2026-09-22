import asyncio
import json
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from database import AsyncSessionLocal
from models import ResponseType, Task, TaskStatus, UsageLog

logger = logging.getLogger("task_worker")

_queue: asyncio.Queue[int] | None = None


def get_queue() -> asyncio.Queue[int]:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    return _queue


async def _process_task(task_id: int, client: httpx.AsyncClient) -> None:
    async with AsyncSessionLocal() as db:
        task = await db.get(Task, task_id)
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

            tokens_used = int(resp.headers.get("X-Tokens-Used", 1))

            task.status = TaskStatus.completed
            task.response_status_code = resp.status_code
            task.response_body = resp.content
            task.response_content_type = resp.headers.get("content-type")
            task.tokens_used = tokens_used
            task.completed_at = datetime.now(timezone.utc)

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
            task.completed_at = datetime.now(timezone.utc)

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
            while True and _queue:
                task_id = await _queue.get()
                try:
                    await _process_task(task_id, client)
                except Exception:
                    logger.exception("Unhandled error processing task %s", task_id)
                finally:
                    _queue.task_done()
        finally:
            await client.aclose()

    return asyncio.create_task(_worker())
