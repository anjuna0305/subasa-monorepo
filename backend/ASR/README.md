# asr-be

Sinhala automatic speech recognition. Three fine-tuned checkpoints behind one
FastAPI app.

- **Stack**: Python 3.10 · FastAPI · transformers · torch · librosa · soundfile
- **Port**: 7000 on the host → 6000 in the container
- **Models**: pulled from the Hugging Face Hub at import time

## Models

`models.py` holds all three. They share a shape — authenticate, pull a model and
processor, run audio through, decode — so they are described as data rather than
as three near-identical modules.

| Name | Repo | Class | Notes |
|---|---|---|---|
| `wav` | `L-Inuri/wav2vec` | `AsrModel` | wav2vec2 CTC |
| `bert` | `L-Inuri/Wav2Vec-BERT` | `BertAsrModel` | CTC, reads `input_features` |
| `whisper` | `L-Inuri/whisper-sinhala-asr-test` | `WhisperAsrModel` | seq2seq, supports streaming |

CTC models take one forward pass and an argmax. Whisper generates token ids, so
it overrides `transcribe()` and adds `generate()` for the streaming endpoint.

**All three load at import**, which is why startup is slow and why the service
cannot be imported in a unit test. Checkpoints are cached in
`~/.cache/huggingface`, mounted into the container by compose.

## Endpoints

| Method | Path | Model | Returns |
|---|---|---|---|
| POST | `/transcribe` | Wav2Vec-BERT | `{transcription}`, punctuated by `postprocessing/` |
| POST | `/transcribe/wav` | wav2vec2 | `{transcription}` |
| POST | `/transcribe/whisper` | Whisper | `{transcription}` |
| POST | `/transcribe/whisper/stream` | Whisper | SSE, token by token |
| GET | `/health` `/` | — | liveness |
| GET | `/metrics` | — | Prometheus |

All transcribe endpoints take `multipart/form-data` with a `file` field.

### Audio format

`process_audio_file()` decodes with **soundfile**, which reads WAV/FLAC/OGG but
**cannot read webm/opus**. Browser clients must therefore send a real WAV
container — the web app captures 16 kHz mono PCM from the VAD and wraps it
itself (`frontend/new-chat-app/src/utils/asrStream.ts`). Anything not at 16 kHz
is resampled with librosa, and multi-channel input is averaged to mono.

### Streaming

`/transcribe/whisper/stream` runs `model.generate()` on a background thread with
a `TextIteratorStreamer` and yields SSE frames:

```
data: {"delta": "ආයු"}
data: {"delta": "බෝවන්"}
data: {"transcription": "ආයුබෝවන්", "done": true}
```

Errors after the first byte arrive as `{"error": "..."}` in the final frame,
because the status line is already sent. The response sets
`X-Accel-Buffering: no` — nginx would otherwise buffer the whole stream.

### Metering

Every transcribe endpoint sets `X-Tokens-Used` to the audio duration in seconds,
rounded up, minimum 1. The gateway bills from that header.

## Post-processing

`postprocessing/post_processing.py` appends `?` or `.` by matching the first
words against `question_words.txt` (UTF-16 encoded). It opens that file by a
**CWD-relative path**, so the service must be started from its own directory —
which the Dockerfile's `WORKDIR` guarantees.

## Configuration

```
HF_TOKEN              # Hugging Face token; compose passes ASR_HF_TOKEN
CORS_ALLOW_ORIGINS    # comma-separated; "*" is rejected at startup
```

## Running it

```bash
pip install -r requirements-base.txt -r requirements-app.txt
python run.py            # serves on 6000
```

Smoke tests (needs the service up): `pytest backend/tests/smoke -m smoke`

## Known issues

- No batching and no queue: inference runs on the request thread, so concurrent
  requests serialise. Registering this as a `long` service in the gateway would
  push it onto the task queue instead.
- The whole model set loads eagerly even though most deployments use one.
