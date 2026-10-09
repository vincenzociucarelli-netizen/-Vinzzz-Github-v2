"""
🆕 Archivio Quietanze Firmate (admin) — tutte le quietanze di compenso firmate
(coach, dirigenti, collaboratori, atleti PRO) della società, organizzate per
mese, con download del singolo PDF e ZIP mensile per il commercialista.

Fonte: collection `signed_documents` (document_type di tipo quietanza).
Sola lettura: nessuna modifica ai documenti.
"""
import io
import os
import base64
import zipfile
import re
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

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
    }


def _safe(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", s or "").strip("_") or "doc"


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
    q = await _society_query(current_user)
    docs = [d async for d in db.signed_documents.find(q, {"_id": 0, "pdf_base64": 0, "signature_base64": 0, "signature": 0})]
    selected: List[dict] = []
    for d in docs:
        if _to_int(d.get("year")) != year:
            continue
        if month and _to_int(d.get("month")) != month:
            continue
        if role and _role_of(d) != role:
            continue
        selected.append(d)
    if not selected:
        raise HTTPException(status_code=404, detail="Nessuna quietanza firmata per il periodo selezionato")

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
    fname = f"quietanze_{year}" + (f"_{str(month).zfill(2)}" if month else "") + (f"_{role}" if role else "") + ".zip"
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{fname}"'})
