"""
Import Excel per migrazione dati atleti + genitori da gestionale legacy.
🆕 27/02/2026 (v7.15 P1)

Endpoint:
- GET  /admin/import-athletes/template.xlsx  → scarica template XLSX pre-formattato
- POST /admin/import-athletes/preview        → riceve file XLSX compilato, valida riga per riga
- POST /admin/import-athletes/commit         → esegue import delle righe validate

Formato template:
  Foglio "Atleti": Cognome*, Nome*, Codice Fiscale*, Data Nascita*, Sesso, Email,
    Telefono, Indirizzo, Città, CAP, Provincia, Squadra, Note,
    Cognome Genitore, Nome Genitore, CF Genitore, Email Genitore, Telefono Genitore
  Foglio "Istruzioni": guida di compilazione.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from io import BytesIO
import uuid
import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import Response
from pydantic import BaseModel

from database import db
from auth_utils import get_current_user

# UserRole è definito in server.py — usiamo la stringa "admin" per evitare import circolare
ADMIN_ROLE = "admin"


router = APIRouter(prefix="/admin/import-athletes", tags=["import"])


# -----------------------------
# Helpers
# -----------------------------
def _is_admin(current_user: Dict[str, Any]):
    if current_user.get("role") != ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Solo admin può importare")


CF_REGEX = re.compile(r"^[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]$")

_CF_ODD = {
    "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
    "A": 1, "B": 0, "C": 5, "D": 7, "E": 9, "F": 13, "G": 15, "H": 17, "I": 19, "J": 21,
    "K": 2, "L": 4, "M": 18, "N": 20, "O": 11, "P": 3, "Q": 6, "R": 8, "S": 12, "T": 14,
    "U": 16, "V": 10, "W": 22, "X": 25, "Y": 24, "Z": 23,
}
_CF_EVEN = {c: i for i, c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ")}
_CF_EVEN.update({str(i): i for i in range(10)})
_CF_REM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def is_valid_cf(cf: str) -> bool:
    """Valida Codice Fiscale italiano (16 caratteri + checksum)."""
    if not cf or not isinstance(cf, str):
        return False
    cf = cf.strip().upper()
    if not CF_REGEX.match(cf):
        return False
    total = 0
    for i, ch in enumerate(cf[:15]):
        if (i + 1) % 2 == 0:  # even position (1-indexed)
            total += _CF_EVEN.get(ch, 0)
        else:
            total += _CF_ODD.get(ch, 0)
    return _CF_REM[total % 26] == cf[15]


def parse_italian_date(v: Any) -> Optional[datetime]:
    """Parsa 'gg/mm/aaaa' o oggetti datetime da openpyxl."""
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.replace(tzinfo=None)
    s = str(v).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _cell(row, key: str) -> str:
    """Estrae cell da dict/row openpyxl in modo safe (trimmed string)."""
    v = row.get(key)
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, datetime):
        return v.strftime("%d/%m/%Y")
    return str(v).strip()


# -----------------------------
# Template XLSX
# -----------------------------
COLUMNS = [
    "Cognome*", "Nome*", "Codice Fiscale*", "Data Nascita (gg/mm/aaaa)*",
    "Sesso (M/F)", "Email", "Telefono", "Indirizzo", "Città", "CAP", "Provincia",
    "Squadra", "Note",
    "Cognome Genitore", "Nome Genitore", "CF Genitore", "Email Genitore", "Telefono Genitore",
]

EXAMPLE_ROW = [
    "Rossi", "Mario", "RSSMRA10E15H501Z", "15/05/2010", "M",
    "mario.rossi@email.com", "3331234567", "Via Roma 10", "Perugia", "06100", "PG",
    "U14 Femminile", "Esempio da cancellare",
    "Rossi", "Giulio", "RSSGLI80A01H501Z", "genitore.rossi@email.com", "3339876543",
]

INSTRUCTIONS = [
    ["📋 GUIDA IMPORTAZIONE ATLETI"],
    [""],
    ["Colonne obbligatorie (contrassegnate con *):"],
    ["  • Cognome, Nome, Codice Fiscale, Data Nascita"],
    [""],
    ["Formato campi:"],
    ["  • Codice Fiscale: 16 caratteri maiuscoli (es. RSSMRA10E15H501Z)"],
    ["  • Data Nascita: gg/mm/aaaa (es. 15/05/2010)"],
    ["  • Sesso: M o F"],
    ["  • CAP: 5 cifre (es. 06100)"],
    ["  • Squadra: nome esatto della squadra come compare in RegistraTEAM (es. 'U14 Femminile'). Se non trovata, l'atleta viene creato senza squadra e potrai assegnarla dopo."],
    [""],
    ["Sezione Genitore (per atleti MINORENNI):"],
    ["  • Se compili almeno CF Genitore + Nome + Cognome, il genitore viene creato/collegato automaticamente all'atleta."],
    ["  • Se il genitore ha già un account nella tua società (stesso CF), l'atleta viene collegato all'account esistente."],
    ["  • Se il CF Genitore è vuoto, il genitore NON viene creato (utile per atleti maggiorenni)."],
    [""],
    ["Duplicati:"],
    ["  • Se il CF atleta esiste GIÀ nella tua società → l'anagrafica verrà AGGIORNATA (mantieni team, storico, ecc.)"],
    ["  • Se il CF esiste in ALTRA società → creerà un nuovo record MA riuserà lo stesso codice atleta persistente."],
    [""],
    ["Anteprima:"],
    ["  1. Compila il foglio 'Atleti' con i tuoi dati (cancella la riga esempio)."],
    ["  2. Salva il file XLSX."],
    ["  3. In RegistraTEAM: Admin → Impostazioni → Import Atleti → Carica file."],
    ["  4. Rivedi l'anteprima (verranno segnalati errori/avvisi/duplicati)."],
    ["  5. Conferma l'import."],
    [""],
    ["Suggerimenti:"],
    ["  • Prova prima con 3-5 righe per verificare il formato."],
    ["  • Puoi caricare il file più volte: le righe già importate verranno rilevate come duplicati."],
]


@router.get("/template.xlsx")
async def download_template(current_user = Depends(get_current_user)):
    """Scarica il template XLSX pre-formattato per l'importazione atleti."""
    _is_admin(current_user)
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill

    wb = Workbook()

    # --- Foglio 1: Atleti ---
    ws = wb.active
    ws.title = "Atleti"
    header_fill = PatternFill(start_color="1565C0", end_color="1565C0", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    for col_idx, name in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=name)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    # Larghezza colonne
    widths = [16, 16, 20, 18, 12, 26, 14, 24, 14, 8, 10, 22, 20, 20, 20, 20, 26, 14]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i) if i <= 26 else "A" + chr(64 + i - 26)].width = w
    ws.row_dimensions[1].height = 32
    # Riga esempio
    example_fill = PatternFill(start_color="FFF9C4", end_color="FFF9C4", fill_type="solid")
    for col_idx, val in enumerate(EXAMPLE_ROW, start=1):
        c = ws.cell(row=2, column=col_idx, value=val)
        c.fill = example_fill
    # Freeze first row
    ws.freeze_panes = "A2"

    # --- Foglio 2: Istruzioni ---
    ws2 = wb.create_sheet("Istruzioni")
    title_font = Font(bold=True, size=14, color="1565C0")
    for r_idx, row in enumerate(INSTRUCTIONS, start=1):
        for c_idx, val in enumerate(row, start=1):
            c = ws2.cell(row=r_idx, column=c_idx, value=val)
            if r_idx == 1:
                c.font = title_font
    ws2.column_dimensions["A"].width = 100

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_import_atleti.xlsx"},
    )


