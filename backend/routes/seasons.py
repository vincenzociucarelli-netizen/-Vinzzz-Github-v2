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


async def _archive_user_compensation_records(user_id: str, prev_season: str) -> int:
    """🆕 06/07/2026 — Marca come `is_previous_season: True` tutte le collezioni di
    quietanze compenso e dichiarazioni soglie per un utente, così i banner soglie
    non mostrano più dati residui dopo il reset stagionale.
    Ritorna il conteggio totale dei documenti modificati."""
    total = 0
    for coll, field in (("coach_compensations", "coach_id"),
                         ("collaboratore_compensations", "collaboratore_id"),
                         ("dirigente_compensations", "dirigente_id"),
                         ("external_compensations", "user_id"),
                         ("threshold_declarations", "coach_id"),
                         ("threshold_declarations", "collaboratore_id"),
                         ("threshold_declarations", "dirigente_id")):
        try:
            r = await db[coll].update_many(
                {field: user_id,
                 "$or": [{"is_previous_season": {"$exists": False}}, {"is_previous_season": False}]},
                {"$set": {"is_previous_season": True, "archived_season": prev_season}},
            )
            total += r.modified_count
        except Exception:
            pass
    return total


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
    docs_archived_reconfirm = 0
    # prev_season per archiviazione documenti
    _prev_season_reconfirm = current_season
    try:
        _cs = int(current_season.split("-")[0])
        _prev_season_reconfirm = f"{_cs - 1}-{_cs}"
    except Exception:
        pass
    if body.user_ids:
        cursor = db.users.find(
            {"id": {"$in": body.user_ids}, "society_id": sid},
            {"_id": 0, "id": 1, "role": 1, "monthly_compensation": 1,
             "other_annual_compensation": 1, "prior_compensation": 1,
             "contract_start_date": 1, "contract_end_date": 1,
             "compensation_accepted": 1, "active_seasons": 1,
             "assigned_teams": 1, "assigned_gyms": 1,
             "onboarding_checklist": 1},
        )
        async for u in cursor:
            if current_season in (u.get("active_seasons") or []):
                continue
            # 🆕 04/07/2026 — Snapshot precedente + reset assegnazioni (admin riassegnerà)
            # 🆕 06/07/2026 — Reset esteso a checklist onboarding + documenti firmati.
            update: dict = {
                "$addToSet": {"active_seasons": current_season},
                "$set": {
                    "assigned_teams_previous_season": u.get("assigned_teams") or [],
                    "assigned_gyms_previous_season": u.get("assigned_gyms") or [],
                    "onboarding_checklist_previous_season": u.get("onboarding_checklist") or {},
                    "assignment_pending_review": True,
                    "assignment_pending_review_season": current_season,
                    "assigned_teams": [],
                    "assigned_gyms": [],
                    "onboarding_checklist": {},
                    "onboarding_completed": False,
                },
                "$unset": {},
            }
            is_pro = (
                (u.get("monthly_compensation") or 0) > 0
                or (u.get("other_annual_compensation") or 0) > 0
                or (u.get("prior_compensation") or 0) > 0
                or bool(u.get("compensation_accepted"))
                or bool(u.get("contract_start_date"))
            )
            if is_pro:
                # 🆕 06/07/2026 — Reset ESTESO al momento della riconferma per
                # Coach/Collab/Dir: azzera compenso, contratto, pregresso, onboarding
                # (prima veniva fatto solo dal backfill retroattivo).
                update["$set"].update({
                    "pro_data_pending_review": True,
                    "pro_data_pending_review_season": current_season,
                    "monthly_compensation_previous_season": u.get("monthly_compensation") or 0,
                    "other_annual_compensation_previous_season": u.get("other_annual_compensation") or 0,
                    "prior_compensation_previous_season": u.get("prior_compensation") or 0,
                    "contract_start_date_previous_season": u.get("contract_start_date"),
                    "contract_end_date_previous_season": u.get("contract_end_date"),
                    "compensation_accepted": False,
                    "monthly_compensation": 0,
                    "other_annual_compensation": 0,
                    "prior_compensation": 0,
                })
                update["$unset"].update({
                    "compensation_accepted_date": "",
                    "contract_start_date": "",
                    "contract_end_date": "",
                })
                usr_pro_flagged += 1
            if not update["$unset"]:
                update.pop("$unset")
            await db.users.update_one({"id": u["id"], "society_id": sid}, update)
            # Archivia documenti firmati (non li cancella)
            try:
                d_res = await db.signed_documents.update_many(
                    {"signer_id": u["id"], "society_id": sid,
                     "$or": [{"is_previous_season": {"$exists": False}}, {"is_previous_season": False}]},
                    {"$set": {"season": _prev_season_reconfirm, "is_previous_season": True}},
                )
                docs_archived_reconfirm += d_res.modified_count
            except Exception:
                pass
            # 🆕 06/07/2026 — Archivia anche compensi/soglie
            try:
                await _archive_user_compensation_records(u["id"], _prev_season_reconfirm)
            except Exception:
                pass
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
@router.post("/seasons/backfill-reset-assignments")
async def backfill_reset_assignments(current_user = Depends(get_current_user)):
    """Fix retroattivo: users riconfermati con il codice VECCHIO non hanno avuto le
    assegnazioni svuotate. Questo endpoint rileva quelli con `active_seasons ⊃ current_season`
    ma senza `assignment_pending_review=True` (indice del reset non applicato) e svuota
    le loro `assigned_teams` / `assigned_gyms` salvando lo snapshot precedente."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    current_season = await get_current_season_for_society(db, sid)

    q = {
        "society_id": sid,
        "active_seasons": current_season,
        "role": {"$in": [UserRole.COACH, UserRole.COLLABORATORE, UserRole.DIRIGENTE, UserRole.VIEWER]},
        "$or": [
            {"assignment_pending_review": {"$exists": False}},
            {"assignment_pending_review": False},
        ],
    }
    fixed = 0
    async for u in db.users.find(q, {"_id": 0, "id": 1, "assigned_teams": 1, "assigned_gyms": 1}):
        teams_prev = u.get("assigned_teams") or []
        gyms_prev = u.get("assigned_gyms") or []
        if not teams_prev and not gyms_prev:
            continue  # niente da resettare
        await db.users.update_one(
            {"id": u["id"], "society_id": sid},
            {"$set": {
                "assigned_teams_previous_season": teams_prev,
                "assigned_gyms_previous_season": gyms_prev,
                "assignment_pending_review": True,
                "assignment_pending_review_season": current_season,
                "assigned_teams": [],
                "assigned_gyms": [],
            }},
        )
        fixed += 1

    # 🆕 05/07/2026 — Reset ESTESO per Coach/Collab/Dir già riconfermati (con o senza fix precedente).
    # Azzeriamo: compenso, contratto, pregresso, accettazione, onboarding, checklist.
    # 🆕 06/07/2026 — Rimosso vincolo su `active_seasons` per catturare anche i record
    # migrati senza il campo popolato (fallback identico a /api/users/coaches).
    q_ext = {
        "society_id": sid,
        "role": {"$in": [UserRole.COACH, UserRole.COLLABORATORE, UserRole.DIRIGENTE, UserRole.VIEWER]},
        "$and": [
            {"$or": [
                {"active_seasons": current_season},
                {"active_seasons": {"$exists": False}},
            ]},
            {"$or": [
                {"compensation_accepted": True},
                {"contract_start_date": {"$exists": True, "$ne": None}},
                {"monthly_compensation": {"$gt": 0}},
                {"other_annual_compensation": {"$gt": 0}},
                {"prior_compensation": {"$gt": 0}},
            ]},
        ],
    }
    users_reset_ext = 0
    docs_archived_ext = 0
    # prev_season per marcare i documenti come archivio
    _prev_season_for_docs = current_season
    try:
        _cs = int(current_season.split("-")[0])
        _prev_season_for_docs = f"{_cs - 1}-{_cs}"
    except Exception:
        pass
    async for u in db.users.find(q_ext, {"_id": 0, "id": 1, "monthly_compensation": 1, "other_annual_compensation": 1, "prior_compensation": 1, "contract_start_date": 1, "contract_end_date": 1, "assigned_teams": 1, "assigned_gyms": 1, "onboarding_checklist": 1}):
        await db.users.update_one(
            {"id": u["id"], "society_id": sid},
            {
                "$set": {
                    # Snapshot completo
                    "monthly_compensation_previous_season": u.get("monthly_compensation") or 0,
                    "other_annual_compensation_previous_season": u.get("other_annual_compensation") or 0,
                    "prior_compensation_previous_season": u.get("prior_compensation") or 0,
                    "contract_start_date_previous_season": u.get("contract_start_date"),
                    "contract_end_date_previous_season": u.get("contract_end_date"),
                    "assigned_teams_previous_season": u.get("assigned_teams") or [],
                    "assigned_gyms_previous_season": u.get("assigned_gyms") or [],
                    "onboarding_checklist_previous_season": u.get("onboarding_checklist") or {},
                    # Flags
                    "pro_data_pending_review": True,
                    "pro_data_pending_review_season": current_season,
                    "assignment_pending_review": True,
                    "assignment_pending_review_season": current_season,
                    # Reset operativi
                    "compensation_accepted": False,
                    "monthly_compensation": 0,
                    "other_annual_compensation": 0,
                    "prior_compensation": 0,
                    "onboarding_completed": False,
                    "assigned_teams": [],
                    "assigned_gyms": [],
                    "onboarding_checklist": {},
                },
                "$unset": {
                    "compensation_accepted_date": "",
                    "contract_start_date": "",
                    "contract_end_date": "",
                },
            },
        )
        # Archivia documenti firmati come stagione precedente
        try:
            d_res = await db.signed_documents.update_many(
                {"signer_id": u["id"], "society_id": sid,
                 "$or": [{"is_previous_season": {"$exists": False}}, {"is_previous_season": False}]},
                {"$set": {"season": _prev_season_for_docs, "is_previous_season": True}},
            )
            docs_archived_ext += d_res.modified_count
        except Exception:
            pass
        # 🆕 06/07/2026 — Archivia anche compensi/soglie
        try:
            await _archive_user_compensation_records(u["id"], _prev_season_for_docs)
        except Exception:
            pass
        users_reset_ext += 1

    # 🆕 04/07/2026 — Stesso backfill per gli ATLETI riconfermati con codice vecchio
    # 🆕 05/07/2026 — In più marca i loro PAGAMENTI come stagione precedente.
    # Calcola la stagione appena chiusa (start_year - 1) - start_year.
    prev_season = current_season
    try:
        cur_start = int(current_season.split("-")[0])
        prev_season = f"{cur_start - 1}-{cur_start}"
    except Exception:
        pass

    q_ath = {
        "society_id": sid,
        "active_seasons": current_season,
        "team_id": {"$exists": True, "$nin": [None, ""]},
        "$or": [
            {"team_id_previous_season": {"$exists": False}},
            {"team_id_previous_season": None},
        ],
    }
    fixed_ath = 0
    payments_archived = 0
    async for a in db.athletes.find(q_ath, {"_id": 0, "id": 1, "team_id": 1, "status": 1}):
        prev_team = a.get("team_id")
        prev_status = a.get("status")
        await db.athletes.update_one(
            {"id": a["id"], "society_id": sid},
            {
                "$set": {
                    "team_id_previous_season": prev_team,
                    "status_previous_season": prev_status,
                    "privacy_pending_renewal": True,
                    "privacy_pending_renewal_season": current_season,
                    "status": "pending",
                    "privacy_accepted": False,
                    "privacy_accepted_previous_season": True,
                },
                "$unset": {
                    "team_id": "",
                    "privacy_accepted_at": "", "privacy_accepted_by": "",
                    "trial_start_date": "", "trial_end_date": "",
                    "trial_document_generated": "", "trial_document_id": "",
                    "trial_workouts_used": "", "trial_workouts_dates": "",
                    "is_trial": "", "trial_signed_at": "",
                },
            },
        )
        # Archivia i pagamenti (marca stagione precedente + flag). Non li cancella.
        p_res = await db.payments.update_many(
            {"athlete_id": a["id"], "season": {"$exists": False}},
            {"$set": {"season": prev_season, "is_previous_season": True}},
        )
        payments_archived += p_res.modified_count
        fixed_ath += 1

    # 🆕 05/07/2026 — Passaggio aggiuntivo: marca i pagamenti anche per gli atleti
    # GIA' resettati in precedenza (quando il codice di archiviazione pagamenti non c'era).
    # Filtro: atleti con team_id_previous_season valorizzato ma pagamenti senza season.
    already_reset = db.athletes.find(
        {"society_id": sid, "team_id_previous_season": {"$exists": True, "$nin": [None, ""]}},
        {"_id": 0, "id": 1},
    )
    async for a in already_reset:
        p_res2 = await db.payments.update_many(
            {"athlete_id": a["id"], "season": {"$exists": False}},
            {"$set": {"season": prev_season, "is_previous_season": True}},
        )
        payments_archived += p_res2.modified_count
        # 🆕 05/07/2026 — Reset privacy + status + trial per atleti già-resettati in precedenza
        # ⚠️ 10/07/2026 (v7.15) — HOTFIX BUG "atleti approvati riproposti in attesa".
        # In precedenza qui si applicava incondizionatamente `status=pending` a ogni
        # atleta con `team_id_previous_season` valorizzato. Ma questo campo è un
        # semplice SNAPSHOT permanente: rimane per sempre. Ogni chiamata del
        # backfill (che è auto-triggered dalla pagina Archivio) ripristinava
        # `pending` sugli atleti nel frattempo APPROVATI dall'admin, cancellando
        # `trial_start_date` e le approvazioni. Ora escludiamo:
        #   1) atleti già `status=pending` (idempotente),
        #   2) atleti con `approved_at` valorizzato (già ri-approvati),
        #   3) atleti con `_backfill_v0705_reset_done=true` (già trattati).
        await db.athletes.update_one(
            {
                "id": a["id"], "society_id": sid,
                "status": {"$ne": "pending"},
                "approved_at": {"$in": [None, ""]},
                "_backfill_v0705_reset_done": {"$ne": True},
            },
            {
                "$set": {
                    "privacy_pending_renewal": True,
                    "privacy_pending_renewal_season": current_season,
                    "privacy_accepted": False,
                    "privacy_accepted_previous_season": True,
                    "status": "pending",
                    "_backfill_v0705_reset_done": True,
                },
                "$unset": {
                    "privacy_accepted_at": "", "privacy_accepted_by": "",
                    "trial_start_date": "", "trial_end_date": "",
                    "trial_document_generated": "", "trial_document_id": "",
                    "trial_workouts_used": "", "trial_workouts_dates": "",
                    "is_trial": "", "trial_signed_at": "",
                },
            },
        )
        # Anche gli atleti "pending" senza flag privacy_pending: applica il reset trial
        await db.athletes.update_one(
            {"id": a["id"], "society_id": sid, "status": "pending", "privacy_accepted": {"$ne": False}},
            {
                "$set": {
                    "privacy_pending_renewal": True,
                    "privacy_pending_renewal_season": current_season,
                    "privacy_accepted": False,
                    "privacy_accepted_previous_season": True,
                },
                "$unset": {
                    "privacy_accepted_at": "", "privacy_accepted_by": "",
                    "trial_start_date": "", "trial_end_date": "",
                    "trial_document_generated": "", "trial_document_id": "",
                    "trial_workouts_used": "", "trial_workouts_dates": "",
                    "is_trial": "", "trial_signed_at": "",
                },
            },
        )
        # 🆕 05/07/2026 — Reset privacy anche del GENITORE (per atleti minorenni la privacy è del parent)
        ath_full = await db.athletes.find_one({"id": a["id"], "society_id": sid}, {"_id": 0, "parent_id": 1})
        if ath_full and ath_full.get("parent_id"):
            await db.users.update_one(
                {"id": ath_full["parent_id"], "society_id": sid, "role": "parent"},
                {
                    "$set": {
                        "privacy_pending_renewal": True,
                        "privacy_pending_renewal_season": current_season,
                        "privacy_accepted": False,
                        "privacy_accepted_previous_season": True,
                    },
                    "$unset": {"privacy_accepted_at": "", "privacy_accepted_by": ""},
                },
            )

    return {"ok": True, "reset_count": fixed, "users_reset_extended": users_reset_ext, "athletes_reset": fixed_ath, "payments_archived": payments_archived, "current_season": current_season}


@router.post("/seasons/users/{user_id}/reset-assignments")
async def reset_user_assignments(user_id: str, current_user = Depends(get_current_user)):
    """Reset singolo utente: sposta assegnazioni in snapshot e mette in stato Da riassegnare."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    current_season = await get_current_season_for_society(db, sid)
    u = await db.users.find_one({"id": user_id, "society_id": sid}, {"_id": 0, "id": 1, "assigned_teams": 1, "assigned_gyms": 1, "role": 1})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    await db.users.update_one(
        {"id": user_id, "society_id": sid},
        {"$set": {
            "assigned_teams_previous_season": u.get("assigned_teams") or [],
            "assigned_gyms_previous_season": u.get("assigned_gyms") or [],
            "assignment_pending_review": True,
            "assignment_pending_review_season": current_season,
            "assigned_teams": [],
            "assigned_gyms": [],
        }},
    )
    return {"ok": True, "current_season": current_season}


