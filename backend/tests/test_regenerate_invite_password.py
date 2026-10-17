"""
Test password-protected society invite code regeneration (27/02/2026).

Ensures that /societies/regenerate-invite-code:
- Rejects with 401 if the wrong password is provided.
- Accepts and generates a new code when the correct password is provided.
- Rejects with 400 if the admin user has no password_hash.
"""
import os
import sys
import pytest
import pytest_asyncio
from datetime import datetime
from bson import ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import db, hash_password, regenerate_invite_code, RegenInviteCodeRequest
from fastapi import HTTPException


@pytest_asyncio.fixture
async def cleanup():
    await db.users.delete_many({"id": {"$regex": "^test-regen-"}})
    await db.societies.delete_many({"id": {"$regex": "^test-regen-"}})
    yield
    await db.users.delete_many({"id": {"$regex": "^test-regen-"}})
    await db.societies.delete_many({"id": {"$regex": "^test-regen-"}})


@pytest.mark.asyncio
async def test_regenerate_invite_code_password_scenarios(cleanup):
    society_id = "test-regen-soc"
    admin_id = "test-regen-admin"
    old_code = "OLDCODE1"

    await db.societies.insert_one({
        "id": society_id,
        "name": "Test Society",
        "invite_code": old_code,
    })
    await db.users.insert_one({
        "id": admin_id,
        "society_id": society_id,
        "role": "admin",
        "email": "regen-admin@test.example.com",
        "password_hash": hash_password("secret123"),
        "first_name": "Admin",
    })

    admin_user = {"id": admin_id, "role": "admin", "society_id": society_id}

    # --- Case A: correct password → success + new code ---
    result = await regenerate_invite_code(
        RegenInviteCodeRequest(password="secret123"),
        admin_user,
    )
    assert result.get("invite_code") and result["invite_code"] != old_code
    new_code = result["invite_code"]
    soc = await db.societies.find_one({"id": society_id})
    assert soc["invite_code"] == new_code

    # --- Case B: wrong password → 401 ---
    with pytest.raises(HTTPException) as exc:
        await regenerate_invite_code(
            RegenInviteCodeRequest(password="wrong-password"),
            admin_user,
        )
    assert exc.value.status_code == 401
    # Code should NOT have changed
    soc2 = await db.societies.find_one({"id": society_id})
    assert soc2["invite_code"] == new_code

    # --- Case C: admin without password_hash → 400 ---
    await db.users.update_one({"id": admin_id}, {"$unset": {"password_hash": ""}})
    with pytest.raises(HTTPException) as exc2:
        await regenerate_invite_code(
            RegenInviteCodeRequest(password="anything"),
            admin_user,
        )
    assert exc2.value.status_code == 400
