"""
⚡ MIGRATION TEST 18/01/2026 — Emergent Object Storage per copertine campagne preseason.

Verifica Fase B (migrazione immagini base64 → object storage):
  - CREATE con cover_image data URI → cover_storage_path valorizzato,
    cover_image VUOTO in response; cover.jpg servita 200 image/jpeg.
  - EDIT senza cover_image → cover invariata (storage path preservato, cover.jpg 200).
  - EDIT con nuovo cover_image → nuovo cover_storage_path, cover.jpg 200.
  - EDIT con cover_image="" → cover_storage_path svuotato, cover.jpg 404.
  - Lista /preseason/campaigns → has_cover:true quando c'è storage OPPURE base64,
    cover_image NON incluso nel payload lista (performance).
  - Fallback base64 (retrocompat): campagna 6f3b4944-... (solo cover_image) →
    cover.jpg 200 via dual-read; share HTML og:image punta a cover.jpg.
"""
import base64
import os

import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://zaino-coach-hub.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"

# Campagna storica che DEVE restare con cover_image=base64 (senza storage_path)
# per validare il fallback dual-read. NON eliminare mai.
LEGACY_FALLBACK_CAMPAIGN_ID = "6f3b4944-47b1-4fdf-b0a0-e6b11070ffc3"

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


# ────────────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_campaign_id(auth_headers):
    """Crea una campagna con cover per riusarla nei test edit; cleanup finale."""
    payload = {
        "title": "TEST_object_storage_cover",
        "season": "2099/2100",
        "description": "TEST_ object storage migration 18/01/2026",
        "cover_image": COVER_DATA_URI,
    }
    r = requests.post(
        f"{BASE_URL}/api/preseason/campaigns", headers=auth_headers, json=payload, timeout=30
    )
    assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text[:300]}"
    cid = r.json()["id"]
    yield cid
    # Cleanup
    try:
        requests.delete(
            f"{BASE_URL}/api/preseason/campaigns/{cid}", headers=auth_headers, timeout=15
        )
    except Exception:
        pass


