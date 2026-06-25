from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel
from huggingface_hub import hf_hub_download, login
from TTS.api import TTS
import os
from text.cleaners import sinhala_cleaners
import uvicorn
import io
import soundfile as sf

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

login(token=os.getenv("HF_TOKEN"))

# Load TTS models
models = {
    "single_male_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/VITS_Metta_SInhala", "config.json"),
        model_path=hf_hub_download("Sasangi/VITS_Metta_SInhala", "checkpoint_324600.pth")
    ),
    "single_female_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Oshadi_Sinhala", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Oshadi_Sinhala", "checkpoint_38400.pth")
    ),
    "multi_male_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "checkpoint_323400.pth"),
    ),
    "multi_female_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "checkpoint_323400.pth")
    ),
    "single_male_romanized": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Metta_Roman", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Metta_Roman", "checkpoint_87600.pth")
    ),
    "single_female_romanized": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Oshadi_Roman", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Oshadi_Roman", "checkpoint_38400.pth")
    )
}

# Output directory
output_path = "output/output.wav"
os.makedirs("output", exist_ok=True)

class AudioRequest(BaseModel):
    text: str
    speaker: str = "oshadi"
    speaker_type: str = "multi"
    voice: str = "female"
    input_type: str = "sinhala"

# Preprocess text
def preprocess_text(input_text: str):
    try:
        return sinhala_cleaners(input_text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Text preprocessing failed: {e}")

# Serve audio files
@app.get("/output/{filename}")
def serve_output(filename: str):
    file_path = os.path.join("output", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# Generate audio
@app.post("/voicebot-generate-audio")
def generate_audio(request_data: AudioRequest):
    try:
        text = request_data.text.strip()
        speaker = request_data.speaker.lower()
        speaker_type = request_data.speaker_type.lower()
        voice = request_data.voice.lower()
        input_type = request_data.input_type.lower()

        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        if speaker_type not in ["single", "multi"] or voice not in ["male", "female"]:
            raise HTTPException(status_code=400, detail="Invalid speaker type or voice")

        preprocessed_text = preprocess_text(text)
        model_key = f"{speaker_type}_{voice}_{input_type}"
        model = models.get(model_key)

        if not model:
            raise HTTPException(status_code=404, detail=f"No model found for key: {model_key}")

        if speaker_type == "single":
            model.tts_to_file(text=preprocessed_text, file_path=output_path)
        else:
            model.tts_to_file(text=preprocessed_text, speaker=speaker, file_path=output_path)

        return JSONResponse(content={"audioUrl": f"/output/{os.path.basename(output_path)}"})
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Internal Server Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# generate audio and return audio
@app.post("/generate")
def generate_audio(request_data: AudioRequest):
    try:
        text = request_data.text.strip()
        speaker = request_data.speaker.lower()
        speaker_type = request_data.speaker_type.lower()
        voice = request_data.voice.lower()
        input_type = request_data.input_type.lower()

        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        if speaker_type not in ["single", "multi"] or voice not in ["male", "female"]:
            raise HTTPException(status_code=400, detail="Invalid speaker type or voice")

        preprocessed_text = preprocess_text(text)
        model_key = f"{speaker_type}_{voice}_{input_type}"
        model = models.get(model_key)

        if not model:
            raise HTTPException(status_code=404, detail=f"No model found for key: {model_key}")

        result = (
            model.tts(text=preprocessed_text)
            if speaker_type == "single"
            else model.tts(text=preprocessed_text, speaker=speaker)
        )

        buffer = io.BytesIO()
        sf.write(buffer, result, samplerate=22050, format="WAV")
        buffer.seek(0)

        return StreamingResponse(buffer, media_type="audio/wav")

        # return JSONResponse(content={"audioUrl": result})

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Internal Server Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/")
def index():
    return {"message": "Welcome to the FastAPI TTS Service"}


@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=6002)
