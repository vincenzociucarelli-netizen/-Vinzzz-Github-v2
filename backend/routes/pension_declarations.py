"""
🆕 Dichiarazione della posizione previdenziale (lavoro sportivo).

RegistraTEAM raccoglie, fa sottoscrivere e conserva la dichiarazione del
collaboratore sulla propria posizione previdenziale. NON effettua calcoli
contributivi, non applica aliquote, non tocca la gestione soglie €5k/€15k.

Regole:
- La dichiarazione è firmata digitalmente (firma separata dal pregresso) e va
  sottoscritta PRIMA del completamento dell'accettazione dell'accordo.
- Solo il lavoratore può creare nuove versioni. Ogni variazione = NUOVO record
  (append-only) con riferimento alla dichiarazione precedente. Nessuna
  sovrascrittura/cancellazione via API.
- L'admin può solo consultare/esportare. A ogni nuova dichiarazione gli admin
  della società ricevono una notifica in-app.

Collection: `pension_declarations`
"""
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from database import db
from auth_utils import get_current_user
from models.enums import UserRole

router = APIRouter()

# ─────────────────────── Testi canonici (versionati) ───────────────────────
PENSION_TEXT_VERSION = "1.0"

PENSION_OPTIONS: List[Dict[str, Any]] = [
    {
        "code": "A",
        "label": "Sono attualmente iscritto o assicurato presso un'altra forma di previdenza obbligatoria, oltre alla posizione eventualmente derivante dal lavoro sportivo.",
        "short": "Assicurato presso altra previdenza obbligatoria",
        "detail_label": "Tipologia di copertura",
        "detail_choices": ["Lavoro dipendente", "Lavoro autonomo", "Altra gestione previdenziale"],
    },
    {
        "code": "B",
        "label": "Sono titolare di pensione diretta.",
        "short": "Titolare di pensione diretta",
        "detail_label": "Tipologia di pensione",
        "detail_choices": ["Pensione di vecchiaia", "Pensione anticipata", "Pensione di invalidità", "Altra pensione diretta"],
    },
    {
        "code": "C",
        "label": "Non sono attualmente assicurato presso altre forme di previdenza obbligatoria e non sono titolare di pensione diretta.",
        "short": "Nessuna altra previdenza / nessuna pensione",
    },
    {
        "code": "D",
        "label": "Non sono in grado di dichiarare con certezza la mia posizione previdenziale e richiedo una verifica.",
        "short": "Da verificare",
    },
]

PENSION_TEXTS: Dict[str, Any] = {
    "version": PENSION_TEXT_VERSION,
    "title": "Dichiarazione della posizione previdenziale",
    "intro": "Ai fini della corretta gestione amministrativa e previdenziale del mio rapporto di lavoro sportivo, dichiaro la seguente posizione previdenziale.",
    "options": PENSION_OPTIONS,
    "declaration": "Dichiaro che le informazioni fornite sono veritiere e aggiornate. Mi impegno a comunicare tempestivamente alla società eventuali variazioni della mia posizione previdenziale che possano incidere sulla gestione del rapporto di lavoro sportivo.",
}

STATUS_LABEL = {"signed": "Firmata", "to_verify": "Da verificare"}


def _option(code: str) -> Optional[Dict[str, Any]]:
    return next((o for o in PENSION_OPTIONS if o["code"] == code), None)


def _iso(v):
    return v.isoformat() if isinstance(v, datetime) else v


def _public(doc: dict, with_signature: bool = False) -> dict:
    """Serializza una dichiarazione (senza _id; firma solo se richiesto)."""
    out = {k: v for k, v in doc.items() if k not in ("_id", "signature_base64")}
    for k in ("signed_at", "created_at"):
        if k in out:
            out[k] = _iso(out[k])
    out["status_label"] = STATUS_LABEL.get(out.get("status"), out.get("status"))
    if with_signature:
        out["signature_base64"] = doc.get("signature_base64")
    return out


def _ids_query(ids: List[str]) -> dict:
    ids = [i for i in ids if i]
    return {"$or": [{"user_id": {"$in": ids}}, {"athlete_id": {"$in": ids}}]}


