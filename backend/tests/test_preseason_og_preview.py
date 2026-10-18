"""
Test OpenGraph meta tags for social preview of preseason campaigns.

Enhanced 27/02/2026:
- og:title now shows CAMPAIGN TITLE (not just society name) → higher click-through
- og:site_name = society name (branding on social)
- og:description includes event_info (Open Day date/venue) when present
- description is truncated to 300 chars per OG best practices
"""
import os
import sys
import pytest
import pytest_asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import db, get_preseason_share_page


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
    await db.preseason_campaigns.delete_many({"id": {"$regex": "^test-preseason-og"}})
    await db.settings.delete_many({"society_id": {"$regex": "^test-og-"}})
    yield
    await db.preseason_campaigns.delete_many({"id": {"$regex": "^test-preseason-og"}})
    await db.settings.delete_many({"society_id": {"$regex": "^test-og-"}})


@pytest.mark.asyncio
async def test_og_tags_all_scenarios(cleanup):
    """Combined test for all OG-preview scenarios (single-loop to avoid asyncio flake)."""
    # --- Case A: full campaign with event_info ---
    await db.preseason_campaigns.insert_one({
        "id": "test-preseason-og-full",
        "society_id": "test-og-soc",
        "title": "Open Day Volley 2026",
        "season": "2026/2027",
        "description": "Manifestazione di interesse non vincolante.",
        "event_info": "25 Agosto 2026 — PalaBarton, Perugia",
        "is_active": True,
    })
    await db.settings.insert_one({
        "society_id": "test-og-soc",
        "type": "society",
        "name": "ASD Test",
        "logo": "data:image/png;base64,FAKE",
    })

    resp = await get_preseason_share_page("test-preseason-og-full", _FakeRequest())
    html = resp.body.decode("utf-8")
    assert 'og:title" content="Open Day Volley 2026 — Stagione 2026/2027"' in html
    assert 'og:site_name" content="ASD Test"' in html
    assert "25 Agosto 2026" in html
    assert "PalaBarton" in html
    assert "og:image" in html

    # --- Case B: campaign without event_info ---
    await db.preseason_campaigns.insert_one({
        "id": "test-preseason-og-noevent",
        "society_id": "test-og-soc2",
        "title": "Pre-iscrizione 2027",
        "season": "2027/2028",
        "description": "Solo descrizione base.",
        "is_active": True,
    })
    await db.settings.insert_one({
        "society_id": "test-og-soc2",
        "type": "society",
        "name": "ASD Test 2",
    })

    resp = await get_preseason_share_page("test-preseason-og-noevent", _FakeRequest())
    html = resp.body.decode("utf-8")
    assert "Pre-iscrizione 2027" in html
    assert "Solo descrizione base." in html
    assert "📅" not in html  # no event_info → no calendar emoji

    # --- Case C: campaign with EMPTY title falls back to society name ---
    await db.preseason_campaigns.insert_one({
        "id": "test-preseason-og-notitle",
        "society_id": "test-og-soc3",
        "title": "",
        "description": "Solo descrizione.",
        "is_active": True,
    })
    await db.settings.insert_one({
        "society_id": "test-og-soc3",
        "type": "society",
        "name": "ASD Fallback",
    })

    resp = await get_preseason_share_page("test-preseason-og-notitle", _FakeRequest())
    html = resp.body.decode("utf-8")
    assert 'og:title" content="ASD Fallback"' in html

    # --- Case D: unknown campaign → generic redirect (no exception) ---
    resp = await get_preseason_share_page("does-not-exist", _FakeRequest())
    assert resp.status_code == 200
