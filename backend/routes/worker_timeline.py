"""
🆕 Cronologia personale per coach / dirigenti / collaboratori (GET /me/timeline).
Stessa forma della cronologia atleta (`/athletes/{id}/timeline`) così il
frontend riusa la stessa schermata. Eventi: registrazione, privacy, accordo
compenso accettato, documenti firmati (quietanze, dichiarazioni previdenziali,
pregresso, comunicazioni soglia), variazioni pregresso.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from database import db
from auth_utils import get_current_user

router = APIRouter()

DOC_LABELS = {
    "privacy_consent": "Consenso Privacy",
    "gdpr_adult": "Privacy e GDPR",
    "gdpr_privacy_adult": "Privacy e GDPR",
    "trial_consent": "Consenso Prova",
    "membership_agreement": "Accordo Tesseramento",
    "pension_declaration": "Dichiarazione Posizione Previdenziale",
    "prior_compensation_declaration": "Dichiarazione Compensi Pregressi",
    "compensation_receipt": "Quietanza Compenso",
    "coach_compensation_receipt": "Quietanza Compenso",
    "collaboratore_compensation_receipt": "Quietanza Compenso",
    "threshold_5000_communication": "Comunicazione Superamento €5.000",
    "threshold_15000_communication": "Comunicazione Superamento €15.000",
}
WORK_DOCS = {"pension_declaration", "prior_compensation_declaration", "compensation_receipt",
             "coach_compensation_receipt", "collaboratore_compensation_receipt",
             "threshold_5000_communication", "threshold_15000_communication"}


def _iso(v) -> str:
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v) if v else ""


def _eur(n) -> str:
    return "€ " + f"{float(n or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


@router.get("/me/timeline")
async def my_timeline(current_user=Depends(get_current_user)):
    uid = current_user["id"]
    user = await db.users.find_one({"id": uid}, {"_id": 0}) or {}
    events = []

    if user.get("created_at"):
        events.append({"type": "registration", "icon": "person-add", "color": "#007AFF", "title": "Registrazione",
                       "description": f"Account creato come {user.get('role', '')}", "date": _iso(user["created_at"])})

    priv = (user.get("consents") or {}).get("privacy_viewed") or {}
    priv_date = priv.get("timestamp") or priv.get("date") if isinstance(priv, dict) else None
    priv_date = priv_date or user.get("privacy_accepted_date")
    if priv_date:
        events.append({"type": "privacy_accepted", "icon": "shield-checkmark", "color": "#34C759", "title": "Privacy e GDPR Firmati",
                       "description": "Consenso privacy e GDPR accettati", "date": _iso(priv_date)})

    if user.get("compensation_accepted") and user.get("compensation_accepted_date"):
        desc = "Compenso mensile accettato"
        if user.get("monthly_compensation"):
            desc += f" ({_eur(user['monthly_compensation'])}/mese)"
        events.append({"type": "compensation_accepted", "icon": "checkmark-circle", "color": "#1D6F42", "title": "Accordo Compenso Accettato",
                       "description": desc, "date": _iso(user["compensation_accepted_date"])})
    elif user.get("compensation_reaccept_reason") and user.get("monthly_compensation"):
        events.append({"type": "compensation_reaccept", "icon": "alert-circle", "color": "#FF9500", "title": "Accordo da ri-accettare",
                       "description": user["compensation_reaccept_reason"], "date": _iso(user.get("updated_at") or datetime.now(timezone.utc))})

    # Variazioni pregresso (storico sostituito dal lavoratore)
    for h in user.get("other_annual_compensation_user_history") or []:
        if h.get("replaced_at"):
            events.append({"type": "prior_variation", "icon": "swap-horizontal", "color": "#FF9500", "title": "Variazione Pregresso",
                           "description": f"Dichiarazione precedente ({_eur(h.get('amount'))}) sostituita da una nuova dichiarazione firmata",
                           "date": _iso(h["replaced_at"])})

    # Documenti firmati
    ids = [uid]
    if user.get("athlete_id"):
        ids.append(user["athlete_id"])
    q = {"$or": [{"signer_id": {"$in": ids}}, {"coach_id": uid}, {"dirigente_id": uid}, {"collaboratore_id": uid}, {"athlete_id": {"$in": ids}}]}
    async for d in db.signed_documents.find(q, {"_id": 0, "document_type": 1, "document_title": 1, "signed_at": 1, "month": 1, "year": 1, "amount_gross": 1, "pension_status": 1}).sort("signed_at", 1):
        dt = d.get("document_type", "")
        label = d.get("document_title") if (dt in WORK_DOCS and d.get("document_title")) else DOC_LABELS.get(dt, dt or "Documento")
        detail: Optional[str] = None
        if dt.endswith("compensation_receipt") and d.get("amount_gross"):
            detail = f"Importo lordo: {_eur(d['amount_gross'])}"
        if dt == "pension_declaration" and d.get("pension_status") == "to_verify":
            detail = "Posizione: Da verificare"
        events.append({
            "type": "document_signed",
            "icon": "shield-checkmark" if dt == "pension_declaration" else ("cash" if dt in WORK_DOCS else "create"),
            "color": "#6D28D9" if dt == "pension_declaration" else ("#1D6F42" if dt in WORK_DOCS else "#5856D6"),
            "title": f"Firmato: {label}",
            "description": "Documento firmato digitalmente",
            "date": _iso(d.get("signed_at")),
            "detail": detail,
        })

    def _key(e):
        s = e.get("date") or ""
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return datetime.min
    events.sort(key=_key, reverse=True)
    return {"athlete_name": user.get("full_name", ""), "athlete_status": user.get("role", ""), "events": events}
