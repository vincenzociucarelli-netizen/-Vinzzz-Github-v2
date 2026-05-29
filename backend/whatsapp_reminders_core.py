"""
Sistema Solleciti WhatsApp
==========================
Permette ad admin (e coach per le proprie squadre) di vedere casi pendenti
che richiedono azione da parte di genitori/atleti/coach/dirigenti e di
inviare un sollecito tramite WhatsApp (URL wa.me, no API a pagamento).

Casi tracciati:
  a) trial_start_unsigned    — Firma inizio prova mancante
  b) trial_end_no_certificate — Trial scaduto + certificato medico mancante
  c) trial_end_no_privacy    — Trial scaduto + privacy non firmata
  d) trial_end_no_decision   — Trial scaduto + nessuna decisione (restare/andarsene)
  e) unsigned_receipt        — Quietanza coach/dirigente/collaboratore non firmata
  f) certificate_expiring    — Certificato medico in scadenza/scaduto

Storico: collection `whatsapp_reminders` con log invii.
Impostazioni: collection `settings` documento type=whatsapp_reminders_config.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
import os
import uuid
import re
from motor.motor_asyncio import AsyncIOMotorClient

# DB setup (reuse global)
_mongo_url = os.environ['MONGO_URL']
_client = AsyncIOMotorClient(_mongo_url)
_db = _client[os.environ['DB_NAME']]

router = APIRouter(prefix="/admin/whatsapp", tags=["whatsapp-reminders"])


# ─────────────────────────── Default settings ───────────────────────────

DEFAULT_TEMPLATES = {
    "trial_start_unsigned": {
        "label": "Firma inizio periodo di prova",
        "threshold_days": 2,
        "template": (
            "Ciao, ti ricordo di firmare il documento di inizio periodo di prova "
            "di {atleta} su RegistraTEAM. Senza firma {atleta} non può iniziare gli allenamenti. "
            "Accedi qui: {link}"
        ),
    },
    "trial_end_no_certificate": {
        "label": "Fine prova — certificato medico mancante",
        "threshold_days": 1,
        "template": (
            "Ciao, il periodo di prova di {atleta} è terminato il {data}. "
            "Per continuare gli allenamenti è OBBLIGATORIO caricare il certificato medico "
            "e consegnarne copia alla società. Accedi qui: {link}"
        ),
    },
    "trial_end_no_privacy": {
        "label": "Fine prova — privacy non firmata",
        "threshold_days": 1,
        "template": (
            "Ciao, per completare l'iscrizione di {atleta} mancano i documenti "
            "privacy/GDPR. Senza firma {atleta} non può accedere agli allenamenti. "
            "Accedi qui: {link}"
        ),
    },
    "trial_end_no_decision": {
        "label": "Fine prova — nessuna decisione",
        "threshold_days": 3,
        "template": (
            "Ciao, il periodo di prova di {atleta} è terminato il {data}. "
            "Ci farebbe piacere sapere se vuole continuare. Se invece desideri ritirare "
            "l'iscrizione, ricordati di richiedere la cancellazione dei dati. "
            "Accedi qui: {link}"
        ),
    },
    "unsigned_receipt": {
        "label": "Quietanza compenso non firmata",
        "threshold_days": 5,
        "template": (
            "Ciao, ti ricordo di firmare la quietanza del compenso "
            "di {data} su RegistraTEAM. Accedi qui: {link}"
        ),
    },
    "certificate_expiring": {
        "label": "Certificato medico in scadenza/scaduto",
        "threshold_days": 14,
        "template": (
            "Ciao, il certificato medico di {atleta} scade il {data}. "
            "Carica al più presto il nuovo certificato per non interrompere gli allenamenti. "
            "Accedi qui: {link}"
        ),
    },
}


# ─────────────────────────── Models ───────────────────────────

class CaseSetting(BaseModel):
    label: str
    threshold_days: int
    template: str


class WhatsAppReminderSettings(BaseModel):
    settings: Dict[str, CaseSetting]


class ReminderLogIn(BaseModel):
    case: str
    target_user_id: Optional[str] = None
    target_athlete_id: Optional[str] = None
    target_phone: str
    message_sent: str


# ─────────────────────────── Helpers ───────────────────────────

def _normalize_phone(phone: Optional[str]) -> Optional[str]:
    """Normalize phone to E.164-like wa.me compatible (digits only with country prefix).
    Defaults to Italy (+39) if no prefix detected.
    """
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) <= 11:
        # Italian local number without prefix → prepend 39
        digits = "39" + digits.lstrip("0")
    elif not (digits.startswith("39") or digits.startswith("1") or len(digits) > 11):
        # 9-10 digit number without prefix → assume Italy
        if len(digits) in (9, 10):
            digits = "39" + digits
    return digits


def _link_app() -> str:
    return os.environ.get("FRONTEND_URL", "https://registrateam.it")


async def _get_settings(society_id: Optional[str]) -> Dict[str, Dict[str, Any]]:
    """Load society-specific WhatsApp template settings (with defaults fallback)."""
    q = {"type": "whatsapp_reminders_config"}
    if society_id:
        q["society_id"] = society_id
    doc = await _db.settings.find_one(q)
    saved = (doc or {}).get("settings") or {}
    out = {}
    for key, default in DEFAULT_TEMPLATES.items():
        item = saved.get(key) or {}
        out[key] = {
            "label": item.get("label") or default["label"],
            "threshold_days": item.get("threshold_days", default["threshold_days"]),
            "template": item.get("template") or default["template"],
        }
    return out


async def _get_society_team_ids(society_id: Optional[str]) -> Optional[List[str]]:
    if not society_id:
        return None
    return [t["id"] async for t in _db.teams.find({"society_id": society_id}, {"_id": 0, "id": 1})]


async def _get_athlete_parent_phones(athlete: Dict[str, Any], user_phone_cache: Optional[Dict[str, Dict[str, str]]] = None) -> List[Dict[str, str]]:
    """Return list of {name, phone, role} for the contact persons of an athlete.

    Args:
        athlete: athlete document
        user_phone_cache: optional pre-fetched dict {user_id: {full_name, phone}} to avoid N+1 queries.
                         If None, falls back to per-call db.users.find_one (slower).
    """
    contacts: List[Dict[str, str]] = []
    seen_phones = set()

    def _add(name: str, phone: Optional[str], role: str):
        if not phone:
            return
        norm = _normalize_phone(phone)
        if not norm or norm in seen_phones:
            return
        seen_phones.add(norm)
        contacts.append({"name": (name or role).strip(), "phone": phone, "role": role})

    def _lookup_user(uid: Optional[str]) -> Optional[Dict[str, str]]:
        if not uid:
            return None
        if user_phone_cache is not None:
            return user_phone_cache.get(uid)
        return None  # No cache → caller must rely on athlete fields

    is_adult = bool(athlete.get("is_adult")) or athlete.get("parents_detached") is True

    if is_adult:
        _add(
            athlete.get("first_name") or athlete.get("full_name") or "atleta",
            athlete.get("phone") or athlete.get("parent_phone"),
            "atleta",
        )
        u = _lookup_user(athlete.get("user_id") or athlete.get("athlete_user_id"))
        if u and u.get("phone"):
            _add(u.get("full_name") or "atleta", u["phone"], "atleta")
        return contacts

    # Minor: phones from athlete record
    mother_name = athlete.get("mother_full_name") or athlete.get("parent_mother_name") or "Madre"
    father_name = athlete.get("father_full_name") or athlete.get("parent_father_name") or "Padre"
    primary_parent_name = athlete.get("parent_name") or athlete.get("parent_full_name") or ""
    primary_phone = athlete.get("parent_phone")
    phone_mother = athlete.get("phone_mother")
    phone_father = athlete.get("phone_father")

    if phone_mother:
        _add(
            primary_parent_name if primary_phone and _normalize_phone(primary_phone) == _normalize_phone(phone_mother) else mother_name,
            phone_mother,
            "madre",
        )
    if phone_father:
        _add(
            primary_parent_name if primary_phone and _normalize_phone(primary_phone) == _normalize_phone(phone_father) else father_name,
            phone_father,
            "padre",
        )

    if not contacts and primary_phone:
        _add(primary_parent_name or "genitore", primary_phone, "genitore")

    if not contacts:
        pu = _lookup_user(athlete.get("parent_id"))
        if pu and pu.get("phone"):
            _add(pu.get("full_name") or "genitore", pu["phone"], "genitore")

    sp = athlete.get("second_parent")
    if isinstance(sp, dict) and sp.get("phone"):
        _add(sp.get("full_name") or "genitore 2", sp["phone"], "genitore")

    return contacts


def _last_reminder_for(reminders_log: List[Dict[str, Any]], case: str, athlete_id: Optional[str], user_id: Optional[str]):
    """Find most recent matching reminder."""
    candidates = []
    for r in reminders_log:
        if r.get("case") != case:
            continue
        if athlete_id and r.get("target_athlete_id") == athlete_id:
            candidates.append(r)
        elif user_id and r.get("target_user_id") == user_id:
            candidates.append(r)
    if not candidates:
        return None
    return max(candidates, key=lambda x: x.get("sent_at") or datetime.min.replace(tzinfo=timezone.utc))


def _render_template(template: str, **kwargs) -> str:
    out = template
    for k, v in kwargs.items():
        out = out.replace("{" + k + "}", str(v or ""))
    return out


# ─────────────────────────── Endpoints ───────────────────────────

@router.get("/settings")
async def get_settings(current_user=Depends(lambda: None)):
    # We can't import get_current_user without circular ref; use a thin wrapper
    raise HTTPException(status_code=500, detail="use server.py wrapper")


# NOTE: actual auth-protected endpoints registered via server.py below
