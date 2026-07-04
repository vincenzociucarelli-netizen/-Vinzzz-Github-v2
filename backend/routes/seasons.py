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
from pydantic import BaseModel, Field

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


@router.get("/seasons/current-name")
async def get_current_season_name(current_user = Depends(get_current_user)):
    """🆕 01/07/2026 — Endpoint LEGGERO: restituisce solo il nome della stagione corrente.
    Usato dalle liste admin per capire quale stagione mostrare nel badge 'Riconferma',
    senza tirare giù atleti/team/coach (query pesanti)."""
    season_name = await get_current_season_for_society(db, current_user.get("society_id"))
    return {"season": season_name}


@router.get("/seasons/current")
async def get_current_season_data(current_user = Depends(get_current_user)):
    """Get current season summary — filtered by current admin's society."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i dati stagione")
    
    season_name = await get_current_season_for_society(db, current_user.get("society_id"))
    soc_q = _society_filter(current_user)
    # 🆕 02/07/2026 — Filtro clean-slate: mostra solo atleti/coach appartenenti alla stagione corrente
    active_or = [{"active_seasons": season_name}, {"active_seasons": {"$exists": False}}]

    teams = await db.teams.find(soc_q).to_list(100)
    clean_mongo_docs(teams)

    athletes = await db.athletes.find({**soc_q, "$or": active_or}).to_list(1000)
    clean_mongo_docs(athletes)

    coaches = await db.users.find({
        **soc_q, "role": UserRole.COACH, "status": UserStatus.APPROVED,
        "$or": active_or,
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


class ArchiveSeasonBody(BaseModel):
    """🆕 01/07/2026 — Permette all'admin di specificare quale stagione archiviare.
    Se None, archivia la stagione APPENA CONCLUSA (precedente alla corrente),
    che è il comportamento normale a inizio nuova stagione."""
    season_name: Optional[str] = None


@router.post("/seasons/archive")
async def archive_season(
    body: Optional[ArchiveSeasonBody] = None,
    current_user = Depends(get_current_user),
):
    """Archive a season and create new one (admin only) — society-scoped.
    🆕 01/07/2026 — Default: archivia la stagione APPENA CONCLUSA (precedente),
    non quella corrente. Un admin che clicca "Archivia" il 01/07/2026 vuole
    chiudere il libro sul 2025-2026, non su quello appena iniziato."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può archiviare stagioni")

    current_data = await get_current_season_data(current_user)

    now = datetime.utcnow()
    sid = current_user.get("society_id")
    current_season = await get_current_season_for_society(db, sid)

    # Determina quale stagione archiviare
    if body and body.season_name:
        # Esplicito: usa quella richiesta (con validazione basilare)
        season_name = body.season_name.strip()
        parts = season_name.split("-")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            raise HTTPException(status_code=400, detail="Formato stagione non valido (atteso 'YYYY-YYYY')")
    else:
        # Default: archivia la PRECEDENTE (appena conclusa)
        cur_parts = current_season.split("-")
        try:
            cur_start = int(cur_parts[0])
            season_name = f"{cur_start - 1}-{cur_start}"
        except Exception:
            season_name = current_season  # fallback conservativo

    year_parts = season_name.split("-")
    start_year = int(year_parts[0])
    # Date inizio/fine dalla configurazione società
    settings_doc = await db.settings.find_one({"type": "society", "society_id": sid}) if sid else None
    if not settings_doc:
        settings_doc = await db.settings.find_one({"type": "society"})
    start_month = int((settings_doc or {}).get("season_start_month", 7) or 7)
    start_day = int((settings_doc or {}).get("season_start_day", 1) or 1)
    try:
        start_date = datetime(start_year, start_month, start_day)
        next_start = datetime(start_year + 1, start_month, start_day)
        end_date = datetime.fromtimestamp(next_start.timestamp() - 86400)
    except Exception:
        start_date = datetime(start_year, 7, 1)
        end_date = datetime(start_year + 1, 6, 30)

    # 🆕 02/07/2026 — Conteggi separati per ruolo/età al momento dell'archiviazione.
    # Filtriamo per `active_seasons` contenente la stagione da archiviare così l'archivio
    # rappresenta chi era EFFETTIVAMENTE in quella stagione (non chi è stato ricaricato dopo).
    # 🆕 03/07/2026 — FALLBACK: se nessuno ha `active_seasons: season_name` (migrazione
    # mancante), archivia il CENSIMENTO ATTUALE della società (tutti gli users/athletes).
    soc_q = _society_filter(current_user)
    season_scope = {"active_seasons": season_name}

    # Atleti: split 18-/18+ usando date_of_birth alla data di start della stagione archiviata
    athletes_docs = await db.athletes.find(
        {**soc_q, **season_scope},
        {"_id": 0, "id": 1, "date_of_birth": 1},
    ).to_list(5000)
    if not athletes_docs:
        athletes_docs = await db.athletes.find(
            soc_q,
            {"_id": 0, "id": 1, "date_of_birth": 1},
        ).to_list(5000)
    total_minor = 0
    total_adult = 0
    for a in athletes_docs:
        bd = a.get("date_of_birth")
        is_minor = False
        if bd:
            try:
                bd_dt = datetime.fromisoformat(bd) if isinstance(bd, str) else bd
                age_years = (start_date - bd_dt).days / 365.25
                is_minor = age_years < 18
            except Exception:
                is_minor = False
        if is_minor:
            total_minor += 1
        else:
            total_adult += 1

    # Staff: conteggio Coach, Collaboratori, Dirigenti (Viewer aggregato con Dirigenti)
    async def _count_users(roles: list) -> int:
        q_scoped = {**soc_q, **season_scope, "role": {"$in": roles} if isinstance(roles, list) else roles}
        n = await db.users.count_documents(q_scoped)
        if n == 0:
            # fallback: conta tutti gli utenti della società con quel ruolo
            q_all = {**soc_q, "role": {"$in": roles} if isinstance(roles, list) else roles}
            n = await db.users.count_documents(q_all)
        return n

    total_coaches_count = await _count_users([UserRole.COACH])
    total_collab_count = await _count_users([UserRole.COLLABORATORE])
    total_dir_count = await _count_users([UserRole.DIRIGENTE, UserRole.VIEWER])

    archive = SeasonArchive(
        season_name=season_name,
        start_date=start_date,
        end_date=end_date,
        is_current=False,
        teams=current_data["teams"],
        coaches=[{"name": c} for c in set(
            name for t in current_data["teams"] for name in t.get("coach_names", [])
        )],
        total_athletes=len(athletes_docs),
        total_athletes_minor=total_minor,
        total_athletes_adult=total_adult,
        total_teams=current_data["total_teams"],
        total_coaches=total_coaches_count,
        total_collaboratori=total_collab_count,
        total_dirigenti=total_dir_count,
        archived_at=now,
        archived_by=current_user["id"]
    )
    archive_doc = archive.dict()
    archive_doc["society_id"] = sid

    existing = await db.season_archives.find_one({"season_name": season_name, "society_id": sid})
    if existing:
        await db.season_archives.update_one(
            {"season_name": season_name, "society_id": sid},
            {"$set": archive_doc}
        )
    else:
        await db.season_archives.insert_one(archive_doc)

    return {"message": f"Stagione {season_name} archiviata con successo", "season_name": season_name}


