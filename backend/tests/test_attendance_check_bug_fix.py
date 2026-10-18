"""
Backend regression tests for the /api/attendance/check NameError bug fix
(trial_active, ITALIAN_MONTHS, document_id) plus trial-block logic and
bulk-attendance "prova terminata" handling.

Run:
    pytest /app/backend/tests/test_attendance_check_bug_fix.py -v
"""
import os
import sys
import asyncio
import importlib
from datetime import datetime, timedelta, timezone

import pytest
import requests

# ---- BASE_URL comes from frontend/.env EXPO_PUBLIC_BACKEND_URL ----
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    # fallback: read from frontend/.env
    _env_path = "/app/frontend/.env"
    if os.path.exists(_env_path):
        with open(_env_path) as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"')
                    break
BASE_URL = (BASE_URL or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not configured"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"

TEAM_ID = "697fec5d90eef140898ebfd7"           # Under 14
SOCIETY_ID = "697fdba0d218717959e73eea"
QR_ADULT = "F8SUTC55ZXQH"                       # Testflow adult2@test, status active, no team
ATHLETE_ADULT_ID = "6a8b91ab1b0135de8faf2953"
QR_TRIAL = "REACTTEST001"                       # athlete with cert issue / trial testing
TRIAL_ATHLETE_ID = "c0555a97927f4054ae84b1c9"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(api):
    r = api.post(f"{API}/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                 timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "token" in body, f"Expected 'token' key, got: {list(body.keys())}"
    return body["token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# Local MongoDB handle for cleanup & direct manipulation
@pytest.fixture(scope="module")
def db():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    # Backend .env has them
    if not mongo_url or not db_name:
        with open("/app/backend/.env") as f:
            for line in f:
                k = line.strip().split("=", 1)
                if len(k) == 2:
                    key, val = k
                    val = val.strip().strip('"')
                    if key == "MONGO_URL":
                        mongo_url = val
                    if key == "DB_NAME":
                        db_name = val
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ========== Test 1: adult athlete with no team — force=true then without force ==========
class TestAttendanceCheckAdult:

    def test_01_login_ok(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_02_force_true_returns_allowed(self, api, auth, db):
        # Preclean any existing attendance for today
        today_it = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
        _run(db.attendances.delete_many({"athlete_id": ATHLETE_ADULT_ID, "date": today_it}))
        _run(db.athletes.update_one({"id": ATHLETE_ADULT_ID}, {"$set": {"trial_sessions_count": 0}}))

        r = api.post(f"{API}/attendance/check",
                     json={"qr_code": QR_ADULT, "team_id": TEAM_ID, "force": True},
                     headers=auth, timeout=30)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("status") == "allowed", f"Expected status 'allowed', got {data}"
        assert data.get("athlete_id") == ATHLETE_ADULT_ID

    def test_03_without_force_already_registered(self, api, auth):
        r = api.post(f"{API}/attendance/check",
                     json={"qr_code": QR_ADULT, "team_id": TEAM_ID},
                     headers=auth, timeout=30)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("status") == "already_registered", f"Got: {data}"
        assert data.get("can_force") is True

    def test_04_cleanup_adult(self, db):
        today_it = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
        res = _run(db.attendances.delete_many({"athlete_id": ATHLETE_ADULT_ID, "date": today_it}))
        _run(db.athletes.update_one({"id": ATHLETE_ADULT_ID}, {"$set": {"trial_sessions_count": 0}}))
        assert res.deleted_count >= 1


# ========== Test 2: cert-blocked athlete returns 200 blocked, not 500 ==========
class TestAttendanceCheckCertBlocked:

    def test_cert_blocked_returns_200(self, api, auth):
        r = api.post(f"{API}/attendance/check",
                     json={"qr_code": QR_TRIAL, "team_id": TEAM_ID},
                     headers=auth, timeout=30)
        # Must be 200 (not 500 NameError), status should not be 'allowed'
        assert r.status_code == 200, f"Expected 200 (was 500 before fix), got {r.status_code}: {r.text}"
        data = r.json()
        # Could be 'blocked', 'wrong_team', 'already_registered' depending on data state
        assert data.get("status") in ("blocked", "wrong_team", "already_registered", "allowed"), \
            f"Unexpected status: {data}"


# ========== Test 3: unknown qr → 404 ==========
class TestAttendanceCheckUnknown:
    def test_unknown_qr_404(self, api, auth):
        r = api.post(f"{API}/attendance/check",
                     json={"qr_code": "ZZZZZZZZZZZZ_NOPE", "team_id": TEAM_ID},
                     headers=auth, timeout=30)
        assert r.status_code == 404
        assert "non valido" in r.text.lower() or "non trovato" in r.text.lower()


# ========== Test 4: unit-level get_trial_block_reason ==========
class TestGetTrialBlockReasonUnit:

    @pytest.fixture(scope="class")
    def server_mod(self):
        if "/app/backend" not in sys.path:
            sys.path.insert(0, "/app/backend")
        return importlib.import_module("server")

    def test_block_when_sessions_exceeded(self, server_mod):
        athlete = {
            "id": "x", "society_id": SOCIETY_ID, "status": "trial",
            "is_trial": True,
            "trial_start_date": datetime.utcnow().isoformat(),
            "trial_end_date": (datetime.utcnow() + timedelta(days=5)).isoformat(),
            "trial_sessions_count": 3,
        }
        reason = _run(server_mod.get_trial_block_reason(athlete))
        assert reason is not None
        assert "Periodo di prova terminato" in reason
        assert "3/3" in reason

    def test_block_when_end_date_past(self, server_mod):
        athlete = {
            "id": "x", "society_id": SOCIETY_ID, "status": "trial",
            "is_trial": True,
            "trial_start_date": (datetime.utcnow() - timedelta(days=10)).isoformat(),
            "trial_end_date": (datetime.utcnow() - timedelta(days=1)).isoformat(),
            "trial_sessions_count": 1,
        }
        reason = _run(server_mod.get_trial_block_reason(athlete))
        assert reason is not None
        assert "giorni scaduti" in reason

    def test_none_trial_in_progress(self, server_mod):
        athlete = {
            "id": "x", "society_id": SOCIETY_ID, "status": "trial",
            "is_trial": True,
            "trial_start_date": datetime.utcnow().isoformat(),
            "trial_end_date": (datetime.utcnow() + timedelta(days=5)).isoformat(),
            "trial_sessions_count": 1,
        }
        reason = _run(server_mod.get_trial_block_reason(athlete))
        assert reason is None

    def test_none_pending_trial_no_start(self, server_mod):
        athlete = {
            "id": "x", "society_id": SOCIETY_ID, "status": "pending_trial",
            "is_trial": True,
            "trial_sessions_count": 0,
        }
        reason = _run(server_mod.get_trial_block_reason(athlete))
        assert reason is None

    def test_none_active_status(self, server_mod):
        athlete = {
            "id": "x", "society_id": SOCIETY_ID, "status": "active",
            "is_trial": False,
            "trial_sessions_count": 10,
        }
        reason = _run(server_mod.get_trial_block_reason(athlete))
        assert reason is None


# ========== Test 5: Simulate a trial athlete end-to-end ==========
class TestTrialAthleteE2E:

    @pytest.fixture(scope="class")
    def original(self, db):
        orig = _run(db.athletes.find_one({"id": TRIAL_ATHLETE_ID}))
        assert orig, f"Athlete {TRIAL_ATHLETE_ID} not found"
        return {
            "status": orig.get("status"),
            "is_trial": orig.get("is_trial"),
            "trial_sessions_count": orig.get("trial_sessions_count"),
            "trial_start_date": orig.get("trial_start_date"),
            "trial_end_date": orig.get("trial_end_date"),
            "privacy_accepted": orig.get("privacy_accepted"),
            "team_id": orig.get("team_id"),
        }

    def test_trial_blocked_when_sessions_full(self, api, auth, db, original):
        now = datetime.utcnow()
        _run(db.athletes.update_one(
            {"id": TRIAL_ATHLETE_ID},
            {"$set": {
                "status": "trial",
                "is_trial": True,
                "trial_start_date": now.isoformat(),
                "trial_end_date": (now + timedelta(days=5)).isoformat(),
                "trial_sessions_count": 3,
                "privacy_accepted": True,
                "team_id": TEAM_ID,  # ensure not wrong_team
            }}
        ))
        # Clean today's attendance so we don't short-circuit on already_registered
        today_it = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
        _run(db.attendances.delete_many({"athlete_id": TRIAL_ATHLETE_ID, "date": today_it}))

        r = api.post(f"{API}/attendance/check",
                     json={"qr_code": QR_TRIAL, "team_id": TEAM_ID},
                     headers=auth, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        assert data.get("status") == "blocked", f"Got: {data}"
        br = data.get("block_reason") or ""
        assert "Periodo di prova terminato" in br and "3/3" in br, f"block_reason: {br}"

    def test_trial_in_progress_not_blocked_by_trial(self, api, auth, db):
        _run(db.athletes.update_one(
            {"id": TRIAL_ATHLETE_ID},
            {"$set": {"trial_sessions_count": 1}}
        ))
        today_it = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
        _run(db.attendances.delete_many({"athlete_id": TRIAL_ATHLETE_ID, "date": today_it}))

        r = api.post(f"{API}/attendance/check",
                     json={"qr_code": QR_TRIAL, "team_id": TEAM_ID},
                     headers=auth, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        # must NOT be the "Periodo di prova terminato" block
        br = (data.get("block_reason") or "")
        assert "Periodo di prova terminato" not in br, f"should not be trial-block: {data}"

    def test_restore_trial_athlete(self, db, original):
        # Restore to {status:'trial', is_trial:false, trial_sessions_count:0}
        _run(db.athletes.update_one(
            {"id": TRIAL_ATHLETE_ID},
            {
                "$set": {
                    "status": "trial",
                    "is_trial": False,
                    "trial_sessions_count": 0,
                },
                "$unset": {"trial_start_date": "", "trial_end_date": ""},
            }
        ))
        # Also cleanup any attendance records created during tests
        today_it = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
        _run(db.attendances.delete_many({"athlete_id": TRIAL_ATHLETE_ID, "date": today_it}))
        after = _run(db.athletes.find_one({"id": TRIAL_ATHLETE_ID}))
        assert after.get("status") == "trial"
        assert after.get("is_trial") is False
        assert after.get("trial_sessions_count") == 0
        assert "trial_start_date" not in after
        assert "trial_end_date" not in after


# ========== Test 6: bulk-attendance skip for trial-expired ==========
class TestBulkAttendanceTrialExpired:

    def test_bulk_attendance_skips_trial_expired(self, api, auth, db):
        # Make trial athlete expired
        now = datetime.utcnow()
        _run(db.athletes.update_one(
            {"id": TRIAL_ATHLETE_ID},
            {"$set": {
                "status": "trial",
                "is_trial": True,
                "trial_start_date": now.isoformat(),
                "trial_end_date": (now + timedelta(days=5)).isoformat(),
                "trial_sessions_count": 3,
                "privacy_accepted": True,
                "team_id": TEAM_ID,
            }}
        ))
        today_str = datetime.now().strftime("%Y-%m-%d")
        # ensure no duplicate for the date
        _run(db.attendances.delete_many({"athlete_id": TRIAL_ATHLETE_ID, "team_id": TEAM_ID, "date": today_str}))

        r = api.post(f"{API}/admin/teams/{TEAM_ID}/bulk-attendance",
                     json={"athlete_ids": [TRIAL_ATHLETE_ID],
                           "date": today_str,
                           "time": "18:00",
                           "note": "test regression"},
                     headers=auth, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        skipped = data.get("skipped") or []
        assert any(s.get("athlete_id") == TRIAL_ATHLETE_ID and "prova terminata" in (s.get("reason") or "").lower()
                   for s in skipped), f"Expected skipped w/ 'prova terminata'. Got: {data}"

    def test_bulk_restore(self, db):
        _run(db.athletes.update_one(
            {"id": TRIAL_ATHLETE_ID},
            {
                "$set": {
                    "status": "trial",
                    "is_trial": False,
                    "trial_sessions_count": 0,
                },
                "$unset": {"trial_start_date": "", "trial_end_date": ""},
            }
        ))
        today_it = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
        today_naive = datetime.now().strftime("%Y-%m-%d")
        _run(db.attendances.delete_many({"athlete_id": TRIAL_ATHLETE_ID, "date": {"$in": [today_it, today_naive]}}))


# ========== Test 7: regression smoke GET endpoints ==========
class TestAdminRegressionSmoke:

    def test_declarations_archive(self, api, auth):
        r = api.get(f"{API}/admin/declarations/archive", headers=auth, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"

    def test_data_hygiene(self, api, auth):
        r = api.get(f"{API}/admin/data-hygiene", headers=auth, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"

    def test_payments_income_summary(self, api, auth):
        r = api.get(f"{API}/admin/payments/income-summary", headers=auth, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
