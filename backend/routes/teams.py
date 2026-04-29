"""
Teams routes:
- POST   /teams                              create team
- GET    /teams                              list teams (society scope)
- GET    /teams/{team_id}                    team detail (with coaches/dirigenti info)
- PATCH  /teams/{team_id}                    update team
- POST   /teams/{team_id}/assign-coaches     assign coaches
- POST   /teams/{team_id}/assign-dirigenti   assign dirigenti
- GET    /teams/{team_id}/payment-info       payment info
- GET    /teams/{team_id}/coach              first coach (legacy + all_coaches)
- GET    /teams/{team_id}/athletes-count     count athletes
- GET    /teams/{team_id}/athletes           list athletes
- GET    /teams/athletes-count/all           map team_id -> count
- DELETE /teams/{team_id}                    delete (only if empty)
"""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from database import db
from auth_utils import get_current_user
from models.enums import UserRole
from models.team_models import Team, TeamCreate, TeamUpdate, AssignmentRequest
from utils import clean_mongo_doc, clean_mongo_docs

router = APIRouter()


def _parse_date(date_str):
    """Parse date string in DD/MM/YYYY, YYYY-MM-DD, or ISO format."""
    if not date_str:
        return None
    date_str = date_str.strip()
    if '/' in date_str:
        parts = date_str.split('/')
        if len(parts) == 3:
            d, m, y = parts
            if len(y) == 2:
                y = '20' + y
            return datetime(int(y), int(m), int(d))
    if '-' in date_str:
        parts = date_str.split('-')
        if len(parts) == 3:
            a, b, c = parts
            if len(a) == 4:
                return datetime(int(a), int(b), int(c))
            elif len(a) == 2:
                return datetime(2000 + int(a), int(b), int(c))
    try:
        return datetime.fromisoformat(date_str)
    except ValueError:
        return None


@router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può creare squadre")
    
    training_sessions = team_data.training_sessions or []
    if not training_sessions and team_data.trainings:
        training_sessions = team_data.trainings
    
    team = Team(
        name=team_data.name,
        description=team_data.description,
        society_id=current_user.get("society_id"),
        created_by_admin_id=current_user["id"],
        is_prima_squadra=team_data.is_prima_squadra,
        total_amount=team_data.total_amount,
        installments=team_data.installments or [],
        installment_1_amount=team_data.installment_1_amount,
        installment_2_amount=team_data.installment_2_amount,
        installment_2_due_date=_parse_date(team_data.installment_2_due_date),
        installment_3_amount=team_data.installment_3_amount,
        installment_3_due_date=_parse_date(team_data.installment_3_due_date),
        bank_info=team_data.bank_info,
        paypal_email=team_data.paypal_email,
        venue=team_data.venue if team_data.venue else None,
        training_schedule=team_data.training_schedule if team_data.training_schedule else None,
        training_sessions=training_sessions,
        match_day=team_data.match_day if team_data.match_day else None,
        rifinitura=team_data.rifinitura if team_data.rifinitura else None,
        championships=team_data.championships if team_data.championships else None,
        calendar_link=team_data.calendar_link if team_data.calendar_link else None,
    )
    await db.teams.insert_one(team.dict())
    return team


@router.get("/teams", response_model=List[Team])
async def get_teams(current_user = Depends(get_current_user)):
    society_id = current_user.get("society_id")
    teams = await db.teams.find({"society_id": society_id}).to_list(1000)
    clean_mongo_docs(teams)
    return [Team(**team) for team in teams]


@router.get("/teams/athletes-count/all")
async def get_all_teams_athletes_count(current_user = Depends(get_current_user)):
    """Get the count of athletes for all teams - OPTIMIZED with aggregation."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere queste statistiche")
    pipeline = [{"$group": {"_id": "$team_id", "count": {"$sum": 1}}}]
    counts = await db.athletes.aggregate(pipeline).to_list(1000)
    result = {item["_id"]: item["count"] for item in counts if item["_id"]}
    teams = await db.teams.find().to_list(1000)
    for team in teams:
        if team["id"] not in result:
            result[team["id"]] = 0
    return result


@router.get("/teams/{team_id}", response_model=None)
async def get_team(team_id: str, current_user = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    clean_mongo_doc(team)
    
    coaches = await db.users.find({"role": "coach", "assigned_teams": team_id}).to_list(10)
    coach_info = []
    for coach in coaches:
        coach_info.append({
            "id": coach.get("id"),
            "full_name": coach.get("full_name", ""),
            "email": coach.get("email", ""),
            "phone": coach.get("phone", ""),
            "profile_photo": coach.get("profile_photo", ""),
            "profile_photo_artistic": coach.get("profile_photo_artistic", ""),
        })
    
    dirigenti = await db.users.find({
        "role": {"$in": ["admin", "viewer"]},
        "assigned_teams": team_id
    }).to_list(10)
    dirigenti_info = []
    for dirigente in dirigenti:
        dirigenti_info.append({
            "id": dirigente.get("id"),
            "full_name": dirigente.get("full_name", ""),
            "email": dirigente.get("email", ""),
            "phone": dirigente.get("phone", ""),
            "profile_photo": dirigente.get("profile_photo", ""),
            "profile_photo_artistic": dirigente.get("profile_photo_artistic", ""),
            "qualification": dirigente.get("qualification", ""),
            "qualifications": dirigente.get("qualifications", []),
        })
    
    team_obj = Team(**team)
    team_dict = team_obj.dict()
    team_dict["coach_info"] = coach_info
    team_dict["dirigenti_info"] = dirigenti_info
    return team_dict


@router.patch("/teams/{team_id}", response_model=Team)
async def update_team(team_id: str, team_data: TeamUpdate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare squadre")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    update_dict = {}
    nullable_fields = {'rifinitura', 'description', 'championships', 'calendar_link', 'bank_info', 'paypal_email',
                       'installment_2_due_date', 'installment_3_due_date'}
    
    for key, value in team_data.dict(exclude_unset=True).items():
        if value is None and key in nullable_fields:
            update_dict[key] = None
        elif value is not None:
            if "due_date" in key and isinstance(value, str):
                try:
                    update_dict[key] = datetime.fromisoformat(value)
                except ValueError:
                    try:
                        parts = value.split('/')
                        if len(parts) == 3:
                            update_dict[key] = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                    except Exception:
                        pass
            else:
                update_dict[key] = value
    
    if update_dict:
        await db.teams.update_one({"id": team_id}, {"$set": update_dict})
        team.update(update_dict)
    
    clean_mongo_doc(team)
    return Team(**team)


@router.post("/teams/{team_id}/assign-coaches")
async def assign_coaches_to_team(team_id: str, request: AssignmentRequest, current_user = Depends(get_current_user)):
    """Assign coaches to a team."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può assegnare coach")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    coach_ids = request.ids
    await db.users.update_many(
        {"role": "coach", "assigned_teams": team_id},
        {"$pull": {"assigned_teams": team_id}}
    )
    if coach_ids:
        await db.users.update_many(
            {"id": {"$in": coach_ids}, "role": "coach"},
            {"$addToSet": {"assigned_teams": team_id}}
        )
    return {"success": True, "message": f"Coach assegnati alla squadra {team.get('name')}"}


