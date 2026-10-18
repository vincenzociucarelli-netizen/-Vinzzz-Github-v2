"""
🐛 10/07/2026 (v7.15) — Regressione: bug "Già Percepito €X ma calendario mostra 0 mesi firmati".

Segnalazione utente (BRETELLI PAOLA):
- Widget "Già Percepito": €750,00 - 1 quietanza firmata
- Calendario Gestione Quietanze: TUTTI i mesi "Non firmata"
- Effetto: sfalsati i totali cumulativi per soglia Riforma Sport 5K/15K

RCA:
- Record DB legacy con `month: "Giugno"` (string) invece di `month: 6` (int)
- Widget somma tutti i record con receipt_signed=true (no filtro mese)
- Calendario cerca per `x.month === 6` (int) → non matcha "Giugno" → "Non firmata"

Fix v7.15:
- `GET /athletes/{id}/compensation/receipts`: normalizza automaticamente month
  string→int + signed→receipt_signed + amount→amount_gross
- `POST /admin/athletes/{id}/compensation/normalize-legacy`: fix permanente in DB
- `GET /admin/athletes/{id}/compensation/receipts/diagnostic`: report raw
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


async def _seed_legacy_receipt(db, athlete_id: str, sid: str) -> None:
    await db.athlete_compensation_receipts.delete_many({"athlete_id": athlete_id})
    await db.athlete_compensation_receipts.insert_one({
        "athlete_id": athlete_id,
        "society_id": sid,
        "year": 2026,
        "month": "Giugno",        # legacy: string invece di 6
        "signed": True,            # legacy: signed invece di receipt_signed
        "signed_date": "2026-07-01T10:00:00",
        "amount": 750,             # legacy: amount invece di amount_gross
    })


def _month_name_to_int_map():
    return {
        "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6,
        "luglio": 7, "agosto": 8, "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
    }


async def _run_normalize_logic(db, athlete_id: str) -> int:
    """Replica la logica dell'endpoint POST normalize-legacy."""
    mapping = _month_name_to_int_map()
    count = 0
    async for r in db.athlete_compensation_receipts.find({"athlete_id": athlete_id}, {"_id": 0}):
        changes = {}
        m = r.get("month")
        if isinstance(m, str):
            mi = mapping.get(m.strip().lower())
            if mi is not None:
                changes["month"] = mi
        if r.get("receipt_signed") is None and r.get("signed") is not None:
            changes["receipt_signed"] = bool(r.get("signed"))
        if not r.get("receipt_signed_date") and r.get("signed_date"):
            changes["receipt_signed_date"] = r.get("signed_date")
        if r.get("amount_gross") is None and r.get("amount") is not None:
            changes["amount_gross"] = r.get("amount")
        if changes:
            await db.athlete_compensation_receipts.update_one(
                {"athlete_id": athlete_id, "year": r.get("year"), "month": r.get("month")},
                {"$set": changes},
            )
            count += 1
    return count


async def test_legacy_receipt_month_string_gets_normalized():
    """Il campo month string 'Giugno' deve diventare 6 dopo normalize."""
    client, db = _fresh_db()
    try:
        aid = "test-receipt-legacy-month"
        sid = "test-society-legacy"
        await _seed_legacy_receipt(db, aid, sid)

        # Verifica raw seed
        r0 = await db.athlete_compensation_receipts.find_one({"athlete_id": aid})
        assert r0["month"] == "Giugno"
        assert r0["signed"] is True
        assert r0.get("receipt_signed") is None

        # Normalizza
        n = await _run_normalize_logic(db, aid)
        assert n == 1

        r1 = await db.athlete_compensation_receipts.find_one({"athlete_id": aid})
        assert r1["month"] == 6, f"month deve essere int 6, invece è {r1['month']!r}"
        assert r1["receipt_signed"] is True
        assert r1["amount_gross"] == 750

        # Idempotente: seconda esecuzione non tocca nulla
        n2 = await _run_normalize_logic(db, aid)
        assert n2 == 0

        await db.athlete_compensation_receipts.delete_many({"athlete_id": aid})
    finally:
        client.close()


