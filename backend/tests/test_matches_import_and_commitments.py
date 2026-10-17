"""
Backend tests — iteration 120
Focus:
  A) POST /api/matches/import → gara assegnata al team_id passato (menu a tendina);
     riga senza team_id → scartata in `errors`.
  B) GET /api/coach/commitments → una gara (home o away) nascondere l'allenamento
     dello stesso giorno per la stessa squadra.
  C) PATCH /api/settings/society → trial_max_sessions=10 dev'essere salvato tale
     e quale, senza clamp a 5 lato backend.
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
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_info(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def any_team_id(admin_headers, admin_info):
    """Ritorna id di una squadra ESISTENTE della società admin."""
    r = requests.get(f"{API}/teams", headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"GET /teams failed: {r.status_code} {r.text}"
    teams = r.json()
    assert teams, "No teams in society — cannot test import"
    society_id = admin_info.get("society_id")
    if society_id:
        teams = [t for t in teams if t.get("society_id") == society_id] or teams
    return teams[0]["id"], teams[0].get("name", "")


# ============================================================
# (A) IMPORT GARE — team_id assegnato manualmente
# ============================================================

class TestMatchesImport:
    """POST /api/matches/import — team_id from dropdown must be preserved."""

    def _future_saturday(self, weeks=1):
        d = datetime.utcnow()
        # find next Saturday
        days_ahead = (5 - d.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return (d + timedelta(days=days_ahead + 7 * (weeks - 1))).replace(
            hour=17, minute=30, second=0, microsecond=0
        )

    def test_import_assigns_team_id_and_persists(self, admin_headers, any_team_id):
        team_id, team_name = any_team_id
        sat = self._future_saturday(weeks=2)
        date_str = sat.strftime("%d/%m/%Y %H:%M")

        unique_num = f"TEST_AMICH_{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "matches": [
                {
                    "team_id": team_id,
                    "date": date_str,
                    "opponent": "TEST_ROMA",
                    "home_away": "home",
                    "match_number": unique_num,
                    "venue": "TEST_PalaSport",
                }
            ]
        }
        r = requests.post(f"{API}/matches/import", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"Import failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("imported") == 1, f"Import counters: {body}"
        assert body.get("errors") == [] or body.get("errors") is None or len(body["errors"]) == 0, body

        # Verify via GET /api/matches that the created match has the exact team_id
        r2 = requests.get(f"{API}/matches", headers=admin_headers, timeout=30)
        assert r2.status_code == 200, f"GET /matches failed: {r2.status_code} {r2.text}"
        matches = r2.json()
        created = [m for m in matches if m.get("match_number") == unique_num]
        assert len(created) == 1, f"Match {unique_num} not found (or duplicated) in GET /matches"
        got = created[0]
        assert got["team_id"] == team_id, f"team_id mismatch: got {got['team_id']} expected {team_id}"
        assert got["opponent"] == "TEST_ROMA"
        assert got.get("home_away") == "home"
        assert got.get("venue") == "TEST_PalaSport"

        # cleanup
        try:
            mid = got.get("id")
            if mid:
                requests.delete(f"{API}/matches/{mid}", headers=admin_headers, timeout=30)
        except Exception:
            pass

    def test_import_row_without_team_id_goes_to_errors(self, admin_headers):
        sat = self._future_saturday(weeks=3)
        date_str = sat.strftime("%d/%m/%Y %H:%M")
        unique_num = f"TEST_BAD_{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "matches": [
                {
                    # team_id intentionally missing
                    "date": date_str,
                    "opponent": "TEST_NOTEAM",
                    "home_away": "away",
                    "match_number": unique_num,
                }
            ]
        }
        r = requests.post(f"{API}/matches/import", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"Import call failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("imported") == 0, f"Should not import anything: {body}"
        errs = body.get("errors") or []
        assert len(errs) >= 1, f"Expected at least one error entry, got: {body}"
        assert any("team_id" in e.lower() or "dati manc" in e.lower() for e in errs), errs


# ============================================================
# (B) COMMITMENTS — gara annulla allenamento nello stesso giorno
# ============================================================

class TestCommitmentsHideTrainingOnMatchDay:
    """A match (home OR away) on a given day must HIDE the training for that team on that day."""

    @pytest.fixture(scope="class")
    def _fixture_team_with_training(self, admin_headers, admin_info):
        """Trova (o prepara) una squadra della società con:
         - activity_start_date impostata (data passata)
         - almeno un training_session in un weekday che ricade in un giorno
           dei prossimi 7 diverso da un altro weekday di allenamento.
        Ritorna (team, day_with_match, day_without_match) dove i giorni sono datetime
        entro i prossimi 7 giorni.
        """
        society_id = admin_info.get("society_id")
        r = requests.get(f"{API}/teams", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        teams = r.json()
        if society_id:
            teams = [t for t in teams if t.get("society_id") == society_id] or teams

        days_map = {0: "Lunedì", 1: "Martedì", 2: "Mercoledì", 3: "Giovedì",
                    4: "Venerdì", 5: "Sabato", 6: "Domenica"}
        rev_days = {v: k for k, v in days_map.items()}

        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        # Pick a team with >=2 different training days, so we can have one with a
        # match and one without.
        chosen = None
        for t in teams:
            sessions = t.get("training_sessions") or []
            uniq_days = sorted({s.get("day") for s in sessions if s.get("day") in rev_days})
            if len(uniq_days) >= 2:
                chosen = (t, uniq_days)
                break

        if chosen is None:
            # Fallback: create a temporary team with two training days
            payload = {
                "name": f"TEST_TEAM_{uuid.uuid4().hex[:6].upper()}",
                "category": "TEST",
                "gender": "F",
                "training_sessions": [
                    {"day": "Sabato", "timeStart": "17:00", "timeEnd": "19:00", "venue": "TEST_Pal"},
                    {"day": "Mercoledì", "timeStart": "18:00", "timeEnd": "20:00", "venue": "TEST_Pal"},
                ],
                "activity_start_date": (today - timedelta(days=30)).isoformat(),
            }
            rc = requests.post(f"{API}/teams", headers=admin_headers, json=payload, timeout=30)
            assert rc.status_code in (200, 201), f"Create team failed: {rc.status_code} {rc.text}"
            t = rc.json()
            uniq_days = ["Sabato", "Mercoledì"]
            chosen = (t, uniq_days)
            created_new = True
        else:
            t, uniq_days = chosen
            created_new = False
            # Ensure activity_start_date is set in the past (patch if missing)
            if not t.get("activity_start_date"):
                past = (today - timedelta(days=30)).isoformat()
                rp = requests.patch(
                    f"{API}/teams/{t['id']}",
                    headers=admin_headers,
                    json={"activity_start_date": past},
                    timeout=30,
                )
                # tolerate PATCH vs PUT
                if rp.status_code >= 400:
                    rp = requests.put(
                        f"{API}/teams/{t['id']}",
                        headers=admin_headers,
                        json={"activity_start_date": past},
                        timeout=30,
                    )
                if rp.status_code >= 400:
                    pytest.skip(f"Cannot set activity_start_date on team {t['id']}: {rp.status_code} {rp.text}")
                t["activity_start_date"] = past

        # Pick two upcoming distinct training days within next 7 days
        def next_date_for_weekday(wd_it_name):
            wd = rev_days[wd_it_name]
            for i in range(1, 8):
                d = today + timedelta(days=i)
                if d.weekday() == wd:
                    return d
            return None

        day_with_match = None
        day_without_match = None
        for name in uniq_days:
            d = next_date_for_weekday(name)
            if d is None:
                continue
            if day_with_match is None:
                day_with_match = (name, d)
            elif day_without_match is None and d.date() != day_with_match[1].date():
                day_without_match = (name, d)
                break

        if day_with_match is None or day_without_match is None:
            pytest.skip("Non è stato possibile individuare due giorni di allenamento distinti nei prossimi 7gg")

        yield {
            "team": t,
            "day_with_match": day_with_match,  # (day_name_it, datetime)
            "day_without_match": day_without_match,
            "created_new": created_new,
        }

        # cleanup created team
        if created_new:
            try:
                requests.delete(f"{API}/teams/{t['id']}", headers=admin_headers, timeout=30)
            except Exception:
                pass

    def _flatten_commitments(self, body):
        items = []
        for key in ("today", "tomorrow", "day_after", "upcoming"):
            for it in (body.get(key) or []):
                items.append((key, it))
        return items

    def test_match_hides_training_same_day(self, admin_headers, admin_info, _fixture_team_with_training):
        ctx = _fixture_team_with_training
        team = ctx["team"]
        team_id = team["id"]
        day_name_match, date_match = ctx["day_with_match"]
        day_name_free, date_free = ctx["day_without_match"]

        # 1) Ensure no leftover match on those days for this team → NOT strictly needed,
        #    the test creates a match on `date_match` and checks the results.

        # 2) Create/import a match for team on date_match
        match_number = f"TEST_HIDE_{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "matches": [
                {
                    "team_id": team_id,
                    "date": date_match.strftime("%d/%m/%Y %H:%M"),
                    "opponent": "TEST_HIDE_TRAINING",
                    "home_away": "home",
                    "match_number": match_number,
                    "venue": "TEST_Pal",
                }
            ]
        }
        r = requests.post(f"{API}/matches/import", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"Import failed: {r.status_code} {r.text}"
        assert r.json().get("imported") == 1

        # 3) Find a coach with this team in assigned_teams (or use athlete_id fallback)
        # First try users
        target_user_id = None
        target_athlete_id = None
        try:
            r_users = requests.get(f"{API}/users", headers=admin_headers, timeout=30)
            if r_users.status_code == 200:
                for u in r_users.json():
                    if team_id in (u.get("assigned_teams") or []):
                        target_user_id = u.get("id")
                        break
        except Exception:
            pass

        if not target_user_id:
            # Fallback: use an athlete of that team
            try:
                r_ath = requests.get(f"{API}/athletes", headers=admin_headers, timeout=30)
                if r_ath.status_code == 200:
                    ath_list = r_ath.json() if isinstance(r_ath.json(), list) else r_ath.json().get("athletes", [])
                    for a in ath_list:
                        tids = [a.get("team_id"), a.get("team_id_2"), a.get("team_id_secondary")]
                        tids += a.get("team_ids") or []
                        if team_id in tids:
                            target_athlete_id = a.get("id")
                            break
            except Exception:
                pass

        assert target_user_id or target_athlete_id, (
            "Nessun coach con assigned_teams contenente questa squadra né un atleta della squadra: "
            "impossibile chiamare /coach/commitments per validare (setup dati carente)."
        )

        # 4) Call /coach/commitments
        qs = {}
        if target_user_id:
            qs["user_id"] = target_user_id
        else:
            qs["athlete_id"] = target_athlete_id
        r_comm = requests.get(f"{API}/coach/commitments", headers=admin_headers, params=qs, timeout=30)
        assert r_comm.status_code == 200, f"commitments failed: {r_comm.status_code} {r_comm.text}"
        body = r_comm.json()

        items = self._flatten_commitments(body)

        # 5) Check: on the match day, NO training for team_id
        d_match_str = date_match.strftime("%d/%m")
        d_free_str = date_free.strftime("%d/%m")
        # For today/tomorrow/day_after buckets we rely on offsets, else on upcoming (has 'date' as %d/%m)
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        offset_match = (date_match.date() - today.date()).days
        offset_free = (date_free.date() - today.date()).days
        bucket_by_offset = {0: "today", 1: "tomorrow", 2: "day_after"}
        bucket_match = bucket_by_offset.get(offset_match, "upcoming")
        bucket_free = bucket_by_offset.get(offset_free, "upcoming")

        # Find any training item for this team on the match day
        def _same_upcoming_day(it, ddate):
            return it.get("date") == ddate.strftime("%d/%m")

        training_on_match_day = []
        for bucket, it in items:
            if it.get("type") != "training":
                continue
            if it.get("team_id") != team_id:
                continue
            if bucket == bucket_match and bucket_match != "upcoming":
                training_on_match_day.append(it)
            elif bucket == "upcoming" and bucket_match == "upcoming" and _same_upcoming_day(it, date_match):
                training_on_match_day.append(it)

        assert len(training_on_match_day) == 0, (
            f"Allenamento NON nascosto nel giorno della gara ({d_match_str}) per team {team_id}: "
            f"trovati {len(training_on_match_day)} item training. Items: {training_on_match_day}"
        )

        # 6) On the free day, the training MUST appear (assuming activity_start_date past)
        training_on_free_day = []
        for bucket, it in items:
            if it.get("type") != "training":
                continue
            if it.get("team_id") != team_id:
                continue
            if bucket == bucket_free and bucket_free != "upcoming":
                training_on_free_day.append(it)
            elif bucket == "upcoming" and bucket_free == "upcoming" and _same_upcoming_day(it, date_free):
                training_on_free_day.append(it)

        assert len(training_on_free_day) >= 1, (
            f"Nessun allenamento visibile nel giorno LIBERO ({d_free_str}) per team {team_id}. "
            f"Items nel bucket {bucket_free}: "
            f"{[it for b, it in items if b == bucket_free]}"
        )

        # cleanup imported match
        try:
            r2 = requests.get(f"{API}/matches", headers=admin_headers, timeout=30)
            for m in (r2.json() if r2.status_code == 200 else []):
                if m.get("match_number") == match_number:
                    requests.delete(f"{API}/matches/{m['id']}", headers=admin_headers, timeout=30)
        except Exception:
            pass


# ============================================================
# (C) SOCIETY SETTINGS — trial_max_sessions must accept up to 10
# ============================================================

class TestTrialMaxSessions:
    def _get_settings(self, headers):
        r = requests.get(f"{API}/settings/society", headers=headers, timeout=30)
        assert r.status_code == 200, f"GET settings failed: {r.status_code} {r.text}"
        return r.json()

    def _patch_settings(self, headers, payload):
        r = requests.patch(f"{API}/settings/society", headers=headers, json=payload, timeout=30)
        if r.status_code == 404 or r.status_code == 405:
            r = requests.put(f"{API}/settings/society", headers=headers, json=payload, timeout=30)
        return r

    def test_trial_max_sessions_accepts_10(self, admin_headers):
        original = self._get_settings(admin_headers).get("trial_max_sessions", 3)
        try:
            r = self._patch_settings(admin_headers, {"trial_max_sessions": 10})
            assert r.status_code == 200, f"PATCH settings failed: {r.status_code} {r.text}"
            got = self._get_settings(admin_headers).get("trial_max_sessions")
            assert got == 10, (
                f"trial_max_sessions non salvato correttamente: atteso 10, ottenuto {got}. "
                "Sospetta un clamp lato backend (max 5)."
            )
        finally:
            # ripristina il valore originale
            self._patch_settings(admin_headers, {"trial_max_sessions": original})

    def test_trial_max_sessions_clamped_to_10_upper(self, admin_headers):
        """Valore > 10 (es. 15) deve essere clampato a 10."""
        original = self._get_settings(admin_headers).get("trial_max_sessions", 3)
        try:
            r = self._patch_settings(admin_headers, {"trial_max_sessions": 15})
            assert r.status_code == 200, f"PATCH settings failed: {r.status_code} {r.text}"
            got = self._get_settings(admin_headers).get("trial_max_sessions")
            assert got == 10, (
                f"trial_max_sessions non clampato correttamente al max: atteso 10, ottenuto {got}."
            )
        finally:
            self._patch_settings(admin_headers, {"trial_max_sessions": original})

    def test_trial_max_sessions_clamped_to_1_lower(self, admin_headers):
        """Valore 0 deve essere clampato a 1."""
        original = self._get_settings(admin_headers).get("trial_max_sessions", 3)
        try:
            r = self._patch_settings(admin_headers, {"trial_max_sessions": 0})
            assert r.status_code == 200, f"PATCH settings failed: {r.status_code} {r.text}"
            got = self._get_settings(admin_headers).get("trial_max_sessions")
            assert got == 1, (
                f"trial_max_sessions non clampato correttamente al min: atteso 1, ottenuto {got}."
            )
        finally:
            self._patch_settings(admin_headers, {"trial_max_sessions": original})
