import os

from transformers import AutoModelForCTC, Wav2Vec2Processor
from huggingface_hub import login

login(token=os.getenv("HF_TOKEN"))

model_wav = AutoModelForCTC.from_pretrained("L-Inuri/wav2vec")
processor_wav = Wav2Vec2Processor.from_pretrained("L-Inuri/wav2vec")