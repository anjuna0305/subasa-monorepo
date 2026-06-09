from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import AdminUser, AnyUser
from database import get_db
from models import ApiKey, Service, ServiceUsage, UsageLog
from schemas import (
    CurrentUsageOut,
    ServiceUsageCreate,
    ServiceUsageOut,
    UsageLogCreate,
    UsageLogOut,
)

router = APIRouter(prefix="/usage", tags=["usage"])


@router.post("/service-usage", response_model=ServiceUsageOut, status_code=201)
async def create_service_usage(
    payload: ServiceUsageCreate,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    api_key = await db.scalar(select(ApiKey).where(ApiKey.uuid == payload.api_key_uuid))
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "api_key", "message": "API key not found."}],
        )

    service = await db.scalar(select(Service).where(Service.uuid == payload.service_uuid))
    if not service:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "service", "message": "Service not found."}],
        )

    service_usage = ServiceUsage(
        api_key_id=api_key.id,
        service_id=service.id,
        usage_limit=payload.usage_limit,
        expires_at=payload.expires_at,
    )
    db.add(service_usage)
    await db.commit()
    await db.refresh(service_usage)
    return ServiceUsageOut(
        uuid=service_usage.uuid,
        api_key_uuid=api_key.uuid,
        service_uuid=service.uuid,
        usage_limit=service_usage.usage_limit,
        expires_at=service_usage.expires_at,
    )


@router.post("/logs", response_model=UsageLogOut, status_code=201)
async def create_usage_log(
    payload: UsageLogCreate,
    current_user: AnyUser,
    db: AsyncSession = Depends(get_db),
):
    api_key = await db.scalar(select(ApiKey).where(ApiKey.uuid == payload.api_key_uuid))
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "api_key", "message": "API key not found."}],
        )

    service = await db.scalar(select(Service).where(Service.uuid == payload.service_uuid))
    if not service:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "service", "message": "Service not found."}],
        )

    log = UsageLog(
        api_key_id=api_key.id,
        service_id=service.id,
        tokens_used=payload.tokens_used,
        status=payload.status,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return UsageLogOut(
        uuid=log.uuid,
        api_key_uuid=api_key.uuid,
        service_uuid=service.uuid,
        tokens_used=log.tokens_used,
        requested_at=log.requested_at,
        status=log.status,
    )


@router.get("/current/{api_key_uuid}/{service_uuid}", response_model=CurrentUsageOut)
async def get_current_usage(
    api_key_uuid: str,
    service_uuid: str,
    current_user: AnyUser,
    db: AsyncSession = Depends(get_db),
):
    api_key = await db.scalar(select(ApiKey).where(ApiKey.uuid == api_key_uuid))
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "api_key", "message": "API key not found."}],
        )

    service = await db.scalar(select(Service).where(Service.uuid == service_uuid))
    if not service:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "service", "message": "Service not found."}],
        )

    stmt = (
        select(
            func.sum(UsageLog.tokens_used).label("total_tokens_used"),
            func.count().label("request_count"),
        )
        .where(
            UsageLog.api_key_id == api_key.id, UsageLog.service_id == service.id
        )
    )
    result = await db.execute(stmt)
    row = result.mappings().first()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "usage", "message": "No usage data found for the given API key and service."}],
        )
    return CurrentUsageOut(
        api_key_uuid=api_key.uuid,
        service_uuid=service.uuid,
        total_tokens_used=row["total_tokens_used"],
        request_count=row["request_count"],
    )