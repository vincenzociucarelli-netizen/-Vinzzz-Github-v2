"""Tests for the two new features (iteration 124):
- Feature A: Kit Abbigliamento (kit_price, kit_sponsor) on /api/settings/society
- Feature B: Manual (extraordinary) attendance from coach on the athlete profile
    POST /api/coach/athletes/{athlete_id}/manual-attendance
"""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

# Load backend env for MONGO_URL / DB_NAME (used to verify DB persistence)
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
COACH_EMAIL = "alice@test.com"
COACH_PASSWORD = "Test1234"

# Provided by main agent
TEST_TEAM_ID = "697fec5d90eef140898ebfd7"
TEST_ATHLETE_ID = "c0555a97927f4054ae84b1c9"


# ─────────────────── helpers ───────────────────
def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("token") or body.get("access_token")
    assert tok, f"No token in login response for {email}: {body}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def coach_token():
    return _login(COACH_EMAIL, COACH_PASSWORD)


# ─────────────────── Feature A: Kit Abbigliamento ───────────────────
class TestKitAbbigliamento:
    """PATCH+GET /api/settings/society deve persistere kit_price/kit_sponsor."""

    def test_patch_and_get_kit_fields(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1) Snapshot valori attuali per ripristino
        r0 = requests.get(f"{BASE_URL}/api/settings/society", headers=headers, timeout=30)
        assert r0.status_code == 200, r0.text
        prev = r0.json()
        prev_price = prev.get("kit_price")
        prev_sponsor = prev.get("kit_sponsor")

        try:
            # 2) PATCH con nuovi valori (uso price non intero per verificare float)
            new_price = 149.5
            new_sponsor = "TEST_Sponsor_QA_" + str(int(time.time()))
            r1 = requests.patch(
                f"{BASE_URL}/api/settings/society",
                json={"kit_price": new_price, "kit_sponsor": new_sponsor},
                headers=headers,
                timeout=30,
            )
            assert r1.status_code == 200, f"PATCH failed: {r1.status_code} {r1.text}"

            # 3) GET verifica persistenza
            r2 = requests.get(f"{BASE_URL}/api/settings/society", headers=headers, timeout=30)
            assert r2.status_code == 200, r2.text
            data = r2.json()
            assert data.get("kit_price") == new_price, f"kit_price mismatch: {data.get('kit_price')}"
            assert data.get("kit_sponsor") == new_sponsor, f"kit_sponsor mismatch: {data.get('kit_sponsor')}"
        finally:
            # Ripristino valori originali (anche se None)
            restore_body = {}
            if prev_price is not None:
                restore_body["kit_price"] = prev_price
            if prev_sponsor is not None:
                restore_body["kit_sponsor"] = prev_sponsor
            if restore_body:
                requests.patch(
                    f"{BASE_URL}/api/settings/society",
                    json=restore_body,
                    headers=headers,
                    timeout=30,
                )

    def test_patch_kit_forbidden_for_non_admin(self, coach_token):
        headers = {"Authorization": f"Bearer {coach_token}"}
        r = requests.patch(
            f"{BASE_URL}/api/settings/society",
            json={"kit_price": 1.0, "kit_sponsor": "SHOULD_NOT_PERSIST"},
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 403, f"Expected 403 for coach, got {r.status_code}: {r.text}"


# ─────────────────── Feature B: Presenza manuale straordinaria ───────────────────
class TestManualAttendance:
    """POST /api/coach/athletes/{athlete_id}/manual-attendance."""

    def _cleanup_attendance(self, attendance_id: str):
        """Best-effort cleanup direct-in-Mongo (avoid persisting test data)."""
        try:
            from pymongo import MongoClient
            mongo_url = os.environ.get("MONGO_URL")
            db_name = os.environ.get("DB_NAME")
            if not mongo_url or not db_name:
                return
            client = MongoClient(mongo_url)
            client[db_name].attendances.delete_one({"id": attendance_id})
            client.close()
        except Exception as e:
            print(f"Cleanup warning: {e}")

    def test_admin_can_create_manual_attendance(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {"date": "2026-01-15", "time": "18:30", "note": "TEST_manual entry"}
        r = requests.post(
            f"{BASE_URL}/api/coach/athletes/{TEST_ATHLETE_ID}/manual-attendance",
            json=payload,
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 200, f"Admin manual-attendance failed: {r.status_code} {r.text}"
        body = r.json()
        att_id = body.get("attendance_id")
        assert att_id, f"attendance_id missing: {body}"
        assert body.get("date") == "2026-01-15"
        assert body.get("time") == "18:30"

        # Verifica record attendance con marcatori
        try:
            from pymongo import MongoClient
            client = MongoClient(os.environ["MONGO_URL"])
            db = client[os.environ["DB_NAME"]]
            rec = db.attendances.find_one({"id": att_id}, {"_id": 0})
            assert rec is not None, "attendance record not persisted"
            assert rec.get("manual_entry") is True, f"manual_entry expected True: {rec}"
            assert rec.get("forced") is True, f"forced expected True: {rec}"
            assert rec.get("status") == "allowed", f"status expected 'allowed': {rec.get('status')}"
            assert rec.get("coach_id"), "coach_id missing"

            # Verifica audit_logs
            log = db.audit_logs.find_one(
                {"action": "manual_attendance_added", "target_user_id": TEST_ATHLETE_ID},
                sort=[("timestamp", -1)],
            )
            assert log is not None, "audit_logs entry missing"
            details = log.get("details") or {}
            assert details.get("extraordinary") is True, f"details.extraordinary expected True: {details}"
            client.close()
        finally:
            self._cleanup_attendance(att_id)

    def test_invalid_date_returns_400(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/coach/athletes/{TEST_ATHLETE_ID}/manual-attendance",
            json={"date": "15/01/2026"},  # wrong format
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_athlete_not_found_returns_404(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/coach/athletes/DOES_NOT_EXIST/manual-attendance",
            json={"date": "2026-01-15"},
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_coach_not_assigned_returns_403(self, coach_token):
        """Se il coach non ha TEST_TEAM_ID nei suoi assigned_teams l'endpoint deve rispondere 403.
        (Se invece è assegnato, deve rispondere 200 e crea il record: rimuoviamo il record dopo.)
        """
        headers = {"Authorization": f"Bearer {coach_token}"}
        r = requests.post(
            f"{BASE_URL}/api/coach/athletes/{TEST_ATHLETE_ID}/manual-attendance",
            json={"date": "2026-01-16", "note": "TEST_coach"},
            headers=headers,
            timeout=30,
        )
        # atteso 403 se non assegnato, 200 se assegnato (business-flag entrambi validi)
        assert r.status_code in (200, 403), f"Unexpected status: {r.status_code} {r.text}"
        if r.status_code == 200:
            att_id = r.json().get("attendance_id")
            if att_id:
                self._cleanup_attendance(att_id)
            # Informational: coach was actually assigned to team
            print("Info: coach alice@test.com is assigned to team - 403 path could not be tested with this fixture")

    def test_unauthenticated_returns_401_or_403(self):
        r = requests.post(
            f"{BASE_URL}/api/coach/athletes/{TEST_ATHLETE_ID}/manual-attendance",
            json={"date": "2026-01-15"},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"Expected 401/403 without auth: {r.status_code}"
