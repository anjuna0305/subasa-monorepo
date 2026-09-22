# new-chat-app

The Subasa web app. This is the frontend under active development;
`frontend/voicebot` is the deprecated predecessor.

- **Stack**: React 19 · TypeScript · Vite 8 · MUI 9 · TanStack Query · react-router 7
- **Port**: 7007, served by nginx from a static build
- **Base path**: served under `/voc-si` in production (`VITE_BASE_PATH`)

## Running it

```bash
cp .env.example .env         # point VITE_API_BASE_URL at a running gateway
npm ci
npm run dev
npm run lint && npm run typecheck && npm run build
```

`typecheck` runs `tsc -b`, not `tsc --noEmit` — the plain form skips the app
project and misses real build errors.

## Layout

```
src/
  App.tsx            route table
  RootLayout.tsx     theme, Google OAuth provider, auth provider, alerts
  AppLayout.tsx      sidebar + outlet; builds the nav list per role
  api/               one module per backend area; all go through api/axios.ts
  components/        *Shell components are the feature surfaces
  contexts/          auth and alert providers
  hooks/             data hooks and the ASR recorder
  pages/             route targets, thin wrappers over the shells
  types/             response shapes mirroring the gateway's schemas
  utils/             endpoint map, audio encoding, role helpers
```

The `*Shell` components hold the real work; `pages/` mostly supply headings.

## Routes

| Path | Guard | Notes |
|---|---|---|
| `/login` `/register` | — | password + Google sign-in |
| `/onboarding` | — | shown after a Google sign-in that created the account |
| `/` `/about` | — | |
| `/p/asr` | — | mic → streaming transcript |
| `/p/tts` | — | text → synthesised audio |
| `/p/gov-chatbot` | — | Constitution chatbot |
| `/p/make-chatbot` | — | upload a document |
| `/p/:url_path` | per-chatbot | any custom chatbot; access decided by `useChatbotAccess` |
| `/admin` `/admin/custom-chatbot` `/admin/organizations` | admin | |
| `/admin/users` | admin or org_admin | |

## Auth

`AuthContext` keeps `accessToken`, `role`, `organization_uuid` and `isNewUser`
in `localStorage` under `subasa_*` keys, seeded on boot. `api/axios.ts` attaches
the token to every request and turns `detail: [{field, message}]` error bodies
into toasts.

`AuthGuard` and `AdminGuard` gate rendering by the role in `localStorage`. They
are **UI convenience only** — the server is the real authority, which matters
because several gateway endpoints currently have no auth at all.

### Google sign-in

One flow: the `<GoogleLogin>` widget returns an ID token, `api/googleAuth.ts`
posts it to `/users/auth/google`, and the gateway verifies it against
`GOOGLE_CLIENT_ID`. A sign-in that created the account comes back with
`is_new_user: true` and routes to `/onboarding`. There is no authorization-code
exchange, no client secret and no redirect URI.

## Speech

`hooks/useAsrRecorder.ts` is the shared capture path, used by both the ASR page
and the custom chatbot:

1. `useMicVAD` detects an utterance and hands back **16 kHz mono Float32** the
   moment the speaker stops — which is exactly the rate the models want.
2. `utils/asrStream.ts` wraps it as a WAV container. This matters: the ASR
   service decodes with libsndfile, which cannot read the webm/opus that
   `MediaRecorder` produces.
3. It posts to `/asr/transcribe/stream` and reads the SSE frames off the
   response body, surfacing partial tokens as they decode.

`EventSource` is not usable here — it only issues GET and cannot carry audio.

TTS goes through `api/tts.ts`, which lists the six voices keyed the way the
service keys its checkpoints, and returns a URL to drop into `<audio>`.

## Chatbot access

`hooks/useChatbotAccess.ts` maps a chatbot to one of `allowed`,
`not_published`, `org_required`, `org_mismatch`, `login_required`:

| Chatbot type | `is_publish` | `is_public` | `organization_id` |
|---|---|---|---|
| Public | true | true | — |
| Registered users only | true | false | null |
| Organization only | true | false | set |
| Unpublished | false | — | — |

**This is currently the only place that model is enforced.** The endpoint the
chat actually calls checks `is_publish` and nothing else.

## Configuration

See `.env.example`. `VITE_GOV_CHATBOT_PATH` names the custom chatbot backing
`/p/gov-chatbot`; it must match a real `url_path` row, and no such row exists
yet in the development database.

## Known issues

- **Auth state has a known problem** — being reworked; the logic is coming from
  the maintainer.
- `Sidebar` calls `useUser()` unguarded, so logged-out visitors fire
  `GET /users/me`, get 401, and see an error toast on every public page.
- `CustomChatbotPage` has its `isLoading`/`isError` early returns commented out,
  so undefined data falls through to "Chatbot is not published" — shown both
  while loading and for a genuine 404.
- `AppLayout`'s nav list still contains `/p/chatbot` and `/p/voice-stream`;
  neither route exists, so both land in the `/p/:url_path` catch-all.
- `createCustomChatbot` sends `is_public` as the string `"true"`/`"false"` into
  a boolean field; Pydantic coercion is what saves it.
- The bundle is a single ~1.3 MB chunk; no code splitting.