@router.delete("/seasons/{season_name}")
async def delete_season_archive(season_name: str, current_user = Depends(get_current_user)):
    """🆕 01/07/2026 — Rimuove un archivio di stagione (utile per correggere archivi
    creati per errore con il nome sbagliato). Solo la stessa società.
    NOTA: rimuove solo lo snapshot in `season_archives`, NON i dati operativi."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    res = await db.season_archives.delete_one({"season_name": season_name, "society_id": sid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Archivio {season_name} non trovato per questa società")
    return {"message": f"Archivio {season_name} eliminato", "season_name": season_name}


# 🆕 03/07/2026 — Diagnostica active_seasons
@router.get("/seasons/diagnose")
async def diagnose_active_seasons(current_user = Depends(get_current_user)):
    """Diagnostica: mostra come sono distribuiti i valori di `active_seasons` fra
    atleti, users (per ruolo) e teams della società. Utile per capire perché le
    liste operative o gli archivi possono apparire vuoti."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    current_season = await get_current_season_for_society(db, sid)

    def _key(as_val):
        if as_val is None:
            return "MISSING"
        if not isinstance(as_val, list):
            return f"NOT_LIST({type(as_val).__name__})"
        if len(as_val) == 0:
            return "EMPTY_LIST"
        return "|".join(sorted(str(x) for x in as_val))

    async def _scan(coll, extra=None):
        q = {"society_id": sid}
        if extra:
            q.update(extra)
        buckets: dict[str, int] = {}
        total = 0
        async for d in coll.find(q, {"_id": 0, "active_seasons": 1}):
            total += 1
            k = _key(d.get("active_seasons"))
            buckets[k] = buckets.get(k, 0) + 1
        return {"total": total, "by_active_seasons": buckets}

    out = {
        "society_id": sid,
        "current_season": current_season,
        "athletes": await _scan(db.athletes),
        "teams": await _scan(db.teams),
        "users_by_role": {
            "admin": await _scan(db.users, {"role": UserRole.ADMIN}),
            "coach": await _scan(db.users, {"role": UserRole.COACH}),
            "collaboratore": await _scan(db.users, {"role": UserRole.COLLABORATORE}),
            "dirigente": await _scan(db.users, {"role": UserRole.DIRIGENTE}),
            "viewer": await _scan(db.users, {"role": UserRole.VIEWER}),
            "genitore": await _scan(db.users, {"role": UserRole.PARENT}),
            "athlete_user": await _scan(db.users, {"role": UserRole.ATHLETE}),
        },
    }
    return out


