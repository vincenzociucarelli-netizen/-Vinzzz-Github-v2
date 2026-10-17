"""
Test for FIX timezone bucketing in GET /api/coach/commitments.

Background (30/08/2026):
The endpoint used to compute today/tomorrow/day_after with datetime.utcnow(),
so in the Italian evening/night hours (UTC still on the previous day compared
to Europe/Rome), a training scheduled for the Italian "Lunedì" was NOT bucketed
into "today" and slipped into "tomorrow" for a coach/athlete whose device is
in Europe/Rome.

Fix: server.py line ~17152 now uses now_it().replace(tzinfo=None) (Europe/Rome).

These tests:
  - test_training_bucketed_on_italian_today_and_tomorrow
      Create a team with activity_start_date = today (IT) and two training
      sessions on IT-today and IT-tomorrow. Verify commitments buckets them
      into "today" and "tomorrow" respectively (regardless of whether the
      server is currently in the previous UTC day).
  - test_no_activity_start_date_hides_trainings
      Team without activity_start_date -> trainings must not appear.
"""
import os
import asyncio
import uuid
import datetime as dt

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

try:
    from zoneinfo import ZoneInfo
    IT_TZ = ZoneInfo("Europe/Rome")
except Exception:  # pragma: no cover
    IT_TZ = dt.timezone(dt.timedelta(hours=2))


BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test1234"

DAYS_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]


def italian_day_name(offset_days: int = 0) -> str:
    n = dt.datetime.now(IT_TZ) + dt.timedelta(days=offset_days)
    return DAYS_IT[n.weekday()]


