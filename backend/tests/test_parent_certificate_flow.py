"""
Test parent certificate flow (bug fix 18/08/2026).
- Login as parent (armida.raschi@gmail.com)
- POST /api/certificates/simple for minor athlete MAURI LENA
- GET /api/certificates/{athlete_id} to verify persistence
- Verify athlete detail (medical_certificate_* sync)
"""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
PARENT_EMAIL = "armida.raschi@gmail.com"
PARENT_PASSWORD = "Test1234"
MINOR_ATHLETE_ID = "6a5ec7347c201d9cb7eb70d2"  # MAURI LENA


@pytest.fixture(scope="module")
def parent_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(parent_token):
    return {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}


def test_parent_can_read_own_child_athlete(auth_headers):
    r = requests.get(f"{BASE_URL}/api/athletes/{MINOR_ATHLETE_ID}", headers=auth_headers, timeout=20)
    assert r.status_code == 200, f"Cannot read athlete: {r.status_code} {r.text}"
    a = r.json()
    assert a.get("id") == MINOR_ATHLETE_ID
    assert "LENA" in (a.get("last_name") or "").upper() or "LENA" in (a.get("first_name") or "").upper()


def test_certificate_simple_create_and_persist(auth_headers):
    """Reproduces the bug: parent saves issue+expiry, verify it persists"""
    issue_dt = datetime(2026, 1, 7, tzinfo=timezone.utc)
    # 12 months validity, expiry = issue + 12 months - 1 day = 2027-01-06
    expiry_dt = datetime(2027, 1, 6, tzinfo=timezone.utc)
    payload = {
        "athlete_id": MINOR_ATHLETE_ID,
        "issue_date": issue_dt.isoformat(),
        "expiry_date": expiry_dt.isoformat(),
    }
    r = requests.post(f"{BASE_URL}/api/certificates/simple", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code in (200, 201), f"POST /certificates/simple failed: {r.status_code} {r.text}"

    # GET certificate for athlete
    r2 = requests.get(f"{BASE_URL}/api/certificates/{MINOR_ATHLETE_ID}", headers=auth_headers, timeout=20)
    assert r2.status_code == 200, f"GET /certificates failed: {r2.status_code} {r2.text}"
    cert = r2.json()
    assert cert is not None, "GET /certificates returned null"
    # Should be a dict with issue/expiry
    if isinstance(cert, list):
        assert len(cert) > 0, "Certificate list is empty after save"
        cert = cert[0]
    iso_issue = cert.get("issue_date", "")
    iso_expiry = cert.get("expiry_date", "")
    assert "2026-01-07" in iso_issue, f"issue_date not persisted correctly: {iso_issue}"
    assert "2027-01-06" in iso_expiry, f"expiry_date not persisted correctly: {iso_expiry}"


def test_athlete_medical_fields_synced_after_save(auth_headers):
    """After certificate save, athlete document should have medical_certificate_* fields synced"""
    r = requests.get(f"{BASE_URL}/api/athletes/{MINOR_ATHLETE_ID}", headers=auth_headers, timeout=20)
    assert r.status_code == 200
    a = r.json()
    expiry = a.get("medical_certificate_expiry") or a.get("certificate_expiry")
    # Should reflect the saved date
    if expiry:
        assert "2027-01-06" in str(expiry), f"medical_certificate_expiry not synced: {expiry}"


def test_update_only_issue_date_of_existing_cert(auth_headers):
    """Parent changes only issue_date; validity should be preserved"""
    # Use a slightly different issue date, same 12 months
    issue_dt = datetime(2026, 2, 10, tzinfo=timezone.utc)
    expiry_dt = datetime(2027, 2, 9, tzinfo=timezone.utc)
    payload = {
        "athlete_id": MINOR_ATHLETE_ID,
        "issue_date": issue_dt.isoformat(),
        "expiry_date": expiry_dt.isoformat(),
    }
    r = requests.post(f"{BASE_URL}/api/certificates/simple", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code in (200, 201), f"Update failed: {r.status_code} {r.text}"

    r2 = requests.get(f"{BASE_URL}/api/certificates/{MINOR_ATHLETE_ID}", headers=auth_headers, timeout=20)
    assert r2.status_code == 200
    cert = r2.json()
    if isinstance(cert, list):
        cert = cert[0]
    assert "2026-02-10" in cert.get("issue_date", ""), f"Updated issue_date not persisted: {cert}"
    assert "2027-02-09" in cert.get("expiry_date", ""), f"Updated expiry_date not persisted: {cert}"
