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
from utils import clean_mongo_doc, clean_mongo_docs, get_current_season

router = APIRouter()


@router.get("/seasons")
async def get_seasons(current_user = Depends(get_current_user)):
    """Get all season archives (admin only)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere l'archivio")
    seasons = await db.season_archives.find({}).sort("start_date", -1).to_list(100)
    clean_mongo_docs(seasons)
    return seasons


@router.get("/seasons/current")
async def get_current_season_data(current_user = Depends(get_current_user)):
    """Get current season summary."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i dati stagione")
    
    season_name = get_current_season()
    
    teams = await db.teams.find({}).to_list(100)
    clean_mongo_docs(teams)
    
    athletes = await db.athletes.find({}).to_list(1000)
    clean_mongo_docs(athletes)
    
    coaches = await db.users.find({"role": UserRole.COACH, "status": UserStatus.APPROVED}).to_list(100)
    clean_mongo_docs(coaches)
    
    championships = await db.championships.find({"season": season_name}).to_list(100)
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
    """Archive current season and create new one (admin only)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può archiviare stagioni")
    
    current_data = await get_current_season_data(current_user)
    
    now = datetime.utcnow()
    season_name = get_current_season()
    
    year_parts = season_name.split("-")
    start_year = int(year_parts[0])
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
    
    existing = await db.season_archives.find_one({"season_name": season_name})
    if existing:
        await db.season_archives.update_one(
            {"season_name": season_name},
            {"$set": archive.dict()}
        )
    else:
        await db.season_archives.insert_one(archive.dict())
    
    return {"message": f"Stagione {season_name} archiviata con successo"}


@router.get("/seasons/{season_name}")
async def get_season_archive(season_name: str, current_user = Depends(get_current_user)):
    """Get specific season archive details."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere l'archivio")
    archive = await db.season_archives.find_one({"season_name": season_name})
    if not archive:
        raise HTTPException(status_code=404, detail="Stagione non trovata")
    clean_mongo_doc(archive)
    return archive
