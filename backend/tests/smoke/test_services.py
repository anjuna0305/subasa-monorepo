"""One health check and one happy path per service."""

import json

import pytest

from tests.smoke.sample_speech import make_wav

pytestmark = pytest.mark.smoke


@pytest.mark.parametrize(
    "service_url", ["asr", "tts", "chatbot", "framework", "gateway"], indirect=True
)
def test_health(service_url, http):
    response = http.get(f"{service_url}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.parametrize("service_url", ["asr"], indirect=True)
def test_asr_transcribe(service_url, http):
    response = http.post(
        f"{service_url}/transcribe",
        files={"file": ("speech.wav", make_wav(), "audio/wav")},
    )
    assert response.status_code == 200, response.text
    assert "transcription" in response.json()
    # metering header the gateway bills from
    assert int(response.headers["X-Tokens-Used"]) >= 1


@pytest.mark.parametrize("service_url", ["asr"], indirect=True)
def test_asr_streams_sse_frames(service_url, http):
    with http.stream(
        "POST",
        f"{service_url}/transcribe/whisper/stream",
        files={"file": ("speech.wav", make_wav(), "audio/wav")},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        events = [
            json.loads(line[5:])
            for line in response.iter_lines()
            if line.startswith("data:")
        ]

    assert events, "stream produced no events"
    # the last frame is always the terminal one
    assert "transcription" in events[-1] or "error" in events[-1]


@pytest.mark.parametrize("service_url", ["tts"], indirect=True)
def test_tts_generate(service_url, http):
    response = http.post(
        f"{service_url}/generate",
        json={
            "text": "ආයුබෝවන්.",
            "speaker": "mettananda",
            "speaker_type": "single",
            "voice": "male",
            "input_type": "sinhala",
        },
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "audio/wav"
    assert response.content[:4] == b"RIFF"
    assert int(response.headers["X-Tokens-Used"]) >= 1


@pytest.mark.parametrize("service_url", ["tts"], indirect=True)
def test_tts_rejects_empty_text(service_url, http):
    response = http.post(f"{service_url}/generate", json={"text": "   "})
    assert response.status_code == 400


@pytest.mark.parametrize("service_url", ["tts"], indirect=True)
def test_tts_rejects_an_unknown_voice(service_url, http):
    response = http.post(
        f"{service_url}/generate",
        json={"text": "ආයුබෝවන්.", "speaker_type": "single",
              "voice": "male", "input_type": "klingon"},
    )
    assert response.status_code == 404


@pytest.mark.parametrize("service_url", ["framework"], indirect=True)
def test_framework_upload_then_chat(service_url, http):
    upload = http.post(
        f"{service_url}/upload",
        files={
            "file": (
                "notes.txt",
                "සුබසා යනු සිංහල කථන පද්ධතියකි.".encode(),
                "text/plain",
            )
        },
    )
    assert upload.status_code == 200, upload.text
    document_key = upload.json()["document_key"]

    chat = http.post(
        f"{service_url}/chat",
        json={"message": "සුබසා යනු කුමක්ද?", "document_key": document_key},
    )
    assert chat.status_code == 200, chat.text
    assert chat.json()["response"]
    assert int(chat.headers["X-Tokens-Used"]) >= 1


@pytest.mark.parametrize("service_url", ["framework"], indirect=True)
def test_framework_rejects_an_unsupported_file_type(service_url, http):
    response = http.post(
        f"{service_url}/upload",
        files={"file": ("evil.exe", b"MZ", "application/octet-stream")},
    )
    assert response.status_code == 400


@pytest.mark.parametrize("service_url", ["framework"], indirect=True)
def test_framework_chat_without_a_document_is_rejected(service_url, http):
    response = http.post(
        f"{service_url}/chat",
        json={"message": "hello", "document_key": "no-such-document"},
    )
    assert response.status_code in (400, 404)


@pytest.mark.parametrize("service_url", ["chatbot"], indirect=True)
def test_chatbot_requires_a_file_path(service_url, http):
    response = http.post(f"{service_url}/chat", json={"message": "hello", "file_path": ""})
    assert response.status_code == 400


@pytest.mark.parametrize("service_url", ["chatbot"], indirect=True)
def test_chatbot_rejects_a_traversing_file_path(service_url, http):
    """The path is joined onto UPLOAD_DIR and must not be able to escape it."""
    response = http.post(
        f"{service_url}/chat",
        json={"message": "hello", "file_path": "../../etc/passwd"},
    )
    assert response.status_code == 400


@pytest.mark.parametrize("service_url", ["gateway"], indirect=True)
def test_gateway_rejects_an_unknown_api_key(service_url, http):
    response = http.post(
        f"{service_url}/api/asr/transcribe",
        headers={"X-Api-Key": "definitely-not-a-real-key"},
        json={},
    )
    assert response.status_code in (401, 404)
