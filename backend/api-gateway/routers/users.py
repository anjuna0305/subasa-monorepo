from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from passlib.context import CryptContext
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.operators import and_

from auth import AdminOrOrgAdminUser, AnyUser
from config import (
    GOOGLE_CLIENT_ID,
    JWT_EXPIRE_MINUTES,
    JWT_SECRET,
)
from database import get_db
from models import Organization, User, UserRole
from schemas import (
    AssignOrgToUser,
    GoogleAuthRequest,
    GoogleUserCreate,
    TokenOut,
    UserCreate,
    UserListItemOut,
    UserListOut,
    UserLogin,
    UserOut,
    UserUpdate,
)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

router = APIRouter(prefix="/users", tags=["users"])


def _build_user_out(user: User) -> UserOut:
    return UserOut(
        uuid=user.uuid,
        name=user.name,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
        is_active=user.is_active,
        organization_uuid=user.organization.uuid if user.organization else None,
        organization_name=user.organization.name if user.organization else None,
        avatar_url=user.avatar_url or None,
    )


async def _get_user_by_uuid(db: AsyncSession, user_uuid: str) -> User | None:
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.uuid == user_uuid)
    )
    return result.scalar_one_or_none()


@router.post("/auth/google", response_model=TokenOut)
async def google_login(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Sign in with a Google ID token.

    The client obtains the token from Google directly; the gateway only
    verifies it. There is no authorization-code exchange here, so no client
    secret and no redirect URI are involved.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail=[
                {
                    "field": "google",
                    "message": "Google sign-in is not configured on this server.",
                }
            ],
        )

    try:
        idinfo = id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=401,
            detail=[{"field": "id_token", "message": "Invalid Google token."}],
        ) from err

    email = idinfo["email"]
    name = idinfo.get("name")
    google_sub = idinfo["sub"]  # stable Google user ID
    avatar_url = idinfo.get("picture")

    if not idinfo.get("email_verified", False):
        raise HTTPException(
            status_code=401,
            detail=[{"field": "email", "message": "Google email is not verified."}],
        )

    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    is_new_user = user is None

    if is_new_user:
        user = await registerGoogleUser(
            GoogleUserCreate(
                name=name or "Google User",
                email=email,
                role=UserRole.general_user,
                google_id=google_sub,
                avatar_url=avatar_url or "",
            ),
            db,
        )
    else:
        # An account created with a password, signing in with Google for the
        # first time: link the two rather than leaving google_id null and
        # re-linking on every sign-in.
        if not user.google_id:
            user.google_id = google_sub
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(user, ["organization"])

    # Password login refuses blocked users; this path has to as well, or a
    # block is trivially bypassed by signing in with Google instead.
    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail=[
                {
                    "field": "user",
                    "message": "User is blocked. Please contact your organization admin or system admin",
                }
            ],
        )

    return tokenOutResponse(user, is_new_user=is_new_user)


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    if await db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(
            status_code=409,
            detail=[{"field": "email", "message": "User email already exists."}],
        )

    if await db.scalar(select(User).where(User.name == payload.name)):
        raise HTTPException(
            status_code=409,
            detail=[{"field": "name", "message": "User name already exists."}],
        )

    # Self-registration does not take an organization: UserCreate has no such
    # field, and reading it here made every call 500. Organizations are
    # assigned afterwards via PUT /users/{uuid}/organization.
    hashed = pwd_context.hash(payload.password)
    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hashed,
        role=UserRole.general_user,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == user.id)
    )
    user = result.scalar_one()
    return _build_user_out(user)


async def registerGoogleUser(payload: GoogleUserCreate, db: AsyncSession) -> User:
    if await db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(
            status_code=409,
            detail=[{"field": "email", "message": "User email already exists."}],
        )

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=None,
        role=UserRole.general_user,
        google_id=payload.google_id,
        avatar_url=payload.avatar_url,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == user.id)
    )
    return result.scalar_one()


@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.email == payload.email)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=401,
            detail=[{"field": "credentials", "message": "Invalid email or password."}],
        )

    if not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail=[{"field": "password", "message": "Incorrect password."}],
        )

    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail=[
                {
                    "field": "user",
                    "message": "User is blocked. Please contact your organization admin or system admin",
                }
            ],
        )

    return tokenOutResponse(user)


def tokenGenerator(user: User) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    token = jwt.encode(
        {
            "sub": str(user.uuid),
            "email": user.email,
            "role": user.role.value,
            "organization_uuid": str(user.organization.uuid) if user.organization else None,
            "exp": expires,
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    return token


def tokenOutResponse(user: User, is_new_user: bool = False) -> TokenOut:
    token = tokenGenerator(user)
    organization_uuid = str(user.organization.uuid) if user.organization else None
    return TokenOut(
        access_token=token,
        role=user.role,
        organization_uuid=organization_uuid,
        is_new_user=is_new_user,
    )


@router.put("/{user_uuid}", response_model=UserOut)
async def update_user(payload: UserUpdate, user_uuid: str, db: AsyncSession = Depends(get_db)):
    user = await _get_user_by_uuid(db, user_uuid)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user", "message": "User not found."}],
        )

    if await db.scalar(select(User).where(and_(User.name == payload.name, User.uuid != user_uuid))):
        raise HTTPException(
            status_code=409,
            detail=[{"field": "name", "message": "Username already taken."}],
        )

    if await db.scalar(
        select(User).where(and_(User.email == payload.email, User.uuid != user_uuid))
    ):
        raise HTTPException(
            status_code=409,
            detail=[{"field": "email", "message": "Email already in use."}],
        )

    org = await db.scalar(
        select(Organization).where(Organization.uuid == payload.organization_uuid)
    )
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )

    user.name = payload.name
    user.email = payload.email
    user.organization_id = org.id
    user.role = payload.role

    await db.commit()
    await db.refresh(user)
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == user.id)
    )
    user = result.scalar_one()
    return _build_user_out(user)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: AnyUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.uuid == current_user.uuid)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user", "message": "User not found."}],
        )
    return _build_user_out(user)


