"""The startup guards in config.py.

config is imported once per process, so each case runs in a subprocess with a
purpose-built environment.
"""

import os
import subprocess
import sys

import pytest

GATEWAY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BASE_ENV = {
    "PATH": os.environ.get("PATH", ""),
    "APP_ENV": "development",
    "CORS_ALLOW_ORIGINS": "http://localhost:5173",
    "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
    # config.py calls load_dotenv(); point it away from the developer's own file
    "DOTENV_PATH": "",
}


def _import_config(**overrides):
    env = {**BASE_ENV, **overrides}
    return subprocess.run(
        [sys.executable, "-c", "import config"],
        cwd=GATEWAY_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


GOOD_SECRET = "a" * 40


@pytest.mark.parametrize(
    "overrides,expected",
    [
        ({"JWT_SECRET": ""}, "JWT_SECRET is not set"),
        (
            {"JWT_SECRET": "change-me-in-production"},
            "known placeholder",
        ),
        (
            {"JWT_SECRET": "short", "APP_ENV": "production"},
            "at least 32",
        ),
        (
            {"JWT_SECRET": GOOD_SECRET, "CORS_ALLOW_ORIGINS": "*"},
            "'*' is not accepted",
        ),
        (
            {"JWT_SECRET": GOOD_SECRET, "CORS_ALLOW_ORIGINS": ""},
            "at least one origin",
        ),
    ],
)
def test_bad_config_refuses_to_start(overrides, expected):
    result = _import_config(**overrides)
    assert result.returncode != 0, result.stdout
    assert expected in result.stderr


def test_good_config_starts():
    result = _import_config(JWT_SECRET=GOOD_SECRET)
    assert result.returncode == 0, result.stderr


def test_short_secret_is_only_a_warning_outside_production():
    result = _import_config(JWT_SECRET="short", APP_ENV="development")
    assert result.returncode == 0, result.stderr
    assert "WARNING" in result.stdout
