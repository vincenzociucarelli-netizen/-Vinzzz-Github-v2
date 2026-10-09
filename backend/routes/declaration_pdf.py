"""
🆕 PDF per le dichiarazioni firmate dal lavoratore (posizione previdenziale,
pregresso compensi). Documento A4 con intestazione società, paragrafi a capo
automatico, metadati di sottoscrizione e immagine della firma.
Il PDF viene salvato in `signed_documents` così compare in "I Miei Documenti"
(lavoratore), nell'archivio admin e nella Cronologia.
"""
import io
import uuid
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional

from database import db

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    HAS_PDF = True
except Exception:  # pragma: no cover
    HAS_PDF = False


def _rome(dt: datetime) -> str:
    try:
        from zoneinfo import ZoneInfo
        d = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        return d.astimezone(ZoneInfo("Europe/Rome")).strftime("%d/%m/%Y alle %H:%M:%S")
    except Exception:
        return (dt + timedelta(hours=2)).strftime("%d/%m/%Y alle %H:%M:%S")


def _wrap(c, text: str, font: str, size: int, max_w: float) -> List[str]:
    lines: List[str] = []
    for para in text.split("\n"):
        cur = ""
        for w in para.split(" "):
            t = f"{cur} {w}".strip()
            if c.stringWidth(t, font, size) <= max_w:
                cur = t
            else:
                if cur:
                    lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def build_declaration_pdf(
    title: str,
    society_name: str,
    signer_name: str,
    paragraphs: List[Dict[str, str]],   # [{"text": "...", "style": "normal|bold|title"}]
    meta: Dict[str, str],
    signature_base64: Optional[str],
    signed_at: datetime,
) -> bytes:
    if not HAS_PDF:
        raise RuntimeError("PDF generation not available")
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4
    margin = 2 * cm
    max_w = W - 2 * margin
    y = H - 2 * cm

    def new_page():
        nonlocal y
        c.showPage()
        y = H - 2 * cm

    def ensure(h):
        nonlocal y
        if y - h < 2.5 * cm:
            new_page()

    # Intestazione
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(W / 2, y, society_name)
    y -= 0.6 * cm
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.grey)
    c.drawCentredString(W / 2, y, "Documento sottoscritto con firma digitale tramite RegistraTEAM")
    c.setFillColor(colors.black)
    y -= 0.4 * cm
    c.setStrokeColor(colors.grey)
    c.line(margin, y, W - margin, y)
    y -= 0.9 * cm
    c.setFont("Helvetica-Bold", 13)
    for ln in _wrap(c, title, "Helvetica-Bold", 13, max_w):
        c.drawString(margin, y, ln)
        y -= 0.55 * cm
    y -= 0.3 * cm

    # Paragrafi
    for p in paragraphs:
        style = p.get("style", "normal")
        font = "Helvetica-Bold" if style in ("bold", "title") else "Helvetica"
        size = 11 if style == "title" else 10
        for ln in _wrap(c, p.get("text", ""), font, size, max_w):
            ensure(0.5 * cm)
            c.setFont(font, size)
            c.drawString(margin, y, ln)
            y -= 0.48 * cm
        y -= 0.25 * cm

    # Metadati
    y -= 0.2 * cm
    ensure(1 * cm + 0.42 * cm * (len(meta) + 1))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Dati di sottoscrizione")
    y -= 0.5 * cm
    c.setFont("Helvetica", 9)
    for k, v in meta.items():
        for ln in _wrap(c, f"{k}: {v}", "Helvetica", 9, max_w - 0.5 * cm):
            ensure(0.42 * cm)
            c.drawString(margin + 0.5 * cm, y, ln)
            y -= 0.42 * cm

    # Firma
    ensure(4.6 * cm)
    y -= 0.5 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, f"Firma di {signer_name}")
    y -= 0.3 * cm
    box_h, box_w = 3 * cm, 8 * cm
    c.setStrokeColor(colors.HexColor("#1E3A8A"))
    c.rect(margin, y - box_h, box_w, box_h)
    if signature_base64:
        try:
            b64 = signature_base64.split(",")[1] if "," in signature_base64 else signature_base64
            img = ImageReader(io.BytesIO(base64.b64decode(b64)))
            c.drawImage(img, margin + 0.2 * cm, y - box_h + 0.2 * cm, width=box_w - 0.4 * cm, height=box_h - 0.4 * cm,
                        preserveAspectRatio=True, mask="auto")
        except Exception as e:
            logging.warning(f"[declaration_pdf] firma non renderizzabile: {e}")
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.grey)
    c.drawString(margin + box_w + 0.5 * cm, y - 0.6 * cm, f"Sottoscritto il {_rome(signed_at)}")
    c.drawString(margin + box_w + 0.5 * cm, y - 1.0 * cm, "Firma grafometrica acquisita su dispositivo")
    c.setFillColor(colors.black)

    c.save()
    buf.seek(0)
    return buf.getvalue()


async def society_name_for(society_id: Optional[str]) -> str:
    q = {"type": "society"}
    if society_id:
        q["society_id"] = society_id
    s = await db.settings.find_one(q, {"_id": 0, "name": 1, "ragione_sociale": 1}) or {}
    return s.get("ragione_sociale") or s.get("name") or "RegistraTEAM"


async def store_signed_declaration(
    *,
    document_type: str,
    document_title: str,
    pdf_bytes: bytes,
    signer_id: Optional[str],
    signer_name: str,
    signer_email: Optional[str],
    athlete_id: Optional[str],
    society_id: Optional[str],
    signed_at: datetime,
    signature_base64: Optional[str],
    extra: Optional[dict] = None,
) -> str:
    """Salva il PDF in `signed_documents` (visibile al lavoratore e all'admin)."""
    doc_id = str(uuid.uuid4())
    rec = {
        "id": doc_id,
        "document_type": document_type,
        "document_title": document_title,
        "signer_id": signer_id,
        "signer_name": signer_name,
        "signer_email": signer_email,
        "society_id": society_id,
        "signed_at": signed_at,
        "created_at": datetime.utcnow(),
        "pdf_base64": base64.b64encode(pdf_bytes).decode(),
        "pdf_filename": f"{document_type}_{signed_at.strftime('%Y%m%d')}_{doc_id[:8]}.pdf",
        "signature_base64": signature_base64,
    }
    if athlete_id:
        rec["athlete_id"] = athlete_id
        rec["related_entity_id"] = athlete_id
    if extra:
        rec.update(extra)
    await db.signed_documents.insert_one(rec)
    return doc_id
