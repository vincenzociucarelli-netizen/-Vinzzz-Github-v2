"""
Tests for BUG-1: Coach dashboard - trainings must be HIDDEN on match days
for BOTH home and away matches (any match type hides the training of that team).
Endpoint: GET /api/coach/commitments
Fix verified at /app/backend/server.py around line ~11920 (home_match_days set
is populated for ALL matches regardless of home_away).
"""
import os
import asyncio
import datetime as dt
import uuid

import bcrypt
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else "https://zaino-coach-hub.preview.emergentagent.com"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

COACH_EMAIL = "alice@test.com"
KNOWN_PASSWORD = "TestCoach123!"


@pytest.fixture(scope="module")
def loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mongo(loop):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    return db


@pytest.fixture(scope="module")
def auth_token(loop, mongo):
    """Set a known password for alice@test.com, login, return token. Restore on teardown."""
    db = mongo

    async def setup_password():
        user = await db.users.find_one({"email": COACH_EMAIL})
        assert user is not None, f"Coach {COACH_EMAIL} not found in DB"
        original_hash = user.get("password_hash")
        # Set known password
        new_hash = bcrypt.hashpw(KNOWN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.users.update_one({"email": COACH_EMAIL}, {"$set": {"password_hash": new_hash}})
        return original_hash, user["id"], user.get("assigned_teams", [])

    original_hash, coach_id, team_ids = loop.run_until_complete(setup_password())

    # Login via API
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COACH_EMAIL,
        "password": KNOWN_PASSWORD,
    }, timeout=30)
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    token = resp.json().get("access_token") or resp.json().get("token")
    assert token, f"No token in response: {resp.json()}"

    yield {"token": token, "coach_id": coach_id, "team_ids": team_ids}

    # Restore original password
    async def restore():
        await db.users.update_one(
            {"email": COACH_EMAIL},
            {"$set": {"password_hash": original_hash}},
        )
    loop.run_until_complete(restore())


def _italian_day_for(date_obj: dt.datetime) -> str:
    days_it = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]
    return days_it[date_obj.weekday()]


def test_health(auth_token):
    """Sanity: token validates and endpoint is reachable"""
    r = requests.get(
        f"{BASE_URL}/api/coach/commitments",
        headers={"Authorization": f"Bearer {auth_token['token']}"},
        timeout=30,
    )
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
    data = r.json()
    assert "today" in data and "tomorrow" in data and "day_after" in data


