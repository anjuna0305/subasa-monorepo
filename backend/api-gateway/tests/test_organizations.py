"""Organization CRUD and user assignment."""

from models import UserRole
from tests.factories import auth_header, make_org, make_user


async def test_create_organization(client):
    response = await client.post("/orgs", json={"name": "Ministry", "is_active": True})
    assert response.status_code == 201, response.text
    assert response.json()["name"] == "Ministry"


async def test_duplicate_organization_name_is_rejected(client, db):
    await make_org(db, name="Ministry")
    response = await client.post("/orgs", json={"name": "Ministry", "is_active": True})
    assert response.status_code == 409


async def test_assign_an_organization_to_a_user(client, db):
    org = await make_org(db, name="Ministry")
    user = await make_user(db, email="assign@example.com")

    response = await client.put(
        f"/users/{user.uuid}/organization",
        json={"organization_uuid": org.uuid},
    )
    assert response.status_code == 200, response.text
    assert response.json()["organization_name"] == "Ministry"


async def test_assigning_an_unknown_organization_is_a_404(client, db):
    user = await make_user(db, email="assign404@example.com")
    response = await client.put(
        f"/users/{user.uuid}/organization",
        json={"organization_uuid": "no-such-org"},
    )
    assert response.status_code == 404


async def test_admin_can_block_a_user(client, db):
    admin = await make_user(db, name="Root", email="root@example.com", role=UserRole.admin)
    target = await make_user(db, name="Victim", email="victim@example.com")

    response = await client.put(f"/users/{target.uuid}/block", headers=auth_header(admin))
    assert response.status_code == 200, response.text
    assert response.json()["is_active"] is False


async def test_org_admin_cannot_block_outside_their_organization(client, db):
    org = await make_org(db, name="Own")
    other = await make_org(db, name="Other")
    org_admin = await make_user(
        db,
        name="OrgBoss",
        email="orgboss@example.com",
        role=UserRole.organization_admin,
        org=org,
    )
    outsider = await make_user(db, name="Outsider", email="outsider@example.com", org=other)

    response = await client.put(f"/users/{outsider.uuid}/block", headers=auth_header(org_admin))
    assert response.status_code == 403


async def test_blocking_requires_authentication(client, db):
    target = await make_user(db, email="noauth@example.com")
    assert (await client.put(f"/users/{target.uuid}/block")).status_code == 401
