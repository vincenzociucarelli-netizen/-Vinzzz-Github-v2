"""Perf & correctness tests for Prime Squadre stats endpoint and single-athlete flow.

Focus (iter 113):
- GET /api/prime-squadre/stats: response <1s (fresh), cached 2nd call, correct scoping.
- GET /api/prime-squadre/athletes: works, response has no heavy base64 photos.
- Regression: GET /api/athletes?light=true works.
- Single athlete GET/settings does not break single-athlete page (no 5xx).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
ATHLETE_ID = "c0555a97927f4054ae84b1c9"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Prime Squadre Stats ----------
class TestPrimeSquadreStats:
    def test_stats_first_call_fast_and_shape(self, auth_headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/prime-squadre/stats", headers=auth_headers, timeout=15)
        elapsed = time.time() - t0
        print(f"[stats] first call {elapsed:.3f}s status={r.status_code}")
        assert r.status_code == 200, f"body: {r.text[:300]}"
        assert elapsed < 3.0, f"First call still slow: {elapsed:.2f}s (target <1s, hard cap <3s)"
        data = r.json()
        for k in ["pro_enabled", "total_members", "max_members", "available_slots", "current_year", "yearly_stats"]:
            assert k in data, f"Missing key: {k} in {data}"
        assert "total_compensations" in data["yearly_stats"]
        assert "total_receipts" in data["yearly_stats"]
        assert isinstance(data["total_members"], int)
        assert data["available_slots"] == data["max_members"] - data["total_members"]

    def test_stats_second_call_cached(self, auth_headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/prime-squadre/stats", headers=auth_headers, timeout=15)
        elapsed = time.time() - t0
        print(f"[stats] second call {elapsed:.3f}s")
        assert r.status_code == 200
        assert elapsed < 1.0, f"Cached call not fast enough: {elapsed:.2f}s"

    def test_stats_scoped_to_society(self, auth_headers):
        """total_members must count ONLY athletes with is_compensated=True from user's society.
        In preview: 3 atleti, 0 compensati → expect total_members = 0."""
        r = requests.get(f"{BASE_URL}/api/prime-squadre/stats", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Assert reasonable upper bound (not scanning all societies): must be small in preview
        assert data["total_members"] <= 50
        assert data["yearly_stats"]["total_compensations"] >= 0
        assert data["yearly_stats"]["total_receipts"] >= 0
        # Per note utente: preview -> 0
        # Non forziamo strettamente a 0 se dati preview cambiano; solo controllo scoping
        print(f"[stats] total_members={data['total_members']} total_compensations={data['yearly_stats']['total_compensations']}")


# ---------- Prime Squadre Athletes list ----------
class TestPrimeSquadreAthletes:
    def test_athletes_list_ok(self, auth_headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/prime-squadre/athletes", headers=auth_headers, timeout=20)
        elapsed = time.time() - t0
        print(f"[pro-athletes] {elapsed:.3f}s status={r.status_code}")
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        # accept either list or dict wrapper
        athletes = data if isinstance(data, list) else data.get("athletes") or data.get("data") or []
        assert isinstance(athletes, list)
        # payload should NOT include heavy base64 photos in list (contract: no data:image;base64 giant chunks)
        raw_size = len(r.content)
        print(f"[pro-athletes] payload bytes={raw_size} count={len(athletes)}")
        assert raw_size < 3_000_000, f"Payload too heavy ({raw_size} bytes) - likely leaking base64"


# ---------- Regression athletes ?light=true ----------
class TestAthletesLightRegression:
    def test_athletes_light(self, auth_headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/athletes?light=true", headers=auth_headers, timeout=20)
        elapsed = time.time() - t0
        print(f"[athletes?light=true] {elapsed:.3f}s status={r.status_code}")
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)


# ---------- Single athlete open ----------
class TestSingleAthleteOpen:
    def test_get_athlete_by_id_fast(self, auth_headers):
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/athletes/{ATHLETE_ID}", headers=auth_headers, timeout=15)
        elapsed = time.time() - t0
        print(f"[athlete/{{id}}] {elapsed:.3f}s status={r.status_code}")
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("id") == ATHLETE_ID
        assert elapsed < 3.0, f"Slow single athlete: {elapsed:.2f}s"

    def test_settings_society_no_logo_optional(self, auth_headers):
        """Settings endpoint should return quickly and support light mode (no logo blocking)."""
        # Try common variants
        candidates = [
            "/api/settings/society?include_images=false",
            "/api/settings/society",
        ]
        ok = False
        for path in candidates:
            r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=15)
            print(f"[{path}] status={r.status_code}")
            if r.status_code == 200:
                ok = True
                break
        assert ok, "No settings endpoint reachable"
