"""
Test cover_image feature for preseason campaigns (P2 enhancement 27/02/2026).

Verifies:
- Campaign creation/update accepts cover_image (base64 data URI).
- /preseason/public/{id}/cover.jpg serves the binary image when present.
- Returns 404 when cover_image is missing.
- OG endpoint uses cover_image URL instead of society logo when present.
"""
import os
import sys
import base64
import pytest
import pytest_asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import db, get_preseason_cover_image, get_preseason_share_page
from fastapi import HTTPException


class _FakeRequest:
    def __init__(self, host="example.test"):
        self.headers = {
            "x-forwarded-proto": "https",
            "x-forwarded-host": host,
            "host": host,
        }
        self.url = type("U", (), {"scheme": "https", "netloc": host})()


@pytest_asyncio.fixture
async def cleanup():
    await db.preseason_campaigns.delete_many({"id": {"$regex": "^test-cover-"}})
    await db.settings.delete_many({"society_id": {"$regex": "^test-cover-"}})
    yield
    await db.preseason_campaigns.delete_many({"id": {"$regex": "^test-cover-"}})
    await db.settings.delete_many({"society_id": {"$regex": "^test-cover-"}})


@pytest.mark.asyncio
async def test_cover_image_scenarios(cleanup):
    """Combined test for cover_image endpoint + OG usage."""
    # 1x1 JPEG (smallest valid)
    tiny_jpeg = base64.b64decode(
        "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+igD/9k="
    )
    cover_data_uri = "data:image/jpeg;base64," + base64.b64encode(tiny_jpeg).decode()

    # --- Case A: campaign with cover_image → endpoint returns it ---
    await db.preseason_campaigns.insert_one({
        "id": "test-cover-with",
        "society_id": "test-cover-soc",
        "title": "Test Cover",
        "season": "2026/2027",
        "cover_image": cover_data_uri,
        "is_active": True,
    })
    await db.settings.insert_one({
        "society_id": "test-cover-soc",
        "type": "society",
        "name": "ASD Test Cover",
        "logo": "data:image/png;base64,FAKELOGO",
    })

    resp = await get_preseason_cover_image("test-cover-with")
    assert resp.status_code == 200
    assert resp.media_type == "image/jpeg"
    assert len(resp.body) > 0

    # OG endpoint uses cover_image URL, NOT the logo
    og_resp = await get_preseason_share_page("test-cover-with", _FakeRequest())
    og_html = og_resp.body.decode("utf-8")
    assert "/api/preseason/public/test-cover-with/cover.jpg" in og_html
    assert "/api/settings/society/logo.png" not in og_html

    # --- Case B: campaign WITHOUT cover_image → endpoint 404, OG falls back to logo ---
    await db.preseason_campaigns.insert_one({
        "id": "test-cover-without",
        "society_id": "test-cover-soc",
        "title": "No Cover",
        "season": "2026/2027",
        "is_active": True,
    })
    with pytest.raises(HTTPException) as exc_info:
        await get_preseason_cover_image("test-cover-without")
    assert exc_info.value.status_code == 404

    og_resp2 = await get_preseason_share_page("test-cover-without", _FakeRequest())
    og_html2 = og_resp2.body.decode("utf-8")
    assert "/api/preseason/public/test-cover-without/cover.jpg" not in og_html2
    assert "/api/settings/society/logo.png" in og_html2

    # --- Case C: invalid cover_image → 404 (not crash) ---
    await db.preseason_campaigns.insert_one({
        "id": "test-cover-broken",
        "society_id": "test-cover-soc",
        "title": "Broken",
        "season": "2026/2027",
        "cover_image": "not-a-data-uri",
        "is_active": True,
    })
    with pytest.raises(HTTPException) as exc_info:
        await get_preseason_cover_image("test-cover-broken")
    assert exc_info.value.status_code == 404
