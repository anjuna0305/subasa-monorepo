# voicebot-frontend

> **Deprecated.** See `DEPRECATED.md` for what has to be ported before it can be
> removed, and issue #44. Nothing new should be added here.

The original Subasa web app: hand-written HTML, CSS and vanilla JS, served by
nginx. Still built and deployed because it has not been confirmed unused.

- **Stack**: static HTML/JS, nginx
- **Port**: 7005

## Layout

```
index.html          landing page
chatbot.html        top-level chat entry
pages/
  chatbot.html      Constitution chatbot   — BROKEN, see below
  document.html     upload a document and chat about it
  speech.html       microphone → transcript
  tts.html          text → speech
  settings.html     local preferences
script.js           all client logic for the above
static/             logo, favicon, hero image
```

## How it talks to the backend

`script.js` builds every URL from a base plus a service prefix and calls the
gateway's **metered** proxy:

```js
const frameworkPort = "api/framework";
const API_UPLOAD_URL = `${baseURL}${frameworkPort}/upload`;
const API_CHAT_URL   = `${baseURL}${frameworkPort}/chat`;
```

That path requires an `X-Api-Key` header, which this app never sends — so these
calls only work if the reverse proxy in front of `subasa.lk` injects one. The
current web app avoids the question entirely by using the keyless first-party
`/asr`, `/tts` and `/framework` routes instead.

**`pages/chatbot.html` is already broken**: it calls `api/chatbot/chat`, and the
service behind that was deleted (issue #14).

## Running it

```bash
docker compose up voicebot-frontend    # http://localhost:7005
```

It is plain static files — opening `index.html` directly works too, as long as
the backend allows the origin.
