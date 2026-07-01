"""
Season archive routes (admin only).
- /seasons (list all archives)
- /seasons/current (current season summary)
- /seasons/archive (archive current season)
- /seasons/{season_name} (specific season)
- /seasons/athletes/{id}/renew-toggle (mark athlete renewed for next season)
- /seasons/athletes/bulk-renew (bulk renew)
- /seasons/import-renewed (import renewed athletes into current season)
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth_utils import get_current_user
from models.enums import UserRole, UserStatus
from models.season_models import SeasonArchive
from utils import clean_mongo_doc, clean_mongo_docs, get_current_season, get_current_season_for_society

router = APIRouter()


class BulkRenewBody(BaseModel):
    athlete_ids: List[str]
    value: bool = True


class BulkRenewUsersBody(BaseModel):
    """🆕 01/07/2026 — Bulk renew per Coach/Collaboratore/Dirigente (tabella db.users)."""
    user_ids: List[str]
    value: bool = True


class RenewToggleBody(BaseModel):
    value: Optional[bool] = None  # se None, toggla; se True/False, force-set


def _user_roles_in_scope() -> List[str]:
    """Ruoli sottoposti al ciclo di riconferma stagionale (oltre agli atleti).
    Include VIEWER perché la lista dirigenti nell'UI include sia DIRIGENTE che VIEWER."""
    return [UserRole.COACH, UserRole.COLLABORATORE, UserRole.DIRIGENTE, UserRole.VIEWER]


def _society_filter(current_user) -> dict:
    """🆕 30/06/2026 — Multi-tenancy: ogni admin vede SOLO i dati della propria
    società. Se per qualche motivo manca `society_id` su current_user
    restituiamo un filtro impossibile per essere conservativi (zero risultati,
    nessuna fuga di dati cross-società)."""
    sid = current_user.get("society_id")
    if not sid:
        return {"society_id": "__none__"}
    return {"society_id": sid}


@router.get("/seasons")
async def get_seasons(current_user = Depends(get_current_user)):
    """Get all season archives (admin only) — filtered by current admin's society."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere l'archivio")
    seasons = await db.season_archives.find(_society_filter(current_user)).sort("start_date", -1).to_list(100)
    clean_mongo_docs(seasons)
    return seasons


@router.get("/seasons/current")
async def get_current_season_data(current_user = Depends(get_current_user)):
    """Get current season summary — filtered by current admin's society."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i dati stagione")
    
    season_name = await get_current_season_for_society(db, current_user.get("society_id"))
    soc_q = _society_filter(current_user)

    teams = await db.teams.find(soc_q).to_list(100)
    clean_mongo_docs(teams)

    athletes = await db.athletes.find(soc_q).to_list(1000)
    clean_mongo_docs(athletes)

    coaches = await db.users.find({
        **soc_q, "role": UserRole.COACH, "status": UserStatus.APPROVED
    }).to_list(100)
    clean_mongo_docs(coaches)

    championships = await db.championships.find({
        **soc_q, "season": season_name
    }).to_list(100)
    clean_mongo_docs(championships)
    
    team_data = []
    for team in teams:
        team_athletes = [a for a in athletes if a.get("team_id") == team["id"] or a.get("team_id_2") == team["id"]]
        team_championships = [c for c in championships if c.get("team_id") == team["id"]]
        team_coaches = [c for c in coaches if team["id"] in c.get("assigned_teams", [])]
        team_data.append({
            "id": team["id"],
            "name": team["name"],
            "total_athletes": len(team_athletes),
            "athlete_names": [a["full_name"] for a in team_athletes],
            "championships": [c["name"] for c in team_championships],
            "coach_names": [c["full_name"] for c in team_coaches]
        })
    
    return {
        "season": season_name,
        "is_current": True,
        "total_teams": len(teams),
        "total_athletes": len(athletes),
        "total_coaches": len(coaches),
        "teams": team_data
    }


