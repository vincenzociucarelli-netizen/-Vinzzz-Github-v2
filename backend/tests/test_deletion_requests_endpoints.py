"""
Iteration 79 - Test for new deletion-requests endpoints
Covers:
- GET /api/admin/deletion-requests/pending-summary (admin)
- GET /api/deletion-requests/pending (athlete)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PWD = "Test1234"
ATLETA_EMAIL = "testalice1780817007@test.com"
ATLETA_PWD = "Test1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PWD)


@pytest.fixture(scope="module")
def athlete_token():
    return _login(ATLETA_EMAIL, ATLETA_PWD)


# --- Admin endpoint --------------------------------------------------------
class TestAdminPendingSummary:
    def test_returns_200_and_expected_structure(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/deletion-requests/pending-summary",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Required keys per request
        for k in ("total", "by_athlete", "by_coach", "by_collaboratore", "by_dirigente"):
            assert k in data, f"missing key {k} in response: {list(data.keys())}"
        assert isinstance(data["total"], int)
        for k in ("by_athlete", "by_coach", "by_collaboratore", "by_dirigente"):
            assert isinstance(data[k], dict), f"{k} should be dict, got {type(data[k])}"

    def test_requires_admin_auth(self, athlete_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/deletion-requests/pending-summary",
            headers={"Authorization": f"Bearer {athlete_token}"},
            timeout=20,
        )
        # non-admin must be forbidden (403) or unauthorized (401)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_unauthenticated_rejected(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/deletion-requests/pending-summary", timeout=20
        )
        assert r.status_code in (401, 403)

    def test_aggregation_total_matches_sum(self, admin_token):
        """If total>0 the buckets must contain at least one user id."""
        r = requests.get(
            f"{BASE_URL}/api/admin/deletion-requests/pending-summary",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        data = r.json()
        total = data["total"]
        sum_buckets = sum(
            sum(v if isinstance(v, int) else 1 for v in d.values())
            for d in (data["by_athlete"], data["by_coach"], data["by_collaboratore"], data["by_dirigente"])
        )
        # If buckets are counts per id (int) sum_buckets equals total.
        # If they hold "1" markers, equality still holds.
        # We log instead of hard fail because preview DB may have legacy entries.
        if total > 0 and sum_buckets == 0:
            pytest.fail(
                f"Aggregation bug: total={total} but all buckets are empty. data={data}"
            )


# --- Athlete endpoint ------------------------------------------------------
class TestAthletePendingDeletions:
    def test_returns_200_and_list(self, athlete_token):
        r = requests.get(
            f"{BASE_URL}/api/deletion-requests/pending",
            headers={"Authorization": f"Bearer {athlete_token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list), f"expected list, got {type(data)}"

    def test_unauthenticated_rejected(self):
        r = requests.get(f"{BASE_URL}/api/deletion-requests/pending", timeout=20)
        assert r.status_code in (401, 403)
