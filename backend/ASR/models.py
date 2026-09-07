"""Loaders for the three Sinhala ASR checkpoints.

All three share the same shape — authenticate, pull a model + processor from
the Hub, run the audio through and decode — so they are described as data here
rather than as three near-identical modules.
"""

import os

import torch
from huggingface_hub import login
from transformers import (
    AutoModelForCTC,
    Wav2Vec2BertProcessor,
    Wav2Vec2Processor,
    WhisperForConditionalGeneration,
    WhisperProcessor,
)

login(token=os.getenv("HF_TOKEN"))

SAMPLE_RATE = 16000


class AsrModel:
    """A CTC model (wav2vec2 family): one forward pass, argmax, decode."""

    # Wav2Vec2Processor returns input_values; the BERT variant returns
    # input_features, so the attribute to read is per-model.
    feature_attr = "input_values"

    def __init__(self, repo_id, model_cls, processor_cls):
        self.model = model_cls.from_pretrained(repo_id)
        self.processor = processor_cls.from_pretrained(repo_id)

    def features(self, audio, sample_rate=SAMPLE_RATE):
        encoded = self.processor(
            audio, sampling_rate=sample_rate, return_tensors="pt"
        )
        return getattr(encoded, self.feature_attr)

    def transcribe(self, audio, sample_rate=SAMPLE_RATE):
        with torch.no_grad():
            logits = self.model(self.features(audio, sample_rate)).logits
        pred_ids = torch.argmax(logits, dim=-1)
        return self.processor.batch_decode(pred_ids)[0]


class WhisperAsrModel(AsrModel):
    """Whisper is seq2seq: it generates token ids instead of framewise logits."""

    feature_attr = "input_features"

    def transcribe(self, audio, sample_rate=SAMPLE_RATE):
        with torch.no_grad():
            token_ids = self.model.generate(self.features(audio, sample_rate))
        return self.processor.batch_decode(token_ids, skip_special_tokens=True)[
            0
        ].strip()

    def generate(self, features, streamer=None):
        with torch.no_grad():
            return self.model.generate(features, streamer=streamer)


class BertAsrModel(AsrModel):
    feature_attr = "input_features"


wav = AsrModel("L-Inuri/wav2vec", AutoModelForCTC, Wav2Vec2Processor)
bert = BertAsrModel("L-Inuri/Wav2Vec-BERT", AutoModelForCTC, Wav2Vec2BertProcessor)
whisper = WhisperAsrModel(
    "L-Inuri/whisper-sinhala-asr-test",
    WhisperForConditionalGeneration,
    WhisperProcessor,
)