@router.post("/seasons/archive")
async def archive_season(current_user = Depends(get_current_user)):
    """Archive current season and create new one (admin only) — society-scoped."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può archiviare stagioni")
    
    current_data = await get_current_season_data(current_user)
    
    now = datetime.utcnow()
    season_name = await get_current_season_for_society(db, current_user.get("society_id"))
    sid = current_user.get("society_id")
    
    year_parts = season_name.split("-")
    start_year = int(year_parts[0])
    # 🆕 30/06/2026 — Date inizio/fine dalla configurazione società
    settings_doc = await db.settings.find_one({"type": "society", "society_id": sid}) if sid else None
    if not settings_doc:
        settings_doc = await db.settings.find_one({"type": "society"})
    start_month = int((settings_doc or {}).get("season_start_month", 7) or 7)
    start_day = int((settings_doc or {}).get("season_start_day", 1) or 1)
    try:
        start_date = datetime(start_year, start_month, start_day)
        # Fine = giorno PRIMA dell'inizio della stagione successiva
        next_start = datetime(start_year + 1, start_month, start_day)
        end_date = datetime.fromtimestamp(next_start.timestamp() - 86400)
    except Exception:
        start_date = datetime(start_year, 7, 1)
        end_date = datetime(start_year + 1, 6, 30)
    
    archive = SeasonArchive(
        season_name=season_name,
        start_date=start_date,
        end_date=end_date,
        is_current=False,
        teams=current_data["teams"],
        coaches=[{"name": c} for c in set(
            name for t in current_data["teams"] for name in t.get("coach_names", [])
        )],
        total_athletes=current_data["total_athletes"],
        total_teams=current_data["total_teams"],
        archived_at=now,
        archived_by=current_user["id"]
    )
    archive_doc = archive.dict()
    # 🆕 30/06/2026 — Stamp society_id sull'archivio (era sempre None → cross-leak)
    archive_doc["society_id"] = sid

    existing = await db.season_archives.find_one({"season_name": season_name, "society_id": sid})
    if existing:
        await db.season_archives.update_one(
            {"season_name": season_name, "society_id": sid},
            {"$set": archive_doc}
        )
    else:
        await db.season_archives.insert_one(archive_doc)
    
    return {"message": f"Stagione {season_name} archiviata con successo"}


@router.get("/seasons/{season_name}")
async def get_season_archive(season_name: str, current_user = Depends(get_current_user)):
    """Get specific season archive details — scoped to current admin's society."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere l'archivio")
    archive = await db.season_archives.find_one({
        "season_name": season_name,
        **_society_filter(current_user),
    })
    if not archive:
        raise HTTPException(status_code=404, detail="Stagione non trovata")
    clean_mongo_doc(archive)
    return archive


# ==================== RICONFERMA STAGIONE (01/07/2026) ====================

@router.post("/seasons/athletes/{athlete_id}/renew-toggle")
async def renew_athlete_toggle(
    athlete_id: str,
    body: Optional[RenewToggleBody] = None,
    current_user = Depends(get_current_user),
):
    """🆕 01/07/2026 — Riconferma di un singolo atleta per la PROSSIMA stagione.
    Se l'atleta è già stato importato in una stagione (`imported_to_season`
    corrisponde alla stagione corrente), restituiamo 409: l'admin non deve poter
    cambiare lo stato (il flag in UI è grigio "Già importato"). Per "ri-riconfermare"
    per la STAGIONE SUCCESSIVA, occorre attendere il prossimo cambio stagione."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    ath = await db.athletes.find_one({
        "id": athlete_id,
        **_society_filter(current_user),
    })
    if not ath:
        raise HTTPException(status_code=404, detail="Atleta non trovato in questa società")
    current_season = await get_current_season_for_society(db, current_user.get("society_id"))
    if ath.get("imported_to_season") == current_season:
        raise HTTPException(status_code=409, detail="Già importato nella stagione corrente — non modificabile.")
    new_value = (not bool(ath.get("renewed_for_next_season"))) if (body is None or body.value is None) else bool(body.value)
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {
            "renewed_for_next_season": new_value,
            "renewed_at": datetime.utcnow().isoformat() if new_value else None,
            "renewed_by": current_user["id"] if new_value else None,
        }}
    )
    return {"athlete_id": athlete_id, "renewed_for_next_season": new_value}


@router.post("/seasons/athletes/bulk-renew")
async def renew_athletes_bulk(body: BulkRenewBody, current_user = Depends(get_current_user)):
    """🆕 01/07/2026 — Riconferma multipla. Salta gli atleti già importati."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    current_season = await get_current_season_for_society(db, current_user.get("society_id"))
    soc_q = _society_filter(current_user)
    set_doc = {
        "renewed_for_next_season": bool(body.value),
        "renewed_at": datetime.utcnow().isoformat() if body.value else None,
        "renewed_by": current_user["id"] if body.value else None,
    }
    res = await db.athletes.update_many(
        {
            "id": {"$in": body.athlete_ids},
            **soc_q,
            "imported_to_season": {"$ne": current_season},  # salta già importati
        },
        {"$set": set_doc},
    )
    return {"matched": res.matched_count, "modified": res.modified_count, "value": body.value}


