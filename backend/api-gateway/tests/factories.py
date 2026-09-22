"""Helpers for seeding rows the tests need."""

from datetime import UTC, datetime, timedelta

from models import (
    ApiKey,
    Organization,
    ResponseType,
    Service,
    ServiceUsage,
    User,
    UserRole,
)
from routers.users import pwd_context, tokenGenerator


async def make_org(db, name="Acme"):
    org = Organization(name=name)
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


async def make_user(
    db,
    name="Test User",
    email="test@example.com",
    password="Hunter2hunter2",
    role=UserRole.general_user,
    org=None,
    is_active=True,
):
    user = User(
        name=name,
        email=email,
        hashed_password=pwd_context.hash(password),
        role=role,
        organization_id=org.id if org else None,
        is_active=is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    if org:
        # tokenGenerator reads user.organization, a lazy relationship
        await db.refresh(user, ["organization"])
    return user


def token_for(user):
    return tokenGenerator(user)


def auth_header(user):
    return {"Authorization": f"Bearer {token_for(user)}"}


async def make_service(
    db,
    service_key="asr",
    service_name="ASR",
    base_url="http://upstream.test",
    response_type=ResponseType.short,
    is_active=True,
):
    service = Service(
        service_key=service_key,
        service_name=service_name,
        base_url=base_url,
        response_type=response_type,
        is_active=is_active,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service


async def make_api_key(
    db, user, raw_key="secret-key", label="test key", is_active=True, expires_in=None
):
    api_key = ApiKey(
        user_id=user.id,
        # The column is named key_hash but the codebase stores and compares the
        # raw value; see the note in tests/test_api_key_validation.py.
        key_hash=raw_key,
        label=label,
        is_active=is_active,
        expires_at=(datetime.now(UTC) + expires_in if expires_in else None),
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key


async def grant_usage(db, api_key, service, usage_limit=1000, expires_in=None):
    usage = ServiceUsage(
        api_key_id=api_key.id,
        service_id=service.id,
        usage_limit=usage_limit,
        expires_at=(datetime.now(UTC) + expires_in if expires_in else None),
    )
    db.add(usage)
    await db.commit()
    await db.refresh(usage)
    return usage


EXPIRED = timedelta(days=-1)
