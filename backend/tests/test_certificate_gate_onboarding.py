"""
Certificate gate onboarding tests (iteration 95).

Copre:
  - POST /api/athletes (parent, minore) con already_registered true/false -> status pending_certificate / pending_trial
  - POST /api/certificates/simple (admin verified=True su pending_certificate) -> pending_trial
  - POST /api/trial/accept-privacy/{athlete_id} senza cert convalidato -> 400
  - PATCH /api/athletes/{id}/approval status=trial su ADULTO senza cert -> pending_certificate
  - POST /api/teams + PATCH /api/teams/{id} con certificate_type_required
  - PATCH /api/athletes/{id}/dismiss-review + restore-review + GET /api/athletes include review_dismissed_season
  - Regressione GET /api/athletes ritorna 200 con lista arricchita
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://zaino-coach-hub.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASS = "Test1234"
PARENT_EMAIL = "armida.raschi@gmail.com"
PARENT_PASS = "Test1234"

CREATED_ATHLETES = []
CREATED_TEAMS = []


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def parent_token():
    return _login(PARENT_EMAIL, PARENT_PASS)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def parent_h(parent_token):
    return {"Authorization": f"Bearer {parent_token}"}


@pytest.fixture(scope="module")
def agonistico_team(admin_h):
    """Trova (o crea) una squadra con certificate_type_required=agonistico."""
    r = requests.get(f"{API}/teams", headers=admin_h, timeout=30)
    assert r.status_code == 200
    teams = r.json()
    for t in teams:
        if (t.get("certificate_type_required") or "agonistico") == "agonistico":
            return t
    # se non ce n'e' una, creala
    payload = {"name": "ZZTEST Squadra Ago", "certificate_type_required": "agonistico"}
    r = requests.post(f"{API}/teams", json=payload, headers=admin_h, timeout=30)
    assert r.status_code == 200, r.text
    t = r.json()
    CREATED_TEAMS.append(t["id"])
    return t


def _rand_cf(prefix="ZZTEST"):
    # 16 char, uppercase alnum, starts ZZTEST
    tail = uuid.uuid4().hex[:10].upper()
    return (prefix + tail)[:16]


def _create_athlete(parent_h, team_id, is_minor=True, already_registered=None, full_name="ZZTest Minor"):
    dob = "2014-05-10" if is_minor else "1995-05-10"
    payload = {
        "full_name": full_name,
        "first_name": full_name.split()[0],
        "last_name": " ".join(full_name.split()[1:]) or "Test",
        "date_of_birth": dob,
        "gender": "M",
        "fiscal_code": _rand_cf(),
        "team_id": team_id,
        "privacy_accepted": not is_minor,
        "consent_privacy_viewed": not is_minor,
    }
    if already_registered is not None:
        payload["already_registered"] = already_registered
    r = requests.post(f"{API}/athletes", json=payload, headers=parent_h, timeout=30)
    assert r.status_code == 200, r.text
    a = r.json()
    CREATED_ATHLETES.append(a["id"])
    return a


# ─────────── TESTS ───────────

class TestMinorRegistrationCertGate:
    def test_minor_already_registered_true_pending_certificate(self, parent_h, agonistico_team):
        a = _create_athlete(parent_h, agonistico_team["id"], is_minor=True, already_registered=True,
                            full_name="ZZTest MinorAR True")
        assert a["is_minor"] is True
        assert a["status"] == "pending_certificate", a

    def test_minor_already_registered_false_pending_trial(self, parent_h, agonistico_team):
        a = _create_athlete(parent_h, agonistico_team["id"], is_minor=True, already_registered=False,
                            full_name="ZZTest MinorAR False")
        assert a["is_minor"] is True
        assert a["status"] == "pending_trial", a


class TestCertificateVerificationAdvancesStatus:
    def test_verified_cert_pending_certificate_to_pending_trial(self, parent_h, admin_h, agonistico_team):
        a = _create_athlete(parent_h, agonistico_team["id"], is_minor=True, already_registered=True,
                            full_name="ZZTest MinorCertVerify")
        assert a["status"] == "pending_certificate"
        expiry = (datetime.utcnow() + timedelta(days=365)).date().isoformat()
        payload = {"athlete_id": a["id"], "issue_date": datetime.utcnow().date().isoformat(),
                   "expiry_date": expiry, "verified": True}
        r = requests.post(f"{API}/certificates/simple", json=payload, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        # verifica GET atleta
        r = requests.get(f"{API}/athletes", headers=admin_h, timeout=30)
        assert r.status_code == 200
        rec = next((x for x in r.json() if x["id"] == a["id"]), None)
        assert rec is not None
        assert rec["status"] == "pending_trial", rec.get("status")


class TestTrialAcceptPrivacyGate:
    def test_accept_privacy_without_cert_returns_400(self, parent_h, agonistico_team):
        # atleta minore senza cert (pending_trial) - accept-privacy deve bloccare
        a = _create_athlete(parent_h, agonistico_team["id"], is_minor=True, already_registered=False,
                            full_name="ZZTest MinorAcceptBlock")
        # per adulti sarebbe pending_certificate; qui minore già è pending_trial ma NON ha cert convalidato
        r = requests.post(f"{API}/trial/accept-privacy/{a['id']}",
                          json={"images_internal": True, "images_promo": False},
                          headers=parent_h, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:300]}"
        assert "certificato" in r.text.lower()

    def test_accept_privacy_with_verified_cert_goes_active(self, parent_h, admin_h, agonistico_team):
        a = _create_athlete(parent_h, agonistico_team["id"], is_minor=True, already_registered=False,
                            full_name="ZZTest MinorAcceptOk")
        expiry = (datetime.utcnow() + timedelta(days=365)).date().isoformat()
        r = requests.post(f"{API}/certificates/simple",
                          json={"athlete_id": a["id"],
                                "issue_date": datetime.utcnow().date().isoformat(),
                                "expiry_date": expiry, "verified": True},
                          headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/trial/accept-privacy/{a['id']}",
                          json={"images_internal": True, "images_promo": False},
                          headers=parent_h, timeout=30)
        assert r.status_code == 200, r.text
        # verifica status active
        r = requests.get(f"{API}/athletes", headers=admin_h, timeout=30)
        rec = next((x for x in r.json() if x["id"] == a["id"]), None)
        assert rec and rec["status"] == "active", rec


class TestAdultApprovalRequiresCert:
    def test_adult_approval_to_trial_without_cert_becomes_pending_certificate(self, parent_h, admin_h, agonistico_team):
        # crea atleta ADULTO tramite parent
        a = _create_athlete(parent_h, agonistico_team["id"], is_minor=False, full_name="ZZTest AdultNoCert")
        assert a["is_minor"] is False
        # admin approva a trial
        r = requests.patch(f"{API}/athletes/{a['id']}/approval",
                           json={"status": "trial"}, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/athletes", headers=admin_h, timeout=30)
        rec = next((x for x in r.json() if x["id"] == a["id"]), None)
        assert rec and rec["status"] == "pending_certificate", rec


class TestTeamCertificateTypePersistence:
    def test_create_team_with_buona_salute_persists(self, admin_h):
        payload = {"name": f"ZZTEST TeamBS {uuid.uuid4().hex[:6]}",
                   "certificate_type_required": "buona_salute"}
        r = requests.post(f"{API}/teams", json=payload, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        team = r.json()
        CREATED_TEAMS.append(team["id"])
        assert team.get("certificate_type_required") == "buona_salute"
        # GET
        r = requests.get(f"{API}/teams", headers=admin_h, timeout=30)
        assert r.status_code == 200
        found = next((t for t in r.json() if t["id"] == team["id"]), None)
        assert found and found.get("certificate_type_required") == "buona_salute"

    def test_patch_team_certificate_type_to_none_persists(self, admin_h):
        # crea temp team
        r = requests.post(f"{API}/teams",
                          json={"name": f"ZZTEST TeamPatch {uuid.uuid4().hex[:6]}",
                                "certificate_type_required": "agonistico"},
                          headers=admin_h, timeout=30)
        assert r.status_code == 200
        t = r.json()
        CREATED_TEAMS.append(t["id"])
        r = requests.patch(f"{API}/teams/{t['id']}",
                           json={"certificate_type_required": "none"},
                           headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        # verifica persistenza
        r = requests.get(f"{API}/teams", headers=admin_h, timeout=30)
        found = next((x for x in r.json() if x["id"] == t["id"]), None)
        assert found and found.get("certificate_type_required") == "none", found


class TestDismissRestoreReview:
    def test_dismiss_and_restore_review(self, parent_h, admin_h, agonistico_team):
        a = _create_athlete(parent_h, agonistico_team["id"], is_minor=True, already_registered=False,
                            full_name="ZZTest MinorDismiss")
        # dismiss
        r = requests.patch(f"{API}/athletes/{a['id']}/dismiss-review", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        season = r.json().get("review_dismissed_season")
        assert season
        # GET include field
        r = requests.get(f"{API}/athletes", headers=admin_h, timeout=30)
        rec = next((x for x in r.json() if x["id"] == a["id"]), None)
        assert rec and rec.get("review_dismissed_season") == season
        # restore
        r = requests.patch(f"{API}/athletes/{a['id']}/restore-review", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/athletes", headers=admin_h, timeout=30)
        rec = next((x for x in r.json() if x["id"] == a["id"]), None)
        assert rec and not rec.get("review_dismissed_season")


class TestRegressionAthletesList:
    def test_get_athletes_returns_enriched_list(self, admin_h):
        r = requests.get(f"{API}/athletes", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            keys = data[0].keys()
            for k in ("status", "team_name"):
                assert k in keys, f"missing {k} in {list(keys)}"
            # review_dismissed_season deve essere presente come chiave (anche se None)
            assert "review_dismissed_season" in keys


# ─────────── Cleanup ───────────

def teardown_module(module):
    """Cleanup atleti+team creati."""
    try:
        tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    except Exception:
        return
    h = {"Authorization": f"Bearer {tok}"}
    for aid in CREATED_ATHLETES:
        try:
            requests.delete(f"{API}/athletes/{aid}", headers=h, timeout=30)
        except Exception:
            pass
    for tid in CREATED_TEAMS:
        try:
            requests.delete(f"{API}/teams/{tid}", headers=h, timeout=30)
        except Exception:
            pass
