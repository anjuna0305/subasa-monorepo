# chatbot-mod

Retrieval-augmented chat over one uploaded document. This is the service behind
every **custom chatbot**.

- **Stack**: Python 3.10 · FastAPI · LangChain 0.1 · FAISS · Redis · Groq
- **Port**: 7006 (same inside and out)

## How it works

```
POST /chat {message, file_path, retrieval_key?}
        │
        ├─ retrieval_key given and cached in Redis?
        │     └─ yes → deserialize the FAISS index, reuse it
        │     └─ no  → load the file, split it, embed it, build an index,
        │              store it under a fresh uuid key
        │
        └─ RetrievalQA("stuff") ─ Groq llama-3.3-70b ─→ {response, retrieval_key}
```

The caller is expected to keep the returned `retrieval_key` and send it back, so
a document is embedded once rather than on every message. The gateway does this:
`CustomChatbot.retrieval_key` is persisted per chatbot.

Redis is the index cache — a serialized FAISS index per key, no TTL. It is the
only reason this service can answer a second question quickly.

## The RAG recipe lives elsewhere

Splitter settings, the embedding model, the Groq model and the Sinhala prompt
all come from `backend/shared/rag.py`, shared with `framework`. Do not fork them
here — the two services had already drifted apart once.

Because of that shared module, **this image builds from `./backend`, not from
this directory**: `docker-compose.yml` sets
`context: ./backend, dockerfile: chatbot-modified/Dockerfile`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/chat` | `{message, file_path, retrieval_key?}` → `{response, retrieval_key}` |
| GET | `/health` | liveness |
| GET | `/metrics` | Prometheus |

`file_path` is resolved against `UPLOAD_DIR` and rejected if it escapes —
it arrives from a database row that an upload endpoint wrote, but it is still
client-adjacent input.

Sets `X-Tokens-Used` from the LLM's reported prompt + completion tokens, falling
back to a character estimate when the provider reports nothing.

## Where the files come from

The gateway writes uploads to `<UPLOAD_DIR>/chatbot_files`, which compose mounts
into this container as `/usr/src/app/uploaded_files`:

```
gateway  /app/uploads/chatbot_files
  → host ./backend/framework/uploaded_files/chatbot_files
    → here /usr/src/app/uploaded_files
```

Only `.txt` is loadable — `/chat` uses `TextLoader`. PDFs uploaded through the
gateway's chatbot endpoint will fail here.

## Configuration

```
GROQ_API_KEY          # required at import; the service will not start without it
REDIS_HOST=redis
REDIS_PORT=6379
UPLOAD_DIR=/usr/src/app/uploaded_files
CORS_ALLOW_ORIGINS    # comma-separated; "*" is rejected at startup
```

`Sri Lanka Constitution-Sinhala.txt` sits in this directory as the seed corpus
for the government chatbot. It is excluded from the Docker build context.

## Running it

```bash
pip install -r requirements-base.txt -r requirements-app.txt
python chatbot_api.py        # serves on 7006, needs Redis
```

## Known issues

- The embedding model (`multilingual-e5-large-instruct`) loads at import on CPU;
  first startup is slow.
- Redis entries never expire, so index bytes accumulate for the life of the
  instance.
- LangChain here is pinned at 0.1.x while `framework` is on 0.3.x. The shared
  module has guarded imports to work on both; unpinning one without the other
  will break it.