# 🆕 06/07/2026 — Reset FORZATO singolo Coach/Collab/Dirigente per la stagione corrente
# Utile quando il backfill batch non ha catturato l'utente (es. active_seasons mancante
# o già riconfermato con il codice vecchio). L'admin può chiamarlo dalla scheda profilo.
@router.post("/seasons/users/{user_id}/reset-compensation")
async def reset_user_compensation(user_id: str, current_user = Depends(get_current_user)):
    """Reset FORZATO singolo Coach/Collab/Dirigente. Ripulisce compenso, contratto,
    pregresso, onboarding, squadre/palestre assegnate, checklist. I documenti firmati
    vengono archiviati come `is_previous_season: true`. Salva snapshot su *_previous_season."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    current_season = await get_current_season_for_society(db, sid)
    # Calcola prev_season per marcatura documenti/checklist
    try:
        cur_start = int(current_season.split("-")[0])
        prev_season = f"{cur_start - 1}-{cur_start}"
    except Exception:
        prev_season = current_season
    u = await db.users.find_one(
        {"id": user_id, "society_id": sid},
        {"_id": 0, "id": 1, "role": 1, "monthly_compensation": 1,
         "other_annual_compensation": 1, "prior_compensation": 1,
         "contract_start_date": 1, "contract_end_date": 1,
         "assigned_teams": 1, "assigned_gyms": 1,
         "onboarding_checklist": 1},
    )
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if u.get("role") not in [UserRole.COACH, UserRole.COLLABORATORE, UserRole.DIRIGENTE, UserRole.VIEWER]:
        raise HTTPException(status_code=400, detail="Solo Coach/Collaboratori/Dirigenti")
    await db.users.update_one(
        {"id": user_id, "society_id": sid},
        {
            "$set": {
                # Snapshot completo della stagione precedente
                "monthly_compensation_previous_season": u.get("monthly_compensation") or 0,
                "other_annual_compensation_previous_season": u.get("other_annual_compensation") or 0,
                "prior_compensation_previous_season": u.get("prior_compensation") or 0,
                "contract_start_date_previous_season": u.get("contract_start_date"),
                "contract_end_date_previous_season": u.get("contract_end_date"),
                "assigned_teams_previous_season": u.get("assigned_teams") or [],
                "assigned_gyms_previous_season": u.get("assigned_gyms") or [],
                "onboarding_checklist_previous_season": u.get("onboarding_checklist") or {},
                # Flags per banner "da riconfermare"
                "pro_data_pending_review": True,
                "pro_data_pending_review_season": current_season,
                "assignment_pending_review": True,
                "assignment_pending_review_season": current_season,
                # Reset campi operativi
                "compensation_accepted": False,
                "monthly_compensation": 0,
                "other_annual_compensation": 0,
                "prior_compensation": 0,
                "onboarding_completed": False,
                "assigned_teams": [],
                "assigned_gyms": [],
                "onboarding_checklist": {},
            },
            "$unset": {
                "compensation_accepted_date": "",
                "contract_start_date": "",
                "contract_end_date": "",
            },
        },
    )
    # 🆕 Archivia i documenti firmati (non li cancella): li marca come stagione precedente
    docs_res = await db.signed_documents.update_many(
        {"signer_id": user_id, "society_id": sid,
         "$or": [{"is_previous_season": {"$exists": False}}, {"is_previous_season": False}]},
        {"$set": {"season": prev_season, "is_previous_season": True}},
    )
    # 🆕 06/07/2026 — Archivia anche quietanze compenso e dichiarazioni soglie 5k/15k
    # e compensi esterni dichiarati (ricevuti da altre ASD). Così il banner "Anno X:
    # supererà la soglia" non appare più con dati residui.
    comp_archived = await _archive_user_compensation_records(user_id, prev_season)
    return {
        "ok": True,
        "current_season": current_season,
        "documents_archived": docs_res.modified_count,
        "compensations_archived": comp_archived,
    }


# 🆕 04/07/2026 — Endpoint per richiedere all'atleta (o al genitore se minore)
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


# =============================================================================
# 🆕 06/07/2026 — NUOVO FLUSSO ROLLOVER STAGIONE (import solo anagrafica)
# =============================================================================
# L'admin, dopo la data di inizio stagione configurata nelle impostazioni società,
# apre `/admin/nuova-stagione`. Vede TUTTI i tesserati raggruppati per ruolo con
# checkbox pre-selezionati. Spunta chi vuole importare e clicca "Conferma".
# In un'unica operazione atomica:
#   - archivia tutto lo storico stagione precedente (is_previous_season: true)
#   - copia SOLO l'anagrafica dei selezionati nella nuova stagione (adulti)
#   - copia anagrafica + genitori + certificato medico + qr_code (minorenni)
#   - aggiorna current_season nelle impostazioni società
# Nessuna nuova iterazione di riconferma/backfill richiesta.
# =============================================================================


class RolloverBody(BaseModel):
    """Payload per il rollover atomico di stagione."""
    selected_user_ids: List[str] = []
    selected_athlete_ids: List[str] = []
    confirmation: str = ""


def _next_season(current: str) -> str:
    """Data una stagione '2025-2026' torna '2026-2027'."""
    try:
        start = int(current.split("-")[0])
        return f"{start + 1}-{start + 2}"
    except Exception:
        return current


def _prev_season(current: str) -> str:
    try:
        start = int(current.split("-")[0])
        return f"{start - 1}-{start}"
    except Exception:
        return current


@router.get("/seasons/rollover/preview")
async def rollover_preview(current_user = Depends(get_current_user)):
    """Preview: restituisce tutti i tesserati raggruppati per ruolo con dati anagrafici
    minimi + flag `decision_status` (`pending` | `imported` | `dismissed`).
    Include anche `is_new_season_open` per capire se admin ha già cliccato
    "Apri nuova stagione"."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")

    # Data-gate: la pagina è accessibile solo dopo il season_start_month
    settings = await db.settings.find_one({"society_id": sid}) or {}
    season_start_month = int(settings.get("season_start_month") or 7)
    season_start_day = int(settings.get("season_start_day") or 1)
    now = datetime.utcnow()
    can_rollover = (now.month, now.day) >= (season_start_month, season_start_day)
    current_season = await get_current_season_for_society(db, sid)
    next_season = _next_season(current_season)

    # 🆕 08/07/2026 — Il concetto è: la stagione "aperta" è quella in `settings.current_season`.
    # Se un utente ha `current_season` nel proprio `active_seasons` → è già dentro (imported).
    # Se ha `rollover_decision == 'dismissed'` per current_season → non ricomparirà.
    # Altrimenti → pending (mostrato con bottoni Importa / Non riconferma).
    # Per capire se il rollover è "iniziato" guardiamo se esiste `settings.new_season_opened_at`.
    is_new_season_open = bool(settings.get("new_season_opened_at"))

    def _decision(m: dict, active_season: str) -> str:
        if active_season in (m.get("active_seasons") or []):
            return "imported"
        if m.get("rollover_decision") == "dismissed" and m.get("rollover_decision_season") == active_season:
            return "dismissed"
        return "pending"

    users_proj = {
        "_id": 0, "id": 1, "full_name": 1, "first_name": 1, "last_name": 1,
        "email": 1, "role": 1, "fiscal_code": 1, "status": 1, "active_seasons": 1,
        "rollover_decision": 1, "rollover_decision_season": 1,
    }
    ath_proj = {
        "_id": 0, "id": 1, "full_name": 1, "first_name": 1, "last_name": 1,
        "birth_date": 1, "date_of_birth": 1, "fiscal_code": 1, "status": 1,
        "athlete_type": 1,
        "parent_id": 1, "second_parent_id": 1,
        "medical_certificate_expiry": 1, "qr_code": 1, "active_seasons": 1,
        "rollover_decision": 1, "rollover_decision_season": 1,
    }

    # Preleva TUTTI i tesserati registrati alla società (attivi o archiviati)
    all_users = await db.users.find(
        {"society_id": sid,
         "role": {"$in": [UserRole.COACH, UserRole.DIRIGENTE, UserRole.VIEWER,
                            UserRole.COLLABORATORE, UserRole.PARENT]}},
        users_proj,
    ).to_list(2000)
    all_athletes = await db.athletes.find({"society_id": sid}, ath_proj).to_list(5000)

    # Il campo per il "match" dipende se la stagione è aperta:
    #   - se aperta (settings.current_season = nuova): current_season stessa è la nuova
    #   - se non aperta: la nuova è next_season
    target_season = current_season if is_new_season_open else next_season

    def _annotate(items: list) -> list:
        for m in items:
            m["decision_status"] = _decision(m, target_season)
        return items

    coaches = _annotate([u for u in all_users if u.get("role") == UserRole.COACH])
    dirigenti = _annotate([u for u in all_users if u.get("role") in [UserRole.DIRIGENTE, UserRole.VIEWER]])
    collaboratori = _annotate([u for u in all_users if u.get("role") == UserRole.COLLABORATORE])
    genitori = _annotate([u for u in all_users if u.get("role") == UserRole.PARENT])

    # Separa atleti "quota" (tutti insieme: 18- e 18+) vs PRO (18+ pro)
    from datetime import date as _date
    today = _date.today()

    def _is_minor(a: dict) -> bool:
        dob = a.get("birth_date") or a.get("date_of_birth")
        if not dob:
            return False
        try:
            if isinstance(dob, str):
                d = datetime.fromisoformat(dob.split("T")[0]).date()
            elif hasattr(dob, "date"):
                d = dob.date()
            else:
                d = dob
            years = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
            return years < 18
        except Exception:
            return False

    # 🆕 08/07/2026 — Atleti divisi in 2 cartelle: "Atleti" (tutti i quota, sia 18- che 18+)
    # e "Atleti PRO" (18+ compensati). Per la cartella "Atleti" l'admin distribuirà poi
    # gli iscritti nelle varie squadre della nuova stagione.
    for a in all_athletes:
        a["is_minor"] = _is_minor(a)
    athletes = _annotate([a for a in all_athletes if a.get("athlete_type") != "pro"])
    athletes_pro = _annotate([a for a in all_athletes if a.get("athlete_type") == "pro"])

    return {
        "current_season": current_season,
        "next_season": next_season,
        "target_season": target_season,
        "is_new_season_open": is_new_season_open,
        "can_rollover": can_rollover,
        "season_start_month": season_start_month,
        "season_start_day": season_start_day,
        "coaches": coaches,
        "dirigenti": dirigenti,
        "collaboratori": collaboratori,
        "genitori": genitori,
        "athletes": athletes,
        "athletes_pro": athletes_pro,
    }


