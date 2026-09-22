"""Smoke tests against a running stack.

ASR, TTS and chatbot-modified load multi-gigabyte checkpoints at import time,
so there is no honest way to exercise them in a unit test — a stub tower deep
enough to import them would only be testing the stubs. These tests therefore
talk HTTP to real, running services and skip themselves when none is there,
which keeps CI fast without pretending to cover something it does not.

    docker compose up -d asr-be tts-be chatbot-mod framework-be api-gateway
    pytest backend/tests/smoke -m smoke

Override any endpoint via the environment:

    ASR_URL, TTS_URL, CHATBOT_URL, FRAMEWORK_URL, GATEWAY_URL
"""

import os

import httpx
import pytest

SERVICES = {
    "asr": os.environ.get("ASR_URL", "http://localhost:7000"),
    "tts": os.environ.get("TTS_URL", "http://localhost:7002"),
    "chatbot": os.environ.get("CHATBOT_URL", "http://localhost:7006"),
    "framework": os.environ.get("FRAMEWORK_URL", "http://localhost:7003"),
    "gateway": os.environ.get("GATEWAY_URL", "http://localhost:7010"),
}

# Model inference is slow; a short timeout would flake rather than fail.
TIMEOUT = float(os.environ.get("SMOKE_TIMEOUT", "120"))


def _reachable(base_url: str) -> bool:
    try:
        httpx.get(f"{base_url}/health", timeout=3.0)
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def service_url(request):
    """Base URL for the named service, skipping the test if it is not up."""
    name = request.param
    base_url = SERVICES[name]
    if not _reachable(base_url):
        pytest.skip(f"{name} is not running at {base_url}")
    return base_url


@pytest.fixture
def http():
    with httpx.Client(timeout=TIMEOUT) as client:
        yield client