def test_training_hidden_on_away_match_day(loop, mongo, auth_token):
    """
    Insert a temporary training session for tomorrow's weekday for team[0],
    then insert an AWAY match for tomorrow for the same team.
    Verify the training does NOT appear in commitments.tomorrow for that team.
    """
    db = mongo
    team_id = auth_token["team_ids"][0]
    tomorrow = dt.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + dt.timedelta(days=1)
    italian_day = _italian_day_for(tomorrow)

    # Backup team training_sessions
    async def setup():
        team = await db.teams.find_one({"id": team_id})
        original_sessions = team.get("training_sessions", [])
        # Add a TEST training session for tomorrow's weekday
        test_session = {
            "day": italian_day,
            "timeStart": "20:00",
            "timeEnd": "21:30",
            "venue": "TEST_VENUE_AWAY_MATCH",
        }
        new_sessions = list(original_sessions) + [test_session]
        await db.teams.update_one({"id": team_id}, {"$set": {"training_sessions": new_sessions}})

        # Insert TEST away match for tomorrow
        match_id = f"TEST_AWAY_MATCH_{uuid.uuid4().hex[:8]}"
        match_doc = {
            "id": match_id,
            "team_id": team_id,
            "opponent": "TEST_OPPONENT",
            "date": tomorrow,
            "time": "18:00",
            "venue": "TEST_AWAY_VENUE",
            "city": "TEST_CITY",
            "home_away": "away",
            "match_number": f"TEST{uuid.uuid4().hex[:6]}",
            "championship": "TEST",
        }
        await db.matches.insert_one(match_doc)
        return original_sessions, match_id

    original_sessions, match_id = loop.run_until_complete(setup())

    try:
        # Call API
        r = requests.get(
            f"{BASE_URL}/api/coach/commitments",
            headers={"Authorization": f"Bearer {auth_token['token']}"},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()

        # tomorrow should contain the match for the team but NOT the training
        tomorrow_items = data.get("tomorrow", [])

        match_items = [i for i in tomorrow_items if i.get("type") == "match" and i.get("team_id") == team_id]
        training_items = [
            i for i in tomorrow_items
            if i.get("type") == "training" and i.get("team_id") == team_id
            and i.get("venue") == "TEST_VENUE_AWAY_MATCH"
        ]

        assert len(match_items) >= 1, f"Expected away match in tomorrow but got: {tomorrow_items}"
        assert match_items[0].get("home_away") == "away", f"Expected away match. Got: {match_items[0]}"
        assert len(training_items) == 0, (
            f"BUG-1 NOT FIXED: Training should be hidden on away match day. "
            f"Found training items: {training_items}"
        )

        # Also verify no rifinitura entry was created for the away match
        rifin_items = [
            i for i in tomorrow_items
            if i.get("type") == "rifinitura" and i.get("team_id") == team_id
        ]
        assert len(rifin_items) == 0, f"Rifinitura should NOT be shown for away match. Got: {rifin_items}"

    finally:
        # Cleanup
        async def cleanup():
            await db.teams.update_one({"id": team_id}, {"$set": {"training_sessions": original_sessions}})
            await db.matches.delete_one({"id": match_id})
        loop.run_until_complete(cleanup())


def test_training_hidden_on_home_match_day_with_rifinitura(loop, mongo, auth_token):
    """
    Regression: training is hidden on HOME match days too (already-existing behavior).
    If rifinitura is configured AND enabled for the team, it should appear instead.
    """
    db = mongo
    team_id = auth_token["team_ids"][0]
    tomorrow = dt.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + dt.timedelta(days=1)
    italian_day = _italian_day_for(tomorrow)

    async def setup():
        team = await db.teams.find_one({"id": team_id})
        original_sessions = team.get("training_sessions", [])
        original_rifin = team.get("rifinitura")
        new_sessions = list(original_sessions) + [{
            "day": italian_day,
            "timeStart": "20:00",
            "timeEnd": "21:30",
            "venue": "TEST_VENUE_HOME_MATCH",
        }]
        await db.teams.update_one(
            {"id": team_id},
            {"$set": {
                "training_sessions": new_sessions,
                "rifinitura": {"enabled": True, "timeStart": "10:00", "timeEnd": "11:30", "venue": "TEST_RIFIN_VENUE"},
            }},
        )
        match_id = f"TEST_HOME_MATCH_{uuid.uuid4().hex[:8]}"
        match_doc = {
            "id": match_id,
            "team_id": team_id,
            "opponent": "TEST_OPP_HOME",
            "date": tomorrow,
            "time": "18:00",
            "venue": "TEST_HOME_VENUE",
            "city": "TEST",
            "home_away": "home",
            "match_number": f"TEST{uuid.uuid4().hex[:6]}",
            "championship": "TEST",
        }
        await db.matches.insert_one(match_doc)
        return original_sessions, original_rifin, match_id

    original_sessions, original_rifin, match_id = loop.run_until_complete(setup())

    try:
        r = requests.get(
            f"{BASE_URL}/api/coach/commitments",
            headers={"Authorization": f"Bearer {auth_token['token']}"},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        tomorrow_items = data.get("tomorrow", [])

        # Training should be HIDDEN
        hidden = [
            i for i in tomorrow_items
            if i.get("type") == "training" and i.get("team_id") == team_id
            and i.get("venue") == "TEST_VENUE_HOME_MATCH"
        ]
        assert len(hidden) == 0, f"Training should be hidden on HOME match day too. Found: {hidden}"

        # Rifinitura SHOULD appear (since enabled and HOME match)
        rifin = [i for i in tomorrow_items if i.get("type") == "rifinitura" and i.get("team_id") == team_id]
        assert len(rifin) >= 1, f"Rifinitura expected for HOME match with enabled rifin. tomorrow_items={tomorrow_items}"

    finally:
        async def cleanup():
            update_op = {"$set": {"training_sessions": original_sessions}}
            if original_rifin is None:
                update_op["$unset"] = {"rifinitura": ""}
            else:
                update_op["$set"]["rifinitura"] = original_rifin
            await db.teams.update_one({"id": team_id}, update_op)
            await db.matches.delete_one({"id": match_id})
        loop.run_until_complete(cleanup())
