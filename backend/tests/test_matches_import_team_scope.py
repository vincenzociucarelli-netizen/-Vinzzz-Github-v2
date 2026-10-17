"""
Backend tests — iteration 122
Focus: POST /api/matches/import — upsert scope per TEAM_ID (30/08/2026 bugfix)

Scenari testati:
 1) Import gara #1 su TEAM_A + import gara #1 su TEAM_B => coesistono entrambe
    (l'import di B NON deve cancellare la gara #1 di A).
 2) Re-import della gara #1 di TEAM_A con opponent cambiato => la gara di A
    viene aggiornata (unica), la gara #1 di TEAM_B resta intatta.

Cleanup finale: elimina le gare create tramite DELETE /api/matches/{id}.
"""

import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set in frontend/.env"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"


# ---------------------------- Fixtures ----------------------------

@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_info(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def two_teams(admin_headers, admin_info):
    """Ritorna due team_id ESISTENTI DIVERSI della stessa società (o creane 2)."""
    r = requests.get(f"{API}/teams", headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"GET /teams failed: {r.status_code} {r.text}"
    teams = r.json()
    society_id = admin_info.get("society_id")
    if society_id:
        teams = [t for t in teams if t.get("society_id") == society_id] or teams
    assert len(teams) >= 1, "No teams in society"

    created_ids = []

    def _create_temp_team(suffix):
        payload = {
            "name": f"TEST_TEAMSCOPE_{suffix}_{uuid.uuid4().hex[:6].upper()}",
            "category": "TEST",
            "gender": "F",
        }
        rc = requests.post(f"{API}/teams", headers=admin_headers, json=payload, timeout=30)
        assert rc.status_code in (200, 201), f"Create team failed: {rc.status_code} {rc.text}"
        t = rc.json()
        created_ids.append(t["id"])
        return t["id"]

    if len(teams) >= 2:
        team_a = teams[0]["id"]
        team_b = teams[1]["id"]
    elif len(teams) == 1:
        team_a = teams[0]["id"]
        team_b = _create_temp_team("B")
    else:
        team_a = _create_temp_team("A")
        team_b = _create_temp_team("B")

    yield team_a, team_b

    # cleanup temp teams
    for tid in created_ids:
        try:
            requests.delete(f"{API}/teams/{tid}", headers=admin_headers, timeout=30)
        except Exception:
            pass


def _future_saturday(weeks_ahead=2):
    d = datetime.utcnow()
    days_ahead = (5 - d.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return (d + timedelta(days=days_ahead + 7 * (weeks_ahead - 1))).replace(
        hour=17, minute=30, second=0, microsecond=0
    )


def _get_matches(admin_headers):
    r = requests.get(f"{API}/matches", headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"GET /matches failed: {r.status_code} {r.text}"
    return r.json()


def _find_matches(all_matches, match_number, team_id):
    return [m for m in all_matches
            if m.get("match_number") == match_number and m.get("team_id") == team_id]


# ============================================================
# Test class
# ============================================================

class TestMatchesImportTeamScope:
    """Upsert scoped per (society_id, team_id, match_number) - bug fix 30/08/2026."""

    # Unique match_number for this session (short digits to simulate real "1,2,3..." numbering)
    # Note: for reliable isolation from other test runs we prefix with TEST_ + suffix.
    _match_number = f"TEST_S1_{uuid.uuid4().hex[:6].upper()}"

    def test_1_import_team_a_match_one(self, admin_headers, two_teams):
        team_a, _ = two_teams
        date_str = _future_saturday(2).strftime("%d/%m/%Y %H:%M")

        payload = {
            "matches": [{
                "team_id": team_a,
                "match_number": self._match_number,
                "date": date_str,
                "opponent": "TEST_ROMA",
                "home_away": "home",
                "venue": "TEST_PalaSport_A",
            }]
        }
        r = requests.post(f"{API}/matches/import", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"Import A failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("imported") == 1, f"imported != 1: {body}"

        # Verify persisted
        all_m = _get_matches(admin_headers)
        found = _find_matches(all_m, self._match_number, team_a)
        assert len(found) == 1, f"TEAM_A gara {self._match_number} non trovata (o duplicata): {len(found)}"
        assert found[0]["opponent"] == "TEST_ROMA"

    def test_2_import_team_b_same_match_number_keeps_team_a(self, admin_headers, two_teams):
        team_a, team_b = two_teams
        assert team_a != team_b, "TEAM_A and TEAM_B must differ"

        date_str = _future_saturday(3).strftime("%d/%m/%Y %H:%M")
        payload = {
            "matches": [{
                "team_id": team_b,
                "match_number": self._match_number,
                "date": date_str,
                "opponent": "TEST_TERAMO",
                "home_away": "away",
                "venue": "TEST_PalaSport_B",
            }]
        }
        r = requests.post(f"{API}/matches/import", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"Import B failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("imported") == 1, f"imported != 1 for team B: {body}"

        # Both must exist now
        all_m = _get_matches(admin_headers)
        found_a = _find_matches(all_m, self._match_number, team_a)
        found_b = _find_matches(all_m, self._match_number, team_b)

        assert len(found_a) == 1, (
            f"❌ BUG: TEAM_A gara {self._match_number} è stata CANCELLATA dopo import di TEAM_B. "
            f"Trovate: {len(found_a)}"
        )
        assert found_a[0]["opponent"] == "TEST_ROMA", (
            f"TEAM_A gara alterata: opponent={found_a[0].get('opponent')}"
        )
        assert len(found_b) == 1, f"TEAM_B gara {self._match_number} non trovata: {len(found_b)}"
        assert found_b[0]["opponent"] == "TEST_TERAMO"

    def test_3_reimport_team_a_updates_only_team_a(self, admin_headers, two_teams):
        team_a, team_b = two_teams
        date_str = _future_saturday(4).strftime("%d/%m/%Y %H:%M")

        payload = {
            "matches": [{
                "team_id": team_a,
                "match_number": self._match_number,
                "date": date_str,
                "opponent": "TEST_MILANO",
                "home_away": "home",
                "venue": "TEST_PalaSport_A",
            }]
        }
        r = requests.post(f"{API}/matches/import", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"Re-import A failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("imported") == 1, f"re-import imported != 1: {body}"
        # updated_count should be 1 (esisteva già la gara match_number per team_a)
        # Verifica soft — solo log/report se disponibile
        # assert body.get("updated") == 1  # non obbligatorio

        all_m = _get_matches(admin_headers)
        found_a = _find_matches(all_m, self._match_number, team_a)
        found_b = _find_matches(all_m, self._match_number, team_b)

        assert len(found_a) == 1, (
            f"❌ Re-import TEAM_A ha creato duplicati: {len(found_a)} occorrenze."
        )
        assert found_a[0]["opponent"] == "TEST_MILANO", (
            f"❌ Opponent TEAM_A non aggiornato: {found_a[0].get('opponent')} (atteso TEST_MILANO)"
        )
        assert len(found_b) == 1, (
            f"❌ BUG: TEAM_B gara {self._match_number} è stata CANCELLATA dopo re-import di TEAM_A. "
            f"Trovate: {len(found_b)}"
        )
        assert found_b[0]["opponent"] == "TEST_TERAMO", (
            f"❌ TEAM_B gara alterata: opponent={found_b[0].get('opponent')} (atteso TEST_TERAMO)"
        )

    def test_4_cleanup_created_matches(self, admin_headers, two_teams):
        team_a, team_b = two_teams
        all_m = _get_matches(admin_headers)
        to_delete = [m for m in all_m if m.get("match_number") == self._match_number
                     and m.get("team_id") in (team_a, team_b)]
        for m in to_delete:
            try:
                rd = requests.delete(f"{API}/matches/{m['id']}", headers=admin_headers, timeout=30)
                # 200 or 204 accepted
                assert rd.status_code in (200, 204, 404), f"DELETE failed: {rd.status_code} {rd.text}"
            except Exception as e:
                print(f"Cleanup warning: {e}")

        # verify gone
        all_m2 = _get_matches(admin_headers)
        residual = [m for m in all_m2 if m.get("match_number") == self._match_number]
        assert not residual, f"Cleanup incompleto: {len(residual)} gare TEST residue"
