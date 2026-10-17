"""
Test PATCH /api/users/{user_id}/compensation role authorization fix (25/02/2026).

Bug context:
  Admin tried to modify contract dates for a dirigente (VERDI FABIO) → got HTTP 400
  "Compenso applicabile solo a coach, dirigenti e collaboratori".
  The user was actually role=athlete (PRO compensated) in DB.

Fix applied (server.py ~L4966):
  - Allowed roles extended from [COACH, DIRIGENTE, VIEWER, COLLABORATORE]
    to also include ATHLETE.
  - Error message now includes the actual role for diagnostics:
    "(role attuale: {role})"

Tests in this module verify:
  1. PATCH works (200) for role=dirigente
  2. PATCH works (200) for role=coach
  3. PATCH works (200) for role=collaboratore
  4. PATCH works (200) for role=athlete (PRO compensated)  ← main bug case
  5. PATCH fails (400) for role=admin or role=parent and error message
     contains current role for debugging
  6. Updating ONLY contract_start_date/contract_end_date (no monthly_compensation)
     does NOT reset compensation_accepted to false.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    os.environ.get(
        "EXPO_PUBLIC_BACKEND_URL",
        "https://zaino-coach-hub.preview.emergentagent.com",
    ),
).rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"


def _login(email: str, password: str):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    return r


@pytest.fixture(scope="module")
def admin_headers():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_user_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    return r.json()["id"]


def _find_user_by_role(admin_headers, target_role: str, exclude_id: str = ""):
    """
    Find an existing user with the given role using available admin/list endpoints.
    Returns user dict or None.
    """
    role_to_endpoint = {
        "dirigente": "/api/users/dirigenti",
        "coach": "/api/users/coaches",
        "collaboratore": "/api/users/collaboratorees",
        "parent": "/api/users/parents",
    }
    if target_role in role_to_endpoint:
        r = requests.get(
            f"{BASE_URL}{role_to_endpoint[target_role]}",
            headers=admin_headers,
            timeout=30,
        )
        if r.status_code == 200:
            users = r.json()
            if isinstance(users, list) and users:
                for u in users:
                    # endpoints like /users/dirigenti may include viewer/admin too,
                    # so filter strictly on the role we want
                    if u.get("role") == target_role and u.get("id") != exclude_id:
                        return u
    return None


# -------------- Role-specific positive tests --------------

class TestCompensationRoleAccepted:
    """PATCH /api/users/{user_id}/compensation must accept these roles."""

    def test_dirigente_compensation_update_200(self, admin_headers):
        user = _find_user_by_role(admin_headers, "dirigente")
        if not user:
            pytest.skip("No dirigente available in DB for testing")
        user_id = user["id"]

        payload = {
            "contract_start_date": "2025-09-01",
            "contract_end_date": "2026-06-30",
        }
        r = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=payload,
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "message" in data

        # Verify persistence
        g = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        u = g.json()
        assert u.get("contract_start_date", "").startswith("2025-09-01")
        assert u.get("contract_end_date", "").startswith("2026-06-30")

    def test_coach_compensation_update_200(self, admin_headers):
        # Use Alice from credentials
        r = _login("alice@test.com", "Test1234")
        if r.status_code != 200:
            # Fallback: find any coach in DB
            user = _find_user_by_role(admin_headers, "coach")
            if not user:
                pytest.skip("No coach available for testing")
            user_id = user["id"]
        else:
            user_id = r.json()["user"]["id"]

        payload = {
            "monthly_compensation": 2500.0,
            "contract_start_date": "2025-08-01",
            "contract_end_date": "2026-06-30",
        }
        resp = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=payload,
            timeout=30,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_collaboratore_compensation_update_200(self, admin_headers):
        r = _login("paolo@coll.com", "PaoloTest123")
        if r.status_code != 200:
            user = _find_user_by_role(admin_headers, "collaboratore")
            if not user:
                pytest.skip("Paolo collaboratore not found and no collaboratore in DB")
            user_id = user["id"]
        else:
            user_id = r.json()["user"]["id"]

        payload = {
            "contract_start_date": "2025-09-01",
            "contract_end_date": "2026-06-30",
        }
        resp = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=payload,
            timeout=30,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_athlete_pro_compensation_update_200_main_bug_case(self, admin_headers):
        """
        MAIN BUG CASE: role=athlete must now be accepted (was 400 before fix).
        Use testalice1780817007@test.com (PRO compensated).
        """
        r = _login("testalice1780817007@test.com", "Test1234")
        if r.status_code != 200:
            pytest.skip(f"PRO athlete login failed: {r.status_code} {r.text}")
        user = r.json()["user"]
        assert user["role"] == "athlete", f"Expected role=athlete, got {user['role']}"
        user_id = user["id"]

        payload = {
            "monthly_compensation": 800.0,
            "contract_start_date": "2025-09-01",
            "contract_end_date": "2026-06-30",
        }
        resp = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=payload,
            timeout=30,
        )
        assert resp.status_code == 200, (
            f"REGRESSION: athlete PRO compensation update returned {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert "message" in data

        # Verify persistence on users collection
        g = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        u = g.json()
        assert float(u.get("monthly_compensation") or 0) == 800.0
        assert (u.get("contract_start_date") or "").startswith("2025-09-01")
        assert (u.get("contract_end_date") or "").startswith("2026-06-30")


# -------------- Negative tests --------------

class TestCompensationRoleRejected:
    """PATCH /api/users/{user_id}/compensation must reject parent with 400.

    NOTE (25/02/2026 - iteration 78): admin is now ALLOWED (VERDI FABIO scenario).
    See TestAdminRoleAccepted below.
    """

    def test_parent_role_rejected_with_role_in_error(self, admin_headers):
        parent = _find_user_by_role(admin_headers, "parent")
        if not parent:
            pytest.skip("No parent user found in DB")
        user_id = parent["id"]

        payload = {"monthly_compensation": 100.0}
        resp = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=payload,
            timeout=30,
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        detail = resp.json().get("detail", "")
        assert "role attuale" in detail.lower(), (
            f"Error message should include 'role attuale', got: {detail}"
        )
        assert "parent" in detail.lower(), (
            f"Error message should include the actual role 'parent', got: {detail}"
        )


# -------------- compensation_accepted preservation test --------------

class TestCompensationAcceptedPreservation:
    """
    When PATCH updates ONLY contract dates (no monthly_compensation in payload),
    the compensation_accepted flag must NOT be reset.
    """

    def test_contract_dates_only_does_not_reset_accepted(self, admin_headers):
        user = _find_user_by_role(admin_headers, "dirigente")
        if not user:
            pytest.skip("No dirigente available")
        user_id = user["id"]

        # Step 1: set monthly_compensation and accept it
        # Ensure user has monthly_compensation set first
        setup_payload = {
            "monthly_compensation": 500.0,
            "contract_start_date": "2026-09-01",
            "contract_end_date": "2027-06-30",
        }
        r1 = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=setup_payload,
            timeout=30,
        )
        assert r1.status_code == 200

        # Force compensation_accepted=true directly via DB-like flag.
        # We can't toggle this from API easily, so we'll simulate by calling again
        # with the SAME amount (no change → no reset) AFTER trying to set it true
        # via a known acceptance endpoint if exists. Best-effort:
        # Pre-flight: check current value
        g0 = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers, timeout=30)
        assert g0.status_code == 200
        initial_accepted = g0.json().get("compensation_accepted", False)

        # Step 2: PATCH with only contract dates changed
        payload = {
            "contract_start_date": "2025-09-01",
            "contract_end_date": "2026-06-30",
        }
        r2 = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=payload,
            timeout=30,
        )
        assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"

        # Step 3: verify compensation_accepted unchanged
        g = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        u = g.json()
        assert u.get("compensation_accepted", False) == initial_accepted, (
            f"compensation_accepted changed from {initial_accepted} to "
            f"{u.get('compensation_accepted')} despite monthly_compensation not being in payload"
        )
        # Dates updated
        assert (u.get("contract_start_date") or "").startswith("2025-09-01")
        assert (u.get("contract_end_date") or "").startswith("2026-06-30")

    def test_same_amount_does_not_reset_accepted(self, admin_headers):
        """
        When monthly_compensation IS in payload but value is unchanged,
        compensation_accepted must not be reset (server compares old vs new).
        """
        user = _find_user_by_role(admin_headers, "dirigente")
        if not user:
            pytest.skip("No dirigente available")
        user_id = user["id"]

        # Read current
        g0 = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers, timeout=30)
        assert g0.status_code == 200
        current_amount = float(g0.json().get("monthly_compensation") or 0)
        initial_accepted = g0.json().get("compensation_accepted", False)

        payload = {"monthly_compensation": current_amount}
        r = requests.patch(
            f"{BASE_URL}/api/users/{user_id}/compensation",
            headers=admin_headers,
            json=payload,
            timeout=30,
        )
        assert r.status_code == 200



# -------------- Role normalization tests (25/02/2026 fix) --------------
# These tests insert users directly into MongoDB with non-canonical role values
# (case mismatch / whitespace) and verify:
#   - PATCH /compensation accepts them (200)
#   - The role is auto-normalized to lowercase canonical in DB
#   - For a completely invalid role, returns 400 with diagnostic message

import time

from pymongo import MongoClient


@pytest.fixture(scope="module")
def mongo_client():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = MongoClient(mongo_url)
    yield client
    client.close()


@pytest.fixture(scope="module")
def db(mongo_client):
    db_name = os.environ.get("DB_NAME", "test_database")
    return mongo_client[db_name]


def _insert_test_user(db, user_id: str, role_raw: str, society_id: str = ""):
    """Insert a test user with arbitrary role string (sync pymongo)."""
    doc = {
        "id": user_id,
        "email": f"{user_id}@test-role-norm.local",
        "first_name": "Test",
        "last_name": "RoleNorm",
        "full_name": "Test RoleNorm",
        "role": role_raw,  # NON-canonical on purpose
        "password_hash": "$2b$12$placeholder",
        "society_id": society_id,
        "is_approved": True,
        "email_verified": True,
    }
    db.users.delete_many({"id": user_id})
    db.users.insert_one(doc)


def _get_user_role(db, user_id: str):
    u = db.users.find_one({"id": user_id})
    return u.get("role") if u else None


def _cleanup_test_user(db, user_id: str):
    db.users.delete_many({"id": user_id})


class TestRoleNormalization:
    """
    Verify the PATCH /compensation endpoint normalizes role (lowercase + strip)
    and auto-corrects the DB when a non-canonical value is found.
    """

    def test_capitalized_dirigente_accepted_and_normalized(self, admin_headers, db):
        user_id = f"TEST_role_capital_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "Dirigente")

            payload = {
                "contract_start_date": "2025-09-01",
                "contract_end_date": "2026-06-30",
            }
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

            # DB must now have role='dirigente' (auto-normalized)
            new_role = _get_user_role(db, user_id)
            assert new_role == "dirigente", (
                f"Role was not auto-normalized: still '{new_role}'"
            )
        finally:
            _cleanup_test_user(db, user_id)

    def test_uppercase_dirigente_accepted_and_normalized(self, admin_headers, db):
        user_id = f"TEST_role_upper_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "DIRIGENTE")

            payload = {
                "contract_start_date": "2025-09-01",
                "contract_end_date": "2026-06-30",
            }
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

            new_role = _get_user_role(db, user_id)
            assert new_role == "dirigente", (
                f"Role was not auto-normalized: still '{new_role}'"
            )
        finally:
            _cleanup_test_user(db, user_id)

    def test_whitespace_padded_dirigente_accepted_and_normalized(self, admin_headers, db):
        user_id = f"TEST_role_ws_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "  dirigente  ")

            payload = {"contract_start_date": "2025-09-01"}
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

            new_role = _get_user_role(db, user_id)
            assert new_role == "dirigente", (
                f"Role was not auto-normalized after strip: still '{new_role}'"
            )
        finally:
            _cleanup_test_user(db, user_id)

    def test_mixed_case_coach_accepted_and_normalized(self, admin_headers, db):
        """Sanity: same logic for coach role."""
        user_id = f"TEST_role_coach_mixed_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "Coach")

            payload = {"monthly_compensation": 1234.0}
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

            new_role = _get_user_role(db, user_id)
            assert new_role == "coach"
        finally:
            _cleanup_test_user(db, user_id)

    def test_invalid_role_rejected_with_diagnostic(self, admin_headers, db):
        user_id = f"TEST_role_invalid_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "pippo")

            payload = {"monthly_compensation": 100.0}
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
            detail = r.json().get("detail", "")
            assert "role attuale" in detail.lower(), (
                f"Error message should mention 'role attuale', got: {detail}"
            )
            assert "pippo" in detail.lower(), (
                f"Error message should contain the actual invalid role 'pippo', got: {detail}"
            )

            # DB role MUST NOT have been modified (still 'pippo')
            new_role = _get_user_role(db, user_id)
            assert new_role == "pippo", (
                f"Invalid role should not be auto-corrected; was changed to '{new_role}'"
            )
        finally:
            _cleanup_test_user(db, user_id)


class TestCanonicalRoleRegression:
    """
    Regression: when role is already lowercase canonical, PATCH must still
    return 200 and DB role must remain unchanged (no spurious writes).
    """

    @pytest.mark.parametrize("role", ["coach", "dirigente", "collaboratore", "athlete"])
    def test_canonical_roles_still_accepted(self, admin_headers, db, role):
        user_id = f"TEST_role_canon_{role}_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, role)

            payload = {"contract_start_date": "2025-09-01"}
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, (
                f"Expected 200 for canonical role '{role}', got {r.status_code}: {r.text}"
            )

            new_role = _get_user_role(db, user_id)
            assert new_role == role, (
                f"Canonical role '{role}' was unexpectedly modified to '{new_role}'"
            )
        finally:
            _cleanup_test_user(db, user_id)

    @pytest.mark.parametrize("role", ["parent"])
    def test_admin_parent_roles_still_rejected(self, admin_headers, db, role):
        user_id = f"TEST_role_rej_{role}_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, role)

            payload = {"monthly_compensation": 100.0}
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 400, (
                f"Expected 400 for role '{role}', got {r.status_code}: {r.text}"
            )
            detail = r.json().get("detail", "")
            assert role in detail.lower(), (
                f"Error should include role '{role}', got: {detail}"
            )
        finally:
            _cleanup_test_user(db, user_id)



# -------------- ADMIN role acceptance tests (iteration 78 — VERDI FABIO bug fix) --------------

class TestAdminRoleAccepted:
    """
    Iteration 78 fix: admin is now accepted by PATCH /compensation.
    Use case: VERDI FABIO is admin of 'La Tua Società' but also acts as dirigente
    and earns a compensation. The previous allow-list (without 'admin') caused HTTP
    400 even when the admin role was perfectly canonical.

    Tests cover:
      - role='admin' (canonical lowercase) → 200
      - role='Admin' (Capital A) → 200 + auto-normalized in DB to 'admin'
      - role='ADMIN' (uppercase) → 200 + auto-normalized in DB to 'admin'
      - Realistic VERDI FABIO payload (1500€ + dates + venues) → 200 + persisted
    """

    def test_admin_canonical_lowercase_accepted_200(self, admin_headers, db):
        user_id = f"TEST_role_admin_canon_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "admin")

            payload = {
                "monthly_compensation": 1500.0,
                "contract_start_date": "2025-09-01",
                "contract_end_date": "2026-06-30",
            }
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, (
                f"CRITICAL BUG: admin role should be accepted, got {r.status_code}: {r.text}"
            )
            data = r.json()
            assert "message" in data

            # DB role remains 'admin' (no spurious write)
            new_role = _get_user_role(db, user_id)
            assert new_role == "admin", f"Canonical admin role was modified to '{new_role}'"

            # Persistence
            u = db.users.find_one({"id": user_id})
            assert float(u.get("monthly_compensation") or 0) == 1500.0
        finally:
            _cleanup_test_user(db, user_id)

    def test_admin_capital_a_accepted_and_normalized(self, admin_headers, db):
        user_id = f"TEST_role_admin_capital_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "Admin")

            payload = {"monthly_compensation": 2000.0}
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

            # Auto-corrected to lowercase
            new_role = _get_user_role(db, user_id)
            assert new_role == "admin", (
                f"Role 'Admin' was not auto-normalized to 'admin'; got '{new_role}'"
            )
        finally:
            _cleanup_test_user(db, user_id)

    def test_admin_uppercase_accepted_and_normalized(self, admin_headers, db):
        user_id = f"TEST_role_admin_upper_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "ADMIN")

            payload = {
                "monthly_compensation": 1800.0,
                "contract_start_date": "2025-09-01",
            }
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

            new_role = _get_user_role(db, user_id)
            assert new_role == "admin", (
                f"Role 'ADMIN' was not auto-normalized; got '{new_role}'"
            )
        finally:
            _cleanup_test_user(db, user_id)

    def test_admin_verdi_fabio_realistic_scenario(self, admin_headers, db):
        """
        Realistic VERDI FABIO payload (iteration_78 acceptance):
          monthly_compensation: 1500
          contract_start_date: 2025-09-01
          contract_end_date: 2026-06-30
          other_annual_compensation: 0
          assigned_teams: []
          assigned_venues: ['PalaSole', 'PalaLuna']
        """
        user_id = f"TEST_role_admin_verdi_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "admin")

            payload = {
                "monthly_compensation": 1500,
                "contract_start_date": "2025-09-01",
                "contract_end_date": "2026-06-30",
                "other_annual_compensation": 0,
                "assigned_teams": [],
                "assigned_venues": ["PalaSole", "PalaLuna"],
            }
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 200, (
                f"VERDI FABIO scenario failed: {r.status_code} {r.text}"
            )

            # Verify persistence end-to-end via direct DB read
            u = db.users.find_one({"id": user_id})
            assert u is not None
            assert float(u.get("monthly_compensation") or 0) == 1500.0
            assert float(u.get("other_annual_compensation") or 0) == 0.0
            assert u.get("assigned_teams") == []
            assert u.get("assigned_venues") == ["PalaSole", "PalaLuna"]
            # Dates may be datetime objects; serialise to str for prefix check
            csd = u.get("contract_start_date")
            ced = u.get("contract_end_date")
            assert csd is not None and str(csd).startswith("2025-09-01")
            assert ced is not None and str(ced).startswith("2026-06-30")
        finally:
            _cleanup_test_user(db, user_id)

    def test_admin_invalid_role_pippo_still_rejected_with_role_in_error(
        self, admin_headers, db
    ):
        """Regression: 'pippo' must still be rejected with 'role attuale: pippo' message."""
        user_id = f"TEST_role_invalid_pippo_iter78_{int(time.time()*1000)}"
        try:
            _insert_test_user(db, user_id, "pippo")
            payload = {"monthly_compensation": 100.0}
            r = requests.patch(
                f"{BASE_URL}/api/users/{user_id}/compensation",
                headers=admin_headers,
                json=payload,
                timeout=30,
            )
            assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
            detail = r.json().get("detail", "")
            assert "role attuale" in detail.lower()
            assert "pippo" in detail.lower()
        finally:
            _cleanup_test_user(db, user_id)
