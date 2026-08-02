"""
🆕 01/08/2026 — Storico Pagamenti (Admin).

Endpoint di sola lettura per la contabilità di fine anno:
- GET /api/admin/payments/history
    Restituisce tutti i pagamenti della società con filtri per intervallo date,
    stato (pagato/parziale/in attesa/non pagato/rimborsato) e metodo.
    Ogni riga include atleta, squadra, importo, stato, metodo e riferimenti Stripe.
    L'export CSV viene generato lato frontend a partire da queste righe (filtrabili
    ulteriormente per atleta), coerentemente con le altre pagine di export.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime, timezone, date

from database import db
from auth_utils import get_current_user

router = APIRouter()


def _to_date(value) -> Optional[date]:
    """Normalizza datetime/str in date (per confronti di intervallo)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except Exception:
            return None
    return None


def _to_iso(value) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat() if value.tzinfo else value.isoformat()
    if isinstance(value, str):
        return value
    return ""


def _compute_status(p: dict) -> str:
    """Deriva lo stato del pagamento per la contabilità."""
    amount = float(p.get("amount", 0) or 0)
    paid_amount = float(p.get("paid_amount") or 0)
    if p.get("refunded") or float(p.get("refund_amount") or 0) > 0:
        return "refunded"
    if p.get("paid"):
        return "paid"
    if paid_amount > 0 and paid_amount < amount - 0.01:
        return "partial"
    if p.get("payment_method") == "stripe_pending":
        return "pending"
    return "unpaid"


@router.get("/admin/payments/history")
async def get_payments_history(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD (inclusivo)"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD (inclusivo)"),
    status: str = Query("all", description="all|paid|partial|pending|unpaid|refunded"),
    method: str = Query("all", description="all|stripe|cash|bank_transfer|other"),
    current_user=Depends(get_current_user),
):
    """Storico pagamenti della società con filtri (sola lettura, admin/dirigente)."""
    if current_user.get("role") not in ("admin", "viewer"):
        raise HTTPException(status_code=403, detail="Solo admin")

    society_id = current_user.get("society_id")
    if not society_id:
        raise HTTPException(status_code=400, detail="Società non identificata")

    # Atleti della società (inclusi ritirati: servono per la contabilità storica)
    athletes = await db.athletes.find(
        {"society_id": society_id},
        {"id": 1, "first_name": 1, "last_name": 1, "team_id": 1},
    ).to_list(20000)
    athlete_map = {a["id"]: a for a in athletes}
    athlete_ids = list(athlete_map.keys())

    teams = await db.teams.find({"society_id": society_id}, {"id": 1, "name": 1}).to_list(500)
    team_map = {t["id"]: t.get("name", "") for t in teams}

    # Pagamenti: match per società diretta OR per atleta della società (copre record legacy)
    query = {"$or": [{"society_id": society_id}, {"athlete_id": {"$in": athlete_ids}}]}
    payments = await db.payments.find(query).to_list(100000)

    d_from = _to_date(date_from)
    d_to = _to_date(date_to)

    rows = []
    total_amount = 0.0
    total_paid = 0.0
    total_refunded = 0.0

    for p in payments:
        st = _compute_status(p)
        # Data "effettiva": pagamento se disponibile, altrimenti registrazione/creazione
        eff_raw = p.get("paid_date") or p.get("registration_date") or p.get("created_at")
        eff_date = _to_date(eff_raw)

        # Filtro intervallo date
        if d_from and (eff_date is None or eff_date < d_from):
            continue
        if d_to and (eff_date is None or eff_date > d_to):
            continue

        # Filtro stato
        if status != "all" and st != status:
            continue

        pm = p.get("payment_method") or ""
        pm_norm = "stripe" if pm.startswith("stripe") else (pm or "other")
        # Filtro metodo
        if method != "all":
            if method == "stripe" and not pm.startswith("stripe"):
                continue
            if method != "stripe" and pm_norm != method:
                continue

        athlete = athlete_map.get(p.get("athlete_id"), {})
        athlete_name = f"{athlete.get('last_name','')} {athlete.get('first_name','')}".strip() or "—"

        amount = float(p.get("amount", 0) or 0)
        paid_amount = float(p.get("paid_amount") or (amount if p.get("paid") else 0) or 0)
        refund_amount = float(p.get("refund_amount") or 0)

        total_amount += amount
        total_paid += paid_amount if st in ("paid", "partial") else 0.0
        total_refunded += refund_amount

        rows.append({
            "id": p.get("id"),
            "date": _to_iso(eff_raw),
            "athlete_id": p.get("athlete_id"),
            "athlete_name": athlete_name,
            "team_name": team_map.get(athlete.get("team_id"), ""),
            "description": p.get("installment_name") or p.get("description") or "",
            "method": pm_norm,
            "status": st,
            "amount": round(amount, 2),
            "paid_amount": round(paid_amount, 2),
            "refund_amount": round(refund_amount, 2),
            "refund_reason": p.get("last_refund_reason") or "",
            "receipt_number": p.get("receipt_number") or "",
            "stripe_payment_intent": p.get("stripe_payment_intent") or "",
        })

    # Ordina per data discendente (record senza data in fondo)
    rows.sort(key=lambda r: r.get("date") or "", reverse=True)

    return {
        "rows": rows,
        "totals": {
            "count": len(rows),
            "total_amount": round(total_amount, 2),
            "total_paid": round(total_paid, 2),
            "total_refunded": round(total_refunded, 2),
        },
    }



