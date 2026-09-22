"""The async task path: worker processing plus the status/result endpoints."""

import httpx
import pytest
from sqlalchemy import select

import task_worker
from models import ResponseType, Task, TaskStatus, UsageLog
from tests.factories import grant_usage, make_api_key, make_service, make_user


async def _seed_task(db, session_factory, body=b'{"a": 1}'):
    user = await make_user(db, email="tasks@example.com")
    service = await make_service(db, response_type=ResponseType.long)
    api_key = await make_api_key(db, user)
    await grant_usage(db, api_key, service, usage_limit=1000)

    task = Task(
        api_key_id=api_key.id,
        service_id=service.id,
        request_method="POST",
        request_path="transcribe",
        request_headers='{"content-type": "application/json"}',
        request_body=body,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task, service, api_key


@pytest.fixture
def patch_sessions(session_factory, monkeypatch):
    """Point the worker at the test database."""
    monkeypatch.setattr(task_worker, "AsyncSessionLocal", session_factory)


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_worker_completes_a_task_and_records_usage(db, session_factory, patch_sessions):
    task, _, _ = await _seed_task(db, session_factory)
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/json", "X-Tokens-Used": "7"},
            content=b'{"transcription": "hello"}',
        )

    async with _client(handler) as client:
        await task_worker._process_task(task.id, client)

    assert str(seen[0].url) == "http://upstream.test/transcribe"
    assert seen[0].content == b'{"a": 1}'

    await db.refresh(task)
    assert task.status == TaskStatus.completed
    assert task.response_status_code == 200
    assert task.response_body == b'{"transcription": "hello"}'
    assert task.tokens_used == 7
    assert task.completed_at is not None

    log = (await db.execute(select(UsageLog))).scalars().one()
    assert log.tokens_used == 7
    assert log.status == "success"


async def test_worker_marks_a_failing_task_failed(db, session_factory, patch_sessions):
    task, _, _ = await _seed_task(db, session_factory)

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("upstream down")

    async with _client(handler) as client:
        await task_worker._process_task(task.id, client)

    await db.refresh(task)
    assert task.status == TaskStatus.failed
    assert task.error_message
    assert task.completed_at is not None

    log = (await db.execute(select(UsageLog))).scalars().one()
    assert log.status == "error"
    assert log.tokens_used == 0


async def test_status_endpoint_reads_the_task(client, db, session_factory):
    """Regression: task.service was a lazy load, which raised MissingGreenlet."""
    task, _, _ = await _seed_task(db, session_factory)

    response = await client.get(f"/tasks/{task.uuid}/status", headers={"X-Api-Key": "secret-key"})
    assert response.status_code == 200, response.text
    assert response.json()["status"] == TaskStatus.pending.value


async def test_result_is_refused_while_the_task_is_pending(client, db, session_factory):
    task, _, _ = await _seed_task(db, session_factory)

    response = await client.get(f"/tasks/{task.uuid}/result", headers={"X-Api-Key": "secret-key"})
    assert response.status_code == 400


async def test_download_returns_the_stored_body(client, db, session_factory):
    task, _, _ = await _seed_task(db, session_factory)
    task.status = TaskStatus.completed
    task.response_body = b"audio-bytes"
    task.response_content_type = "audio/wav"
    await db.commit()

    response = await client.get(f"/tasks/{task.uuid}/download", headers={"X-Api-Key": "secret-key"})
    assert response.status_code == 200
    assert response.content == b"audio-bytes"
    assert response.headers["content-type"] == "audio/wav"


async def test_unknown_task_is_a_404(client, db, session_factory):
    await _seed_task(db, session_factory)
    response = await client.get("/tasks/does-not-exist/status", headers={"X-Api-Key": "secret-key"})
    assert response.status_code == 404