# Campi anagrafici da preservare (adulti)
_ADULT_KEEP_FIELDS = {
    "id", "society_id", "email", "password_hash", "role", "full_name", "status",
    "created_at", "approved_at", "approved_by",
    "first_name", "last_name", "date_of_birth", "place_of_birth", "birth_province",
    "fiscal_code", "address", "city", "postal_code", "province", "phone",
    "identity_document_type", "identity_document_number", "identity_document_expiry",
    "coach_license_number", "coach_license_level", "coach_license_expiry",
    "qualification", "qualification2", "qualifications", "is_scorekeeper",
    "active_seasons",
}


# Campi anagrafici da preservare (atleta, sia maggiorenne che minorenne)
_ATHLETE_KEEP_BASE = {
    "id", "society_id", "full_name", "first_name", "last_name",
    "birth_date", "date_of_birth", "birth_place", "birth_province", "gender",
    "fiscal_code", "address", "city", "postal_code", "province", "phone", "email",
    "status", "created_at", "qr_code",
}

# Extra per minorenni
_ATHLETE_KEEP_MINOR = _ATHLETE_KEEP_BASE | {
    "parent_id", "second_parent_id",
    "tax_payer_first_name", "tax_payer_last_name", "tax_payer_fiscal_code",
    "medical_certificate", "medical_certificate_expiry",
    "medical_certificate_issue_date", "medical_certificate_verified",
    "medical_certificate_type", "medical_certificate_inserted_by",
    "medical_certificate_inserted_by_name", "medical_certificate_inserted_by_role",
    "medical_certificate_inserted_at", "medical_certificate_verified_by",
    "medical_certificate_verified_by_name", "medical_certificate_verified_at",
    "medical_certificate_updated_by", "medical_certificate_updated_by_name",
    "medical_certificate_updated_by_role", "medical_certificate_updated_at",
}