async def test_calendar_find_matches_after_normalize():
    """Dopo normalize, il pattern `signedReceipts.find(x.month === 6)` deve
    trovare il record per Giugno."""
    client, db = _fresh_db()
    try:
        aid = "test-calendar-find"
        sid = "test-society-calendar"
        await _seed_legacy_receipt(db, aid, sid)
        await _run_normalize_logic(db, aid)

        receipts = await db.athlete_compensation_receipts.find({"athlete_id": aid}).to_list(100)

        # Simula la ricerca client-side del calendario
        target_year, target_month = 2026, 6
        found = next((x for x in receipts if x.get("year") == target_year and x.get("month") == target_month), None)
        assert found is not None, "Il calendario deve ora trovare il record per Giugno=6"
        assert found.get("receipt_signed") is True
        assert (found.get("amount_gross") or found.get("amount")) == 750

        await db.athlete_compensation_receipts.delete_many({"athlete_id": aid})
    finally:
        client.close()


async def test_widget_sum_matches_calendar_after_normalize():
    """Il widget 'Già Percepito' e il calendario devono restituire lo stesso
    numero di quietanze firmate dopo la normalizzazione."""
    client, db = _fresh_db()
    try:
        aid = "test-widget-calendar-consistency"
        sid = "test-society-consistency"
        # Seed: 3 record → 2 legacy string mesi + 1 int, tutti signed=true
        await db.athlete_compensation_receipts.delete_many({"athlete_id": aid})
        for month_val in ["Giugno", "Luglio", 8]:
            await db.athlete_compensation_receipts.insert_one({
                "athlete_id": aid, "society_id": sid,
                "year": 2026, "month": month_val,
                "signed": True, "signed_date": "2026-09-01",
                "amount": 750,
            })
        await _run_normalize_logic(db, aid)

        receipts = await db.athlete_compensation_receipts.find({"athlete_id": aid}).to_list(100)

        # Widget sum (no filter mese)
        widget_sum = sum((r.get("amount_gross") or r.get("amount") or 0)
                        for r in receipts if r.get("receipt_signed") or r.get("signed"))
        # Calendario: conta i mesi trovati per int
        calendar_hits = 0
        for target_m in [6, 7, 8]:
            if any(r.get("month") == target_m and r.get("year") == 2026 for r in receipts):
                calendar_hits += 1

        assert widget_sum == 2250, f"widget_sum atteso 2250, got {widget_sum}"
        assert calendar_hits == 3, f"calendario deve trovare 3 mesi, got {calendar_hits}"

        await db.athlete_compensation_receipts.delete_many({"athlete_id": aid})
    finally:
        client.close()


# ─────────────────────────────────────────────────────────────────────────────
# Estensione v7.15-hotfix6: stesso pattern per Coach / Dirigente / Collaboratore
# ─────────────────────────────────────────────────────────────────────────────

async def _run_normalize_logic_generic(db, collection_name: str, key: str, user_id: str) -> int:
    mapping = _month_name_to_int_map()
    count = 0
    coll = db[collection_name]
    async for r in coll.find({key: user_id}, {"_id": 0}):
        changes = {}
        m = r.get("month")
        if isinstance(m, str):
            mi = mapping.get(m.strip().lower())
            if mi is not None:
                changes["month"] = mi
        if r.get("receipt_signed") is None and r.get("signed") is not None:
            changes["receipt_signed"] = bool(r.get("signed"))
        if not r.get("receipt_signed_date") and r.get("signed_date"):
            changes["receipt_signed_date"] = r.get("signed_date")
        if r.get("amount_gross") is None and r.get("amount") is not None:
            changes["amount_gross"] = r.get("amount")
        if changes:
            await coll.update_one(
                {key: user_id, "year": r.get("year"), "month": r.get("month")},
                {"$set": changes},
            )
            count += 1
    return count


@pytest.mark.parametrize("collection,key", [
    ("coach_compensations", "coach_id"),
    ("dirigente_compensations", "dirigente_id"),
    ("collaboratore_compensations", "collaboratore_id"),
])
async def test_normalize_works_across_all_role_collections(collection, key):
    """Il pattern deve funzionare su tutte le 3 collezioni compensi non-atleta."""
    client, db = _fresh_db()
    try:
        uid = f"test-{key}-legacy"
        sid = f"test-society-{key}"
        await db[collection].delete_many({key: uid})
        await db[collection].insert_one({
            key: uid, "society_id": sid,
            "year": 2026, "month": "Marzo",
            "signed": True, "signed_date": "2026-04-01",
            "amount": 400,
        })

        n = await _run_normalize_logic_generic(db, collection, key, uid)
        assert n == 1, f"{collection}: aspettavamo 1 update, got {n}"

        r = await db[collection].find_one({key: uid})
        assert r["month"] == 3, f"{collection}: month deve essere int 3, invece è {r['month']!r}"
        assert r["receipt_signed"] is True
        assert r["amount_gross"] == 400

        await db[collection].delete_many({key: uid})
    finally:
        client.close()