@router.post("/teams/{team_id}/assign-dirigenti")
async def assign_dirigenti_to_team(team_id: str, request: AssignmentRequest, current_user = Depends(get_current_user)):
    """Assign dirigenti to a team."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può assegnare dirigenti")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    dirigente_ids = request.ids
    await db.users.update_many(
        {"role": {"$in": [UserRole.ADMIN, UserRole.VIEWER]}, "assigned_teams": team_id},
        {"$pull": {"assigned_teams": team_id}}
    )
    if dirigente_ids:
        await db.users.update_many(
            {"id": {"$in": dirigente_ids}, "role": {"$in": [UserRole.ADMIN, UserRole.VIEWER]}},
            {"$addToSet": {"assigned_teams": team_id}}
        )
    return {"success": True, "message": f"Dirigenti assegnati alla squadra {team.get('name')}"}


@router.get("/teams/{team_id}/payment-info")
async def get_team_payment_info(team_id: str, current_user = Depends(get_current_user)):
    """Get payment information for a specific team."""
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    clean_mongo_doc(team)
    return {
        "total_amount": team.get("total_amount", 0),
        "installments": team.get("installments", []),
        "installment_1_amount": team.get("installment_1_amount", 0),
        "installment_2_amount": team.get("installment_2_amount", 0),
        "installment_2_due_date": team.get("installment_2_due_date"),
        "installment_3_amount": team.get("installment_3_amount", 0),
        "installment_3_due_date": team.get("installment_3_due_date"),
        "bank_info": team.get("bank_info", ""),
        "paypal_email": team.get("paypal_email", "")
    }


@router.get("/teams/{team_id}/coach")
async def get_team_coach(team_id: str, current_user = Depends(get_current_user)):
    """Get the coaches of a team."""
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    coaches = await db.users.find({"role": "coach", "assigned_teams": team_id}).to_list(10)
    if not coaches:
        raise HTTPException(status_code=404, detail="Nessun coach assegnato a questa squadra")
    
    result = []
    for coach in coaches:
        result.append({
            "id": coach.get("id"),
            "full_name": coach.get("full_name"),
            "profile_photo": coach.get("profile_photo"),
            "profile_photo_artistic": coach.get("profile_photo_artistic"),
            "phone": coach.get("phone")
        })
    return {**result[0], "all_coaches": result}


@router.get("/teams/{team_id}/athletes-count")
async def get_team_athletes_count(team_id: str, current_user = Depends(get_current_user)):
    """Get the count of athletes in a team."""
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    count = await db.athletes.count_documents({"team_id": team_id})
    return {"count": count}


@router.get("/teams/{team_id}/athletes")
async def get_team_athletes(team_id: str, current_user = Depends(get_current_user)):
    """Get all athletes in a team - admin/coach/viewer only."""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH, UserRole.VIEWER]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    athletes = await db.athletes.find({"team_id": team_id}).to_list(1000)
    result = []
    for athlete in athletes:
        result.append({
            "id": athlete["id"],
            "full_name": athlete["full_name"],
            "first_name": athlete.get("first_name"),
            "last_name": athlete.get("last_name"),
            "team_id": athlete["team_id"],
            "status": athlete.get("status", "active"),
            "medical_certificate_expiry": athlete.get("medical_certificate_expiry"),
            "is_withdrawn": athlete.get("is_withdrawn", False),
            "withdrawal_reason": athlete.get("withdrawal_reason"),
        })
    return result


@router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user = Depends(get_current_user)):
    """Delete a team (only if empty)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare squadre")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    athletes_count = await db.athletes.count_documents({"team_id": team_id})
    if athletes_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Impossibile eliminare la squadra: ci sono {athletes_count} atleti iscritti. Trasferire o eliminare gli atleti prima."
        )
    
    await db.teams.delete_one({"id": team_id})
    return {"message": "Squadra eliminata con successo"}
