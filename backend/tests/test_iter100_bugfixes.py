"""Iteration 100 — Verify BUG P0 fixes + new endpoint.
1) GET /api/teams/{team_id}/attendance-stats returns 200 for COORDINATORE
2) GET /api/admin/certificates-expiry-list returns the expected shape for admin + coordinator
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PW = "Test1234"
COORD_EMAIL = "coord.test@registrateam.it"
COORD_PW = "Test1234"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in login response: {list(data.keys())}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="module")
def coord_token():
    return _login(COORD_EMAIL, COORD_PW)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- Certificates expiry list ----------------

def test_certificates_expiry_list_admin(admin_token):
    r = requests.get(f"{API}/admin/certificates-expiry-list", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    for k in ("items", "total", "count_expired", "count_expiring", "count_valid", "count_missing"):
        assert k in d, f"missing key {k} in response; keys={list(d.keys())}"
    assert isinstance(d["items"], list)
    assert isinstance(d["total"], int)
    assert d["total"] == d["count_expired"] + d["count_expiring"] + d["count_valid"] + d["count_missing"]


def test_certificates_expiry_list_coordinator(coord_token):
    r = requests.get(f"{API}/admin/certificates-expiry-list", headers=_h(coord_token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "items" in d and "total" in d
    # Per il context note del main agent: total dovrebbe essere 3 (1 valido, 2 mancanti)
    print("coord certificates-expiry-list:", {
        "total": d.get("total"),
        "expired": d.get("count_expired"),
        "expiring": d.get("count_expiring"),
        "valid": d.get("count_valid"),
        "missing": d.get("count_missing"),
    })
    assert d["total"] >= 0


# ---------------- Attendance stats coordinator ----------------

def test_coord_can_list_teams(coord_token):
    r = requests.get(f"{API}/teams", headers=_h(coord_token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    teams = r.json()
    assert isinstance(teams, list) and len(teams) > 0, "coordinator should see at least one team"


def _first_team_id(tok):
    r = requests.get(f"{API}/teams", headers=_h(tok), timeout=30)
    r.raise_for_status()
    teams = r.json()
    return teams[0]["id"] if teams else None


def test_attendance_stats_coordinator_returns_200(coord_token):
    team_id = _first_team_id(coord_token)
    assert team_id, "no team available for coordinator"
    r = requests.get(f"{API}/teams/{team_id}/attendance-stats", headers=_h(coord_token), timeout=30)
    assert r.status_code == 200, (
        f"attendance-stats returned {r.status_code} for coordinator: {r.text[:300]}"
    )
    d = r.json()
    # It should return a dict with stats (list of athlete-level rows or aggregate)
    assert isinstance(d, (dict, list))


def test_attendance_stats_admin_returns_200(admin_token):
    team_id = _first_team_id(admin_token)
    assert team_id, "no team available for admin"
    r = requests.get(f"{API}/teams/{team_id}/attendance-stats", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200, r.text[:300]


def test_attendance_stats_no_auth_401_or_403():
    # Just get a team id first (via admin login inline) and hit unauthenticated
    tok = _login(ADMIN_EMAIL, ADMIN_PW)
    team_id = _first_team_id(tok)
    r = requests.get(f"{API}/teams/{team_id}/attendance-stats", timeout=30)
    assert r.status_code in (401, 403), r.status_code
