"""
🆕 Archivio Dichiarazioni (admin) — tutte le dichiarazioni/attestazioni FIRMATE
da chi percepisce compensi (Atleti 18+ PRO, coach, dirigenti, collaboratori):
pregresso / compensi da terzi, posizione previdenziale, dichiarazioni e
comunicazioni di superamento soglia. Raggruppate per PERSONA (dual-role unito),
con PDF singolo, ZIP e invio al commercialista / consulente del lavoro.

Fonte: collection `signed_documents`. Sola lettura (+ backfill idempotente dei
PDF mancanti per dichiarazioni firmate prima dell'introduzione dei documenti).
"""
import io
import uuid
import base64
import zipfile
from datetime import datetime
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, EmailStr

from database import db
from auth_utils import get_current_user
from routes.quietanze_archive import _require_admin, _fetch_pdf_bytes, _safe, _eur, _to_int, _name_of, RECEIPT_TYPES, MONTH_NAMES_IT
from routes.pension_declarations import _person_ids, _backfill_missing_documents

router = APIRouter()

DECL_TYPES: Dict[str, dict] = {
    "prior_compensation_declaration": {"label": "Dichiarazione compensi pregressi / da terzi", "short": "Pregresso", "icon": "cash", "color": "#1565C0"},
    "pension_declaration": {"label": "Dichiarazione posizione previdenziale", "short": "Previdenza", "icon": "shield-checkmark", "color": "#6A1B9A"},
    "threshold_declaration_5000": {"label": "Dichiarazione superamento soglia € 5.000", "short": "Soglia 5k", "icon": "alert-circle", "color": "#EF6C00"},
    "threshold_declaration_15000": {"label": "Dichiarazione superamento soglia € 15.000", "short": "Soglia 15k", "icon": "alert", "color": "#C62828"},
    "threshold_5000_communication": {"label": "Comunicazione superamento € 5.000", "short": "Com. 5k", "icon": "mail", "color": "#EF6C00"},
    "threshold_15000_communication": {"label": "Comunicazione superamento € 15.000", "short": "Com. 15k", "icon": "mail", "color": "#C62828"},
}
ROLE_LABEL = {"coach": "Coach", "dirigente": "Dirigente", "viewer": "Dirigente", "collaboratore": "Collaboratore", "athlete": "Atleta Pro", "admin": "Admin"}


async def _society_query(current_user: dict) -> dict:
    q: dict = {"document_type": {"$in": list(DECL_TYPES.keys())}}
    sid = current_user.get("society_id")
    if sid:
        user_ids = [u["id"] async for u in db.users.find({"society_id": sid}, {"_id": 0, "id": 1})]
        athlete_ids = [a["id"] async for a in db.athletes.find({"society_id": sid}, {"_id": 0, "id": 1})]
        q["$or"] = [
            {"society_id": sid}, {"signer_id": {"$in": user_ids}}, {"athlete_id": {"$in": athlete_ids}},
            {"coach_id": {"$in": user_ids}}, {"dirigente_id": {"$in": user_ids}}, {"collaboratore_id": {"$in": user_ids}},
        ]
    return q


def _year_of(d: dict) -> Optional[int]:
    y = _to_int(d.get("fiscal_year")) or _to_int(d.get("year"))
    if y:
        return y
    sa = d.get("signed_at") or d.get("created_at")
    return sa.year if isinstance(sa, datetime) else None


def _serialize(d: dict, person_key: str) -> dict:
    signed_at = d.get("signed_at") or d.get("created_at")
    meta = DECL_TYPES.get(d.get("document_type"), {})
    return {
        "id": d.get("id"),
        "document_type": d.get("document_type"),
        "type_label": meta.get("label", d.get("document_type")),
        "type_short": meta.get("short", ""),
        "document_title": d.get("document_title") or meta.get("label"),
        "signer_name": _name_of(d),
        "person_key": person_key,
        "year": _year_of(d),
        "amount": float(d["amount"]) if d.get("amount") is not None else (float(d["amount_gross"]) if d.get("amount_gross") not in (None, "") else None),
        "month": _to_int(d.get("month")),
        "version_number": d.get("version_number"),
        "pension_status": d.get("pension_status"),
        "signed_at": signed_at.isoformat() if isinstance(signed_at, datetime) else signed_at,
        "pdf_filename": d.get("pdf_filename"),
    }


