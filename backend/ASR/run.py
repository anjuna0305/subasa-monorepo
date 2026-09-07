import json
import math
import os
from io import BytesIO
from threading import Thread

import librosa
import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from prometheus_fastapi_instrumentator import Instrumentator
from transformers import TextIteratorStreamer

from models import SAMPLE_RATE, bert, wav, whisper
from postprocessing.post_processing import process_sentence

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


# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_whisper(input_features, streamer, errors):
    try:
        whisper.generate(input_features, streamer=streamer)
    except Exception as e:
        errors.append(e)
        # generate() ends the streamer itself on success; on failure the
        # consumer would block forever without this.
        streamer.end()


def process_audio_file(file: UploadFile):
    audio_data, samplerate = sf.read(BytesIO(file.file.read()))
    if samplerate != SAMPLE_RATE:
        audio_data = librosa.resample(
            audio_data, orig_sr=samplerate, target_sr=SAMPLE_RATE
        )
    if len(audio_data.shape) > 1:
        audio_data = np.mean(audio_data, axis=1)
    return audio_data


def _billed_seconds(audio) -> int:
    """Audio duration, rounded up — the unit ASR usage is metered in."""
    return max(1, math.ceil(len(audio) / SAMPLE_RATE))


def _transcribe(model, file: UploadFile, response: Response):
    try:
        audio = process_audio_file(file)
        transcription = model.transcribe(audio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    # The gateway reads this header to meter the caller's usage.
    response.headers["X-Tokens-Used"] = str(_billed_seconds(audio))
    return transcription


@app.post("/transcribe")
async def process_audio_bert(response: Response, file: UploadFile = File(...)):
    transcription = _transcribe(bert, file, response)
    return JSONResponse(
        content={"transcription": process_sentence(transcription)},
        headers=dict(response.headers),
    )


@app.post("/transcribe/wav")
async def process_audio_wav(response: Response, file: UploadFile = File(...)):
    transcription = _transcribe(wav, file, response)
    return JSONResponse(
        content={"transcription": transcription}, headers=dict(response.headers)
    )


@app.post("/transcribe/whisper")
async def process_audio_whisper(response: Response, file: UploadFile = File(...)):
    transcription = _transcribe(whisper, file, response)
    return JSONResponse(
        content={"transcription": transcription}, headers=dict(response.headers)
    )


@app.post("/transcribe/whisper/stream")
async def stream_audio_whisper(file: UploadFile = File(...)):
    # Decoding failures here happen before any bytes are sent, so they can
    # still surface as a normal error response rather than a stream event.
    try:
        audio = process_audio_file(file)
        input_features = whisper.features(audio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    streamer = TextIteratorStreamer(whisper.processor.tokenizer, skip_special_tokens=True)
    errors = []
    thread = Thread(
        target=generate_whisper,
        args=(input_features, streamer, errors),
        daemon=True,
    )
    thread.start()

    def event_stream():
        transcription = ""
        for token in streamer:
            # The streamer fires once per generated token but only yields text
            # at word boundaries, so most steps produce an empty string.
            if not token:
                continue
            transcription += token
            yield f"data: {json.dumps({'delta': token}, ensure_ascii=False)}\n\n"
        thread.join()
        if errors:
            payload = {"error": str(errors[0])}
        else:
            payload = {"transcription": transcription.strip(), "done": True}
        yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "X-Tokens-Used": str(_billed_seconds(audio)),
            "Cache-Control": "no-cache",
            # nginx buffers proxied responses by default, which would hold the
            # whole stream back until generation finishes.
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/")
async def root():
    return {"status": "server running"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    print("asr is executing")
    uvicorn.run(app, host="0.0.0.0", port=6000)
