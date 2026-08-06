from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse

from config import TTS_SERVICE_URL
from schemas import TtsGenerateRequest, TtsGenerateResponse, TtsStreamResponse
import uuid
import os
import aiofiles
from config import TTS_FILE_DIR, PUBLIC_BASE_URL

router = APIRouter(prefix="/tts", tags=["tts"])


def _public_base_url(request: Request) -> str:
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL.rstrip("/")
    host = request.headers.get("host", "localhost:7010")
    return f"{request.url.scheme}://{host}"


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

    proxy_audio_url = f"{_public_base_url(request)}/tts/output/{file_name}"

    return TtsGenerateResponse(audioUrl=proxy_audio_url)


@router.post("/prepare", response_model=TtsStreamResponse)
async def prepare_tts_stream(payload: TtsGenerateRequest, request: Request):
    """
    Registers the text with the TTS service and hands back a URL that streams the audio
    as it is synthesized, sentence by sentence. `/generate` waits for the whole reply to
    finish before anything can play; this returns a URL the client can start playing
    almost immediately.
    """
    from routers._http import get_http_client

    client = get_http_client()
    prepare_url = f"{TTS_SERVICE_URL.rstrip('/')}/generate/prepare"

    upstream_resp = await client.post(prepare_url, json=payload.model_dump())
    if upstream_resp.status_code != 200:
        raise HTTPException(
            status_code=upstream_resp.status_code,
            detail="TTS service error",
        )

    stream_id = upstream_resp.json().get("id")
    if not stream_id:
        raise HTTPException(status_code=502, detail="TTS service returned no stream id")

    # The .wav suffix is what lets mobile audio players pick a decoder before any bytes
    # arrive, since a streamed body carries no length to sniff.
    return TtsStreamResponse(
        streamUrl=f"{_public_base_url(request)}/tts/stream/{stream_id}.wav"
    )


@router.get("/stream/{stream_id}.wav")
async def stream_tts_audio(stream_id: str):
    from routers._http import get_http_client

    client = get_http_client()
    stream_url = f"{TTS_SERVICE_URL.rstrip('/')}/generate/stream/{stream_id}"

    req = client.build_request("GET", stream_url)
    upstream_resp = await client.send(req, stream=True)

    if upstream_resp.status_code != 200:
        await upstream_resp.aclose()
        raise HTTPException(
            status_code=upstream_resp.status_code,
            detail="TTS service error",
        )

    async def body():
        try:
            async for chunk in upstream_resp.aiter_bytes():
                yield chunk
        finally:
            await upstream_resp.aclose()

    return StreamingResponse(
        body(),
        media_type="audio/wav",
        headers={
            "Cache-Control": "no-cache",
            # nginx would otherwise buffer the whole response and undo the streaming.
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/output/{file_name}")
def serve_output(file_name: str):
    file_path = os.path.join(TTS_FILE_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
