from datetime import datetime
from typing import List

from models import ResponseType, TaskStatus, UserRole
from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    # organization_uuid: str
    password: str
    role: UserRole = UserRole.general_user

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be empty")
        if len(v) > 100:
            raise ValueError("name must be at most 100 characters")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("password must be at most 128 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("password must contain at least one digit")
        return v


class GoogleUserCreate(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.general_user
    google_id: str
    avatar_url: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be empty")
        if len(v) > 100:
            raise ValueError("name must be at most 100 characters")
        return v.strip()


class UserUpdate(BaseModel):
    name: str
    email: EmailStr
    organization_uuid: str
    role: UserRole = UserRole.general_user

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be empty")
        if len(v) > 100:
            raise ValueError("name must be at most 100 characters")
        return v.strip()


class UserOut(BaseModel):
    uuid: str
    name: str
    email: str
    role: UserRole
    created_at: datetime
    is_active: bool
    organization_uuid: str | None
    organization_name: str | None = None
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class UserListItemOut(BaseModel):
    uuid: str
    name: str
    email: str
    role: UserRole
    created_at: datetime
    is_active: bool
    organization_uuid: str | None
    organization_name: str | None

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    items: list[UserListItemOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str


class GoogleLoginRequest(BaseModel):
    code: str
    redirect_uri: str | None = None


class GoogleLoginOut(BaseModel):
    access_token: str
    organization_uuid: str | None
    token_type: str = "bearer"
    role: UserRole
    is_new_user: bool


class TokenOut(BaseModel):
    access_token: str
    organization_uuid: str | None
    token_type: str = "bearer"
    role: UserRole


class ApiKeyCreate(BaseModel):
    key_hash: str
    label: str | None = None
    expires_at: datetime | None = None


class AssignOrgToUser(BaseModel):
    organization_uuid: str


class ApiKeyOut(BaseModel):
    uuid: str
    user_uuid: str
    label: str | None = None
    created_at: datetime
    expires_at: datetime | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class ServiceCreate(BaseModel):
    service_key: str
    service_name: str
    base_url: str
    response_type: ResponseType = ResponseType.short


class ServiceOut(BaseModel):
    uuid: str
    service_key: str
    service_name: str
    base_url: str
    response_type: ResponseType
    is_active: bool

    model_config = {"from_attributes": True}


class ServiceUsageCreate(BaseModel):
    api_key_uuid: str
    service_uuid: str
    usage_limit: int
    expires_at: datetime | None = None


class ServiceUsageOut(BaseModel):
    uuid: str
    api_key_uuid: str
    service_uuid: str
    usage_limit: int
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


class UsageLogCreate(BaseModel):
    api_key_uuid: str
    service_uuid: str
    tokens_used: int
    status: str


class UsageLogOut(BaseModel):
    uuid: str
    api_key_uuid: str
    service_uuid: str
    tokens_used: int
    requested_at: datetime
    status: str

    model_config = {"from_attributes": True}


class CurrentUsageOut(BaseModel):
    api_key_uuid: str
    service_uuid: str
    total_tokens_used: int
    request_count: int

    model_config = {"from_attributes": True}


class TaskSubmitOut(BaseModel):
    task_uuid: str
    status: TaskStatus

    model_config = {"from_attributes": True}


class TaskStatusOut(BaseModel):
    task_uuid: str
    status: TaskStatus
    created_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None

    model_config = {"from_attributes": True}


class TaskResultOut(BaseModel):
    task_uuid: str
    status: TaskStatus
    response_status_code: int | None = None
    response_content_type: str | None = None
    tokens_used: int
    completed_at: datetime | None = None
    error_message: str | None = None

    model_config = {"from_attributes": True}


class CustomChatbotCreate(BaseModel):
    chatbot_name: str
    description: str
    url_path: str
    organization_uuid: str | None
    is_public: bool

    model_config = {"from_attributes": True}

    @field_validator("chatbot_name")
    @classmethod
    def chatbot_name_must_be_valid(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("chatbot name cannot be empty")
        if len(v) > 100:
            raise ValueError("chatbot name must be at most 100 characters")
        return v.strip()

    @field_validator("description")
    @classmethod
    def description_must_be_valid(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description cannot be empty")
        if len(v) > 500:
            raise ValueError("description must be at most 500 characters")
        return v.strip()

    @field_validator("url_path")
    @classmethod
    def url_path_must_be_valid(cls, v: str) -> str:
        import re

        v = v.strip().lower()
        if not v:
            raise ValueError("url path cannot be empty")
        if len(v) > 100:
            raise ValueError("url path must be at most 100 characters")
        if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", v):
            raise ValueError(
                "url path must contain only lowercase letters, numbers, and hyphens (e.g. 'my-chatbot')"
            )
        return v


class CustomChatbotMessageRequest(BaseModel):
    message: str


class CustomChatbotMessageResponse(BaseModel):
    response: str


class CustomChatbotOut(BaseModel):
    uuid: str
    chatbot_name: str
    organization_uuid: str | None
    file_path: str
    description: str
    hero_image: str
    url_path: str
    retrieval_key: str
    is_publish: bool
    is_public: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class CustomChatbotListOut(BaseModel):
    items: list[CustomChatbotOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class OrganizationCreate(BaseModel):
    name: str
    is_active: bool

    model_config = {"from_attributes": True}

    @field_validator("name")
    @classmethod
    def chatbot_name_must_be_valid(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("chatbot name cannot be empty")
        if len(v) > 50:
            raise ValueError("chatbot name must be at most 50 characters")
        return v.strip()

    @field_validator("is_active")
    @classmethod
    def is_active_must_be_valid(cls, v: bool) -> bool:
        if not isinstance(v, bool):
            raise ValueError("is_active must be a boolean")
        return v


class OrganizationOut(BaseModel):
    uuid: str
    name: str
    is_active: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class AssignOrgAdmin(BaseModel):
    user_uuid: str

    model_config = {"from_attributes": True}


class AssignUsersToOrg(BaseModel):
    user_uuids: List[str]


class AssignUsersToOrgOut(BaseModel):
    user_uuids: List[str]


class OrganizationUserIdsOut(BaseModel):
    user_uuids: List[str]


class TtsGenerateRequest(BaseModel):
    text: str
    speaker: str = "mettananda"
    speaker_type: str = "single"
    voice: str = "male"
    input_type: str = "sinhala"

    @field_validator("text")
    @classmethod
    def text_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text cannot be empty")
        return v.strip()


class TtsGenerateResponse(BaseModel):
    audioUrl: str
