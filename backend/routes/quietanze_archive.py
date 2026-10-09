"""
🆕 Archivio Quietanze Firmate (admin) — tutte le quietanze di compenso firmate
(coach, dirigenti, collaboratori, atleti PRO) della società, organizzate per
mese, con download del singolo PDF e ZIP mensile per il commercialista.

Fonte: collection `signed_documents` (document_type di tipo quietanza).
Sola lettura: nessuna modifica ai documenti.
"""
import io
import os
import re
import uuid
import base64
import zipfile
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, EmailStr

from database import db
from auth_utils import get_current_user
from models.enums import UserRole

router = APIRouter()

RECEIPT_TYPES = [
    "compensation_receipt",
    "coach_compensation_receipt",
    "collaboratore_compensation_receipt",
    "dirigente_compensation_receipt",
    "atleta_pro_compensation_receipt",
]

MONTH_NAMES_IT = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]


def _to_int(v) -> Optional[int]:
    try:
        return int(str(v).strip()) if v not in (None, "") else None
    except Exception:
        return None


def _role_of(doc: dict) -> str:
    if doc.get("athlete_id"):
        return "athlete"
    if doc.get("coach_id"):
        return "coach"
    if doc.get("dirigente_id"):
        return "dirigente"
    if doc.get("collaboratore_id"):
        return "collaboratore"
    return "altro"


def _name_of(doc: dict) -> str:
    return (doc.get("athlete_name") or doc.get("coach_name") or doc.get("dirigente_name")
            or doc.get("collaboratore_name") or doc.get("signer_name") or "N/A")


async def _society_query(current_user: dict) -> dict:
    """Query multi-tenant sulle quietanze firmate della società dell'admin."""
    q: dict = {"document_type": {"$in": RECEIPT_TYPES}}
    sid = current_user.get("society_id")
    if sid:
        user_ids = [u["id"] async for u in db.users.find({"society_id": sid}, {"_id": 0, "id": 1})]
        athlete_ids = [a["id"] async for a in db.athletes.find({"society_id": sid}, {"_id": 0, "id": 1})]
        q["$or"] = [
            {"society_id": sid},
            {"coach_id": {"$in": user_ids}},
            {"dirigente_id": {"$in": user_ids}},
            {"collaboratore_id": {"$in": user_ids}},
            {"signer_id": {"$in": user_ids}},
            {"athlete_id": {"$in": athlete_ids}},
        ]
    return q


def _serialize(doc: dict) -> dict:
    signed_at = doc.get("signed_at") or doc.get("created_at")
    return {
        "id": doc.get("id"),
        "document_type": doc.get("document_type"),
        "document_title": doc.get("document_title"),
        "user_name": _name_of(doc),
        "user_role": _role_of(doc),
        "user_id": doc.get("athlete_id") or doc.get("coach_id") or doc.get("dirigente_id") or doc.get("collaboratore_id") or doc.get("signer_id"),
        "month": _to_int(doc.get("month")),
        "year": _to_int(doc.get("year")),
        "amount_gross": float(doc.get("amount_gross") or 0),
        "signed_at": signed_at.isoformat() if isinstance(signed_at, datetime) else signed_at,
        "exceeded_5000": bool(doc.get("exceeded_5000")),
        "exceeded_15000": bool(doc.get("exceeded_15000")),
        "dual_role_combined": bool(doc.get("dual_role_combined")),
        "pdf_filename": doc.get("pdf_filename"),
    }


def _require_admin(current_user: dict):
    if current_user.get("role") not in (UserRole.ADMIN, "coordinatore"):
        raise HTTPException(status_code=403, detail="Solo admin")


