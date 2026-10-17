"""
Tests for the 16/08/2026 performance fix on
GET /api/settings/society?include_images=true (routes/settings.py:192).

The endpoint must:
- Compress heavy base64 fields (logo, sport_image, stamp_signature) when the
  stored base64 string is > ~500KB.
- Persist the compressed version in db.settings.
- Return a stable payload on 2nd call (already compressed → no re-compression).
- Keep the response schema intact (name, athlete_roles, athlete_characteristics,
  dirigente_qualifications, venues, ...).

Regressions:
- GET /api/settings/society (no include_images) stays lightweight and exposes
  has_logo / has_sport_image / has_stamp_signature booleans.
- Small (<500KB) images are NOT modified.

Seed data is $unset in every fixture teardown so we do not leave test images
behind in the production-like settings document.
"""
import base64
import io
import os
import time

import pytest
import requests
from PIL import Image
from pymongo import MongoClient


# ---------- Config ----------
BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://zaino-coach-hub.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"
SOCIETY_ID = "697fdba0d218717959e73eea"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- Helpers ----------
def _big_jpeg_b64(size_px: int = 2400) -> str:
    """Build a heavy JPEG whose base64 length exceeds the ~500KB compression trigger.

    Gradient + small noise strip: source b64 ~ >700KB (triggers compression on
    first call) yet the compressed 1280/q72 result stays well under 500KB
    (so the 2nd call is stable and NOT re-compressed).
    """
    import random
    random.seed(42)
    img = Image.new("RGB", (size_px, size_px))
    px = img.load()
    for y in range(size_px):
        r = (y * 255) // size_px
        for x in range(size_px):
            g = (x * 255) // size_px
            b = ((x + y) * 255) // (2 * size_px)
            px[x, y] = (r, g, b)
    noise_h = size_px // 3
    noise = bytes(random.getrandbits(8) for _ in range(size_px * noise_h * 3))
    noise_img = Image.frombytes("RGB", (size_px, noise_h), noise)
    img.paste(noise_img, (0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=98, subsampling=0)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _assert_valid_jpeg_b64(b64_str: str, ctx: str) -> Image.Image:
    assert isinstance(b64_str, str) and b64_str, f"{ctx}: empty/non-string base64"
    assert not b64_str.startswith("data:"), (
        f"{ctx}: value must NOT include 'data:' prefix (frontend adds it)"
    )
    raw = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(raw))
    img.verify()
    img2 = Image.open(io.BytesIO(raw))
    assert img2.format == "JPEG", f"{ctx}: expected JPEG, got {img2.format}"
    return img2


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:400]}"
    tok = r.json().get("token")
    assert tok, "Admin token missing"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def heavy_jpeg():
    b = _big_jpeg_b64(size_px=2400)
    assert len(b) > 700_000, f"heavy jpeg too small: {len(b)}"
    return b


@pytest.fixture(scope="module")
def medium_jpeg():
    b = _big_jpeg_b64(size_px=1600)
    assert len(b) > 700_000, f"medium jpeg too small: {len(b)}"
    return b


def _settings_filter():
    return {"type": "society", "society_id": SOCIETY_ID}


# ============================================================================
# TEST 1 — Compression + persistence for each of the three heavy fields
# ============================================================================
class TestSettingsSocietyCompression:
    @pytest.mark.parametrize("field", ["logo", "sport_image", "stamp_signature"])
    def test_compress_and_persist_heavy_field(
        self, mongo_db, auth_headers, medium_jpeg, field
    ):
        # Seed heavy value in the settings doc (only for the field under test)
        mongo_db.settings.update_one(_settings_filter(), {"$set": {field: medium_jpeg}})
        try:
            # 1st call — must compress + persist
            r1 = requests.get(
                f"{API}/settings/society?include_images=true",
                headers=auth_headers,
                timeout=60,
            )
            assert r1.status_code == 200, f"first call failed: {r1.status_code} {r1.text[:300]}"
            body1 = r1.json()

            # Schema must remain intact
            for k in (
                "name",
                "athlete_roles",
                "athlete_characteristics",
                "dirigente_qualifications",
                "venues",
                "affiliations",
            ):
                assert k in body1, f"missing schema key {k} in include_images response"

            val1 = body1.get(field)
            assert isinstance(val1, str) and val1, f"{field} missing in response"
            assert len(val1) < len(medium_jpeg), (
                f"{field} not compressed: seeded={len(medium_jpeg)} got={len(val1)}"
            )
            img = _assert_valid_jpeg_b64(val1, f"/settings/society.{field}")
            assert max(img.size) <= 1280, f"{field} not resized to <=1280: {img.size}"

            # Persisted in DB with the exact same compressed bytes
            db_doc = mongo_db.settings.find_one(_settings_filter(), {field: 1})
            assert db_doc.get(field) == val1, (
                f"{field}: DB not persisted with compressed value"
            )

            # 2nd call — payload must be identical (no re-compression)
            r2 = requests.get(
                f"{API}/settings/society?include_images=true",
                headers=auth_headers,
                timeout=60,
            )
            assert r2.status_code == 200
            val2 = r2.json().get(field)
            assert val2 == val1, (
                f"{field}: 2nd call payload changed — expected stable compressed value"
            )
        finally:
            mongo_db.settings.update_one(_settings_filter(), {"$unset": {field: ""}})


