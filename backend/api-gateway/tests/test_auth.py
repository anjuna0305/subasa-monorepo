"""Registration, login and role enforcement."""

import pytest

from models import UserRole
from tests.factories import auth_header, make_org, make_user


async def test_register_creates_a_general_user(client, db):
    response = await client.post(
        "/users/register",
        json={
            "name": "Nimal",
            "email": "nimal@example.com",
            "password": "Hunter2hunter2",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "nimal@example.com"
    assert body["role"] == UserRole.general_user.value


async def test_register_rejects_a_duplicate_email(client, db):
    await make_user(db, name="First", email="taken@example.com")
    response = await client.post(
        "/users/register",
        json={
            "name": "Second",
            "email": "taken@example.com",
            "password": "Hunter2hunter2",
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"][0]["field"] == "email"


async def test_login_returns_a_token(client, db):
    await make_user(db, email="login@example.com", password="Hunter2hunter2")
    response = await client.post(
        "/users/login",
        json={"email": "login@example.com", "password": "Hunter2hunter2"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["access_token"]


async def test_login_rejects_a_wrong_password(client, db):
    await make_user(db, email="wrong@example.com", password="Hunter2hunter2")
    response = await client.post(
        "/users/login",
        json={"email": "wrong@example.com", "password": "not-the-password"},
    )
    assert response.status_code == 401


async def test_blocked_user_cannot_log_in(client, db):
    """Regression for #4."""
    await make_user(db, email="blocked@example.com", password="Hunter2hunter2", is_active=False)
    response = await client.post(
        "/users/login",
        json={"email": "blocked@example.com", "password": "Hunter2hunter2"},
    )
    assert response.status_code == 401
    assert "blocked" in response.json()["detail"][0]["message"].lower()


async def test_me_requires_a_token(client):
    assert (await client.get("/users/me")).status_code == 401


async def test_me_returns_the_caller(client, db):
    user = await make_user(db, email="me@example.com")
    response = await client.get("/users/me", headers=auth_header(user))
    assert response.status_code == 200, response.text
    assert response.json()["email"] == "me@example.com"


async def test_garbage_token_is_rejected(client):
    response = await client.get("/users/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "role,expected",
    [
        (UserRole.admin, 200),
        (UserRole.organization_admin, 200),
        (UserRole.general_user, 403),
        (UserRole.organization_user, 403),
    ],
)
async def test_user_listing_is_restricted_to_admins(client, db, role, expected):
    org = await make_org(db, name=f"Org-{role.value}")
    user = await make_user(
        db,
        name=f"u-{role.value}",
        email=f"{role.value}@example.com",
        role=role,
        org=org,
    )
    response = await client.get("/users", headers=auth_header(user))
    assert response.status_code == expected


async def test_org_admin_cannot_filter_by_another_organization(client, db):
    org = await make_org(db, name="Own Org")
    other = await make_org(db, name="Other Org")
    admin = await make_user(
        db,
        name="Org Admin",
        email="orgadmin@example.com",
        role=UserRole.organization_admin,
        org=org,
    )
    response = await client.get(
        f"/users?organization_uuid={other.uuid}", headers=auth_header(admin)
    )
    assert response.status_code == 422
