"""
Tests for the new endpoint:
GET /api/admin/persons/{user_id}/compensation-summary?year=Y

Reference: /app/backend/server.py @ /admin/persons/{user_id}/compensation-summary
- Quartili Settimanali (1w=25%, 2w=50%, 3w=75%, 4w=100%)
- 404 if person not found
- 403 if non-admin
- Resolves both user_id (coach) and athlete.id (atleta PRO)
- year optional (defaults to current year)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
           os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASS = "Test1234"

COACH_ID = "69adf7618a40c8115bda5c2d"   # Fede Rica
ATHLETE_ID = "6a251c6fd7734aedf9c18d94"  # TestAlice Debug


@pytest.fixture(scope="module")
def admin_token():
    assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"Login admin failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ============ Coach Fede Rica =====================================
def test_coach_compensation_summary_year_2026(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{COACH_ID}/compensation-summary",
        params={"year": 2026},
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    print("COACH 2026:", data)
    assert data["has_compensation"] is True
    assert data["year"] == 2026
    assert data["year_next"] == 2027
    # RAS = 17000 € (contratto 01/09/2025 - 30/06/2026, 1700 €/mese, intero contratto)
    assert data["ras_summary"]["grand_total"] == 17000.0, \
        f"ras_grand_total expected 17000, got {data['ras_summary']['grand_total']}"
    assert data["ras_summary"]["coach_total"] == 17000.0
    # Fiscal 2026 = 10200 € (gen-giu 2026 = 6 mesi pieni)
    assert data["fiscal_year_current"]["grand_total"] == 10200.0, \
        f"fiscal_year_current.grand_total expected 10200, got {data['fiscal_year_current']['grand_total']}"
    assert data["fiscal_year_current"]["coach_total"] == 10200.0
    assert data["fiscal_year_current"]["exceeds_5k"] is True


def test_coach_compensation_summary_year_2025(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{COACH_ID}/compensation-summary",
        params={"year": 2025},
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    print("COACH 2025:", data)
    # RAS should be unchanged (whole contract = 17000)
    assert data["ras_summary"]["grand_total"] == 17000.0
    # Fiscal 2025: settembre-dicembre 2025 = 4 mesi = 6800 € (coach_total)
    coach_2025 = data["fiscal_year_current"]["coach_total"]
    assert coach_2025 == 6800.0, f"Expected fiscal_year_current.coach_total 6800 for 2025, got {coach_2025}"
    assert coach_2025 != 10200.0
    # grand_total may include prior_compensation (is_first_year=True)
    assert data["fiscal_year_current"]["is_first_year"] is True


def test_compensation_summary_default_year(admin_headers):
    # Senza param year, deve usare anno corrente (2026 al tempo dei test)
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{COACH_ID}/compensation-summary",
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    # Anno corrente preso da datetime.now(timezone.utc).year
    from datetime import datetime, timezone
    expected_year = datetime.now(timezone.utc).year
    assert data["year"] == expected_year
    assert data["year_next"] == expected_year + 1


# ============ Athlete PRO TestAlice ==============================
def test_athlete_pro_compensation_summary(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{ATHLETE_ID}/compensation-summary",
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    print("ATHLETE:", data)
    assert data["has_compensation"] is True, f"Expected has_compensation=True for TestAlice, got {data}"
    # Person name contains TestAlice
    assert "TestAlice" in data.get("person_name", ""), data.get("person_name")
    # Athlete section deve esistere
    assert data.get("athlete_section") is not None


# ============ Error cases ========================================
def test_404_when_user_id_invalid(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/non_existent_id_xyz_123/compensation-summary",
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_403_when_non_admin():
    # Try multiple non-admin credentials
    for email, pwd in [("viola@test.com", "Test1234"), ("fabia@test.com", "Test123")]:
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": pwd},
            timeout=20,
        )
        if r.status_code == 200:
            token = r.json().get("access_token") or r.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            r2 = requests.get(
                f"{BASE_URL}/api/admin/persons/{COACH_ID}/compensation-summary",
                headers=headers,
                timeout=20,
            )
            assert r2.status_code in (403, 401), \
                f"Expected 403/401 for non-admin {email}, got {r2.status_code}: {r2.text[:200]}"
            return
    pytest.skip("Could not login any non-admin user")


def test_no_auth_returns_401(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{COACH_ID}/compensation-summary",
        timeout=20,
    )
    assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}"


# ============ Response shape verification ========================
def test_response_has_three_sections(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{COACH_ID}/compensation-summary?year=2026",
        headers=admin_headers,
        timeout=20,
    )
    assert r.status_code == 200
    data = r.json()
    for key in ("ras_summary", "fiscal_year_current", "fiscal_year_next"):
        assert key in data, f"Missing section {key}"
    # fiscal_year_next must be present even if grand_total==0 (frontend hides it)
    assert "grand_total" in data["fiscal_year_next"]
    assert "year" in data["fiscal_year_next"]
    assert data["fiscal_year_next"]["year"] == 2027
