import logging
import os
import uuid
from collections import OrderedDict
from threading import Lock
from typing import Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.vectorstores import FAISS
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

from shared import rag

load_dotenv()

logger = logging.getLogger("framework")

app = FastAPI()

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# CORS origins come from the environment so a deployment cannot fall back to a
# wildcard. Comma-separated; '*' is rejected outright.
_DEFAULT_DEV_ORIGINS = "http://localhost:7007,http://localhost:5173"


def _cors_origins():
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

UPLOAD_FOLDER = os.environ.get("UPLOAD_DIR", "uploaded_files")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {".txt", ".pdf"}
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 20 * 1024 * 1024))

# Each entry holds a FAISS index and its chain, so an unbounded dict was a slow
# memory leak: every upload added one and nothing ever removed it. Bounded LRU,
# oldest evicted first.
MAX_CACHED_DOCUMENTS = int(os.environ.get("MAX_CACHED_DOCUMENTS", 8))
_chains = OrderedDict()
_chains_lock = Lock()


def _cache_chain(key, chain):
    with _chains_lock:
        _chains[key] = chain
        _chains.move_to_end(key)
        while len(_chains) > MAX_CACHED_DOCUMENTS:
            evicted, _ = _chains.popitem(last=False)
            logger.info("Evicted cached document %s", evicted)


def _get_chain(key):
    with _chains_lock:
        if key not in _chains:
            return None
        _chains.move_to_end(key)
        return _chains[key]


def _latest_key():
    with _chains_lock:
        return next(reversed(_chains)) if _chains else None


def _safe_filename(filename: str) -> Tuple[str, str]:
    """Never trust the client's name: keep only the extension."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="සහාය නොදක්වන ගොනු වර්ගයකි")
    return f"{uuid.uuid4().hex}{ext}", ext


class ChatRequest(BaseModel):
    message: str
    document_key: Optional[str] = None


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Store an uploaded document and build its retrieval chain."""
    stored_name, ext = _safe_filename(file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, stored_name)

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="ගොනුව ඉතා විශාලය")

    try:
        with open(file_path, "wb") as f:
            f.write(content)

        loader = TextLoader(file_path, encoding="utf-8") if ext == ".txt" else PyPDFLoader(file_path)
        documents = rag.split_documents(loader.load())
        db = FAISS.from_documents(documents, rag.build_embeddings())
        _cache_chain(stored_name, rag.build_retrieval_chain(db.as_retriever()))
    except HTTPException:
        raise
    except Exception:
        # Never echo the exception back to the client, and never dump a stack
        # trace to stdout — log it against the stored name instead.
        logger.exception("Failed to process upload %s", stored_name)
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail="ගොනුව සැකසීමේ දෝෂයකි")

    return JSONResponse(
        content={
            "success": True,
            "message": "ගොනුව උඩුගත කර සාර්ථකව සකසන ලදී.",
            "document_key": stored_name,
        }
    )


@app.post("/chat")
async def chat(request: ChatRequest, response: Response):
    if not request.message:
        raise HTTPException(status_code=400, detail="පණිවිඩයක් සපයා නැත")

    # Callers that predate document_key get the most recently uploaded
    # document, which is what the old "latest file wins" behaviour did.
    key = request.document_key or _latest_key()
    if not key:
        raise HTTPException(
            status_code=400, detail="තවමත් කිසිදු ලේඛනයක් උඩුගත කර සකසා නොමැත."
        )

    chain = _get_chain(key)
    if chain is None:
        raise HTTPException(
            status_code=404, detail="ලේඛනය තවදුරටත් නොපවතී. නැවත උඩුගත කරන්න."
        )

    try:
        answer, tokens_used = rag.answer_with_usage(chain, request.message)
        # The gateway reads this header to meter the caller's usage.
        response.headers["X-Tokens-Used"] = str(tokens_used)
        return {"response": answer}
    except Exception:
        logger.exception("Query failed for document %s", key)
        raise HTTPException(status_code=500, detail="ඉල්ලීම සැකසීමේ දෝෂයකි")


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=6003)
