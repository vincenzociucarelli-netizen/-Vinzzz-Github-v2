"""Tests for GET /api/admin/athletes/export-data (Ricerca Atleti export flow)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
COACH_EMAIL = "alice@test.com"
COACH_PASSWORD = "Test1234"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASSWORD)}"}


@pytest.fixture(scope="module")
def coach_headers():
    try:
        return {"Authorization": f"Bearer {_login(COACH_EMAIL, COACH_PASSWORD)}"}
    except AssertionError:
        pytest.skip("Coach account not available")


class TestAdminAthletesExportData:
    def test_export_admin_success_and_shape(self, admin_headers):
        r = requests.get(f"{API}/admin/athletes/export-data", headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "fields" in data and "rows" in data
        assert isinstance(data["fields"], list) and isinstance(data["rows"], list)
        # 27 fields expected
        assert len(data["fields"]) == 27, f"Expected 27 fields, got {len(data['fields'])}"
        # Field shape: key/label/group
        keys = set()
        groups = set()
        for f in data["fields"]:
            assert set(["key", "label", "group"]).issubset(f.keys())
            keys.add(f["key"])
            groups.add(f["group"])
        # Required core fields
        for req_key in ["last_name", "first_name", "date_of_birth", "team_name",
                        "fiscal_code", "email", "athlete_role", "medical_certificate_expiry",
                        "is_registered", "medical_certificate_verified"]:
            assert req_key in keys, f"Missing key {req_key}"
        # Groups
        for g in ["Anagrafica", "Contatti", "Residenza", "Sportivo", "Stato", "Certificato"]:
            assert g in groups, f"Missing group {g}"

    def test_export_rows_structure_and_formatting(self, admin_headers):
        r = requests.get(f"{API}/admin/athletes/export-data", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        data = r.json()
        rows = data["rows"]
        assert len(rows) > 0, "Expected at least 1 athlete row (3 in preview)"
        for row in rows:
            assert "id" in row and "values" in row
            # team_id key may be present (even if null)
            v = row["values"]
            # date_of_birth: either empty or dd/mm/yyyy
            dob = v.get("date_of_birth", "")
            if dob:
                assert len(dob) == 10 and dob[2] == "/" and dob[5] == "/", f"Bad date format: {dob}"
            # booleans formatted Sì/No
            assert v.get("is_registered") in ("Sì", "No", ""), f"is_registered={v.get('is_registered')}"
            assert v.get("medical_certificate_verified") in ("Sì", "No", ""), v.get("medical_certificate_verified")
            assert v.get("medical_certificate_original_received") in ("Sì", "No", ""), v.get("medical_certificate_original_received")

    def test_export_forbidden_for_coach(self, coach_headers):
        r = requests.get(f"{API}/admin/athletes/export-data", headers=coach_headers, timeout=30)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text[:200]}"

    def test_export_unauthenticated_rejected(self):
        r = requests.get(f"{API}/admin/athletes/export-data", timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
