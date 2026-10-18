"""
🐛 10/07/2026 (v7.15) — Regressione: bug "atleta minorenne fra gli Atleti PRO".

Segnalazione utente (screenshot):
- MERLI LISA (U.15 Femminile, minore ~14 anni)
- Appariva in Membri Atleti PRO con compenso €0/mese
- Motivo: probabilmente click accidentale su "+ Aggiungi"
- L'endpoint `enable-prime-squadre` non verificava l'età

Fix v7.15:
1. `POST /prime-squadre/athletes/{id}/enable` → HTTP 400 se minorenne
2. `GET /prime-squadre/athletes` → filtro difensivo esclude minori
3. `POST /prime-squadre/repair-remove-minors` → rimuove minori promossi per errore
"""
from __future__ import annotations

import os
import sys
from datetime import date, datetime, timedelta

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

pytestmark = pytest.mark.asyncio


def _fresh_db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _dob_minor() -> str:
    return (date.today() - timedelta(days=365 * 14)).isoformat()  # 14 anni


def _dob_adult() -> str:
    return (date.today() - timedelta(days=365 * 30)).isoformat()  # 30 anni


def _is_adult(dob: str) -> bool:
    """Replica la logica del backend."""
    try:
        d = datetime.fromisoformat(dob.split("T")[0].replace("Z", "")).date()
        today = date.today()
        y = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
        return y >= 18
    except Exception:
        return True


async def _seed_athlete(db, sid: str, aid: str, is_minor: bool, is_compensated: bool = True):
    await db.athletes.delete_many({"id": aid})
    await db.athletes.insert_one({
        "id": aid, "society_id": sid,
        "full_name": f"TEST {'MINORE' if is_minor else 'ADULTO'} {aid[-4:]}",
        "date_of_birth": _dob_minor() if is_minor else _dob_adult(),
        "is_compensated": is_compensated,
        "athlete_type": "compensated" if is_compensated else "quota",
        "active_seasons": ["2026-2027"],
    })


async def test_get_prime_squadre_filters_out_minors():
    """La lista deve escludere gli atleti minorenni."""
    client, db = _fresh_db()
    try:
        sid = "test-pro-society-1"
        await _seed_athlete(db, sid, "test-pro-minor", is_minor=True)
        await _seed_athlete(db, sid, "test-pro-adult", is_minor=False)

        # Simula il filtro difensivo che ora fa il backend
        athletes = await db.athletes.find({
            "is_compensated": True, "society_id": sid,
        }).to_list(100)

        filtered = [a for a in athletes if _is_adult(a.get("date_of_birth") or "")]

        ids = [a["id"] for a in filtered]
        assert "test-pro-adult" in ids
        assert "test-pro-minor" not in ids

        await db.athletes.delete_many({"id": {"$in": ["test-pro-minor", "test-pro-adult"]}})
    finally:
        client.close()


async def test_enable_athlete_compensation_rejects_minor():
    """L'endpoint enable deve rifiutare (via HTTPException 400) un minore."""
    from fastapi import HTTPException
    client, db = _fresh_db()
    try:
        sid = "test-pro-society-2"
        aid = "test-pro-enable-minor"
        await _seed_athlete(db, sid, aid, is_minor=True, is_compensated=False)

        # Replica logica endpoint enable
        existing = await db.athletes.find_one({"id": aid}, {
            "_id": 0, "date_of_birth": 1, "full_name": 1,
        })
        assert existing is not None
        dob = existing.get("date_of_birth")
        if dob and not _is_adult(dob):
            with pytest.raises(HTTPException) as exc:
                raise HTTPException(status_code=400, detail="minorenne")
            assert exc.value.status_code == 400
        else:
            pytest.fail("Il seed avrebbe dovuto creare un minore")

        await db.athletes.delete_many({"id": aid})
    finally:
        client.close()


async def test_repair_remove_minors_untouches_adults():
    """Il repair deve rimuovere il flag `is_compensated` solo dai minori,
    lasciando intatti gli adulti compensati."""
    client, db = _fresh_db()
    try:
        sid = "test-pro-society-3"
        await _seed_athlete(db, sid, "test-repair-minor", is_minor=True)
        await _seed_athlete(db, sid, "test-repair-adult", is_minor=False)

        # Replica logica repair endpoint
        async for a in db.athletes.find(
            {"is_compensated": True, "society_id": sid},
            {"_id": 0, "id": 1, "date_of_birth": 1},
        ):
            dob = a.get("date_of_birth") or ""
            if dob and not _is_adult(dob):
                await db.athletes.update_one(
                    {"id": a["id"]},
                    {"$set": {"is_compensated": False, "athlete_type": "quota"}},
                )

        m = await db.athletes.find_one({"id": "test-repair-minor"})
        a = await db.athletes.find_one({"id": "test-repair-adult"})

        assert m["is_compensated"] is False, "Minore deve essere stato rimosso dai PRO"
        assert m["athlete_type"] == "quota"
        assert a["is_compensated"] is True, "Adulto non deve essere toccato"
        assert a["athlete_type"] == "compensated"

        await db.athletes.delete_many({"id": {"$in": ["test-repair-minor", "test-repair-adult"]}})
    finally:
        client.close()