async def _reset_user_to_registry_only(user_id: str, sid: str, next_season: str) -> None:
    """Azzera tutti i campi operativi dell'utente, mantiene solo anagrafica.
    Aggiunge next_season a active_seasons."""
    user = await db.users.find_one({"id": user_id, "society_id": sid}, {"_id": 0})
    if not user:
        return
    # $set = solo campi anagrafici + reset esplicito di operativi + active_seasons
    to_set: dict = {
        "assigned_teams": [],
        "assigned_venues": [],
        "monthly_compensation": 0,
        "other_annual_compensation": 0,
        "prior_compensation": 0,
        "compensation_accepted": False,
        "onboarding_completed": False,
        "onboarding_checklist": {},
        "pro_data_pending_review": False,
        "assignment_pending_review": False,
        "is_terminated": False,
    }
    # Rimuovi campi operativi
    to_unset = {
        "contract_start_date": "",
        "contract_end_date": "",
        "compensation_accepted_date": "",
        "assigned_gyms": "",
        "assigned_teams_previous_season": "",
        "assigned_gyms_previous_season": "",
        "onboarding_checklist_previous_season": "",
        "monthly_compensation_previous_season": "",
        "other_annual_compensation_previous_season": "",
        "prior_compensation_previous_season": "",
        "contract_start_date_previous_season": "",
        "contract_end_date_previous_season": "",
        "pro_data_pending_review_season": "",
        "assignment_pending_review_season": "",
    }
    await db.users.update_one(
        {"id": user_id, "society_id": sid},
        {"$set": to_set, "$unset": to_unset, "$addToSet": {"active_seasons": next_season}},
    )


