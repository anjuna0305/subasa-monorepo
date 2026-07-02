from io import BytesIO

import librosa
import numpy as np
import soundfile as sf
import torch
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from postprocessing.post_processing import process_sentence
from Wav2Vec_bert import model_bert, processor_bert
from Wav2Vec_model import model_wav, processor_wav
from Whisper_model import model_whisper, processor_whisper

app = FastAPI()

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def transcribe_audio_wav(audio):
    input_values = processor_wav(
        audio, sampling_rate=16000, return_tensors="pt"
    ).input_values
    with torch.no_grad():
        logits = model_wav(input_values).logits
    pred_ids = torch.argmax(logits, dim=-1)
    return processor_wav.batch_decode(pred_ids)[0]


def transcribe_audio_bert(audio):
    input_values = processor_bert(
        audio, sampling_rate=16000, return_tensors="pt"
    ).input_features
    with torch.no_grad():
        logits = model_bert(input_values).logits
    pred_ids = torch.argmax(logits, dim=-1)
    return processor_bert.batch_decode(pred_ids)[0]


def transcribe_audio_whisper(audio, sample_rate=16000):
    input_features = processor_whisper(
        audio, sampling_rate=sample_rate, return_tensors="pt"
    ).input_features
    with torch.no_grad():
        logits = model_whisper.generate(input_features)
    return processor_whisper.batch_decode(logits, skip_special_tokens=True)[0].strip()


def process_audio_file(file: UploadFile):
    audio_data, samplerate = sf.read(BytesIO(file.file.read()))
    if samplerate != 16000:
        audio_data = librosa.resample(audio_data, orig_sr=samplerate, target_sr=16000)
    if len(audio_data.shape) > 1:
        audio_data = np.mean(audio_data, axis=1)
    return audio_data


@app.post("/transcribe")
async def process_audio_bert(file: UploadFile = File(...)):
    try:
        audio_data = process_audio_file(file)
        transcription = transcribe_audio_bert(audio_data)
        processed_text = process_sentence(transcription)
        return JSONResponse(content={"transcription": processed_text})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/wav")
async def process_audio_wav(file: UploadFile = File(...)):
    try:
        audio_data = process_audio_file(file)
        transcription = transcribe_audio_wav(audio_data)
        return JSONResponse(content={"transcription": transcription})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/whisper")
async def process_audio_whisper(file: UploadFile = File(...)):
    try:
        audio_data = process_audio_file(file)
        transcription = transcribe_audio_whisper(audio_data)
        return JSONResponse(content={"transcription": transcription})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"status": "server running"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    print("asr is executing")
    uvicorn.run(app, host="0.0.0.0", port=6000)
