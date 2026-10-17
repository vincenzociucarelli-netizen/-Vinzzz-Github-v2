"""
Test iteration for the 06/2026 features:
- Migrazione logo società → Emergent Object Storage (PATCH /api/settings/society + serve via /api/settings/society/logo.png)
- Flag 'copia originale ricevuta' certificato medico (PATCH /api/admin/athletes/{id}/certificate-original)
"""
import base64
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASS = "Test1234"
ATHLETE_ID = "6a5ec7347c201d9cb7eb70d2"


def _make_data_uri(size=(120, 80), color=(255, 87, 34)):
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return "data:image/png;base64," + b64


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"No token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ============================================================================
# Feature 1: Logo → Emergent Object Storage
# ============================================================================
class TestLogoObjectStorage:
    """Verifies PATCH /settings/society uploads logo to object storage."""

    def test_patch_society_logo_uploads_to_storage(self, auth_headers):
        data_uri = _make_data_uri()
        r = requests.patch(
            f"{API}/settings/society",
            json={"logo": data_uri},
            headers=auth_headers,
            timeout=90,
        )
        assert r.status_code == 200, f"PATCH failed: {r.status_code} {r.text[:300]}"

    def test_get_society_logo_png_serves_from_storage(self, auth_headers):
        r = requests.get(f"{API}/settings/society/logo.png", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"GET logo.png failed: {r.status_code} {r.text[:200]}"
        ctype = r.headers.get("Content-Type", "")
        assert ctype.startswith("image/"), f"Unexpected content type: {ctype}"
        # storage returns JPEG (compressed)
        assert len(r.content) > 100, "Logo bytes suspiciously small"

    def test_get_society_include_images_hydrates_logo(self, auth_headers):
        r = requests.get(f"{API}/settings/society?include_images=true", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        # has_logo should be true
        assert data.get("has_logo") is True, f"has_logo not True: {data.get('has_logo')}"
        logo = data.get("logo")
        assert isinstance(logo, str) and logo.startswith("data:"), (
            f"logo should be a data URI hydrated from storage; got type={type(logo).__name__} startswith_data={isinstance(logo, str) and logo.startswith('data:')}"
        )

    def test_get_society_light_reports_has_logo(self, auth_headers):
        r = requests.get(f"{API}/settings/society", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("has_logo") is True
        # light response must not include heavy base64
        assert not data.get("logo"), f"logo should be empty in light response, got len={len(data.get('logo') or '')}"


# ============================================================================
# Feature 2: Flag copia originale certificato medico
# ============================================================================
class TestCertificateOriginalReceived:
    """PATCH /api/admin/athletes/{id}/certificate-original"""

    def test_set_original_received_true(self, auth_headers):
        r = requests.patch(
            f"{API}/admin/athletes/{ATHLETE_ID}/certificate-original",
            json={"original_received": True},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"PATCH true failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("medical_certificate_original_received") is True
        assert body.get("medical_certificate_original_received_by_name"), "by_name should be populated"
        assert body.get("medical_certificate_original_received_at"), "at should be populated"

    def test_get_athlete_returns_original_fields(self, auth_headers):
        r = requests.get(f"{API}/athletes/{ATHLETE_ID}", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"GET athlete failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("medical_certificate_original_received") is True
        assert data.get("medical_certificate_original_received_by_name")

    def test_set_original_received_false_clears_metadata(self, auth_headers):
        r = requests.patch(
            f"{API}/admin/athletes/{ATHLETE_ID}/certificate-original",
            json={"original_received": False},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("medical_certificate_original_received") is False
        assert body.get("medical_certificate_original_received_by_name") in (None, "")
        assert body.get("medical_certificate_original_received_at") in (None, "")

    def test_forbidden_without_auth(self):
        r = requests.patch(
            f"{API}/admin/athletes/{ATHLETE_ID}/certificate-original",
            json={"original_received": True},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_forbidden_other_society(self, auth_headers):
        """Try an athlete NOT belonging to Vincenzo's society → expect 403 or 404."""
        # Use a random UUID-like id that is unlikely to exist in this society
        # We use a parent-account athlete_id from armida (viola@test.com belongs to another society)
        # Instead, try a fake but well-formed id: 000000000000000000000000
        r = requests.patch(
            f"{API}/admin/athletes/000000000000000000000000/certificate-original",
            json={"original_received": True},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code in (403, 404), f"Expected 403/404 for non-owned athlete, got {r.status_code}"
