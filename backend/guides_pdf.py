"""
📖 10/07/2026 (v7.15) — Generatore PDF per i prontuari/guide per ruolo.

Usa reportlab (già installato nel progetto per altre PDF).
Prende i contenuti da `guides_content.py` e sostituisce i placeholder
`{society_name}`, `{society_email}`, `{society_phone}` con i dati della società
attiva.
"""
from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer,
                                 PageBreak, Table, TableStyle, HRFlowable)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

from guides_content import GUIDES, GUIDES_META, build_faq_for_role


def _substitute(text: str, ctx: dict) -> str:
    """Sostituisce i placeholder {society_name}, {society_email}, {society_phone}."""
    if not text:
        return ""
    for k, v in ctx.items():
        text = text.replace("{" + k + "}", str(v or "—"))
    return text


def _footer(canvas, doc, ctx: dict):
    """Footer con nome società + numero pagina + generato il."""
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColorRGB(0.4, 0.4, 0.4)
    footer_text = (
        f"{ctx.get('society_name', 'RegistraTEAM')} — Prontuario RegistraTEAM  "
        f"| Generato il {datetime.now().strftime('%d/%m/%Y')}  "
        f"| Pagina {doc.page}"
    )
    canvas.drawCentredString(A4[0] / 2, 0.8 * cm, footer_text)
    canvas.restoreState()


def generate_guide_pdf(role: str, society_ctx: dict) -> bytes:
    """Genera il PDF della guida per il ruolo indicato, personalizzando i
    contenuti con i dati della società passati in `society_ctx`.

    society_ctx richiesto: {society_name, society_email, society_phone, society_address}
    Fields opzionali: society_website, society_pec, society_logo_data_uri
    """
    role = role.lower()
    if role not in GUIDES:
        raise ValueError(f"Ruolo non supportato: {role}")

    meta = GUIDES_META[role]
    accent = colors.HexColor(meta["accent_color"])

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title=f"Guida {meta['role_label']} - {society_ctx.get('society_name', '')}",
        author=society_ctx.get("society_name", "RegistraTEAM"),
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title", parent=styles["Title"], fontSize=22, leading=26,
        textColor=accent, alignment=TA_LEFT, spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "subtitle", parent=styles["Normal"], fontSize=12, leading=15,
        textColor=colors.HexColor("#666666"), spaceAfter=18,
    )
    h1_style = ParagraphStyle(
        "h1", parent=styles["Heading1"], fontSize=16, leading=20,
        textColor=accent, spaceBefore=18, spaceAfter=10, keepWithNext=True,
    )
    h2_style = ParagraphStyle(
        "h2", parent=styles["Heading2"], fontSize=12, leading=15,
        textColor=colors.HexColor("#333333"), spaceBefore=8, spaceAfter=4,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "body", parent=styles["Normal"], fontSize=10, leading=14,
        textColor=colors.HexColor("#212121"), spaceAfter=6,
    )
    bullet_style = ParagraphStyle(
        "bullet", parent=body_style, leftIndent=14, bulletIndent=0,
        spaceAfter=3,
    )
    faq_q_style = ParagraphStyle(
        "faq_q", parent=body_style, fontSize=10, leading=13,
        textColor=accent, fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=2,
    )
    contact_style = ParagraphStyle(
        "contact", parent=body_style, fontSize=10, leading=14,
        alignment=TA_CENTER, textColor=colors.HexColor("#333333"),
    )

    story: list = []

    # ─── COVER ───
    story.append(Paragraph(
        f"{meta['icon']} Guida {meta['role_label']}",
        title_style,
    ))
    story.append(Paragraph(
        f"Prontuario dedicato a: <b>{meta['audience']}</b>",
        subtitle_style,
    ))
    story.append(HRFlowable(width="100%", thickness=2, color=accent, spaceAfter=12))

    # Card società
    society_info_data = [
        ["Società:", society_ctx.get("society_name", "—")],
    ]
    if society_ctx.get("society_address"):
        society_info_data.append(["Indirizzo:", society_ctx["society_address"]])
    if society_ctx.get("society_email"):
        society_info_data.append(["Email:", society_ctx["society_email"]])
    if society_ctx.get("society_phone"):
        society_info_data.append(["Telefono:", society_ctx["society_phone"]])
    if society_ctx.get("society_website"):
        society_info_data.append(["Web:", society_ctx["society_website"]])
    society_table = Table(society_info_data, colWidths=[3 * cm, 13 * cm])
    society_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#555555")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#212121")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F5F5")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#EEEEEE")),
    ]))
    story.append(society_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "Questo prontuario è pensato per aiutarti a usare RegistraTEAM in autonomia. "
        "Copre <b>registrazione, primo accesso, firma documenti GDPR, attività periodiche e "
        "FAQ</b>. Puoi consultarlo anche off-line: salva il PDF sul tuo dispositivo.",
        body_style,
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Suggerimento:</b> il documento è ottimizzato per la stampa, ma anche per la lettura "
        "su smartphone.",
        body_style,
    ))
    story.append(PageBreak())

    # ─── SEZIONI ───
    ctx = society_ctx
    for section in GUIDES[role]["sections"]:
        story.append(Paragraph(_substitute(section["title"], ctx), h1_style))
        for line in section.get("body", []):
            line = _substitute(line, ctx)
            if line.startswith("•"):
                story.append(Paragraph(line, bullet_style))
            elif line.isupper() and line.endswith(":"):
                story.append(Paragraph(line, h2_style))
            else:
                story.append(Paragraph(line, body_style))
        story.append(Spacer(1, 4))

    # ─── FAQ ───
    story.append(PageBreak())
    story.append(Paragraph("5. Domande frequenti (FAQ)", h1_style))
    faqs = build_faq_for_role(role)
    for q, a in faqs:
        story.append(Paragraph(f"❓ {_substitute(q, ctx)}", faq_q_style))
        story.append(Paragraph(_substitute(a, ctx), body_style))

    # ─── CONTATTI ───
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceAfter=10))
    story.append(Paragraph("📞 Contatti amministrazione", h1_style))
    contact_lines = []
    if ctx.get("society_name"):
        contact_lines.append(f"<b>{ctx['society_name']}</b>")
    if ctx.get("society_address"):
        contact_lines.append(ctx["society_address"])
    if ctx.get("society_email"):
        contact_lines.append(f"Email: <b>{ctx['society_email']}</b>")
    if ctx.get("society_phone"):
        contact_lines.append(f"Telefono: <b>{ctx['society_phone']}</b>")
    if ctx.get("society_pec"):
        contact_lines.append(f"PEC: {ctx['society_pec']}")
    for line in contact_lines:
        story.append(Paragraph(line, contact_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Per problemi tecnici sulla piattaforma RegistraTEAM, l'amministratore della tua società "
        "resta il primo riferimento — sarà lui/lei a inoltrare eventuali segnalazioni al "
        "supporto tecnico.",
        body_style,
    ))

    doc.build(
        story,
        onFirstPage=lambda c, d: _footer(c, d, ctx),
        onLaterPages=lambda c, d: _footer(c, d, ctx),
    )
    return buf.getvalue()
