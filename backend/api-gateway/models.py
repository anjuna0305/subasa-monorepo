import enum
import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import Enum, ForeignKey, LargeBinary, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    admin = "admin_user"
    general_user = "general_user"
    organization_user = "org_user"
    organization_admin = "org_admin"


class ResponseType(str, enum.Enum):
    short = "short"
    long = "long"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(_uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.general_user
    )
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="user")
    organization: Mapped["Organization"] = relationship(back_populates="users")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    user: Mapped["User"] = relationship(back_populates="api_keys")
    service_usages: Mapped[list["ServiceUsage"]] = relationship(
        back_populates="api_key"
    )
    usage_logs: Mapped[list["UsageLog"]] = relationship(back_populates="api_key")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    service_key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    service_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    response_type: Mapped[ResponseType] = mapped_column(
        Enum(ResponseType), nullable=False, default=ResponseType.short
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    service_usages: Mapped[list["ServiceUsage"]] = relationship(
        back_populates="service"
    )
    usage_logs: Mapped[list["UsageLog"]] = relationship(back_populates="service")


class ServiceUsage(Base):
    __tablename__ = "service_usages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    api_key_id: Mapped[int] = mapped_column(ForeignKey("api_keys.id"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    usage_limit: Mapped[int] = mapped_column(nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)

    api_key: Mapped["ApiKey"] = relationship(back_populates="service_usages")
    service: Mapped["Service"] = relationship(back_populates="service_usages")


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    api_key_id: Mapped[int] = mapped_column(ForeignKey("api_keys.id"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    tokens_used: Mapped[int] = mapped_column(nullable=False)
    requested_at: Mapped[datetime] = mapped_column(default=_utcnow)
    status: Mapped[str] = mapped_column(String(50), nullable=False)

    api_key: Mapped["ApiKey"] = relationship(back_populates="usage_logs")
    service: Mapped["Service"] = relationship(back_populates="usage_logs")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    api_key_id: Mapped[int] = mapped_column(ForeignKey("api_keys.id"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), nullable=False, default=TaskStatus.pending
    )
    request_method: Mapped[str] = mapped_column(String(10), nullable=False)
    request_path: Mapped[str] = mapped_column(String(500), nullable=False)
    request_query: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    request_headers: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    request_body: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    response_status_code: Mapped[int | None] = mapped_column(nullable=True)
    response_body: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    response_content_type: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    tokens_used: Mapped[int] = mapped_column(nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    api_key: Mapped["ApiKey"] = relationship()
    service: Mapped["Service"] = relationship()


class CustomChatbot(Base):
    __tablename__ = "custom_chatbots"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    chatbot_name: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(200), nullable=False)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    hero_image: Mapped[str | None] = mapped_column(String(200), nullable=True)
    url_path: Mapped[str] = mapped_column(String(200), nullable=False)
    retrieval_key: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_publish: Mapped[bool] = mapped_column(default=False)
    is_public: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    organization: Mapped["Organization"] = relationship(back_populates="chat_bots")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    chat_bots: Mapped[list["CustomChatbot"]] = relationship(
        back_populates="organization"
    )