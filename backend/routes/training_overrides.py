"""
Training override routes — manual cancellations/modifications of recurring trainings
for a specific date. Used by Admin and Coach roles.

Override semantics:
  - status="cancelled": training for that date is removed from the parent dashboard
  - status="modified": training for that date uses new_start_time / new_end_time /
    new_venue (any non-null) and shows the `reason` text to parents.

Endpoints:
  POST   /teams/{team_id}/training-overrides         (admin|coach)
  GET    /teams/{team_id}/training-overrides         (admin|coach|parent)
  PATCH  /training-overrides/{id}                    (admin|coach)
  DELETE /training-overrides/{id}                    (admin|coach)  -> restores normal training
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth_utils import get_current_user
from models.enums import UserRole

router = APIRouter()


class TrainingOverrideCreate(BaseModel):
    date: str  # YYYY-MM-DD
    status: str  # "cancelled" | "modified"
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None
    new_venue: Optional[str] = None
    reason: Optional[str] = None


class TrainingOverrideUpdate(BaseModel):
    status: Optional[str] = None
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None
    new_venue: Optional[str] = None
    reason: Optional[str] = None


def _check_team_access(current_user: dict, team: dict) -> None:
    """Allow Admin of the society OR Coach assigned to the team."""
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    if current_user.get("society_id") and team.get("society_id") and \
            current_user["society_id"] != team["society_id"]:
        raise HTTPException(status_code=403, detail="Squadra di altra società")
    role = current_user["role"]
    if role == UserRole.ADMIN:
        return
    if role == UserRole.COACH:
        coach_ids = team.get("coach_ids") or []
        if current_user["id"] in coach_ids:
            return
    raise HTTPException(status_code=403, detail="Solo Admin o Coach della squadra possono gestire gli allenamenti")


@router.post("/teams/{team_id}/training-overrides")
async def create_training_override(team_id: str, data: TrainingOverrideCreate, current_user = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    _check_team_access(current_user, team)
    if data.status not in ("cancelled", "modified"):
        raise HTTPException(status_code=400, detail="Status non valido (cancelled | modified)")
    try:
        datetime.strptime(data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data non valido (YYYY-MM-DD)")
    
    # Upsert by (team_id, date): one override per training-day max
    existing = await db.training_overrides.find_one({"team_id": team_id, "date": data.date})
    payload = {
        "team_id": team_id,
        "society_id": team.get("society_id"),
        "date": data.date,
        "status": data.status,
        "new_start_time": data.new_start_time,
        "new_end_time": data.new_end_time,
        "new_venue": data.new_venue,
        "reason": data.reason,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user["id"],
    }
    if existing:
        await db.training_overrides.update_one({"id": existing["id"]}, {"$set": payload})
        ov_id = existing["id"]
    else:
        ov_id = uuid.uuid4().hex[:24]
        payload["id"] = ov_id
        payload["created_at"] = datetime.now(timezone.utc)
        payload["created_by"] = current_user["id"]
        await db.training_overrides.insert_one(payload)
    payload["id"] = ov_id
    payload.pop("_id", None)
    return payload


@router.get("/teams/{team_id}/training-overrides")
async def list_training_overrides(team_id: str, current_user = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    if current_user.get("society_id") and team.get("society_id") and \
            current_user["society_id"] != team["society_id"]:
        raise HTTPException(status_code=403, detail="Squadra di altra società")
    # Admin, coach, parent and athlete all can read (read-only)
    cursor = db.training_overrides.find({"team_id": team_id}, {"_id": 0}).sort("date", 1)
    items: List[dict] = []
    async for ov in cursor:
        items.append(ov)
    return items


@router.patch("/training-overrides/{ov_id}")
async def update_training_override(ov_id: str, data: TrainingOverrideUpdate, current_user = Depends(get_current_user)):
    ov = await db.training_overrides.find_one({"id": ov_id})
    if not ov:
        raise HTTPException(status_code=404, detail="Override non trovato")
    team = await db.teams.find_one({"id": ov["team_id"]})
    _check_team_access(current_user, team)
    update_dict = {k: v for k, v in data.dict().items() if v is not None}
    if "status" in update_dict and update_dict["status"] not in ("cancelled", "modified"):
        raise HTTPException(status_code=400, detail="Status non valido (cancelled | modified)")
    update_dict["updated_at"] = datetime.now(timezone.utc)
    update_dict["updated_by"] = current_user["id"]
    await db.training_overrides.update_one({"id": ov_id}, {"$set": update_dict})
    return {"message": "Override aggiornato"}


@router.delete("/training-overrides/{ov_id}")
async def delete_training_override(ov_id: str, current_user = Depends(get_current_user)):
    ov = await db.training_overrides.find_one({"id": ov_id})
    if not ov:
        raise HTTPException(status_code=404, detail="Override non trovato")
    team = await db.teams.find_one({"id": ov["team_id"]})
    _check_team_access(current_user, team)
    await db.training_overrides.delete_one({"id": ov_id})
    return {"message": "Override eliminato"}