async def _history_for(ids: List[str]) -> List[dict]:
    """Storico completo (più recente prima) per utente/atleta collegati."""
    if not [i for i in ids if i]:
        return []
    cur = db.pension_declarations.find(_ids_query(ids)).sort("signed_at", -1)
    return [d async for d in cur]


async def _resolve_subject(current_user: dict) -> dict:
    """Ritorna i dati del soggetto (user + eventuale athlete collegato) con
    il riferimento all'accordo (contratto) corrente."""
    uid = current_user["id"]
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    athlete = None
    athlete_id = (user or {}).get("athlete_id") or current_user.get("athlete_id")
    if athlete_id:
        athlete = await db.athletes.find_one({"id": athlete_id}, {"_id": 0})
    if not user and not athlete:
        athlete = await db.athletes.find_one({"id": uid}, {"_id": 0})
        if athlete:
            athlete_id = uid
    if not user and not athlete:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # L'accordo di riferimento: per atleta PRO i dati contratto stanno su `athletes`,
    # per coach/dirigente/collaboratore su `users`.
    src = athlete if (athlete and athlete.get("is_compensated")) else (user or athlete)
    kind = "athlete" if src is athlete else "user"
    contract_start = _iso(src.get("contract_start_date"))
    contract_end = _iso(src.get("contract_end_date"))
    full_name = (user or {}).get("full_name") or (athlete or {}).get("full_name") or \
        f"{(athlete or {}).get('first_name', '')} {(athlete or {}).get('last_name', '')}".strip()
    return {
        "user_id": uid if user else None,
        "athlete_id": athlete_id,
        "society_id": (user or {}).get("society_id") or (athlete or {}).get("society_id"),
        "full_name": full_name,
        "email": (user or {}).get("email") or (athlete or {}).get("email"),
        "role": (user or {}).get("role") or ("athlete" if athlete else None),
        "agreement_id": f"{kind}:{src.get('id')}:{(contract_start or 'n/d')[:10]}",
        "contract_start_date": contract_start,
        "contract_end_date": contract_end,
        "monthly_compensation": src.get("monthly_compensation"),
        "prior_compensation_amount": src.get("other_annual_compensation"),
        "prior_compensation_signed": bool(src.get("other_annual_compensation_signed")),
    }


async def require_pension_declared(ids: List[str]) -> None:
    """Raise 403 se non esiste ALMENO una dichiarazione previdenziale per il
    soggetto. Da usare prima del completamento dell'accettazione dell'accordo."""
    if not [i for i in ids if i]:
        return
    doc = await db.pension_declarations.find_one(_ids_query(ids), {"_id": 1})
    if not doc:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PENSION_DECLARATION_REQUIRED",
                "message": "Devi sottoscrivere la Dichiarazione della posizione previdenziale prima di completare l'accettazione dell'accordo.",
            },
        )


# ─────────────────────────── Endpoint lavoratore ───────────────────────────
@router.get("/me/pension-declaration/status")
async def my_pension_status(current_user=Depends(get_current_user)):
    subj = await _resolve_subject(current_user)
    history = await _history_for([subj["user_id"], subj["athlete_id"]])
    latest = history[0] if history else None
    return {
        "declared": latest is not None,
        "status": latest.get("status") if latest else None,
        "latest": _public(latest) if latest else None,
        "history": [_public(d) for d in history],
        "texts": PENSION_TEXTS,
        "agreement_id": subj["agreement_id"],
    }


class PensionDeclareRequest(BaseModel):
    position: str = Field(..., pattern="^[ABCD]$", description="Opzione scelta A/B/C/D")
    detail: Optional[str] = Field(None, max_length=120, description="Tipologia copertura (A) o pensione (B)")
    detail_note: Optional[str] = Field(None, max_length=300, description="Precisazione libera facoltativa")
    confirm: bool = Field(..., description="Spunta di conferma del testo dichiarativo")
    signature_base64: str = Field(..., min_length=50, description="Firma digitale (base64 PNG)")
    text_version: Optional[str] = Field(None, description="Versione testo mostrata al firmatario")


