"""Backend tests for Convocations module (iter 137)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env's variable name used by Expo
    BASE_URL = "https://zaino-coach-hub.preview.emergentagent.com"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
COACH_EMAIL = "alice@test.com"
COACH_PASSWORD = "Test1234"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def coach_token():
    return _login(COACH_EMAIL, COACH_PASSWORD)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def coach_h(coach_token):
    return {"Authorization": f"Bearer {coach_token}"}


@pytest.fixture(scope="module")
def coach_assigned_teams(coach_h):
    """All assigned teams for the coach."""
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=coach_h, timeout=30)
    assert r.status_code == 200, r.text
    me = r.json()
    teams = me.get("assigned_teams") or []
    assert teams, f"coach has no assigned teams: {me}"
    return teams


@pytest.fixture(scope="module")
def coach_assigned_team(coach_assigned_teams):
    return coach_assigned_teams[0]


@pytest.fixture(scope="module")
def all_teams(admin_h):
    r = requests.get(f"{BASE_URL}/api/teams", headers=admin_h, timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def admin_other_team(all_teams, coach_assigned_teams):
    """A team NOT assigned to coach, used for the 403 isolation test."""
    for t in all_teams:
        tid = t.get("id")
        if tid and tid not in coach_assigned_teams:
            return tid
    pytest.skip("No alternative team available for 403 isolation test")


# ---------------- Roster ----------------
class TestRoster:
    def test_roster_admin(self, admin_h, coach_assigned_team):
        r = requests.get(
            f"{BASE_URL}/api/convocations/team/{coach_assigned_team}/roster",
            headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "athletes" in data and isinstance(data["athletes"], list)
        assert "count" in data
        assert data["count"] == len(data["athletes"])

    def test_roster_coach_assigned(self, coach_h, coach_assigned_team):
        r = requests.get(
            f"{BASE_URL}/api/convocations/team/{coach_assigned_team}/roster",
            headers=coach_h, timeout=30)
        assert r.status_code == 200, r.text

    def test_roster_coach_forbidden_other_team(self, coach_h, admin_other_team):
        r = requests.get(
            f"{BASE_URL}/api/convocations/team/{admin_other_team}/roster",
            headers=coach_h, timeout=30)
        assert r.status_code == 403, r.text


# ---------------- CRUD + flows ----------------
class TestConvocationsCRUD:
    created_ids: list = []

    def test_create_draft(self, admin_h, coach_assigned_team):
        # fetch roster to use real athlete ids
        r = requests.get(
            f"{BASE_URL}/api/convocations/team/{coach_assigned_team}/roster",
            headers=admin_h, timeout=30)
        aths = r.json().get("athletes", [])
        aid_sel = [a["id"] for a in aths[:3]]
        payload = {
            "team_id": coach_assigned_team,
            "opponent": "TEST_Opponent",
            "match_date": "2026-02-15",
            "match_time": "18:00",
            "home_away": "home",
            "venue": "TEST_Palasport",
            "city": "TEST_Perugia",
            "meeting_place": "Palestra",
            "meeting_time": "16:30",
            "start_time": "17:00",
            "notes": "TEST_note",
            "athlete_ids": aid_sel,
            "status": "draft",
        }
        r = requests.post(f"{BASE_URL}/api/convocations", json=payload,
                          headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "draft"
        assert data["opponent"] == "TEST_Opponent"
        assert data["athlete_ids"] == aid_sel
        assert "_id" not in data
        TestConvocationsCRUD.created_ids.append(data["id"])

    def test_list(self, admin_h, coach_assigned_team):
        r = requests.get(
            f"{BASE_URL}/api/convocations?team_id={coach_assigned_team}",
            headers=admin_h, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [i["id"] for i in items]
        assert TestConvocationsCRUD.created_ids[0] in ids

    def test_get_detail(self, admin_h):
        cid = TestConvocationsCRUD.created_ids[0]
        r = requests.get(f"{BASE_URL}/api/convocations/{cid}",
                         headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "athletes" in data
        assert len(data["athletes"]) == len(data["athlete_ids"])
        for a in data["athletes"]:
            assert "full_name" in a

    def test_patch(self, admin_h):
        cid = TestConvocationsCRUD.created_ids[0]
        r = requests.patch(f"{BASE_URL}/api/convocations/{cid}",
                           json={"notes": "TEST_updated_note", "opponent": "TEST_Opponent2"},
                           headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["notes"] == "TEST_updated_note"
        assert data["opponent"] == "TEST_Opponent2"

    def test_contacts(self, admin_h):
        cid = TestConvocationsCRUD.created_ids[0]
        r = requests.get(f"{BASE_URL}/api/convocations/{cid}/contacts",
                         headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "athletes" in data
        for a in data["athletes"]:
            assert "athlete_phone" in a
            assert "mother_phone" in a
            assert "father_phone" in a

    def test_send(self, admin_h):
        cid = TestConvocationsCRUD.created_ids[0]
        r = requests.post(f"{BASE_URL}/api/convocations/{cid}/send",
                          headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "sent"
        # verify via GET
        r = requests.get(f"{BASE_URL}/api/convocations/{cid}",
                         headers=admin_h, timeout=30)
        assert r.json()["status"] == "sent"
        assert r.json().get("sent_at")

    def test_create_sent_directly(self, admin_h, coach_assigned_team):
        payload = {
            "team_id": coach_assigned_team,
            "opponent": "TEST_SentDirect",
            "match_date": "2026-02-20",
            "status": "sent",
            "athlete_ids": [],
        }
        r = requests.post(f"{BASE_URL}/api/convocations", json=payload,
                          headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "sent"
        assert data["sent_at"]
        TestConvocationsCRUD.created_ids.append(data["id"])

    def test_delete(self, admin_h):
        for cid in TestConvocationsCRUD.created_ids:
            r = requests.delete(f"{BASE_URL}/api/convocations/{cid}",
                                headers=admin_h, timeout=30)
            assert r.status_code == 200, r.text
            # verify 404
            r2 = requests.get(f"{BASE_URL}/api/convocations/{cid}",
                              headers=admin_h, timeout=30)
            assert r2.status_code == 404
        TestConvocationsCRUD.created_ids.clear()


# ---------------- Coach permissions isolation ----------------
class TestCoachPermissions:
    _coach_created = []

    def test_coach_cannot_create_on_other_team(self, coach_h, admin_other_team):
        r = requests.post(f"{BASE_URL}/api/convocations",
                          json={"team_id": admin_other_team, "opponent": "TEST_X",
                                "status": "draft", "athlete_ids": []},
                          headers=coach_h, timeout=30)
        assert r.status_code == 403, r.text

    def test_coach_can_create_on_own_team(self, coach_h, coach_assigned_team):
        r = requests.post(f"{BASE_URL}/api/convocations",
                          json={"team_id": coach_assigned_team,
                                "opponent": "TEST_CoachOwn",
                                "match_date": "2026-02-28",
                                "status": "draft", "athlete_ids": []},
                          headers=coach_h, timeout=30)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        TestCoachPermissions._coach_created.append(cid)

    def test_coach_list_only_own_teams(self, coach_h, coach_assigned_team, admin_other_team):
        r = requests.get(f"{BASE_URL}/api/convocations",
                         headers=coach_h, timeout=30)
        assert r.status_code == 200
        for item in r.json():
            # Must only contain own assigned teams
            assert item["team_id"] != admin_other_team

    def test_coach_cannot_access_other_team_list(self, coach_h, admin_other_team):
        r = requests.get(f"{BASE_URL}/api/convocations?team_id={admin_other_team}",
                         headers=coach_h, timeout=30)
        assert r.status_code == 403

    def test_cleanup_coach(self, coach_h):
        for cid in TestCoachPermissions._coach_created:
            r = requests.delete(f"{BASE_URL}/api/convocations/{cid}",
                                headers=coach_h, timeout=30)
            assert r.status_code == 200
        TestCoachPermissions._coach_created.clear()
