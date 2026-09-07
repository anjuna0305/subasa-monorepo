# subasa-app

The Subasa mobile client. **Scaffold only — not built out.**

- **Stack**: Expo SDK 56 · React Native 0.85 · expo-router · TypeScript
- **Status**: an unmodified Expo starter template. No Subasa feature exists yet.

## What is actually here

```
src/
  app/            _layout, index, explore — starter screens
  components/     themed text/view, tabs, collapsible — starter components
  constants/      theme
  hooks/          colour scheme helpers
```

Nothing under `src/` reads the API, and nothing reads the `EXPO_PUBLIC_*`
variables already present in `.env`.

## Configuration (present, unused)

```
EXPO_PUBLIC_API_BASE_URL         gateway base URL
EXPO_PUBLIC_CHATBOT_PATH         url_path of the chatbot to open
EXPO_PUBLIC_ASR_TRANSCRIBE_URL   ASR endpoint
EXPO_PUBLIC_TTS_STREAMING        stream vs. one-shot synthesis
EXPO_PUBLIC_USE_RN_FETCH         upload strategy toggle
```

## Running it

```bash
npm install
npx expo start          # then i / a / w
```

## What is left to build

Tracked as issues #47–#51, deliberately left open:

| Issue | Work |
|---|---|
| #51 | consume the `EXPO_PUBLIC_*` config; add `.env.example` |
| #47 | Google OAuth against `POST /users/auth/google`, token in expo-secure-store |
| #48 | chat screen against `POST /custom-chatbots/api/{url_path}` |
| #49 | record audio, upload to ASR, show the transcript |
| #50 | text → `POST /tts/generate`, play the result |

The web app is the reference for all five: `useAsrRecorder` and
`utils/asrStream.ts` show the audio format the ASR service requires (16 kHz mono
WAV — it cannot read webm/opus), and `api/tts.ts` lists the six voice keys.

## Note on Expo version

`AGENTS.md` in this directory is emphatic: Expo 56 changed a lot. Check the
versioned docs at <https://docs.expo.dev/versions/v56.0.0/> rather than
older tutorials.
