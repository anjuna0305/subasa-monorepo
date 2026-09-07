import os
import uuid
from typing import Optional

import redis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import FAISS
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

from shared import rag

load_dotenv()

redis_host = os.getenv("REDIS_HOST", "redis")
redis_port = int(os.getenv("REDIS_PORT", 6379))
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/usr/src/app/uploaded_files")

redis_client = redis.Redis(host=redis_host, port=redis_port, db=0)

app = FastAPI()

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# CORS origins come from the environment so a deployment cannot fall back to a
# wildcard. Comma-separated; '*' is rejected outright.
_DEFAULT_DEV_ORIGINS = "http://localhost:7007,http://localhost:5173"


def _cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ALLOW_ORIGINS", _DEFAULT_DEV_ORIGINS)
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if "*" in origins:
        raise RuntimeError(
            "CORS_ALLOW_ORIGINS must list explicit origins; '*' is not accepted."
        )
    if not origins:
        raise RuntimeError("CORS_ALLOW_ORIGINS is empty; list at least one origin.")
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    retrieval_key: Optional[str] = None
    file_path: str


class ChatResponse(BaseModel):
    response: str
    retrieval_key: str


huggingface_embeddings = rag.build_embeddings()
llm = rag.build_llm()


def _resolve_upload_path(file_path: str) -> str:
    """Join a client-supplied name onto UPLOAD_DIR without letting it escape."""
    upload_root = os.path.realpath(UPLOAD_DIR)
    candidate = os.path.realpath(os.path.join(upload_root, file_path))
    if candidate != upload_root and not candidate.startswith(upload_root + os.sep):
        raise HTTPException(status_code=400, detail="Invalid file_path")
    if not os.path.isfile(candidate):
        raise HTTPException(status_code=404, detail="Knowledge file not found")
    return candidate


def _deserialize(payload: bytes) -> FAISS:
    """Rehydrate a cached index.

    The bytes come from our own Redis, never from a client, but newer
    langchain-community versions still demand an explicit opt-in that older
    ones do not accept as a keyword.
    """
    try:
        return FAISS.deserialize_from_bytes(
            payload,
            embeddings=huggingface_embeddings,
            allow_dangerous_deserialization=True,
        )
    except TypeError:
        return FAISS.deserialize_from_bytes(payload, embeddings=huggingface_embeddings)


def get_or_create_vectorstore(retrieval_key: Optional[str], file_path: str):
    if retrieval_key:
        cached = redis_client.get(retrieval_key)
        if cached:
            return _deserialize(cached), retrieval_key

    loader = TextLoader(file_path, encoding="utf-8")
    documents = rag.split_documents(loader.load())

    db = FAISS.from_documents(documents, huggingface_embeddings)

    new_key = str(uuid.uuid4())
    redis_client.set(new_key, db.serialize_to_bytes())

    return db, new_key


@app.post("/chat")
async def chat(chat_request: ChatRequest, response: Response) -> ChatResponse:
    if not chat_request.message:
        raise HTTPException(status_code=400, detail="No message provided")

    if not chat_request.file_path:
        raise HTTPException(status_code=400, detail="No file_path provided")

    full_path = _resolve_upload_path(chat_request.file_path)
    db, key = get_or_create_vectorstore(chat_request.retrieval_key, full_path)

    chain = rag.build_retrieval_chain(db.as_retriever(), llm=llm)
    answer, tokens_used = rag.answer_with_usage(chain, chat_request.message)

    # The gateway reads this header to meter the caller's usage.
    response.headers["X-Tokens-Used"] = str(tokens_used)
    return ChatResponse(response=answer, retrieval_key=key)


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7006)
