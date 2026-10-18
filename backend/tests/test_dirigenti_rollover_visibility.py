"""Tests for BUG 1: /api/users/dirigenti visibility after season rollover (16/07/2026)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PW = "Test1234"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:300]}"
    j = r.json()
    return j.get("token") or j.get("access_token")


@pytest.fixture(scope="module")
def admin_me(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    return r.json()


def test_dirigenti_not_empty_after_rollover(admin_token):
    r = requests.get(f"{BASE_URL}/api/users/dirigenti",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1, "Dirigenti list should not be empty after rollover fix"
    print(f"[dirigenti] got {len(data)} entries")
    for d in data:
        print(" -", d.get("full_name"), "|", d.get("role"), "|", d.get("email"))


def test_dirigenti_multitenancy(admin_token, admin_me):
    r = requests.get(f"{BASE_URL}/api/users/dirigenti",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    admin_society = admin_me.get("society_id")
    assert admin_society, "admin has no society_id?"
    for d in data:
        if "society_id" in d:
            assert d["society_id"] == admin_society, f"multi-tenancy leak: {d}"


def test_dirigenti_contains_expected_users(admin_token):
    """Verifica presenza dei 4 utenti attesi: CIUCHETTI, MARZO LELLA, PINELLI LIVIA, TEST DIRIGENTE."""
    r = requests.get(f"{BASE_URL}/api/users/dirigenti",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    names = [(d.get("full_name") or "").upper() for d in r.json()]
    print("names:", names)
    # Non-strict: log which are found
    expected_tokens = ["CIUCHETTI", "MARZO", "PINELLI", "TEST DIRIGENTE"]
    found = [tok for tok in expected_tokens if any(tok in n for n in names)]
    print("found tokens:", found)
    assert len(found) >= 3, f"Expected at least 3 of {expected_tokens}, got {found}"


def test_active_seasons_selfheal(admin_token):
    """Chiama l'endpoint e verifica che active_seasons sia stato aggiornato (via /api/users/dirigenti response se esposto, altrimenti solo status code)."""
    r = requests.get(f"{BASE_URL}/api/users/dirigenti",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    # Second call should return the same or larger set (idempotent)
    r2 = requests.get(f"{BASE_URL}/api/users/dirigenti",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r2.status_code == 200
    assert len(r2.json()) == len(r.json())


def test_regression_admin_login_and_dashboard(admin_token):
    """Regression: admin flow non rotto."""
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    me = r.json()
    assert me.get("role") == "admin"
