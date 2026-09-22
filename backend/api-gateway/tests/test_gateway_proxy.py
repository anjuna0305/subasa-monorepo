"""The metered /api proxy: short vs long services, metering, rate limiting."""

import httpx
import pytest
from sqlalchemy import select

import rate_limit
import routers._http as http_module
from models import ResponseType, Task, TaskStatus, UsageLog
from tests.factories import grant_usage, make_api_key, make_service, make_user


@pytest.fixture
def upstream(monkeypatch):
    """Replace the shared httpx client with one served by a local handler."""
    calls = []
    state = {
        "status": 200,
        "headers": {"content-type": "application/json"},
        "body": b'{"ok": true}',
    }

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(state["status"], headers=state["headers"], content=state["body"])

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(http_module, "_client", client)
    return type("Upstream", (), {"calls": calls, "state": state})


async def _seed(db, response_type=ResponseType.short):
    user = await make_user(db, email="proxy@example.com")
    service = await make_service(db, response_type=response_type)
    api_key = await make_api_key(db, user)
    await grant_usage(db, api_key, service, usage_limit=1000)
    return service, api_key


async def test_missing_api_key_header_is_rejected(client, db):
    await _seed(db)
    response = await client.post("/api/asr/transcribe", json={})
    assert response.status_code == 422


async def test_invalid_api_key_is_rejected(client, db, upstream):
    await _seed(db)
    response = await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "wrong"})
    assert response.status_code == 401
    assert upstream.calls == []


async def test_short_service_proxies_and_returns_the_body(client, db, upstream):
    await _seed(db)
    response = await client.post(
        "/api/asr/transcribe", json={"a": 1}, headers={"X-Api-Key": "secret-key"}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"ok": True}
    assert len(upstream.calls) == 1
    assert str(upstream.calls[0].url) == "http://upstream.test/transcribe"


async def test_gateway_credentials_are_not_forwarded_upstream(client, db, upstream):
    await _seed(db)
    await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"})
    forwarded = upstream.calls[0].headers
    assert "x-api-key" not in forwarded
    assert forwarded.get("host") != "test"


async def test_reported_tokens_are_logged(client, db, upstream):
    service, api_key = await _seed(db)
    upstream.state["headers"] = {
        "content-type": "application/json",
        "X-Tokens-Used": "42",
    }

    await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"})

    log = (await db.execute(select(UsageLog))).scalars().one()
    assert log.tokens_used == 42
    assert log.status == "success"


async def test_unreported_usage_is_billed_one_unit(client, db, upstream):
    await _seed(db)
    await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"})
    log = (await db.execute(select(UsageLog))).scalars().one()
    assert log.tokens_used == 1


async def test_unparseable_token_header_does_not_500(client, db, upstream):
    await _seed(db)
    upstream.state["headers"] = {
        "content-type": "application/json",
        "X-Tokens-Used": "not-a-number",
    }
    response = await client.post(
        "/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"}
    )
    assert response.status_code == 200
    log = (await db.execute(select(UsageLog))).scalars().one()
    assert log.tokens_used == 1


async def test_upstream_failure_is_logged_as_an_error(client, db, upstream):
    await _seed(db)
    upstream.state["status"] = 500

    response = await client.post(
        "/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"}
    )
    assert response.status_code == 500

    log = (await db.execute(select(UsageLog))).scalars().one()
    assert log.status == "error"


async def test_long_service_enqueues_a_task_instead_of_proxying(client, db, upstream):
    await _seed(db, response_type=ResponseType.long)

    response = await client.post(
        "/api/asr/transcribe",
        json={"a": 1},
        headers={"X-Api-Key": "secret-key"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == TaskStatus.pending.value
    assert body["task_uuid"]

    # nothing was sent upstream synchronously
    assert upstream.calls == []

    task = (await db.execute(select(Task))).scalars().one()
    assert task.uuid == body["task_uuid"]
    assert task.request_method == "POST"
    assert task.request_path == "transcribe"


async def test_rate_limit_returns_429_with_retry_after(client, db, upstream, monkeypatch):
    await _seed(db)
    monkeypatch.setattr(rate_limit, "RATE_LIMIT_REQUESTS", 2)
    monkeypatch.setattr(rate_limit, "RATE_LIMIT_WINDOW_SECONDS", 60)

    for _ in range(2):
        ok = await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"})
        assert ok.status_code == 200

    limited = await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"})
    assert limited.status_code == 429
    assert limited.json()["detail"][0]["field"] == "rate_limit"


async def test_usage_limit_blocks_further_requests(client, db, upstream):
    service, api_key = await _seed(db)
    upstream.state["headers"] = {
        "content-type": "application/json",
        "X-Tokens-Used": "1000",
    }

    first = await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"})
    assert first.status_code == 200

    second = await client.post("/api/asr/transcribe", json={}, headers={"X-Api-Key": "secret-key"})
    assert second.status_code == 429
    assert second.json()["detail"][0]["field"] == "usage_limit"
