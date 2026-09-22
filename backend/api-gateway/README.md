# api-gateway

The only stateful service in Subasa. It owns users, organizations, API keys,
quotas and async tasks, and it fronts every model service.

- **Stack**: Python 3.13 · FastAPI · SQLAlchemy 2.0 (async) · MySQL (aiomysql) · httpx
- **Port**: 7010 (runs `network_mode: host` in compose)
- **Docs**: `http://localhost:7010/docs` · metrics on `/metrics` · liveness on `/health`

## Two ways in

The gateway exposes the same models through two very different doors.

**First-party, keyless** — `/asr/*`, `/tts/*`, `/framework/*`,
`/custom-chatbots/*`. The web app calls these with a session JWT (or none at
all, for public chatbots). No metering, no quotas.

**Metered, key-gated** — `/api/{service_key}/{path}`. Requires an `X-Api-Key`
header. This is the developer-facing API:

1. `validate_api_key()` checks the key exists, is active and unexpired.
2. It looks the service up **in the `services` table** by `service_key` — the
   routing is entirely data-driven, so a service exists only once a row does.
3. It checks the key has a `ServiceUsage` allocation for that service, that the
   allocation has not expired, and that `SUM(usage_logs.tokens_used)` is under
   the limit.
4. `check_rate_limit()` applies a per-key sliding window.
5. The request is proxied, and a `UsageLog` row is written with the token count
   the upstream reported in `X-Tokens-Used`.

> **The `services` table is currently empty**, so the entire metered path
> resolves nothing. All live traffic uses the first-party routes. Register a
> service with `POST /services` before that door opens.

### Short vs long responses

A `Service` row carries a `response_type`:

- `short` — proxied synchronously; the upstream's body is streamed back.
- `long` — the gateway persists a `Task`, returns `{task_uuid, status}`
  immediately, and `task_worker.py` (a single in-process asyncio consumer
  started in the lifespan handler) makes the upstream call in the background.
  Clients poll `/tasks/{uuid}/status`, then `/result` or `/download`.

## Routes

| Prefix | Module | Notes |
|---|---|---|
| `/users` | `routers/users.py` | register, login, Google sign-in, listing, block/unblock, org assignment |
| `/orgs` | `routers/organizations.py` | organization CRUD, admin assignment, bulk user assignment |
| `/api-keys` | `routers/api_keys.py` | key CRUD |
| `/services` | `routers/services.py` | the registry the metered proxy routes from |
| `/usage` | `routers/usage.py` | allocations, logs, `/usage/summary` for the admin dashboard |
| `/api` | `routers/gateway.py` | the metered proxy |
| `/tasks` | `routers/tasks.py` | async task status / result / download |
| `/custom-chatbots` | `routers/custom_chatbots.py` | chatbot CRUD, uploads, publish/visibility, chat |
| `/asr` `/tts` `/framework` | `routers/{asr,tts,framework}.py` | keyless first-party proxies |

## Auth

Two independent mechanisms that never mix:

- **JWT bearer** (`auth.py`) — HS256, 24h default. Claims: `sub` (user uuid),
  `email`, `role`, `organization_uuid`. `require_role()` produces the
  `AdminUser` / `OrgAdminUser` / `AdminOrOrgAdminUser` / `AnyUser` dependencies.
- **`X-Api-Key`** (`api_key_validator.py`) — for `/api` and `/tasks`. Carries no
  user role.

Roles: `admin_user`, `org_admin`, `org_user`, `general_user`.

> **Gotcha:** SQLAlchemy stores the enum *name* while the API and JWTs use the
> *value*. The `users.role` column holds
> `admin` / `general_user` / `organization_user` / `organization_admin`, but the
> API speaks `admin_user` / `general_user` / `org_user` / `org_admin`. The ORM
> converts; hand-written SQL does not.

## Error shape

`main.py` installs two exception handlers that normalise everything to:

```json
{ "detail": [ { "field": "email", "message": "User email already exists." } ] }
```

The web app's axios interceptor iterates that array to raise toasts. Endpoints
that return a bare string `detail` produce a generic "Request failed (4xx)" in
the UI instead of the real reason — several proxy routes still do.

## Configuration

See `.env.example`. `config.py` validates at import and **refuses to start** on:
a missing `JWT_SECRET`, a known placeholder secret, a secret under 32 chars when
`APP_ENV=production`, or a `CORS_ALLOW_ORIGINS` that is `*` or empty.

## Database schema

`main.py`'s lifespan handler calls `Base.metadata.create_all`. That creates
missing tables but never alters existing ones.

**Alembic does not work.** A past commit deleted ten migrations, one of which
(`fd7d9a25f32a`) is still the `down_revision` of the surviving `a3ed621aab5e`,
so `alembic upgrade head` dies with a `KeyError`. Deployed databases are stamped
at the initial revision and carry columns no surviving migration adds, so
`alembic_version` does not describe the schema either. Model changes against a
live database have to be applied by hand.

## Running it

```bash
pip install -r requirements-dev.txt
cp .env.example .env          # fill in JWT_SECRET and DATABASE_URL
uvicorn main:app --reload --port 7010
pytest -q                     # 64 tests, in-memory SQLite, no network
```

## Known issues

Ordered by severity. All are reproducible.

1. **`PUT /users/{uuid}` has no auth dependency and accepts `role`.** Anyone who
   knows a user's UUID can promote it to `admin_user`. Verified live.
2. **All of `/orgs` and most of `/custom-chatbots` have no auth dependency** —
   create, publish, make-public and both upload endpoints included.
3. **The chatbot access model is enforced client-side only.**
   `POST /custom-chatbots/api/{url_path}` checks `is_publish` and nothing else,
   so organization-only and registered-users-only chatbots are readable by
   anyone with the URL. The correct sibling `/custom-chatbots/api/private/...`
   exists but nothing calls it.
4. **API keys are stored and compared in plaintext.** The column is named
   `key_hash`; nothing is hashed, and `POST /api-keys` takes the key from the
   client rather than generating one.
5. **Every proxy route lets httpx exceptions escape.** With an upstream down,
   `/api/*`, `/asr/*`, `/tts/*` and `/framework/*` return an unhandled 500 or
   drop the connection instead of a clean 502/503. Matters on every deploy,
   because the model containers take minutes to load checkpoints.
6. `POST /orgs/{uuid}/users` sets `role = org_user` unconditionally, so adding
   an existing admin or org_admin to an organization demotes them.
7. `rate_limit.py` counts in process. A second gateway replica multiplies the
   effective limit by the replica count.
