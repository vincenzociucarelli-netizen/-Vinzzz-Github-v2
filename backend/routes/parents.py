"""
Parent-related routes:
- /parent/commitments (parent's children's trainings + matches, 7-day window)
- /parent-link/search (search athletes for parent linking)
- /parent-link/request (request to be linked as second parent)
- /parent-link/requests (list pending link requests)
- /parent-link/respond (accept/reject a parent link request)
"""
import uuid
import unicodedata
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException

from database import db
from auth_utils import get_current_user
from models.enums import UserRole

router = APIRouter()


# ==================== PARENT COMMITMENTS ====================

@router.get("/parent/commitments")
async def get_parent_commitments(current_user = Depends(get_current_user)):
    """Get commitments (trainings + matches) for parent's children — 7 days."""
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo genitori possono vedere gli impegni")
    
    athletes = await db.athletes.find({
        "$or": [
            {"parent_id": current_user["id"]},
            {"second_parent_id": current_user["id"]}
        ]
    }).to_list(20)
    
    team_athletes = {}
    for a in athletes:
        athlete_name = a.get("first_name", a.get("full_name", "").split()[0] if a.get("full_name") else "")
        # Includi sia la squadra principale (team_id) sia eventuale squadra secondaria (team_id_2)
        for team_id in (a.get("team_id"), a.get("team_id_2")):
            if team_id:
                if team_id not in team_athletes:
                    team_athletes[team_id] = []
                if athlete_name not in team_athletes[team_id]:
                    team_athletes[team_id].append(athlete_name)
    
    team_ids = list(team_athletes.keys())
    if not team_ids:
        return {"today": [], "tomorrow": [], "day_after": [], "upcoming": []}
    
    teams = await db.teams.find({"id": {"$in": team_ids}}).to_list(20)
    teams_dict = {t["id"]: t for t in teams}
    
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    end_of_week = today + timedelta(days=7)
    
    days_map = {
        0: "Lunedì", 1: "Martedì", 2: "Mercoledì",
        3: "Giovedì", 4: "Venerdì", 5: "Sabato", 6: "Domenica"
    }
    
    def get_day_name(date):
        return days_map[date.weekday()]
    
    matches = await db.matches.find({
        "team_id": {"$in": team_ids}
    }).to_list(200)
    # Filter by date in Python (some records have date as ISO string, others as datetime)
    filtered_matches = []
    for m in matches:
        d = m.get("date")
        if isinstance(d, str):
            try:
                d = datetime.fromisoformat(d.replace("Z", "").replace("+00:00", ""))
            except Exception:
                continue
        if d and today <= d < end_of_week:
            m["date"] = d  # normalize to datetime for downstream
            filtered_matches.append(m)
    matches = filtered_matches
    
    home_match_days = set()
    for match in matches:
        match_date = match.get("date")
        if isinstance(match_date, str):
            match_date = datetime.fromisoformat(match_date.replace("Z", ""))
        if match.get("home_away") == "home":
            if today <= match_date < tomorrow:
                home_match_days.add((match.get("team_id"), "today"))
            elif tomorrow <= match_date < day_after:
                home_match_days.add((match.get("team_id"), "tomorrow"))
            elif day_after <= match_date < (day_after + timedelta(days=1)):
                home_match_days.add((match.get("team_id"), "day_after"))
            else:
                home_match_days.add((match.get("team_id"), match_date.strftime("%d/%m")))
    
    result = {"today": [], "tomorrow": [], "day_after": [], "upcoming": []}
    
    for day_key, target_date in [("today", today), ("tomorrow", tomorrow), ("day_after", day_after)]:
        day_name = get_day_name(target_date)
        for team_id in team_ids:
            if (team_id, day_key) in home_match_days:
                continue
            team = teams_dict.get(team_id, {})
            team_name = team.get("name", "Squadra")
            training_sessions = team.get("training_sessions", [])
            athlete_names = team_athletes.get(team_id, [])
            athlete_names_str = ", ".join(athlete_names) if athlete_names else ""
            for session in training_sessions:
                if session.get("day") == day_name:
                    result[day_key].append({
                        "type": "training",
                        "team_id": team_id,
                        "team_name": team_name,
                        "athlete_names": athlete_names_str,
                        "time_start": session.get("timeStart", ""),
                        "time_end": session.get("timeEnd", ""),
                        "venue": session.get("venue", ""),
                        "title": f"Allenamento {team_name}"
                    })
    
    for day_offset in range(3, 7):
        target_date = today + timedelta(days=day_offset)
        day_name = get_day_name(target_date)
        date_str = target_date.strftime("%d/%m")
        for team_id in team_ids:
            if (team_id, date_str) in home_match_days:
                continue
            team = teams_dict.get(team_id, {})
            team_name = team.get("name", "Squadra")
            training_sessions = team.get("training_sessions", [])
            athlete_names = team_athletes.get(team_id, [])
            athlete_names_str = ", ".join(athlete_names) if athlete_names else ""
            for session in training_sessions:
                if session.get("day") == day_name:
                    result["upcoming"].append({
                        "type": "training",
                        "team_id": team_id,
                        "team_name": team_name,
                        "athlete_names": athlete_names_str,
                        "date": date_str,
                        "day_name": day_name,
                        "time_start": session.get("timeStart", ""),
                        "time_end": session.get("timeEnd", ""),
                        "venue": session.get("venue", ""),
                        "title": f"Allenamento {team_name}"
                    })
    
    for match in matches:
        match_date = match.get("date")
        if isinstance(match_date, str):
            match_date = datetime.fromisoformat(match_date.replace("Z", ""))
        if today <= match_date < tomorrow:
            day_key = "today"
        elif tomorrow <= match_date < day_after:
            day_key = "tomorrow"
        elif day_after <= match_date < (day_after + timedelta(days=1)):
            day_key = "day_after"
        elif match_date < end_of_week:
            day_key = "upcoming"
        else:
            continue
        
        match_team_id = match.get("team_id")
        athlete_names = team_athletes.get(match_team_id, [])
        athlete_names_str = ", ".join(athlete_names) if athlete_names else ""
        
        match_item = {
            "type": "match",
            "team_id": match_team_id,
            "team_name": match.get("team_name", ""),
            "athlete_names": athlete_names_str,
            "time": match_date.strftime("%H:%M"),
            "venue": match.get("venue", ""),
            "city": match.get("city", ""),
            "address": match.get("address", ""),
            "opponent": match.get("opponent", ""),
            "home_away": match.get("home_away", "home"),
            "meeting_time": match.get("meeting_time"),
            "notes": match.get("notes"),
            "title": f"Gara {match.get('team_name', '')} vs {match.get('opponent', '')}"
        }
        if day_key == "upcoming":
            match_item["date"] = match_date.strftime("%d/%m")
            match_item["day_name"] = get_day_name(match_date)
        
        result[day_key].append(match_item)
    
    for day_key in ["today", "tomorrow", "day_after"]:
        result[day_key].sort(key=lambda x: x.get("time_start", x.get("time", "00:00")))
    result["upcoming"].sort(key=lambda x: (x.get("date", ""), x.get("time_start", x.get("time", "00:00"))))
    
    return result


