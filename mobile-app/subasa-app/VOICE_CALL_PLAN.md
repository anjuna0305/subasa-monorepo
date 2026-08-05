# Voice-to-Voice Call Mode — Implementation Plan

Goal: opening a chatbot in the mobile app feels like placing a phone call. You speak,
it answers out loud, no play buttons anywhere. When you hang up, the conversation stays
on screen as a readable chat (in app memory only — no backend persistence in this phase).

Status: **plan only, not yet implemented.**

---

## 1. Backend contract (already exists)

Every piece of the loop is a live endpoint on the API gateway (`backend/api-gateway`, port
7010). `frontend/new-chat-app/src/components/CustomChatShell.tsx` is a working reference for
the exact sequence and payload shapes.

| Step | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| Resolve bot | `GET /custom-chatbots/by-url-path/{url_path}` | none | — | `CustomChatbotOut` (name, description, hero_image, url_path) |
| Hero image | `GET /custom-chatbots/images/{image_name}` | none | — | image bytes |
| Transcribe | `POST https://subasa.lk/voc-si/api/asr/transcribe` | none | multipart, field `file` | `{ "transcription": "…" }` |
| Reply | `POST /custom-chatbots/api/{url_path}` | none (bot must be published) | `{ "message": "…" }` | `{ "response": "…" }` |
| Speak | `POST /tts/generate` | none | `{text, speaker, speaker_type, voice, input_type}` | `{ "audioUrl": "https://…/tts/output/x.wav" }` |
| Fetch audio | `GET /tts/output/{file_name}` | none | — | wav bytes |

TTS defaults, matching the web client:

```json
{ "speaker": "mettananda", "speaker_type": "single", "voice": "male", "input_type": "sinhala" }
```

The app sends **no API key and no auth header anywhere**, matching
`frontend/new-chat-app`, which calls the deployed ASR route directly and hits the public
chatbot and TTS endpoints. The metered gateway proxy
(`POST /api/{service_key}/{path}`, `backend/api-gateway/routers/gateway.py:26`) validates
`X-API-Key` and would be the eventual home for ASR, but it is not finished, so the app stays
off it. `EXPO_PUBLIC_ASR_TRANSCRIBE_URL` overrides the ASR route when testing locally.

Not used in this phase: `GET /custom-chatbots` (admin-only), `/users/login`, `/tasks/*`.

---

## 2. Required backend change (audio format)

**This is the only backend edit in the plan, and it is not about chat memory.**

`backend/ASR/run.py:74` decodes uploads with `soundfile` alone:

```python
audio_data, samplerate = sf.read(BytesIO(file.file.read()))
```

`soundfile` handles WAV/FLAC/OGG and nothing else, and the ASR image
(`backend/ASR/Dockerfile`, `python:3.10`) has no ffmpeg. Meanwhile `expo-audio` can record
LINEARPCM `.wav` on iOS but on Android only offers `mpeg4` / `3gp` / `amr` containers with
AAC or AMR encoders. Left alone, the call works on iOS and returns 500 on Android.

Fix, in two parts:

1. **Dockerfile runtime stage** — install ffmpeg:

   ```dockerfile
   FROM python:3.10 AS runtime
   RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
       && rm -rf /var/lib/apt/lists/*
   ```

2. **`process_audio_file`** — keep the fast soundfile path, fall back to librosa for
   compressed containers. `audioread`'s ffmpeg backend shells out to the `ffmpeg` binary and
   needs a real path, not a `BytesIO`, so the fallback writes a temp file:

   ```python
   def process_audio_file(file: UploadFile):
       raw = file.file.read()
       try:
           audio_data, samplerate = sf.read(BytesIO(raw))
       except Exception:
           # Mobile clients send AAC in an mp4/3gp container, which libsndfile
           # cannot open; audioread needs a real path to hand ffmpeg.
           suffix = os.path.splitext(file.filename or "")[1] or ".m4a"
           with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
               tmp.write(raw)
               tmp.flush()
               audio_data, samplerate = librosa.load(tmp.name, sr=16000, mono=True)
       ...
   ```

   The existing resample/mono-downmix lines below stay as they are.

Verify with `curl -F file=@sample.m4a http://localhost:7000/transcribe` before touching the
app — this is the single riskiest assumption in the plan, so prove it first.

---

## 3. Call UX

### State machine

```
              ┌──────────────────────────────────────────┐
              ▼                                          │
  idle → listening → transcribing → thinking → speaking ─┘
              ▲                                    │
              └──────── tap to interrupt ──────────┘

  any state ──(end call)──► transcript screen
```

- Entering the call screen goes straight to `listening`. The mic is hot; there is no
  press-and-hold.
- **End of turn is automatic.** Record with `isMeteringEnabled: true`, poll
  `recorder.getStatus().metering` every ~150 ms, and stop once the level has stayed below a
  dB floor for ~1.2 s. Guards: a minimum utterance of ~600 ms so a breath or a door slam
  can't end the turn, and a hard cap of ~30 s.