@router.post("/seasons/users/{user_id}/renew-toggle")
async def renew_user_toggle(
    user_id: str,
    body: Optional[RenewToggleBody] = None,
    current_user = Depends(get_current_user),
):
    """🆕 01/07/2026 — Riconferma toggle per Coach/Collaboratore/Dirigente.
    Stessa semantica di /seasons/athletes/{id}/renew-toggle."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    u = await db.users.find_one({
        "id": user_id,
        "role": {"$in": _user_roles_in_scope()},
        **_society_filter(current_user),
    })
    if not u:
        raise HTTPException(status_code=404, detail="Coach/Collaboratore/Dirigente non trovato in questa società")
    current_season = await get_current_season_for_society(db, current_user.get("society_id"))
    if u.get("imported_to_season") == current_season:
        raise HTTPException(status_code=409, detail="Già importato nella stagione corrente — non modificabile.")
    new_value = (not bool(u.get("renewed_for_next_season"))) if (body is None or body.value is None) else bool(body.value)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "renewed_for_next_season": new_value,
            "renewed_at": datetime.utcnow().isoformat() if new_value else None,
            "renewed_by": current_user["id"] if new_value else None,
        }}
    )
    return {"user_id": user_id, "renewed_for_next_season": new_value}


@router.post("/seasons/users/bulk-renew")
async def renew_users_bulk(body: BulkRenewUsersBody, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    current_season = await get_current_season_for_society(db, current_user.get("society_id"))
    soc_q = _society_filter(current_user)
    set_doc = {
        "renewed_for_next_season": bool(body.value),
        "renewed_at": datetime.utcnow().isoformat() if body.value else None,
        "renewed_by": current_user["id"] if body.value else None,
    }
    res = await db.users.update_many(
        {
            "id": {"$in": body.user_ids},
            "role": {"$in": _user_roles_in_scope()},
            **soc_q,
            "imported_to_season": {"$ne": current_season},
        },
        {"$set": set_doc},
    )
    return {"matched": res.matched_count, "modified": res.modified_count, "value": body.value}


@router.post("/seasons/users/{user_id}/confirm-pro-data")
async def confirm_user_pro_data(user_id: str, current_user = Depends(get_current_user)):
    """Conferma dati compenso Coach/Collab/Dir dopo revisione col nuovo contratto."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    res = await db.users.update_one(
        {"id": user_id, "role": {"$in": _user_roles_in_scope()}, **_society_filter(current_user)},
        {"$set": {
            "pro_data_pending_review": False,
            "pro_data_confirmed_at": datetime.utcnow().isoformat(),
            "pro_data_confirmed_by": current_user["id"],
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato in questa società")
    return {"user_id": user_id, "pro_data_pending_review": False}


@router.get("/seasons/import-renewed/preview")
async def preview_import_renewed(current_user = Depends(get_current_user)):
    """🆕 01/07/2026 — Anteprima: quanti riconfermati e quanti non-riconfermati
    verrebbero processati se lanciassimo l'import ORA."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    current_season = await get_current_season_for_society(db, current_user.get("society_id"))
    soc_q = _society_filter(current_user)
    # Atleti
    to_import_athletes = await db.athletes.count_documents({
        **soc_q,
        "renewed_for_next_season": True,
        "imported_to_season": {"$ne": current_season},
        "is_withdrawn": {"$ne": True},
    })
    to_inactivate_athletes = await db.athletes.count_documents({
        **soc_q,
        "$or": [
            {"renewed_for_next_season": {"$exists": False}},
            {"renewed_for_next_season": False},
            {"renewed_for_next_season": None},
        ],
        "imported_to_season": {"$ne": current_season},
        "status": {"$nin": ["inactive", "withdrawn"]},
        "is_withdrawn": {"$ne": True},
    })
    # 🆕 01/07/2026 — Coach / Collaboratore / Dirigente
    to_import_users = await db.users.count_documents({
        **soc_q,
        "role": {"$in": _user_roles_in_scope()},
        "renewed_for_next_season": True,
        "imported_to_season": {"$ne": current_season},
    })
    to_inactivate_users = await db.users.count_documents({
        **soc_q,
        "role": {"$in": _user_roles_in_scope()},
        "$or": [
            {"renewed_for_next_season": {"$exists": False}},
            {"renewed_for_next_season": False},
            {"renewed_for_next_season": None},
        ],
        "imported_to_season": {"$ne": current_season},
        "status": {"$nin": ["inactive", "withdrawn"]},
    })
    return {
        "season": current_season,
        "to_import": to_import_athletes + to_import_users,
        "to_inactivate": to_inactivate_athletes + to_inactivate_users,
        "athletes": {"to_import": to_import_athletes, "to_inactivate": to_inactivate_athletes},
        "users": {"to_import": to_import_users, "to_inactivate": to_inactivate_users},
    }


@router.post("/seasons/import-renewed")
async def import_renewed_athletes(current_user = Depends(get_current_user)):
    """🆕 01/07/2026 — Esegue l'import nella stagione corrente:
    - Atleti `renewed_for_next_season=True` → segnati come `imported_to_season=<stagione_corrente>`,
      mantengono lo status, e `renewed_for_next_season` viene azzerato (verranno mostrati grigi nell'UI).
      • Certificato medico: NON toccato (resta valido + convalidato).
      • Atleti PRO (is_compensated=True): `monthly_compensation` e `other_annual_compensation`
        restano come default della vecchia stagione, MA viene settato `pro_data_pending_review=True`
        per ricordare all'admin che devono essere riconfermati o modificati col nuovo contratto/
        lettera d'incarico (nel frattempo l'atleta può aver percepito altri compensi sportivi).
    - Atleti non riconfermati → `status='inactive'` (recuperabili al volo). NON marcati withdrawn.
    Idempotente: gli atleti già `imported_to_season=<corrente>` vengono saltati."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    current_season = await get_current_season_for_society(db, current_user.get("society_id"))
    soc_q = _society_filter(current_user)
    now_iso = datetime.utcnow().isoformat()

    # Step 1: Import atleti NON compensati (semplice)
    imp_non_pro = await db.athletes.update_many(
        {
            **soc_q,
            "renewed_for_next_season": True,
            "imported_to_season": {"$ne": current_season},
            "$or": [{"is_compensated": {"$exists": False}}, {"is_compensated": False}, {"is_compensated": None}],
        },
        {"$set": {
            "imported_to_season": current_season,
            "imported_at": now_iso,
            "imported_by": current_user["id"],
            "renewed_for_next_season": False,
        }},
    )

    # Step 2: Import atleti PRO (compenso/pregresso vanno riconfermati)
    pro_to_import = await db.athletes.find(
        {
            **soc_q,
            "renewed_for_next_season": True,
            "imported_to_season": {"$ne": current_season},
            "is_compensated": True,
        },
        {"_id": 0, "id": 1, "monthly_compensation": 1, "other_annual_compensation": 1}
    ).to_list(2000)
    pro_imported = 0
    for ath in pro_to_import:
        await db.athletes.update_one(
            {"id": ath["id"]},
            {"$set": {
                "imported_to_season": current_season,
                "imported_at": now_iso,
                "imported_by": current_user["id"],
                "renewed_for_next_season": False,
                # Snapshot vecchia stagione (per storico)
                "monthly_compensation_previous_season": ath.get("monthly_compensation", 0),
                "other_annual_compensation_previous_season": ath.get("other_annual_compensation", 0),
                # Flag "da riconfermare con nuovo contratto/lettera d'incarico"
                "pro_data_pending_review": True,
                "pro_data_pending_review_season": current_season,
            }},
        )
        pro_imported += 1

    # Step 3: Atleti non riconfermati → inactive
    inact_res = await db.athletes.update_many(
        {
            **soc_q,
            "$or": [
                {"renewed_for_next_season": {"$exists": False}},
                {"renewed_for_next_season": False},
                {"renewed_for_next_season": None},
            ],
            "imported_to_season": {"$ne": current_season},
            "status": {"$nin": ["inactive", "withdrawn"]},
            "is_withdrawn": {"$ne": True},
        },
        {"$set": {"status": "inactive", "inactivated_at": now_iso, "inactivated_reason": f"Non riconfermato per stagione {current_season}"}},
    )

    # 🆕 01/07/2026 — Step 4: Import Coach/Collaboratore/Dirigente/Viewer
    # Utenti compensati (monthly_compensation > 0) → segnati pro_data_pending_review
    # Utenti non compensati → import semplice.
    users_to_import = await db.users.find(
        {
            **soc_q,
            "role": {"$in": _user_roles_in_scope()},
            "renewed_for_next_season": True,
            "imported_to_season": {"$ne": current_season},
        },
        {"_id": 0, "id": 1, "monthly_compensation": 1, "other_annual_compensation": 1}
    ).to_list(2000)
    users_imported_simple = 0
    users_imported_pro = 0
    for u in users_to_import:
        mc = u.get("monthly_compensation") or 0
        oac = u.get("other_annual_compensation") or 0
        is_pro = (mc and mc > 0) or (oac and oac > 0)
        set_doc = {
            "imported_to_season": current_season,
            "imported_at": now_iso,
            "imported_by": current_user["id"],
            "renewed_for_next_season": False,
        }
        if is_pro:
            set_doc.update({
                "monthly_compensation_previous_season": mc,
                "other_annual_compensation_previous_season": oac,
                "pro_data_pending_review": True,
                "pro_data_pending_review_season": current_season,
            })
            users_imported_pro += 1
        else:
            users_imported_simple += 1
        await db.users.update_one({"id": u["id"]}, {"$set": set_doc})

    # Step 5: Utenti non riconfermati → status='inactive'
    users_inact_res = await db.users.update_many(
        {
            **soc_q,
            "role": {"$in": _user_roles_in_scope()},
            "$or": [
                {"renewed_for_next_season": {"$exists": False}},
                {"renewed_for_next_season": False},
                {"renewed_for_next_season": None},
            ],
            "imported_to_season": {"$ne": current_season},
            "status": {"$nin": ["inactive", "withdrawn", "rejected"]},
        },
        {"$set": {"status": "inactive", "inactivated_at": now_iso, "inactivated_reason": f"Non riconfermato per stagione {current_season}"}},
    )

    return {
        "season": current_season,
        "imported": imp_non_pro.modified_count + pro_imported + users_imported_simple + users_imported_pro,
        "imported_pro_pending_review": pro_imported + users_imported_pro,
        "inactivated": inact_res.modified_count + users_inact_res.modified_count,
        "athletes": {
            "imported": imp_non_pro.modified_count + pro_imported,
            "imported_pro_pending_review": pro_imported,
            "inactivated": inact_res.modified_count,
        },
        "users": {
            "imported": users_imported_simple + users_imported_pro,
            "imported_pro_pending_review": users_imported_pro,
            "inactivated": users_inact_res.modified_count,
        },
    }


@router.post("/seasons/athletes/{athlete_id}/confirm-pro-data")
async def confirm_pro_data_after_review(athlete_id: str, current_user = Depends(get_current_user)):
    """🆕 01/07/2026 — Dopo che l'admin ha aggiornato manualmente
    monthly_compensation e/o other_annual_compensation a seguito del nuovo
    contratto/lettera d'incarico, conferma azzerando `pro_data_pending_review`."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    res = await db.athletes.update_one(
        {"id": athlete_id, **_society_filter(current_user)},
        {"$set": {
            "pro_data_pending_review": False,
            "pro_data_confirmed_at": datetime.utcnow().isoformat(),
            "pro_data_confirmed_by": current_user["id"],
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Atleta non trovato in questa società")
    return {"athlete_id": athlete_id, "pro_data_pending_review": False}