async def _load_grouped(current_user: dict, year: Optional[int] = None, doc_type: Optional[str] = None, person: Optional[str] = None):
    """Carica le dichiarazioni della società e le raggruppa per persona (dual-role unito)."""
    q = await _society_query(current_user)
    proj = {"_id": 0, "pdf_base64": 0, "signature_base64": 0, "signature": 0, "consent_data": 0, "pdf_content": 0}
    docs = [d async for d in db.signed_documents.find(q, proj).sort("signed_at", -1)]

    id_to_key: Dict[str, str] = {}
    persons: Dict[str, dict] = {}

    async def key_for(d: dict) -> str:
        seeds = [i for i in (d.get("signer_id"), d.get("athlete_id"), d.get("coach_id"), d.get("dirigente_id"), d.get("collaboratore_id")) if i]
        for s in seeds:
            if s in id_to_key:
                return id_to_key[s]
        ids = await _person_ids(*seeds) if seeds else []
        for i in ids:
            if i in id_to_key:
                k = id_to_key[i]
                for j in ids:
                    id_to_key[j] = k
                return k
        k = seeds[0] if seeds else (d.get("id") or str(uuid.uuid4()))
        for j in (ids or seeds):
            id_to_key[j] = k
        # ruoli / accordo della persona
        roles: List[str] = []
        agreement_at = None
        monthly = 0.0
        if ids:
            async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "role": 1, "compensation_accepted": 1, "compensation_accepted_date": 1, "monthly_compensation": 1}):
                r = ROLE_LABEL.get(u.get("role"))
                if r and r not in roles:
                    roles.append(r)
                if u.get("compensation_accepted") and isinstance(u.get("compensation_accepted_date"), datetime):
                    agreement_at = agreement_at or u["compensation_accepted_date"]
                monthly += float(u.get("monthly_compensation") or 0)
            async for a in db.athletes.find({"id": {"$in": ids}, "is_compensated": True}, {"_id": 0, "compensation_accepted": 1, "compensation_accepted_date": 1, "monthly_compensation": 1}):
                if "Atleta Pro" not in roles:
                    roles.append("Atleta Pro")
                if a.get("compensation_accepted") and isinstance(a.get("compensation_accepted_date"), datetime):
                    agreement_at = agreement_at or a["compensation_accepted_date"]
                monthly += float(a.get("monthly_compensation") or 0)
        persons[k] = {
            "key": k, "name": _name_of(d),
            "roles": roles, "role_label": " + ".join(roles) if roles else "",
            "agreement_accepted_at": agreement_at.isoformat() if agreement_at else None,
            "monthly_compensation": monthly, "docs": [], "counts": {},
        }
        return k

    items = []
    for d in docs:
        k = await key_for(d)
        it = _serialize(d, k)
        items.append((it, d))

    # 🆕 Anche chi ha SOLO quietanze (nessuna dichiarazione) compare, per il Fascicolo completo
    rq = dict(q)
    rq["document_type"] = {"$in": RECEIPT_TYPES}
    async for r in db.signed_documents.find(rq, {"_id": 0, "id": 1, "signer_id": 1, "athlete_id": 1, "coach_id": 1, "dirigente_id": 1, "collaboratore_id": 1,
                                                   "signer_name": 1, "athlete_name": 1, "coach_name": 1, "dirigente_name": 1, "collaboratore_name": 1, "year": 1, "signed_at": 1, "created_at": 1}):
        if year and _year_of(r) != year:
            continue
        k = await key_for(r)
        persons[k]["receipts_count"] = persons[k].get("receipts_count", 0) + 1

    years = sorted({it["year"] for it, _ in items if it["year"]}, reverse=True)
    selected = []
    for it, d in items:
        if year and it["year"] != year:
            continue
        if doc_type and it["document_type"] != doc_type:
            continue
        if person and it["person_key"] != person:
            continue
        selected.append((it, d))
        p = persons[it["person_key"]]
        p["docs"].append(it)
        p["counts"][it["document_type"]] = p["counts"].get(it["document_type"], 0) + 1

    out_persons = sorted(
        [p for p in persons.values() if p["docs"] or (not doc_type and not person and p.get("receipts_count"))],
        key=lambda p: p["name"].lower(),
    )
    for p in out_persons:
        p.setdefault("receipts_count", 0)
    type_counts = {t: sum(1 for it, _ in selected if it["document_type"] == t) for t in DECL_TYPES}
    return out_persons, selected, years, type_counts


@router.get("/admin/declarations/archive")
async def admin_declarations_archive(year: Optional[int] = None, current_user=Depends(get_current_user)):
    """Tutte le dichiarazioni firmate (pregresso, previdenza, soglie) raggruppate per persona."""
    _require_admin(current_user)
    try:
        await _backfill_missing_documents(current_user.get("society_id"))
    except Exception:
        pass
    persons, selected, years, type_counts = await _load_grouped(current_user, year)
    sid = current_user.get("society_id")
    settings = await db.settings.find_one({"type": "society", **({"society_id": sid} if sid else {})}, {"_id": 0, "accountant_email": 1}) or {}
    return {
        "persons": persons,
        "total": len(selected),
        "years": years,
        "types": [{"key": k, **v, "count": type_counts.get(k, 0)} for k, v in DECL_TYPES.items()],
        "accountant_email": settings.get("accountant_email"),
    }


