# Subasa Monorepo
#  Subasa Project.



**Subasa** is a Sinhala-language AI platform combining automatic speech recognition (ASR), text-to-speech (TTS), and conversational AI into a unified, containerised system.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Service & Port Reference](#service--port-reference)
- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [Frontend Dev Servers](#frontend-dev-servers)
- [Mobile App](#mobile-app)
- [Observability](#observability)
- [Roadmap](#roadmap)

---

## Architecture Overview

```
+------------------------------------------------------------------+
|                          Clients                                 |
|          Browser (new-chat-app / voicebot)  |  Mobile App        |
+------------------------+-----------------------------------------+
                         |  HTTP / WebSocket
                         v
               +-----------------------+
               |     api-gateway       |  :7010  (FastAPI + Alembic)
               |  Auth · Users         |
               |  Orgs · API Keys      |
               |  Custom Chatbots      |
               |  Task Queue (Redis)   |
               |  /metrics (Prometheus)|
               +-------+-------+-------+
          +------------+       +--------------------+
          |  proxy / internal calls                 |
          v                                         v
+----------------+  +-------------+  +---------------------+  +--------------+
|   asr-be       |  |   tts-be    |  |   chatbot-mod        |  |  framework   |
|  :7000 (Flask) |  | :7002 (Fla) |  |  :7006 (FastAPI)     |  | :7003 (Fast) |
|  Whisper-based |  |  Sinhala    |  |  Groq LLM + Redis    |  |  Document    |
|  ASR engine    |  |  TTS engine |  |  RAG chatbot         |  |  upload/RAG  |
+----------------+  +-------------+  +---------------------+  +--------------+
                                               |
                                               v
                                       +--------------+
                                       |    Redis      |  :6379
                                       |  Task cache   |
                                       +--------------+

+------------------------------------------------------------------+
|                     Observability Stack                          |
|   Prometheus :9090   <--  scrapes /metrics on api-gateway        |
|   Grafana    :3000   <--  dashboards from provisioning/          |
+------------------------------------------------------------------+
```

### Component Descriptions

| Component | Directory | Description |
|---|---|---|
| **api-gateway** | `backend/api-gateway/` | Central FastAPI service. Handles auth (JWT + Google OAuth), user/org management, API key validation, custom chatbot CRUD, task queuing via Redis, and proxies requests to AI backends. Exposes a Prometheus `/metrics` endpoint. |
| **asr-be** | `backend/ASR/` | Automatic Speech Recognition service using Hugging Face Whisper models fine-tuned for Sinhala. |
| **tts-be** | `backend/TTS/` | Text-to-Speech service using a custom Sinhala TTS model (Coqui TTS-based). Outputs audio files stored in `backend/TTS/output/`. |
| **chatbot-be** | `backend/chatbot/` | Base Sinhala chatbot backed by Groq API (LLM inference). |
| **chatbot-mod** | `backend/chatbot-modified/` | Enhanced chatbot with Redis-backed conversation state and RAG over the Sri Lanka Constitution (Sinhala). |
| **framework-be** | `backend/framework/` | Document management and RAG framework. Handles file uploads shared with `chatbot-mod`. |
| **voicebot-frontend** | `frontend/voicebot/` | Vanilla HTML/JS/CSS voice-chatbot UI served via nginx. |
| **new-chat-app** | `frontend/new-chat-app/` | React + TypeScript + Vite full-featured web application. |
| **mobile-app** | `mobile-app/subasa-app/` | Expo (React Native) mobile application. |
| **Redis** | *(image)* | In-memory store for task queuing and chatbot session state. |
| **Prometheus** | *(image)* | Metrics collection, scraping `api-gateway /metrics`. |
| **Grafana** | *(image)* | Dashboards provisioned from `grafana/provisioning/`. |

---

## Service & Port Reference

> All ports are host-side mappings from `docker-compose.yml`.

| Service | Container | Host Port | Container Port | Technology |
|---|---|---|---|---|
| api-gateway | `api-gateway` | **7010** | 7010 | FastAPI (Python) |
| asr-be | `asr-be` | **7000** | 6000 | Flask (Python) |
| tts-be | `tts-be` | **7002** | 6002 | Flask (Python) |
| chatbot-be | `chatbot-be` | **7001** | 6001 | Python |
| chatbot-mod | `chatbot-mod` | **7006** | 7006 | FastAPI (Python) |
| framework-be | `framework-be` | **7003** | 6003 | FastAPI (Python) |
| voicebot-frontend | `voicebot-frontend` | **7005** | 7005 | nginx |
| new-chat-app | `new-chat-app` | **7007** | 7007 | Vite / React |
| Redis | `redis` | **6379** | 6379 | Redis 7 |
| Prometheus | `prometheus` | **9090** | 9090 | prom/prometheus |
| Grafana | `grafana` | **3000** | 3000 | grafana/grafana-oss |

---

## Environment Variables

Copy and populate each `.env.example` before running the stack.

### Root `.env` (used by `docker-compose.yml`)

```dotenv
# ASR service - HuggingFace token for gated Whisper models
ASR_HF_TOKEN=your_huggingface_token_here

# api-gateway database (MySQL via asyncmy)
DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/dbname

# api-gateway JWT config
JWT_SECRET=your_jwt_secret_here

# Publicly reachable base URL for file downloads
PUBLIC_BASE_URL=https://your-domain.example.com

# Grafana admin password
GRAFANA_ADMIN_PASSWORD=changeme
```

### Per-service `.env.example` files

| Service | File | Key Variables |
|---|---|---|
| api-gateway | `backend/api-gateway/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `TTS_SERVICE_URL`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` |
| ASR | `backend/ASR/.env.example` | `HF_TOKEN` |
| TTS | `backend/TTS/.env.example` | `HF_TOKEN` |
| chatbot | `backend/chatbot/.env.example` | `GROQ_API_KEY` |
| chatbot-mod | `backend/chatbot-modified/.env.example` | `GROQ_API_KEY` |
| framework | `backend/framework/.env.example` | `GROQ_API_KEY` |
| new-chat-app | `frontend/new-chat-app/.env.example` | `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` |

---

## Local Development Setup

### Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) >= 24 (with Compose v2)
- A HuggingFace account with access to the Whisper model (`ASR_HF_TOKEN`)
- A Groq API key (`GROQ_API_KEY`)
- A MySQL 8 database (or update `DATABASE_URL` to point to one)
- Node.js >= 20 & npm (for frontend dev only)

### 1. Clone & configure

```bash
git clone <repo-url> subasa-monorepo
cd subasa-monorepo

# Copy and fill in the root env file
cp .env.example .env          # create this from the table above
# Also copy per-service env files if you need to customise them:
cp backend/api-gateway/.env.example  backend/api-gateway/.env
cp backend/ASR/.env.example          backend/ASR/.env
# ... etc.
```

### 2. Start the full stack

```bash
docker compose up --build
```

This builds and starts all services. On first run, HuggingFace model weights are
downloaded to `~/.cache/huggingface` (shared via a bind mount -- subsequent starts are fast).

To start only selected services:

```bash
# Just the AI backends + gateway
docker compose up api-gateway asr-be tts-be chatbot-mod framework-be redis
```

### 3. Run database migrations

The `api-gateway` runs Alembic migrations automatically on startup via `Base.metadata.create_all`.
For explicit schema migrations:

```bash
docker compose exec api-gateway alembic upgrade head
```

### 4. Verify health

```bash
curl http://localhost:7010/health   # api-gateway -> {"status":"ok"}
curl http://localhost:7000/         # asr-be
curl http://localhost:7002/         # tts-be
```

---

## Frontend Dev Servers

### new-chat-app (React + Vite)

```bash
cd frontend/new-chat-app
cp .env.example .env.local        # fill VITE_API_BASE_URL etc.
npm install
npm run dev                       # -> http://localhost:5173
```

### voicebot (Vanilla HTML)

Open `frontend/voicebot/index.html` directly in a browser, or serve it:

```bash
cd frontend/voicebot
npx serve .                       # any static server works
```

---

## Mobile App

The mobile app is an **Expo (React Native)** project located in `mobile-app/subasa-app/`.

### Prerequisites

- Node.js >= 20
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

### Run

```bash
cd mobile-app/subasa-app
npm install
npx expo start
```

Follow the terminal prompts to open in:
- **Expo Go** (device) -- scan the QR code
- **Android emulator** -- press `a`
- **iOS simulator** -- press `i` (macOS only)

---

## Observability

| Tool | URL | Notes |
|---|---|---|
| Prometheus | http://localhost:9090 | Scrapes `api-gateway:7010/metrics` |
| Grafana | http://localhost:3000 | Default user: `admin` / `$GRAFANA_ADMIN_PASSWORD` |

Dashboard provisioning files live in `grafana/provisioning/`. The `backend-services`
dashboard is pre-loaded automatically.

---

## Roadmap

Track progress and upcoming milestones via the GitHub issue tracker:

- **[Open Milestones](../../milestones)** -- view planned milestones and their associated issues
- **[Bug Reports](../../issues?q=is%3Aissue+is%3Aopen+label%3Abug)**
- **[Feature Requests](../../issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)**

> Replace the relative links above with the full GitHub URL once the repository is hosted
> (e.g. `https://github.com/your-org/subasa-monorepo/milestones`).

---

## Repository Layout

```
subasa-monorepo/
+-- backend/
|   +-- api-gateway/        # FastAPI gateway, auth, DB, task queue
|   +-- ASR/                # Speech recognition service
|   +-- TTS/                # Text-to-speech service
|   +-- chatbot/            # Base chatbot (Groq)
|   +-- chatbot-modified/   # Enhanced chatbot (Groq + Redis RAG)
|   +-- framework/          # Document upload & RAG framework
+-- frontend/
|   +-- new-chat-app/       # React + TypeScript + Vite web app
|   +-- voicebot/           # Vanilla HTML/JS voice UI
+-- mobile-app/
|   +-- subasa-app/         # Expo (React Native) mobile app
+-- grafana/
|   +-- provisioning/       # Grafana dashboard & datasource configs
+-- prometheus.yml           # Prometheus scrape config
+-- docker-compose.yml       # Full stack orchestration
```

---

*Built with love for Sinhala speakers.*
