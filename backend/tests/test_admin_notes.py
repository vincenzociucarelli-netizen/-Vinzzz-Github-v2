"""Tests for Bacheca Note Admin feature (routes/admin_notes.py)."""
import os
import pytest
import requests

BASE_URL = "https://zaino-coach-hub.preview.emergentagent.com"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASS = "Test1234"
COACH_EMAIL = "alice@test.com"
COACH_PASS = "Test1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def coach_token():
    try:
        return _login(COACH_EMAIL, COACH_PASS)
    except AssertionError:
        return None


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_ids():
    return []


def test_non_admin_forbidden(coach_token):
    if not coach_token:
        pytest.skip("Coach token not available")
    r = requests.get(f"{BASE_URL}/api/admin/notes",
                     headers={"Authorization": f"Bearer {coach_token}"}, timeout=15)
    assert r.status_code == 403


def test_create_note(admin_headers, created_ids):
    payload = {"title": "TEST_Nota basic", "priority": "medium", "description": "desc"}
    r = requests.post(f"{BASE_URL}/api/admin/notes", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == "TEST_Nota basic"
    assert data["priority"] == "medium"
    assert data["completed"] is False
    assert data["created_by_name"]
    assert "id" in data
    assert data.get("created_at")
    created_ids.append(data["id"])


def test_list_active_contains_created(admin_headers, created_ids):
    r = requests.get(f"{BASE_URL}/api/admin/notes", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    notes = r.json()
    ids = [n["id"] for n in notes]
    assert created_ids[0] in ids


def test_list_sorted_by_priority(admin_headers, created_ids):
    hp = requests.post(f"{BASE_URL}/api/admin/notes",
                       json={"title": "TEST_High", "priority": "high", "due_date": "2027-01-01"},
                       headers=admin_headers).json()
    lp = requests.post(f"{BASE_URL}/api/admin/notes",
                      json={"title": "TEST_Low", "priority": "low"},
                      headers=admin_headers).json()
    created_ids.extend([hp["id"], lp["id"]])
    r = requests.get(f"{BASE_URL}/api/admin/notes", headers=admin_headers).json()
    # find positions
    ids = [n["id"] for n in r]
    assert ids.index(hp["id"]) < ids.index(lp["id"])


def test_take_and_untake(admin_headers, created_ids):
    nid = created_ids[0]
    r = requests.post(f"{BASE_URL}/api/admin/notes/{nid}/take", headers=admin_headers).json()
    assert r["taken_by_name"]
    assert r["taken_by"]
    r2 = requests.post(f"{BASE_URL}/api/admin/notes/{nid}/untake", headers=admin_headers).json()
    assert r2["taken_by"] is None
    assert r2["taken_by_name"] is None


def test_patch_update(admin_headers, created_ids):
    nid = created_ids[0]
    r = requests.patch(f"{BASE_URL}/api/admin/notes/{nid}",
                       json={"title": "TEST_Nota edited", "priority": "high"},
                       headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "TEST_Nota edited"
    assert data["priority"] == "high"


def test_complete_and_completed_list(admin_headers, created_ids):
    nid = created_ids[0]
    r = requests.post(f"{BASE_URL}/api/admin/notes/{nid}/complete", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["completed"] is True
    assert data["completed_by_name"]
    assert data["completed_at"]

    # active list must not contain it
    active = requests.get(f"{BASE_URL}/api/admin/notes", headers=admin_headers).json()
    assert nid not in [n["id"] for n in active]

    # completed list contains it, DESC by completed_at
    comp = requests.get(f"{BASE_URL}/api/admin/notes/completed", headers=admin_headers).json()
    assert nid in [n["id"] for n in comp]
    # limit param respected
    comp_lim = requests.get(f"{BASE_URL}/api/admin/notes/completed?limit=1",
                            headers=admin_headers).json()
    assert len(comp_lim) <= 1


def test_complete_already_completed_returns_400(admin_headers, created_ids):
    """Spec: 'Non può essere richiamato su nota già completata (400)'"""
    nid = created_ids[0]
    r = requests.post(f"{BASE_URL}/api/admin/notes/{nid}/complete", headers=admin_headers)
    assert r.status_code == 400, f"Expected 400 for double-complete, got {r.status_code}: {r.text}"


def test_reopen(admin_headers, created_ids):
    nid = created_ids[0]
    r = requests.post(f"{BASE_URL}/api/admin/notes/{nid}/reopen", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["completed"] is False
    assert data.get("completed_by") is None


def test_reopen_non_completed_returns_400(admin_headers, created_ids):
    nid = created_ids[0]  # just reopened → not completed
    r = requests.post(f"{BASE_URL}/api/admin/notes/{nid}/reopen", headers=admin_headers)
    assert r.status_code == 400


def test_delete_and_gone(admin_headers, created_ids):
    for nid in list(created_ids):
        r = requests.delete(f"{BASE_URL}/api/admin/notes/{nid}", headers=admin_headers)
        assert r.status_code == 200
    active = requests.get(f"{BASE_URL}/api/admin/notes", headers=admin_headers).json()
    active_ids = [n["id"] for n in active]
    for nid in created_ids:
        assert nid not in active_ids
    # try patch a deleted note → 404
    r = requests.patch(f"{BASE_URL}/api/admin/notes/{created_ids[0]}",
                       json={"title": "x"}, headers=admin_headers)
    assert r.status_code == 404
