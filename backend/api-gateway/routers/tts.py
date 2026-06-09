from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from config import TTS_SERVICE_URL
from schemas import TtsGenerateRequest, TtsGenerateResponse

router = APIRouter(prefix="/tts", tags=["tts"])


@router.post("/generate", response_model=TtsGenerateResponse)
async def generate_tts_audio(payload: TtsGenerateRequest, request: Request):
    from routers._http import get_http_client

    client = get_http_client()

    tts_url = f"{TTS_SERVICE_URL.rstrip('/')}/voicebot-generate-audio"

    upstream_resp = await client.post(tts_url, json=payload.model_dump())

    if upstream_resp.status_code != 200:
        raise HTTPException(
            status_code=upstream_resp.status_code,
            detail="TTS service error",
        )

    data = upstream_resp.json()
    original_audio_url = data.get("audioUrl", "")

    host = request.headers.get("host", "localhost:8000")
    scheme = request.url.scheme
    proxy_audio_url = f"{scheme}://{host}/tts/audio/{original_audio_url}"

    return TtsGenerateResponse(audioUrl=proxy_audio_url)


@router.get("/audio/{filename:path}")
async def proxy_tts_audio(filename: str):
    from routers._http import get_http_client

    client = get_http_client()

    audio_url = f"{TTS_SERVICE_URL.rstrip('/')}/{filename}"

    upstream_resp = await client.get(audio_url)

    if upstream_resp.status_code != 200:
        raise HTTPException(
            status_code=upstream_resp.status_code,
            detail="Audio file not found",
        )

    content_type = upstream_resp.headers.get("content-type", "audio/wav")

    return StreamingResponse(
        content=iter([upstream_resp.content]),
        status_code=200,
        media_type=content_type,
    )
