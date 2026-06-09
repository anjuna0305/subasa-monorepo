import os

from transformers import WhisperForConditionalGeneration, WhisperProcessor
from huggingface_hub import login

login(token=os.getenv("HF_TOKEN"))

model_whisper = WhisperForConditionalGeneration.from_pretrained("L-Inuri/whisper-sinhala-asr-test")
processor_whisper = WhisperProcessor.from_pretrained("L-Inuri/whisper-sinhala-asr-test")