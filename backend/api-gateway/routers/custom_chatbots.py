import math
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import AdminUser, AnyUser
from config import CUSTOM_CHATBOT_SERVICE_URL, FILE_UPLOAD_DIR, IMAGE_UPLOAD_DIR
from database import get_db
from models import CustomChatbot, Organization, User, UserRole
from schemas import (
    CustomChatbotCreate,
    CustomChatbotListOut,
    CustomChatbotMessageRequest,
    CustomChatbotMessageResponse,
    CustomChatbotOut,
)

ALLOWED_IMAGE_EXTENSIONS = {".jpeg", ".jpg", ".png"}
ALLOWED_FILE_EXTENSIONS = {".txt", ".pdf"}
MIME_TYPES = {
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
}

router = APIRouter(prefix="/custom-chatbots", tags=["custom-chatbots"])


def _build_chatbot_out(chatbot: CustomChatbot) -> CustomChatbotOut:
    return CustomChatbotOut(
        uuid=chatbot.uuid,
        chatbot_name=chatbot.chatbot_name,
        organization_uuid=chatbot.organization.uuid if chatbot.organization else None,
        file_path=chatbot.file_path,
        description=chatbot.description,
        hero_image=chatbot.hero_image,
        url_path=chatbot.url_path,
        retrieval_key=chatbot.retrieval_key,
        is_publish=chatbot.is_publish,
        is_public=chatbot.is_public,
        created_at=chatbot.created_at,
    )


@router.post("/api/{url_path}", response_model=CustomChatbotMessageResponse)
async def chat_with_custom_chatbot(
    url_path: str,
    payload: CustomChatbotMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomChatbot).where(CustomChatbot.url_path == url_path)
    )
    custom_chatbot = result.scalar_one_or_none()
    if not custom_chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "url_path", "message": "Chatbot not found."}],
        )

    if not custom_chatbot.is_publish:
        raise HTTPException(
            status_code=503,
            detail=[{"field": "url_path", "message": "Chatbot is unpublished"}],
        )

    from routers._http import get_http_client

    client = get_http_client()

    forward_url = CUSTOM_CHATBOT_SERVICE_URL
    forward_payload = {
        "message": payload.message,
        "retrieval_key": custom_chatbot.retrieval_key,
        "file_path": custom_chatbot.file_path,
    }

    upstream_resp = await client.post(
        forward_url,
        json=forward_payload,
    )
    upstream_resp.raise_for_status()

    data = upstream_resp.json()
    return CustomChatbotMessageResponse(
        response=data.get("response", data.get("message", ""))
    )


@router.post("/api/private/{url_path}", response_model=CustomChatbotMessageResponse)
async def chat_with_private_custom_chatbot(
    current_user: AnyUser,
    url_path: str,
    payload: CustomChatbotMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomChatbot).where(CustomChatbot.url_path == url_path)
    )
    custom_chatbot = result.scalar_one_or_none()
    if not custom_chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "url_path", "message": "Chatbot not found."}],
        )

    if not custom_chatbot.is_publish:
        raise HTTPException(
            status_code=503,
            detail=[{"field": "url_path", "message": "Chatbot is unpublished"}],
        )

    user = await db.scalar(
        select(User).options(selectinload(User.organization)).where(User.uuid == current_user.uuid)
    )
    if (
        current_user.role != UserRole.admin
        and (user.organization_id if user else None) != custom_chatbot.organization_id
    ):
        raise HTTPException(
            status_code=401,
            detail=[{"field": url_path, "message": "Unauthorized chatbot"}],
        )

    from routers._http import get_http_client

    client = get_http_client()

    forward_url = CUSTOM_CHATBOT_SERVICE_URL
    forward_payload = {
        "message": payload.message,
        "retrieval_key": custom_chatbot.retrieval_key,
        "file_path": custom_chatbot.file_path,
    }

    upstream_resp = await client.post(
        forward_url,
        json=forward_payload,
    )
    upstream_resp.raise_for_status()

    data = upstream_resp.json()
    return CustomChatbotMessageResponse(
        response=data.get("response", data.get("message", ""))
    )


def _validate_image_extension(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=[
                {
                    "field": "file",
                    "message": "Only jpeg and png images are allowed",
                }
            ],
        )
    return ext


def _validate_file_extension(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=[
                {
                    "field": "file",
                    "message": "Only text and pdf files are allowed",
                }
            ],
        )
    return ext