# ==================== 🆕 01/07/2026 — Riconferma da archivio ====================

class ReconfirmBulkBody(BaseModel):
    """Payload per la riconferma multipla da vista archivio verso la stagione corrente."""
    athlete_ids: List[str] = Field(default_factory=list)
    user_ids: List[str] = Field(default_factory=list)
    team_ids: List[str] = Field(default_factory=list)  # 🆕 04/07/2026


@router.get("/seasons/{season_name}/members")
async def list_season_members(
    season_name: str,
    type: str = "athletes",
    current_user = Depends(get_current_user),
):
    """Elenca i membri (atleti o utenti staff) attivi nella stagione data.
    Filtro: `active_seasons` contiene `season_name`. Include un flag `already_in_current`
    così il frontend sa se un elemento è già stato riconfermato per la stagione corrente."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    current_season = await get_current_season_for_society(db, sid)

    # 🆕 04/07/2026 — Cartella Squadre nella riconferma bulk
    if type == "teams":
        docs = await db.teams.find(
            {"society_id": sid, "active_seasons": season_name},
            {"_id": 0, "id": 1, "name": 1, "category": 1, "active_seasons": 1},
        ).sort("name", 1).to_list(500)
        fallback_used = False
        if not docs:
            fallback_used = True
            docs = await db.teams.find(
                {"society_id": sid},
                {"_id": 0, "id": 1, "name": 1, "category": 1, "active_seasons": 1, "is_current": 1},
            ).sort("name", 1).to_list(500)
        for d in docs:
            d["already_in_current"] = current_season in (d.get("active_seasons") or [])
            d["full_name"] = d.get("name")  # per compatibilità con il rendering client
        return {"season": season_name, "current_season": current_season, "type": type, "members": docs, "fallback_used": fallback_used}

    if type == "athletes":
        docs = await db.athletes.find(
            {"society_id": sid, "active_seasons": season_name},
            {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "full_name": 1,
             "team_id": 1, "athlete_type": 1, "monthly_compensation": 1,
             "other_annual_compensation": 1, "active_seasons": 1, "email": 1,
             "date_of_birth": 1},
        ).sort([("last_name", 1), ("first_name", 1)]).to_list(5000)
        # 🆕 03/07/2026 — FALLBACK: se il campo `active_seasons` è vuoto/inconsistente
        # (migrazione mancante o pre-Clean-Slate), mostriamo TUTTI gli atleti della società
        # che NON sono già nella stagione corrente. Così l'admin può comunque riconfermarli.
        fallback_used = False
        if not docs:
            fallback_used = True
            docs = await db.athletes.find(
                {"society_id": sid},
                {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "full_name": 1,
                 "team_id": 1, "athlete_type": 1, "monthly_compensation": 1,
                 "other_annual_compensation": 1, "active_seasons": 1, "email": 1,
                 "date_of_birth": 1, "status": 1},
            ).sort([("last_name", 1), ("first_name", 1)]).to_list(5000)
            # Non escludiamo nulla qui: `already_in_current` verrà settato sotto e
            # gli elementi già in stagione corrente appariranno disabilitati nella UI.
        # Team names
        team_ids = list({d.get("team_id") for d in docs if d.get("team_id")})
        teams = await db.teams.find({"id": {"$in": team_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
        team_name = {t["id"]: t["name"] for t in teams}
        # 🆕 02/07/2026 - calcolo is_minor riferito alla data di start della stagione archiviata
        try:
            arch_start_year = int(season_name.split("-")[0])
            arch_start_ref = datetime(arch_start_year, 9, 1)
        except Exception:
            arch_start_ref = datetime.utcnow()
        for d in docs:
            d["team_name"] = team_name.get(d.get("team_id"), "—")
            d["already_in_current"] = current_season in (d.get("active_seasons") or [])
            bd = d.get("date_of_birth")
            is_minor = False
            if bd:
                try:
                    bd_dt = datetime.fromisoformat(bd) if isinstance(bd, str) else bd
                    age_years = (arch_start_ref - bd_dt).days / 365.25
                    is_minor = age_years < 18
                except Exception:
                    is_minor = False
            d["is_minor"] = is_minor
        return {"season": season_name, "current_season": current_season, "type": type, "members": docs, "fallback_used": fallback_used}
    else:
        # coach | collaboratore | dirigente | viewer
        role_map = {
            "coach": [UserRole.COACH],
            "collaboratore": [UserRole.COLLABORATORE],
            "dirigente": [UserRole.DIRIGENTE, UserRole.VIEWER],
        }
        roles = role_map.get(type)
        if not roles:
            raise HTTPException(status_code=400, detail="type non valido (athletes|coach|collaboratore|dirigente)")
        docs = await db.users.find(
            {"society_id": sid, "role": {"$in": roles}, "active_seasons": season_name},
            {"_id": 0, "id": 1, "email": 1, "full_name": 1, "role": 1,
             "assigned_teams": 1, "monthly_compensation": 1,
             "other_annual_compensation": 1, "active_seasons": 1,
             "qualification": 1, "linked_athlete_id": 1},
        ).sort("full_name", 1).to_list(5000)
        # 🆕 03/07/2026 — FALLBACK come sopra per Coach/Collab/Dirigenti.
        fallback_used = False
        if not docs:
            fallback_used = True
            docs = await db.users.find(
                {"society_id": sid, "role": {"$in": roles}},
                {"_id": 0, "id": 1, "email": 1, "full_name": 1, "role": 1,
                 "assigned_teams": 1, "monthly_compensation": 1,
                 "other_annual_compensation": 1, "active_seasons": 1,
                 "qualification": 1, "linked_athlete_id": 1, "status": 1},
            ).sort("full_name", 1).to_list(5000)
        # Team names
        all_team_ids = set()
        for d in docs:
            for tid in (d.get("assigned_teams") or []):
                all_team_ids.add(tid)
        teams = await db.teams.find({"id": {"$in": list(all_team_ids)}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
        team_name = {t["id"]: t["name"] for t in teams}
        for d in docs:
            d["assigned_team_names"] = [team_name.get(tid, "—") for tid in (d.get("assigned_teams") or [])]
            d["already_in_current"] = current_season in (d.get("active_seasons") or [])
        return {"season": season_name, "current_season": current_season, "type": type, "members": docs, "fallback_used": fallback_used}


@router.post("/seasons/reconfirm-bulk")
async def reconfirm_bulk(
    body: ReconfirmBulkBody,
    current_user = Depends(get_current_user),
):
    """Riconferma multipla: aggiunge la stagione corrente a `active_seasons` degli id
    passati. Per gli utenti con compenso, valorizza anche `pro_data_pending_review` +
    snapshot precedente, così l'admin ricorda di aggiornare il contratto/lettera d'incarico."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    current_season = await get_current_season_for_society(db, sid)

    # Athletes
    ath_confirmed = 0
    ath_pro_flagged = 0
    parents_confirmed = 0  # 🆕 02/07/2026 — Auto-riconferma genitori di atleti minorenni
    parent_ids_seen: set = set()
    if body.athlete_ids:
        # Prima leggi per gestire lo snapshot compenso solo per PRO/compensated
        cursor = db.athletes.find(
            {"id": {"$in": body.athlete_ids}, "society_id": sid},
            {"_id": 0, "id": 1, "athlete_type": 1, "monthly_compensation": 1,
             "other_annual_compensation": 1, "active_seasons": 1,
             "parent_id": 1, "birth_date": 1,
             "team_id": 1, "status": 1},
        )
        # Calcolo maggiore/minore età alla data di start della stagione corrente
        try:
            cur_start_year = int(current_season.split("-")[0])
            season_start_ref = datetime(cur_start_year, 9, 1)
        except Exception:
            season_start_ref = datetime.utcnow()
        async for a in cursor:
            if current_season in (a.get("active_seasons") or []):
                continue  # già riconfermato → skip idempotente
            # 🆕 04/07/2026 — Snapshot precedente + reset team + status "pending"
            update: dict = {
                "$addToSet": {"active_seasons": current_season},
                "$set": {
                    "status": "pending",  # In attesa (admin riassegnerà squadra/palestra)
                    "team_id_previous_season": a.get("team_id"),
                    "status_previous_season": a.get("status"),
                    "privacy_pending_renewal": True,  # atleta rifirmerà privacy
                    "privacy_pending_renewal_season": current_season,
                },
                "$unset": {"team_id": ""},
            }
            is_pro = a.get("athlete_type") == "compensated" or (a.get("monthly_compensation") or 0) > 0 or (a.get("other_annual_compensation") or 0) > 0
            if is_pro:
                update["$set"].update({
                    "pro_data_pending_review": True,
                    "pro_data_pending_review_season": current_season,
                    "monthly_compensation_previous_season": a.get("monthly_compensation") or 0,
                    "other_annual_compensation_previous_season": a.get("other_annual_compensation") or 0,
                })
                ath_pro_flagged += 1
            await db.athletes.update_one({"id": a["id"], "society_id": sid}, update)
            ath_confirmed += 1

            # 🆕 02/07/2026 — Auto-riconferma parent se atleta è minorenne
            parent_id = a.get("parent_id")
            bd = a.get("birth_date")
            is_minor = False
            if bd:
                try:
                    bd_dt = datetime.fromisoformat(bd) if isinstance(bd, str) else bd
                    age_years = (season_start_ref - bd_dt).days / 365.25
                    is_minor = age_years < 18
                except Exception:
                    is_minor = False
            if parent_id and is_minor and parent_id not in parent_ids_seen:
                parent_ids_seen.add(parent_id)
                p_res = await db.users.update_one(
                    {"id": parent_id, "society_id": sid, "role": "parent"},
                    {
                        "$addToSet": {"active_seasons": current_season},
                        "$set": {
                            "privacy_pending_renewal": True,
                            "privacy_pending_renewal_season": current_season,
                        },
                    },
                )
                if p_res.modified_count:
                    parents_confirmed += 1

    # Users
    usr_confirmed = 0
    usr_pro_flagged = 0
    if body.user_ids:
        cursor = db.users.find(
            {"id": {"$in": body.user_ids}, "society_id": sid},
            {"_id": 0, "id": 1, "role": 1, "monthly_compensation": 1,
             "other_annual_compensation": 1, "active_seasons": 1,
             "assigned_teams": 1, "assigned_gyms": 1},
        )
        async for u in cursor:
            if current_season in (u.get("active_seasons") or []):
                continue
            # 🆕 04/07/2026 — Snapshot precedente + reset assegnazioni (admin riassegnerà)
            update: dict = {
                "$addToSet": {"active_seasons": current_season},
                "$set": {
                    "assigned_teams_previous_season": u.get("assigned_teams") or [],
                    "assigned_gyms_previous_season": u.get("assigned_gyms") or [],
                    "assignment_pending_review": True,
                    "assignment_pending_review_season": current_season,
                    "assigned_teams": [],
                    "assigned_gyms": [],
                },
            }
            is_pro = (u.get("monthly_compensation") or 0) > 0 or (u.get("other_annual_compensation") or 0) > 0
            if is_pro:
                update["$set"].update({
                    "pro_data_pending_review": True,
                    "pro_data_pending_review_season": current_season,
                    "monthly_compensation_previous_season": u.get("monthly_compensation") or 0,
                    "other_annual_compensation_previous_season": u.get("other_annual_compensation") or 0,
                })
                usr_pro_flagged += 1
            await db.users.update_one({"id": u["id"], "society_id": sid}, update)
            usr_confirmed += 1

    # Teams — 🆕 04/07/2026
    teams_confirmed = 0
    if body.team_ids:
        cursor = db.teams.find(
            {"id": {"$in": body.team_ids}, "society_id": sid},
            {"_id": 0, "id": 1, "active_seasons": 1},
        )
        async for t in cursor:
            if current_season in (t.get("active_seasons") or []):
                continue
            await db.teams.update_one(
                {"id": t["id"], "society_id": sid},
                {"$addToSet": {"active_seasons": current_season}},
            )
            teams_confirmed += 1

    return {
        "current_season": current_season,
        "athletes": {"confirmed": ath_confirmed, "pro_flagged": ath_pro_flagged},
        "users": {"confirmed": usr_confirmed, "pro_flagged": usr_pro_flagged},
        "parents": {"auto_confirmed": parents_confirmed},
        "teams": {"confirmed": teams_confirmed},
    }


