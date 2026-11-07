# Solleciti rate: GET /api/admin/payments/installment-reminders (read-only)
import os
from datetime import date
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
ADMIN = {"email": "vincenzo.ciucarelli@gmail.com", "password": "Test1234"}
DIRIGENTE = {"email": "lella@dir.com", "password": "Test1234"}
COACH = {"email": "alice@test.com", "password": "Test1234"}
EP = f"{BASE_URL}/api/admin/payments/installment-reminders"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        return None
    return r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers():
    t = _login(ADMIN)
    if not t:
        pytest.skip("admin login failed")
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def data(admin_headers):
    r = requests.get(EP, headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


# Auth
def test_no_auth_rejected():
    r = requests.get(EP, timeout=30)
    assert r.status_code in (401, 403)


def test_invalid_token_rejected():
    r = requests.get(EP, headers={"Authorization": "Bearer invalid"}, timeout=30)
    assert r.status_code in (401, 403)


def test_coach_forbidden():
    t = _login(COACH)
    if not t:
        pytest.skip("coach login failed")
    r = requests.get(EP, headers={"Authorization": f"Bearer {t}"}, timeout=30)
    assert r.status_code == 403


def test_dirigente_allowed():
    t = _login(DIRIGENTE)
    if not t:
        pytest.skip("dirigente login failed")
    r = requests.get(EP, headers={"Authorization": f"Bearer {t}"}, timeout=60)
    assert r.status_code == 200


# Structure
def test_top_level(data):
    assert isinstance(data["society_name"], str)
    date.fromisoformat(data["today"])
    assert [i["installment_number"] for i in data["installments"]] == [1, 2, 3]


def test_installment_fields_and_counts(data):
    for inst in data["installments"]:
        for k in ("label", "paid_count", "unpaid_count", "overdue_count", "unpaid_residual", "paid", "unpaid"):
            assert k in inst
        assert inst["paid_count"] == len(inst["paid"])
        assert inst["unpaid_count"] == len(inst["unpaid"])
        assert inst["overdue_count"] == sum(1 for u in inst["unpaid"] if u["overdue"])
        assert abs(inst["unpaid_residual"] - sum(u["residual"] for u in inst["unpaid"])) < 0.02


def test_row_fields(data):
    for inst in data["installments"]:
        for p in inst["paid"]:
            for k in ("athlete_id", "athlete_name", "team_name", "amount", "paid_date"):
                assert k in p
        for u in inst["unpaid"]:
            for k in ("athlete_id", "athlete_name", "team_name", "label", "amount", "residual",
                      "paid_so_far", "due_date", "overdue", "phones"):
                assert k in u
            assert isinstance(u["phones"], dict)
            assert set(u["phones"].keys()) <= {"atleta", "padre", "madre"}
            assert all(v.strip() for v in u["phones"].values())


def test_overdue_logic(data):
    today = date.fromisoformat(data["today"])
    for inst in data["installments"]:
        for u in inst["unpaid"]:
            expected = bool(u["due_date"] and date.fromisoformat(u["due_date"]) < today and u["residual"] > 0)
            assert u["overdue"] == expected, u


def test_unpaid_sorted_overdue_first(data):
    for inst in data["installments"]:
        flags = [u["overdue"] for u in inst["unpaid"]]
        assert flags == sorted(flags, reverse=True)


def test_no_duplicate_athlete_per_rata(data):
    for inst in data["installments"]:
        paid_ids = [p["athlete_id"] for p in inst["paid"]]
        unpaid_ids = [u["athlete_id"] for u in inst["unpaid"]]
        assert len(paid_ids) == len(set(paid_ids))
        assert len(unpaid_ids) == len(set(unpaid_ids))
        assert not (set(paid_ids) & set(unpaid_ids))


def test_unpaid_residual_positive(data):
    # A row in "unpaid" should have something left to pay
    bad = [(i["installment_number"], u["athlete_name"], u["amount"], u["residual"])
           for i in data["installments"] for u in i["unpaid"] if u["residual"] <= 0]
    assert not bad, f"unpaid rows with residual<=0: {bad[:5]}"