async def _build_zip(selected: List[tuple], persons_by_key: Dict[str, dict], current_user: dict) -> io.BytesIO:
    buf = io.BytesIO()
    missing = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for it, d in selected:
            content = await _fetch_pdf_bytes(it["id"], current_user)
            folder = _safe(persons_by_key.get(it["person_key"], {}).get("name") or it["signer_name"])
            short = _safe(DECL_TYPES.get(it["document_type"], {}).get("short") or it["document_type"])
            ver = f"_v{it['version_number']}" if it.get("version_number") and int(it["version_number"]) > 1 else ""
            label = f"{folder}/{short}_{it['year'] or 'xxxx'}{ver}_{_safe((it['id'] or '')[:8])}.pdf"
            if content:
                zf.writestr(label, content)
            else:
                missing.append(label)
        if missing:
            zf.writestr("_PDF_MANCANTI.txt", "PDF non disponibili:\n" + "\n".join(missing))
    buf.seek(0)
    return buf


def _zip_name(year: Optional[int], doc_type: Optional[str], person: Optional[str]) -> str:
    return "dichiarazioni" + (f"_{year}" if year else "") + (f"_{_safe(DECL_TYPES.get(doc_type, {}).get('short', doc_type))}" if doc_type else "") + ("_persona" if person else "") + ".zip"


