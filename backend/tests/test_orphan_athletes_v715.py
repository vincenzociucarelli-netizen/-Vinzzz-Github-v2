"""
🩺 09/07/2026 (v7.15) — Test regressione: atleti minori orfani.

Segnalazione utente: "Ci sono vari ragazzi registrati su LA TUA SOCIETA ASD
ma nessun genitore 😱".

Root cause: `import-member` applicato a un minore non aggiornava
`active_seasons` del genitore collegato → il genitore restava nella stagione
precedente e nella dashboard admin l'atleta appariva "senza genitore".

Test coverage:
- L'import di un atleta minore auto-importa i suoi genitori.
- L'endpoint diagnostic identifica atleti orfani (parent con active_seasons vecchio).
- L'endpoint repair aggiunge la stagione corrente ai genitori orfani.
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import date, timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

pytestmark = pytest.mark.asyncio


async def _seed(db, sid: str, current_season: str, prev_season: str):
    """Crea una società, un genitore in stagione precedente, un minore che punta al genitore."""
    parent_id = "test-orphan-parent-1"
    athlete_id = "test-orphan-athlete-1"
    # ensure clean
    await db.users.delete_many({"id": {"$in": [parent_id]}})
    await db.athletes.delete_many({"id": {"$in": [athlete_id]}})

    dob = (date.today() - timedelta(days=365 * 10)).isoformat()  # 10 anni → minore

    await db.users.insert_one({
        "id": parent_id,
        "society_id": sid,
        "role": "parent",
        "email": "orphan.parent@test.local",
        "full_name": "PARENT ORPHAN",
        "active_seasons": [prev_season],   # <-- rimasto nella vecchia stagione
        "status": "approved",
    })
    await db.athletes.insert_one({
        "id": athlete_id,
        "society_id": sid,
        "first_name": "SOFIA",
        "last_name": "ORPHAN",
        "full_name": "ORPHAN SOFIA",
        "date_of_birth": dob,
        "parent_id": parent_id,
        "active_seasons": [current_season],
        "status": "active",
    })
    return parent_id, athlete_id


async def test_orphan_detection_and_repair():
    from database import db
    from routes.seasons import diagnostic_orphan_athletes, repair_orphan_athletes, RepairOrphanBody
    from utils import get_current_season_for_society

    sid = "test-orphan-society"
    # Usa i calcoli reali (dipendenti dalla data odierna) per allineare con l'endpoint
    current_season = await get_current_season_for_society(db, sid)
    # Stagione precedente = solo un anno di differenza (finto)
    y1, y2 = current_season.split("-")
    prev_season = f"{int(y1)-1}-{int(y2)-1}"

    parent_id, athlete_id = await _seed(db, sid, current_season, prev_season)

    # Patch settings to simulate current_season for this society
    # (viene ricalcolato dinamicamente da season_start_month/day, quindi non serve
    # forzare il valore, ma settiamo comunque il doc affinché la query non fallisca)
    await db.settings.update_one(
        {"society_id": sid, "type": "society"},
        {"$set": {"society_id": sid, "type": "society"}},
        upsert=True,
    )

    fake_admin = {"id": "test-admin", "role": "admin", "society_id": sid,
                  "full_name": "Test Admin"}

    # 1. Diagnostica
    diag = await diagnostic_orphan_athletes(current_user=fake_admin)
    assert diag["current_season"] == current_season
    assert diag["counts"]["athletes_minor_current_season"] >= 1
    assert diag["counts"]["orphans_parent_prev_season"] >= 1
    assert parent_id in diag["parent_ids_to_import"]

    # 2. Repair
    result = await repair_orphan_athletes(
        body=RepairOrphanBody(confirmation="CONFERMA"),
        current_user=fake_admin,
    )
    assert result["ok"] is True
    ids_imported = [p["id"] for p in result["parents_imported"]]
    assert parent_id in ids_imported

    # 3. Verifica DB
    parent = await db.users.find_one({"id": parent_id})
    assert current_season in parent["active_seasons"]
    assert prev_season in parent["active_seasons"]  # storico preservato

    # 4. Post-repair diagnostica: 0 orfani
    diag2 = await diagnostic_orphan_athletes(current_user=fake_admin)
    assert diag2["counts"]["orphans_parent_prev_season"] == 0

    # Cleanup
    await db.users.delete_many({"id": parent_id})
    await db.athletes.delete_many({"id": athlete_id})
    await db.settings.delete_many({"society_id": sid})


async def test_repair_requires_confirmation():
    from fastapi import HTTPException
    from routes.seasons import repair_orphan_athletes, RepairOrphanBody
    fake_admin = {"id": "test-admin", "role": "admin", "society_id": "any",
                  "full_name": "Test Admin"}
    with pytest.raises(HTTPException) as exc:
        await repair_orphan_athletes(
            body=RepairOrphanBody(confirmation="no"),
            current_user=fake_admin,
        )
    assert exc.value.status_code == 400


async def test_diagnostic_requires_admin():
    from fastapi import HTTPException
    from routes.seasons import diagnostic_orphan_athletes
    with pytest.raises(HTTPException) as exc:
        await diagnostic_orphan_athletes(current_user={"role": "parent", "society_id": "x"})
    assert exc.value.status_code == 403
