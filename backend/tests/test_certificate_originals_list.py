"""Tests for the Certificate Originals list feature (Copie Originali Certificati).

Endpoints under test:
- GET  /api/admin/athletes/certificate-originals  (admin/coordinator only)
- PATCH /api/admin/athletes/{id}/certificate-original

Reflection assertions: after PATCH, the athlete must move from pending -> received
and vice-versa in the GET list.
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"

# Non-admin credentials to verify RBAC (403)
COACH_EMAIL = "alice@test.com"
COACH_PASSWORD = "Test1234"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def coach_token():
    try:
        return _login(COACH_EMAIL, COACH_PASSWORD)
    except AssertionError:
        pytest.skip("Coach credentials not available")


# ---------------- GET list ----------------
class TestCertificateOriginalsList:
    def test_list_shape_and_counts(self, admin_token):
        r = requests.get(
            f"{API}/admin/athletes/certificate-originals",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["total", "received_count", "pending_count", "athletes"]).issubset(data.keys())
        assert isinstance(data["athletes"], list)
        assert data["total"] == data["received_count"] + data["pending_count"]
        assert data["total"] == len(data["athletes"])
        if data["athletes"]:
            row = data["athletes"][0]
            for k in ["id", "full_name", "team_name", "original_received",
                      "certificate_verified", "has_certificate"]:
                assert k in row, f"missing field {k} in row"

    def test_non_admin_forbidden(self, coach_token):
        r = requests.get(
            f"{API}/admin/athletes/certificate-originals",
            headers={"Authorization": f"Bearer {coach_token}"}, timeout=15
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ---------------- PATCH reflection ----------------
class TestPatchReflectsInList:
    """PATCH should update the athlete then be reflected in the GET list."""

    def test_toggle_moves_between_groups(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/admin/athletes/certificate-originals", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        if not data["athletes"]:
            pytest.skip("No athletes in preview environment")

        # Pick any athlete - remember initial state to restore afterward
        target = data["athletes"][0]
        athlete_id = target["id"]
        initial_state = target["original_received"]
        toggled_state = not initial_state

        try:
            # PATCH -> toggled_state
            r2 = requests.patch(
                f"{API}/admin/athletes/{athlete_id}/certificate-original",
                headers=headers, json={"original_received": toggled_state}, timeout=15
            )
            assert r2.status_code == 200, r2.text
            body = r2.json()
            assert body["medical_certificate_original_received"] is toggled_state

            # GET again and verify state was reflected
            r3 = requests.get(f"{API}/admin/athletes/certificate-originals", headers=headers, timeout=15)
            assert r3.status_code == 200
            data2 = r3.json()
            row = next((a for a in data2["athletes"] if a["id"] == athlete_id), None)
            assert row is not None, "athlete disappeared from list"
            assert row["original_received"] is toggled_state, "state not reflected in GET after PATCH"

            # Sanity: counts consistent
            assert data2["total"] == data2["received_count"] + data2["pending_count"]
        finally:
            # Restore original state to keep environment clean
            requests.patch(
                f"{API}/admin/athletes/{athlete_id}/certificate-original",
                headers=headers, json={"original_received": initial_state}, timeout=15
            )

    def test_all_athletes_restored_to_pending(self, admin_token):
        """Ensure the preview env is clean (all original_received=false) per test brief."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/admin/athletes/certificate-originals", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Reset any athlete that ended up received (safety net)
        for a in data["athletes"]:
            if a["original_received"]:
                requests.patch(
                    f"{API}/admin/athletes/{a['id']}/certificate-original",
                    headers=headers, json={"original_received": False}, timeout=15
                )
        r2 = requests.get(f"{API}/admin/athletes/certificate-originals", headers=headers, timeout=15)
        data2 = r2.json()
        assert data2["received_count"] == 0
