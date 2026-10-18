"""
🐛 REGRESSION TEST 18/08/2026 — Preseason cover_image preservation on PATCH.

Verifies the fix for the WhatsApp share-preview regression:
- PATCH campaign WITHOUT `cover_image` field → existing cover MUST remain intact.
- PATCH with `cover_image=""` → cover MUST be cleared (explicit removal).
- POST create with cover_image → saved.
- Public endpoints /preseason/public/{id}/cover.jpg and /preseason/share/{id}
  behave correctly (200 image/jpeg with cover, 404 without; og:image points to
  /api/preseason/public/{id}/cover.jpg when cover present).
"""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://zaino-coach-hub.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
EXISTING_CAMPAIGN_ID = "6f3b4944-47b1-4fdf-b0a0-e6b11070ffc3"

# Tiny 1x1 JPEG (smallest valid) as base64 data URI
_TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBD"
    "AQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUB"
    "AQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJico"
    "KSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ"
    "2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMi"
    "MoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOk"
    "paanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+igD/9k="
)
COVER_DATA_URI = "data:image/jpeg;base64," + _TINY_JPEG_B64


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ────────────────────────────────────────────────────────────────────────────
# Regression: existing test campaign cover_image preservation
# ────────────────────────────────────────────────────────────────────────────
class TestCoverPreservationRegression:
    """Main regression: PATCH without cover_image must NOT wipe existing cover."""

    def test_precondition_existing_campaign_has_cover(self, auth_headers):
        """GET dettaglio: la campagna di test deve avere una cover_image valida (setup del main agent)."""
        r = requests.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"GET campaign failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("cover_image"), \
            "Precondition FAIL: existing campaign has NO cover_image; main agent must upload it first"
        assert data["cover_image"].startswith("data:image/"), \
            f"cover_image must be data URI, got: {data['cover_image'][:60]}"

    def test_patch_without_cover_field_preserves_cover(self, auth_headers):
        """PATCH con SOLA description → cover_image intatto (fix principale)."""
        # 1) Save original cover
        r0 = requests.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}",
                          headers=auth_headers, timeout=15)
        original_cover = r0.json().get("cover_image", "")
        original_desc = r0.json().get("description", "")
        assert original_cover, "Precondition: cover deve esistere"

        # 2) PATCH change ONLY description — DO NOT include cover_image
        new_desc = original_desc + " [regression-test-marker]"
        r1 = requests.patch(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}",
                            headers=auth_headers,
                            json={"description": new_desc}, timeout=15)
        assert r1.status_code == 200, f"PATCH failed: {r1.status_code} {r1.text[:200]}"

        # 3) Verify cover_image UNCHANGED
        r2 = requests.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}",
                          headers=auth_headers, timeout=15)
        after = r2.json()
        assert after.get("description") == new_desc, "Description not updated"
        assert after.get("cover_image") == original_cover, \
            "REGRESSION: cover_image was modified by a PATCH that didn't include it!"

        # 4) Restore original description (cleanup)
        requests.patch(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}",
                       headers=auth_headers,
                       json={"description": original_desc}, timeout=15)

    def test_public_cover_jpg_returns_image(self):
        """GET /preseason/public/{id}/cover.jpg → 200 image/jpeg."""
        r = requests.get(f"{BASE_URL}/api/preseason/public/{EXISTING_CAMPAIGN_ID}/cover.jpg", timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/"), \
            f"Content-Type must be image/*, got: {r.headers.get('content-type')}"
        assert len(r.content) > 100, "Image body too small"

    def test_public_share_html_contains_og_image_pointing_to_cover_endpoint(self):
        """GET /preseason/share/{id} → HTML con og:image = /api/preseason/public/{id}/cover.jpg."""
        r = requests.get(f"{BASE_URL}/api/preseason/share/{EXISTING_CAMPAIGN_ID}", timeout=15)
        assert r.status_code == 200
        html = r.text
        assert 'property="og:image"' in html, "og:image meta tag missing"
        expected_url_fragment = f"/api/preseason/public/{EXISTING_CAMPAIGN_ID}/cover.jpg"
        assert expected_url_fragment in html, \
            f"og:image should reference cover endpoint, HTML fragment: {html[html.find('og:image')-50:html.find('og:image')+200]}"


# ────────────────────────────────────────────────────────────────────────────
# PATCH with explicit clear (cover_image="")
# ────────────────────────────────────────────────────────────────────────────
class TestPatchExplicitCoverManagement:
    """Verify PATCH with cover_image explicit values works (create test campaign)."""

    campaign_id = None

    def test_create_campaign_with_cover(self, auth_headers):
        """POST /preseason/campaigns con cover_image → salvato."""
        payload = {
            "title": "TEST_regression_cover_preservation",
            "season": "2099/2100",
            "description": "TEST_ regression 18/08/2026",
            "cover_image": COVER_DATA_URI,
        }
        r = requests.post(f"{BASE_URL}/api/preseason/campaigns",
                          headers=auth_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text[:200]}"
        created = r.json()
        assert created.get("id"), "No id in create response"
        TestPatchExplicitCoverManagement.campaign_id = created["id"]

        # Verify persisted
        r2 = requests.get(f"{BASE_URL}/api/preseason/campaigns/{created['id']}",
                          headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("cover_image", "").startswith("data:image/jpeg"), \
            "cover_image not persisted on create"

    def test_patch_without_cover_preserves_new_campaign(self, auth_headers):
        """PATCH con solo title → cover_image intatta."""
        cid = TestPatchExplicitCoverManagement.campaign_id
        assert cid, "test order: create must run first"

        r1 = requests.patch(f"{BASE_URL}/api/preseason/campaigns/{cid}",
                            headers=auth_headers,
                            json={"title": "TEST_regression_cover_preservation_v2"}, timeout=15)
        assert r1.status_code == 200

        r2 = requests.get(f"{BASE_URL}/api/preseason/campaigns/{cid}",
                          headers=auth_headers, timeout=15)
        data = r2.json()
        assert data.get("title") == "TEST_regression_cover_preservation_v2"
        assert data.get("cover_image", "").startswith("data:image/jpeg"), \
            "REGRESSION: cover_image lost after title-only PATCH"

    def test_patch_with_empty_cover_clears_it(self, auth_headers):
        """PATCH con cover_image="" → cover azzerata; cover.jpg endpoint restituisce 404."""
        cid = TestPatchExplicitCoverManagement.campaign_id
        assert cid

        r1 = requests.patch(f"{BASE_URL}/api/preseason/campaigns/{cid}",
                            headers=auth_headers,
                            json={"cover_image": ""}, timeout=15)
        assert r1.status_code == 200

        r2 = requests.get(f"{BASE_URL}/api/preseason/campaigns/{cid}",
                          headers=auth_headers, timeout=15)
        assert r2.json().get("cover_image", "") == "", "cover_image should be empty after explicit clear"

        # Public endpoint must now 404
        r3 = requests.get(f"{BASE_URL}/api/preseason/public/{cid}/cover.jpg", timeout=15)
        assert r3.status_code == 404, f"After clearing cover, cover.jpg must be 404, got {r3.status_code}"

    def test_patch_re_add_cover(self, auth_headers):
        """Re-set cover via PATCH e verifica endpoint public torna 200 image."""
        cid = TestPatchExplicitCoverManagement.campaign_id
        assert cid

        r1 = requests.patch(f"{BASE_URL}/api/preseason/campaigns/{cid}",
                            headers=auth_headers,
                            json={"cover_image": COVER_DATA_URI}, timeout=15)
        assert r1.status_code == 200

        r2 = requests.get(f"{BASE_URL}/api/preseason/public/{cid}/cover.jpg", timeout=15)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")

    def test_cleanup_delete_test_campaign(self, auth_headers):
        cid = TestPatchExplicitCoverManagement.campaign_id
        if cid:
            requests.delete(f"{BASE_URL}/api/preseason/campaigns/{cid}",
                            headers=auth_headers, timeout=15)


# ────────────────────────────────────────────────────────────────────────────
# 404 case: campaign without cover_image
# ────────────────────────────────────────────────────────────────────────────
class TestPublicEndpointsNoCover:
    def test_cover_jpg_404_when_no_cover(self, auth_headers):
        """Campagna senza cover_image → /public/{id}/cover.jpg = 404; og:image fallback."""
        payload = {
            "title": "TEST_no_cover",
            "season": "2099/2100",
            "description": "TEST_ no cover",
        }
        r = requests.post(f"{BASE_URL}/api/preseason/campaigns",
                          headers=auth_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201)
        cid = r.json()["id"]
        try:
            r2 = requests.get(f"{BASE_URL}/api/preseason/public/{cid}/cover.jpg", timeout=15)
            assert r2.status_code == 404, f"Expected 404, got {r2.status_code}"

            r3 = requests.get(f"{BASE_URL}/api/preseason/share/{cid}", timeout=15)
            assert r3.status_code == 200
            html = r3.text
            # og:image should NOT point to this campaign's cover endpoint
            assert f"/api/preseason/public/{cid}/cover.jpg" not in html, \
                "og:image incorrectly points to non-existent cover"
            # Note: og:image fallback (society logo) is emitted only if society has a logo configured;
            # not asserted here as it's not part of the current regression scope.
        finally:
            requests.delete(f"{BASE_URL}/api/preseason/campaigns/{cid}",
                            headers=auth_headers, timeout=15)
