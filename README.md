# Subasa (VocSi)

A Sinhala speech platform: speech-to-text, text-to-speech, and retrieval-based
chatbots over Sinhala documents. It ships both as a web app and as a metered,
API-key-gated HTTP API.

Deployed at `subasa.lk`, with the API at `api.subasa.lk`.

## What it does

Subasa lets people **use** Sinhala speech and chat models, and lets some of them
**create** their own retrieval chatbots over documents they upload. Who may do
which is the core of the product.

### Roles

| Role | `UserRole` | Can |
|---|---|---|
| System admin | `admin_user` | everything: create organizations, assign organization admins, create and publish chatbots, manage any user |
| Organization admin | `org_admin` | manage the users in their own organization; create chatbots and publish them to their organization or to the public. Assigned by a system admin. |
| Organization user | `org_user` | use chatbots their organization has access to |
| Registered user | `general_user` | use public and registered-only chatbots |
| Unregistered visitor | — | use public chatbots only |

Organizations are the tenancy boundary. A user belongs to at most one
(`users.organization_id`), and an organization has one admin.

### Chatbot visibility

Three columns carry the whole model:

| Type | Who can use it | `is_publish` | `is_public` | `organization_id` |
|---|---|---|---|---|
| Public | anyone, signed in or not | `true` | `true` | — |
| Registered users only | any signed-in user | `true` | `false` | `null` |
| Organization only | members of that organization | `true` | `false` | set |
| Unpublished | nobody but its owner/admin | `false` | — | — |

`frontend/new-chat-app/src/hooks/useChatbotAccess.ts` implements exactly this.
**It is currently the only place that does** — see Known gaps.

## Architecture

```
                    ┌──────────────┐        ┌─────────────┐
  browser ─────────▶│ new-chat-app │───────▶│             │
                    │  (React SPA) │        │             │        ┌──────────┐
                    └──────────────┘        │             │───────▶│  asr-be  │  Wav2Vec2 · W2V-BERT · Whisper
                                            │ api-gateway │        └──────────┘
  third party ─────────────────────────────▶│             │        ┌──────────┐
  X-Api-Key                                 │  (FastAPI)  │───────▶│  tts-be  │  6 VITS voices
                                            │             │        └──────────┘
                                            │  MySQL      │        ┌─────────────┐
                                            │  task queue │───────▶│ chatbot-mod │──▶ Redis (FAISS cache)
                                            │  metering   │        └─────────────┘    Groq llama-3.3-70b
                                            │  rate limit │        ┌──────────────┐
                                            └─────────────┘───────▶│ framework-be │  upload-a-doc chat
                                                    │              └──────────────┘
                                                    ▼
                                          Prometheus ─▶ Grafana
```

The gateway is the only stateful service. Everything else is a stateless model
server.

### Two ways in

- **First-party, keyless** — `/asr/*`, `/tts/*`, `/framework/*` and
  `/custom-chatbots/*`. The web app calls these with a session cookie or JWT.
- **Metered, key-gated** — `/api/{service_key}/{path}` looks `service_key` up in
  the `services` table and proxies to it. Requires `X-Api-Key`, enforces a
  per-key rate limit and a `ServiceUsage` token allocation, and records every
  call in `usage_logs`.

Services registered as `response_type: long` are not proxied synchronously —
the gateway enqueues a `Task`, returns a `task_uuid` immediately, and a
background worker polls it. Clients then use `/tasks/{uuid}/status|result|download`.

## Services and ports

| Service | Host port | Container port | What it is |
|---|---|---|---|
| `api-gateway` | 7010 | 7010 | FastAPI + MySQL. Auth, tenancy, API keys, quotas, proxying. |
| `asr-be` | 7000 | 6000 | Sinhala ASR. Wav2Vec2, Wav2Vec2-BERT, Whisper (with SSE streaming). |
| `tts-be` | 7002 | 6002 | Sinhala TTS. Six VITS voices, sentence-by-sentence WAV streaming. |
| `chatbot-mod` | 7006 | 7006 | RAG over an uploaded document. FAISS index cached in Redis. |
| `framework-be` | 7003 | 6003 | Upload-a-document-and-chat. Bounded in-process index cache. |
| `new-chat-app` | 7007 | 7007 | The web app. React 19 + Vite + MUI, served by nginx. |
| `voicebot-frontend` | 7005 | 7005 | Legacy vanilla-JS app. **Deprecated** — see `frontend/voicebot/DEPRECATED.md`. |
| `redis` | 6379 | 6379 | Serialized FAISS indexes for chatbot-mod. |
| `prometheus` | 9090 | 9090 | Scrapes `/metrics` from every service. |
| `grafana` | 3000 | 3000 | Dashboards. |

