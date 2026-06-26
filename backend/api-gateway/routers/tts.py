from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse

from config import TTS_SERVICE_URL
from schemas import TtsGenerateRequest, TtsGenerateResponse
import uuid
import os
import aiofiles
from config import TTS_FILE_DIR

router = APIRouter(prefix="/tts", tags=["tts"])


@router.post("/generate", response_model=TtsGenerateResponse)
async def generate_tts_audio(payload: TtsGenerateRequest, request: Request):
    from routers._http import get_http_client

    client = get_http_client()
    tts_url = f"{TTS_SERVICE_URL.rstrip('/')}/generate"

    req = client.build_request("POST", tts_url, json=payload.model_dump())
    upstream_resp = await client.send(req, stream=True)

    if upstream_resp.status_code != 200:
        await upstream_resp.aclose()
        raise HTTPException(
            status_code=upstream_resp.status_code,
            detail="TTS service error",
        )
    file_name = f"{uuid.uuid4()}.wav"

    os.makedirs(TTS_FILE_DIR, exist_ok=True)
    file_path = os.path.join(TTS_FILE_DIR, file_name)

    async with aiofiles.open(file_path, "wb") as f:
        async for chunk in upstream_resp.aiter_bytes():
            await f.write(chunk)

    data = upstream_resp.json()
    original_audio_url = data.get("audioUrl", "")

    host = request.headers.get("host", "localhost:8000")
    scheme = request.url.scheme
    proxy_audio_url = f"{scheme}://{host}/tts/audio/{file_name}"

    return TtsGenerateResponse(audioUrl=proxy_audio_url)


@router.get("/output/{file_name}")
def serve_output(file_name: str):
    file_path = os.path.join(TTS_FILE_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