# ────────────────────────────────────────────────────────────────────────────
# CREATE with cover → storage path populated, base64 empty
# ────────────────────────────────────────────────────────────────────────────
class TestCreateWithCoverGoesToStorage:
    def test_create_response_has_storage_path_and_empty_base64(self, auth_headers, created_campaign_id):
        """POST con cover_image → response ha cover_storage_path valorizzato e cover_image vuoto."""
        # Detail GET (create fixture already validated 201, but re-fetch to be explicit)
        r = requests.get(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        sp = data.get("cover_storage_path") or ""
        cover_b64 = data.get("cover_image") or ""
        assert sp, f"cover_storage_path must be set, got: {sp!r}"
        assert sp.startswith("registrateam/uploads/") and sp.endswith(".jpg"), (
            f"Unexpected storage path format: {sp}"
        )
        assert f"/covers/{created_campaign_id}.jpg" in sp, (
            f"Storage path must include campaign_id: {sp}"
        )
        assert cover_b64 == "", (
            f"cover_image should be EMPTY after storage migration, got len={len(cover_b64)}"
        )

    def test_public_cover_jpg_served_from_storage(self, created_campaign_id):
        """GET /preseason/public/{id}/cover.jpg → 200 image/jpeg (servita dallo storage)."""
        r = requests.get(
            f"{BASE_URL}/api/preseason/public/{created_campaign_id}/cover.jpg", timeout=30
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        ctype = r.headers.get("content-type", "")
        assert ctype.startswith("image/"), f"Expected image/*, got: {ctype}"
        # The tiny JPEG we uploaded is ~700 bytes; server may normalize it to a JPEG that is still small.
        assert len(r.content) > 100, f"Image body too small: {len(r.content)} bytes"
        # Verify it's a JPEG magic number
        assert r.content[:2] == b"\xff\xd8", "Response body is not a JPEG (missing FFD8 marker)"


# ────────────────────────────────────────────────────────────────────────────
# EDIT without cover_image → storage path preserved (no wipe)
# ────────────────────────────────────────────────────────────────────────────
class TestEditWithoutTouchingCover:
    def test_patch_description_only_preserves_storage_path(self, auth_headers, created_campaign_id):
        """PATCH cambiando solo description → cover_storage_path invariato + cover.jpg ancora 200."""
        # Snapshot before
        r0 = requests.get(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            timeout=15,
        )
        before_sp = r0.json().get("cover_storage_path", "")
        before_desc = r0.json().get("description", "")
        assert before_sp, "Precondition: storage path must exist"

        # PATCH only description (no cover_image field)
        new_desc = before_desc + " [edit-marker]"
        r1 = requests.patch(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            json={"description": new_desc},
            timeout=15,
        )
        assert r1.status_code == 200, f"PATCH failed: {r1.status_code} {r1.text[:200]}"

        # Verify storage path unchanged
        r2 = requests.get(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            timeout=15,
        )
        after = r2.json()
        assert after.get("description") == new_desc, "Description not updated"
        assert after.get("cover_storage_path") == before_sp, (
            f"REGRESSION: cover_storage_path modified by description-only PATCH "
            f"({before_sp!r} → {after.get('cover_storage_path')!r})"
        )

        # Public cover still available
        r3 = requests.get(
            f"{BASE_URL}/api/preseason/public/{created_campaign_id}/cover.jpg", timeout=15
        )
        assert r3.status_code == 200, f"Cover.jpg lost after PATCH: {r3.status_code}"

        # Restore original description
        requests.patch(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            json={"description": before_desc},
            timeout=15,
        )


# ────────────────────────────────────────────────────────────────────────────
# EDIT replacing cover → new storage path
# ────────────────────────────────────────────────────────────────────────────
class TestEditReplacingCover:
    def test_patch_new_cover_creates_new_storage_path(self, auth_headers, created_campaign_id):
        """PATCH con nuovo cover_image → nuovo cover_storage_path (o comunque valorizzato) + cover.jpg 200."""
        r1 = requests.patch(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            json={"cover_image": COVER_DATA_URI},
            timeout=30,
        )
        assert r1.status_code == 200, f"PATCH failed: {r1.status_code} {r1.text[:200]}"

        r2 = requests.get(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            timeout=15,
        )
        data = r2.json()
        sp = data.get("cover_storage_path") or ""
        assert sp, f"cover_storage_path must be set after PATCH with cover_image, got: {sp!r}"
        assert (data.get("cover_image") or "") == "", (
            "cover_image should be empty after storage upload"
        )

        r3 = requests.get(
            f"{BASE_URL}/api/preseason/public/{created_campaign_id}/cover.jpg", timeout=30
        )
        assert r3.status_code == 200
        assert r3.content[:2] == b"\xff\xd8", "Not a JPEG"


# ────────────────────────────────────────────────────────────────────────────
# EDIT removing cover (empty string) → storage path cleared + 404
# ────────────────────────────────────────────────────────────────────────────
class TestEditRemovingCover:
    def test_patch_empty_cover_clears_storage_path(self, auth_headers, created_campaign_id):
        """PATCH cover_image='' → cover_storage_path VUOTO + cover.jpg 404."""
        r1 = requests.patch(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            json={"cover_image": ""},
            timeout=15,
        )
        assert r1.status_code == 200, f"PATCH clear failed: {r1.status_code} {r1.text[:200]}"

        r2 = requests.get(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            timeout=15,
        )
        data = r2.json()
        assert (data.get("cover_storage_path") or "") == "", (
            f"cover_storage_path should be empty after clear, got: {data.get('cover_storage_path')!r}"
        )
        assert (data.get("cover_image") or "") == "", "cover_image should stay empty"

        # Public endpoint must now 404
        r3 = requests.get(
            f"{BASE_URL}/api/preseason/public/{created_campaign_id}/cover.jpg", timeout=15
        )
        assert r3.status_code == 404, f"After clearing cover, cover.jpg must be 404, got {r3.status_code}"

        # Re-add so cleanup fixture doesn't leave nothing (belt-and-suspenders)
        requests.patch(
            f"{BASE_URL}/api/preseason/campaigns/{created_campaign_id}",
            headers=auth_headers,
            json={"cover_image": COVER_DATA_URI},
            timeout=30,
        )


# ────────────────────────────────────────────────────────────────────────────
# LIST endpoint has has_cover flag and excludes cover_image (performance)
# ────────────────────────────────────────────────────────────────────────────
class TestListEndpoint:
    def test_list_response_shape(self, auth_headers, created_campaign_id):
        """GET /preseason/campaigns → has_cover:true per campagne con storage OR base64,
        cover_image assente nel payload lista."""
        r = requests.get(
            f"{BASE_URL}/api/preseason/campaigns", headers=auth_headers, timeout=15
        )
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list), f"Expected list, got: {type(items).__name__}"
        assert len(items) > 0, "Expected at least our test campaign"

        # cover_image must NOT be in any list item payload
        for it in items:
            assert "cover_image" not in it, (
                f"cover_image MUST be excluded from list payload, found in item {it.get('id')}"
            )
            assert "has_cover" in it, f"has_cover flag missing in item {it.get('id')}"

        # Our test campaign must be present with has_cover=True
        ours = [it for it in items if it.get("id") == created_campaign_id]
        assert ours, "Our test campaign missing from list"
        assert ours[0].get("has_cover") is True, (
            f"has_cover must be true for campaign with storage path, got: {ours[0].get('has_cover')}"
        )

    def test_list_has_cover_true_for_legacy_base64_campaign(self, auth_headers):
        """La campagna legacy (con SOLO cover_image base64) deve avere has_cover:true."""
        r = requests.get(
            f"{BASE_URL}/api/preseason/campaigns", headers=auth_headers, timeout=15
        )
        assert r.status_code == 200
        items = r.json()
        legacy = [it for it in items if it.get("id") == LEGACY_FALLBACK_CAMPAIGN_ID]
        if not legacy:
            pytest.skip("Legacy fallback campaign not present in this society context")
        assert legacy[0].get("has_cover") is True, (
            "has_cover must be true for legacy base64-only campaign"
        )


# ────────────────────────────────────────────────────────────────────────────
# Fallback base64 (retrocompat)
# ────────────────────────────────────────────────────────────────────────────
class TestLegacyBase64Fallback:
    def test_precondition_legacy_campaign_still_base64_only(self, auth_headers):
        """La campagna legacy DEVE avere cover_image base64 e cover_storage_path vuoto/None."""
        r = requests.get(
            f"{BASE_URL}/api/preseason/campaigns/{LEGACY_FALLBACK_CAMPAIGN_ID}",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200, f"Legacy campaign not found: {r.status_code}"
        data = r.json()
        cover_b64 = data.get("cover_image") or ""
        sp = data.get("cover_storage_path") or ""
        assert cover_b64 and cover_b64.startswith("data:image/"), (
            f"Legacy campaign MUST have cover_image base64. cover_len={len(cover_b64)}"
        )
        assert sp == "", (
            f"Legacy campaign must NOT have cover_storage_path (would defeat fallback test); got: {sp!r}"
        )

    def test_legacy_cover_served_via_base64_fallback(self):
        """GET /public/{legacy_id}/cover.jpg → 200 image/jpeg (dual-read fallback base64)."""
        r = requests.get(
            f"{BASE_URL}/api/preseason/public/{LEGACY_FALLBACK_CAMPAIGN_ID}/cover.jpg", timeout=15
        )
        assert r.status_code == 200, f"Fallback failed: {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/")
        assert r.content[:2] == b"\xff\xd8", "Not a JPEG (fallback should decode base64 + re-encode JPEG)"

    def test_legacy_share_html_has_og_image_pointing_to_cover_jpg(self):
        """GET /preseason/share/{legacy_id} → HTML con og:image = /api/preseason/public/{id}/cover.jpg."""
        r = requests.get(
            f"{BASE_URL}/api/preseason/share/{LEGACY_FALLBACK_CAMPAIGN_ID}", timeout=15
        )
        assert r.status_code == 200
        html = r.text
        assert 'property="og:image"' in html, "og:image meta tag missing"
        expected_fragment = f"/api/preseason/public/{LEGACY_FALLBACK_CAMPAIGN_ID}/cover.jpg"
        assert expected_fragment in html, (
            f"og:image should point to cover.jpg endpoint. Fragment near og:image: "
            f"{html[max(0, html.find('og:image')-50):html.find('og:image')+250]}"
        )
