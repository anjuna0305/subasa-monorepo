# Deprecated — legacy voicebot SPA

This is the original vanilla-JS app, served on port 7005 by the
`voicebot-frontend` compose service. **`frontend/new-chat-app` is the app under
active development.** Nothing new should be added here.

It is still built and deployed because it has not been confirmed unused. See
issue #44 for the removal.

## What still has to be covered before this can be deleted

| voicebot page | Backend it calls | Covered by new-chat-app? |
|---|---|---|
| `pages/chatbot.html` | `api/chatbot/chat` | **No** — that service was deleted in #14. This page is already broken. |
| `pages/document.html` | `api/framework/upload`, `api/framework/chat` | Partly — `/p/make-chatbot` uploads a document, but has no chat-with-it screen yet. |
| `pages/speech.html` | `api/asr/transcribe` | Yes — `/p/asr`, with SSE streaming. |
| `pages/tts.html` | TTS service | Yes — `/p/tts`. |
| `pages/settings.html` | none (local prefs) | No equivalent, and probably not needed. |

Both `script.js` call sites go through the metered `/api/{service_key}` proxy,
which requires an `X-Api-Key` header this app never sends — so those calls
depend on whatever the reverse proxy in front of `subasa.lk` injects. The web
app now uses the keyless first-party `/asr`, `/tts` and `/framework` routes
instead.

## To remove it

1. Confirm nothing is pointed at port 7005.
2. Delete this directory and the `voicebot-frontend` service from
   `docker-compose.yml`.
3. Close #44.
