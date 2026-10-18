"""
Test 18th birthday GDPR notification scheduler (P2).

Verifies:
- Athletes turning 18 TODAY are picked up by the query.
- Athletes with a birthday different from today are NOT picked up.
- Athletes already marked as `birthday_18_notified_at` are NOT re-notified.
- The scheduler function marks the flag correctly.
"""
import os
import sys
import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from bson import ObjectId
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import db, send_18th_birthday_notifications


@pytest_asyncio.fixture
async def cleanup():
    await db.athletes.delete_many({"id": {"$regex": "^test-b18-"}})
    await db.users.delete_many({"id": {"$regex": "^test-b18-"}})
    await db.settings.delete_many({"society_id": "test-b18-soc"})
    yield
    await db.athletes.delete_many({"id": {"$regex": "^test-b18-"}})
    await db.users.delete_many({"id": {"$regex": "^test-b18-"}})
    await db.settings.delete_many({"society_id": "test-b18-soc"})


@pytest.mark.asyncio
async def test_18th_birthday_notifications(cleanup):
    now = datetime.utcnow()
    # DOB = 18 years ago today
    dob_today_18 = datetime(now.year - 18, now.month, now.day)
    # DOB = 18 years ago yesterday
    dob_yesterday_18 = dob_today_18 - timedelta(days=1)
    # DOB = 15 years ago today (minor)
    dob_today_15 = datetime(now.year - 15, now.month, now.day)

    # Seed society
    await db.settings.insert_one({
        "society_id": "test-b18-soc",
        "type": "society",
        "name": "ASD Test B18",
    })

    # Case A: athlete turning 18 today, has a linked parent → should be notified
    await db.athletes.insert_one({
        "id": "test-b18-today",
        "society_id": "test-b18-soc",
        "first_name": "Mario",
        "last_name": "Rossi",
        "full_name": "Mario Rossi",
        "date_of_birth": dob_today_18,
        "parent_ids": ["test-b18-parent-user"],
        "is_minor": True,
    })
    await db.users.insert_one({
        "id": "test-b18-parent-user",
        "society_id": "test-b18-soc",
        "email": "parent-b18@test.example.com",
        "first_name": "Genitore",
        "role": "parent",
    })

    # Case B: athlete turning 18 yesterday → NOT today, must NOT be picked
    await db.athletes.insert_one({
        "id": "test-b18-yesterday",
        "society_id": "test-b18-soc",
        "first_name": "Luigi",
        "last_name": "Verdi",
        "full_name": "Luigi Verdi",
        "date_of_birth": dob_yesterday_18,
        "parent_ids": ["test-b18-parent-user"],
        "is_minor": True,
    })

    # Case C: minor (15) turning today → NOT 18, must NOT be picked
    await db.athletes.insert_one({
        "id": "test-b18-minor",
        "society_id": "test-b18-soc",
        "first_name": "Anna",
        "last_name": "Bianchi",
        "full_name": "Anna Bianchi",
        "date_of_birth": dob_today_15,
        "parent_ids": [],
        "is_minor": True,
    })

    # Case D: already notified → must NOT be re-notified
    await db.athletes.insert_one({
        "id": "test-b18-alreadynotified",
        "society_id": "test-b18-soc",
        "first_name": "Marco",
        "last_name": "Neri",
        "full_name": "Marco Neri",
        "date_of_birth": dob_today_18,
        "parent_ids": [],
        "is_minor": True,
        "birthday_18_notified_at": "2020-01-01T00:00:00Z",
    })

    # Patch email_service.send_transactional_email to a no-op
    with patch("email_service.send_transactional_email", new=AsyncMock(return_value={"success": True})):
        await send_18th_birthday_notifications()

    # Verify Case A marked
    a = await db.athletes.find_one({"id": "test-b18-today"})
    assert a and a.get("birthday_18_notified_at"), "Case A must be marked as notified"

    # Verify Case B not marked
    b = await db.athletes.find_one({"id": "test-b18-yesterday"})
    assert b and not b.get("birthday_18_notified_at"), "Case B (yesterday) must NOT be picked"

    # Verify Case C not marked
    c = await db.athletes.find_one({"id": "test-b18-minor"})
    assert c and not c.get("birthday_18_notified_at"), "Case C (15yo) must NOT be picked"

    # Verify Case D still has old timestamp
    d = await db.athletes.find_one({"id": "test-b18-alreadynotified"})
    assert d.get("birthday_18_notified_at") == "2020-01-01T00:00:00Z", "Case D must NOT be re-notified"
