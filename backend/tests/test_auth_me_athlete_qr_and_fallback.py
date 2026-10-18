"""
Test /auth/me returns QR/athlete_code + anagrafica fallback for adult athletes.

Bugs reported 27/02/2026:
1. Adult athlete (18+) doesn't see own QR code / athlete_code in their profile.
2. Adult athlete profile shows NOME/COGNOME as "-" even though the athletes
   record has them (Granato Francesca case).
"""
import os
import sys
import pytest
import pytest_asyncio
from datetime import datetime
from bson import ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import db, hash_password


@pytest_asyncio.fixture
async def cleanup_test_data():
    """Cleanup any test data before and after."""
    test_emails = [
        "test_qr_athlete_2026@example.com",
        "test_qr_athlete_nooverwrite@example.com",
    ]
    for email in test_emails:
        await db.users.delete_many({"email": email})
        await db.athletes.delete_many({"email": email})
    yield
    for email in test_emails:
        await db.users.delete_many({"email": email})
        await db.athletes.delete_many({"email": email})


@pytest.mark.asyncio
async def test_auth_me_returns_qr_and_athlete_code_and_fallback(cleanup_test_data):
    """Combined test for both Issues:
    - Issue 1: qr_code / qr_identifier / athlete_code exposed to athlete
    - Issue 3: empty users.first_name → fallback from athletes; filled → no overwrite
    """
    from server import get_me

    society_id = str(ObjectId())

    # ---- Case A: empty users.first_name → fallback from athletes ----
    athlete_id_a = str(ObjectId())
    user_id_a = str(ObjectId())
    await db.athletes.insert_one({
        "id": athlete_id_a,
        "society_id": society_id,
        "email": "test_qr_athlete_2026@example.com",
        "first_name": "FRANCESCA",
        "last_name": "GRANATO",
        "full_name": "GRANATO FRANCESCA",
        "fiscal_code": "GRNFNC02E55I754S",
        "date_of_birth": datetime(2002, 5, 15),
        "is_minor": False,
        "athlete_code": "ABCD1234EFGH",
        "qr_identifier": "ABCD1234EFGH",
        "qr_code": "data:image/png;base64,FAKEQR",
        "nome_lite": "francesca_op",
        "minor_access_enabled": False,
        "status": "active",
        "athlete_type": "quota",
    })
    await db.users.insert_one({
        "id": user_id_a,
        "society_id": society_id,
        "email": "test_qr_athlete_2026@example.com",
        "password_hash": hash_password("password123"),
        "role": "athlete",
        "athlete_id": athlete_id_a,
        "first_name": "",
        "last_name": "",
        "full_name": "",
        "status": "approved",
        "created_at": datetime.utcnow(),
    })

    class FakeRequest:
        query_params = {}

    result_a = await get_me(FakeRequest(), {"id": user_id_a, "role": "athlete"})
    assert result_a.get("qr_code") == "data:image/png;base64,FAKEQR"
    assert result_a.get("qr_identifier") == "ABCD1234EFGH"
    assert result_a.get("athlete_code") == "ABCD1234EFGH"
    assert result_a.get("first_name") == "FRANCESCA", f"expected fallback, got {result_a.get('first_name')!r}"
    assert result_a.get("last_name") == "GRANATO"
    assert result_a.get("full_name") == "GRANATO FRANCESCA"
    assert result_a.get("fiscal_code") == "GRNFNC02E55I754S"

    # ---- Case B: users.first_name is filled → NO overwrite from athletes ----
    athlete_id_b = str(ObjectId())
    user_id_b = str(ObjectId())
    await db.athletes.insert_one({
        "id": athlete_id_b,
        "society_id": society_id,
        "email": "test_qr_athlete_nooverwrite@example.com",
        "first_name": "OLD_FIRSTNAME",
        "last_name": "OLD_LASTNAME",
        "full_name": "OLD_FIRSTNAME OLD_LASTNAME",
        "athlete_code": "XYZW9876QRST",
        "qr_identifier": "XYZW9876QRST",
        "date_of_birth": datetime(2000, 1, 1),
        "is_minor": False,
    })
    await db.users.insert_one({
        "id": user_id_b,
        "society_id": society_id,
        "email": "test_qr_athlete_nooverwrite@example.com",
        "password_hash": hash_password("password123"),
        "role": "athlete",
        "athlete_id": athlete_id_b,
        "first_name": "NEW_FIRSTNAME",
        "last_name": "NEW_LASTNAME",
        "status": "approved",
        "created_at": datetime.utcnow(),
    })

    result_b = await get_me(FakeRequest(), {"id": user_id_b, "role": "athlete"})
    assert result_b.get("first_name") == "NEW_FIRSTNAME", "users.first_name must win"
    assert result_b.get("last_name") == "NEW_LASTNAME"
