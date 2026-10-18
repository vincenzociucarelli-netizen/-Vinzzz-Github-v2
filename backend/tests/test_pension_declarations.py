"""Backend tests for the NEW Pension Position Declaration feature.

Covers:
- GET /api/me/pension-declaration/status (shape + no signature in latest)
- POST /api/me/pension-declaration/declare (validation + append-only versioning)
- Admin endpoints: GET /api/admin/users/{id}/pension-declarations (403 non-admin)
- Admin summary: /api/admin/pension-declarations/summary
- Admin notifications contain a 'pension_declaration' entry
- Regression: /api/coach/{id}/accept-compensation and
  /api/dirigente/{id}/accept-compensation return 403 PENSION_DECLARATION_REQUIRED
  when the user has prior-compensation signed but NO pension declaration.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or "https://zaino-coach-hub.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
DIRIGENTE_EMAIL = "lella@dir.com"
DIRIGENTE_PASSWORD = "Test1234"

SIG = "data:image/png;base64," + ("A" * 160)


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.text}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def dirigente_token():
    return _login(DIRIGENTE_EMAIL, DIRIGENTE_PASSWORD)


def _h(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ───────────────────────── /me/pension-declaration/status ─────────────────────────
class TestMyStatus:
    def test_status_shape_and_history(self, dirigente_token):
        r = requests.get(f"{API}/me/pension-declaration/status", headers=_h(dirigente_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("declared", "status", "latest", "history", "texts", "agreement_id"):
            assert key in data, f"missing key {key} in status: {list(data.keys())}"
        # texts
        texts = data["texts"]
        assert texts.get("version") == "1.0"
        assert len(texts.get("options") or []) == 4
        codes = [o.get("code") for o in texts["options"]]
        assert codes == ["A", "B", "C", "D"]
        # lella has 3 versions seeded
        assert data["declared"] is True
        assert isinstance(data["history"], list)
        assert len(data["history"]) >= 1
        # latest MUST NOT include signature_base64 (private)
        latest = data["latest"]
        assert latest is not None
        assert "signature_base64" not in latest, "signature_base64 leaked in /me/.../status latest"
        for h in data["history"]:
            assert "signature_base64" not in h, "signature_base64 leaked in /me/.../status history"


# ───────────────────────── /me/pension-declaration/declare ────────────────────────
class TestDeclareValidation:
    def test_position_A_without_detail_returns_400(self, dirigente_token):
        payload = {"position": "A", "confirm": True, "signature_base64": SIG}
        r = requests.post(f"{API}/me/pension-declaration/declare", headers=_h(dirigente_token), json=payload, timeout=20)
        assert r.status_code == 400, r.text

    def test_confirm_false_returns_400(self, dirigente_token):
        payload = {"position": "C", "confirm": False, "signature_base64": SIG}
        r = requests.post(f"{API}/me/pension-declaration/declare", headers=_h(dirigente_token), json=payload, timeout=20)
        assert r.status_code == 400, r.text

    def test_invalid_position_E_returns_422(self, dirigente_token):
        payload = {"position": "E", "confirm": True, "signature_base64": SIG}
        r = requests.post(f"{API}/me/pension-declaration/declare", headers=_h(dirigente_token), json=payload, timeout=20)
        assert r.status_code == 422, r.text

    def test_text_version_mismatch_returns_409(self, dirigente_token):
        payload = {"position": "C", "confirm": True, "signature_base64": SIG, "text_version": "9.9"}
        r = requests.post(f"{API}/me/pension-declaration/declare", headers=_h(dirigente_token), json=payload, timeout=20)
        assert r.status_code == 409, r.text

    def test_short_signature_returns_422(self, dirigente_token):
        payload = {"position": "C", "confirm": True, "signature_base64": "x" * 10}
        r = requests.post(f"{API}/me/pension-declaration/declare", headers=_h(dirigente_token), json=payload, timeout=20)
        assert r.status_code == 422, r.text


# ───────────────────────── Append-only versioning ────────────────────────────────
class TestAppendOnly:
    def test_declare_two_versions_appended(self, dirigente_token):
        s0 = requests.get(f"{API}/me/pension-declaration/status", headers=_h(dirigente_token), timeout=20).json()
        before_history = s0.get("history") or []
        before_count = len(before_history)
        before_latest_vnum = (s0.get("latest") or {}).get("version_number", 0)
        before_latest_id = (s0.get("latest") or {}).get("id")

        # Declare A with detail -> status signed, v = prev+1
        r1 = requests.post(
            f"{API}/me/pension-declaration/declare",
            headers=_h(dirigente_token),
            json={"position": "A", "detail": "Lavoro dipendente", "confirm": True, "signature_base64": SIG},
            timeout=20,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()["declaration"]
        assert d1["status"] == "signed"
        assert d1["version_number"] == before_latest_vnum + 1
        assert d1["previous_declaration_id"] == before_latest_id
        assert d1["detail"] == "Lavoro dipendente"

        # Declare D -> status to_verify, detail ignored
        r2 = requests.post(
            f"{API}/me/pension-declaration/declare",
            headers=_h(dirigente_token),
            json={"position": "D", "detail": "ignored", "confirm": True, "signature_base64": SIG},
            timeout=20,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()["declaration"]
        assert d2["status"] == "to_verify"
        assert d2["version_number"] == d1["version_number"] + 1
        assert d2["previous_declaration_id"] == d1["id"]

        # Verify history grew by exactly 2 and old versions are intact
        s1 = requests.get(f"{API}/me/pension-declaration/status", headers=_h(dirigente_token), timeout=20).json()
        assert len(s1["history"]) == before_count + 2
        # Old entries unchanged (compare ids + version_numbers)
        old_ids_before = {h.get("id"): h.get("version_number") for h in before_history}
        for h in s1["history"]:
            if h.get("id") in old_ids_before:
                assert h.get("version_number") == old_ids_before[h.get("id")]


# ───────────────────────── Admin endpoints ────────────────────────────────────────
class TestAdminEndpoints:
    def test_admin_user_declarations_returns_signature(self, admin_token, dirigente_token):
        # Get my user id as dirigente
        me = requests.get(f"{API}/auth/me", headers=_h(dirigente_token), timeout=20).json()
        uid = me.get("id") or me.get("user", {}).get("id")
        assert uid, f"could not find user id in /auth/me: {me}"
        r = requests.get(f"{API}/admin/users/{uid}/pension-declarations", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["declared"] is True
        assert data["latest"] is not None
        assert data["latest"].get("signature_base64"), "admin should see signature_base64 in latest"
        assert len(data["history"]) >= 1
        assert data["history"][0].get("signature_base64")

    def test_admin_user_declarations_forbidden_for_non_admin(self, dirigente_token):
        # Call admin endpoint using dirigente token
        me = requests.get(f"{API}/auth/me", headers=_h(dirigente_token), timeout=20).json()
        uid = me.get("id") or me.get("user", {}).get("id")
        r = requests.get(f"{API}/admin/users/{uid}/pension-declarations", headers=_h(dirigente_token), timeout=20)
        assert r.status_code == 403, r.text

    def test_admin_summary(self, admin_token, dirigente_token):
        r = requests.get(f"{API}/admin/pension-declarations/summary", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows" in data
        assert "texts" in data
        rows = data["rows"]
        assert isinstance(rows, list) and len(rows) > 0
        sample = rows[0]
        for key in ("user_id", "full_name", "role", "prior_compensation_amount",
                    "prior_compensation_signed", "pension_status", "pension_latest",
                    "pension_history", "pension_versions"):
            assert key in sample, f"missing {key} in summary row"
        # pension_status enum
        for row in rows:
            assert row["pension_status"] in ("signed", "to_verify", "not_declared")
        # Lella (viewer) should appear with signed status (she has at least one signed)
        lella = next((r for r in rows if (r.get("full_name") or "").upper().startswith("MARZO LELLA")), None)
        assert lella is not None, "MARZO LELLA not found in admin summary"
        assert lella["pension_versions"] >= 3
        assert lella["pension_status"] in ("signed", "to_verify")

    def test_admin_summary_forbidden_for_non_admin(self, dirigente_token):
        r = requests.get(f"{API}/admin/pension-declarations/summary", headers=_h(dirigente_token), timeout=20)
        assert r.status_code == 403, r.text


# ───────────────────────── Admin notifications ────────────────────────────────────
class TestAdminNotification:
    def test_notification_created_on_declare(self, admin_token, dirigente_token):
        # trigger a new declare
        payload = {"position": "C", "confirm": True, "signature_base64": SIG}
        r = requests.post(f"{API}/me/pension-declaration/declare", headers=_h(dirigente_token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        decl_id = r.json()["declaration"]["id"]

        # small delay just in case
        time.sleep(0.5)
        n = requests.get(f"{API}/admin/notifications", headers=_h(admin_token), timeout=20)
        assert n.status_code == 200, n.text
        payload = n.json()
        items = payload if isinstance(payload, list) else payload.get("notifications") or payload.get("items") or []
        pens = [x for x in items if x.get("type") == "pension_declaration"]
        assert pens, f"no pension_declaration notifications. keys: {list(payload)[:5] if isinstance(payload, dict) else type(payload)}"
        # at least one has correct title and references the latest declaration id (optional)
        titles = {x.get("title") for x in pens}
        assert "Nuova dichiarazione previdenziale" in titles


# ───────────────── Regression: accept-compensation requires pension ──────────────
class TestAcceptCompensationRegression:
    """We fabricate a disposable test user DIRECTLY in Mongo that has:
       - prior compensation signed (True)
       - compensation NOT accepted
       - NO pension declaration
    Then call /api/{role}/{id}/accept-compensation and expect 403 code PENSION_DECLARATION_REQUIRED.
    After the test we delete the user so we don't pollute real data.
    """

    def _create_user(self, role: str, email: str) -> str:
        from pymongo import MongoClient
        import bcrypt
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        uid = uuid.uuid4().hex[:24]
        pwd = bcrypt.hashpw(b"TestPwd123!", bcrypt.gensalt()).decode()
        from datetime import datetime
        doc = {
            "id": uid,
            "email": email,
            "password_hash": pwd,
            "full_name": f"TEST PENSION {role.upper()}",
            "role": role,
            "society_id": "697fdba0d218717959e73eea",
            "email_verified": True,
            "is_approved": True,
            "monthly_compensation": 500.0,
            "compensation_accepted": False,
            "other_annual_compensation": 0.0,
            "other_annual_compensation_signed": True,
            "other_annual_compensation_signed_year": datetime.utcnow().year,
            "other_annual_compensation_signed_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
        }
        db.users.insert_one(doc)
        client.close()
        return uid

    def _cleanup_user(self, uid: str):
        from pymongo import MongoClient
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        db.users.delete_one({"id": uid})
        db.pension_declarations.delete_many({"user_id": uid})
        client.close()

    def test_coach_accept_requires_pension_declaration(self):
        email = f"test_pens_coach_{uuid.uuid4().hex[:8]}@test.com"
        uid = self._create_user("coach", email)
        try:
            tok = _login(email, "TestPwd123!")
            r = requests.post(f"{API}/coach/{uid}/accept-compensation", headers=_h(tok), timeout=20)
            assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
            detail = r.json().get("detail", {})
            if isinstance(detail, dict):
                assert detail.get("code") == "PENSION_DECLARATION_REQUIRED", f"wrong code: {detail}"
            else:
                pytest.fail(f"detail not dict: {detail}")
        finally:
            self._cleanup_user(uid)

    def test_dirigente_accept_requires_pension_declaration(self):
        email = f"test_pens_dir_{uuid.uuid4().hex[:8]}@test.com"
        uid = self._create_user("dirigente", email)
        try:
            tok = _login(email, "TestPwd123!")
            r = requests.post(f"{API}/dirigente/{uid}/accept-compensation", headers=_h(tok), timeout=20)
            assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
            detail = r.json().get("detail", {})
            if isinstance(detail, dict):
                assert detail.get("code") == "PENSION_DECLARATION_REQUIRED", f"wrong code: {detail}"
            else:
                pytest.fail(f"detail not dict: {detail}")
        finally:
            self._cleanup_user(uid)
