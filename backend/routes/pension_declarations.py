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


async def _person_ids(*seed_ids: Optional[str]) -> List[str]:
    """🆕 Tutti gli id (users + athletes) della STESSA persona: account atleta,
    record athletes, account coach/dirigente/collaboratore dual-role (alias
    `email#coach` / stesso CF). La posizione previdenziale è una per persona."""
    from server import _get_linked_prior_comp_docs  # lazy: evita import circolare
    ids = set()
    for sid in seed_ids:
        if not sid or sid in ids:
            continue
        ids.add(sid)
        for doc, _ in await _get_linked_prior_comp_docs(sid):
            ids.add(doc["id"])
            for k in ("athlete_id", "user_id", "linked_user_id"):
                if doc.get(k):
                    ids.add(doc[k])
    return [i for i in ids if i]


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
    ids = await _person_ids(*ids)
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
    history = await _history_for(await _person_ids(subj["user_id"], subj["athlete_id"]))
    latest = history[0] if history else None
    return {
        "declared": latest is not None,
        "status": latest.get("status") if latest else None,
        "latest": _public(latest) if latest else None,
        "history": [_public(d) for d in history],
        "texts": PENSION_TEXTS,
        "agreement_id": subj["agreement_id"],
        # 🆕 True se la dichiarazione è stata firmata dall'altro account dual-role
        "declared_by_linked_account": bool(latest) and latest.get("user_id") != subj["user_id"] and latest.get("athlete_id") != subj["athlete_id"],
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
    history = await _history_for(await _person_ids(subj["user_id"], subj["athlete_id"]))
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

    # 🆕 PDF firmato in `signed_documents` → visibile in "I Miei Documenti", archivio admin e Cronologia
    try:
        from routes.declaration_pdf import build_declaration_pdf, store_signed_declaration, society_name_for
        society_name = await society_name_for(subj["society_id"])
        paragraphs = [
            {"text": f"Il/La sottoscritto/a {subj['full_name']}", "style": "normal"},
            {"text": PENSION_TEXTS["intro"], "style": "normal"},
            {"text": f"Opzione selezionata: {data.position}", "style": "bold"},
            {"text": opt["label"], "style": "normal"},
        ]
        if detail:
            paragraphs.append({"text": f"{opt.get('detail_label', 'Tipologia')}: {detail}" + (f" — {doc['detail_note']}" if doc.get("detail_note") else ""), "style": "normal"})
        if data.position == "D":
            paragraphs.append({"text": "Posizione registrata come «Da verificare».", "style": "bold"})
        paragraphs.append({"text": PENSION_TEXTS["declaration"], "style": "normal"})
        meta = {
            "Versione dichiarazione": f"{doc['version_number']}" + (f" (sostituisce {prev['id']})" if prev else ""),
            "Versione testo": PENSION_TEXT_VERSION,
            "Identificativo accordo": subj["agreement_id"],
            "Identificativo dichiarazione": doc["id"],
            "Data/ora": now.strftime("%d/%m/%Y %H:%M:%S UTC"),
            "Indirizzo IP": ip_addr,
            "Dispositivo": user_agent[:90],
        }
        pdf = build_declaration_pdf(
            title=f"Dichiarazione della posizione previdenziale — v.{doc['version_number']}",
            society_name=society_name, signer_name=subj["full_name"], paragraphs=paragraphs, meta=meta,
            signature_base64=data.signature_base64, signed_at=now,
        )
        sd_id = await store_signed_declaration(
            document_type="pension_declaration",
            document_title=f"Dichiarazione Posizione Previdenziale v.{doc['version_number']}",
            pdf_bytes=pdf, signer_id=subj["user_id"] or current_user["id"], signer_name=subj["full_name"],
            signer_email=subj["email"], athlete_id=subj["athlete_id"], society_id=subj["society_id"],
            signed_at=now, signature_base64=data.signature_base64,
            extra={"pension_declaration_id": doc["id"], "pension_status": doc["status"], "version_number": doc["version_number"]},
        )
        await db.pension_declarations.update_one({"id": doc["id"]}, {"$set": {"signed_document_id": sd_id}})
        doc["signed_document_id"] = sd_id
    except Exception as e:
        logging.warning(f"[pension_declaration] PDF non generato: {e}")

    # Notifica in-app alla bacheca admin della società (UNA sola per società:
    # la lista notifiche admin è filtrata per society_id, non per singolo admin)
    try:
        if subj["society_id"]:
            first_admin = await db.users.find_one({"role": UserRole.ADMIN, "society_id": subj["society_id"]}, {"_id": 0, "id": 1})
            await db.admin_notifications.insert_one({
                "id": str(uuid.uuid4()),
                "society_id": subj["society_id"],
                "admin_id": (first_admin or {}).get("id"),
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
    """user_id può essere un id `users` o `athletes`: ritorna tutti gli id della
    stessa persona (incluso l'account dual-role)."""
    return await _person_ids(user_id)


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


async def _dedupe_pension_notifications(sid: Optional[str]) -> int:
    """🧹 Rimuove le notifiche duplicate create (una per admin) prima del fix:
    per ogni dichiarazione resta una sola notifica per società."""
    q: dict = {"type": "pension_declaration"}
    if sid:
        q["society_id"] = sid
    seen = set()
    to_delete = []
    async for n in db.admin_notifications.find(q, {"_id": 0, "id": 1, "entity_id": 1, "society_id": 1, "created_at": 1}).sort("created_at", 1):
        key = (n.get("society_id"), n.get("entity_id"))
        if not n.get("entity_id"):
            continue
        if key in seen:
            to_delete.append(n["id"])
        else:
            seen.add(key)
    if to_delete:
        await db.admin_notifications.delete_many({"id": {"$in": to_delete}})
    return len(to_delete)


async def _backfill_missing_documents(sid: Optional[str]) -> int:
    """🆕 Genera a posteriori i PDF in `signed_documents` per le dichiarazioni
    (previdenziali e pregresso) firmate PRIMA dell'introduzione dei PDF.
    Idempotente: lavora solo sui record senza documento collegato."""
    from routes.declaration_pdf import build_declaration_pdf, store_signed_declaration, society_name_for
    created = 0
    society_name = await society_name_for(sid)

    # 1) Dichiarazioni previdenziali senza signed_document_id
    q: dict = {"signed_document_id": {"$exists": False}}
    if sid:
        q["society_id"] = sid
    async for d in db.pension_declarations.find(q):
        try:
            opt = _option(d.get("position")) or {}
            paragraphs = [
                {"text": f"Il/La sottoscritto/a {d.get('user_full_name', '')}", "style": "normal"},
                {"text": (d.get("text_snapshot") or {}).get("intro") or PENSION_TEXTS["intro"], "style": "normal"},
                {"text": f"Opzione selezionata: {d.get('position')}", "style": "bold"},
                {"text": d.get("position_label", ""), "style": "normal"},
            ]
            if d.get("detail"):
                paragraphs.append({"text": f"{opt.get('detail_label', 'Tipologia')}: {d['detail']}" + (f" — {d['detail_note']}" if d.get("detail_note") else ""), "style": "normal"})
            if d.get("position") == "D":
                paragraphs.append({"text": "Posizione registrata come «Da verificare».", "style": "bold"})
            paragraphs.append({"text": (d.get("text_snapshot") or {}).get("declaration") or PENSION_TEXTS["declaration"], "style": "normal"})
            signed_at = d.get("signed_at") if isinstance(d.get("signed_at"), datetime) else datetime.utcnow()
            meta = {
                "Versione dichiarazione": str(d.get("version_number", 1)),
                "Versione testo": d.get("text_version", PENSION_TEXT_VERSION),
                "Identificativo accordo": d.get("agreement_id", ""),
                "Identificativo dichiarazione": d.get("id", ""),
                "Data/ora": signed_at.strftime("%d/%m/%Y %H:%M:%S UTC"),
                "Indirizzo IP": d.get("ip", ""),
                "Dispositivo": (d.get("user_agent") or "")[:90],
            }
            pdf = build_declaration_pdf(
                title=f"Dichiarazione della posizione previdenziale — v.{d.get('version_number', 1)}",
                society_name=society_name, signer_name=d.get("user_full_name", ""), paragraphs=paragraphs, meta=meta,
                signature_base64=d.get("signature_base64"), signed_at=signed_at,
            )
            sd_id = await store_signed_declaration(
                document_type="pension_declaration",
                document_title=f"Dichiarazione Posizione Previdenziale v.{d.get('version_number', 1)}",
                pdf_bytes=pdf, signer_id=d.get("user_id") or d.get("signed_by_user_id"), signer_name=d.get("user_full_name", ""),
                signer_email=d.get("user_email"), athlete_id=d.get("athlete_id"), society_id=d.get("society_id"),
                signed_at=signed_at, signature_base64=d.get("signature_base64"),
                extra={"pension_declaration_id": d["id"], "pension_status": d.get("status"), "version_number": d.get("version_number", 1)},
            )
            await db.pension_declarations.update_one({"id": d["id"]}, {"$set": {"signed_document_id": sd_id}})
            created += 1
        except Exception as e:
            logging.warning(f"[pension backfill] {d.get('id')}: {e}")

    # 2) Pregresso firmato senza documento (users + athletes)
    for coll, is_athlete in ((db.users, False), (db.athletes, True)):
        qq: dict = {"other_annual_compensation_signed": True, "other_annual_compensation_signature": {"$exists": True, "$ne": None}}
        if sid:
            qq["society_id"] = sid
        async for src in coll.find(qq, {"_id": 0, "id": 1, "full_name": 1, "first_name": 1, "last_name": 1, "email": 1, "athlete_id": 1,
                                        "society_id": 1, "other_annual_compensation": 1, "other_annual_compensation_signed_at": 1,
                                        "other_annual_compensation_signed_year": 1, "other_annual_compensation_signature": 1,
                                        "other_annual_compensation_ip": 1, "other_annual_compensation_user_agent": 1}):
            try:
                year = src.get("other_annual_compensation_signed_year")
                signed_at = src.get("other_annual_compensation_signed_at")
                if not isinstance(signed_at, datetime):
                    continue
                athlete_id = src["id"] if is_athlete else src.get("athlete_id")
                user_id = None if is_athlete else src["id"]
                if is_athlete:
                    lu = await db.users.find_one({"athlete_id": src["id"]}, {"_id": 0, "id": 1})
                    user_id = (lu or {}).get("id")
                ids = [i for i in (user_id, athlete_id) if i]
                exists = await db.signed_documents.find_one({
                    "document_type": "prior_compensation_declaration", "fiscal_year": year,
                    "$or": [{"signer_id": {"$in": ids}}, {"athlete_id": {"$in": ids}}],
                }, {"_id": 1})
                if exists:
                    continue
                name = src.get("full_name") or f"{src.get('first_name', '')} {src.get('last_name', '')}".strip()
                amount = float(src.get("other_annual_compensation") or 0)
                amount_str = "€ " + f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                paragraphs = [
                    {"text": f"Il/La sottoscritto/a {name}, consapevole delle responsabilità penali previste dall'art. 76 del D.P.R. 445/2000 in caso di dichiarazioni mendaci,", "style": "normal"},
                    {"text": "DICHIARA", "style": "title"},
                    {"text": f"sotto la propria responsabilità, ai fini del calcolo delle soglie previste dalla Riforma dello Sport (D.Lgs. 36/2021), di aver percepito da altre ASD/SSD (diverse da quella cui presenta questa dichiarazione), per l'anno fiscale {year}, compensi per lavoro sportivo pari a:", "style": "normal"},
                    {"text": amount_str, "style": "title"},
                    {"text": "Si impegna a comunicare tempestivamente alla società ogni variazione dei compensi percepiti da altre società sportive.", "style": "normal"},
                ]
                meta = {"Anno fiscale": str(year), "Data/ora": signed_at.strftime("%d/%m/%Y %H:%M:%S UTC"),
                        "Indirizzo IP": src.get("other_annual_compensation_ip") or "", "Dispositivo": (src.get("other_annual_compensation_user_agent") or "")[:90]}
                pdf = build_declaration_pdf(title=f"Dichiarazione compensi pregressi {year}", society_name=society_name, signer_name=name,
                                            paragraphs=paragraphs, meta=meta, signature_base64=src.get("other_annual_compensation_signature"), signed_at=signed_at)
                await store_signed_declaration(
                    document_type="prior_compensation_declaration", document_title=f"Dichiarazione Pregresso {year}",
                    pdf_bytes=pdf, signer_id=user_id or src["id"], signer_name=name, signer_email=src.get("email"),
                    athlete_id=athlete_id, society_id=src.get("society_id"), signed_at=signed_at,
                    signature_base64=src.get("other_annual_compensation_signature"),
                    extra={"amount": amount, "fiscal_year": year, "version_number": 1},
                )
                created += 1
            except Exception as e:
                logging.warning(f"[prior backfill] {src.get('id')}: {e}")
    return created


@router.post("/admin/pension-declarations/backfill-documents")
async def admin_backfill_declaration_documents(current_user=Depends(get_current_user)):
    """Admin: genera i PDF mancanti per dichiarazioni firmate prima dell'introduzione dei documenti."""
    _require_admin(current_user)
    n = await _backfill_missing_documents(current_user.get("society_id"))
    return {"success": True, "created": n}


@router.get("/admin/pension-declarations/summary")
async def admin_pension_declarations_summary(current_user=Depends(get_current_user)):
    """Admin: riepilogo per il consulente del lavoro — tutti i collaboratori
    (coach/dirigenti/collaboratori/atleti PRO) con pregresso + posizione
    previdenziale dichiarata (ultima versione) + storico completo."""
    _require_admin(current_user)
    sid = current_user.get("society_id")
    # 🆕 backfill silenzioso dei PDF mancanti (idempotente, veloce se non c'è nulla da fare)
    try:
        await _backfill_missing_documents(sid)
        await _dedupe_pension_notifications(sid)
    except Exception as e:
        logging.warning(f"[pension summary] backfill: {e}")

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

    # 🆕 Dual-role: una sola riga per PERSONA (Atleta PRO + Coach/Dirigente/Collaboratore).
    # Le righe i cui id collegati si intersecano vengono unite; il pregresso mostrato è
    # quello firmato (se presente su uno qualsiasi dei record collegati).
    for r in rows:
        r["ids"] = set(await _person_ids(*[i for i in r["ids"] if i]))
    merged: List[dict] = []
    for r in rows:
        target = next((m for m in merged if m["ids"] & r["ids"]), None)
        if target is None:
            merged.append({"ids": set(r["ids"]), "parts": [r]})
        else:
            target["ids"] |= r["ids"]
            target["parts"].append(r)

    def _prior_src(parts: List[dict]) -> dict:
        srcs = [p["src"] for p in parts]
        for s in srcs:
            if s.get("other_annual_compensation_signed"):
                return s
        return srcs[0]

    out = []
    for m in merged:
        parts = m["parts"]
        src = parts[0]["src"]
        roles = []
        for p in parts:
            if p["role"] not in roles:
                roles.append(p["role"])
        prior = _prior_src(parts)
        history = await _history_for(list(m["ids"]))
        latest = history[0] if history else None
        name = src.get("full_name") or f"{src.get('first_name', '')} {src.get('last_name', '')}".strip()
        email = next((p["src"].get("email") for p in parts if p["src"].get("email") and "#" not in p["src"].get("email")), src.get("email"))
        out.append({
            "user_id": src["id"],
            "linked_user_ids": [p["src"]["id"] for p in parts[1:]],
            "full_name": name,
            "email": email,
            "role": "+".join(roles),
            "roles": roles,
            "monthly_compensation": sum(float(p["src"].get("monthly_compensation") or 0) for p in parts),
            "compensation_accepted": all(bool(p["src"].get("compensation_accepted")) for p in parts),
            "contract_start_date": _iso(src.get("contract_start_date")),
            "prior_compensation_amount": float(prior.get("other_annual_compensation") or 0),
            "prior_compensation_signed": bool(prior.get("other_annual_compensation_signed")),
            "prior_compensation_signed_at": _iso(prior.get("other_annual_compensation_signed_at")),
            "prior_compensation_signed_year": prior.get("other_annual_compensation_signed_year"),
            "pension_status": latest.get("status") if latest else "not_declared",
            "pension_status_label": STATUS_LABEL.get(latest.get("status"), "") if latest else "Non dichiarata",
            "pension_latest": _public(latest) if latest else None,
            "pension_history": [_public(d) for d in history],
            "pension_versions": len(history),
        })
    out.sort(key=lambda x: (x["full_name"] or "").lower())
    return {"rows": out, "texts": PENSION_TEXTS, "generated_at": datetime.utcnow().isoformat()}
