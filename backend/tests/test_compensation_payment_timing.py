"""
Tests for new society setting `compensation_payment_timing` (same_month vs next_month).
Validates:
  - PATCH/GET /api/settings/society persists the field and defaults to same_month.
  - All threshold-status endpoints (coach/dirigente/collaboratore/atleta PRO) return 200
    in both modes and reflect the December-shift in next_month mode.
  - /api/admin/persons/{id}/compensation-summary exposes fiscal_year AND fiscal_year_next
    without 500 in both modes.
  - Non-regression: with same_month the numeric output is identical to the pre-feature state.
Reference coach: 69adf7618a40c8115bda5c2d (RICA FEDE), monthly 1700.
Admin: vincenzo.ciucarelli@gmail.com / Test1234 (Pallavolo Perugia).
IMPORTANT: setting is restored to 'same_month' at teardown to avoid altering demo data.
"""
import os
import copy
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASS = "Test1234"
COACH_ID = "69adf7618a40c8115bda5c2d"  # RICA FEDE monthly 1700
YEAR = 2026


# --- fixtures ---------------------------------------------------------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    assert token, "No auth token in login response"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module", autouse=True)
def restore_timing(session):
    """Guarantees the society setting is restored to same_month at the end of the module."""
    yield
    try:
        session.patch(
            f"{BASE_URL}/api/settings/society",
            json={"compensation_payment_timing": "same_month"},
            timeout=15,
        )
    except Exception:
        pass


def _set_timing(session, value: str) -> dict:
    r = session.patch(
        f"{BASE_URL}/api/settings/society",
        json={"compensation_payment_timing": value},
        timeout=15,
    )
    assert r.status_code == 200, f"PATCH timing={value} failed: {r.status_code} {r.text}"
    return r.json()


def _get_society_settings(session) -> dict:
    r = session.get(f"{BASE_URL}/api/settings/society", timeout=15)
    assert r.status_code == 200, f"GET society settings failed: {r.status_code} {r.text}"
    return r.json()


# --- 1. settings persistence ------------------------------------------------
class TestSettingsPersistence:
    def test_default_is_same_month(self, session):
        _set_timing(session, "same_month")
        data = _get_society_settings(session)
        assert data.get("compensation_payment_timing") == "same_month"

    def test_patch_next_month_persists(self, session):
        _set_timing(session, "next_month")
        data = _get_society_settings(session)
        assert data.get("compensation_payment_timing") == "next_month"

    def test_patch_back_to_same_month(self, session):
        _set_timing(session, "same_month")
        data = _get_society_settings(session)
        assert data.get("compensation_payment_timing") == "same_month"


# --- 2. snapshot in same_month (baseline for regression) --------------------
@pytest.fixture(scope="module")
def snapshot_same_month(session):
    """Fetches the status payload for the reference coach in same_month."""
    _set_timing(session, "same_month")
    r = session.get(f"{BASE_URL}/api/coach/{COACH_ID}/threshold-status/{YEAR}")
    assert r.status_code == 200, f"coach threshold-status (same_month) failed: {r.status_code} {r.text}"
    data = r.json()
    return copy.deepcopy(data)


# --- 3. coach endpoint ------------------------------------------------------
class TestCoachThresholdStatus:
    def test_same_month_no_500(self, session, snapshot_same_month):
        d = snapshot_same_month
        assert "yearly_total" in d
        assert isinstance(d["yearly_total"], (int, float))

    def test_next_month_no_500_and_differs(self, session, snapshot_same_month):
        _set_timing(session, "next_month")
        r = session.get(f"{BASE_URL}/api/coach/{COACH_ID}/threshold-status/{YEAR}")
        assert r.status_code == 200, f"coach threshold-status (next_month) failed: {r.status_code} {r.text}"
        d = r.json()
        # Known from PRD: same_month 2026 = 7700, next_month 2026 = 9400
        assert d["yearly_total"] != snapshot_same_month["yearly_total"], (
            f"next_month yearly_total ({d['yearly_total']}) should differ from "
            f"same_month ({snapshot_same_month['yearly_total']})"
        )
        # expected value from PRD
        assert abs(d["yearly_total"] - 9400) < 0.5, (
            f"Expected yearly_total ~9400 in next_month 2026 for coach {COACH_ID}, got {d['yearly_total']}"
        )
        assert abs(snapshot_same_month["yearly_total"] - 7700) < 0.5, (
            f"Expected yearly_total ~7700 in same_month 2026 for coach {COACH_ID}, got {snapshot_same_month['yearly_total']}"
        )

    def test_same_month_regression_after_next_month(self, session, snapshot_same_month):
        """Returning to same_month must give the exact same numbers as before touching the flag."""
        _set_timing(session, "same_month")
        r = session.get(f"{BASE_URL}/api/coach/{COACH_ID}/threshold-status/{YEAR}")
        assert r.status_code == 200
        d = r.json()
        assert d["yearly_total"] == snapshot_same_month["yearly_total"], (
            f"Regression! {d['yearly_total']} != {snapshot_same_month['yearly_total']}"
        )


# --- 4. other role endpoints: no 500 in both modes --------------------------
def _pick_one(session, path):
    r = session.get(f"{BASE_URL}{path}", timeout=20)
    if r.status_code != 200:
        return None
    return r.json()