## Running it

```bash
cp .env.example .env
# Fill in at minimum: DATABASE_URL, JWT_SECRET, GROQ_API_KEY,
# ASR_HF_TOKEN / TTS_HF_TOKEN, GRAFANA_ADMIN_PASSWORD.
python -c 'import secrets; print(secrets.token_urlsafe(48))'   # for JWT_SECRET

docker compose up -d
```

The gateway **refuses to start** without a strong `JWT_SECRET`, and every
service refuses to start if `CORS_ALLOW_ORIGINS` is `*` or empty. That is
deliberate — see `docs/SECURITY-AUDIT.md`.

First run downloads several gigabytes of model checkpoints from Hugging Face
into `~/.cache/huggingface`, which is mounted into the containers.

### Just the frontend

```bash
cd frontend/new-chat-app
cp .env.example .env      # point VITE_API_BASE_URL at a running gateway
npm ci && npm run dev
```

### Just the gateway

```bash
cd backend/api-gateway
pip install -r requirements-dev.txt
cp .env.example .env      # fill in JWT_SECRET and DATABASE_URL
uvicorn main:app --reload --port 7010
```

Interactive API docs at `http://localhost:7010/docs`.

### One-time data setup

Two things the stack cannot bootstrap for itself:

- **The government chatbot.** `/p/gov-chatbot` reads a custom chatbot whose
  `url_path` matches `VITE_GOV_CHATBOT_PATH` (default `gov-chatbot`). No such
  row exists yet. Create it, upload
  `backend/chatbot-modified/Sri Lanka Constitution-Sinhala.txt` to it, publish
  it and make it public. Until then that page 404s.
- **The metered API.** `/api/{service_key}/…` routes from the `services` table,
  which is **empty**, so that entire door currently resolves nothing. Register
  each backend with `POST /services`, then give an API key an allocation with
  `POST /usage/service-usage`. All current traffic uses the keyless first-party
  routes instead.

### A note on the database schema

**Do not run `alembic upgrade head` — it does not work.** A past commit deleted
ten migration files, one of which (`fd7d9a25f32a`) is still referenced as the
`down_revision` of the surviving `a3ed621aab5e`, so alembic cannot build its
revision map and dies with a `KeyError`. Existing databases are stamped at the
initial revision and carry columns no surviving migration adds, so the
`alembic_version` row does not describe the schema either.

The schema is created by `Base.metadata.create_all` in `main.py`'s lifespan
handler. That creates missing **tables** but never alters existing ones, so a
model change against an already-deployed database has to be applied by hand.
Rebuilding the migration history from the current models is the real fix, and
has not been done.

## Configuration

Every variable a service reads is documented in its own `.env.example`. The
root `.env.example` covers what `docker-compose.yml` itself needs. `.env` files
are gitignored **and** excluded from every Docker build context — secrets are
injected at run time, never baked into an image.

## Testing

See `docs/TESTING.md`. In short: `pytest` in `backend/api-gateway` for the unit
suite, `pytest tests/smoke -m smoke` in `backend/` against a running stack, and
`npm run lint && npm run typecheck && npm run build` in the frontend. CI runs
all of it on every PR.

Load-test scenarios live in `loadtests/`.

## Repository layout

```
backend/
  api-gateway/     FastAPI gateway — the only stateful service
  shared/          the one RAG recipe (splitter, embeddings, prompt, LLM)
  ASR/             Sinhala speech-to-text
  TTS/             Sinhala text-to-speech (TTS/ is vendored Coqui)
  chatbot-modified/  RAG chat over an uploaded file, Redis-cached
  framework/       upload-then-chat service
  tests/smoke/     HTTP smoke tests against a running stack
frontend/
  new-chat-app/    the web app
  voicebot/        legacy SPA, deprecated
mobile-app/
  subasa-app/      Expo starter — not yet built out (issues #47–#51)
grafana/           Prometheus + Grafana provisioning
loadtests/         k6 scenarios
docs/              security audit, testing guide
```

