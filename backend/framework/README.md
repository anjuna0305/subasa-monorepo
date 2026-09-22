# framework-be

Upload a document, then chat about it. The "make your own chatbot" path.

- **Stack**: Python 3.9 · FastAPI · LangChain 0.3 · FAISS · Groq
- **Port**: 7003 on the host → 6003 in the container

## How it differs from chatbot-mod

Both do the same RAG. The difference is where the document comes from and where
the index lives:

| | `chatbot-mod` | `framework-be` |
|---|---|---|
| Document | referenced by path, uploaded elsewhere | uploaded to this service |
| Index cache | Redis, survives restart | in-process LRU, lost on restart |
| Formats | `.txt` | `.txt` and `.pdf` |
| Keyed by | `retrieval_key` from the caller | `document_key` returned by `/upload` |

Both build their chains from `backend/shared/rag.py`, so the prompt, splitter,
embeddings and model are identical. **This image builds from `./backend`** so it
can copy that module.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/upload` | multipart `file`; `.txt`/`.pdf` → `{success, message, document_key}` |
| POST | `/chat` | `{message, document_key?}` → `{response}` |
| GET | `/health` | liveness |
| GET | `/metrics` | Prometheus |

`document_key` is optional on `/chat`: omitting it falls back to the most
recently uploaded document, which is what the older clients expect.

Uploads are stored under a generated name — only the extension comes from the
client — with a size cap (`MAX_UPLOAD_BYTES`, 20 MB) and cleanup of the partial
file when processing fails.

Sets `X-Tokens-Used` from the LLM's reported usage.

## The index cache

`_chains` is an `OrderedDict` behind a lock, holding at most
`MAX_CACHED_DOCUMENTS` (default 8) entries, evicting oldest-first. Each entry is
a full FAISS index, so the bound matters. A `document_key` whose entry has been
evicted returns 404 asking the client to re-upload — it is not persisted
anywhere.

## Configuration

```
GROQ_API_KEY          # required
UPLOAD_DIR=uploaded_files
MAX_UPLOAD_BYTES=20971520
MAX_CACHED_DOCUMENTS=8
CORS_ALLOW_ORIGINS    # comma-separated; "*" is rejected at startup
```

## Running it

```bash
pip install -r requirements-base.txt -r requirements-app.txt
python chatbot.py            # serves on 6003
```

## Known issues

- Runs on **Python 3.9** while every other service is 3.10+, so no PEP 604
  unions (`str | None`) in this codebase — use `typing.Optional`. The shared
  module is written to stay compatible with both.
- Indexes are per-process, so this cannot be scaled past one replica without
  moving the cache to Redis the way chatbot-mod does.
- Uploaded files accumulate on disk; nothing prunes them when an index is
  evicted.