async def _reset_athlete_to_registry_only(athlete_id: str, sid: str, next_season: str, is_minor: bool) -> None:
    """Azzera team, prova, quote, privacy, presenze; mantiene anagrafica.
    Per minorenni mantiene anche parent_id, second_parent_id, medical_certificate*, qr_code."""
    to_set: dict = {
        "team_id": None,
        "team_ids": [],
        "trial_period": False,
        "trial_start": None,
        "trial_end": None,
        "annual_fee_amount": 0,
        "monthly_fee_amount": 0,
        "payment_status": "pending",
        "privacy_accepted": False,
        "privacy_accepted_date": None,
        "gdpr_signed": False,
    }
    to_unset = {
        "team_id_previous_season": "",
        "trial_type": "",
        "trial_start_previous_season": "",
        "trial_end_previous_season": "",
    }
    if not is_minor:
        # Adulti PRO: rimuovi anche parent_id ereditato
        to_unset["parent_id"] = ""
        to_unset["second_parent_id"] = ""
    await db.athletes.update_one(
        {"id": athlete_id, "society_id": sid},
        {"$set": to_set, "$unset": to_unset, "$addToSet": {"active_seasons": next_season}},
    )


async def _archive_all_current_season_operational(sid: str, prev_season: str) -> dict:
    """Marca is_previous_season: true su tutte le collezioni operative della società.
    Non tocca le anagrafiche (users, athletes)."""
    counts = {}
    collections_soc = [
        "signed_documents", "coach_compensations", "collaboratore_compensations",
        "dirigente_compensations", "external_compensations", "threshold_declarations",
        "payments", "attendance", "notifications", "matches", "trainings",
    ]
    for coll in collections_soc:
        try:
            r = await db[coll].update_many(
                {"society_id": sid,
                 "$or": [{"is_previous_season": {"$exists": False}}, {"is_previous_season": False}]},
                {"$set": {"is_previous_season": True, "archived_season": prev_season}},
            )
            counts[coll] = r.modified_count
        except Exception:
            counts[coll] = 0
    return counts


