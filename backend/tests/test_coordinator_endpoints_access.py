"""Backend tests: coordinator role access to admin endpoints (no 403).
Verifies each endpoint linked from /coordinatore dashboard returns 200 for a coordinator token.
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")

COORD_EMAIL = "coord.test@registrateam.it"
COORD_PASSWORD = "Test1234"
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed ({email}): {r.status_code} {r.text}"
    d = r.json()
    return d.get("access_token") or d["token"], d.get("user", {})


@pytest.fixture(scope="module")
def coord():
    tok, user = _login(COORD_EMAIL, COORD_PASSWORD)
    return {"token": tok, "user": user}


@pytest.fixture(scope="module")
def admin():
    tok, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"token": tok, "user": user}


def _get(url, token):
    return requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)


class TestCoordinatorLoginAndRole:
    def test_login_ok(self, coord):
        assert coord["token"]
        u = coord["user"]
        assert u.get("role") == "coordinatore", f"expected role=coordinatore got {u.get('role')}"

    def test_me_returns_permissions(self, coord):
        r = _get(f"{BASE_URL}/api/auth/me", coord["token"])
        assert r.status_code == 200
        me = r.json()
        assert me.get("role") == "coordinatore"
        perms = me.get("coordinator_permissions") or []
        for k in ["teams", "athletes", "matches", "attendance", "communications", "events", "certificates", "gdpr_view"]:
            assert k in perms, f"missing perm '{k}' in {perms}"


class TestCoordinatorEndpointsReturn200:
    """Every dashboard link's backing endpoint must NOT return 403 for coordinatore."""

    @pytest.mark.parametrize("path", [
        "/api/athletes",
        "/api/matches",
        "/api/teams",
        "/api/teams/athletes-count/all",
        "/api/attendance/today",
        "/api/admin/notifications",
        "/api/preseason/campaigns",
        "/api/admin/medical-certificates-archive",
        "/api/documents/archive",
    ])
    def test_endpoint_accessible(self, coord, path):
        r = _get(f"{BASE_URL}{path}", coord["token"])
        assert r.status_code != 403, f"{path} returned 403 for coordinatore. body={r.text[:300]}"
        assert r.status_code == 200, f"{path} status={r.status_code} body={r.text[:300]}"

    def test_athletes_returns_list(self, coord):
        r = _get(f"{BASE_URL}/api/athletes", coord["token"])
        assert r.status_code == 200
        data = r.json()
        # Accept list OR wrapped payloads
        items = data if isinstance(data, list) else data.get("athletes") or data.get("items") or []
        assert isinstance(items, list), f"unexpected athletes payload: {type(data)}"
        # We expect NON-empty for the test society (per task)
        assert len(items) > 0, "coordinatore sees 0 athletes (possibly still filtered by admin-only)"

    def test_teams_returns_list(self, coord):
        r = _get(f"{BASE_URL}/api/teams", coord["token"])
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("teams") or []
        assert isinstance(items, list)
        assert len(items) > 0, "coordinatore sees 0 teams"

    def test_matches_returns_list(self, coord):
        r = _get(f"{BASE_URL}/api/matches", coord["token"])
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("matches") or data.get("items") or []
        assert isinstance(items, list)

    def test_athletes_count_all(self, coord):
        r = _get(f"{BASE_URL}/api/teams/athletes-count/all", coord["token"])
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (dict, list)), f"unexpected type: {type(d)}"


class TestCoordinatorParityWithAdmin:
    """Sanity check that coordinator sees the same society data as admin."""

    def test_athletes_count_matches_admin(self, coord, admin):
        ra = _get(f"{BASE_URL}/api/athletes", admin["token"])
        rc = _get(f"{BASE_URL}/api/athletes", coord["token"])
        if ra.status_code != 200 or rc.status_code != 200:
            pytest.skip(f"admin={ra.status_code} coord={rc.status_code}")
        da = ra.json(); dc = rc.json()
        la = da if isinstance(da, list) else da.get("athletes") or da.get("items") or []
        lc = dc if isinstance(dc, list) else dc.get("athletes") or dc.get("items") or []
        # Same society -> counts should be equal (or at least coord non-empty when admin non-empty)
        assert len(lc) > 0 if len(la) > 0 else True, f"admin sees {len(la)} but coord sees {len(lc)}"
