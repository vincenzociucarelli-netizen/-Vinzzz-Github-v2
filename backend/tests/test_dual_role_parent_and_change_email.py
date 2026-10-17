"""
Tests for iteration 84 features:
- POST /api/auth/change-email (self-service email change)
- POST /api/athletes/{id}/link-me-as-parent (staff-as-parent link)
- GET  /api/users/me/parent-of
- GET  /api/athletes/my (dual-role: staff+parent → only returns linked kids)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
GIULIA_ID = "698146f951a98f19b5555a42"
GIULIA_ORIGINAL_PARENT_EMAIL = "parent@sportsclub.com"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    # try current email; if changed during test suite, fall back to +test alias
    for email in (ADMIN_EMAIL, "vincenzo.ciucarelli+test@gmail.com"):
        try:
            return _login(email, ADMIN_PASSWORD)
        except Exception:
            continue
    pytest.fail("Cannot login admin")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --- link-me-as-parent + parent-of + /athletes/my dual-role ---

def test_link_me_as_parent_and_parent_of(admin_headers):
    r = requests.post(f"{BASE_URL}/api/athletes/{GIULIA_ID}/link-me-as-parent",
                      json={"slot": "primary"}, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("athlete_id") == GIULIA_ID
    assert data.get("slot") == "primary"

    # parent-of should now include Giulia
    r2 = requests.get(f"{BASE_URL}/api/users/me/parent-of", headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["count"] >= 1
    assert any(a["id"] == GIULIA_ID for a in d2["athletes"])


def test_athletes_my_returns_only_linked_children(admin_headers):
    r = requests.get(f"{BASE_URL}/api/athletes/my", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    # should be ONLY Giulia (parent behaviour), not all 51
    assert isinstance(data, list)
    assert 1 <= len(data) <= 3
    assert any(a.get("id") == GIULIA_ID for a in data)


def test_link_me_invalid_slot(admin_headers):
    r = requests.post(f"{BASE_URL}/api/athletes/{GIULIA_ID}/link-me-as-parent",
                      json={"slot": "bogus"}, headers=admin_headers, timeout=15)
    assert r.status_code in (400, 422)


# --- change-email endpoint ---

def test_change_email_wrong_password(admin_headers):
    r = requests.post(f"{BASE_URL}/api/auth/change-email",
                      json={"current_password": "WRONG", "new_email": "any@x.com"},
                      headers=admin_headers, timeout=15)
    assert r.status_code == 400
    assert "Password" in r.text or "password" in r.text


def test_change_email_duplicate(admin_headers):
    r = requests.post(f"{BASE_URL}/api/auth/change-email",
                      json={"current_password": ADMIN_PASSWORD, "new_email": GIULIA_ORIGINAL_PARENT_EMAIL},
                      headers=admin_headers, timeout=15)
    assert r.status_code == 400
    assert "già usata" in r.text or "already" in r.text.lower()


# --- regression ---

def test_dirigenti_list_at_least_4(admin_headers):
    r = requests.get(f"{BASE_URL}/api/users/dirigenti", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    assert len(r.json()) >= 4
