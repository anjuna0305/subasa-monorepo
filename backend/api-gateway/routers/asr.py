from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from config import ASR_SERVICE_URL
from routers._http import get_http_client

router = APIRouter(prefix="/asr", tags=["asr"])

# Same first-party arrangement as /tts: the web app calls these directly with a
# session, while third parties go through the metered /api/{service_key} proxy
# with an API key.


def _upstream(path: str) -> str:
    return f"{ASR_SERVICE_URL.rstrip('/')}/{path.lstrip('/')}"


async def _forward_file(file: UploadFile):
    content = await file.read()
    return {"file": (file.filename or "audio.wav", content, file.content_type or "audio/wav")}


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    client = get_http_client()
    upstream = await client.post(_upstream("/transcribe"), files=await _forward_file(file))
    if upstream.status_code != 200:
        raise HTTPException(status_code=upstream.status_code, detail="ASR service error")
    return JSONResponse(content=upstream.json())


@router.post("/transcribe/stream")
async def transcribe_stream(file: UploadFile = File(...)):
    """Relay the ASR service's token-by-token SSE stream to the browser."""
    client = get_http_client()
    request = client.build_request(
        "POST", _upstream("/transcribe/whisper/stream"), files=await _forward_file(file)
    )
    upstream = await client.send(request, stream=True)

    if upstream.status_code != 200:
        await upstream.aclose()
        raise HTTPException(status_code=upstream.status_code, detail="ASR service error")

    async def relay():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(
        relay(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/health")
async def health():
    client = get_http_client()
    try:
        upstream = await client.get(_upstream("/health"), timeout=5.0)
        return {"status": "ok" if upstream.status_code == 200 else "degraded"}
    except Exception:
        return {"status": "unreachable"}