@router.post("", response_model=CustomChatbotOut, status_code=201)
async def create_custom_chatbot(
    payload: CustomChatbotCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(
        select(CustomChatbot).where(
            CustomChatbot.chatbot_name == payload.chatbot_name,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409, detail=[{"field": "chatbot_name", "message": "Chatbot name already exists"}]
        )

    existing_url = await db.scalar(
        select(CustomChatbot).where(
            CustomChatbot.url_path == payload.url_path,
        )
    )

    if existing_url:
        raise HTTPException(
            status_code=409, detail=[{"field": "url_path", "message": "URL path already exists"}]
        )

    org = None
    if payload.organization_uuid:
        org = await db.scalar(
            select(Organization).where(Organization.uuid == payload.organization_uuid)
        )
        if not org:
            raise HTTPException(
                status_code=404,
                detail=[{"field": "organization_uuid", "message": "Organization not found."}],
            )

    custom_chatbot = CustomChatbot(
        chatbot_name=payload.chatbot_name,
        description=payload.description,
        hero_image="random placeholder image path",
        url_path=payload.url_path,
        retrieval_key=str(uuid.uuid4()),
        is_public=payload.is_public,
        organization_id=org.id if org else None,
        file_path="random_file_path",
    )

    db.add(custom_chatbot)
    await db.commit()
    await db.refresh(custom_chatbot)

    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.id == custom_chatbot.id)
    )
    custom_chatbot = result.scalar_one()
    return _build_chatbot_out(custom_chatbot)


@router.get("/{chatbot_uuid}", response_model=CustomChatbotOut)
async def get_custom_chatbot(
    chatbot_uuid: str,
    db: AsyncSession = Depends(get_db),
):
    chatbot = await db.scalar(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.uuid == chatbot_uuid)
    )
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "chatbot_uuid", "message": "Chatbot uuid not found."}],
        )
    return _build_chatbot_out(chatbot)


@router.get("/by-url-path/{url_path}", response_model=CustomChatbotOut)
async def get_chabot_by_url_path(
    url_path: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.url_path == url_path)
    )
    custom_chatbot = result.scalar_one_or_none()
    if not custom_chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "custom_chatbot", "message": "Chat bot not found."}],
        )
    return _build_chatbot_out(custom_chatbot)


@router.get(
    "/by-url-organization/{organization_uuid}", response_model=list[CustomChatbotOut]
)
async def get_chabot_by_organization_uuid(
    organization_uuid: str,
    db: AsyncSession = Depends(get_db),
):
    org = await db.scalar(select(Organization).where(Organization.uuid == organization_uuid))
    if not org:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "organization_uuid", "message": "Organization not found."}],
        )

    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.organization_id == org.id)
    )
    chatbots = result.scalars().all()
    return [_build_chatbot_out(cb) for cb in chatbots]


@router.get("", response_model=CustomChatbotListOut)
async def list_custom_chatbot(
    current_user: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    is_publish: bool | None = Query(None),
    is_public: bool | None = Query(None),
    organization_uuid: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if sort_by not in ("chatbot_name", "created_at"):
        raise HTTPException(
            status_code=422,
            detail=[{"field": "sort_by", "message": "Must be 'chatbot_name' or 'created_at'."}],
        )
    if sort_order not in ("asc", "desc"):
        raise HTTPException(
            status_code=422,
            detail=[{"field": "sort_order", "message": "Must be 'asc' or 'desc'."}],
        )

    if organization_uuid is not None:
        org = await db.scalar(select(Organization).where(Organization.uuid == organization_uuid))
        if not org:
            raise HTTPException(
                status_code=404,
                detail=[{"field": "organization_uuid", "message": "Organization not found."}],
            )

    query = select(CustomChatbot).options(selectinload(CustomChatbot.organization))

    if search:
        query = query.where(CustomChatbot.chatbot_name.ilike(f"%{search}%"))
    if is_publish is not None:
        query = query.where(CustomChatbot.is_publish == is_publish)
    if is_public is not None:
        query = query.where(CustomChatbot.is_public == is_public)
    if organization_uuid is not None:
        query = query.where(CustomChatbot.organization_id == org.id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    sort_column = CustomChatbot.chatbot_name if sort_by == "chatbot_name" else CustomChatbot.created_at
    order_func = desc(sort_column) if sort_order == "desc" else sort_column.asc()
    query = query.order_by(order_func)

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    chatbots = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return CustomChatbotListOut(
        items=[_build_chatbot_out(cb) for cb in chatbots],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/publish/{chatbot_uuid}", response_model=CustomChatbotOut)
async def publish_chatbot(chatbot_uuid: str, db: AsyncSession = Depends(get_db)):
    chatbot = await db.scalar(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.uuid == chatbot_uuid)
    )
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "chatbot_uuid", "message": "Chat bot not found."}],
        )

    chatbot.is_publish = True
    await db.commit()
    await db.refresh(chatbot)
    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.id == chatbot.id)
    )
    chatbot = result.scalar_one()
    return _build_chatbot_out(chatbot)


