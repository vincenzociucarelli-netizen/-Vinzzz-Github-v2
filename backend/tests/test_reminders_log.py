# Promemoria inviati: POST /api/admin/payments/reminders/log + last_reminder in GET installment-reminders
# Requires TEST_ seed (seed_test_reminders.py seed) -> ids in /tmp/test_reminders_ids.json
import os
import json
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
ADMIN = {"email": "vincenzo.ciucarelli@gmail.com", "password": "Test1234"}
COACH = {"email": "alice@test.com", "password": "Test1234"}
LOG = f"{BASE_URL}/api/admin/payments/reminders/log"
GET = f"{BASE_URL}/api/admin/payments/installment-reminders"
IDS_FILE = "/tmp/test_reminders_ids.json"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    return r.json().get("token") if r.status_code == 200 else None


@pytest.fixture(scope="module")
def H():
    t = _login(ADMIN)
    if not t:
        pytest.skip("admin login failed")
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def ids():
    if not os.path.exists(IDS_FILE):
        pytest.skip("seed not present")
    return json.load(open(IDS_FILE))


def _row(data, aid, n):
    inst = next(i for i in data["installments"] if i["installment_number"] == n)
    return next((u for u in inst["unpaid"] if u["athlete_id"] == aid), None)


# Auth
def test_log_no_auth():
    r = requests.post(LOG, json={"athlete_id": "x", "installment_number": 1}, timeout=30)
    assert r.status_code in (401, 403)


def test_log_coach_forbidden():
    t = _login(COACH)
    if not t:
        pytest.skip("coach login failed")
    r = requests.post(LOG, json={"athlete_id": "x", "installment_number": 1},
                      headers={"Authorization": f"Bearer {t}"}, timeout=30)
    assert r.status_code == 403


def test_log_validation_missing_fields(H):
    r = requests.post(LOG, json={"role": "padre"}, headers=H, timeout=30)
    assert r.status_code == 422


# Structure: every unpaid row has installment_number + last_reminder
def test_rows_have_new_fields(H):
    d = requests.get(GET, headers=H, timeout=60).json()
    for inst in d["installments"]:
        for u in inst["unpaid"]:
            assert u["installment_number"] == inst["installment_number"]
            assert "last_reminder" in u


def test_last_reminder_null_before(H, ids):
    d = requests.get(GET, headers=H, timeout=60).json()
    a1 = ids["athletes"][0]
    row = _row(d, a1, 2)
    assert row is not None and row["overdue"] is True
    assert row["last_reminder"] is None


# Log -> GET
def test_log_and_get_count(H, ids):
    a1, a2 = ids["athletes"][0], ids["athletes"][1]
    r = requests.post(LOG, headers=H, timeout=30, json={
        "athlete_id": a1, "installment_number": 2, "role": "padre", "phone": "+39 333 444 5555", "label": "Rata 2"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["ok"] is True and b["role"] == "padre" and b["sent_at"]
    d = requests.get(GET, headers=H, timeout=60).json()
    lr = _row(d, a1, 2)["last_reminder"]
    assert lr["count"] == 1 and lr["role"] == "padre" and lr["sent_at"] == b["sent_at"]
    # second log with another role -> count 2, role updated
    r2 = requests.post(LOG, headers=H, timeout=30, json={
        "athlete_id": a1, "installment_number": 2, "role": "madre", "phone": "0039 3336667777", "label": "Rata 2"})
    assert r2.status_code == 200
    d = requests.get(GET, headers=H, timeout=60).json()
    lr = _row(d, a1, 2)["last_reminder"]
    assert lr["count"] == 2 and lr["role"] == "madre"
    # isolation: other rata / other athlete unaffected
    assert _row(d, a1, 3)["last_reminder"] is None
    assert _row(d, a2, 1)["last_reminder"] is None


def test_log_persisted_fields(ids):
    # DB-level check: society_id, sent_by, sent_at
    import asyncio
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient
    load_dotenv("/app/backend/.env")

    async def q():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        return await db.payment_reminders.find({"athlete_id": ids["athletes"][0]}).to_list(10)
    docs = asyncio.run(q())
    assert len(docs) >= 2
    for doc in docs:
        assert doc["society_id"] == "697fdba0d218717959e73eea"
        assert doc.get("sent_by") and doc.get("sent_at")
        assert doc["installment_number"] == 2