@router.post("/me/pension-declaration/declare")
async def declare_my_pension_position(
    data: PensionDeclareRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Crea una NUOVA dichiarazione (append-only). Se ne esiste una precedente
    viene referenziata in `previous_declaration_id` e mai modificata."""
    if current_user.get("role") in ("minor", UserRole.PARENT):
        raise HTTPException(status_code=403, detail="Operazione non consentita per questo profilo")
    if not data.confirm:
        raise HTTPException(status_code=400, detail="Devi confermare il testo della dichiarazione")
    opt = _option(data.position)
    if not opt:
        raise HTTPException(status_code=400, detail="Opzione non valida")
    if data.text_version and data.text_version != PENSION_TEXT_VERSION:
        raise HTTPException(status_code=409, detail="Il testo della dichiarazione è stato aggiornato: ricarica la pagina e ripeti la firma")
    detail = (data.detail or "").strip() or None
    if data.position in ("A", "B") and not detail:
        raise HTTPException(status_code=400, detail=f"Indica la {opt['detail_label'].lower()}")
    if data.position in ("C", "D"):
        detail = None

    subj = await _resolve_subject(current_user)
    history = await _history_for([subj["user_id"], subj["athlete_id"]])
    prev = history[0] if history else None

    client_host = request.client.host if request.client else None
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip_addr = (forwarded_for.split(",")[0].strip() if forwarded_for else client_host) or "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    now = datetime.utcnow()

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": subj["user_id"],
        "athlete_id": subj["athlete_id"],
        "society_id": subj["society_id"],
        "user_full_name": subj["full_name"],
        "user_email": subj["email"],
        "user_role": subj["role"],
        "agreement_id": subj["agreement_id"],
        "contract_start_date": subj["contract_start_date"],
        "contract_end_date": subj["contract_end_date"],
        "monthly_compensation": subj["monthly_compensation"],
        # Snapshot del pregresso al momento della firma (solo informativo)
        "prior_compensation_amount": subj["prior_compensation_amount"],
        "prior_compensation_signed": subj["prior_compensation_signed"],
        # Contenuto dichiarato
        "position": data.position,
        "position_label": opt["label"],
        "position_short": opt["short"],
        "detail": detail,
        "detail_note": (data.detail_note or "").strip() or None,
        "status": "to_verify" if data.position == "D" else "signed",
        # Versionamento
        "version_number": (prev.get("version_number", 0) + 1) if prev else 1,
        "previous_declaration_id": prev.get("id") if prev else None,
        "text_version": PENSION_TEXT_VERSION,
        "text_snapshot": {
            "intro": PENSION_TEXTS["intro"],
            "option": opt["label"],
            "declaration": PENSION_TEXTS["declaration"],
        },
        # Evidenze di sottoscrizione
        "signed_by_user_id": current_user["id"],
        "signed_by_name": current_user.get("full_name") or subj["full_name"],
        "signed_at": now,
        "created_at": now,
        "ip": ip_addr,
        "user_agent": user_agent,
        "signature_base64": data.signature_base64,
    }
    await db.pension_declarations.insert_one(doc)

    # Notifica in-app agli admin della società (bacheca notifiche admin)
    try:
        if subj["society_id"]:
            admins = db.users.find({"role": UserRole.ADMIN, "society_id": subj["society_id"]}, {"_id": 0, "id": 1})
            async for adm in admins:
                await db.admin_notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "society_id": subj["society_id"],
                    "admin_id": adm["id"],
                    "type": "pension_declaration",
                    "title": "Nuova dichiarazione previdenziale",
                    "message": f"{subj['full_name']} ha sottoscritto la dichiarazione della posizione previdenziale "
                               f"(v.{doc['version_number']} — {opt['short']}). Disponibile per il consulente del lavoro.",
                    "read": False,
                    "created_at": now.isoformat(),
                    "entity_type": "pension_declaration",
                    "entity_id": doc["id"],
                    "data": {
                        "declaration_id": doc["id"],
                        "user_id": subj["user_id"],
                        "athlete_id": subj["athlete_id"],
                        "status": doc["status"],
                        "route": "/admin/pension-declarations",
                    },
                })
    except Exception as e:  # la notifica non deve mai bloccare la firma
        logging.warning(f"[pension_declaration] notify admins failed: {e}")

    return {"success": True, "declaration": _public(doc)}


# ───────────────────────────── Endpoint admin ─────────────────────────────
def _require_admin(current_user: dict):
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")


async def _linked_ids(user_id: str) -> List[str]:
    """user_id può essere un id `users` o `athletes`: ritorna entrambi se collegati."""
    ids = [user_id]
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "athlete_id": 1})
    if u and u.get("athlete_id"):
        ids.append(u["athlete_id"])
    else:
        lu = await db.users.find_one({"athlete_id": user_id}, {"_id": 0, "id": 1})
        if lu:
            ids.append(lu["id"])
    return ids


@router.get("/admin/users/{user_id}/pension-declarations")
async def admin_get_pension_declarations(user_id: str, current_user=Depends(get_current_user)):
    """Admin: ultima dichiarazione + storico completo (con firme) di un utente/atleta."""
    _require_admin(current_user)
    ids = await _linked_ids(user_id)
    history = await _history_for(ids)
    sid = current_user.get("society_id")
    if sid:
        history = [d for d in history if not d.get("society_id") or d.get("society_id") == sid]
    return {
        "declared": bool(history),
        "latest": _public(history[0], with_signature=True) if history else None,
        "history": [_public(d, with_signature=True) for d in history],
        "texts": PENSION_TEXTS,
    }


@router.get("/admin/pension-declarations/summary")
async def admin_pension_declarations_summary(current_user=Depends(get_current_user)):
    """Admin: riepilogo per il consulente del lavoro — tutti i collaboratori
    (coach/dirigenti/collaboratori/atleti PRO) con pregresso + posizione
    previdenziale dichiarata (ultima versione) + storico completo."""
    _require_admin(current_user)
    sid = current_user.get("society_id")

    rows: List[dict] = []
    q_users: dict = {"role": {"$in": [UserRole.COACH, UserRole.DIRIGENTE, UserRole.VIEWER, UserRole.COLLABORATORE]}}
    if sid:
        q_users["society_id"] = sid
    proj = {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1, "athlete_id": 1,
            "monthly_compensation": 1, "compensation_accepted": 1, "contract_start_date": 1,
            "other_annual_compensation": 1, "other_annual_compensation_signed": 1,
            "other_annual_compensation_signed_at": 1, "other_annual_compensation_signed_year": 1}
    seen_athletes = set()
    async for u in db.users.find(q_users, proj):
        rows.append({"ids": [u["id"], u.get("athlete_id")], "src": u, "role": u.get("role")})
        if u.get("athlete_id"):
            seen_athletes.add(u["athlete_id"])

    q_ath: dict = {"is_compensated": True}
    if sid:
        q_ath["society_id"] = sid
    proj_a = {**proj, "first_name": 1, "last_name": 1}
    async for a in db.athletes.find(q_ath, proj_a):
        if a["id"] in seen_athletes:
            continue
        lu = await db.users.find_one({"athlete_id": a["id"]}, {"_id": 0, "id": 1, "email": 1})
        rows.append({"ids": [a["id"], (lu or {}).get("id")], "src": {**a, "email": a.get("email") or (lu or {}).get("email")}, "role": "atleta_pro"})

    out = []
    for r in rows:
        src = r["src"]
        history = await _history_for(r["ids"])
        latest = history[0] if history else None
        name = src.get("full_name") or f"{src.get('first_name', '')} {src.get('last_name', '')}".strip()
        out.append({
            "user_id": src["id"],
            "full_name": name,
            "email": src.get("email"),
            "role": r["role"],
            "monthly_compensation": src.get("monthly_compensation") or 0,
            "compensation_accepted": bool(src.get("compensation_accepted")),
            "contract_start_date": _iso(src.get("contract_start_date")),
            "prior_compensation_amount": float(src.get("other_annual_compensation") or 0),
            "prior_compensation_signed": bool(src.get("other_annual_compensation_signed")),
            "prior_compensation_signed_at": _iso(src.get("other_annual_compensation_signed_at")),
            "prior_compensation_signed_year": src.get("other_annual_compensation_signed_year"),
            "pension_status": latest.get("status") if latest else "not_declared",
            "pension_status_label": STATUS_LABEL.get(latest.get("status"), "") if latest else "Non dichiarata",
            "pension_latest": _public(latest) if latest else None,
            "pension_history": [_public(d) for d in history],
            "pension_versions": len(history),
        })
    out.sort(key=lambda x: (x["full_name"] or "").lower())
    return {"rows": out, "texts": PENSION_TEXTS, "generated_at": datetime.utcnow().isoformat()}