**Every service has its own README** with its endpoints, configuration and
known issues. Read the one for the service you are touching before this file:

| | |
|---|---|
| [`backend/api-gateway`](backend/api-gateway/README.md) | auth, metering, proxying, tasks |
| [`backend/ASR`](backend/ASR/README.md) | the three speech-to-text models |
| [`backend/TTS`](backend/TTS/README.md) | the six voices and the streaming formats |
| [`backend/chatbot-modified`](backend/chatbot-modified/README.md) | custom-chatbot RAG |
| [`backend/framework`](backend/framework/README.md) | upload-then-chat RAG |
| [`backend/shared`](backend/shared/README.md) | the shared RAG recipe and token accounting |
| [`frontend/new-chat-app`](frontend/new-chat-app/README.md) | the web app |
| [`frontend/voicebot`](frontend/voicebot/README.md) | the deprecated SPA |
| [`mobile-app/subasa-app`](mobile-app/subasa-app/README.md) | the mobile scaffold |
| [`grafana`](grafana/README.md) | monitoring |

## Known gaps

Ordered by severity. Everything here was reproduced against a running gateway,
not inferred from reading.

**1. Anyone can make themselves a system admin.** `PUT /users/{uuid}` has no
auth dependency and `UserUpdate` accepts `role`. A request with no token at all
promotes any account to `admin_user`. Confirmed live.

**2. Most write endpoints have no auth dependency.** All of `/orgs` (create,
list, activate, assign admin, add users) and most of `/custom-chatbots`
(create, publish, make-public, both uploads). An anonymous caller can create a
chatbot and publish it to the public.

**3. The visibility model above is enforced in the browser only.**
`POST /custom-chatbots/api/{url_path}` checks `is_publish` and nothing else —
not `is_public`, not the organization. Organization-only and registered-only
chatbots are readable by anyone who knows the URL. A correct sibling,
`/custom-chatbots/api/private/{url_path}`, exists but nothing calls it.

**4. API keys are stored and compared in plaintext.** The column is named
`key_hash`; nothing is hashed, and `POST /api-keys` takes the key from the
client instead of generating one.

**5. Every proxy route lets httpx exceptions escape.** With a model service
down, `/api/*`, `/asr/*`, `/tts/*` and `/framework/*` return an unhandled 500
with a traceback, or drop the connection outright for the streaming ones. This
fires on every deploy, because the model containers take minutes to load their
checkpoints.

**6. `POST /orgs/{uuid}/users` demotes.** It sets `role = org_user`
unconditionally, so adding an existing admin or organization admin to an
organization strips their role.

Smaller, but they cost time:

- **The database stores enum *names*; the API uses enum *values*.**
  `users.role` holds `admin` / `general_user` / `organization_user` /
  `organization_admin`, while JWTs and JSON use `admin_user` / `general_user` /
  `org_user` / `org_admin`. The ORM converts. Hand-written SQL does not.
- `rate_limit.py` counts in process, so a second gateway replica multiplies the
  effective limit.
- The mobile app is an unmodified Expo starter (issues #47–#51).
- `frontend/voicebot` is still deployed and its chatbot page is already broken,
  because the service it called was removed.
- Auth state on the web app has a known problem, still being specified.

## Project state

35 of the 41 open issues are fixed on the `chore/handover-fixes` branch, which
is **not yet merged** — so they are all still open on GitHub, and the fixes are
not in `main`. That branch covers repository cleanup, secret hygiene, CORS and
JWT hardening, the shared RAG module, real ASR/TTS/upload wiring, SSE
streaming, rate limiting, token metering, the async task path, Google sign-in,
a 64-test suite, smoke tests, load-test scenarios, CI, and these docs.

Deliberately left open: the mobile app (#47–#51), and removal of the legacy
voicebot (#44), which is documented as deprecated rather than deleted because
nothing has confirmed it is unused.

Items 1–3 under Known gaps are the substantive remaining work. They are really
one job — *enforce the Roles and Chatbot visibility tables above on the server
instead of in the browser* — and it has not been started.
