from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ApiKey, Service, ServiceUsage, UsageLog


class ApiKeyValidationResult:
    def __init__(self, api_key: ApiKey, service: Service):
        self.api_key = api_key
        self.service = service


async def validate_api_key(
    db: AsyncSession,
    raw_api_key: str,
    service_key: str,
) -> ApiKeyValidationResult:
    api_key = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == raw_api_key)
    )
    api_key = api_key.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=[{"field": "api_key", "message": "Invalid API key provided."}],
        )

    if not api_key.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=[{"field": "api_key", "message": "API key has been deactivated."}],
        )

    if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=[{"field": "api_key", "message": "API key has expired."}],
        )

    service = await db.execute(
        select(Service).where(Service.service_key == service_key)
    )
    service = service.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=[{"field": "service", "message": f"Service '{service_key}' not found."}],
        )

    if not service.is_active:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=[{"field": "service", "message": f"Service '{service_key}' is currently unavailable."}],
        )

    service_usage = await db.execute(
        select(ServiceUsage).where(
            ServiceUsage.api_key_id == api_key.id,
            ServiceUsage.service_id == service.id,
        )
    )
    service_usage = service_usage.scalar_one_or_none()

    if not service_usage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=[{"field": "api_key", "message": "API key does not have access to the requested service."}],
        )

    if service_usage.expires_at and service_usage.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=[{"field": "service_usage", "message": "Service usage allocation has expired."}],
        )

    usage_result = await db.execute(
        select(func.coalesce(func.sum(UsageLog.tokens_used), 0)).where(
            UsageLog.api_key_id == api_key.id,
            UsageLog.service_id == service.id,
        )
    )
    total_used = usage_result.scalar() or 0

    if total_used >= service_usage.usage_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=[{"field": "usage_limit", "message": "Usage limit exceeded for this service."}],
        )

    return ApiKeyValidationResult(api_key=api_key, service=service)
