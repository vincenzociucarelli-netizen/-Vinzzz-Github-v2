"""
🐛 10/07/2026 (v7.15) — Regressione: bug "atleti approvati riproposti in attesa".

RCA:
- L'endpoint `/api/seasons/backfill-reset-assignments` conteneva un secondo pass
  (linee ~875-907 in `routes/seasons.py`) che ripristinava incondizionatamente
  `status="pending"` a QUALUNQUE atleta con `team_id_previous_season` valorizzato,
  cancellando `trial_start_date` e altre approvazioni.
- Il campo `team_id_previous_season` è uno SNAPSHOT PERMANENTE quindi ogni
  invocazione dell'endpoint rifaceva il reset — anche sugli atleti nel frattempo
  approvati.
- Frontend `admin/seasons.tsx` chiamava questo endpoint SILENZIOSAMENTE ad ogni
  apertura pagina (`useEffect` on mount). Ogni volta che l'admin apriva Archivio
  Stagioni → 9 atleti approvati ricadevano in "Atleti in Attesa".

Fix v7.15:
- Frontend: rimosso auto-trigger. Endpoint chiamato SOLO da bottone manuale.
- Backend: aggiunto guard nel query: skip se `status==pending`, `approved_at`
  valorizzato o `_backfill_v0705_reset_done==true`.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

pytestmark = pytest.mark.asyncio


def _fresh_db():
    """Nuovo client motor ad ogni test per evitare 'Event loop is closed'."""
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


async def _seed_athlete(db, sid: str, athlete_id: str, base: dict) -> None:
    await db.athletes.delete_many({"id": athlete_id})
    doc = {
        "id": athlete_id,
        "society_id": sid,
        "first_name": "TEST",
        "last_name": "ATHLETE",
        "full_name": "TEST ATHLETE",
        "team_id_previous_season": "old-team-1",
        "active_seasons": [],
    }
    doc.update(base)
    await db.athletes.insert_one(doc)


async def _run_guarded_backfill(db, sid: str) -> None:
    """Replica il pass fix-ato dell'endpoint (guard su approved_at + flag)."""
    async for a in db.athletes.find(
        {"society_id": sid, "team_id_previous_season": {"$exists": True, "$nin": [None, ""]}},
        {"_id": 0, "id": 1},
    ):
        await db.athletes.update_one(
            {
                "id": a["id"], "society_id": sid,
                "status": {"$ne": "pending"},
                "approved_at": {"$in": [None, ""]},
                "_backfill_v0705_reset_done": {"$ne": True},
            },
            {"$set": {"status": "pending", "_backfill_v0705_reset_done": True},
             "$unset": {"trial_start_date": "", "trial_end_date": "", "is_trial": ""}},
        )


async def test_backfill_does_not_reset_approved_athlete():
    client, db = _fresh_db()
    try:
        sid = "test-backfill-guard-society-1"
        athlete_id = "test-approved-athlete"

        await _seed_athlete(db, sid, athlete_id, {
            "status": "trial",
            "approved_at": datetime.utcnow().isoformat(),
            "trial_start_date": datetime.utcnow().isoformat(),
            "trial_end_date": datetime.utcnow().isoformat(),
            "is_trial": True,
        })

        await _run_guarded_backfill(db, sid)

        ath = await db.athletes.find_one({"id": athlete_id})
        assert ath["status"] == "trial", f"BUG: atleta approvato è stato riportato a pending! (status={ath['status']})"
        assert ath.get("trial_start_date") is not None, "trial_start_date cancellato per atleta approvato — non deve accadere"
        await db.athletes.delete_many({"id": athlete_id})
    finally:
        client.close()


async def test_backfill_still_resets_untouched_athletes():
    client, db = _fresh_db()
    try:
        sid = "test-backfill-guard-society-2"
        athlete_id = "test-untouched-athlete"

        await _seed_athlete(db, sid, athlete_id, {
            "status": "active",
            "trial_start_date": None,
        })

        await _run_guarded_backfill(db, sid)

        ath = await db.athletes.find_one({"id": athlete_id})
        assert ath["status"] == "pending"
        assert ath.get("_backfill_v0705_reset_done") is True
        await db.athletes.delete_many({"id": athlete_id})
    finally:
        client.close()


async def test_backfill_skips_already_flagged_athlete():
    client, db = _fresh_db()
    try:
        sid = "test-backfill-guard-society-3"
        athlete_id = "test-flagged-athlete"

        await _seed_athlete(db, sid, athlete_id, {
            "status": "trial",
            "_backfill_v0705_reset_done": True,
        })

        await _run_guarded_backfill(db, sid)

        ath = await db.athletes.find_one({"id": athlete_id})
        assert ath["status"] == "trial", "BUG: atleta con flag già impostato è stato ritoccato"
        await db.athletes.delete_many({"id": athlete_id})
    finally:
        client.close()