@router.post("/unpublish/{chatbot_uuid}", response_model=CustomChatbotOut)
async def unpublish_chatbot(chatbot_uuid: str, db: AsyncSession = Depends(get_db)):
    chatbot = await db.scalar(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.uuid == chatbot_uuid)
    )
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "chatbot_uuid", "message": "Chat bot not found."}],
        )

    chatbot.is_publish = False
    await db.commit()
    await db.refresh(chatbot)
    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.id == chatbot.id)
    )
    chatbot = result.scalar_one()
    return _build_chatbot_out(chatbot)


@router.post("/make-public/{chatbot_uuid}", response_model=CustomChatbotOut)
async def make_chatbot_public(chatbot_uuid: str, db: AsyncSession = Depends(get_db)):
    chatbot = await db.scalar(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.uuid == chatbot_uuid)
    )
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "chatbot_uuid", "message": "Chat bot not found."}],
        )

    chatbot.is_public = True
    await db.commit()
    await db.refresh(chatbot)
    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.id == chatbot.id)
    )
    chatbot = result.scalar_one()
    return _build_chatbot_out(chatbot)


@router.post("/make-private/{chatbot_uuid}", response_model=CustomChatbotOut)
async def make_chatbot_private(chatbot_uuid: str, db: AsyncSession = Depends(get_db)):
    chatbot = await db.scalar(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.uuid == chatbot_uuid)
    )
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "chatbot_uuid", "message": "Chat bot not found."}],
        )

    chatbot.is_public = False
    await db.commit()
    await db.refresh(chatbot)
    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.id == chatbot.id)
    )
    chatbot = result.scalar_one()
    return _build_chatbot_out(chatbot)


@router.post("/{chatbot_uuid}/upload-image", response_model=CustomChatbotOut)
async def upload_chatbot_image(
    chatbot_uuid: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    chatbot = await db.scalar(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.uuid == chatbot_uuid)
    )
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "chatbot_uuid", "message": "Custom chatbot not found."}],
        )

    ext = _validate_image_extension(file.filename or "")

    image_name = f"{uuid.uuid4().hex}{ext}"

    os.makedirs(IMAGE_UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(IMAGE_UPLOAD_DIR, image_name)

    if chatbot.hero_image:
        old_path = os.path.join(IMAGE_UPLOAD_DIR, chatbot.hero_image)
        if os.path.exists(old_path):
            os.remove(old_path)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    chatbot.hero_image = image_name
    await db.commit()
    await db.refresh(chatbot)
    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.id == chatbot.id)
    )
    chatbot = result.scalar_one()
    return _build_chatbot_out(chatbot)


@router.get("/images/{image_name}")
async def get_chatbot_image(image_name: str):
    ext = os.path.splitext(image_name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=[{"field": "image_name", "message": "Invalid image format."}],
        )

    file_path = os.path.join(IMAGE_UPLOAD_DIR, image_name)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=[{"field": "image_name", "message": "Image not found."}],
        )

    return FileResponse(file_path, media_type=MIME_TYPES.get(ext, "image/jpeg"))


@router.post("/{chatbot_uuid}/upload-file", response_model=CustomChatbotOut)
async def upload_chatbot_file(
    chatbot_uuid: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    chatbot = await db.scalar(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.uuid == chatbot_uuid)
    )
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "chatbot_uuid", "message": "Custom chatbot not found."}],
        )

    ext = _validate_file_extension(file.filename or "")

    file_name = f"{uuid.uuid4().hex}{ext}"

    os.makedirs(FILE_UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(FILE_UPLOAD_DIR, file_name)

    if chatbot.hero_image:
        old_path = os.path.join(FILE_UPLOAD_DIR, chatbot.file_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    chatbot.file_path = file_name
    await db.commit()
    await db.refresh(chatbot)
    result = await db.execute(
        select(CustomChatbot).options(selectinload(CustomChatbot.organization)).where(CustomChatbot.id == chatbot.id)
    )
    chatbot = result.scalar_one()
    return _build_chatbot_out(chatbot)