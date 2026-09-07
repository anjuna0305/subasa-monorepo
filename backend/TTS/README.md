# tts-be

Sinhala text-to-speech. Six VITS voices behind one FastAPI app.

- **Stack**: Python 3.10 · FastAPI · Coqui TTS (vendored in `TTS/`) · soundfile
- **Port**: 7002 on the host → 6002 in the container
- **Models**: pulled from the Hugging Face Hub at import time

## Voices

Keyed `{speaker_type}_{voice}_{input_type}`, which is also how the request
selects one:

| Key | Repo | Checkpoint |
|---|---|---|
| `single_male_sinhala` | `Sasangi/VITS_Metta_SInhala` | `checkpoint_324600.pth` |
| `single_female_sinhala` | `Sasangi/Vits_Oshadi_Sinhala` | `checkpoint_38400.pth` |
| `multi_male_sinhala` | `Sasangi/Vits_Multi_Sinhala` | `checkpoint_323400.pth` |
| `multi_female_sinhala` | `Sasangi/Vits_Multi_Sinhala` | `checkpoint_323400.pth` |
| `single_male_romanized` | `Sasangi/Vits_Metta_Roman` | `checkpoint_87600.pth` |
| `single_female_romanized` | `Sasangi/Vits_Oshadi_Roman` | `checkpoint_38400.pth` |

There is no multi-speaker romanized model. `speaker_type: multi` also requires a
`speaker` name (`mettananda`, `oshadi`); `single` ignores it.

**All six load at import.** That is several gigabytes and minutes of startup.

## Request shape

```json
{ "text": "ආයුබෝවන්.", "speaker": "mettananda",
  "speaker_type": "single", "voice": "male", "input_type": "sinhala" }
```

Text goes through `sinhala_cleaners` from the vendored `text/` package, which
expands numbers, dates and abbreviations into spoken Sinhala.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| POST | `/generate` | one WAV, fully synthesised |
| POST | `/generate/stream` | WAV streamed sentence by sentence |
| GET | `/generate/stream` | same, as query params, for `<audio src>` |
| POST | `/generate/prepare` | `{id}` — stash text for playback by id |
| GET | `/generate/stream/{id}` | stream a prepared request |
| POST | `/voicebot-generate-audio` | writes `output/output.wav`, returns its URL |
| GET | `/output/{filename}` | serve a written file |
| GET | `/health` `/` | liveness |
| GET | `/metrics` | Prometheus |

### Why the two-step prepare/stream handoff

`<audio>` only issues GET and cannot carry a body, so a GET variant exists. But
Sinhala percent-encodes to about nine characters per character, so a long reply
blows the URL length ceiling. `POST /generate/prepare` stashes the text and
returns a short id to play back by. Entries live in process for 10 minutes and
are **not** consumed on read, so replay works until they expire — which also
means this breaks if tts-be is ever scaled past one replica.

### Streaming WAV

`build_audio_stream()` splits on sentence boundaries, emits a RIFF header with
`0xFFFFFFFF` sizes (a length the client cannot know up front), then PCM16 per
sentence. A synthesis failure mid-stream ends the stream silently — the status
line is long gone.

### Metering

`/generate` and `/generate/stream` set `X-Tokens-Used` to the character count of
the input text, minimum 1.

## Layout

```
voicebot_tts.py     the service — the only web entry point
text/               vendored Sinhala cleaners, number expansion
TTS/                vendored Coqui TTS library (third-party; excluded from lint)
scripts/            offline batch/evaluation/cloning helpers, not deployed
speakers.pth        multi-speaker embeddings
```

`scripts/` has its own README. Those files are not imported by the service.

## Configuration

```
HF_TOKEN              # Hugging Face token; compose passes TTS_HF_TOKEN
CORS_ALLOW_ORIGINS    # comma-separated; "*" is rejected at startup
```

## Running it

```bash
pip install -r requirements-base.txt -r requirements-app.txt
python voicebot_tts.py       # serves on 6002
```

## Known issues

- Synthesis runs on the request thread with one model set in one process, so
  concurrency queues rather than parallelises. See `loadtests/asr_tts.js`.
- `/voicebot-generate-audio` writes to a single fixed path, `output/output.wav`,
  so concurrent callers overwrite each other. The gateway's `/tts/generate`
  proxy avoids this by storing each result under a UUID.
- The pending-stream map is in-process, so `prepare` and `stream` must hit the
  same replica.