# ==================== PARENT-LINK ====================

@router.post("/parent-link/search")
async def search_athlete_for_link(data: dict, current_user = Depends(get_current_user)):
    """Search athlete by name for parent linking. Only for parents."""
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo genitori possono cercare atleti da collegare")
    
    cognome = (data.get("cognome") or "").strip()
    nome = (data.get("nome") or "").strip()
    if not cognome:
        raise HTTPException(status_code=400, detail="Cognome obbligatorio")
    
    def norm(s):
        s = str(s).strip().upper()
        s = unicodedata.normalize('NFD', s)
        return ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    
    cn = norm(cognome)
    nn = norm(nome)
    
    society_id = current_user.get("society_id")
    if not society_id:
        raise HTTPException(status_code=400, detail="Società non associata al tuo profilo. Contatta l'amministratore.")
    
    all_athletes = await db.athletes.find({
        "society_id": society_id,
        "is_withdrawn": {"$ne": True}
    }, {"_id": 0}).to_list(5000)
    
    teams = await db.teams.find({}, {"_id": 0}).to_list(100)
    team_map = {t.get("id", ""): t.get("name", "") for t in teams if t.get("id")}
    
    matches = []
    for a in all_athletes:
        athlete_id = a.get("id", "")
        if not athlete_id:
            continue
        a_ln = norm(a.get("last_name", ""))
        a_fn = norm(a.get("first_name", ""))
        ln_match = (a_ln == cn) or (cn in a_ln and len(cn) >= 3) or (a_ln in cn and len(a_ln) >= 3)
        if not ln_match:
            continue
        if nn:
            fn_match = (nn == a_fn or nn in a_fn or a_fn in nn or
                       (len(nn) >= 3 and len(a_fn) >= 3 and nn[:3] == a_fn[:3]))
            if not fn_match:
                continue
        if current_user.get("id") in [a.get("parent_id"), a.get("second_parent_id")]:
            continue
        
        dob = a.get("date_of_birth") or a.get("birth_date") or ""
        if hasattr(dob, 'strftime'):
            dob = dob.strftime("%d/%m/%Y")
        elif isinstance(dob, str) and 'T' in dob:
            try:
                dob = datetime.fromisoformat(dob.replace('Z', '+00:00')).strftime("%d/%m/%Y")
            except Exception:
                pass
        
        matches.append({
            "id": athlete_id,
            "first_name": a.get("first_name", ""),
            "last_name": a.get("last_name", ""),
            "team": team_map.get(a.get("team_id", ""), ""),
            "date_of_birth": str(dob) if dob else "",
        })
    
    return {"results": matches, "count": len(matches)}


