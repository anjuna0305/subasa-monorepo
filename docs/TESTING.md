# Testing

## What runs in CI

`.github/workflows/ci.yml` runs on every push and PR to `main`:

| Job | What it does |
|---|---|
| `backend` | `ruff check` + `ruff format --check` + the api-gateway pytest suite |
| `services-lint` | `ruff check` over ASR, TTS, chatbot-modified, framework and shared |
| `frontend` | `npm run lint`, `npm run typecheck`, `npm run build` |
| `compose` | `docker compose config` — catches drift between compose and the Dockerfiles |

## api-gateway unit tests

```bash
cd backend/api-gateway
pip install -r requirements-dev.txt
pytest -q
```

They run against in-memory SQLite through the same async SQLAlchemy layer as
production, with `get_db` overridden and the HTTP client swapped for an httpx
`MockTransport`. No network, no database server, no models. 55 tests covering:

- registration, login, blocked users, JWT rejection, role guards
- API-key validation: unknown / deactivated / expired keys, unknown or
  inactive services, missing and expired allocations, usage limits
- the `/api` proxy: short vs long services, header stripping, token metering,
  upstream failures, rate limiting
- the task worker and the status / result / download endpoints
- organization CRUD and user blocking rules
- the `config.py` startup guards, each in its own subprocess

`tests/factories.py` seeds rows; note its comment about `ApiKey.key_hash`,
which despite the name holds the key verbatim.

## Model-service smoke tests

ASR, TTS and chatbot-modified load multi-gigabyte checkpoints at import time,
so they cannot be unit tested honestly — a stub tower deep enough to import
them would only be testing the stubs. Their smoke tests talk HTTP to real
running services instead, and **skip themselves when nothing is listening**:

```bash
docker compose up -d asr-be tts-be chatbot-mod framework-be api-gateway
cd backend && pytest tests/smoke -m smoke
```

Point them anywhere with `ASR_URL`, `TTS_URL`, `CHATBOT_URL`,
`FRAMEWORK_URL`, `GATEWAY_URL`; `SMOKE_TIMEOUT` defaults to 120s because
first-request inference is slow.

They cover each service's `/health`, one happy path each (ASR transcription
and its SSE stream, TTS synthesis, framework upload-then-chat), the
`X-Tokens-Used` metering header, and the input-validation paths — including
that chatbot-modified rejects a `file_path` that escapes its upload directory.

CI does not run these: it has no models. Run them against staging after a
deploy.

## Load tests

See `loadtests/README.md`.
