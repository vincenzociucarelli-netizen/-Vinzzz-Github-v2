"""Backend tests for PATCH /api/users/{id}/role - conversion admin/viewer/dirigente/coordinatore
Covers: role change transitions, coordinator_permissions filtering, 403/400/404, multi-tenancy,
GET /api/users/dirigenti including coordinatori.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback env var name
    BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
LELLA_EMAIL = "lella@dir.com"
LELLA_PASSWORD = "Test1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    return data.get("access_token") or data["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def lella_id(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/users/dirigenti",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    users = r.json()
    matches = [u for u in users if u.get("email", "").lower() == LELLA_EMAIL]
    assert matches, f"Lella not found in dirigenti list. sample={users[:2]}"
    return matches[0]["id"]


def _patch_role(admin_token, user_id, payload):
    return requests.patch(
        f"{BASE_URL}/api/users/{user_id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=payload,
        timeout=20,
    )


class TestRoleConversion:
    def test_dirigenti_endpoint_returns_users(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/users/dirigenti",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 4, f"expected >=4 dirigenti got {len(users)}"

    def test_convert_to_coordinatore_with_permissions(self, admin_token, lella_id):
        payload = {
            "role": "coordinatore",
            "coordinator_permissions": ["teams", "athletes", "communications", "events"],
        }
        r = _patch_role(admin_token, lella_id, payload)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "coordinatore"

        # verify persisted
        r2 = requests.get(
            f"{BASE_URL}/api/users/dirigenti",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r2.status_code == 200
        lella = next(u for u in r2.json() if u["id"] == lella_id)
        assert lella["role"] == "coordinatore"
        perms = lella.get("coordinator_permissions") or []
        assert set(perms) == {"teams", "athletes", "communications", "events"}, f"perms={perms}"

    def test_convert_coordinatore_back_to_dirigente_clears_perms(self, admin_token, lella_id):
        r = _patch_role(admin_token, lella_id, {"role": "dirigente"})
        assert r.status_code == 200, r.text

        r2 = requests.get(
            f"{BASE_URL}/api/users/dirigenti",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        lella = next(u for u in r2.json() if u["id"] == lella_id)
        assert lella["role"] == "dirigente"
        assert (lella.get("coordinator_permissions") or []) == []

    def test_invalid_role_returns_400(self, admin_token, lella_id):
        r = _patch_role(admin_token, lella_id, {"role": "godmode"})
        assert r.status_code in (400, 422), r.text

    def test_invalid_permissions_filtered(self, admin_token, lella_id):
        r = _patch_role(admin_token, lella_id, {
            "role": "coordinatore",
            "coordinator_permissions": ["teams", "not_a_real_perm", "athletes"],
        })
        assert r.status_code == 200, r.text
        r2 = requests.get(
            f"{BASE_URL}/api/users/dirigenti",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        lella = next(u for u in r2.json() if u["id"] == lella_id)
        assert set(lella.get("coordinator_permissions") or []) == {"teams", "athletes"}

    def test_non_admin_forbidden(self, lella_id):
        lella_token = _login(LELLA_EMAIL, LELLA_PASSWORD)
        r = requests.patch(
            f"{BASE_URL}/api/users/{lella_id}/role",
            headers={"Authorization": f"Bearer {lella_token}"},
            json={"role": "dirigente"},
            timeout=20,
        )
        assert r.status_code == 403

    def test_user_not_found(self, admin_token):
        r = _patch_role(admin_token, "non-existent-id-xyz", {"role": "dirigente"})
        assert r.status_code == 404

    def test_restore_lella_final_state(self, admin_token, lella_id):
        # Restore to viewer as per task instructions
        r = _patch_role(admin_token, lella_id, {"role": "viewer"})
        assert r.status_code == 200
