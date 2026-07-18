"""
🆕 27/07/2026 — Piani di pagamento ricorrente Stripe (multi-tenant).

Flusso:
1. Admin crea un piano per un atleta (importo, N rate, frequenza) via
   POST /admin/recurring-plans → riceve un token univoco → genera link condivisibile.
2. Il genitore clicca il link → GET /public/recurring-plans/{token} → vede riepilogo.
3. Il genitore clicca "Attiva" → POST /public/recurring-plans/{token}/activate →
   crea Stripe Checkout Session in modalità PAYMENT + setup_future_usage=off_session.
4. Il webhook (in stripe_payments.py) al `checkout.session.completed` con
   metadata.type=recurring_activation:
     - salva stripe_customer_id + stripe_payment_method_id sul piano
     - marca il piano ACTIVE
     - sospende (nasconde) le rate classiche NON pagate dell'atleta
     - crea la 1ª riga in `payments` con stato paid=True (per lo scontrino)
     - calcola next_charge_date
5. Cron/scheduler backend addebita off-session le rate successive; endpoint
   admin `POST /admin/recurring-plans/{plan_id}/charge-now` esegue subito il
   prossimo addebito (utile per test in ambiente LIVE).

Design decisions:
- Le "rate ricorrenti" NON sono Subscription Stripe (che imporrebbe intervalli
  fissi); sono PaymentIntent one-shot off_session comandati dal nostro backend.
  Questo permette date custom (es. "il 10 di ogni mese") + logica business
  interna (sospensione rate classiche, ecc.).
- Frequenza: "fixed_day" (10 di ogni mese) o "days_from_previous" (30gg
  intervallo esatto dal precedente successo).
- Solo l'admin può cancellare/pausare/sbloccare un piano.
- L'attivazione del piano SOSPENDE le rate classiche non pagate ereditate
  dalla squadra (flag `superseded_by_plan_id`).
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging
import secrets
import stripe

from database import db
from auth_utils import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================================
# MODELLI
# ============================================================================

class CreateRecurringPlanRequest(BaseModel):
    athlete_id: str
    total_amount: float
    installments_count: int = Field(..., ge=2, le=24)
    installment_amounts: List[float]  # es. [1, 3, 3, 3]
    frequency_type: str = "fixed_day"  # "fixed_day" | "days_from_previous"
    fixed_day_of_month: int = 10  # se frequency_type=fixed_day
    frequency_days: int = 30  # se frequency_type=days_from_previous
    description: Optional[str] = None  # es. "Iscrizione stagione 2026/27"


# ============================================================================
# HELPERS
# ============================================================================

def _compute_next_charge_date(
    from_date: datetime,
    frequency_type: str,
    fixed_day_of_month: int = 10,
    frequency_days: int = 30,
) -> datetime:
    """Calcola la data del prossimo addebito.
    - fixed_day: prossimo giorno X del mese successivo (se X non esiste nel mese, ultimo giorno del mese).
    - days_from_previous: from_date + N giorni.
    """
    if frequency_type == "days_from_previous":
        return from_date + timedelta(days=frequency_days)

    # fixed_day: prossimo giorno X del mese successivo a from_date
    year = from_date.year
    month = from_date.month + 1
    if month > 12:
        month = 1
        year += 1
    day = fixed_day_of_month
    # Se il giorno non esiste nel mese (es. 31 feb), usa ultimo giorno del mese
    while True:
        try:
            return datetime(year, month, day, 12, 0, 0, tzinfo=timezone.utc)
        except ValueError:
            day -= 1
            if day < 1:
                return datetime(year, month, 1, 12, 0, 0, tzinfo=timezone.utc)


async def _get_society_stripe_settings(society_id: str) -> dict:
    """Recupera settings Stripe della società (versione locale)."""
    s = await db.settings.find_one({"type": "stripe", "society_id": society_id})
    if not s or not s.get("stripe_enabled"):
        raise HTTPException(status_code=400, detail="Stripe non abilitato per questa società")
    if not s.get("stripe_secret_key"):
        raise HTTPException(status_code=400, detail="Chiave segreta Stripe non configurata")
    return s


# ============================================================================
# ENDPOINT ADMIN
# ============================================================================

@router.post("/admin/recurring-plans")
async def create_recurring_plan(
    data: CreateRecurringPlanRequest,
    current_user=Depends(get_current_user),
):
    """Admin: crea un piano ricorrente per un atleta e ritorna il link di attivazione."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")

    society_id = current_user.get("society_id")
    if not society_id:
        raise HTTPException(status_code=400, detail="Società non identificata")

    ath = await db.athletes.find_one({"id": data.athlete_id})
    if not ath or ath.get("society_id") != society_id:
        raise HTTPException(status_code=404, detail="Atleta non trovato")

    # Validazioni base
    if len(data.installment_amounts) != data.installments_count:
        raise HTTPException(status_code=400, detail="Numero rate ≠ numero importi")
    if abs(sum(data.installment_amounts) - data.total_amount) > 0.01:
        raise HTTPException(status_code=400, detail="Somma importi rate ≠ importo totale")
    if any(a <= 0 for a in data.installment_amounts):
        raise HTTPException(status_code=400, detail="Ogni rata deve essere > 0")

    # Blocca se esiste già un piano attivo (o pending recente) per questo atleta
    existing_active = await db.recurring_plans.find_one({
        "athlete_id": data.athlete_id,
        "society_id": society_id,
        "status": {"$in": ["pending", "active", "paused"]},
    })
    if existing_active:
        raise HTTPException(
            status_code=409,
            detail=f"Esiste già un piano attivo/pending per questo atleta (id: {existing_active.get('id')}). Cancellalo prima di crearne uno nuovo.",
        )

    plan_id = secrets.token_urlsafe(8)
    activation_token = secrets.token_urlsafe(24)

    plan = {
        "id": plan_id,
        "society_id": society_id,
        "athlete_id": data.athlete_id,
        "athlete_name": f"{ath.get('first_name','')} {ath.get('last_name','')}".strip(),
        "parent_user_id": ath.get("parent_id"),  # primary parent atteso
        "status": "pending",
        "total_amount": round(data.total_amount, 2),
        "installments_count": data.installments_count,
        "installment_amounts": [round(a, 2) for a in data.installment_amounts],
        "frequency_type": data.frequency_type,
        "fixed_day_of_month": data.fixed_day_of_month,
        "frequency_days": data.frequency_days,
        "description": data.description or "Iscrizione",
        "start_date": None,  # settato all'attivazione
        "next_charge_date": None,
        "charges_completed": 0,
        "stripe_customer_id": None,
        "stripe_payment_method_id": None,
        "stripe_checkout_session_id": None,
        "activation_token": activation_token,
        "created_by": current_user["id"],
        "created_by_email": current_user.get("email"),
        "created_at": datetime.now(timezone.utc),
        "activated_at": None,
        "cancelled_at": None,
        "cancellation_reason": None,
        "superseded_payment_ids": [],
    }
    await db.recurring_plans.insert_one(plan)

    return {
        "plan_id": plan_id,
        "activation_token": activation_token,
        "activation_path": f"/recurring/{activation_token}",
        "athlete_name": plan["athlete_name"],
        "installments_count": data.installments_count,
        "total_amount": plan["total_amount"],
        "message": "Piano creato. Invia il link al genitore per l'attivazione.",
    }


