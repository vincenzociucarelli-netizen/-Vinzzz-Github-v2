"""Tests per il refactor Fase 2 (gennaio 2026):
- ras_breakdown deve essere presente in coach_section / athlete_section
- earliest_first_year deve restare esposto
- Verifica con Fede Rica (coach 01/09/2025-30/06/2026 @1700€/mese) → 10 elementi quartile=4 amount=1700
"""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://zaino-coach-hub.preview.emergentagent.com"
).rstrip("/")
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PWD = "Test1234"
FEDE_COACH_ID = "69adf7618a40c8115bda5c2d"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PWD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login admin fallito: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    assert token, "Nessun token nella risposta di login"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _get_summary(headers, year=None):
    params = {}
    if year is not None:
        params["year"] = year
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{FEDE_COACH_ID}/compensation-summary",
        headers=headers,
        params=params,
        timeout=20,
    )
    return r


def test_endpoint_200_and_has_earliest_first_year(admin_headers):
    r = _get_summary(admin_headers, year=2026)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "earliest_first_year" in data
    assert data["earliest_first_year"] == 2025, (
        f"Atteso earliest_first_year=2025 per Fede, ricevuto {data['earliest_first_year']}"
    )


def test_coach_section_has_ras_breakdown_with_10_months(admin_headers):
    r = _get_summary(admin_headers, year=2026)
    assert r.status_code == 200
    data = r.json()
    coach = data.get("coach_section") or {}
    assert coach, "coach_section mancante"
    assert "ras_breakdown" in coach, "ras_breakdown mancante in coach_section"
    breakdown = coach["ras_breakdown"]
    assert isinstance(breakdown, list)
    assert len(breakdown) == 10, (
        f"Atteso 10 mesi (set 2025 → giu 2026), trovati {len(breakdown)}"
    )
    # Tutti i mesi pieni → quartile 4, amount 1700
    for item in breakdown:
        assert item["quartile"] == 4, f"quartile != 4 in {item}"
        assert abs(item["amount"] - 1700.0) < 0.01, f"amount != 1700 in {item}"
    # primo mese settembre 2025
    assert breakdown[0]["year"] == 2025 and breakdown[0]["month"] == 9
    # ultimo mese giugno 2026
    assert breakdown[-1]["year"] == 2026 and breakdown[-1]["month"] == 6


def test_coach_section_ras_total_matches_breakdown(admin_headers):
    r = _get_summary(admin_headers, year=2026)
    data = r.json()
    coach = data["coach_section"]
    total = sum(it["amount"] for it in coach["ras_breakdown"])
    assert abs(total - 17000.0) < 0.01, f"Totale breakdown != 17.000, got {total}"
    # Anche il ras_total/ras_grand_total dovrebbe combaciare se presente
    if "ras_total" in coach:
        assert abs(coach["ras_total"] - 17000.0) < 0.01


def test_athlete_section_shape_when_no_athlete(admin_headers):
    """Per Fede (solo coach, no atleta PRO), athlete_section può essere None o vuoto.
    Se presente come dict, deve avere ras_breakdown (lista, eventualmente vuota)."""
    r = _get_summary(admin_headers, year=2026)
    data = r.json()
    athlete = data.get("athlete_section")
    if athlete is None:
        # nessuna sezione atleta — ok
        return
    if isinstance(athlete, dict) and athlete:
        # se popolata, deve includere ras_breakdown
        assert "ras_breakdown" in athlete


def test_year_2025_also_works_and_keeps_breakdown(admin_headers):
    r = _get_summary(admin_headers, year=2025)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["earliest_first_year"] == 2025
    coach = data["coach_section"]
    # ras_breakdown copre l'INTERO contratto (non dipende da year filter)
    assert len(coach["ras_breakdown"]) == 10


def test_unauthorized_returns_401_or_403():
    r = requests.get(
        f"{BASE_URL}/api/admin/persons/{FEDE_COACH_ID}/compensation-summary",
        timeout=10,
    )
    assert r.status_code in (401, 403)