- The reply autoplays through `useAudioPlayer`. `useAudioPlayerStatus(player).didJustFinish`
  flips the machine back to `listening`. Nothing in the UI plays or replays audio by hand.
- Tapping anywhere while `speaking` stops playback and reopens the mic. True barge-in
  (listening while speaking) needs simultaneous capture plus echo cancellation — explicitly
  out of scope here.
- Empty transcription → a short "didn't catch that" caption and straight back to
  `listening`, no turn recorded.

### Screens

- **Call screen** (full bleed): bot avatar/hero image, a level-reactive orb driven by the
  metering value, a state caption (`Listening…`, `Thinking…`, `Speaking…`), call timer, mute
  toggle, red end-call button. No transcript, no play controls.
- **Transcript screen**: normal chat bubbles — your transcribed speech and the bot's text —
  plus a "Start call" button. This is what you land on after hanging up.

### Audio session

Set once at app start, so the call behaves like a call:

```ts
setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, shouldPlayInBackground: false });
```

`playsInSilentMode` matters — without it, iOS silences the bot when the ringer switch is off.

---

## 4. App structure

Expo SDK 56 + expo-router, on top of the current starter. Per `AGENTS.md`, check
https://docs.expo.dev/versions/v56.0.0/ before writing against any Expo API.

```
src/lib/config.ts               # EXPO_PUBLIC_* env: API base, ASR url + key, chatbot path, TTS voice
src/lib/api.ts                  # getChatbotByUrlPath, transcribe, sendMessage, generateTts
src/lib/voice/recorder.ts       # record + metering-driven end-of-turn detection
src/hooks/use-voice-call.ts     # the state machine; the only place the three calls are chained
src/state/conversation.tsx      # in-memory transcript context, keyed by url_path
src/app/_layout.tsx             # + ConversationProvider, setAudioModeAsync on mount
src/app/index.tsx               # resolves the configured chatbot, routes to its transcript
src/app/chat/[urlPath].tsx      # transcript + "Start call"
src/app/chat/[urlPath]/call.tsx # call screen
```

New dependency: `expo-audio` (`npx expo install expo-audio`). Its config plugin adds
`RECORD_AUDIO` on Android and `NSMicrophoneUsageDescription` on iOS — both go in `app.json`.
No other native modules, so the app keeps running in Expo Go.

### Chatbot entry

The app opens one chatbot, configured by `EXPO_PUBLIC_CHATBOT_PATH` (a `url_path` such as
`sri-lanka-constitution`). `index.tsx` resolves it through the public `by-url-path` endpoint
and redirects to the transcript screen. No login — every endpoint in the loop except ASR is
public. Generalizing to a picker later means changing only `index.tsx`.

### Chat memory

`src/state/conversation.tsx` holds `Record<urlPath, Message[]>` in React state:

```ts
type Message = { id: string; role: "user" | "bot"; text: string; at: number };
```

Provided at the root layout, so it survives navigating into and out of the call screen and
between screens, and clears on app restart. When backend persistence lands, this file is the
only thing that changes — the provider keeps its interface and starts hydrating from the API.

---

## 5. Turn latency

ASR → LLM → TTS run strictly in sequence, so every turn costs the sum of all three plus the
wav download. That is inherent to the current endpoints.

If it feels sluggish on device, the cheap improvement is splitting the reply on sentence
boundaries, calling `/tts/generate` per sentence, and starting playback on the first clip
while the rest synthesize. Worth measuring before building — deferred to phase 4.

A streaming path exists but isn't usable as-is: `POST /transcribe/whisper/stream` is SSE,
which React Native's `fetch` doesn't stream, and `frontend/new-chat-app/src/utils/voiceStream.ts`
talks to a WebSocket ASR server that is not present anywhere in this repo.

---

## 6. Phases

1. **Backend + wiring.** ffmpeg in the ASR image, `process_audio_file` fallback, verified with
   a real m4a. Then `config.ts`, `api.ts`, conversation context, transcript screen with a text
   input — proves the chat contract from a device before any audio.
2. **One-shot voice turn.** Record with an explicit stop button → transcribe → reply →
   autoplay. Confirms recording format works on both platforms.
3. **The call.** Metering VAD, call screen, auto turn cycling, tap to interrupt, state
   captions, end-call routing back to the transcript.
4. **Polish.** Error and retry states, mute, call timer, and sentence-chunked TTS if the
   measured latency warrants it.

---

## 7. Open items

- ASR defaults to the same deployed route the web client uses. Point
  `EXPO_PUBLIC_ASR_TRANSCRIBE_URL` at a local ASR instance to test the ffmpeg change before
  it is deployed. Revisit once the metered gateway proxy is finished.
- The dB floor and silence window for end-of-turn need tuning on a real device in a real room;
  the values above are starting points, not measurements.
- Android emulators are unreliable for microphone work — plan to test phase 2 onward on
  physical hardware.