@pytest.fixture(scope="module")
def sample_ids(session):
    """Fetches at least one id per role for the smoke-threshold check.
    Prefer entities with a non-zero monthly_compensation and a contract so that
    the yearly_total actually differs between same_month and next_month."""
    out = {"dirigente": None, "collaboratore": None, "atleta_pro": None}

    # dirigenti via /api/users/dirigenti
    r = session.get(f"{BASE_URL}/api/users/dirigenti")
    if r.status_code == 200:
        items = r.json()
        if isinstance(items, dict):
            items = items.get("dirigenti") or items.get("items") or []
        for d in items or []:
            if (d.get("monthly_compensation") or 0) > 0 and d.get("contract_start_date"):
                out["dirigente"] = d.get("id")
                break

    # collaboratori via /api/collaboratori
    r = session.get(f"{BASE_URL}/api/collaboratori")
    if r.status_code == 200:
        items = r.json()
        if isinstance(items, dict):
            items = items.get("collaboratori") or items.get("items") or []
        for c in items or []:
            if (c.get("monthly_compensation") or 0) > 0 and c.get("contract_start_date"):
                out["collaboratore"] = c.get("id")
                break

    # athletes PRO via /api/prime-squadre/athletes
    r = session.get(f"{BASE_URL}/api/prime-squadre/athletes")
    if r.status_code == 200:
        items = r.json()
        if isinstance(items, dict):
            items = items.get("athletes") or items.get("items") or []
        # fall back to any compensated athlete even if monthly is set at contract-level
        for a in items or []:
            if a.get("athlete_type") == "compensated":
                out["atleta_pro"] = a.get("id")
                break

    return out


class TestOtherRolesNo500:
    @pytest.mark.parametrize("mode", ["same_month", "next_month"])
    def test_dirigente(self, session, sample_ids, mode):
        if not sample_ids["dirigente"]:
            pytest.skip("No dirigente with contract found in demo data")
        _set_timing(session, mode)
        r = session.get(f"{BASE_URL}/api/dirigente/{sample_ids['dirigente']}/threshold-status/{YEAR}")
        assert r.status_code == 200, f"dirigente ({mode}) {r.status_code}: {r.text[:400]}"
        assert "yearly_total" in r.json()

    @pytest.mark.parametrize("mode", ["same_month", "next_month"])
    def test_collaboratore(self, session, sample_ids, mode):
        if not sample_ids["collaboratore"]:
            pytest.skip("No collaboratore found in demo data")
        _set_timing(session, mode)
        r = session.get(f"{BASE_URL}/api/collaboratore/{sample_ids['collaboratore']}/threshold-status/{YEAR}")
        assert r.status_code == 200, f"collaboratore ({mode}) {r.status_code}: {r.text[:400]}"
        assert "yearly_total" in r.json()

    @pytest.mark.parametrize("mode", ["same_month", "next_month"])
    def test_atleta_pro(self, session, sample_ids, mode):
        if not sample_ids["atleta_pro"]:
            pytest.skip("No athlete PRO found in demo data")
        _set_timing(session, mode)
        r = session.get(
            f"{BASE_URL}/api/prime-squadre/athletes/{sample_ids['atleta_pro']}/threshold-status/{YEAR}"
        )
        assert r.status_code == 200, f"athlete PRO ({mode}) {r.status_code}: {r.text[:400]}"


# --- 5. admin compensation-summary ------------------------------------------
class TestCompensationSummary:
    @pytest.mark.parametrize("mode", ["same_month", "next_month"])
    def test_endpoint_both_modes(self, session, mode):
        _set_timing(session, mode)
        # Need a user_id: the coach record stores a user_id -> fetch it via admin coaches list
        r_list = session.get(f"{BASE_URL}/api/admin/coaches-threshold-status/{YEAR}")
        assert r_list.status_code == 200, f"coaches list failed: {r_list.text[:300]}"
        items = r_list.json()
        if isinstance(items, dict):
            items = items.get("coaches") or items.get("items") or []
        target = next((c for c in items if c.get("coach_id") == COACH_ID), None)
        assert target, f"Reference coach {COACH_ID} not found in coaches list"
        user_id = target.get("user_id") or target.get("person_id") or COACH_ID

        r = session.get(f"{BASE_URL}/api/admin/persons/{user_id}/compensation-summary?year={YEAR}")
        # Some installations use the coach_id directly as person-key; retry if 404.
        if r.status_code == 404 and user_id != COACH_ID:
            r = session.get(f"{BASE_URL}/api/admin/persons/{COACH_ID}/compensation-summary?year={YEAR}")
        assert r.status_code == 200, f"compensation-summary ({mode}) {r.status_code}: {r.text[:400]}"
        data = r.json()
        # Endpoint shape: top-level 'fiscal_year_current' + 'fiscal_year_next' (summary),
        # plus 'coach_section'/'athlete_section' each with their own 'fiscal_year' + 'fiscal_year_next' breakdown.
        # The PRD requirement is simply that *both* a current and a next fiscal-year block
        # are returned without 500.
        has_top = "fiscal_year_current" in data and "fiscal_year_next" in data
        has_coach = (data.get("coach_section") or {}).get("fiscal_year") is not None and \
                    (data.get("coach_section") or {}).get("fiscal_year_next") is not None
        assert has_top or has_coach, f"Missing fiscal_year/fiscal_year_next ({mode}): keys={list(data.keys())}"
        # Also sanity-check that in next_month the coach breakdown differs from same_month baseline (10200 vs 11900).
        if has_coach:
            coach_total = data["coach_section"]["fiscal_year"]["total"]
            if mode == "next_month":
                assert abs(coach_total - 11900) < 1.0, (
                    f"next_month coach_section.fiscal_year.total expected ~11900, got {coach_total}"
                )
            else:
                assert abs(coach_total - 10200) < 1.0, (
                    f"same_month coach_section.fiscal_year.total expected ~10200, got {coach_total}"
                )
