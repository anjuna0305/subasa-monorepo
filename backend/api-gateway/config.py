import os

from dotenv import load_dotenv

load_dotenv()

# "production" turns the weak-config checks below from warnings into hard
# startup failures, so a deployment can never silently ship a dev default.
APP_ENV = os.environ.get("APP_ENV", "development").lower()
IS_PRODUCTION = APP_ENV == "production"


class ConfigError(RuntimeError):
    """Raised at import time when the environment is unusable."""


DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "mysql+aiomysql://subasa:your_password@localhost:3306/subasa",
)

# A predictable signing key lets anyone mint an admin token, so there is no
# fallback value: the gateway refuses to start without a strong one.
MIN_JWT_SECRET_LENGTH = 32
_WEAK_JWT_SECRETS = {
    "change-me-in-production",
    "changeme",
    "secret",
    "your_jwt_secret_here",
}

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    raise ConfigError(
        "JWT_SECRET is not set. Generate one with "
        "`python -c 'import secrets; print(secrets.token_urlsafe(48))'` "
        "and put it in the environment."
    )
if JWT_SECRET.lower() in _WEAK_JWT_SECRETS:
    raise ConfigError("JWT_SECRET is a known placeholder value; generate a real one.")
if len(JWT_SECRET) < MIN_JWT_SECRET_LENGTH:
    message = (
        f"JWT_SECRET is only {len(JWT_SECRET)} characters; "
        f"at least {MIN_JWT_SECRET_LENGTH} are required."
    )
    if IS_PRODUCTION:
        raise ConfigError(message)
    print(f"WARNING: {message} This will refuse to start with APP_ENV=production.")

JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))

# Images and knowledge files are served under different routes and validated
# against different extension allowlists, so they need separate directories.
_DEFAULT_UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "uploads")
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", _DEFAULT_UPLOAD_ROOT)
IMAGE_UPLOAD_DIR = os.environ.get("IMAGE_UPLOAD_DIR", os.path.join(UPLOAD_DIR, "chatbot_images"))
FILE_UPLOAD_DIR = os.environ.get("FILE_UPLOAD_DIR", os.path.join(UPLOAD_DIR, "chatbot_files"))
TTS_FILE_DIR = os.environ.get("FILE_STORE_DIR", os.path.join(UPLOAD_DIR, "tts"))

CUSTOM_CHATBOT_SERVICE_URL = os.environ.get(
    "CUSTOM_CHATBOT_SERVICE_URL", "http://localhost:7006/chat"
)
TTS_SERVICE_URL = os.environ.get("TTS_SERVICE_URL", "http://localhost:7002")
ASR_SERVICE_URL = os.environ.get("ASR_SERVICE_URL", "http://localhost:7000")
FRAMEWORK_SERVICE_URL = os.environ.get("FRAMEWORK_SERVICE_URL", "http://localhost:7003")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

_DEFAULT_DEV_ORIGINS = "http://localhost:7007,http://localhost:5173"


def _parse_origins(raw: str) -> list[str]:
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


CORS_ALLOW_ORIGINS = _parse_origins(os.environ.get("CORS_ALLOW_ORIGINS", _DEFAULT_DEV_ORIGINS))
if "*" in CORS_ALLOW_ORIGINS:
    # allow_credentials=True plus a wildcard origin is rejected by browsers
    # anyway, and it would let any site drive the API with a user's cookies.
    raise ConfigError("CORS_ALLOW_ORIGINS must list explicit origins; '*' is not accepted.")
if not CORS_ALLOW_ORIGINS:
    raise ConfigError("CORS_ALLOW_ORIGINS is empty; list at least one origin.")