@router.get("/admin/declarations/fascicolo/zip")
async def admin_person_fascicolo_zip(person: str, year: Optional[int] = None, current_user=Depends(get_current_user)):
    """🆕 Fascicolo completo di UNA persona: quietanze mensili firmate + tutte le
    dichiarazioni (pregresso, previdenza, soglie), in un unico ZIP.
    `person` = chiave persona restituita da /admin/declarations/archive (un id della persona)."""
    _require_admin(current_user)
    ids = await _person_ids(person)
    if not ids:
        raise HTTPException(status_code=404, detail="Persona non trovata")

    # Nome persona (da users/athletes)
    name = None
    u = await db.users.find_one({"id": {"$in": ids}}, {"_id": 0, "full_name": 1, "first_name": 1, "last_name": 1})
    a = await db.athletes.find_one({"id": {"$in": ids}}, {"_id": 0, "full_name": 1, "first_name": 1, "last_name": 1})
    for src in (a, u):
        if src:
            name = src.get("full_name") or f"{src.get('first_name', '')} {src.get('last_name', '')}".strip()
            if name:
                break
    folder = _safe(name or "Persona")

    id_q = {"$or": [{k: {"$in": ids}} for k in ("signer_id", "athlete_id", "coach_id", "dirigente_id", "collaboratore_id")]}
    proj = {"_id": 0, "pdf_base64": 0, "signature_base64": 0, "signature": 0, "consent_data": 0, "pdf_content": 0}
    all_types = list(DECL_TYPES.keys()) + RECEIPT_TYPES
    docs = [d async for d in db.signed_documents.find({**id_q, "document_type": {"$in": all_types}}, proj).sort("signed_at", -1)]
    if year:
        docs = [d for d in docs if _year_of(d) == year]
    if not docs:
        raise HTTPException(status_code=404, detail="Nessun documento firmato per questa persona")

    buf = io.BytesIO()
    missing, n_receipts, n_decl = [], 0, 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for d in docs:
            content = await _fetch_pdf_bytes(d.get("id"), current_user)
            dt = d.get("document_type")
            if dt in RECEIPT_TYPES:
                y, m = _to_int(d.get("year")) or _year_of(d) or 0, _to_int(d.get("month")) or 0
                label = f"{folder}/Quietanze/{y}-{m:02d}_{_safe(MONTH_NAMES_IT[m] if 0 < m < 13 else 'mese')}_{_safe((d.get('id') or '')[:8])}.pdf"
                n_receipts += 1
            else:
                short = _safe(DECL_TYPES.get(dt, {}).get("short") or dt)
                ver = d.get("version_number")
                label = f"{folder}/Dichiarazioni/{short}_{_year_of(d) or 'xxxx'}{f'_v{ver}' if ver and int(ver) > 1 else ''}_{_safe((d.get('id') or '')[:8])}.pdf"
                n_decl += 1
            if content:
                zf.writestr(label, content)
            else:
                missing.append(label)
        zf.writestr(f"{folder}/_INDICE.txt",
                    f"Fascicolo {name or ''}{f' — anno {year}' if year else ''}\nQuietanze firmate: {n_receipts}\nDichiarazioni: {n_decl}\nGenerato: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC\n"
                    + ("\nPDF non disponibili:\n" + "\n".join(missing) if missing else ""))
    buf.seek(0)
    fname = f"fascicolo_{folder}{f'_{year}' if year else ''}.zip"
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/admin/declarations/archive/zip")
async def admin_declarations_archive_zip(
    year: Optional[int] = None, doc_type: Optional[str] = None, person: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """ZIP con i PDF delle dichiarazioni (cartella per persona)."""
    _require_admin(current_user)
    persons, selected, _, _ = await _load_grouped(current_user, year, doc_type, person)
    if not selected:
        raise HTTPException(status_code=404, detail="Nessuna dichiarazione firmata per i filtri selezionati")
    buf = await _build_zip(selected, {p["key"]: p for p in persons}, current_user)
    fname = _zip_name(year, doc_type, person)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


class SendDeclarationsEmailRequest(BaseModel):
    year: Optional[int] = None
    doc_type: Optional[str] = None
    person: Optional[str] = None
    to_email: EmailStr
    message: Optional[str] = Field(None, max_length=1000)
    save_as_default: bool = True


@router.post("/admin/declarations/archive/send-email")
async def admin_declarations_archive_send_email(data: SendDeclarationsEmailRequest, current_user=Depends(get_current_user)):
    """Invia via email (Brevo) lo ZIP delle dichiarazioni al commercialista / consulente del lavoro."""
    _require_admin(current_user)
    persons, selected, _, _ = await _load_grouped(current_user, data.year, data.doc_type, data.person)
    if not selected:
        raise HTTPException(status_code=404, detail="Nessuna dichiarazione firmata per i filtri selezionati")

    sid = current_user.get("society_id")
    society = await db.settings.find_one({"type": "society", **({"society_id": sid} if sid else {})}, {"_id": 0, "name": 1, "email": 1, "ragione_sociale": 1}) or {}
    society_name = society.get("ragione_sociale") or society.get("name") or "RegistraTEAM"
    by_key = {p["key"]: p for p in persons}

    buf = await _build_zip(selected, by_key, current_user)
    zip_bytes = buf.getvalue()
    if len(zip_bytes) > 9 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Lo ZIP supera i 9 MB: filtra per anno, tipo o persona")

    fname = _zip_name(data.year, data.doc_type, data.person)
    period = f"anno {data.year}" if data.year else "tutti gli anni"
    td = "padding:4px 8px;border-bottom:1px solid #eee"
    rows = ""
    for p in persons:
        for it in p["docs"]:
            amt = _eur(it["amount"]) if it.get("amount") is not None else "—"
            sa = it.get("signed_at") or ""
            rows += (f"<tr><td style='{td}'>{p['name']}</td><td style='{td}'>{p['role_label']}</td>"
                     f"<td style='{td}'>{it['type_label']}{(' (v.' + str(it['version_number']) + ')') if it.get('version_number') and int(it['version_number']) > 1 else ''}</td>"
                     f"<td style='{td}'>{it['year'] or ''}</td><td style='{td};text-align:right'>{amt}</td><td style='{td}'>{str(sa)[:10]}</td></tr>")
    note_html = f"<p style='white-space:pre-wrap'>{data.message.strip()}</p>" if data.message and data.message.strip() else ""
    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:720px">
      <h2 style="color:#1B5E20;margin-bottom:4px">Dichiarazioni lavoro sportivo — {period}</h2>
      <p style="margin-top:0;color:#666">{society_name}</p>
      {note_html}
      <p>In allegato lo ZIP con <b>{len(selected)} dichiarazioni</b> firmate digitalmente (pregresso / compensi da terzi, posizione previdenziale, superamento soglie) di {len(persons)} percettori di compenso, una cartella per persona.</p>
      <table style="border-collapse:collapse;font-size:13px;width:100%">
        <thead><tr style="background:#E8F5E9"><th style="padding:6px 8px;text-align:left">Nominativo</th><th style="padding:6px 8px;text-align:left">Ruolo</th><th style="padding:6px 8px;text-align:left">Documento</th><th style="padding:6px 8px;text-align:left">Anno</th><th style="padding:6px 8px;text-align:right">Importo</th><th style="padding:6px 8px;text-align:left">Firmato il</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="font-size:12px;color:#888;margin-top:16px">Email generata automaticamente da RegistraTEAM per conto di {society_name}. Inviata da {current_user.get('full_name') or current_user.get('email')}.</p>
    </div>"""

    from email_service import email_service
    result = await email_service.send_email(
        to_email=str(data.to_email),
        subject=f"Dichiarazioni lavoro sportivo {period} — {society_name}",
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
        "id": str(uuid.uuid4()), "society_id": sid, "kind": "declarations", "sent_by": current_user.get("id"), "sent_by_name": current_user.get("full_name"),
        "to_email": str(data.to_email), "year": data.year, "doc_type": data.doc_type, "person": data.person,
        "count": len(selected), "zip_filename": fname, "sent_at": datetime.utcnow(),
    })
    return {"success": True, "count": len(selected), "to_email": str(data.to_email), "filename": fname}
