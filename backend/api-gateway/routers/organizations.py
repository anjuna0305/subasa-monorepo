from typing import List

from fastapi import Depends, HTTPException
from fastapi.routing import APIRouter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Organization, User, UserRole
from schemas import (
    AssignOrgAdmin,
    AssignUsersToOrg,
    AssignUsersToOrgOut,
    OrganizationCreate,
    OrganizationOut,
    UserOut,
)

router = APIRouter(prefix="/orgs", tags=["organizations"])


def _build_org_out(org: Organization) -> OrganizationOut:
    return OrganizationOut(
        uuid=org.uuid,
        name=org.name,
        is_active=org.is_active,
        created_at=org.created_at,
    )


@router.post("", response_model=OrganizationOut, status_code=201)
async def create_organization(
    payload: OrganizationCreate, db: AsyncSession = Depends(get_db)
):
    existing = await db.scalar(
        select(Organization).where(Organization.name == payload.name)
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=[{"field": "name", "message": "Organization name already exists."}],
        )

    org = Organization(name=payload.name, is_active=payload.is_active)
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return _build_org_out(org)


@router.post(
    "/{organization_uuid}/users", response_model=AssignUsersToOrgOut, status_code=201
)
async def add_users_to_an_organization(
    organization_uuid: str, payload: AssignUsersToOrg, db: AsyncSession = Depends(get_db)
):
    org = await db.scalar(select(Organization).where(Organization.uuid == organization_uuid))
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )

    for u_uuid in payload.user_uuids:
        user = await db.scalar(select(User).where(User.uuid == u_uuid))

        if not user:
            raise HTTPException(
                status_code=404,
                detail=[
                    {
                        "field": "user_uuid",
                        "message": f"User with user_uuid:{u_uuid} does not exist.",
                    }
                ],
            )
        user.organization_id = org.id
        user.role = UserRole.organization_user

    await db.commit()
    return {"user_uuids": payload.user_uuids}


@router.get("/{organization_uuid}", response_model=OrganizationOut, status_code=200)
async def get_organization(organization_uuid: str, db: AsyncSession = Depends(get_db)):
    org = await db.scalar(select(Organization).where(Organization.uuid == organization_uuid))
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )
    return _build_org_out(org)


@router.get("", response_model=list[OrganizationOut], status_code=200)
async def get_all_organizations(db: AsyncSession = Depends(get_db)):
    results = await db.execute(
        select(Organization).order_by(Organization.created_at.desc())
    )
    orgs = results.scalars().all()
    return [_build_org_out(org) for org in orgs]


@router.post("/activate/{org_uuid}", response_model=OrganizationOut)
async def activate_organization(org_uuid: str, db: AsyncSession = Depends(get_db)):
    org = await db.scalar(select(Organization).where(Organization.uuid == org_uuid))
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )

    org.is_active = True
    await db.commit()
    await db.refresh(org)
    return _build_org_out(org)


@router.post("/deactivate/{org_uuid}", response_model=OrganizationOut)
async def deactivate_organization(org_uuid: str, db: AsyncSession = Depends(get_db)):
    org = await db.scalar(select(Organization).where(Organization.uuid == org_uuid))
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )

    org.is_active = False
    await db.commit()
    await db.refresh(org)
    return _build_org_out(org)


@router.put("/{org_uuid}/admin", response_model=OrganizationOut)
async def assign_admin_to_organization(
    org_uuid: str, payload: AssignOrgAdmin, db: AsyncSession = Depends(get_db)
):
    org = await db.scalar(select(Organization).where(Organization.uuid == org_uuid))
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )

    user = await db.scalar(select(User).where(User.uuid == payload.user_uuid))
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user_uuid", "message": "User not found."}],
        )

    if user.organization_id != org.id:
        raise HTTPException(
            status_code=409,
            detail=[
                {
                    "field": "user_uuid",
                    "message": "User is not a member of this organization.",
                }
            ],
        )

    user.organization_id = org.id
    user.role = UserRole.organization_admin
    await db.commit()
    await db.refresh(org)
    return _build_org_out(org)


@router.get("/{organization_uuid}/admin", response_model=UserOut, status_code=200)
async def get_organization_admin(
    organization_uuid: str, db: AsyncSession = Depends(get_db)
):
    org = await db.scalar(select(Organization).where(Organization.uuid == organization_uuid))
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )

    from sqlalchemy.orm import selectinload

    admin_user = await db.scalar(
        select(User).options(selectinload(User.organization)).where(
            User.organization_id == org.id,
            User.role == UserRole.organization_admin,
        )
    )
    if not admin_user:
        raise HTTPException(
            status_code=404,
            detail=[
                {
                    "field": "organization_admin",
                    "message": "No organization admin were found.",
                }
            ],
        )

    from routers.users import _build_user_out
    return _build_user_out(admin_user)