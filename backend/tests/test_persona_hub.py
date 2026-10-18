"""
Test per Step 1 refactor PERSONA: hub anagrafica unificata
Endpoint: GET /api/admin/persons/{user_id}/profile
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://zaino-coach-hub.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"

FEDE_RICA_USER_ID = "69adf7618a40c8115bda5c2d"          # Coach (single-role)
TEST_ALICE_ATHLETE_ID = "6a251c6fd7734aedf9c18d94"      # Athlete PRO


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# === GET /api/admin/persons/{user_id}/profile — coach Fede Rica (single-role coach) ===
class TestPersonProfileCoachFedeRica:
    def test_profile_fede_rica_coach(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/persons/{FEDE_RICA_USER_ID}/profile",
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get("has_coach_role") is True, f"has_coach_role expected True, got {data}"
        assert data.get("has_athlete_role") is False, f"has_athlete_role expected False, got {data}"
        assert data.get("is_dual_role") is False, f"is_dual_role expected False, got {data}"
        profile = data.get("profile", {})
        assert (profile.get("first_name") or "").upper() == "FEDE", profile
        assert (profile.get("last_name") or "").upper() == "RICA", profile
        assert profile.get("email") == "fede@coach.com", profile
        assert data.get("user_id") == FEDE_RICA_USER_ID

    def test_profile_unauth_returns_403_or_401(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/persons/{FEDE_RICA_USER_ID}/profile",
            timeout=15,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"

    def test_profile_nonexistent_returns_404(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/persons/000000000000000000000000/profile",
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"


# === GET /api/admin/persons/{athlete_id}/profile — TestAlice resolve by athlete_id ===
class TestPersonProfileTestAliceByAthleteId:
    def test_profile_resolves_from_athlete_id(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/persons/{TEST_ALICE_ATHLETE_ID}/profile",
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get("has_athlete_role") is True, f"expected has_athlete_role=True, got {data}"
        assert data.get("athlete_id") == TEST_ALICE_ATHLETE_ID, data


# === Regression: /api/admin/persons/{id}/compensation-summary still works ===
class TestCompensationSummaryRegression:
    def test_compensation_summary_fede_rica_still_works(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/persons/{FEDE_RICA_USER_ID}/compensation-summary",
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "coach_section" in data or "ras_summary" in data, data

    def test_compensation_summary_xlsx_export_society_still_works(self, admin_headers):
        # Society-level XLSX export (per-person export endpoint does not exist)
        r = requests.get(
            f"{BASE_URL}/api/admin/compensation-summary/export-xlsx",
            params={"start_date": "2025-09-01", "end_date": "2026-06-30"},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} body[:200]={r.content[:200]}"
        assert "spreadsheet" in r.headers.get("content-type", "") or r.content[:2] == b"PK", \
            f"expected XLSX, got content-type={r.headers.get('content-type')}"
