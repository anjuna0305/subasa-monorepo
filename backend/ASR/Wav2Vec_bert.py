import os

from transformers import AutoModelForCTC, Wav2Vec2BertProcessor
from huggingface_hub import login

login(token=os.getenv("HF_TOKEN"))

model_bert = AutoModelForCTC.from_pretrained("L-Inuri/Wav2Vec-BERT")
processor_bert = Wav2Vec2BertProcessor.from_pretrained("L-Inuri/Wav2Vec-BERT")