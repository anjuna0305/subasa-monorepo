from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import AdminUser, AnyUser
from database import get_db
from models import Service
from schemas import ServiceCreate, ServiceOut

router = APIRouter(prefix="/services", tags=["services"])


@router.post("", response_model=ServiceOut, status_code=201)
async def create_service(
    payload: ServiceCreate,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    service = Service(
        service_key=payload.service_key,
        service_name=payload.service_name,
        base_url=payload.base_url,
        response_type=payload.response_type,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return ServiceOut(
        uuid=service.uuid,
        service_key=service.service_key,
        service_name=service.service_name,
        base_url=service.base_url,
        response_type=service.response_type,
        is_active=service.is_active,
    )


@router.get("/{service_uuid}", response_model=ServiceOut)
async def get_service(
    service_uuid: str,
    current_user: AnyUser,
    db: AsyncSession = Depends(get_db),
):
    service = await db.scalar(select(Service).where(Service.uuid == service_uuid))
    if not service:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "service", "message": "Service not found."}],
        )
    return ServiceOut(
        uuid=service.uuid,
        service_key=service.service_key,
        service_name=service.service_name,
        base_url=service.base_url,
        response_type=service.response_type,
        is_active=service.is_active,
    )


@router.get("", response_model=list[ServiceOut])
async def list_services(
    current_user: AnyUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Service).order_by(Service.service_name.asc())
    )
    services = result.scalars().all()
    return [
        ServiceOut(
            uuid=s.uuid,
            service_key=s.service_key,
            service_name=s.service_name,
            base_url=s.base_url,
            response_type=s.response_type,
            is_active=s.is_active,
        )
        for s in services
    ]