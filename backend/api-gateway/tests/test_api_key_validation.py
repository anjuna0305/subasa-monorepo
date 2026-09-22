"""API-key validation and usage-limit enforcement.

Note: `validate_api_key` compares the incoming key against `ApiKey.key_hash`
verbatim — despite the column name, keys are stored and compared in plaintext.
These tests encode the behaviour as it is; see the note in
docs/SECURITY-AUDIT.md.
"""

from datetime import timedelta

import pytest
from fastapi import HTTPException

from api_key_validator import validate_api_key
from models import ResponseType, UsageLog
from tests.factories import (
    EXPIRED,
    grant_usage,
    make_api_key,
    make_service,
    make_user,
)


async def _setup(db, **kwargs):
    user = await make_user(db, email="keys@example.com")
    service = await make_service(db, **kwargs.pop("service", {}))
    api_key = await make_api_key(db, user, **kwargs.pop("api_key", {}))
    return user, service, api_key


async def test_valid_key_passes(db):
    _, service, api_key = await _setup(db)
    await grant_usage(db, api_key, service)

    result = await validate_api_key(db, "secret-key", service.service_key)
    assert result.api_key.id == api_key.id
    assert result.service.id == service.id


async def test_unknown_key_is_rejected(db):
    _, service, api_key = await _setup(db)
    await grant_usage(db, api_key, service)

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "not-the-key", service.service_key)
    assert exc.value.status_code == 401


async def test_deactivated_key_is_rejected(db):
    _, service, api_key = await _setup(db, api_key={"is_active": False})
    await grant_usage(db, api_key, service)

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "secret-key", service.service_key)
    assert exc.value.status_code == 403


async def test_expired_key_is_rejected(db):
    _, service, api_key = await _setup(db, api_key={"expires_in": EXPIRED})
    await grant_usage(db, api_key, service)

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "secret-key", service.service_key)
    assert exc.value.status_code == 403


async def test_unknown_service_is_a_404(db):
    _, service, api_key = await _setup(db)
    await grant_usage(db, api_key, service)

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "secret-key", "no-such-service")
    assert exc.value.status_code == 404


async def test_inactive_service_is_unavailable(db):
    _, service, api_key = await _setup(db, service={"is_active": False})
    await grant_usage(db, api_key, service)

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "secret-key", service.service_key)
    assert exc.value.status_code == 503


async def test_key_without_an_allocation_is_rejected(db):
    _, service, _ = await _setup(db)

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "secret-key", service.service_key)
    assert exc.value.status_code == 403


async def test_expired_allocation_is_rejected(db):
    _, service, api_key = await _setup(db)
    await grant_usage(db, api_key, service, expires_in=EXPIRED)

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "secret-key", service.service_key)
    assert exc.value.status_code == 403


async def test_usage_limit_is_enforced(db):
    _, service, api_key = await _setup(db)
    await grant_usage(db, api_key, service, usage_limit=10)

    db.add(
        UsageLog(
            api_key_id=api_key.id,
            service_id=service.id,
            tokens_used=10,
            status="success",
        )
    )
    await db.commit()

    with pytest.raises(HTTPException) as exc:
        await validate_api_key(db, "secret-key", service.service_key)
    assert exc.value.status_code == 429


async def test_usage_just_under_the_limit_still_passes(db):
    _, service, api_key = await _setup(db)
    await grant_usage(db, api_key, service, usage_limit=10)

    db.add(
        UsageLog(
            api_key_id=api_key.id,
            service_id=service.id,
            tokens_used=9,
            status="success",
        )
    )
    await db.commit()

    result = await validate_api_key(db, "secret-key", service.service_key)
    assert result.service.response_type == ResponseType.short


async def test_a_key_not_yet_expired_passes(db):
    _, service, api_key = await _setup(db, api_key={"expires_in": timedelta(days=1)})
    await grant_usage(db, api_key, service)

    result = await validate_api_key(db, "secret-key", service.service_key)
    assert result.api_key.id == api_key.id