@router.get("/{user_uuid}", response_model=UserOut)
async def get_user(
    user_uuid: str,
    current_user: AnyUser,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_by_uuid(db, user_uuid)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user", "message": "User not found."}],
        )
    return _build_user_out(user)


@router.get("", response_model=UserListOut)
async def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    organization_uuid: str | None = Query(None),
    is_active: bool | None = Query(None),
    current_user: AdminOrOrgAdminUser = None,
    db: AsyncSession = Depends(get_db),
):
    if sort_by not in ("name", "created_at"):
        raise HTTPException(
            status_code=422,
            detail=[{"field": "sort_by", "message": "Must be 'name' or 'created_at'."}],
        )
    if sort_order not in ("asc", "desc"):
        raise HTTPException(
            status_code=422,
            detail=[{"field": "sort_order", "message": "Must be 'asc' or 'desc'."}],
        )

    effective_org_uuid = organization_uuid
    if current_user.role == UserRole.organization_admin:
        if organization_uuid is not None:
            raise HTTPException(
                status_code=422,
                detail=[
                    {
                        "field": "organization_uuid",
                        "message": "org_admin cannot specify organization_uuid filter.",
                    }
                ],
            )
        effective_org_uuid = current_user.organization_uuid

    query = select(User).options(selectinload(User.organization))
    count_query = select(func.count()).select_from(User)

    org_id = None
    if effective_org_uuid is not None:
        org = await db.scalar(select(Organization).where(Organization.uuid == effective_org_uuid))
        if org:
            org_id = org.id

    if org_id is not None:
        query = query.where(User.organization_id == org_id)
        count_query = count_query.where(User.organization_id == org_id)

    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)

    if search:
        pattern = f"%{search}%"
        matching_org_ids = select(Organization.id).where(Organization.name.ilike(pattern))
        search_filter = or_(
            User.name.ilike(pattern),
            User.email.ilike(pattern),
            User.organization_id.in_(matching_org_ids),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await db.execute(count_query)).scalar_one()

    sort_column = User.name if sort_by == "name" else User.created_at
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    items = [
        UserListItemOut(
            uuid=user.uuid,
            name=user.name,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
            is_active=user.is_active,
            organization_uuid=user.organization.uuid if user.organization else None,
            organization_name=user.organization.name if user.organization else None,
        )
        for user in users
    ]

    return UserListOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.put("/{user_uuid}/block", response_model=UserOut)
async def block_user(
    user_uuid: str,
    current_user: AdminOrOrgAdminUser,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_by_uuid(db, user_uuid)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user", "message": "User not found."}],
        )

    if current_user.role == UserRole.organization_admin:
        if (
            user.organization.uuid if user.organization else None
        ) != current_user.organization_uuid:
            raise HTTPException(
                status_code=403,
                detail=[
                    {
                        "field": "role",
                        "message": "Cannot block users outside your organization.",
                    }
                ],
            )

    user.is_active = False
    await db.commit()
    await db.refresh(user)
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == user.id)
    )
    user = result.scalar_one()
    return _build_user_out(user)


@router.put("/{user_uuid}/unblock", response_model=UserOut)
async def unblock_user(
    user_uuid: str,
    current_user: AdminOrOrgAdminUser,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_by_uuid(db, current_user.uuid)
    if user and user.uuid == user_uuid:
        raise HTTPException(
            status_code=403,
            detail=[{"field": "role", "message": "Users cannot block themselves."}],
        )

    target = await _get_user_by_uuid(db, user_uuid)
    if not target:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user", "message": "User not found."}],
        )

    if target.role == UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail=[
                {
                    "field": "role",
                    "message": "Organization admins cannot block system admins.",
                }
            ],
        )

    if target.role == UserRole.organization_admin:
        raise HTTPException(
            status_code=403,
            detail=[
                {
                    "field": "role",
                    "message": "Organization admins cannot block organization admins. To do that please contact a system admin.",
                }
            ],
        )

    if current_user.role == UserRole.organization_admin:
        if (
            target.organization.uuid if target.organization else None
        ) != current_user.organization_uuid:
            raise HTTPException(
                status_code=403,
                detail=[
                    {
                        "field": "role",
                        "message": "Cannot unblock users outside your organization.",
                    }
                ],
            )

    target.is_active = True
    await db.commit()
    await db.refresh(target)
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == target.id)
    )
    target = result.scalar_one()
    return _build_user_out(target)


@router.put("/{user_uuid}/organization", response_model=UserOut)
async def add_organization_to_user(
    user_uuid: str,
    payload: AssignOrgToUser,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_by_uuid(db, user_uuid)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "user", "message": "User not found."}],
        )

    org = await db.scalar(
        select(Organization).where(Organization.uuid == payload.organization_uuid)
    )
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization", "message": "Organization not found."}],
        )
    user.organization_id = org.id
    await db.commit()
    await db.refresh(user)
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == user.id)
    )
    user = result.scalar_one()
    return _build_user_out(user)