# 🆕 04/07/2026 — Endpoint per richiedere all'atleta (o al genitore se minore)
# di rifirmare privacy + accettare periodo di prova (post riconferma bulk)
@router.post("/seasons/athletes/{athlete_id}/request-renewal")
async def request_athlete_renewal(athlete_id: str, current_user = Depends(get_current_user)):
    """Admin ha assegnato l'atleta a una nuova squadra e vuole che rifirmi
    privacy + periodo di prova. Setta i flag così che al prossimo login vedano il banner."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    current_season = await get_current_season_for_society(db, sid)
    ath = await db.athletes.find_one({"id": athlete_id, "society_id": sid}, {"_id": 0, "id": 1, "parent_id": 1, "date_of_birth": 1})
    if not ath:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    # 1) Atleta stesso
    await db.athletes.update_one(
        {"id": athlete_id, "society_id": sid},
        {"$set": {
            "privacy_pending_renewal": True,
            "privacy_pending_renewal_season": current_season,
            "status": "pending_privacy",
        }},
    )
    # 2) Genitore se minore
    parent_confirmed = False
    parent_id = ath.get("parent_id")
    if parent_id:
        p_res = await db.users.update_one(
            {"id": parent_id, "society_id": sid, "role": "parent"},
            {"$set": {
                "privacy_pending_renewal": True,
                "privacy_pending_renewal_season": current_season,
            }},
        )
        parent_confirmed = p_res.modified_count > 0
    return {"ok": True, "parent_notified": parent_confirmed, "season": current_season}


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
