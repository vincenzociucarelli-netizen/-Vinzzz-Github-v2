"""
🐛 10/07/2026 (v7.15) — Regressione: bug "cartella Genitori vuota".

Segnalazione utente (screenshot Chiara Opale):
- Nella scheda anagrafica di Chiara: OPALE SANDRO (primo) + UNI LISA (secondo)
- Nella cartella Genitori dell'admin: ZERO genitori visibili
- Admin non può resettare la password di Lisa perché non la trova

Root cause (`/api/users/parents` in server.py):
- Filtrava solo utenti con `active_seasons: current_season` (o senza)
- I genitori esistenti rimasti nella stagione precedente → invisibili
- `athlete_counts` aggregava solo su `parent_id`, ignorando `second_parent_id`

Fix v7.15:
- La source-of-truth diventa "parents linkati (primary o secondary) ad atleti
  attivi in current_season"
- Self-heal automatico: parents linkati ma senza current_season vengono
  auto-riportati in active_seasons (silenziosamente).
"""
from __future__ import annotations

import os
import sys

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

pytestmark = pytest.mark.asyncio


def _fresh_db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


async def _seed_chiara_opale_scenario(db, sid: str, current_season: str, prev_season: str):
    """Ricrea lo scenario esatto della segnalazione."""
    parent_primary = "test-sandro-opale"
    parent_second = "test-lisa-uni"
    athlete_id = "test-chiara-opale"

    await db.users.delete_many({"id": {"$in": [parent_primary, parent_second]}})
    await db.athletes.delete_many({"id": athlete_id})

    # Padre primario: rimasto nella stagione precedente
    await db.users.insert_one({
        "id": parent_primary, "society_id": sid, "role": "parent",
        "email": "sandro.opale@test.com", "full_name": "OPALE SANDRO",
        "active_seasons": [prev_season],
        "status": "approved",
    })
    # Madre secondaria: rimasta nella stagione precedente
    await db.users.insert_one({
        "id": parent_second, "society_id": sid, "role": "parent",
        "email": "lisa1@test.com", "full_name": "UNI LISA",
        "active_seasons": [prev_season],
        "status": "approved",
    })
    # Chiara: atleta attivo in stagione corrente, con entrambi i genitori collegati
    await db.athletes.insert_one({
        "id": athlete_id, "society_id": sid,
        "first_name": "CHIARA", "last_name": "OPALE", "full_name": "OPALE CHIARA",
        "parent_id": parent_primary,
        "second_parent_id": parent_second,
        "active_seasons": [current_season],
        "status": "trial",
    })
    return parent_primary, parent_second, athlete_id


async def test_get_parents_shows_linked_parents_even_if_in_prev_season():
    """Simula la logica del NUOVO endpoint /users/parents."""
    client, db = _fresh_db()
    try:
        sid = "test-parents-visible-society"
        current_season = "2099-2100"
        prev_season = "2098-2099"

        p_pri, p_sec, ath_id = await _seed_chiara_opale_scenario(db, sid, current_season, prev_season)

        # ─── Replica logica endpoint ───
        athletes = await db.athletes.find(
            {"society_id": sid, "active_seasons": current_season},
            {"_id": 0, "id": 1, "parent_id": 1, "second_parent_id": 1},
        ).to_list(5000)

        linked_ids = set()
        counts = {}
        for a in athletes:
            for pid in [a.get("parent_id"), a.get("second_parent_id")]:
                if pid:
                    linked_ids.add(pid)
                    counts[pid] = counts.get(pid, 0) + 1

        parents = await db.users.find({
            "role": "parent", "society_id": sid,
            "$or": [
                {"id": {"$in": list(linked_ids)}},
                {"active_seasons": current_season},
                {"active_seasons": {"$exists": False}},
            ],
        }).to_list(5000)

        # 1️⃣ Entrambi i genitori devono comparire
        ids_found = {p["id"] for p in parents}
        assert p_pri in ids_found, "Padre primario deve comparire nella lista"
        assert p_sec in ids_found, "Madre secondaria deve comparire nella lista"

        # 2️⃣ Il conteggio deve includere il secondo genitore
        assert counts.get(p_pri) == 1
        assert counts.get(p_sec) == 1

        # 3️⃣ Self-heal: dopo il fetch, apply del $addToSet
        needing_heal = [
            p["id"] for p in parents
            if p["id"] in linked_ids
            and current_season not in (p.get("active_seasons") or [])
        ]
        if needing_heal:
            await db.users.update_many(
                {"id": {"$in": needing_heal}, "society_id": sid, "role": "parent"},
                {"$addToSet": {"active_seasons": current_season}},
            )
        # Ora entrambi i genitori hanno active_seasons aggiornato
        for pid in [p_pri, p_sec]:
            u = await db.users.find_one({"id": pid})
            assert current_season in u["active_seasons"], f"Self-heal fallito per {pid}"
            assert prev_season in u["active_seasons"], "Storico deve essere preservato"

        # Cleanup
        await db.users.delete_many({"id": {"$in": [p_pri, p_sec]}})
        await db.athletes.delete_many({"id": ath_id})
    finally:
        client.close()


async def test_get_parents_second_parent_alone_still_visible():
    """Se un atleta ha SOLO second_parent_id (parent_id vuoto), il secondo
    genitore deve comunque comparire nella lista."""
    client, db = _fresh_db()
    try:
        sid = "test-parents-visible-society-2"
        current_season = "2099-2100"

        p_sec = "test-only-second-parent"
        ath = "test-athlete-second-only"
        await db.users.delete_many({"id": p_sec})
        await db.athletes.delete_many({"id": ath})

        await db.users.insert_one({
            "id": p_sec, "society_id": sid, "role": "parent",
            "email": "solo@second.com", "full_name": "SECONDO GENITORE",
            "active_seasons": [],
            "status": "approved",
        })
        await db.athletes.insert_one({
            "id": ath, "society_id": sid,
            "full_name": "TEST ATH", "parent_id": None,
            "second_parent_id": p_sec,
            "active_seasons": [current_season],
        })

        athletes = await db.athletes.find(
            {"society_id": sid, "active_seasons": current_season},
            {"_id": 0, "id": 1, "parent_id": 1, "second_parent_id": 1},
        ).to_list(5000)
        linked = set()
        for a in athletes:
            for pid in [a.get("parent_id"), a.get("second_parent_id")]:
                if pid:
                    linked.add(pid)
        assert p_sec in linked

        parents = await db.users.find({
            "role": "parent", "society_id": sid,
            "$or": [
                {"id": {"$in": list(linked)}},
                {"active_seasons": current_season},
                {"active_seasons": {"$exists": False}},
            ],
        }).to_list(5000)
        assert any(p["id"] == p_sec for p in parents), \
            "Il second_parent_id deve comparire anche senza primary"

        await db.users.delete_many({"id": p_sec})
        await db.athletes.delete_many({"id": ath})
    finally:
        client.close()
