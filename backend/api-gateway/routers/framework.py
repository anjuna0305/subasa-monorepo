from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import FRAMEWORK_SERVICE_URL
from routers._http import get_http_client

router = APIRouter(prefix="/framework", tags=["framework"])

# First-party document-chat proxy, same arrangement as /tts and /asr: the web
# app calls these with a session, third parties go through the metered
# /api/{service_key} proxy with an API key.


def _upstream(path: str) -> str:
    return f"{FRAMEWORK_SERVICE_URL.rstrip('/')}/{path.lstrip('/')}"


class FrameworkChatRequest(BaseModel):
    message: str
    document_key: str | None = None


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    client = get_http_client()
    content = await file.read()
    upstream = await client.post(
        _upstream("/upload"),
        files={
            "file": (
                file.filename or "document.txt",
                content,
                file.content_type or "application/octet-stream",
            )
        },
    )
    if upstream.status_code != 200:
        raise HTTPException(
            status_code=upstream.status_code,
            detail=upstream.json().get("detail", "Document service error")
            if upstream.headers.get("content-type", "").startswith("application/json")
            else "Document service error",
        )
    return JSONResponse(content=upstream.json())


@router.post("/chat")
async def chat(payload: FrameworkChatRequest):
    client = get_http_client()
    upstream = await client.post(_upstream("/chat"), json=payload.model_dump())
    if upstream.status_code != 200:
        raise HTTPException(
            status_code=upstream.status_code, detail="Document service error"
        )
    return JSONResponse(content=upstream.json())
