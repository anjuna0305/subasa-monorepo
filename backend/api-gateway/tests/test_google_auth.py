"""Sign-in with a Google ID token.

The token itself is verified by google.oauth2.id_token, which talks to
Google's certs endpoint — so that one call is patched and everything around it
is exercised for real.
"""

import pytest
from sqlalchemy import select

from models import User, UserRole
from tests.factories import make_org, make_user

CLAIMS = {
    "email": "gmail-user@example.com",
    "email_verified": True,
    "name": "Gmail User",
    "sub": "google-sub-123",
    "picture": "https://example.com/avatar.png",
}


@pytest.fixture
def google_token(monkeypatch):
    """Patch Google's verifier; the fixture value is the claims it returns."""
    import routers.users as users_router

    state = {"claims": dict(CLAIMS)}

    def fake_verify(token, request, audience):
        if token == "bad-token":
            raise ValueError("invalid token")
        return state["claims"]

    monkeypatch.setattr(users_router.id_token, "verify_oauth2_token", fake_verify)
    monkeypatch.setattr(users_router, "GOOGLE_CLIENT_ID", "test-client-id")
    return state


async def test_first_sign_in_creates_the_account_and_flags_it_new(client, db, google_token):
    response = await client.post("/users/auth/google", json={"id_token": "good"})
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["access_token"]
    assert body["role"] == UserRole.general_user.value
    assert body["is_new_user"] is True

    user = await db.scalar(select(User).where(User.email == CLAIMS["email"]))
    assert user is not None
    assert user.google_id == CLAIMS["sub"]
    assert user.avatar_url == CLAIMS["picture"]
    assert user.hashed_password is None


async def test_returning_user_is_not_flagged_new(client, db, google_token):
    first = await client.post("/users/auth/google", json={"id_token": "good"})
    assert first.json()["is_new_user"] is True

    second = await client.post("/users/auth/google", json={"id_token": "good"})
    assert second.status_code == 200
    assert second.json()["is_new_user"] is False

    users = (await db.execute(select(User).where(User.email == CLAIMS["email"]))).scalars().all()
    assert len(users) == 1, "a second account was created for the same email"


async def test_existing_password_account_gets_linked(client, db, google_token):
    user = await make_user(db, name="Password User", email=CLAIMS["email"])
    assert user.google_id is None

    response = await client.post("/users/auth/google", json={"id_token": "good"})
    assert response.status_code == 200, response.text
    assert response.json()["is_new_user"] is False

    await db.refresh(user)
    assert user.google_id == CLAIMS["sub"]
    # the password still works; linking must not clear it
    assert user.hashed_password is not None


async def test_blocked_user_cannot_sign_in_with_google(client, db, google_token):
    """A block must not be bypassable by switching to the Google button."""
    await make_user(db, name="Blocked", email=CLAIMS["email"], is_active=False)

    response = await client.post("/users/auth/google", json={"id_token": "good"})
    assert response.status_code == 401
    assert "blocked" in response.json()["detail"][0]["message"].lower()


async def test_invalid_token_is_rejected(client, google_token):
    response = await client.post("/users/auth/google", json={"id_token": "bad-token"})
    assert response.status_code == 401
    assert response.json()["detail"][0]["field"] == "id_token"


async def test_unverified_email_is_rejected(client, google_token):
    google_token["claims"]["email_verified"] = False
    response = await client.post("/users/auth/google", json={"id_token": "good"})
    assert response.status_code == 401
    assert response.json()["detail"][0]["field"] == "email"


async def test_token_carries_the_organization(client, db, google_token):
    org = await make_org(db, name="Ministry")
    await make_user(db, name="Org Member", email=CLAIMS["email"], org=org)

    response = await client.post("/users/auth/google", json={"id_token": "good"})
    assert response.status_code == 200, response.text
    assert response.json()["organization_uuid"] == org.uuid


async def test_errors_use_the_field_message_shape(client, google_token):
    """The frontend interceptor iterates detail[]; a bare string breaks it."""
    response = await client.post("/users/auth/google", json={"id_token": "bad-token"})
    detail = response.json()["detail"]
    assert isinstance(detail, list)
    assert set(detail[0]) == {"field", "message"}


async def test_password_login_is_never_flagged_new(client, db):
    await make_user(db, email="pw@example.com", password="Hunter2hunter2")
    response = await client.post(
        "/users/login", json={"email": "pw@example.com", "password": "Hunter2hunter2"}
    )
    assert response.status_code == 200
    assert response.json()["is_new_user"] is False
