"""
Tests for the performance-fix image compression backfill (16/08/2026).

Endpoints under test:
- GET /api/societies/my              -> compresses `logo` if > ~500KB and persists
- GET /api/athletes/{id}             -> compresses `athlete_photo` & `athlete_photo_artistic`
- GET /api/auth/me?include_images=1  -> compresses HEAVY_IMAGE_FIELDS on user doc
- GET /api/society/card-fiscale      -> must keep working (image/jpeg 200)

Also verifies:
- Returned base64 has NO 'data:' URI prefix
- Compressed base64 decodes into a valid JPEG image
- Second call returns stable (already-persisted small) payload
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
BASE_URL = os.environ.get("EXPO_BACKEND_URL") or os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001"
)
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"

SOCIETY_ID = "697fdba0d218717959e73eea"
ATHLETE_ID = "c0555a97927f4054ae84b1c9"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- Helpers ----------
def _big_jpeg_b64(size_px: int = 2400) -> str:
    """Build a heavy JPEG whose base64 length exceeds the ~500KB backfill trigger.

    Uses a large canvas with a mixed gradient + small noise region so that:
      - source base64 length > 500KB   (triggers compression on 1st call)
      - after downscale to 1280 + q72  it compresses to well under 500KB
        (so 2nd call is stable and NOT recompressed)
    """
    import random
    random.seed(42)
    # Build a gradient background (compressible)
    img = Image.new("RGB", (size_px, size_px))
    px = img.load()
    for y in range(size_px):
        r = (y * 255) // size_px
        for x in range(size_px):
            g = (x * 255) // size_px
            b = ((x + y) * 255) // (2 * size_px)
            px[x, y] = (r, g, b)
    # Add a noise strip to make it big enough (~1MB) when saved
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
        f"{ctx}: value must NOT start with 'data:' prefix (frontend adds it)"
    )
    raw = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(raw))
    img.verify()  # raises on invalid
    # Reload for size check (verify() closes the file)
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
    body = r.json()
    tok = body.get("token") or body.get("access_token")
    assert tok, f"Token missing in login response: {list(body.keys())}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def big_jpeg():
    b = _big_jpeg_b64(size_px=2400)
    # Sanity: must be > 500KB base64 string
    assert len(b) > 700_000, f"seed image too small: {len(b)} chars"
    return b


@pytest.fixture(scope="module")
def medium_jpeg():
    """Smaller heavy JPEG (~4MB base64) used when we need to seed multiple
    heavy fields in the same MongoDB doc (BSON 16MB limit)."""
    b = _big_jpeg_b64(size_px=1600)
    assert len(b) > 700_000, f"medium seed too small: {len(b)} chars"
    return b


# ============================================================================
# TEST 1 — Society logo compression backfill
# ============================================================================
class TestSocietyLogoBackfill:
    def test_compress_and_persist_logo(self, mongo_db, auth_headers, big_jpeg):
        # Seed heavy logo directly in DB
        mongo_db.societies.update_one(
            {"id": SOCIETY_ID}, {"$set": {"logo": big_jpeg}}
        )
        try:
            # 1st call: should compress + persist
            r1 = requests.get(f"{API}/societies/my", headers=auth_headers, timeout=60)
            assert r1.status_code == 200, f"first call failed: {r1.status_code} {r1.text[:300]}"
            body1 = r1.json()
            assert body1.get("id") == SOCIETY_ID
            logo1 = body1.get("logo")
            assert isinstance(logo1, str) and logo1, "logo missing in response"
            assert len(logo1) < len(big_jpeg), (
                f"logo not compressed: seeded={len(big_jpeg)} returned={len(logo1)}"
            )
            img = _assert_valid_jpeg_b64(logo1, "societies/my.logo")
            # 1280 max_dim enforced
            assert max(img.size) <= 1280, f"logo not resized: {img.size}"

            # DB should now hold the compressed version
            db_doc = mongo_db.societies.find_one({"id": SOCIETY_ID}, {"logo": 1})
            assert db_doc and db_doc.get("logo") == logo1, "DB not persisted with compressed logo"

            # 2nd call: stable payload (already compressed, no re-compression needed)
            r2 = requests.get(f"{API}/societies/my", headers=auth_headers, timeout=60)
            assert r2.status_code == 200
            logo2 = r2.json().get("logo")
            assert logo2 == logo1, "second call must return the persisted compressed logo"
        finally:
            # Cleanup: remove any leftover seeded field
            mongo_db.societies.update_one(
                {"id": SOCIETY_ID}, {"$unset": {"logo": ""}}
            )

    def test_small_logo_untouched(self, mongo_db, auth_headers):
        # Seed a small (<500KB) base64 -> untouched
        small = base64.b64encode(b"\xff\xd8\xff\xe0" + b"A" * 100_000).decode("ascii")
        mongo_db.societies.update_one({"id": SOCIETY_ID}, {"$set": {"logo": small}})
        try:
            r = requests.get(f"{API}/societies/my", headers=auth_headers, timeout=30)
            assert r.status_code == 200
            logo = r.json().get("logo")
            assert logo == small, "small logo must be returned unchanged"
        finally:
            mongo_db.societies.update_one({"id": SOCIETY_ID}, {"$unset": {"logo": ""}})


# ============================================================================
# TEST 2 — Athlete photos compression backfill
# ============================================================================
class TestAthletePhotosBackfill:
    def test_compress_athlete_photos(self, mongo_db, auth_headers, medium_jpeg):
        # Seed both heavy fields (use ~4MB each to stay under 16MB BSON doc limit)
        mongo_db.athletes.update_one(
            {"id": ATHLETE_ID},
            {"$set": {"athlete_photo": medium_jpeg, "athlete_photo_artistic": medium_jpeg}},
        )
        try:
            r1 = requests.get(f"{API}/athletes/{ATHLETE_ID}", headers=auth_headers, timeout=60)
            assert r1.status_code == 200, f"athlete GET failed: {r1.status_code} {r1.text[:300]}"
            body1 = r1.json()
            assert body1.get("id") == ATHLETE_ID, "wrong athlete returned"
            # Athlete pydantic model required fields must still be present
            assert body1.get("full_name"), "athlete full_name missing"

            # NOTE: the Athlete Pydantic model does NOT declare athlete_photo /
            # athlete_photo_artistic, so `Athlete(**doc)` strips them from the
            # HTTP response. The backfill still runs and PERSISTS the compressed
            # bytes in MongoDB — that is the primary performance win. We verify
            # that here instead.
            db_doc = mongo_db.athletes.find_one(
                {"id": ATHLETE_ID}, {"athlete_photo": 1, "athlete_photo_artistic": 1}
            )
            for f in ("athlete_photo", "athlete_photo_artistic"):
                val = db_doc.get(f)
                assert isinstance(val, str) and val, f"{f} missing in DB after backfill"
                assert len(val) < len(medium_jpeg), (
                    f"{f} not compressed in DB: seeded={len(medium_jpeg)} got={len(val)}"
                )
                img = _assert_valid_jpeg_b64(val, f"db.athlete.{f}")
                assert max(img.size) <= 1280, f"{f} not resized: {img.size}"

            # 2nd call: DB values remain stable (already-compressed, <500KB → no recompression)
            r2 = requests.get(f"{API}/athletes/{ATHLETE_ID}", headers=auth_headers, timeout=60)
            assert r2.status_code == 200
            db_doc2 = mongo_db.athletes.find_one(
                {"id": ATHLETE_ID}, {"athlete_photo": 1, "athlete_photo_artistic": 1}
            )
            assert db_doc2["athlete_photo"] == db_doc["athlete_photo"], (
                "athlete_photo re-compressed on 2nd call (should be stable when <500KB)"
            )
            assert db_doc2["athlete_photo_artistic"] == db_doc["athlete_photo_artistic"]
        finally:
            mongo_db.athletes.update_one(
                {"id": ATHLETE_ID},
                {"$unset": {"athlete_photo": "", "athlete_photo_artistic": ""}},
            )


# ============================================================================
# TEST 3 — User heavy fields (stamp_signature) via /auth/me?include_images=true
# (this is the endpoint that hosts the HEAVY_IMAGE_FIELDS compression logic
#  referenced in the review request at server.py ~4294)
# ============================================================================
class TestAuthMeImagesBackfill:
    def test_compress_stamp_signature_on_include_images(
        self, mongo_db, auth_headers, admin_token, big_jpeg
    ):
        user = mongo_db.users.find_one(
            {"email": ADMIN_EMAIL}, {"id": 1}
        )
        assert user, "admin user not found in DB"
        uid = user["id"]
        mongo_db.users.update_one({"id": uid}, {"$set": {"stamp_signature": big_jpeg}})
        try:
            r1 = requests.get(
                f"{API}/auth/me?include_images=true", headers=auth_headers, timeout=60
            )
            assert r1.status_code == 200, f"/auth/me failed: {r1.status_code} {r1.text[:300]}"
            body1 = r1.json()
            stamp1 = body1.get("stamp_signature")
            assert isinstance(stamp1, str) and stamp1, "stamp_signature missing"
            assert len(stamp1) < len(big_jpeg), (
                f"stamp_signature not compressed: seeded={len(big_jpeg)} got={len(stamp1)}"
            )
            img = _assert_valid_jpeg_b64(stamp1, "auth/me.stamp_signature")
            assert max(img.size) <= 1280

            # Persisted?
            db_doc = mongo_db.users.find_one({"id": uid}, {"stamp_signature": 1})
            assert db_doc["stamp_signature"] == stamp1

            # 2nd call stable
            r2 = requests.get(
                f"{API}/auth/me?include_images=true", headers=auth_headers, timeout=60
            )
            assert r2.status_code == 200
            assert r2.json().get("stamp_signature") == stamp1
        finally:
            mongo_db.users.update_one({"id": uid}, {"$unset": {"stamp_signature": ""}})

    def test_settings_society_include_images_ok(self, auth_headers):
        """Regression: /settings/society?include_images=true still returns 200 & schema."""
        r = requests.get(
            f"{API}/settings/society?include_images=true",
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        body = r.json()
        # Must contain expected keys
        for k in ("name", "athlete_roles", "affiliations"):
            assert k in body, f"missing key {k} in /settings/society"


# ============================================================================
# TEST 4 — Regression: card-fiscale still returns image/jpeg 200
# ============================================================================
class TestCardFiscaleRegression:
    def test_card_fiscale_returns_jpeg(self, auth_headers):
        r = requests.get(f"{API}/society/card-fiscale", headers=auth_headers, timeout=60)
        assert r.status_code == 200, f"card-fiscale failed: {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "image/jpeg" in ct.lower(), f"wrong content-type: {ct}"
        # Body should be a valid JPEG
        img = Image.open(io.BytesIO(r.content))
        assert img.format == "JPEG", f"body is not a JPEG: {img.format}"
        assert img.size[0] > 0 and img.size[1] > 0
