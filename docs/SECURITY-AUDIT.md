# Secret audit and rotation checklist

Audit date: 2026-09-07. Re-run the commands below before any handover.

## Git history: clean

No `.env` file has ever been committed:

```bash
git log --all --diff-filter=A --name-only --format="%h" -- '*.env' '**/.env'   # no output
```

Every secret-shaped string in history is a placeholder from an `.env.example`
or a `os.getenv(...)` call site, not a credential:

```bash
for pat in GROQ_API_KEY JWT_SECRET DATABASE_URL hf_ GOCSPX- sk- AIza gho_; do
  git log --all --oneline -S"$pat"
done
```

Hits are limited to `your_groq_api_key_here`, `your_jwt_secret_here`,
`mysql+aiomysql://user:password@localhost:3306/dbname` and similar.

**No history rewrite (`git filter-repo`) is needed.** Nothing to scrub.

## Live credentials that still need rotating

These live only in untracked, gitignored `.env` files on developer and server
machines — never in git — but whoever leaves the project has seen them, so they
must be rotated at handover:

| Secret | Location | Rotate via |
|---|---|---|
| `GROQ_API_KEY` | `backend/chatbot-modified/.env` | Groq console → revoke + reissue |
| `GOOGLE_CLIENT_SECRET` | `backend/api-gateway/.env` | Google Cloud console → OAuth client → reset secret |
| `JWT_SECRET` | `backend/api-gateway/.env` | `python -c 'import secrets; print(secrets.token_urlsafe(48))'` — rotating invalidates every issued token, so users re-login |
| MySQL password | `DATABASE_URL` in root `.env` and `backend/api-gateway/.env` | `ALTER USER ... IDENTIFIED BY ...` |
| `GRAFANA_ADMIN_PASSWORD` | root `.env` | was literally `admin`; set a real one and restart the container |
| `HF_TOKEN` | `ASR_HF_TOKEN` / `TTS_HF_TOKEN` in root `.env` | Hugging Face → Access Tokens → revoke + reissue |

The `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` entries were removed from
`config.py` and the env examples — the Google flow verifies an ID token client
side and never uses them — but the values still exist in local `.env` files and
in the Google Cloud project, so rotate the secret anyway.

## Images were baking secrets in — fixed

No `.dockerignore` excluded `.env`, so `COPY . .` copied real credentials into
every built image; anyone able to pull an image could read them. `.env` and
`.env.*` are now excluded from all build contexts and every secret is injected
through `docker-compose.yml` `environment:` blocks instead.

**Any image built before this change must be deleted, not just superseded**, and
the secrets above rotated:

```bash
docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E 'vocsi|subasa'
docker image rm <each>
```

## Guardrails now in place

- `backend/api-gateway/config.py` refuses to start without a `JWT_SECRET`,
  rejects known placeholder values, and rejects secrets under 32 characters
  when `APP_ENV=production`.
- No service accepts `allow_origins=["*"]`. Every service reads an explicit,
  comma-separated `CORS_ALLOW_ORIGINS` and raises at startup on `*` or empty.
