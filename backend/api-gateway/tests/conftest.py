"""Test harness for the api-gateway.

Everything runs against an in-memory SQLite database through the same async
SQLAlchemy layer the app uses in production, with `get_db` overridden so a
single connection is shared for the life of a test.
"""

import os
import sys

# config.py validates at import time, so the environment has to be sane before
# anything under test is imported.
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-long-enough-for-the-check")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("CORS_ALLOW_ORIGINS", "http://localhost:5173")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("RATE_LIMIT_REQUESTS", "0")  # off unless a test opts in

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402

import rate_limit  # noqa: E402
from database import get_db  # noqa: E402
from models import Base  # noqa: E402


@pytest_asyncio.fixture
async def engine():
    # StaticPool keeps one connection, without which each session would get its
    # own empty :memory: database.
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db(session_factory) -> AsyncSession:
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(session_factory):
    # Imported here so the env vars above are already in place.
    from main import app

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    rate_limit.reset()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    rate_limit.reset()
    yield
    rate_limit.reset()