@router.get("/admin/quietanze/archive")
async def admin_quietanze_archive(year: Optional[int] = None, current_user=Depends(get_current_user)):
    """Elenco di TUTTE le quietanze firmate della società (opz. filtrate per anno),
    più l'elenco degli anni disponibili e i totali per mese."""
    _require_admin(current_user)
    q = await _society_query(current_user)
    proj = {"_id": 0, "pdf_base64": 0, "signature_base64": 0, "signature": 0, "consent_data": 0}
    docs = [d async for d in db.signed_documents.find(q, proj).sort("signed_at", -1)]
    items = [_serialize(d) for d in docs]
    years = sorted({it["year"] for it in items if it["year"]}, reverse=True)
    if year:
        items = [it for it in items if it["year"] == year]
    # Ordina per anno/mese desc, poi nome
    items.sort(key=lambda it: (-(it["year"] or 0), -(it["month"] or 0), it["user_name"].lower()))
    months: dict = {}
    for it in items:
        key = f"{it['year']}-{str(it['month']).zfill(2)}"
        m = months.setdefault(key, {"year": it["year"], "month": it["month"], "label": f"{MONTH_NAMES_IT[it['month'] or 0]} {it['year']}", "count": 0, "total": 0.0})
        m["count"] += 1
        m["total"] += it["amount_gross"]
    return {
        "receipts": items,
        "total": len(items),
        "years": years,
        "months": sorted(months.values(), key=lambda m: (-(m["year"] or 0), -(m["month"] or 0))),
        # 🆕 email del commercialista salvata nelle impostazioni società (predefinita per l'invio)
        "accountant_email": (await db.settings.find_one(
            {"type": "society", **({"society_id": current_user.get("society_id")} if current_user.get("society_id") else {})},
            {"_id": 0, "accountant_email": 1}) or {}).get("accountant_email"),
    }


