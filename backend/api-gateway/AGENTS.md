# AGENTS.md

## Project Overview

Subasa Services Backend — An API gateway backend that proxies requests to downstream AI/ML services, manages API keys, tracks usage/tokens, handles async task processing for long-running requests, and supports custom chatbot creation with file/image uploads. Multi-tenant system with organization-based access control.

## Tech Stack

- **Language**: Python 3.13
- **Framework**: FastAPI 0.136.1
- **ASGI Server**: Uvicorn 0.46.0
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic 1.18.4
- **Validation**: Pydantic v2
- **Auth**: PyJWT (HS256), passlib + argon2-cffi for password hashing
- **HTTP Client**: httpx 0.28.1 (async, for proxying to downstream services)
- **File Uploads**: python-multipart
- **Containerization**: Docker (python:3.13-slim)

## How to Run

```bash
# Install dependencies
pip install -r requirments.txt

# Run database migrations
alembic upgrade head

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Docker

```bash
docker build -t subasa-backend .
docker run -p 8000:8000 subasa-backend
```

## Project Structure

```
├── main.py                     # FastAPI app entry point, lifespan handler
├── config.py                   # Environment variable configuration
├── database.py                 # SQLAlchemy async engine + session factory
├── models.py                   # All SQLAlchemy ORM models
├── schemas.py                  # All Pydantic request/response schemas
├── auth.py                     # JWT auth, role-based access control
├── api_key_validator.py        # API key validation + usage limit checking
├── task_worker.py              # Async background worker for long-running tasks
├── routers/
│   ├── __init__.py
│   ├── _http.py                # Shared httpx.AsyncClient singleton
│   ├── users.py                # User registration, login, CRUD
│   ├── api_keys.py             # API key management
│   ├── services.py             # Service CRUD
│   ├── usage.py                # Service usage allocation + usage logs
│   ├── gateway.py              # API gateway proxy (core feature)
│   ├── tasks.py                # Async task status/result/download
│   ├── organizations.py        # Organization CRUD + user assignment
│   └── custom_chatbots.py      # Custom chatbot CRUD + file upload + chat proxy
├── uploads/
│   ├── chatbot_images/         # Uploaded chatbot hero images (jpeg/png)
│   └── chatbot_files/          # Uploaded chatbot knowledge files (txt/pdf)
├── alembic/                    # Database migration framework
│   ├── env.py
│   └── versions/               # Migration files
├── Dockerfile
├── alembic.ini
└── requirments.txt             # Note: filename has a typo
```

## Architecture

- **main.py** — App factory with lifespan handler. On startup: creates all DB tables and starts the background task worker. On shutdown: cancels the worker, closes the HTTP client, disposes the DB engine.
- **config.py** — Centralized config from environment variables with hardcoded defaults.
- **routers/** — Each domain area is its own router module. Business logic is embedded directly in route handlers (no separate service layer).
- **auth.py** — JWT token decoding, `CurrentUser` dataclass, `require_role()` guard. Type aliases: `AdminUser`, `GeneralUser`, `AnyUser`.
- **api_key_validator.py** — Validates API key existence, activation, expiration, service access, and usage limits.
- **task_worker.py** — Background asyncio worker that consumes from an in-process `asyncio.Queue`, makes upstream HTTP requests, stores results in DB.

### Core Pattern — API Gateway

The gateway router (`/api/{service_key}/{path}`) is the core feature:
1. Validates the `X-Api-Key` header
2. Looks up the target service by `service_key`
3. For **short-response** services: proxies the request synchronously via httpx, logs token usage from `X-Tokens-Used` response header
4. For **long-response** services: enqueues an async `Task`, returns a task_id immediately, processes in background via `task_worker`

## Authentication

Two auth mechanisms:
1. **Bearer token** via `Authorization` header for user-facing endpoints
2. **`X-Api-Key` header** for gateway and task endpoints

Role-based access control with roles: `admin_user`, `general_user`, `org_user`, `org_admin`

## API Routes

| Prefix | Router | Description |
|---|---|---|
| `/users` | users.py | User registration, login, CRUD |
| `/api-keys` | api_keys.py | API key management |
| `/services` | services.py | Service CRUD |
| `/usage` | usage.py | Service usage allocation + usage logs |
| `/api` | gateway.py | API gateway proxy (all HTTP methods) |
| `/tasks` | tasks.py | Async task status/result/download |
| `/orgs` | organizations.py | Organization CRUD + user assignment |
| `/custom-chatbots` | custom_chatbots.py | Chatbot CRUD + file upload + chat proxy |

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `mysql+aiomysql://subasa:your_password@localhost:3306/subasa` | Async MySQL connection string |
| `JWT_SECRET` | `change-me-in-production` | HS256 signing key |
| `JWT_EXPIRE_MINUTES` | `1440` (24 hours) | JWT token expiration |
| `UPLOAD_DIR` | `./uploads/chatbot_images` or `./uploads/chatbot_files` | File upload directories |
| `CUSTOM_CHATBOT_SERVICE_URL` | `http://localhost:6002/chat` | Downstream chatbot service URL |

## Known Issues

- Filename typo: `requirments.txt` should be `requirements.txt`
- Both `IMAGE_UPLOAD_DIR` and `FILE_UPLOAD_DIR` read from the same `UPLOAD_DIR` env var
- Many endpoints lack authentication (user listing, org CRUD, chatbot management)
- CORS allows all origins (`allow_origins=["*"]`)
- No test coverage — zero test files exist
- No CI/CD pipeline configured
- No linter or formatter configured (no ruff, black, mypy, or isort)
- Hardcoded placeholder values in custom_chatbots.py create endpoint
