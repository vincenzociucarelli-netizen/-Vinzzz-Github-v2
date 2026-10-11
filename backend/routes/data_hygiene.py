"""
🆕 Igiene Dati (Admin).

GET /api/admin/data-hygiene
    Analizza gli anagrafici della società e restituisce le anomalie raggruppate
    per tipo (codice fiscale mancante/non valido/duplicato, atleti senza squadra,
    squadra inesistente, minorenni senza genitore, link genitore/utente orfani,
    genitori senza figli collegati, possibili doppioni, contatti mancanti).
    Sola lettura: la correzione avviene dalle schede atleta/genitore.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from auth_utils import get_current_user

router = APIRouter()

# CF italiano (ammessa omocodia: le cifre possono diventare lettere LMNPQRSTUV)
_CF_RE = re.compile(r"^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$")

ACTIVE_STATUSES = {"active", "approved", "trial", "pending_trial", "pending_decision", "pending_certificate", "pending"}


def _is_minor(a: dict) -> Optional[bool]:
    v = a.get("is_minor")
    if isinstance(v, bool):
        return v
    dob = a.get("date_of_birth")
    if not dob:
        return None
    try:
        dob_dt = datetime.fromisoformat(str(dob).replace("Z", "").split("T")[0]) if isinstance(dob, str) else dob
        today = datetime.utcnow()
        age = today.year - dob_dt.year - ((today.month, today.day) < (dob_dt.month, dob_dt.day))
        return age < 18
    except Exception:
        return None


def _name(a: dict) -> str:
    return (a.get("full_name") or f"{a.get('last_name', '')} {a.get('first_name', '')}").strip() or "—"


@router.get("/admin/data-hygiene")
async def get_data_hygiene(current_user=Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "coordinatore"):
        raise HTTPException(status_code=403, detail="Solo admin")
    society_id = current_user.get("society_id")
    if not society_id:
        raise HTTPException(status_code=400, detail="Società non identificata")

    athletes = await db.athletes.find(
        {"society_id": society_id},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "full_name": 1, "fiscal_code": 1,
         "date_of_birth": 1, "is_minor": 1, "team_id": 1, "parent_id": 1, "second_parent_id": 1,
         "user_id": 1, "status": 1, "is_withdrawn": 1, "email": 1, "phone": 1, "phone_athlete": 1},
    ).to_list(20000)
    teams = await db.teams.find({"society_id": society_id}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    team_map = {t["id"]: t.get("name", "") for t in teams}
    users = await db.users.find(
        {"society_id": society_id},
        {"_id": 0, "id": 1, "role": 1, "email": 1, "first_name": 1, "last_name": 1, "full_name": 1},
    ).to_list(50000)
    user_map = {u["id"]: u for u in users}
    # Gli account collegati (genitori/utenti) possono avere society_id diverso o
    # mancante (record legacy): per i controlli "orfano" verifichiamo l'esistenza globale.
    ref_ids = set()
    for a in athletes:
        for k in ("parent_id", "second_parent_id", "user_id"):
            if a.get(k):
                ref_ids.add(a[k])
    ref_users = {u["id"]: u for u in await db.users.find({"id": {"$in": list(ref_ids)}}, {"_id": 0, "id": 1, "email": 1}).to_list(50000)} if ref_ids else {}
    existing_ids = set(ref_users.keys())

    # Solo atleti "vivi" (non ritirati) per la maggior parte dei controlli
    live = [a for a in athletes if not a.get("is_withdrawn")]

    def item(a: dict, detail: str) -> dict:
        return {
            "athlete_id": a["id"],
            "name": _name(a),
            "team_name": team_map.get(a.get("team_id") or "", ""),
            "status": a.get("status") or "",
            "detail": detail,
        }

    checks = []

    # 1. CF mancante
    missing_cf = [item(a, "Codice fiscale non inserito") for a in live if not (a.get("fiscal_code") or "").strip()]
    checks.append({"key": "missing_fiscal_code", "title": "Codice fiscale mancante", "severity": "high",
                   "description": "Atleti senza codice fiscale: impossibile emettere ricevute e tesserare.",
                   "items": missing_cf})

    # 2. CF non valido (formato)
    invalid_cf = []
    for a in live:
        cf = (a.get("fiscal_code") or "").strip().upper()
        if cf and not _CF_RE.match(cf):
            invalid_cf.append(item(a, f"Formato non valido: {cf}"))
    checks.append({"key": "invalid_fiscal_code", "title": "Codice fiscale non valido", "severity": "high",
                   "description": "Il codice fiscale non rispetta il formato italiano (16 caratteri).",
                   "items": invalid_cf})

    # 3. CF duplicato (anche ritirati: due schede per la stessa persona)
    by_cf: dict = {}
    for a in athletes:
        cf = (a.get("fiscal_code") or "").strip().upper()
        if cf:
            by_cf.setdefault(cf, []).append(a)
    dup_cf = []
    for cf, group in by_cf.items():
        if len(group) > 1:
            for a in group:
                extra = " (ritirato)" if a.get("is_withdrawn") else ""
                dup_cf.append(item(a, f"CF {cf} presente su {len(group)} schede{extra}"))
    checks.append({"key": "duplicate_fiscal_code", "title": "Codice fiscale duplicato", "severity": "high",
                   "description": "Lo stesso codice fiscale compare su più schede atleta: probabile doppione da unire.",
                   "items": dup_cf})

    # 4. Possibile doppione per nome+cognome+data di nascita (senza CF uguale)
    by_person: dict = {}
    for a in athletes:
        key = (
            (a.get("first_name") or "").strip().lower(),
            (a.get("last_name") or "").strip().lower(),
            str(a.get("date_of_birth") or "")[:10],
        )
        if key[0] and key[1]:
            by_person.setdefault(key, []).append(a)
    dup_person = []
    for key, group in by_person.items():
        if len(group) > 1:
            cfs = {(a.get("fiscal_code") or "").strip().upper() for a in group}
            if len(cfs) == 1 and "" not in cfs:
                continue  # già segnalato come CF duplicato
            for a in group:
                extra = " (ritirato)" if a.get("is_withdrawn") else ""
                dup_person.append(item(a, f"Stesso nome e data di nascita su {len(group)} schede{extra}"))
    checks.append({"key": "duplicate_person", "title": "Possibile doppione (nome + data di nascita)", "severity": "medium",
                   "description": "Schede con stesso nome, cognome e data di nascita ma codice fiscale diverso o mancante.",
                   "items": dup_person})

    # 5. Data di nascita mancante
    missing_dob = [item(a, "Data di nascita non inserita") for a in live if not a.get("date_of_birth")]
    checks.append({"key": "missing_birth_date", "title": "Data di nascita mancante", "severity": "medium",
                   "description": "Senza data di nascita non è possibile stabilire se l'atleta è minorenne né la categoria.",
                   "items": missing_dob})

    # 6. Senza squadra / 7. Squadra inesistente
    no_team, orphan_team = [], []
    for a in live:
        tid = a.get("team_id")
        if not tid:
            if (a.get("status") or "") in ACTIVE_STATUSES:
                no_team.append(item(a, "Nessuna squadra assegnata"))
        elif tid not in team_map:
            orphan_team.append(item(a, f"Squadra non trovata (id {str(tid)[:8]}…)"))
    checks.append({"key": "no_team", "title": "Atleti senza squadra", "severity": "medium",
                   "description": "Atleti attivi o in prova non assegnati a nessuna squadra: non compaiono nei roster e nelle presenze.",
                   "items": no_team})
    checks.append({"key": "orphan_team", "title": "Squadra inesistente (orfani)", "severity": "high",
                   "description": "La squadra collegata è stata eliminata o appartiene a un'altra società.",
                   "items": orphan_team})

    # 8. Minorenni senza genitore / 9. Link genitore orfano / 10. Link utente orfano
    minor_no_parent, orphan_parent, orphan_user = [], [], []
    for a in live:
        p1, p2 = a.get("parent_id"), a.get("second_parent_id")
        minor = _is_minor(a)
        if minor and not p1 and not p2:
            minor_no_parent.append(item(a, "Minorenne senza genitore collegato"))
        for pid in (p1, p2):
            if pid and pid not in existing_ids:
                orphan_parent.append(item(a, f"Genitore collegato non esiste più (id {str(pid)[:8]}…)"))
        uid = a.get("user_id")
        if uid and uid not in existing_ids:
            orphan_user.append(item(a, f"Account utente collegato non esiste più (id {str(uid)[:8]}…)"))
    checks.append({"key": "minor_without_parent", "title": "Minorenni senza genitore", "severity": "high",
                   "description": "Atleti minorenni senza alcun genitore/tutore collegato: nessuno può firmare privacy e consensi.",
                   "items": minor_no_parent})
    checks.append({"key": "orphan_parent_link", "title": "Collegamento genitore orfano", "severity": "high",
                   "description": "L'atleta punta a un account genitore che non esiste più.",
                   "items": orphan_parent})
    checks.append({"key": "orphan_user_link", "title": "Collegamento account orfano", "severity": "medium",
                   "description": "L'atleta punta a un account utente eliminato: non potrà accedere all'app.",
                   "items": orphan_user})

    # 11. Genitori senza figli collegati
    linked_parent_ids = set()
    for a in athletes:
        for pid in (a.get("parent_id"), a.get("second_parent_id")):
            if pid:
                linked_parent_ids.add(pid)
    parents_no_children = []
    for u in users:
        if u.get("role") == "parent" and u["id"] not in linked_parent_ids:
            parents_no_children.append({
                "athlete_id": None,
                "user_id": u["id"],
                "name": (u.get("full_name") or f"{u.get('last_name', '')} {u.get('first_name', '')}").strip() or u.get("email", "—"),
                "team_name": "",
                "status": "parent",
                "detail": f"Genitore ({u.get('email', '')}) senza atleti collegati",
            })
    checks.append({"key": "parents_without_children", "title": "Genitori senza figli collegati", "severity": "low",
                   "description": "Account genitore registrati ma non collegati a nessun atleta.",
                   "items": parents_no_children})

    # 12. Contatti mancanti (maggiorenni senza email e telefono)
    missing_contacts = []
    for a in live:
        if _is_minor(a) is False and not (a.get("email") or a.get("phone") or a.get("phone_athlete")):
            u = ref_users.get(a.get("user_id") or "")
            if not (u and u.get("email")):
                missing_contacts.append(item(a, "Nessuna email né telefono"))
    checks.append({"key": "missing_contacts", "title": "Contatti mancanti (maggiorenni)", "severity": "low",
                   "description": "Atleti maggiorenni senza email né telefono: non raggiungibili per comunicazioni.",
                   "items": missing_contacts})

    for c in checks:
        c["items"].sort(key=lambda x: x["name"].lower())
        c["count"] = len(c["items"])

    severity_order = {"high": 0, "medium": 1, "low": 2}
    checks.sort(key=lambda c: (0 if c["count"] else 1, severity_order[c["severity"]]))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_athletes": len(live),
            "total_withdrawn": len(athletes) - len(live),
            "total_issues": sum(c["count"] for c in checks),
            "checks_with_issues": sum(1 for c in checks if c["count"]),
        },
        "checks": checks,
    }
