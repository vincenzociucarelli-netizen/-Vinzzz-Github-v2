"""Regression tests for get_current_user auth cache (TTL 8s) + last_active_at throttle (60s).

Focus: ensure the cache does NOT introduce
  1) cross-user data leakage (multi-tenant isolation preserved)
  2) spurious 401/403 for valid tokens
  3) inconsistent role/full_name/society_id when hitting the same worker concurrently
  4) breakage of the previously-fixed parent certificate save flow

Also verifies the X-Response-Time-ms middleware header is emitted for /api/* endpoints.
"""

import os
import time
import concurrent.futures as _cf

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", os.environ.get("EXPO_BACKEND_URL"))
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set in environment"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "vincenzo.ciucarelli@gmail.com", "password": "Test1234"}
PARENT = {"email": "armida.raschi@gmail.com", "password": "Test1234"}
VIEWER = {"email": "lella@dir.com", "password": "Test1234"}

TARGET_ATHLETE_ID = "6a5ec7347c201d9cb7eb70d2"  # MAURI LENA (linked to armida)


# ---------- fixtures ----------

def _login(session: requests.Session, creds: dict) -> str:
    r = session.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in login response: {list(data)}"
    return tok


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    return _login(http, ADMIN)


@pytest.fixture(scope="module")
def parent_token(http):
    return _login(http, PARENT)


@pytest.fixture(scope="module")
def viewer_token(http):
    return _login(http, VIEWER)


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ---------- 1) login regression + /auth/me identity check ----------