@router.get("/admin/recurring-plans/athlete/{athlete_id}")
async def list_plans_for_athlete(athlete_id: str, current_user=Depends(get_current_user)):
    """Admin: elenca i piani ricorrenti di un atleta."""
    if current_user.get("role") not in ("admin", "viewer"):
        raise HTTPException(status_code=403, detail="Solo admin")
    society_id = current_user.get("society_id")
    plans = await db.recurring_plans.find(
        {"athlete_id": athlete_id, "society_id": society_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)
    # Arricchisci con charges log
    for p in plans:
        p["charges"] = await db.recurring_charges.find(
            {"plan_id": p["id"]}, {"_id": 0}
        ).sort("installment_number", 1).to_list(30)
    return plans


@router.post("/admin/recurring-plans/{plan_id}/cancel")
async def cancel_plan(plan_id: str, data: dict = None, current_user=Depends(get_current_user)):
    """Admin: cancella un piano. Sblocca le rate classiche originali."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")
    plan = await db.recurring_plans.find_one({"id": plan_id})
    if not plan or plan.get("society_id") != current_user.get("society_id"):
        raise HTTPException(status_code=404, detail="Piano non trovato")
    if plan["status"] in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail="Piano già cancellato/completato")

    reason = (data or {}).get("reason", "Cancellato dall'admin")
    await db.recurring_plans.update_one(
        {"id": plan_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc),
            "cancellation_reason": reason,
        }},
    )
    # Sblocca rate classiche sospese
    superseded_ids = plan.get("superseded_payment_ids") or []
    if superseded_ids:
        await db.payments.update_many(
            {"id": {"$in": superseded_ids}},
            {"$unset": {"superseded_by_plan_id": ""}},
        )
    return {"message": "Piano cancellato. Rate classiche sbloccate.", "restored_payments": len(superseded_ids)}


@router.post("/admin/recurring-plans/{plan_id}/charge-now")
async def charge_now(plan_id: str, current_user=Depends(get_current_user)):
    """Admin: esegue SUBITO il prossimo addebito programmato (utile per test)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")
    plan = await db.recurring_plans.find_one({"id": plan_id})
    if not plan or plan.get("society_id") != current_user.get("society_id"):
        raise HTTPException(status_code=404, detail="Piano non trovato")
    if plan["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Piano non attivo (status: {plan['status']})")

    return await _execute_next_charge(plan)


async def _execute_next_charge(plan: dict) -> dict:
    """Esegue il prossimo addebito off-session del piano."""
    next_installment_idx = plan.get("charges_completed", 0)
    if next_installment_idx >= plan["installments_count"]:
        # Marca completed
        await db.recurring_plans.update_one(
            {"id": plan["id"]},
            {"$set": {"status": "completed", "next_charge_date": None}},
        )
        return {"message": "Piano già completato", "status": "completed"}

    amount = plan["installment_amounts"][next_installment_idx]
    installment_number = next_installment_idx + 1

    society_settings = await _get_society_stripe_settings(plan["society_id"])
    sk = society_settings["stripe_secret_key"]

    charge_id = secrets.token_urlsafe(6)

    try:
        pi = stripe.PaymentIntent.create(
            api_key=sk,
            amount=int(round(amount * 100)),
            currency="eur",
            customer=plan["stripe_customer_id"],
            payment_method=plan["stripe_payment_method_id"],
            off_session=True,
            confirm=True,
            description=f"{plan.get('description') or 'Rata ricorrente'} — Rata {installment_number}/{plan['installments_count']} — {plan.get('athlete_name','')}",
            metadata={
                "type": "recurring_charge",
                "plan_id": plan["id"],
                "athlete_id": plan["athlete_id"],
                "installment_number": str(installment_number),
                "society_id": plan["society_id"],
            },
        )
    except stripe.error.CardError as e:
        # Fallito subito (es. carta scaduta/rifiutata)
        await db.recurring_charges.insert_one({
            "id": charge_id,
            "plan_id": plan["id"],
            "installment_number": installment_number,
            "amount": amount,
            "scheduled_date": plan.get("next_charge_date") or datetime.now(timezone.utc),
            "status": "failed",
            "stripe_payment_intent": e.error.payment_intent.id if getattr(e.error, "payment_intent", None) else None,
            "attempted_at": datetime.now(timezone.utc),
            "failure_reason": str(e.user_message or e),
            "retry_count": 0,
        })
        # Notifica admin
        try:
            admins = await db.users.find({
                "society_id": plan["society_id"], "role": "admin", "status": "approved"
            }).to_list(20)
            for adm in admins:
                await db.notifications.insert_one({
                    "id": secrets.token_urlsafe(8),
                    "user_id": adm["id"],
                    "type": "recurring_charge_failed",
                    "title": "Addebito ricorrente fallito",
                    "message": f"Rata {installment_number} di {plan.get('athlete_name','')}: {e.user_message or e}",
                    "data": {"plan_id": plan["id"], "athlete_id": plan["athlete_id"]},
                    "read": False,
                    "created_at": datetime.now(timezone.utc),
                })
        except Exception:
            pass
        raise HTTPException(status_code=402, detail=f"Carta rifiutata: {e.user_message or str(e)}")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Errore Stripe: {str(e)}")

    # Crea payment row per generare lo scontrino
    payment_id = secrets.token_urlsafe(8)
    now = datetime.now(timezone.utc)
    await db.payments.insert_one({
        "id": payment_id,
        "athlete_id": plan["athlete_id"],
        "society_id": plan["society_id"],
        "installment_number": installment_number,
        "installment_name": f"Rata {installment_number} — Piano Automatico",
        "amount": amount,
        "due_date": (plan.get("next_charge_date") or now).isoformat() if isinstance(plan.get("next_charge_date"), datetime) else plan.get("next_charge_date"),
        "paid": True,
        "paid_date": now,
        "payment_method": "stripe",
        "description": plan.get("description") or "Iscrizione",
        "stripe_payment_intent": pi.id,
        "stripe_customer_id": plan["stripe_customer_id"],
        "recurring_plan_id": plan["id"],
        "created_at": now,
    })

    # Log charge
    await db.recurring_charges.insert_one({
        "id": charge_id,
        "plan_id": plan["id"],
        "installment_number": installment_number,
        "amount": amount,
        "scheduled_date": plan.get("next_charge_date") or now,
        "status": "succeeded",
        "stripe_payment_intent": pi.id,
        "attempted_at": now,
        "succeeded_at": now,
        "payment_id": payment_id,
        "retry_count": 0,
    })

    # Aggiorna piano
    new_completed = next_installment_idx + 1
    is_last = new_completed >= plan["installments_count"]
    new_next_date = None
    new_status = "completed" if is_last else "active"
    if not is_last:
        new_next_date = _compute_next_charge_date(
            now,
            plan["frequency_type"],
            plan.get("fixed_day_of_month", 10),
            plan.get("frequency_days", 30),
        )

    await db.recurring_plans.update_one(
        {"id": plan["id"]},
        {"$set": {
            "charges_completed": new_completed,
            "next_charge_date": new_next_date,
            "status": new_status,
        }},
    )

    return {
        "message": f"Rata {installment_number} addebitata con successo",
        "amount": amount,
        "payment_intent": pi.id,
        "payment_id": payment_id,
        "next_charge_date": new_next_date.isoformat() if new_next_date else None,
        "status": new_status,
    }


# ============================================================================
# ENDPOINT PUBBLICO (genitore)
# ============================================================================

@router.get("/public/recurring-plans/{token}")
async def get_plan_by_token(token: str):
    """Pubblico: ritorna riepilogo del piano dato il token di attivazione."""
    plan = await db.recurring_plans.find_one({"activation_token": token})
    if not plan:
        raise HTTPException(status_code=404, detail="Link non valido o scaduto")

    society = await db.settings.find_one({"type": "society", "society_id": plan["society_id"]}) or {}
    society_name = society.get("ragione_sociale") or society.get("society_name") or society.get("name") or "Società Sportiva"
    society_logo = society.get("logo") or society.get("company_logo_base64") or None

    return {
        "plan_id": plan["id"],
        "status": plan["status"],
        "athlete_name": plan.get("athlete_name"),
        "total_amount": plan["total_amount"],
        "installments_count": plan["installments_count"],
        "installment_amounts": plan["installment_amounts"],
        "frequency_type": plan["frequency_type"],
        "fixed_day_of_month": plan.get("fixed_day_of_month"),
        "frequency_days": plan.get("frequency_days"),
        "description": plan.get("description"),
        "society_name": society_name,
        "society_logo": society_logo,
        "first_charge_amount": plan["installment_amounts"][0],
        "next_after_first_amount": plan["installment_amounts"][1] if plan["installments_count"] > 1 else 0,
    }


@router.post("/public/recurring-plans/{token}/activate")
async def activate_plan(token: str, request: Request):
    """Pubblico: attiva il piano creando una Stripe Checkout Session con
    setup_future_usage=off_session (memorizza la carta per addebiti futuri)."""
    plan = await db.recurring_plans.find_one({"activation_token": token})
    if not plan:
        raise HTTPException(status_code=404, detail="Link non valido")
    if plan["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Piano già in stato: {plan['status']}")

    society_settings = await _get_society_stripe_settings(plan["society_id"])
    sk = society_settings["stripe_secret_key"]

    # Costruisci URL di return
    # Priorità: env var PUBLIC_FRONTEND_URL, altrimenti dal Referer
    import os
    base_url = os.environ.get("PUBLIC_FRONTEND_URL")
    if not base_url:
        referer = request.headers.get("referer", "")
        if referer:
            from urllib.parse import urlparse
            u = urlparse(referer)
            base_url = f"{u.scheme}://{u.netloc}"
        else:
            base_url = f"{request.url.scheme}://{request.url.hostname}"

    success_url = f"{base_url}/recurring/{token}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base_url}/recurring/{token}"

    first_amount = plan["installment_amounts"][0]
    description = f"{plan.get('description','')} — Rata 1/{plan['installments_count']} — {plan.get('athlete_name','')}"

    try:
        # Cerca customer esistente per email del parent (opzionale, ottimizzazione)
        parent_email = None
        if plan.get("parent_user_id"):
            pu = await db.users.find_one({"id": plan["parent_user_id"]}, {"email": 1, "full_name": 1})
            if pu:
                parent_email = pu.get("email")

        session = stripe.checkout.Session.create(
            api_key=sk,
            mode="payment",
            payment_method_types=["card"],
            customer_email=parent_email,  # pre-fills; None = user types
            payment_intent_data={
                "setup_future_usage": "off_session",  # KEY: salva carta per addebiti futuri
                "description": description,
                "metadata": {
                    "type": "recurring_activation",
                    "plan_id": plan["id"],
                    "society_id": plan["society_id"],
                    "athlete_id": plan["athlete_id"],
                    "installment_number": "1",
                },
            },
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": description},
                    "unit_amount": int(round(first_amount * 100)),
                },
                "quantity": 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "type": "recurring_activation",
                "plan_id": plan["id"],
                "society_id": plan["society_id"],
            },
        )
    except stripe.error.StripeError as e:
        logger.exception("[recurring] activate checkout create failed")
        raise HTTPException(status_code=502, detail=f"Errore Stripe: {str(e)}")

    # Salva session_id sul piano per correlazione webhook
    await db.recurring_plans.update_one(
        {"id": plan["id"]},
        {"$set": {"stripe_checkout_session_id": session.id}},
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.get("/public/recurring-plans/{token}/success-status")
async def check_activation_status(token: str, session_id: str = ""):
    """Pubblico: controlla lo stato attivazione dopo il return da Stripe."""
    plan = await db.recurring_plans.find_one({"activation_token": token})
    if not plan:
        raise HTTPException(status_code=404, detail="Link non valido")
    return {
        "status": plan["status"],
        "charges_completed": plan.get("charges_completed", 0),
        "next_charge_date": plan.get("next_charge_date").isoformat() if isinstance(plan.get("next_charge_date"), datetime) else plan.get("next_charge_date"),
    }


# ============================================================================
# HELPER PER WEBHOOK (invocato da stripe_payments.py)
# ============================================================================

async def handle_recurring_activation_webhook(session: dict, society_id: str) -> Optional[str]:
    """Gestisce checkout.session.completed di attivazione piano ricorrente.
    Ritorna plan_id se gestito, None altrimenti."""
    metadata = session.get("metadata") or {}
    if metadata.get("type") != "recurring_activation":
        return None
    plan_id = metadata.get("plan_id")
    if not plan_id:
        return None

    plan = await db.recurring_plans.find_one({"id": plan_id})
    if not plan:
        logger.warning(f"[recurring webhook] plan {plan_id} not found")
        return None
    if plan.get("status") == "active":
        logger.info(f"[recurring webhook] plan {plan_id} already active (idempotent)")
        return plan_id

    # Recupera setup_intent / payment_intent per estrarre payment_method
    society_settings = await _get_society_stripe_settings(society_id)
    sk = society_settings["stripe_secret_key"]

    pi_id = session.get("payment_intent")
    customer_id = session.get("customer")
    pm_id = None
    try:
        if pi_id:
            pi = stripe.PaymentIntent.retrieve(pi_id, api_key=sk)
            pm_id = pi.payment_method
            # Se non abbiamo un customer, ne creiamo uno e attacchiamo il PM
            if not customer_id and pm_id:
                pm = stripe.PaymentMethod.retrieve(pm_id, api_key=sk)
                billing = pm.billing_details or {}
                customer_id = stripe.Customer.create(
                    api_key=sk,
                    email=billing.get("email"),
                    name=billing.get("name"),
                    metadata={"plan_id": plan_id, "athlete_id": plan["athlete_id"]},
                ).id
                stripe.PaymentMethod.attach(pm_id, customer=customer_id, api_key=sk)
                stripe.Customer.modify(
                    customer_id,
                    invoice_settings={"default_payment_method": pm_id},
                    api_key=sk,
                )
    except stripe.error.StripeError as e:
        logger.exception(f"[recurring webhook] failed to retrieve PI/PM for plan {plan_id}: {e}")

    now = datetime.now(timezone.utc)
    next_date = _compute_next_charge_date(
        now,
        plan["frequency_type"],
        plan.get("fixed_day_of_month", 10),
        plan.get("frequency_days", 30),
    )

    # Sospendi rate classiche NON pagate dell'atleta
    classic_payments = await db.payments.find({
        "athlete_id": plan["athlete_id"],
        "society_id": society_id,
        "paid": {"$ne": True},
        "recurring_plan_id": {"$exists": False},
    }, {"id": 1}).to_list(100)
    superseded_ids = [p["id"] for p in classic_payments]
    if superseded_ids:
        await db.payments.update_many(
            {"id": {"$in": superseded_ids}},
            {"$set": {"superseded_by_plan_id": plan_id}},
        )

    # Crea la 1ª riga payments (per scontrino della rata 1)
    first_payment_id = secrets.token_urlsafe(8)
    await db.payments.insert_one({
        "id": first_payment_id,
        "athlete_id": plan["athlete_id"],
        "society_id": society_id,
        "installment_number": 1,
        "installment_name": "Rata 1 — Piano Automatico",
        "amount": plan["installment_amounts"][0],
        "due_date": now.isoformat(),
        "paid": True,
        "paid_date": now,
        "payment_method": "stripe",
        "description": plan.get("description") or "Iscrizione",
        "stripe_payment_intent": pi_id,
        "stripe_session_id": session.get("id"),
        "stripe_customer_id": customer_id,
        "recurring_plan_id": plan_id,
        "created_at": now,
    })

    # Log della 1ª charge
    await db.recurring_charges.insert_one({
        "id": secrets.token_urlsafe(6),
        "plan_id": plan_id,
        "installment_number": 1,
        "amount": plan["installment_amounts"][0],
        "scheduled_date": now,
        "status": "succeeded",
        "stripe_payment_intent": pi_id,
        "attempted_at": now,
        "succeeded_at": now,
        "payment_id": first_payment_id,
        "retry_count": 0,
    })

    # Aggiorna piano
    is_single = plan["installments_count"] == 1
    await db.recurring_plans.update_one(
        {"id": plan_id},
        {"$set": {
            "status": "completed" if is_single else "active",
            "activated_at": now,
            "start_date": now,
            "next_charge_date": None if is_single else next_date,
            "stripe_customer_id": customer_id,
            "stripe_payment_method_id": pm_id,
            "charges_completed": 1,
            "superseded_payment_ids": superseded_ids,
        }},
    )

    logger.info(f"[recurring webhook] plan {plan_id} activated. customer={customer_id} pm={pm_id} superseded={len(superseded_ids)}")
    return plan_id


async def handle_recurring_charge_webhook(event: dict, society_id: str) -> bool:
    """Gestisce payment_intent.succeeded / payment_intent.payment_failed per addebiti off-session.
    Ritorna True se gestito."""
    event_type = event.get("type")
    obj = event.get("data", {}).get("object", {})
    metadata = obj.get("metadata") or {}
    if metadata.get("type") != "recurring_charge":
        return False

    plan_id = metadata.get("plan_id")
    installment_number = int(metadata.get("installment_number", "0") or 0)
    if not plan_id or not installment_number:
        return False

    # Il charge lo gestiamo già in _execute_next_charge (che aggiorna il piano),
    # quindi qui basta aggiornare lo stato del recurring_charge per idempotenza/audit.
    if event_type == "payment_intent.succeeded":
        await db.recurring_charges.update_one(
            {"plan_id": plan_id, "installment_number": installment_number},
            {"$set": {"status": "succeeded", "succeeded_at": datetime.now(timezone.utc), "stripe_payment_intent": obj.get("id")}},
            upsert=False,
        )
    elif event_type == "payment_intent.payment_failed":
        last_error = obj.get("last_payment_error", {}) or {}
        await db.recurring_charges.update_one(
            {"plan_id": plan_id, "installment_number": installment_number},
            {"$set": {"status": "failed", "failure_reason": last_error.get("message"), "attempted_at": datetime.now(timezone.utc)}},
            upsert=False,
        )
    return True
