"""Iter.128 — Backend tests for:
1) GET /api/admin/data-hygiene
2) GET /api/admin/payments/income-summary (seeded test_seed payments)
3) Trial block enforcement in bulk-attendance and manual-attendance
4) Regression: /api/admin/payments/history + /api/admin/team-roster
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
COLL_EMAIL = "paolo@coll.com"
COLL_PASSWORD = "PaoloTest123"
SOCIETY_ID = "697fdba0d218717959e73eea"


# --------------------------- shared helpers ---------------------------
def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASSWORD)}"}


@pytest.fixture(scope="module")
def coll_headers():
    try:
        tok = _login(COLL_EMAIL, COLL_PASSWORD)
    except AssertionError:
        pytest.skip("collaboratore login not available in preview env")
    return {"Authorization": f"Bearer {tok}"}


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module")
def mongo_db():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()
    loop.close()


# --------------------------- 1) data-hygiene ---------------------------
class TestDataHygiene:
    def test_admin_200_and_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/data-hygiene", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "summary" in body and "checks" in body
        assert body["summary"]["total_athletes"] > 0, body["summary"]
        keys = {c["key"] for c in body["checks"]}
        for required in (
            "missing_fiscal_code",
            "duplicate_fiscal_code",
            "no_team",
            "minor_without_parent",
            "parents_without_children",
        ):
            assert required in keys, f"missing check key: {required}"
        # count == len(items) invariant
        for c in body["checks"]:
            assert c["count"] == len(c["items"]), c

    def test_non_admin_forbidden(self, coll_headers):
        r = requests.get(f"{BASE_URL}/api/admin/data-hygiene", headers=coll_headers, timeout=30)
        # collaboratore is NOT admin/coordinatore -> 403
        assert r.status_code == 403, r.text


# --------------------------- 2) income-summary ---------------------------
class TestIncomeSummary:
    def test_all_time_totals_430(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/payments/income-summary", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        totals = body["totals"]
        assert totals["count"] >= 3  # at least our 3 seeded paid rows
        # The seeded test_seed=True paid payments: Contanti 150 + Bonifico 200 + Stripe (100-20) = 430
        # NB: other real paid payments may exist in preview, so net must be >= 430
        assert totals["net"] >= 430 - 0.01, totals
        assert totals["total_refunded"] >= 20 - 0.01, totals
        # methods sorted by net desc
        nets = [m["net"] for m in body["methods"]]
        assert nets == sorted(nets, reverse=True), nets
        # shares sum ~100 (within rounding)
        shares = sum(m["share"] for m in body["methods"])
        assert 99.0 <= shares <= 101.0, shares
        # Each seeded method is represented
        method_labels = {m["method"] for m in body["methods"]}
        assert "Contanti" in method_labels
        assert "Bonifico" in method_labels
        assert any(m.lower().startswith("stripe") for m in method_labels), method_labels

    def test_current_month_filter(self, admin_headers):
        # First day of current month
        today = datetime.utcnow().date()
        d_from = today.replace(day=1).isoformat()
        r = requests.get(
            f"{BASE_URL}/api/admin/payments/income-summary",
            headers=admin_headers,
            params={"date_from": d_from},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Only Contanti (150) + Stripe (100 - 20 = 80) from the seeded set this month
        # Net must include at least 230; Bonifico (Sept) excluded.
        totals = body["totals"]
        assert totals["net"] >= 230 - 0.01, totals
        method_labels = {m["method"] for m in body["methods"]}
        # Bonifico from seeded set should not be present (unless other real bonifico paid this month)
        # We only assert Contanti + Stripe-ish present
        assert "Contanti" in method_labels
        assert any(m.lower().startswith("stripe") for m in method_labels), method_labels

    def test_unpaid_not_counted(self, admin_headers):
        # Unpaid 300 is in DB but must NOT contribute to totals.net
        r = requests.get(f"{BASE_URL}/api/admin/payments/income-summary", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        # unpaid 300 not present in any method sum: check by inspecting total_paid
        # total_paid from seeded = 150+200+100 = 450; refunded 20; net 430
        # If unpaid 300 was wrongly counted, total_paid would include it (>= 750)
        assert body["totals"]["total_paid"] < 650, body["totals"]  # safely bounded


# --------------------------- 3) Trial block ---------------------------
class TestTrialBlock:
    """Create a disposable athlete in SOCIETY_ID and verify blocking behaviour."""

    @classmethod
    def setup_class(cls):
        cls.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(cls.loop)
        cls.client = AsyncIOMotorClient(MONGO_URL)
        cls.db = cls.client[DB_NAME]
        # Pick an existing team of SOCIETY_ID
        team = cls.loop.run_until_complete(
            cls.db.teams.find_one({"society_id": SOCIETY_ID}, {"_id": 0, "id": 1, "name": 1})
        )
        assert team, "no team found in society"
        cls.team_id = team["id"]

        now = datetime.now(timezone.utc)
        cls.athlete_id = f"test128_{uuid.uuid4().hex[:12]}"
        cls.athlete = {
            "id": cls.athlete_id,
            "first_name": "TEST128",
            "last_name": "TRIALBLOCK",
            "full_name": "TEST128 TRIALBLOCK",
            "society_id": SOCIETY_ID,
            "team_id": cls.team_id,
            "status": "trial",
            "is_trial": True,
            "is_withdrawn": False,
            "trial_start_date": now.isoformat(),
            "trial_end_date": (now + timedelta(days=5)).isoformat(),
            "trial_sessions_count": 3,
            "privacy_accepted": False,
            "date_of_birth": "2000-01-01",
            "is_minor": False,
        }
        cls.loop.run_until_complete(cls.db.athletes.insert_one(dict(cls.athlete)))

    @classmethod
    def teardown_class(cls):
        cls.loop.run_until_complete(
            cls.db.attendances.delete_many({"athlete_id": cls.athlete_id})
        )
        cls.loop.run_until_complete(cls.db.athletes.delete_one({"id": cls.athlete_id}))
        cls.client.close()
        cls.loop.close()

    def test_bulk_attendance_blocked_prova_terminata(self, admin_headers):
        # Ensure athlete has 3/3 sessions, in trial status
        self.loop.run_until_complete(
            self.db.athletes.update_one(
                {"id": self.athlete_id},
                {"$set": {"status": "trial", "is_trial": True, "trial_sessions_count": 3}},
            )
        )
        today = datetime.utcnow().strftime("%Y-%m-%d")
        r = requests.post(
            f"{BASE_URL}/api/admin/teams/{self.team_id}/bulk-attendance",
            headers=admin_headers,
            json={"athlete_ids": [self.athlete_id], "date": today, "time": "18:00"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        skipped_ids = [s.get("athlete_id") for s in body.get("skipped", [])]
        assert self.athlete_id in skipped_ids, body
        reason = next(s.get("reason", "") for s in body["skipped"] if s.get("athlete_id") == self.athlete_id)
        assert "prova terminata" in reason.lower(), reason
        # No attendance inserted
        count = self.loop.run_until_complete(
            self.db.attendances.count_documents({"athlete_id": self.athlete_id, "date": today})
        )
        assert count == 0, "attendance should NOT have been inserted"

    def test_manual_attendance_400_prova_terminata(self, admin_headers):
        # Still 3/3 sessions
        self.loop.run_until_complete(
            self.db.athletes.update_one(
                {"id": self.athlete_id},
                {"$set": {"status": "trial", "is_trial": True, "trial_sessions_count": 3}},
            )
        )
        today = datetime.utcnow().strftime("%Y-%m-%d")
        r = requests.post(
            f"{BASE_URL}/api/coach/athletes/{self.athlete_id}/manual-attendance",
            headers=admin_headers,
            json={"date": today, "time": "19:00"},
            timeout=30,
        )
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert "Periodo di prova terminato" in detail or "prova" in detail.lower(), detail

    def test_bulk_attendance_registers_when_under_limit(self, admin_headers):
        # Reset to 1 session, no attendances
        self.loop.run_until_complete(
            self.db.attendances.delete_many({"athlete_id": self.athlete_id})
        )
        self.loop.run_until_complete(
            self.db.athletes.update_one(
                {"id": self.athlete_id},
                {"$set": {"status": "trial", "is_trial": True, "trial_sessions_count": 1}},
            )
        )
        today = datetime.utcnow().strftime("%Y-%m-%d")
        r = requests.post(
            f"{BASE_URL}/api/admin/teams/{self.team_id}/bulk-attendance",
            headers=admin_headers,
            json={"athlete_ids": [self.athlete_id], "date": today, "time": "18:00"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        reg_ids = [a.get("athlete_id") for a in body.get("registered", [])]
        assert self.athlete_id in reg_ids, body
        # trial_sessions_count should be recomputed from distinct dates => 1 (just this attendance)
        a = self.loop.run_until_complete(self.db.athletes.find_one({"id": self.athlete_id}))
        assert int(a.get("trial_sessions_count", 0)) == 1, a.get("trial_sessions_count")

    def test_active_athlete_with_leftover_is_trial_not_blocked(self, admin_headers):
        # status active + is_trial=True leftover: must NOT be blocked
        self.loop.run_until_complete(
            self.db.attendances.delete_many({"athlete_id": self.athlete_id})
        )
        self.loop.run_until_complete(
            self.db.athletes.update_one(
                {"id": self.athlete_id},
                {"$set": {"status": "active", "is_trial": True, "trial_sessions_count": 10}},
            )
        )
        today = datetime.utcnow().strftime("%Y-%m-%d")
        r = requests.post(
            f"{BASE_URL}/api/admin/teams/{self.team_id}/bulk-attendance",
            headers=admin_headers,
            json={"athlete_ids": [self.athlete_id], "date": today, "time": "20:00"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        reg_ids = [a.get("athlete_id") for a in body.get("registered", [])]
        skipped_ids = [s.get("athlete_id") for s in body.get("skipped", [])]
        # Active athlete must be registered (not blocked by trial)
        assert self.athlete_id in reg_ids, {"registered": reg_ids, "skipped": body.get("skipped")}


# --------------------------- 4) regression ---------------------------
class TestRegression:
    def test_payments_history_still_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/payments/history", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rows" in body and "totals" in body

    def test_team_roster_trial_max_sessions(self, admin_headers):
        # Pick a team of SOCIETY_ID
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            team = loop.run_until_complete(
                client[DB_NAME].teams.find_one({"society_id": SOCIETY_ID}, {"_id": 0, "id": 1})
            )
        finally:
            client.close()
            loop.close()
        assert team
        r = requests.get(
            f"{BASE_URL}/api/admin/team-roster",
            params={"team_id": team["id"]},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # trial_max_sessions must appear somewhere in the response (top-level or in each row)
        found = "trial_max_sessions" in body
        if not found and isinstance(body, dict):
            # could be in a nested list
            for v in body.values():
                if isinstance(v, list) and v and isinstance(v[0], dict) and "trial_max_sessions" in v[0]:
                    found = True
                    break
        assert found, f"trial_max_sessions missing in team-roster response: keys={list(body)[:20]}"