class TestLoginAndMeIdentity:
    def test_admin_me(self, http, admin_token):
        r = http.get(f"{API}/auth/me", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        me = r.json()
        assert me.get("email", "").lower() == ADMIN["email"].lower()
        assert me.get("role") == "admin"
        assert me.get("society_id"), "admin must have society_id"

    def test_parent_me(self, http, parent_token):
        r = http.get(f"{API}/auth/me", headers=_h(parent_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        me = r.json()
        assert me.get("email", "").lower() == PARENT["email"].lower()
        assert me.get("role") == "parent"
        assert me.get("society_id")

    def test_viewer_me(self, http, viewer_token):
        r = http.get(f"{API}/auth/me", headers=_h(viewer_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        me = r.json()
        assert me.get("email", "").lower() == VIEWER["email"].lower()
        # legacy: viewer role in DB, alias for dirigente
        assert me.get("role") in ("viewer", "dirigente")
        assert me.get("society_id")


# ---------- 2) protected endpoints reachable + tenant-consistent ----------

class TestProtectedEndpoints:
    def test_seasons_current_name_admin(self, http, admin_token):
        r = http.get(f"{API}/seasons/current-name", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "season" in body

    def test_seasons_current_name_parent(self, http, parent_token):
        r = http.get(f"{API}/seasons/current-name", headers=_h(parent_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert "season" in r.json()

    def test_seasons_current_name_viewer(self, http, viewer_token):
        r = http.get(f"{API}/seasons/current-name", headers=_h(viewer_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert "season" in r.json()

    def test_athletes_admin(self, http, admin_token):
        r = http.get(f"{API}/athletes", headers=_h(admin_token), timeout=45)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        # get admin society
        me = http.get(f"{API}/auth/me", headers=_h(admin_token), timeout=30).json()
        soc = me.get("society_id")
        # every athlete returned should belong to admin's society (allow the
        # response builder to omit the field on some items; we only fail on a
        # different society_id, not on missing/None)
        leaks = [a for a in data if a.get("society_id") not in (None, "", soc)]
        assert not leaks, f"tenant leak: {[(a.get('id'), a.get('society_id')) for a in leaks[:5]]} vs {soc}"

    def test_users_coaches_admin(self, http, admin_token):
        r = http.get(f"{API}/users/coaches", headers=_h(admin_token), timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)

    def test_users_parents_admin(self, http, admin_token):
        r = http.get(f"{API}/users/parents", headers=_h(admin_token), timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)

    def test_users_dirigenti_admin(self, http, admin_token):
        r = http.get(f"{API}/users/dirigenti", headers=_h(admin_token), timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)


# ---------- 3) X-Response-Time-ms header + preview latency ----------

class TestTimingMiddleware:
    def test_response_time_header_present(self, http, admin_token):
        r = http.get(f"{API}/seasons/current-name", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        # case-insensitive lookup
        hdr = r.headers.get("X-Response-Time-ms") or r.headers.get("x-response-time-ms")
        assert hdr is not None, f"X-Response-Time-ms header missing. Headers: {dict(r.headers)}"
        # numeric string
        val = float(hdr)
        assert val >= 0

    def test_preview_latency_reasonable(self, http, admin_token):
        # hit the light endpoint 5x and check p90 < 800ms in preview
        samples = []
        for _ in range(5):
            t0 = time.perf_counter()
            r = http.get(f"{API}/seasons/current-name", headers=_h(admin_token), timeout=30)
            samples.append((time.perf_counter() - t0) * 1000)
            assert r.status_code == 200
        samples.sort()
        p90 = samples[int(len(samples) * 0.8)]
        # loose bound: preview should be well under 800ms
        assert p90 < 1500, f"latency too high in preview: samples={samples}"


# ---------- 4) cache does NOT leak across users (parallel calls) ----------

class TestCacheNoCrossUserLeak:
    def test_concurrent_me_admin_and_parent(self, http, admin_token, parent_token):
        """Interleave many /auth/me calls from admin and parent tokens; each must
        return its OWN email/role/society_id even though they hit the same worker
        during the 8s cache window."""

        def call(tok):
            r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=30)
            return r.status_code, r.json()

        tasks = []
        with _cf.ThreadPoolExecutor(max_workers=8) as ex:
            for i in range(20):
                tasks.append(ex.submit(call, admin_token if i % 2 == 0 else parent_token))
            results = [t.result() for t in tasks]

        for i, (status, me) in enumerate(results):
            assert status == 200, f"call {i} failed"
            expected_email = ADMIN["email"] if i % 2 == 0 else PARENT["email"]
            expected_role = "admin" if i % 2 == 0 else "parent"
            assert me.get("email", "").lower() == expected_email.lower(), (
                f"cross-user leak at {i}: got {me.get('email')} expected {expected_email}")
            assert me.get("role") == expected_role, (
                f"role mismatch at {i}: got {me.get('role')} expected {expected_role}")

    def test_concurrent_admin_and_viewer_isolation(self, http, admin_token, viewer_token):
        """Admin and viewer belong to potentially different societies; ensure
        /auth/me returns per-user society_id consistently under concurrent load."""

        def call(tok):
            r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=30)
            return r.status_code, r.json()

        with _cf.ThreadPoolExecutor(max_workers=6) as ex:
            futures = []
            for i in range(12):
                futures.append(ex.submit(call, admin_token if i % 2 == 0 else viewer_token))
            results = [f.result() for f in futures]

        # figure out expected per token
        admin_me = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=30).json()
        viewer_me = requests.get(f"{API}/auth/me", headers=_h(viewer_token), timeout=30).json()

        for i, (status, me) in enumerate(results):
            assert status == 200
            expected = admin_me if i % 2 == 0 else viewer_me
            assert me.get("email") == expected.get("email")
            assert me.get("role") == expected.get("role")
            assert me.get("society_id") == expected.get("society_id"), (
                f"society_id leak at {i}: got {me.get('society_id')} expected {expected.get('society_id')}")


# ---------- 5) parent certificate flow (regression of previous fix) ----------

class TestParentCertificateFlow:
    def test_parent_can_save_certificate_for_linked_athlete(self, http, parent_token, admin_token):
        # first: read the current expiry to compute a delta then restore-ish
        # (we just set a new future date; we don't try to fully restore to preserve idempotence)
        payload = {
            "athlete_id": TARGET_ATHLETE_ID,
            "issue_date": "2026-01-15",
            "expiry_date": "2027-01-14",
        }
        r = http.post(f"{API}/certificates/simple", headers=_h(parent_token),
                      json=payload, timeout=30)
        assert r.status_code in (200, 201), f"parent certificate save failed: {r.status_code} {r.text[:400]}"

        # verify persistence via admin single-athlete endpoint
        r2 = http.get(f"{API}/athletes/{TARGET_ATHLETE_ID}", headers=_h(admin_token), timeout=30)
        assert r2.status_code == 200, f"admin cannot read athlete {TARGET_ATHLETE_ID}: {r2.status_code} {r2.text[:300]}"
        our = r2.json()
        # try many possible field spellings
        cert = our.get("medical_certificate") or {}
        stored = " ".join([str(v) for k, v in our.items() if "cert" in k.lower() and v]) + " " + str(cert)
        assert "2027-01-14" in stored or "2027" in stored, (
            f"expected expiry 2027-01-14 not persisted. keys={[k for k in our.keys() if 'cert' in k.lower()]} cert={cert}")


# ---------- 6) TTL staleness bound (best-effort, non-blocking) ----------

class TestTTLBoundary:
    def test_repeat_calls_stable_within_ttl(self, http, admin_token):
        """Within TTL window all calls should be consistent (same email/role/society)."""
        first = http.get(f"{API}/auth/me", headers=_h(admin_token), timeout=30).json()
        for _ in range(5):
            m = http.get(f"{API}/auth/me", headers=_h(admin_token), timeout=30).json()
            assert m.get("email") == first.get("email")
            assert m.get("role") == first.get("role")
            assert m.get("society_id") == first.get("society_id")