@router.post("/parent-link/request")
async def request_parent_link(data: dict, current_user = Depends(get_current_user)):
    """Request to be linked as second parent to an athlete."""
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo genitori")
    
    athlete_id = data.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="ID atleta mancante")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    if current_user["id"] in [athlete.get("parent_id"), athlete.get("second_parent_id")]:
        raise HTTPException(status_code=400, detail="Sei già collegato a questo atleta")
    
    existing = await db.parent_link_requests.find_one({
        "requester_id": current_user["id"],
        "athlete_id": athlete_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Richiesta già inviata per questo atleta")
    
    primary_parent_id = athlete.get("parent_id")
    if not primary_parent_id:
        await db.athletes.update_one(
            {"id": athlete_id},
            {"$set": {"parent_id": current_user["id"]}}
        )
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"athlete_ids": athlete_id}}
        )
        return {"message": "Sei stato collegato come genitore principale", "direct_link": True}
    
    requester = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
    requester_name = f"{requester.get('first_name', '')} {requester.get('last_name', '')}".strip() if requester else current_user.get("full_name", "")
    requester_email = requester.get("email", "") if requester else current_user.get("email", "")
    athlete_name = f"{athlete.get('first_name', '')} {athlete.get('last_name', '')}".strip()
    
    request_id = str(uuid.uuid4())
    await db.parent_link_requests.insert_one({
        "id": request_id,
        "requester_id": current_user["id"],
        "requester_name": requester_name,
        "requester_email": requester_email,
        "athlete_id": athlete_id,
        "athlete_name": athlete_name,
        "approver_id": primary_parent_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    })
    
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": primary_parent_id,
        "type": "parent_link_request",
        "title": "Richiesta collegamento genitore",
        "message": f"{requester_name} ({requester_email}) chiede di essere collegato come genitore di {athlete_name}.",
        "data": {
            "request_id": request_id,
            "requester_name": requester_name,
            "requester_email": requester_email,
            "athlete_name": athlete_name,
            "athlete_id": athlete_id,
        },
        "read": False,
        "created_at": datetime.now(timezone.utc),
    })
    
    return {"success": True, "request_id": request_id, "message": f"Richiesta inviata al genitore di {athlete_name}"}


@router.get("/parent-link/requests")
async def get_parent_link_requests(current_user = Depends(get_current_user)):
    """Get pending parent link requests for the current user (as approver or requester)."""
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo genitori")
    
    to_approve = await db.parent_link_requests.find({
        "approver_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0}).to_list(50)
    
    my_requests = await db.parent_link_requests.find({
        "requester_id": current_user["id"],
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {"to_approve": to_approve, "my_requests": my_requests}


@router.post("/parent-link/respond")
async def respond_parent_link(data: dict, current_user = Depends(get_current_user)):
    """Accept or reject a parent link request."""
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo genitori")
    
    request_id = data.get("request_id")
    action = data.get("action")
    if not request_id or action not in ["accept", "reject"]:
        raise HTTPException(status_code=400, detail="request_id e action (accept/reject) obbligatori")
    
    link_request = await db.parent_link_requests.find_one({"id": request_id, "status": "pending"})
    if not link_request:
        raise HTTPException(status_code=404, detail="Richiesta non trovata o già gestita")
    
    if link_request["approver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Non sei autorizzato a rispondere a questa richiesta")
    
    athlete_name = link_request.get("athlete_name", "")
    requester_name = link_request.get("requester_name", "")
    requester_id = link_request["requester_id"]
    
    if action == "accept":
        athlete_id = link_request["athlete_id"]
        athlete = await db.athletes.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Atleta non trovato")
        if athlete.get("second_parent_id"):
            raise HTTPException(status_code=400, detail="Questo atleta ha già un secondo genitore collegato")
        
        requester = await db.users.find_one({"id": requester_id}, {"_id": 0, "email": 1})
        requester_email = requester.get("email", "") if requester else ""
        
        await db.athletes.update_one({"id": athlete_id}, {"$set": {
            "second_parent_id": requester_id,
            "second_parent_email": requester_email,
        }})
        
        await db.users.update_one(
            {"id": requester_id},
            {"$addToSet": {"athlete_ids": athlete_id}}
        )
        
        await db.parent_link_requests.update_one({"id": request_id}, {"$set": {
            "status": "accepted",
            "responded_at": datetime.now(timezone.utc),
        }})
        
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": requester_id,
            "type": "parent_link_accepted",
            "title": "Collegamento approvato",
            "message": f"La tua richiesta di collegamento a {athlete_name} è stata accettata. Ora puoi visualizzare il profilo dell'atleta.",
            "data": {"athlete_id": athlete_id, "athlete_name": athlete_name},
            "read": False,
            "created_at": datetime.now(timezone.utc),
        })
        
        return {"success": True, "message": f"Collegamento approvato. {requester_name} è ora collegato a {athlete_name}."}
    
    # reject
    await db.parent_link_requests.update_one({"id": request_id}, {"$set": {
        "status": "rejected",
        "responded_at": datetime.now(timezone.utc),
    }})
    
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": requester_id,
        "type": "parent_link_rejected",
        "title": "Collegamento rifiutato",
        "message": f"La tua richiesta di collegamento a {athlete_name} è stata rifiutata.",
        "data": {"athlete_name": athlete_name},
        "read": False,
        "created_at": datetime.now(timezone.utc),
    })
    
    return {"success": True, "message": "Richiesta rifiutata."}
