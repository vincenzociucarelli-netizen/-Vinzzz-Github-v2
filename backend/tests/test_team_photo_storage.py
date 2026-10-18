"""Backend tests for Team Photo Object Storage migration (iter 126).

Covers:
- POST /api/teams/{team_id}/photo  (admin only; 403 for non-admin)
- GET  /api/teams/{team_id}/photo.jpg (public JPEG; lazy migration; 404 if none)
- DELETE /api/teams/{team_id}/photo (admin only)
- GET /api/teams and /api/teams/{id} and /api/coach/my-teams return team_photo_url
  and NOT the base64 team_photo (must be null).
"""
import os
import base64
import io
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
COACH_EMAIL = "alice@test.com"
COACH_PASSWORD = "Test1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json()["token"]


def _make_test_image_datauri(size=(400, 300), color=(120, 40, 180)):
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def coach_token():
    return _login(COACH_EMAIL, COACH_PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def coach_headers(coach_token):
    return {"Authorization": f"Bearer {coach_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_team_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/teams", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    teams = r.json()
    assert isinstance(teams, list) and len(teams) > 0, "Admin has no teams"
    # Prefer "Under 16" team as reference in review request if present
    for t in teams:
        if "16" in (t.get("name") or ""):
            return t["id"]
    return teams[0]["id"]


class TestTeamsListResponseShape:
    """Verify GET /api/teams returns team_photo_url and NOT base64 team_photo."""

    def test_teams_list_no_base64_but_url(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/teams", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        teams = r.json()
        assert isinstance(teams, list)
        for t in teams:
            # team_photo must be None (or absent) in list response
            assert t.get("team_photo") in (None, ""), f"team_photo base64 leaked for team {t['id']}"
            # team_photo_url should be a string URL if present
            if t.get("team_photo_url"):
                assert isinstance(t["team_photo_url"], str)
                assert t["team_photo_url"].endswith("/photo.jpg")
                assert t["id"] in t["team_photo_url"]

    def test_team_detail_photo_url(self, admin_headers, admin_team_id):
        r = requests.get(f"{BASE_URL}/api/teams/{admin_team_id}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        team = r.json()
        assert team["id"] == admin_team_id
        # base64 must not leak
        assert team.get("team_photo") in (None, ""), "team_photo base64 leaked in detail"
        # team_photo_url present only if there is a photo (acceptable to be None)
        if team.get("team_photo_url"):
            assert admin_team_id in team["team_photo_url"]
            assert team["team_photo_url"].endswith("/photo.jpg")


class TestCoachMyTeamsResponseShape:
    def test_coach_my_teams_no_base64(self, coach_headers):
        r = requests.get(f"{BASE_URL}/api/coach/my-teams", headers=coach_headers, timeout=30)
        assert r.status_code == 200, r.text
        teams = r.json()
        assert isinstance(teams, list)
        for t in teams:
            assert t.get("team_photo") in (None, ""), f"team_photo base64 leaked for coach team {t['id']}"
            if t.get("team_photo_url"):
                assert t["team_photo_url"].endswith("/photo.jpg")
                assert t["id"] in t["team_photo_url"]


class TestTeamPhotoUploadRBAC:
    def test_non_admin_cannot_upload(self, coach_headers, admin_team_id):
        # Coach may not own the team but should still get 403 first (role check)
        payload = {"image": _make_test_image_datauri()}
        r = requests.post(
            f"{BASE_URL}/api/teams/{admin_team_id}/photo",
            headers=coach_headers,
            json=payload,
            timeout=30,
        )
        assert r.status_code == 403, f"Expected 403 for coach upload, got {r.status_code}: {r.text[:200]}"

    def test_unauthenticated_rejected(self, admin_team_id):
        r = requests.post(
            f"{BASE_URL}/api/teams/{admin_team_id}/photo",
            json={"image": _make_test_image_datauri()},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"Unauthenticated should be rejected: {r.status_code}"


class TestTeamPhotoFullFlow:
    """Full admin flow: upload → read → delete → 404."""

    def test_full_flow(self, admin_headers, admin_team_id):
        # 1) Backup existing photo state
        r = requests.get(f"{BASE_URL}/api/teams/{admin_team_id}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        prior_url = r.json().get("team_photo_url")

        # 2) Upload a new JPEG
        payload = {"image": _make_test_image_datauri(size=(600, 400), color=(10, 180, 90))}
        r = requests.post(
            f"{BASE_URL}/api/teams/{admin_team_id}/photo",
            headers=admin_headers,
            json=payload,
            timeout=60,
        )
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("success") is True
        assert "team_photo_url" in data and admin_team_id in data["team_photo_url"]
        photo_url = data["team_photo_url"]

        # 3) Fetch the image publicly (no auth header required by design)
        r_img = requests.get(photo_url, timeout=30)
        assert r_img.status_code == 200, f"Public image fetch failed: {r_img.status_code}"
        ct = r_img.headers.get("content-type", "")
        assert "image/jpeg" in ct or "image" in ct, f"Unexpected content-type: {ct}"
        assert len(r_img.content) > 500, "Image content too small (expected > 500 bytes)"
        # Should be a valid JPEG (magic FF D8)
        assert r_img.content[:2] == b"\xff\xd8", "Response is not valid JPEG magic"

        # 4) Verify team detail reports URL and no base64 leak
        r = requests.get(f"{BASE_URL}/api/teams/{admin_team_id}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        td = r.json()
        assert td.get("team_photo") in (None, "")
        assert td.get("team_photo_url", "").endswith("/photo.jpg")

        # 5) DELETE photo (admin)
        r = requests.delete(
            f"{BASE_URL}/api/teams/{admin_team_id}/photo",
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"Delete failed: {r.status_code} {r.text[:200]}"
        assert r.json().get("success") is True

        # 6) GET photo.jpg now → 404
        r_img2 = requests.get(photo_url, timeout=30)
        assert r_img2.status_code == 404, f"Expected 404 after delete, got {r_img2.status_code}"

        # 7) Team detail: no team_photo_url after delete
        r = requests.get(f"{BASE_URL}/api/teams/{admin_team_id}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        td2 = r.json()
        assert td2.get("team_photo") in (None, "")
        assert td2.get("team_photo_url") in (None, ""), f"team_photo_url should be cleared, got {td2.get('team_photo_url')}"

        # 8) Restore (best-effort) if the team had a photo before — re-upload a small image
        # so we don't leave the team without photo if the review mentioned Under 16 had one.
        if prior_url:
            requests.post(
                f"{BASE_URL}/api/teams/{admin_team_id}/photo",
                headers=admin_headers,
                json={"image": _make_test_image_datauri(size=(600, 400), color=(50, 50, 50))},
                timeout=60,
            )


class TestTeamPhoto404:
    def test_photo_jpg_404_when_no_photo(self, admin_headers):
        # Use a bogus team id
        r = requests.get(f"{BASE_URL}/api/teams/does-not-exist-xyz/photo.jpg", timeout=30)
        assert r.status_code == 404

    def test_upload_rejects_empty_image(self, admin_headers, admin_team_id):
        r = requests.post(
            f"{BASE_URL}/api/teams/{admin_team_id}/photo",
            headers=admin_headers,
            json={"image": ""},
            timeout=30,
        )
        assert r.status_code == 400