@router.get("/admin/payments/refunds")
async def get_refunds_report(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD (inclusivo)"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD (inclusivo)"),
    current_user=Depends(get_current_user),
):
    """Report Rimborsi Stripe della società: elenca ogni rimborso con atleta,
    importo, data, motivo e admin che l'ha gestito (sola lettura, admin/dirigente)."""
    if current_user.get("role") not in ("admin", "viewer"):
        raise HTTPException(status_code=403, detail="Solo admin")

    society_id = current_user.get("society_id")
    if not society_id:
        raise HTTPException(status_code=400, detail="Società non identificata")

    athletes = await db.athletes.find(
        {"society_id": society_id},
        {"id": 1, "first_name": 1, "last_name": 1, "team_id": 1},
    ).to_list(20000)
    athlete_map = {a["id"]: a for a in athletes}
    athlete_ids = list(athlete_map.keys())

    teams = await db.teams.find({"society_id": society_id}, {"id": 1, "name": 1}).to_list(500)
    team_map = {t["id"]: t.get("name", "") for t in teams}

    # Solo pagamenti con almeno un rimborso
    query = {
        "$and": [
            {"$or": [{"society_id": society_id}, {"athlete_id": {"$in": athlete_ids}}]},
            {"$or": [{"refunds_log": {"$exists": True, "$ne": []}}, {"refund_amount": {"$gt": 0}}]},
        ]
    }
    payments = await db.payments.find(query).to_list(100000)

    d_from = _to_date(date_from)
    d_to = _to_date(date_to)

    rows = []
    total_refunded = 0.0

    for p in payments:
        athlete = athlete_map.get(p.get("athlete_id"), {})
        athlete_name = f"{athlete.get('last_name','')} {athlete.get('first_name','')}".strip() or "—"
        team_name = team_map.get(athlete.get("team_id"), "")
        description = p.get("installment_name") or p.get("description") or ""

        log = p.get("refunds_log") or []
        # Fallback legacy: rimborso presente ma senza log dettagliato
        if not log and float(p.get("refund_amount") or 0) > 0:
            log = [{
                "stripe_refund_id": p.get("last_refund_id") or "",
                "amount": float(p.get("refund_amount") or 0),
                "reason": p.get("last_refund_reason") or "",
                "created_at": p.get("last_refund_at"),
                "admin_email": p.get("last_refund_admin_email") or "",
            }]

        for entry in log:
            ed = _to_date(entry.get("created_at"))
            if d_from and (ed is None or ed < d_from):
                continue
            if d_to and (ed is None or ed > d_to):
                continue
            amount = float(entry.get("amount") or 0)
            total_refunded += amount
            rows.append({
                "id": entry.get("stripe_refund_id") or f"{p.get('id')}",
                "payment_id": p.get("id"),
                "date": _to_iso(entry.get("created_at")),
                "athlete_name": athlete_name,
                "team_name": team_name,
                "description": description,
                "amount": round(amount, 2),
                "reason": entry.get("reason") or "",
                "admin_email": entry.get("admin_email") or "",
            })

    rows.sort(key=lambda r: r.get("date") or "", reverse=True)

    return {
        "rows": rows,
        "totals": {"count": len(rows), "total_refunded": round(total_refunded, 2)},
    }