def italian_today_iso() -> str:
    return dt.datetime.now(IT_TZ).strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mongo(loop):
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def admin_context(loop, mongo):
    """Login admin, resolve society_id."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} {resp.text}"
    payload = resp.json()
    token = payload.get("access_token") or payload.get("token")
    assert token, f"No token: {payload}"

    async def get_user():
        return await mongo.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})

    user = loop.run_until_complete(get_user())
    assert user, "Admin not found in DB"
    society_id = user.get("society_id")
    assert society_id, "Admin has no society_id"
    return {"token": token, "society_id": society_id, "admin_id": user.get("id")}


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_health(admin_context):
    """Endpoint reachable with admin token."""
    r = requests.get(
        f"{BASE_URL}/api/coach/commitments",
        headers=_headers(admin_context["token"]),
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    data = r.json()
    for k in ("today", "tomorrow", "day_after"):
        assert k in data


def test_training_bucketed_on_italian_today_and_tomorrow(loop, mongo, admin_context):
    """
    The core timezone bug: a training on the Italian today's weekday must be
    listed in 'today'. Same for tomorrow.
    """
    society_id = admin_context["society_id"]
    token = admin_context["token"]

    it_today_day = italian_day_name(0)
    it_tomorrow_day = italian_day_name(1)
    today_iso = italian_today_iso()

    team_id = f"TEST_TZ_TEAM_{uuid.uuid4().hex[:10]}"
    athlete_id = f"TEST_TZ_ATH_{uuid.uuid4().hex[:10]}"

    # Unique venues so we can identify the specific sessions in the response
    venue_today = f"TEST_VENUE_TODAY_{uuid.uuid4().hex[:6]}"
    venue_tomorrow = f"TEST_VENUE_TOMORROW_{uuid.uuid4().hex[:6]}"

    team_doc = {
        "id": team_id,
        "society_id": society_id,
        "name": f"TEST_TZ_TEAM_{team_id[-6:]}",
        "gender": "M",
        "category": "TEST",
        "activity_start_date": today_iso,
        "training_sessions": [
            {"day": it_today_day, "timeStart": "18:30", "timeEnd": "20:30", "venue": venue_today},
            {"day": it_tomorrow_day, "timeStart": "18:00", "timeEnd": "20:00", "venue": venue_tomorrow},
        ],
    }
    athlete_doc = {
        "id": athlete_id,
        "society_id": society_id,
        "team_id": team_id,
        "first_name": "TEST",
        "last_name": "TZ",
        "fiscal_code": f"TSTTZ{uuid.uuid4().hex[:11].upper()}",
        "status": "active",
    }

    async def setup():
        await mongo.teams.insert_one(team_doc)
        await mongo.athletes.insert_one(athlete_doc)

    async def teardown():
        await mongo.teams.delete_one({"id": team_id})
        await mongo.athletes.delete_one({"id": athlete_id})

    loop.run_until_complete(setup())
    try:
        r = requests.get(
            f"{BASE_URL}/api/coach/commitments",
            headers=_headers(token),
            params={"athlete_id": athlete_id},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()

        today_items = data.get("today", [])
        tomorrow_items = data.get("tomorrow", [])
        day_after_items = data.get("day_after", [])

        # Session on IT-today MUST be in today
        today_matches = [
            i for i in today_items
            if i.get("type") == "training"
            and i.get("team_id") == team_id
            and i.get("venue") == venue_today
        ]
        assert len(today_matches) == 1, (
            f"BUG: Italian today's training ({it_today_day}) NOT in 'today' bucket. "
            f"today_items={today_items} | tomorrow_items={tomorrow_items} | "
            f"day_after_items={day_after_items} | IT-today={it_today_day}, IT-tomorrow={it_tomorrow_day}"
        )

        # And must NOT appear in tomorrow
        misplaced_in_tomorrow = [
            i for i in tomorrow_items
            if i.get("type") == "training"
            and i.get("team_id") == team_id
            and i.get("venue") == venue_today
        ]
        assert len(misplaced_in_tomorrow) == 0, (
            f"BUG: IT-today's training leaked into 'tomorrow'. Got: {misplaced_in_tomorrow}"
        )

        # Session on IT-tomorrow MUST be in tomorrow
        tomorrow_matches = [
            i for i in tomorrow_items
            if i.get("type") == "training"
            and i.get("team_id") == team_id
            and i.get("venue") == venue_tomorrow
        ]
        assert len(tomorrow_matches) == 1, (
            f"BUG: IT-tomorrow's training ({it_tomorrow_day}) NOT in 'tomorrow' bucket. "
            f"today_items={today_items} | tomorrow_items={tomorrow_items} | "
            f"day_after_items={day_after_items}"
        )

        # And must NOT be misplaced in day_after
        misplaced_in_day_after = [
            i for i in day_after_items
            if i.get("type") == "training"
            and i.get("team_id") == team_id
            and i.get("venue") == venue_tomorrow
        ]
        assert len(misplaced_in_day_after) == 0, (
            f"BUG: IT-tomorrow's training leaked into 'day_after'. Got: {misplaced_in_day_after}"
        )
    finally:
        loop.run_until_complete(teardown())


def test_no_activity_start_date_hides_trainings(loop, mongo, admin_context):
    """
    Regression: a team WITHOUT activity_start_date must have all trainings hidden.
    """
    society_id = admin_context["society_id"]
    token = admin_context["token"]

    it_today_day = italian_day_name(0)
    it_tomorrow_day = italian_day_name(1)

    team_id = f"TEST_TZ_NOACT_{uuid.uuid4().hex[:10]}"
    athlete_id = f"TEST_TZ_NOACT_ATH_{uuid.uuid4().hex[:10]}"
    venue = f"TEST_HIDDEN_{uuid.uuid4().hex[:6]}"

    team_doc = {
        "id": team_id,
        "society_id": society_id,
        "name": f"TEST_TZ_NOACT_{team_id[-6:]}",
        "gender": "M",
        "category": "TEST",
        # no activity_start_date
        "training_sessions": [
            {"day": it_today_day, "timeStart": "18:30", "timeEnd": "20:30", "venue": venue},
            {"day": it_tomorrow_day, "timeStart": "18:00", "timeEnd": "20:00", "venue": venue},
        ],
    }
    athlete_doc = {
        "id": athlete_id,
        "society_id": society_id,
        "team_id": team_id,
        "first_name": "TEST",
        "last_name": "TZ_NOACT",
        "fiscal_code": f"TSTNA{uuid.uuid4().hex[:11].upper()}",
        "status": "active",
    }

    async def setup():
        await mongo.teams.insert_one(team_doc)
        await mongo.athletes.insert_one(athlete_doc)

    async def teardown():
        await mongo.teams.delete_one({"id": team_id})
        await mongo.athletes.delete_one({"id": athlete_id})

    loop.run_until_complete(setup())
    try:
        r = requests.get(
            f"{BASE_URL}/api/coach/commitments",
            headers=_headers(token),
            params={"athlete_id": athlete_id},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()

        for bucket in ("today", "tomorrow", "day_after", "upcoming"):
            leaks = [
                i for i in data.get(bucket, [])
                if i.get("type") == "training"
                and i.get("team_id") == team_id
            ]
            assert len(leaks) == 0, (
                f"Regression: trainings must be hidden for team without activity_start_date. "
                f"Bucket '{bucket}' contains: {leaks}"
            )
    finally:
        loop.run_until_complete(teardown())
