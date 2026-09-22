import json

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api_key_validator import validate_api_key
from database import get_db
from models import ResponseType, Task, UsageLog
from rate_limit import check_rate_limit
from routers._http import get_http_client
from schemas import TaskSubmitOut
from task_worker import get_queue

router = APIRouter(prefix="/api", tags=["gateway"])


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


# Hop-by-hop and gateway-only headers that must not reach the upstream service:
# `host` would point at the gateway, `content-length` is recomputed by httpx from
# the body we pass, and `x-api-key` is a gateway credential the upstream has no
# business seeing.
_STRIPPED_HEADERS = frozenset({"host", "x-api-key", "content-length"})


def _build_forward_headers(request: Request) -> str:
    headers = {k: v for k, v in request.headers.items() if k.lower() not in _STRIPPED_HEADERS}
    return json.dumps(headers)


@router.api_route(
    "/{service_key}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def gateway_proxy(
    service_key: str,
    path: str,
    request: Request,
    x_api_key: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    validation = await validate_api_key(db, x_api_key, service_key)
    service = validation.service

    # Checked after validation so an unknown key cannot use the limiter as an
    # oracle, and keyed per API key rather than per IP.
    check_rate_limit(validation.api_key.uuid)

    if service.response_type == ResponseType.long:
        body = await request.body()
        task = Task(
            api_key_id=validation.api_key.id,
            service_id=service.id,
            request_method=request.method,
            request_path=path,
            request_query=request.url.query if request.url.query else None,
            request_headers=_build_forward_headers(request),
            request_body=body if body else None,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)

        queue = get_queue()
        await queue.put(task.id)

        return TaskSubmitOut(task_uuid=task.uuid, status=task.status)

    client = get_http_client()

    target_url = f"{service.base_url.rstrip('/')}/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    body = await request.body()
    headers = json.loads(_build_forward_headers(request))

    upstream_resp = await client.request(
        method=request.method,
        url=target_url,
        content=body,
        headers=headers,
    )

    tokens_used = _tokens_from_headers(upstream_resp.headers)

    log = UsageLog(
        api_key_id=validation.api_key.id,
        service_id=service.id,
        tokens_used=tokens_used,
        status="success" if upstream_resp.is_success else "error",
    )
    db.add(log)
    await db.commit()

    return StreamingResponse(
        content=iter([upstream_resp.content]),
        status_code=upstream_resp.status_code,
        media_type=upstream_resp.headers.get("content-type"),
    )
