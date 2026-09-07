# Subasa (VocSi)

A Sinhala speech platform: speech-to-text, text-to-speech, and retrieval-based
chatbots over Sinhala documents. It ships both as a web app and as a metered,
API-key-gated HTTP API.

Deployed at `subasa.lk`, with the API at `api.subasa.lk`.

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
alembic upgrade head
uvicorn main:app --reload --port 7010
```

Interactive API docs at `http://localhost:7010/docs`.

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
loadtests/         k6 scenarios
docs/              security audit, testing guide
```

## Known gaps

Tracked as GitHub issues; the ones worth knowing before touching the code:

- **API keys are stored and compared in plaintext.** The column is named
  `key_hash` but nothing is hashed, and `POST /api-keys` takes the key from the
  client rather than generating it.
- **Many write endpoints have no auth dependency** — organization CRUD, custom
  chatbot create/publish/upload, and `PUT /users/{uuid}` (which lets any caller
  set any user's role).
- The mobile app is an unmodified Expo starter.
- `frontend/voicebot` is still deployed and its chatbot page is broken, because
  the service it called was removed.
