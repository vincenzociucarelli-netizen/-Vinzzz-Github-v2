"""
Season archive routes (admin only).
- /seasons (list all archives)
- /seasons/current (current season summary)
- /seasons/archive (archive current season)
- /seasons/{season_name} (specific season)
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

from database import db
from auth_utils import get_current_user
from models.enums import UserRole, UserStatus
from models.season_models import SeasonArchive
from utils import clean_mongo_doc, clean_mongo_docs, get_current_season, get_current_season_for_society

router = APIRouter()


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
