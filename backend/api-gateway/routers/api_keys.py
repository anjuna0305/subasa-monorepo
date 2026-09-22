from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import AdminUser, AnyUser
from database import get_db
from models import ApiKey, User
from schemas import ApiKeyCreate, ApiKeyOut

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _build_api_key_out(api_key: ApiKey) -> ApiKeyOut:
    return ApiKeyOut(
        uuid=api_key.uuid,
        user_uuid=api_key.user.uuid,
        label=api_key.label,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        is_active=api_key.is_active,
    )


@router.post("/users/{user_uuid}/api-keys", response_model=ApiKeyOut, status_code=201)
async def create_api_key(
    user_uuid: str,
    payload: ApiKeyCreate,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.uuid == user_uuid))
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user", "message": "User not found."}],
        )

    api_key = ApiKey(
        user_id=user.id,
        key_hash=payload.key_hash,
        label=payload.label,
        expires_at=payload.expires_at,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    result = await db.execute(
        select(ApiKey).options(selectinload(ApiKey.user)).where(ApiKey.id == api_key.id)
    )
    api_key = result.scalar_one()
    return _build_api_key_out(api_key)


@router.get("/{api_key_uuid}", response_model=ApiKeyOut)
async def get_api_key(
    api_key_uuid: str,
    current_user: AnyUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).options(selectinload(ApiKey.user)).where(ApiKey.uuid == api_key_uuid)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "api_key", "message": "API key not found."}],
        )
    return _build_api_key_out(api_key)


@router.get("", response_model=list[ApiKeyOut])
async def list_api_keys(
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).options(selectinload(ApiKey.user)).order_by(ApiKey.created_at.desc())
    )
    api_keys = result.scalars().all()
    return [_build_api_key_out(ak) for ak in api_keys]