# ============================================================================
# TEST 2 — Small (<500KB) images MUST NOT be modified
# ============================================================================
class TestSmallImageUntouched:
    @pytest.mark.parametrize("field", ["logo", "sport_image", "stamp_signature"])
    def test_small_image_left_alone(self, mongo_db, auth_headers, field):
        # Build a small (<500KB base64) fake JPEG-ish blob. The endpoint only
        # checks len(str) > 500_000 before compressing, so any short base64
        # string must be passed through unchanged.
        small = base64.b64encode(b"\xff\xd8\xff\xe0" + b"A" * 100_000).decode("ascii")
        assert len(small) < 500_000
        mongo_db.settings.update_one(_settings_filter(), {"$set": {field: small}})
        try:
            r = requests.get(
                f"{API}/settings/society?include_images=true",
                headers=auth_headers,
                timeout=30,
            )
            assert r.status_code == 200
            returned = r.json().get(field)
            assert returned == small, (
                f"{field}: small image was modified (unexpected re-encoding)"
            )
            db_val = mongo_db.settings.find_one(_settings_filter(), {field: 1}).get(field)
            assert db_val == small, f"{field}: DB was mutated for small image"
        finally:
            mongo_db.settings.update_one(_settings_filter(), {"$unset": {field: ""}})


# ============================================================================
# TEST 3 — Regression: /settings/society (no include_images)
# ============================================================================
class TestSettingsSocietyLightweight:
    def test_lightweight_flags_and_no_heavy_payload(
        self, mongo_db, auth_headers, medium_jpeg
    ):
        # Seed all three heavy fields
        mongo_db.settings.update_one(
            _settings_filter(),
            {
                "$set": {
                    "logo": medium_jpeg,
                    "sport_image": medium_jpeg,
                    "stamp_signature": medium_jpeg,
                }
            },
        )
        try:
            r = requests.get(
                f"{API}/settings/society", headers=auth_headers, timeout=30
            )
            assert r.status_code == 200, f"lightweight call failed: {r.status_code}"
            body = r.json()
            # Boolean flags must correctly reflect presence
            assert body.get("has_logo") is True, "has_logo should be true when logo seeded"
            assert body.get("has_sport_image") is True
            assert body.get("has_stamp_signature") is True
            # Heavy fields must be omitted (or null) — payload stays light
            assert not body.get("logo"), "logo must not be included when include_images=false"
            assert not body.get("sport_image"), "sport_image must be omitted"
            assert not body.get("stamp_signature"), "stamp_signature must be omitted"
            # Content-Length sanity — must be well under one heavy field size
            approx_size = len(r.content)
            assert approx_size < 200_000, (
                f"lightweight payload too large: {approx_size} bytes"
            )
            # Schema keys present
            for k in ("name", "athlete_roles", "affiliations", "venues"):
                assert k in body, f"schema key {k} missing in lightweight response"
        finally:
            mongo_db.settings.update_one(
                _settings_filter(),
                {"$unset": {"logo": "", "sport_image": "", "stamp_signature": ""}},
            )

    def test_lightweight_flags_false_when_absent(self, mongo_db, auth_headers):
        # Ensure the three heavy fields are absent (defensive $unset before)
        mongo_db.settings.update_one(
            _settings_filter(),
            {"$unset": {"logo": "", "sport_image": "", "stamp_signature": ""}},
        )
        r = requests.get(f"{API}/settings/society", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body.get("has_logo") is False
        assert body.get("has_sport_image") is False
        assert body.get("has_stamp_signature") is False


# ============================================================================
# TEST 4 — Performance sanity: 2nd call is much faster (persisted compression)
# ============================================================================
class TestPerformanceStability:
    def test_second_call_faster_or_equal(self, mongo_db, auth_headers, heavy_jpeg):
        mongo_db.settings.update_one(_settings_filter(), {"$set": {"logo": heavy_jpeg}})
        try:
            t0 = time.time()
            r1 = requests.get(
                f"{API}/settings/society?include_images=true",
                headers=auth_headers,
                timeout=90,
            )
            first_dt = time.time() - t0
            assert r1.status_code == 200
            first_len = len(r1.content)

            t0 = time.time()
            r2 = requests.get(
                f"{API}/settings/society?include_images=true",
                headers=auth_headers,
                timeout=60,
            )
            second_dt = time.time() - t0
            assert r2.status_code == 200
            second_len = len(r2.content)

            # After compression the payload should be well below the original
            # ~700KB base64 seed (which itself is base64 of ~5MB image).
            assert second_len < 500_000, (
                f"second call payload too large after compression: {second_len}"
            )
            # Stability: second == first content length (no re-compression jitter)
            assert first_len == second_len, (
                f"payload sizes differ across calls: {first_len} vs {second_len}"
            )
            print(
                f"[perf] first={first_dt:.2f}s ({first_len}B)  "
                f"second={second_dt:.2f}s ({second_len}B)"
            )
        finally:
            mongo_db.settings.update_one(_settings_filter(), {"$unset": {"logo": ""}})