@router.post("/seasons/open-new-season")
async def open_new_season(body: RolloverBody, current_user = Depends(get_current_user)):
    """🚀 Apre la nuova stagione: archivia tutto lo storico operativo e sposta
    `current_season` alla successiva. NON importa nessun tesserato: tutti restano
    nella stagione precedente finché l'admin non li importa uno per uno.
    Requisiti:
      - Admin only
      - Data corrente >= season_start (dalle impostazioni società)
      - body.confirmation == "CONFERMA"
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    if (body.confirmation or "").strip().upper() != "CONFERMA":
        raise HTTPException(status_code=400, detail="Conferma mancante: digita 'CONFERMA' per procedere")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")

    settings = await db.settings.find_one({"society_id": sid}) or {}
    season_start_month = int(settings.get("season_start_month") or 7)
    season_start_day = int(settings.get("season_start_day") or 1)
    now = datetime.utcnow()
    if (now.month, now.day) < (season_start_month, season_start_day):
        raise HTTPException(
            status_code=400,
            detail=f"Apertura nuova stagione disponibile solo dal {season_start_day:02d}/{season_start_month:02d}."
        )

    prev_season = await get_current_season_for_society(db, sid)
    new_season = _next_season(prev_season)

    # Se è già stata aperta, non rifare l'archiviazione (idempotent)
    if settings.get("new_season_opened_at") and settings.get("current_season") == new_season:
        return {"ok": True, "already_open": True, "from_season": prev_season, "current_season": new_season}

    # 1. Archivia tutto lo storico operativo come stagione precedente
    archive_counts = await _archive_all_current_season_operational(sid, prev_season)

    # 2. Snapshot in season_archives (backup navigabile)
    try:
        await db.season_archives.insert_one({
            "id": str(datetime.utcnow().timestamp()).replace(".", ""),
            "society_id": sid,
            "season": prev_season,
            "archived_at": datetime.utcnow().isoformat(),
            "archived_by": current_user["id"],
            "archived_by_name": current_user.get("full_name", ""),
            "operational_counts": archive_counts,
        })
    except Exception:
        pass

    # 3. Aggiorna current_season nelle impostazioni + flag apertura
    await db.settings.update_one(
        {"society_id": sid},
        {"$set": {
            "current_season": new_season,
            "current_season_updated_at": datetime.utcnow().isoformat(),
            "new_season_opened_at": datetime.utcnow().isoformat(),
            "new_season_opened_by": current_user["id"],
            "previous_season": prev_season,
        }},
        upsert=True,
    )

    # 4. Audit log
    try:
        await db.audit_logs.insert_one({
            "id": str(datetime.utcnow().timestamp()).replace(".", ""),
            "society_id": sid,
            "user_id": current_user["id"],
            "user_name": current_user.get("full_name", ""),
            "action": "open_new_season",
            "from_season": prev_season,
            "to_season": new_season,
            "archive_counts": archive_counts,
            "timestamp": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    return {
        "ok": True,
        "from_season": prev_season,
        "current_season": new_season,
        "archive_counts": archive_counts,
    }


async def _find_member(member_id: str, sid: str):
    """Ritorna (kind, doc) dove kind = 'user' | 'athlete' | None."""
    u = await db.users.find_one({"id": member_id, "society_id": sid}, {"_id": 0})
    if u:
        return ("user", u)
    a = await db.athletes.find_one({"id": member_id, "society_id": sid}, {"_id": 0})
    if a:
        return ("athlete", a)
    return (None, None)


@router.post("/seasons/import-member/{member_id}")
async def import_member(member_id: str, current_user = Depends(get_current_user)):
    """🟢 Importa un singolo tesserato (user o atleta) nella stagione corrente.
    Auto-detecta il tipo. Mantiene solo anagrafica (per minorenne anche genitori/
    certificato/QR). Aggiunge current_season a active_seasons."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    kind, doc = await _find_member(member_id, sid)
    if not doc:
        raise HTTPException(status_code=404, detail="Tesserato non trovato")

    current_season = await get_current_season_for_society(db, sid)

    if kind == "user":
        await _reset_user_to_registry_only(member_id, sid, current_season)
        await db.users.update_one(
            {"id": member_id, "society_id": sid},
            {"$set": {"rollover_decision": "imported",
                       "rollover_decision_season": current_season,
                       "rollover_decision_at": datetime.utcnow().isoformat()}},
        )
    else:
        # atleta
        from datetime import date as _date
        today = _date.today()
        dob = doc.get("birth_date") or doc.get("date_of_birth")
        is_minor = False
        if dob:
            try:
                if isinstance(dob, str):
                    d = datetime.fromisoformat(dob.split("T")[0]).date()
                elif hasattr(dob, "date"):
                    d = dob.date()
                else:
                    d = dob
                years = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
                is_minor = years < 18
            except Exception:
                pass
        await _reset_athlete_to_registry_only(member_id, sid, current_season, is_minor)
        await db.athletes.update_one(
            {"id": member_id, "society_id": sid},
            {"$set": {"rollover_decision": "imported",
                       "rollover_decision_season": current_season,
                       "rollover_decision_at": datetime.utcnow().isoformat()}},
        )

        # 🆕 09/07/2026 (v7.15) — Auto-import genitori collegati per atleti minorenni.
        # Root cause del bug "atleti orfani": importando SOLO l'atleta, il suo genitore
        # restava nella stagione precedente (active_seasons non aggiornato) → nella
        # dashboard admin l'atleta appariva senza genitore.
        # Fix: aggiungi current_season all'active_seasons dei genitori collegati.
        if is_minor:
            linked_parent_ids: list = []
            pid = doc.get("parent_id")
            sid2 = doc.get("second_parent_id")
            if pid:
                linked_parent_ids.append(pid)
            if sid2:
                linked_parent_ids.append(sid2)
            imported_parents: list = []
            for _pid in linked_parent_ids:
                parent_user = await db.users.find_one(
                    {"id": _pid, "society_id": sid, "role": "parent"},
                    {"_id": 0, "id": 1, "active_seasons": 1, "email": 1, "full_name": 1,
                     "rollover_decision": 1, "rollover_decision_season": 1},
                )
                if not parent_user:
                    continue
                already_in = current_season in (parent_user.get("active_seasons") or [])
                if not already_in:
                    await db.users.update_one(
                        {"id": _pid, "society_id": sid},
                        {"$addToSet": {"active_seasons": current_season},
                         "$set": {"rollover_decision": "imported",
                                  "rollover_decision_season": current_season,
                                  "rollover_decision_at": datetime.utcnow().isoformat()}},
                    )
                    imported_parents.append({
                        "id": _pid,
                        "email": parent_user.get("email"),
                        "full_name": parent_user.get("full_name"),
                    })

    try:
        await db.audit_logs.insert_one({
            "id": str(datetime.utcnow().timestamp()).replace(".", ""),
            "society_id": sid,
            "user_id": current_user["id"],
            "user_name": current_user.get("full_name", ""),
            "action": "import_member",
            "target_id": member_id,
            "target_kind": kind,
            "season": current_season,
            "timestamp": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    result: dict = {"ok": True, "kind": kind, "season": current_season}
    if kind == "athlete":
        try:
            result["imported_parents"] = imported_parents  # type: ignore[name-defined]
        except NameError:
            result["imported_parents"] = []
    return result


@router.post("/seasons/dismiss-member/{member_id}")
async def dismiss_member(member_id: str, current_user = Depends(get_current_user)):
    """⚪ Marca il tesserato come "non riconfermato" per la stagione corrente.
    Non tocca i suoi dati (anagrafica resta), semplicemente non entrerà nella
    nuova stagione. Reversibile con /undo-decision."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    kind, doc = await _find_member(member_id, sid)
    if not doc:
        raise HTTPException(status_code=404, detail="Tesserato non trovato")
    current_season = await get_current_season_for_society(db, sid)
    coll = db.users if kind == "user" else db.athletes
    await coll.update_one(
        {"id": member_id, "society_id": sid},
        {"$set": {"rollover_decision": "dismissed",
                   "rollover_decision_season": current_season,
                   "rollover_decision_at": datetime.utcnow().isoformat()}},
    )
    return {"ok": True, "kind": kind}


@router.post("/seasons/undo-decision/{member_id}")
async def undo_decision(member_id: str, current_user = Depends(get_current_user)):
    """↩️ Annulla la decisione (dismiss o import) e riporta in stato pending.
    Se era dismissed: rimuove semplicemente il flag.
    Se era imported: rimuove current_season da active_seasons (la persona
    torna in stato "da decidere"). NON ripristina però le informazioni
    operative già azzerate dall'importazione — questa è una scelta consapevole
    per evitare confusione."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")
    kind, doc = await _find_member(member_id, sid)
    if not doc:
        raise HTTPException(status_code=404, detail="Tesserato non trovato")
    current_season = await get_current_season_for_society(db, sid)
    coll = db.users if kind == "user" else db.athletes
    prev_decision = doc.get("rollover_decision")
    update: dict = {
        "$unset": {"rollover_decision": "", "rollover_decision_season": "", "rollover_decision_at": ""},
    }
    if prev_decision == "imported":
        update["$pull"] = {"active_seasons": current_season}
    await coll.update_one({"id": member_id, "society_id": sid}, update)
    return {"ok": True, "kind": kind, "was": prev_decision}


# Endpoint legacy mantenuto per compatibilità (bulk rollover atomico)
@router.post("/seasons/rollover")
async def rollover_season(body: RolloverBody, current_user = Depends(get_current_user)):
    """🚀 Rollover atomico stagione: archivia storico + importa SOLO anagrafica dei selezionati.
    Requisiti:
      - Admin only
      - Data corrente >= season_start (dalle impostazioni società)
      - body.confirmation == "CONFERMA"
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    if (body.confirmation or "").strip().upper() != "CONFERMA":
        raise HTTPException(status_code=400, detail="Conferma mancante: digita 'CONFERMA' per procedere")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")

    settings = await db.settings.find_one({"society_id": sid}) or {}
    season_start_month = int(settings.get("season_start_month") or 7)
    season_start_day = int(settings.get("season_start_day") or 1)
    now = datetime.utcnow()
    if (now.month, now.day) < (season_start_month, season_start_day):
        raise HTTPException(
            status_code=400,
            detail=f"Rollover disponibile solo dal {season_start_day:02d}/{season_start_month:02d}."
        )

    current_season = await get_current_season_for_society(db, sid)
    next_season = _next_season(current_season)

    # 1. Archivia tutto lo storico operativo come stagione precedente
    archive_counts = await _archive_all_current_season_operational(sid, current_season)

    # 2. Snapshot in season_archives (backup navigabile)
    archive_doc = {
        "id": str(datetime.utcnow().timestamp()).replace(".", ""),
        "society_id": sid,
        "season": current_season,
        "archived_at": datetime.utcnow().isoformat(),
        "archived_by": current_user["id"],
        "archived_by_name": current_user.get("full_name", ""),
        "operational_counts": archive_counts,
        "selected_user_ids": body.selected_user_ids,
        "selected_athlete_ids": body.selected_athlete_ids,
    }
    try:
        await db.season_archives.insert_one(archive_doc)
    except Exception:
        pass

    # 3. Per gli utenti selezionati: reset ai soli campi anagrafici + aggiungi next_season
    users_imported = 0
    for uid in body.selected_user_ids:
        try:
            await _reset_user_to_registry_only(uid, sid, next_season)
            users_imported += 1
        except Exception:
            pass

    # 4. Per gli atleti selezionati: reset ai soli campi anagrafici (+ parent/med/qr se minorenne)
    athletes_imported = 0
    from datetime import date as _date
    today = _date.today()

    def _is_minor_date(dob) -> bool:
        if not dob:
            return False
        try:
            if isinstance(dob, str):
                d = datetime.fromisoformat(dob.split("T")[0]).date()
            elif hasattr(dob, "date"):
                d = dob.date()
            else:
                d = dob
            years = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
            return years < 18
        except Exception:
            return False

    for aid in body.selected_athlete_ids:
        try:
            a = await db.athletes.find_one({"id": aid, "society_id": sid}, {"_id": 0, "birth_date": 1, "date_of_birth": 1})
            if not a:
                continue
            is_minor = _is_minor_date(a.get("birth_date") or a.get("date_of_birth"))
            await _reset_athlete_to_registry_only(aid, sid, next_season, is_minor)
            athletes_imported += 1
        except Exception:
            pass

    # 5. Aggiorna current_season nelle impostazioni società
    try:
        await db.settings.update_one(
            {"society_id": sid},
            {"$set": {"current_season": next_season, "current_season_updated_at": datetime.utcnow().isoformat()}},
            upsert=True,
        )
    except Exception:
        pass

    # 6. Audit log
    try:
        await db.audit_logs.insert_one({
            "id": str(datetime.utcnow().timestamp()).replace(".", ""),
            "society_id": sid,
            "user_id": current_user["id"],
            "user_name": current_user.get("full_name", ""),
            "action": "season_rollover",
            "from_season": current_season,
            "to_season": next_season,
            "users_imported": users_imported,
            "athletes_imported": athletes_imported,
            "archive_counts": archive_counts,
            "timestamp": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    return {
        "ok": True,
        "from_season": current_season,
        "to_season": next_season,
        "users_imported": users_imported,
        "athletes_imported": athletes_imported,
        "archive_counts": archive_counts,
    }



# ─────────────────────────────────────────────────────────────────────────────
# 🩺 09/07/2026 (v7.15) — Diagnostica & riparazione atleti orfani
# ─────────────────────────────────────────────────────────────────────────────
# Segnalazione utente: "Ci sono vari ragazzi registrati su LA TUA SOCIETA ASD
# ma nessun genitore 😱". Root cause: dopo `import-member` di un minore, il
# genitore restava nella stagione precedente (active_seasons non aggiornato)
# → dashboard admin lo perdeva.
# Fix strutturale: `import-member` ora auto-importa i genitori del minore.
# Per DB già in stato inconsistente forniamo due endpoint admin-only.

def _is_minor(dob_val) -> bool:
    """True se la data di nascita indica un'età < 18 anni."""
    if not dob_val:
        return False
    from datetime import date as _date
    try:
        if isinstance(dob_val, str):
            d = datetime.fromisoformat(dob_val.split("T")[0]).date()
        elif hasattr(dob_val, "date"):
            d = dob_val.date()
        else:
            d = dob_val
        today = _date.today()
        years = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
        return years < 18
    except Exception:
        return False


@router.get("/seasons/orphan-athletes/diagnostic")
async def diagnostic_orphan_athletes(current_user = Depends(get_current_user)):
    """🩺 Diagnostica: elenca atleti MINORI nella stagione corrente che appaiono
    "orfani" nella dashboard admin perché i genitori collegati non sono ancora
    stati importati (active_seasons non contiene la stagione corrente) oppure
    perché il `parent_id`/`second_parent_id` punta a un utente inesistente.
    Non modifica nulla. Solo admin."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")

    current_season = await get_current_season_for_society(db, sid)

    athletes = await db.athletes.find(
        {"society_id": sid, "active_seasons": current_season},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "full_name": 1,
         "date_of_birth": 1, "birth_date": 1,
         "parent_id": 1, "second_parent_id": 1, "team_id": 1, "status": 1,
         "fiscal_code": 1},
    ).to_list(5000)

    orphans_no_parent_ref: list = []       # atleta senza parent_id/second_parent_id
    orphans_missing_parent_user: list = [] # parent_id punta a utente inesistente/non parent
    orphans_parent_prev_season: list = []  # parent user esiste ma non ha current_season

    parent_ids_to_import: set = set()

    for a in athletes:
        dob = a.get("date_of_birth") or a.get("birth_date")
        if not _is_minor(dob):
            continue
        pid = a.get("parent_id")
        sid2 = a.get("second_parent_id")
        if not pid and not sid2:
            orphans_no_parent_ref.append(a)
            continue
        # verifica genitori
        parent_issues: list = []
        for label, _pid in [("parent_id", pid), ("second_parent_id", sid2)]:
            if not _pid:
                continue
            parent_user = await db.users.find_one(
                {"id": _pid, "society_id": sid, "role": "parent"},
                {"_id": 0, "id": 1, "email": 1, "full_name": 1,
                 "active_seasons": 1, "rollover_decision": 1},
            )
            if not parent_user:
                parent_issues.append({"field": label, "id": _pid, "reason": "not_found"})
            else:
                asx = parent_user.get("active_seasons") or []
                if current_season not in asx:
                    parent_issues.append({
                        "field": label,
                        "id": _pid,
                        "email": parent_user.get("email"),
                        "full_name": parent_user.get("full_name"),
                        "active_seasons": asx,
                        "rollover_decision": parent_user.get("rollover_decision"),
                        "reason": "parent_not_in_current_season",
                    })
                    parent_ids_to_import.add(_pid)
        if parent_issues:
            # classifica: se almeno un genitore è recuperabile (parent_not_in_current_season)
            recoverable = any(p["reason"] == "parent_not_in_current_season" for p in parent_issues)
            not_found_only = all(p["reason"] == "not_found" for p in parent_issues)
            entry = {
                "athlete_id": a.get("id"),
                "name": f"{a.get('last_name','')} {a.get('first_name','')}".strip() or a.get("full_name",""),
                "date_of_birth": a.get("date_of_birth") or a.get("birth_date"),
                "fiscal_code": a.get("fiscal_code"),
                "parent_issues": parent_issues,
                "recoverable": recoverable,
            }
            if not_found_only:
                orphans_missing_parent_user.append(entry)
            else:
                orphans_parent_prev_season.append(entry)

    return {
        "society_id": sid,
        "current_season": current_season,
        "counts": {
            "athletes_minor_current_season": sum(1 for a in athletes
                if _is_minor(a.get("date_of_birth") or a.get("birth_date"))),
            "orphans_no_parent_reference": len(orphans_no_parent_ref),
            "orphans_missing_parent_user": len(orphans_missing_parent_user),
            "orphans_parent_prev_season": len(orphans_parent_prev_season),
            "parent_users_to_import": len(parent_ids_to_import),
        },
        "orphans_no_parent_reference": [
            {
                "athlete_id": a.get("id"),
                "name": f"{a.get('last_name','')} {a.get('first_name','')}".strip() or a.get("full_name",""),
                "date_of_birth": a.get("date_of_birth") or a.get("birth_date"),
                "fiscal_code": a.get("fiscal_code"),
                "status": a.get("status"),
            }
            for a in orphans_no_parent_ref
        ],
        "orphans_missing_parent_user": orphans_missing_parent_user,
        "orphans_parent_prev_season": orphans_parent_prev_season,
        "parent_ids_to_import": list(parent_ids_to_import),
    }


class RepairOrphanBody(BaseModel):
    confirmation: str = Field(default="")


@router.post("/seasons/orphan-athletes/repair")
async def repair_orphan_athletes(body: RepairOrphanBody, current_user = Depends(get_current_user)):
    """🛠️ Riparazione: aggiunge `current_season` all'`active_seasons` di tutti i
    genitori collegati ad atleti minorenni già importati nella stagione corrente
    ma che sono rimasti nella stagione precedente.
    Richiede `confirmation == "CONFERMA"`. Solo admin."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    if (body.confirmation or "").strip().upper() != "CONFERMA":
        raise HTTPException(status_code=400, detail="Conferma mancante: digita 'CONFERMA'")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")

    current_season = await get_current_season_for_society(db, sid)

    athletes = await db.athletes.find(
        {"society_id": sid, "active_seasons": current_season},
        {"_id": 0, "id": 1, "parent_id": 1, "second_parent_id": 1,
         "date_of_birth": 1, "birth_date": 1},
    ).to_list(5000)

    parent_ids_to_import: set = set()
    for a in athletes:
        dob = a.get("date_of_birth") or a.get("birth_date")
        if not _is_minor(dob):
            continue
        for _pid in [a.get("parent_id"), a.get("second_parent_id")]:
            if not _pid:
                continue
            parent_user = await db.users.find_one(
                {"id": _pid, "society_id": sid, "role": "parent"},
                {"_id": 0, "id": 1, "active_seasons": 1},
            )
            if not parent_user:
                continue
            if current_season not in (parent_user.get("active_seasons") or []):
                parent_ids_to_import.add(_pid)

    imported: list = []
    for pid in parent_ids_to_import:
        pu = await db.users.find_one(
            {"id": pid, "society_id": sid},
            {"_id": 0, "id": 1, "email": 1, "full_name": 1},
        )
        await db.users.update_one(
            {"id": pid, "society_id": sid},
            {"$addToSet": {"active_seasons": current_season},
             "$set": {"rollover_decision": "imported",
                      "rollover_decision_season": current_season,
                      "rollover_decision_at": datetime.utcnow().isoformat(),
                      "rollover_repaired_from_orphan": True}},
        )
        imported.append({"id": pid,
                         "email": (pu or {}).get("email"),
                         "full_name": (pu or {}).get("full_name")})

    try:
        await db.audit_logs.insert_one({
            "id": str(datetime.utcnow().timestamp()).replace(".", ""),
            "society_id": sid,
            "user_id": current_user["id"],
            "user_name": current_user.get("full_name", ""),
            "action": "repair_orphan_athletes",
            "target_kind": "parents",
            "season": current_season,
            "count": len(imported),
            "timestamp": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    return {
        "ok": True,
        "current_season": current_season,
        "parents_imported": imported,
        "count": len(imported),
    }
