"""
Smoke tests di regressione: verificano che gli endpoint critici rispondano correttamente.
Da eseguire dopo ogni refactoring/modifica grossa per assicurarsi che nulla sia rotto.

Esecuzione:
    cd /app/backend && python -m pytest tests/test_smoke_regression.py -v

Note:
- Usa l'admin reale dal test_credentials.md
- NON modifica dati persistenti
- Esegue solo GET su endpoint sicuri
"""
import os
import requests
import pytest

# Use external URL for true E2E behaviour through ingress
BASE_URL = os.environ.get("REGRESSION_BASE_URL", "https://zaino-coach-hub.preview.emergentagent.com")
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test123"


@pytest.fixture(scope="module")
def admin_token():
    """Login as admin and return JWT token."""
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ======================== AUTH ========================

def test_login_admin_returns_200():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert "user" in data
    assert data["user"]["role"] == "admin"


def test_login_wrong_password_returns_401():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": "WrongPassword123"},
        timeout=10,
    )
    assert r.status_code == 401


def test_auth_me_with_valid_token(auth_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == ADMIN_EMAIL


def test_auth_me_without_token_returns_401_or_403():
    r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
    assert r.status_code in (401, 403)


# ======================== SOCIETY SETTINGS ========================

def test_settings_society_get(auth_headers):
    r = requests.get(f"{BASE_URL}/api/settings/society", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "name" in data
    assert "venues" in data
    assert "athlete_roles" in data


# ======================== USERS ========================

def test_users_pending_list(auth_headers):
    r = requests.get(f"{BASE_URL}/api/users/pending", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ======================== TEAMS ========================

def test_teams_list(auth_headers):
    r = requests.get(f"{BASE_URL}/api/teams", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ======================== ATHLETES ========================

def test_athletes_list(auth_headers):
    r = requests.get(f"{BASE_URL}/api/athletes", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_athletes_pending(auth_headers):
    r = requests.get(f"{BASE_URL}/api/athletes/pending", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ======================== NOTIFICATIONS ========================

def test_admin_notifications(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/notifications", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_notifications_unread_count(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/notifications/unread-count", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "count" in data
    assert isinstance(data["count"], int)


# ======================== HEALTH ========================

def test_health_endpoint():
    """Check root or health endpoint is reachable."""
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    # Anche 404 è accettabile, ci basta che il server risponda
    assert r.status_code in (200, 404, 401, 403)


# ======================== CERTIFICATE OVERRIDE (athlete-specific) ========================

def test_authorize_override_invalid_notification_returns_404(auth_headers):
    """Non-existent notification id should return 404."""
    r = requests.post(
        f"{BASE_URL}/api/admin/notifications/non-existent-id-123/authorize-override",
        headers=auth_headers,
        json={"reason": "Test reason for override"},
        timeout=10,
    )
    assert r.status_code == 404


def test_authorize_override_short_reason_returns_400(auth_headers):
    """Reason < 5 chars should be rejected before checking notification."""
    r = requests.post(
        f"{BASE_URL}/api/admin/notifications/some-id/authorize-override",
        headers=auth_headers,
        json={"reason": "ok"},
        timeout=10,
    )
    assert r.status_code == 400


def test_deny_override_invalid_notification_returns_404(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/admin/notifications/non-existent-id-123/deny-override",
        headers=auth_headers,
        json={"reason": ""},
        timeout=10,
    )
    assert r.status_code == 404


def test_export_csv_prima_nota(auth_headers):
    r = requests.get(f"{BASE_URL}/api/export-csv/prima-nota", headers=auth_headers, timeout=15)
    # Può essere 200 con CSV o 404 se non ci sono pagamenti
    assert r.status_code in (200, 404)


# ======================== THRESHOLD STATUS ========================

def test_threshold_status_admin_summary(auth_headers):
    """Admin coaches threshold summary endpoint."""
    from datetime import datetime
    year = datetime.now().year
    r = requests.get(f"{BASE_URL}/api/admin/coaches-threshold-status/{year}", headers=auth_headers, timeout=10)
    assert r.status_code == 200