def _safe(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", s or "").strip("_") or "doc"


def _eur(n: float) -> str:
    """Formato italiano: € 1.234,56"""
    return "€ " + f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


async def _fetch_pdf_bytes(document_id: str, current_user: dict) -> Optional[bytes]:
    """Riusa ESATTAMENTE la logica di GET /documents/download/{id} (file su disco,
    cache base64 o rigenerazione dal record compenso) così il PDF nello ZIP è
    identico a quello scaricato singolarmente."""
    from server import download_document  # import lazy: server è già caricato a runtime
    try:
        resp = await download_document(document_id, current_user)
    except Exception:
        return None
    chunks: List[bytes] = []
    async for c in resp.body_iterator:
        chunks.append(c if isinstance(c, bytes) else str(c).encode())
    data = b"".join(chunks)
    return data if data else None


@router.get("/admin/quietanze/archive/zip")
async def admin_quietanze_archive_zip(
    year: int,
    month: Optional[int] = None,
    role: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """ZIP con i PDF delle quietanze firmate del periodo (anno o anno+mese),
    opzionalmente filtrate per ruolo. Pensato per la consegna al commercialista."""
    _require_admin(current_user)
    selected = await _select_receipts(current_user, year, month, role)
    if not selected:
        raise HTTPException(status_code=404, detail="Nessuna quietanza firmata per il periodo selezionato")

    buf = await _build_zip(selected, year, current_user)
    fname = f"quietanze_{year}" + (f"_{str(month).zfill(2)}" if month else "") + (f"_{role}" if role else "") + ".zip"
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


async def _select_receipts(current_user: dict, year: int, month: Optional[int], role: Optional[str]) -> List[dict]:
    q = await _society_query(current_user)
    docs = [d async for d in db.signed_documents.find(q, {"_id": 0, "pdf_base64": 0, "signature_base64": 0, "signature": 0})]
    out = []
    for d in docs:
        if _to_int(d.get("year")) != year:
            continue
        if month and _to_int(d.get("month")) != month:
            continue
        if role and _role_of(d) != role:
            continue
        out.append(d)
    return out


async def _build_zip(selected: List[dict], year: int, current_user: dict) -> io.BytesIO:
    buf = io.BytesIO()
    missing = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for d in selected:
            content = await _fetch_pdf_bytes(d.get("id"), current_user)
            m = _to_int(d.get("month")) or 0
            label = f"{year}_{str(m).zfill(2)}_{_safe(_name_of(d))}_{_role_of(d)}_{_safe((d.get('id') or '')[:8])}.pdf"
            if content:
                zf.writestr(label, content)
            else:
                missing.append(label)
        if missing:
            zf.writestr("_PDF_MANCANTI.txt", "PDF non disponibili:\n" + "\n".join(missing))
    buf.seek(0)
    return buf


class SendArchiveEmailRequest(BaseModel):
    year: int
    month: Optional[int] = Field(None, ge=1, le=12)
    role: Optional[str] = None
    to_email: EmailStr
    message: Optional[str] = Field(None, max_length=1000)
    save_as_default: bool = True


@router.post("/admin/quietanze/archive/send-email")
async def admin_quietanze_archive_send_email(data: SendArchiveEmailRequest, current_user=Depends(get_current_user)):
    """Invia via email (Brevo) lo ZIP delle quietanze firmate del periodo al
    commercialista. Salva l'indirizzo come predefinito della società."""
    _require_admin(current_user)
    selected = await _select_receipts(current_user, data.year, data.month, data.role)
    if not selected:
        raise HTTPException(status_code=404, detail="Nessuna quietanza firmata per il periodo selezionato")

    sid = current_user.get("society_id")
    society = await db.settings.find_one({"type": "society", **({"society_id": sid} if sid else {})}, {"_id": 0, "name": 1, "email": 1, "ragione_sociale": 1}) or {}
    society_name = society.get("ragione_sociale") or society.get("name") or "RegistraTEAM"

    buf = await _build_zip(selected, data.year, current_user)
    zip_bytes = buf.getvalue()
    if len(zip_bytes) > 9 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Lo ZIP supera i 9 MB: invia un singolo mese o filtra per ruolo")

    period = f"{MONTH_NAMES_IT[data.month]} {data.year}" if data.month else f"anno {data.year}"
    role_txt = {"coach": "Coach", "dirigente": "Dirigenti", "collaboratore": "Collaboratori", "athlete": "Atleti Pro"}.get(data.role or "", "")
    fname = f"quietanze_{data.year}" + (f"_{str(data.month).zfill(2)}" if data.month else "") + (f"_{data.role}" if data.role else "") + ".zip"
    total = sum(float(d.get("amount_gross") or 0) for d in selected)
    role_label = {"coach": "Coach", "dirigente": "Dirigente", "collaboratore": "Collaboratore", "athlete": "Atleta Pro"}
    td = "padding:4px 8px;border-bottom:1px solid #eee"
    rows = "".join(
        f"<tr><td style='{td}'>{_name_of(d)}</td><td style='{td}'>{role_label.get(_role_of(d), '')}</td>"
        f"<td style='{td}'>{MONTH_NAMES_IT[_to_int(d.get('month')) or 0]} {_to_int(d.get('year'))}</td>"
        f"<td style='{td};text-align:right'>{_eur(float(d.get('amount_gross') or 0))}</td></tr>"
        for d in sorted(selected, key=lambda x: (_to_int(x.get("month")) or 0, _name_of(x)))
    )
    note_html = f"<p style='white-space:pre-wrap'>{data.message.strip()}</p>" if data.message and data.message.strip() else ""
    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:680px">
      <h2 style="color:#4A148C;margin-bottom:4px">Quietanze firmate — {period}{(' · ' + role_txt) if role_txt else ''}</h2>
      <p style="margin-top:0;color:#666">{society_name}</p>
      {note_html}
      <p>In allegato lo ZIP con <b>{len(selected)} quietanze</b> di compenso sportivo firmate digitalmente (totale lordo <b>{_eur(total)}</b>).</p>
      <table style="border-collapse:collapse;font-size:13px;width:100%">
        <thead><tr style="background:#F3E5F5"><th style="padding:6px 8px;text-align:left">Nominativo</th><th style="padding:6px 8px;text-align:left">Ruolo</th><th style="padding:6px 8px;text-align:left">Mese</th><th style="padding:6px 8px;text-align:right">Lordo</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="font-size:12px;color:#888;margin-top:16px">Email generata automaticamente da RegistraTEAM per conto di {society_name}. Inviata da {current_user.get('full_name') or current_user.get('email')}.</p>
    </div>"""

    from email_service import email_service
    result = await email_service.send_email(
        to_email=str(data.to_email),
        subject=f"Quietanze firmate {period}{(' - ' + role_txt) if role_txt else ''} — {society_name}",
        html_content=html,
        attachments=[{"name": fname, "content": base64.b64encode(zip_bytes).decode(), "type": "application/zip"}],
        sender_name=society_name,
        reply_to_email=society.get("email") or current_user.get("email"),
        reply_to_name=society_name,
    )
    if not (isinstance(result, dict) and result.get("success", True)):
        raise HTTPException(status_code=502, detail=f"Invio email non riuscito: {result.get('error') if isinstance(result, dict) else result}")

    if data.save_as_default:
        await db.settings.update_one({"type": "society", **({"society_id": sid} if sid else {})}, {"$set": {"accountant_email": str(data.to_email)}})

    await db.quietanze_email_log.insert_one({
        "id": str(uuid.uuid4()), "society_id": sid, "sent_by": current_user.get("id"), "sent_by_name": current_user.get("full_name"),
        "to_email": str(data.to_email), "year": data.year, "month": data.month, "role": data.role,
        "count": len(selected), "total": total, "zip_filename": fname, "sent_at": datetime.utcnow(),
    })
    return {"success": True, "count": len(selected), "to_email": str(data.to_email), "filename": fname}
