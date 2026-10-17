"""
v7.14 fix — Test che /profile-check non richieda 'Password protezione dati'
se ALMENO UNA tra data_password_hash e second_parent_data_password_hash è settata.
Prima il check era slot-specific e falliva se il parent era stato re-associato
a uno slot diverso da quello dove era stata salvata la password.
"""
import os
import uuid
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv("/app/backend/.env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
# Fallback to frontend .env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def test_data(event_loop):
    """Create a test parent + minor athlete directly in DB, cleanup after."""
    async def _setup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]

        # Find any existing society to attach data to
        soc = await db.societies.find_one({}, {"id": 1})
        society_id = soc["id"] if soc else str(uuid.uuid4())

        parent_id = "TEST_PARENT_" + uuid.uuid4().hex[:12]
        athlete_id = "TEST_ATH_" + uuid.uuid4().hex[:12]
        email = f"test_v714_{uuid.uuid4().hex[:8]}@example.com"
        password = "Test1234!"

        parent_doc = {
            "id": parent_id,
            "email": email,
            "password_hash": pwd_ctx.hash(password),
            "full_name": "TEST Parent V714",
            "role": "parent",
            "society_id": society_id,
            "phone": "3331234567",
            "fiscal_code": "TSTTST80A01H501Z",
            "address": "Via Test 1",
            "city": "Roma",
            "province": "RM",
            "postal_code": "00100",
            "country_of_birth": "Italia",
            "place_of_birth": "Roma",
            "date_of_birth": "1980-01-01",
            "email_verified": True,
            "is_active": True,
        }
        await db.users.insert_one(parent_doc)

        athlete_doc = {
            "id": athlete_id,
            "first_name": "TEST",
            "last_name": "MINOR",
            "full_name": "TEST MINOR",
            "date_of_birth": "2015-05-01",
            "fiscal_code": "TSTMNR15E01H501A",
            "country_of_birth": "Italia",
            "place_of_birth": "Roma",
            "is_minor": True,
            "parent_id": parent_id,
            "society_id": society_id,
            "status": "active",
        }
        await db.athletes.insert_one(athlete_doc)
        client.close()
        return {"email": email, "password": password, "parent_id": parent_id,
                "athlete_id": athlete_id, "society_id": society_id}

    async def _cleanup(data):
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.users.delete_one({"id": data["parent_id"]})
        await db.athletes.delete_one({"id": data["athlete_id"]})
        client.close()

    data = event_loop.run_until_complete(_setup())
    yield data
    event_loop.run_until_complete(_cleanup(data))


@pytest.fixture(scope="module")
def auth_token(test_data):
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": test_data["email"],
        "password": test_data["password"],
    })
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.json()["token"]


@pytest.fixture
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


def _reset_password_fields(event_loop, athlete_id, primary=None, second=None):
    async def _reset():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.athletes.update_one(
            {"id": athlete_id},
            {"$set": {"data_password_hash": primary, "second_parent_data_password_hash": second}}
        )
        client.close()
    event_loop.run_until_complete(_reset())


# ---------- TESTS ----------

def test_baseline_no_password_missing_field_present(test_data, headers, event_loop):
    """Without password set, 'Password protezione dati' must appear in parent_missing."""
    _reset_password_fields(event_loop, test_data["athlete_id"], primary=None, second=None)
    r = requests.get(f"{BASE_URL}/api/athletes/{test_data['athlete_id']}/profile-check", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "Password protezione dati" in body["parent_missing"], f"Baseline should list password missing: {body}"


def test_change_password_then_has_password_true(test_data, headers, event_loop):
    """POST /change-password → GET /has-password returns true."""
    _reset_password_fields(event_loop, test_data["athlete_id"], primary=None, second=None)
    r = requests.post(
        f"{BASE_URL}/api/athletes/{test_data['athlete_id']}/change-password",
        headers=headers, json={"new_password": "datapw1234"}
    )
    assert r.status_code == 200, r.text
    r2 = requests.get(f"{BASE_URL}/api/athletes/{test_data['athlete_id']}/has-password", headers=headers)
    assert r2.status_code == 200
    assert r2.json().get("has_password") is True


def test_after_password_set_not_in_parent_missing(test_data, headers, event_loop):
    """After setting password via API, 'Password protezione dati' must NOT be in parent_missing."""
    _reset_password_fields(event_loop, test_data["athlete_id"], primary=None, second=None)
    r = requests.post(
        f"{BASE_URL}/api/athletes/{test_data['athlete_id']}/change-password",
        headers=headers, json={"new_password": "datapw1234"}
    )
    assert r.status_code == 200

    r2 = requests.get(f"{BASE_URL}/api/athletes/{test_data['athlete_id']}/profile-check", headers=headers)
    assert r2.status_code == 200
    body = r2.json()
    assert "Password protezione dati" not in body["parent_missing"], (
        f"BUG: Password protezione dati still in parent_missing after setting password: {body}"
    )


def test_v714_fix_password_in_second_slot_only(test_data, headers, event_loop):
    """
    Simulates the exact user-reported bug:
    password was saved when user was in the second_parent slot, then the user
    is re-associated as primary parent (parent_id). The old slot-specific check
    would fail; the fix makes it permissive.
    """
    # Set password only in second_parent slot; user is currently the primary parent
    _reset_password_fields(
        event_loop, test_data["athlete_id"],
        primary=None,
        second=pwd_ctx.hash("orphanpassword"),
    )
    r = requests.get(f"{BASE_URL}/api/athletes/{test_data['athlete_id']}/profile-check", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "Password protezione dati" not in body["parent_missing"], (
        f"V7.14 FIX FAILED: password in second_parent slot must satisfy the check "
        f"even if user is currently the primary parent. Response: {body}"
    )


def test_v714_fix_password_in_primary_slot_only(test_data, headers, event_loop):
    """Mirror scenario: password in primary slot must also satisfy the check."""
    _reset_password_fields(
        event_loop, test_data["athlete_id"],
        primary=pwd_ctx.hash("primarypw"),
        second=None,
    )
    r = requests.get(f"{BASE_URL}/api/athletes/{test_data['athlete_id']}/profile-check", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "Password protezione dati" not in body["parent_missing"], body
