"""Backend tests for iter 138 — new convocation features:
- venue_address + maps_url fields on POST/PATCH
- GET /api/convocations/for-athlete/{athlete_id}
- GET /api/palestre/list (used by editor for city->gym autofill)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://zaino-coach-hub.preview.emergentagent.com"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
COACH_EMAIL = "alice@test.com"
COACH_PASSWORD = "Test1234"
# Unrelated-society athlete owner (parent in different society): use a
# parent email that is NOT in Pallavolo Perugia if available; otherwise rely
# on wrong-role (unauthorized if no linkage).
# We'll just test authorized flows + the role check with a parent token.
PARENT_EMAIL = "armida.raschi@gmail.com"
PARENT_PASSWORD = "Test1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASSWORD)}"}


@pytest.fixture(scope="module")
def coach_h():
    return {"Authorization": f"Bearer {_login(COACH_EMAIL, COACH_PASSWORD)}"}


@pytest.fixture(scope="module")
def parent_h():
    try:
        return {"Authorization": f"Bearer {_login(PARENT_EMAIL, PARENT_PASSWORD)}"}
    except Exception:
        pytest.skip("Parent credentials not usable")


@pytest.fixture(scope="module")
def coach_team(coach_h):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=coach_h, timeout=30)
    assert r.status_code == 200
    teams = r.json().get("assigned_teams") or []
    assert teams
    return teams[0]


# -------------------- Palestre KML (used by city autocomplete) --------------------
class TestPalestreList:
    def test_list_authenticated(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/palestre/list", headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        pal = data.get("palestre")
        assert isinstance(pal, list)
        assert len(pal) > 0, "palestre KML returned empty list"
        # each item must at minimum carry: name, address; folder=city for filter
        sample = pal[0]
        for k in ("name", "address"):
            assert k in sample, f"missing key {k} in palestra sample: {sample}"
        # at least one entry has a non-empty folder (city) so the editor can filter
        with_folder = [p for p in pal if (p.get("folder") or "").strip()]
        assert with_folder, "no palestra has 'folder' (city) set — city filter cannot work"
        # at least one has google_maps_url
        with_url = [p for p in pal if (p.get("google_maps_url") or "").strip()]
        assert with_url, "no palestra has google_maps_url — maps autofill won't work"

    def test_list_coach_also_allowed(self, coach_h):
        r = requests.get(f"{BASE_URL}/api/palestre/list", headers=coach_h, timeout=60)
        assert r.status_code == 200, r.text


# -------------------- POST/PATCH new fields venue_address + maps_url --------------------
class TestConvocationNewFields:
    created = []

    def test_create_with_new_fields(self, admin_h, coach_team):
        payload = {
            "team_id": coach_team,
            "opponent": "TEST_NewFields",
            "match_date": "2026-03-10",
            "match_time": "19:00",
            "home_away": "away",
            "venue": "TEST_PalaBigio",
            "venue_address": "Via Roma 1, 06063 Magione PG",
            "maps_url": "https://maps.google.com/?q=Via+Roma+1+Magione",
            "city": "Magione",
            "status": "draft",
            "athlete_ids": [],
        }
        r = requests.post(f"{BASE_URL}/api/convocations", json=payload,
                          headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["venue_address"] == payload["venue_address"]
        assert d["maps_url"] == payload["maps_url"]
        assert d["city"] == payload["city"]
        TestConvocationNewFields.created.append(d["id"])

    def test_get_returns_new_fields(self, admin_h):
        cid = TestConvocationNewFields.created[0]
        r = requests.get(f"{BASE_URL}/api/convocations/{cid}", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "venue_address" in d
        assert "maps_url" in d
        assert d["venue_address"].startswith("Via Roma")

    def test_patch_updates_new_fields(self, admin_h):
        cid = TestConvocationNewFields.created[0]
        r = requests.patch(f"{BASE_URL}/api/convocations/{cid}",
                           json={"venue_address": "Via Nuova 99",
                                 "maps_url": "https://maps.app.goo.gl/XYZ"},
                           headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["venue_address"] == "Via Nuova 99"
        assert d["maps_url"] == "https://maps.app.goo.gl/XYZ"

    def test_cleanup(self, admin_h):
        for cid in TestConvocationNewFields.created:
            r = requests.delete(f"{BASE_URL}/api/convocations/{cid}",
                                headers=admin_h, timeout=30)
            assert r.status_code == 200
        TestConvocationNewFields.created.clear()


# -------------------- GET /api/convocations/for-athlete/{athlete_id} --------------------
class TestForAthlete:
    sent_conv_id = None
    athlete_id = None

    @pytest.fixture(scope="class", autouse=True)
    def _setup(self, admin_h, coach_team, request):
        """Create one SENT convocation that includes a specific athlete."""
        # Pick an athlete from the roster
        r = requests.get(f"{BASE_URL}/api/convocations/team/{coach_team}/roster",
                         headers=admin_h, timeout=30)
        aths = r.json().get("athletes", [])
        if not aths:
            pytest.skip("No athletes in coach's team")
        TestForAthlete.athlete_id = aths[0]["id"]

        payload = {
            "team_id": coach_team,
            "opponent": "TEST_ForAthlete",
            "match_date": "2026-03-15",
            "match_time": "20:00",
            "home_away": "home",
            "venue": "TEST_Venue",
            "venue_address": "Viale Test 1",
            "maps_url": "https://maps.google.com/?q=Test",
            "city": "Perugia",
            "meeting_place": "Palestra",
            "meeting_time": "18:30",
            "start_time": "19:30",
            "notes": "TEST notes",
            "status": "sent",
            "athlete_ids": [TestForAthlete.athlete_id],
        }
        rp = requests.post(f"{BASE_URL}/api/convocations", json=payload,
                           headers=admin_h, timeout=30)
        assert rp.status_code == 200, rp.text
        TestForAthlete.sent_conv_id = rp.json()["id"]

        def _cleanup():
            if TestForAthlete.sent_conv_id:
                requests.delete(f"{BASE_URL}/api/convocations/{TestForAthlete.sent_conv_id}",
                                headers=admin_h, timeout=30)
        request.addfinalizer(_cleanup)

    def test_admin_can_read(self, admin_h):
        r = requests.get(
            f"{BASE_URL}/api/convocations/for-athlete/{TestForAthlete.athlete_id}",
            headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        ids = [i["id"] for i in items]
        assert TestForAthlete.sent_conv_id in ids
        item = next(i for i in items if i["id"] == TestForAthlete.sent_conv_id)
        # new fields must be exposed
        assert item.get("venue_address") == "Viale Test 1"
        assert item.get("maps_url") == "https://maps.google.com/?q=Test"
        # coach_name/coach_phone keys must exist (may be empty if no coach assigned)
        assert "coach_name" in item
        assert "coach_phone" in item

    def test_coach_can_read(self, coach_h):
        r = requests.get(
            f"{BASE_URL}/api/convocations/for-athlete/{TestForAthlete.athlete_id}",
            headers=coach_h, timeout=30)
        # Coach is in same society (team is assigned_team) → should be 200
        assert r.status_code == 200, r.text

    def test_only_sent_items_returned(self, admin_h, coach_team):
        """Create a DRAFT with same athlete → must NOT appear in for-athlete output."""
        draft_payload = {
            "team_id": coach_team,
            "opponent": "TEST_DraftHidden",
            "match_date": "2026-04-01",
            "status": "draft",
            "athlete_ids": [TestForAthlete.athlete_id],
        }
        rp = requests.post(f"{BASE_URL}/api/convocations", json=draft_payload,
                           headers=admin_h, timeout=30)
        assert rp.status_code == 200
        draft_id = rp.json()["id"]
        try:
            r = requests.get(
                f"{BASE_URL}/api/convocations/for-athlete/{TestForAthlete.athlete_id}",
                headers=admin_h, timeout=30)
            assert r.status_code == 200
            ids = [i["id"] for i in r.json()]
            assert draft_id not in ids, "draft convocation should not be returned"
            assert TestForAthlete.sent_conv_id in ids
        finally:
            requests.delete(f"{BASE_URL}/api/convocations/{draft_id}",
                            headers=admin_h, timeout=30)

    def test_parent_unlinked_is_403(self, parent_h):
        """Parent not linked to the athlete must get 403."""
        r = requests.get(
            f"{BASE_URL}/api/convocations/for-athlete/{TestForAthlete.athlete_id}",
            headers=parent_h, timeout=30)
        # parent is in different society OR not linked — should be 403
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_athlete_not_found(self, admin_h):
        r = requests.get(
            f"{BASE_URL}/api/convocations/for-athlete/does-not-exist-xyz",
            headers=admin_h, timeout=30)
        assert r.status_code == 404