# -----------------------------
# Preview
# -----------------------------
class ImportPreviewRow(BaseModel):
    row_num: int
    status: str  # "ok" | "warning" | "error" | "duplicate_same_society" | "duplicate_other_society"
    issues: List[str] = []
    data: Dict[str, Any] = {}
    existing_athlete_id: Optional[str] = None


@router.post("/preview")
async def preview_import(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    """Riceve XLSX compilato → ritorna anteprima riga per riga con validazione."""
    _is_admin(current_user)
    society_id = current_user.get("society_id")

    from openpyxl import load_workbook
    try:
        content = await file.read()
        wb = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File XLSX non valido: {e}")

    if "Atleti" not in wb.sheetnames:
        raise HTTPException(status_code=400, detail="Foglio 'Atleti' non trovato nel file. Usa il template ufficiale.")
    ws = wb["Atleti"]

    # Prima riga = header, mappa colonne
    headers = [str(c.value).strip() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]
    header_map = {h: i for i, h in enumerate(headers)}

    # Precarica squadre della società (nome → id) per matching
    teams = await db.teams.find({"society_id": society_id}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    team_by_name = {t["name"].strip().lower(): t["id"] for t in teams}

    results: List[Dict[str, Any]] = []

    for r_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or all(v is None or (isinstance(v, str) and not v.strip()) for v in row):
            continue  # skip righe vuote
        # Estrai valori per nome colonna
        d = {h: (row[idx] if idx < len(row) else None) for h, idx in header_map.items()}

        # Skip riga esempio (se contiene "Esempio da cancellare" nella colonna Note)
        note_val = _cell(d, "Note")
        if "esempio" in note_val.lower():
            continue

        issues: List[str] = []
        cognome = _cell(d, "Cognome*")
        nome = _cell(d, "Nome*")
        cf = _cell(d, "Codice Fiscale*").upper()
        dob_raw = _cell(d, "Data Nascita (gg/mm/aaaa)*")

        if not cognome:
            issues.append("Cognome obbligatorio")
        if not nome:
            issues.append("Nome obbligatorio")
        if not cf:
            issues.append("Codice Fiscale obbligatorio")
        elif not is_valid_cf(cf):
            issues.append(f"Codice Fiscale non valido: {cf}")
        dob = parse_italian_date(d.get("Data Nascita (gg/mm/aaaa)*"))
        if not dob:
            issues.append(f"Data Nascita non valida (usa gg/mm/aaaa): {dob_raw}")

        sesso = _cell(d, "Sesso (M/F)").upper()
        if sesso and sesso not in ("M", "F"):
            issues.append(f"Sesso deve essere M o F: {sesso}")

        email = _cell(d, "Email").lower()
        if email and "@" not in email:
            issues.append(f"Email non valida: {email}")

        cap = _cell(d, "CAP")
        if cap and (len(cap) != 5 or not cap.isdigit()):
            issues.append(f"CAP deve essere 5 cifre: {cap}")

        squadra = _cell(d, "Squadra")
        team_id = None
        if squadra:
            team_id = team_by_name.get(squadra.lower())
            if not team_id:
                issues.append(f"Squadra non trovata: '{squadra}'. Verrà creato senza squadra.")

        # Sezione genitore
        parent_cf = _cell(d, "CF Genitore").upper()
        parent_email = _cell(d, "Email Genitore").lower()
        parent_data = None
        if parent_cf:
            if not is_valid_cf(parent_cf):
                issues.append(f"CF Genitore non valido: {parent_cf}")
            elif not (_cell(d, "Nome Genitore") and _cell(d, "Cognome Genitore")):
                issues.append("CF Genitore fornito ma Nome/Cognome Genitore mancante")
            else:
                parent_data = {
                    "first_name": _cell(d, "Nome Genitore"),
                    "last_name": _cell(d, "Cognome Genitore"),
                    "fiscal_code": parent_cf,
                    "email": parent_email or None,
                    "phone": _cell(d, "Telefono Genitore") or None,
                }

        # Duplicate detection
        status = "ok"
        existing_id = None
        if cf and is_valid_cf(cf):
            existing = await db.athletes.find_one(
                {"fiscal_code": {"$regex": f"^{cf}$", "$options": "i"}},
                {"_id": 0, "id": 1, "society_id": 1, "athlete_code": 1},
            )
            if existing:
                existing_id = existing["id"]
                if existing.get("society_id") == society_id:
                    status = "duplicate_same_society"
                    issues.append("CF già presente nella tua società → verrà AGGIORNATA l'anagrafica esistente")
                else:
                    status = "duplicate_other_society"
                    issues.append("CF presente in altra società → verrà creato NUOVO record (stesso athlete_code)")

        if issues and status == "ok":
            # Se ci sono errori bloccanti (Cognome/Nome/CF/DOB non validi), status = error
            blocking = any(
                any(k in i for k in ("obbligatorio", "non valida", "non valido"))
                for i in issues
            )
            status = "error" if blocking else "warning"

        results.append({
            "row_num": r_idx,
            "status": status,
            "issues": issues,
            "data": {
                "cognome": cognome,
                "nome": nome,
                "codice_fiscale": cf,
                "data_nascita": dob.strftime("%d/%m/%Y") if dob else "",
                "sesso": sesso,
                "email": email,
                "telefono": _cell(d, "Telefono"),
                "indirizzo": _cell(d, "Indirizzo"),
                "citta": _cell(d, "Città"),
                "cap": cap,
                "provincia": _cell(d, "Provincia").upper(),
                "squadra": squadra,
                "team_id": team_id,
                "note": _cell(d, "Note"),
                "parent": parent_data,
            },
            "existing_athlete_id": existing_id,
        })

    # Riepilogo
    summary = {
        "total": len(results),
        "ok": sum(1 for r in results if r["status"] == "ok"),
        "warning": sum(1 for r in results if r["status"] == "warning"),
        "error": sum(1 for r in results if r["status"] == "error"),
        "duplicate_same_society": sum(1 for r in results if r["status"] == "duplicate_same_society"),
        "duplicate_other_society": sum(1 for r in results if r["status"] == "duplicate_other_society"),
    }
    return {"summary": summary, "rows": results}


# -----------------------------
# Commit
# -----------------------------
class ImportCommitRow(BaseModel):
    row_num: int
    action: str  # "create" | "update" | "skip"
    data: Dict[str, Any]
    existing_athlete_id: Optional[str] = None


class ImportCommitRequest(BaseModel):
    rows: List[ImportCommitRow]


@router.post("/commit")
async def commit_import(req: ImportCommitRequest, current_user = Depends(get_current_user)):
    """Esegue import definitivo delle righe approvate dall'admin."""
    _is_admin(current_user)
    society_id = current_user.get("society_id")

    # Import locale per evitare dipendenze circolari
    from server import resolve_athlete_code_for_cf  # type: ignore

    created = 0
    updated = 0
    skipped = 0
    errors: List[Dict[str, Any]] = []
    parents_linked = 0

    for row in req.rows:
        try:
            if row.action == "skip":
                skipped += 1
                continue

            d = row.data
            cf = (d.get("codice_fiscale") or "").upper()
            if not is_valid_cf(cf):
                errors.append({"row_num": row.row_num, "error": "CF non valido"})
                continue

            # DOB parse
            dob = parse_italian_date(d.get("data_nascita"))

            # Base payload
            athlete_payload = {
                "society_id": society_id,
                "first_name": d.get("nome", "").title(),
                "last_name": d.get("cognome", "").upper(),
                "full_name": f"{d.get('cognome','').upper()} {d.get('nome','').title()}".strip(),
                "fiscal_code": cf,
                "date_of_birth": dob,
                "gender": d.get("sesso"),
                "email": d.get("email") or None,
                "phone": d.get("telefono") or None,
                "address": d.get("indirizzo") or None,
                "city": d.get("citta") or None,
                "postal_code": d.get("cap") or None,
                "province": d.get("provincia") or None,
                "team_id": d.get("team_id"),
                "status": "active",
                "is_withdrawn": False,
                "imported_from": "excel_legacy",
                "imported_at": datetime.now(timezone.utc).isoformat(),
                "imported_by": current_user["id"],
            }

            # Calcola is_minor da DOB
            if dob:
                today = datetime.utcnow()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                athlete_payload["is_minor"] = age < 18

            if row.action == "update" and row.existing_athlete_id:
                # Update: aggiorna solo campi non nulli (preservando team, storico, ecc.)
                update_set = {k: v for k, v in athlete_payload.items() if v is not None and k != "society_id"}
                await db.athletes.update_one({"id": row.existing_athlete_id}, {"$set": update_set})
                updated += 1
                athlete_id = row.existing_athlete_id
            else:
                # Create
                athlete_id = str(uuid.uuid4())
                # Codice atleta persistente per CF
                athlete_code = await resolve_athlete_code_for_cf(cf)
                athlete_payload.update({
                    "id": athlete_id,
                    "athlete_code": athlete_code,
                    "qr_identifier": athlete_code,
                    "created_at": datetime.now(timezone.utc),
                })
                await db.athletes.insert_one(athlete_payload)
                created += 1

            # Sezione genitore
            parent_data = d.get("parent")
            if parent_data and parent_data.get("fiscal_code"):
                pcf = parent_data["fiscal_code"].upper()
                existing_parent = await db.users.find_one(
                    {"fiscal_code": {"$regex": f"^{pcf}$", "$options": "i"}, "society_id": society_id, "role": "parent"},
                    {"_id": 0, "id": 1}
                )
                if existing_parent:
                    parent_id = existing_parent["id"]
                else:
                    parent_id = str(uuid.uuid4())
                    await db.users.insert_one({
                        "id": parent_id,
                        "society_id": society_id,
                        "role": "parent",
                        "first_name": parent_data.get("first_name", "").title(),
                        "last_name": parent_data.get("last_name", "").upper(),
                        "full_name": f"{parent_data.get('last_name','').upper()} {parent_data.get('first_name','').title()}".strip(),
                        "fiscal_code": pcf,
                        "email": (parent_data.get("email") or "").lower() or None,
                        "phone": parent_data.get("phone"),
                        "status": "pending_email",  # deve completare la registrazione (email link)
                        "imported_from": "excel_legacy",
                        "imported_at": datetime.now(timezone.utc).isoformat(),
                        "created_at": datetime.now(timezone.utc),
                    })
                # Link atleta ↔ genitore
                await db.athletes.update_one(
                    {"id": athlete_id},
                    {"$addToSet": {"parent_ids": parent_id}}
                )
                parents_linked += 1

        except Exception as e:
            errors.append({"row_num": row.row_num, "error": str(e)})

    return {
        "success": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "parents_linked": parents_linked,
        "errors": errors,
    }
