"""
Stripe Checkout multi-tenant.

🆕 16/07/2026 — Ogni società ha chiavi Stripe salvate a DB (BYOK: bring-your-own-key).
- POST /api/payments/{payment_id}/checkout
    Il genitore chiama per pagare una rata. Il backend:
      1. Verifica che il genitore sia effettivamente collegato all'atleta
      2. Legge le chiavi Stripe della società (da db.settings)
      3. Crea una Checkout Session passando api_key esplicitamente (NO global!)
      4. Ritorna checkout_url per la redirezione.

- POST /api/webhooks/stripe/{society_id}
    Endpoint dinamico per società. L'admin lo copia in Stripe Dashboard.
    Verifica firma con il whsec di QUELLA società (O(1) lookup).
    Su `checkout.session.completed` marca la rata come pagata (idempotente).

- GET /api/payments/{payment_id}/checkout/status?session_id=...
    Fallback lato client dopo il return da Stripe: consulta Stripe direttamente
    per aggiornare la UI in caso il webhook tardi.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging
import os

import stripe

from database import db
from auth_utils import get_current_user


router = APIRouter()
logger = logging.getLogger(__name__)


def _mask_key(k: Optional[str]) -> str:
    if not k or len(k) < 12:
        return "<not set>"
    return f"{k[:8]}…{k[-4:]}"


async def _get_society_stripe_settings(society_id: str) -> dict:
    """Recupera settings Stripe della società. Solleva se non abilitato/non configurato."""
    if not society_id:
        raise HTTPException(status_code=400, detail="Società non identificata")
    s = await db.settings.find_one({"type": "stripe", "society_id": society_id})
    if not s or not s.get("stripe_enabled"):
        raise HTTPException(status_code=400, detail="Stripe non abilitato per questa società")
    if not s.get("stripe_secret_key"):
        raise HTTPException(status_code=400, detail="Chiave segreta Stripe non configurata")
    return s


async def _get_payment_context(payment_id: str, current_user: dict) -> tuple[dict, dict, dict]:
    """Restituisce (payment, athlete, society_settings) verificando che l'utente
    corrente sia autorizzato a pagare (genitore collegato, oppure admin di società)."""
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Rata non trovata")
    if payment.get("paid"):
        raise HTTPException(status_code=400, detail="Rata già pagata")

    athlete = await db.athletes.find_one({"id": payment["athlete_id"]})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")

    society_id = athlete.get("society_id")
    if not society_id:
        raise HTTPException(status_code=400, detail="Atleta senza società")

    # Autorizzazione: admin della società, o genitore collegato
    role = current_user.get("role")
    is_authorized = False
    if role == "admin" and current_user.get("society_id") == society_id:
        is_authorized = True
    elif role == "parent":
        if current_user["id"] in [athlete.get("parent_id"), athlete.get("second_parent_id")]:
            is_authorized = True
    elif role == "athlete":
        # Atleta maggiorenne può pagare la propria rata
        if athlete.get("id") == current_user.get("id") or current_user.get("fiscal_code") == athlete.get("fiscal_code"):
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Non autorizzato a pagare questa rata")

    settings = await _get_society_stripe_settings(society_id)
    return payment, athlete, settings


class CheckoutRequest(BaseModel):
    return_url_base: Optional[str] = None  # frontend passa il proprio origin


class NewCheckoutRequest(BaseModel):
    """Per rate NON ancora salvate come payment record.
    Il flusso è: genitore vede la rata calcolata (paymentSettings.installments),
    clicca 'Paga con Carta', creiamo qui un payment record PENDING + Checkout Session.
    Al webhook flippiamo paid=true.
    """
    athlete_id: str
    amount: float
    description: str
    return_url_base: Optional[str] = None


@router.post("/payments/create-checkout")
async def create_pending_payment_and_checkout(
    body: NewCheckoutRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Crea un payment record PENDING + Stripe Checkout Session.
    Usato dalla scheda genitore per pagare la 'prossima rata' calcolata."""
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")

    athlete = await db.athletes.find_one({"id": body.athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")

    role = current_user.get("role")
    is_authorized = False
    if role == "admin" and current_user.get("society_id") == athlete.get("society_id"):
        is_authorized = True
    elif role == "parent":
        if current_user["id"] in [athlete.get("parent_id"), athlete.get("second_parent_id")]:
            is_authorized = True
    elif role == "athlete":
        if current_user.get("fiscal_code") == athlete.get("fiscal_code"):
            is_authorized = True
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    settings = await _get_society_stripe_settings(athlete["society_id"])

    # Crea payment record PENDING (non ancora pagato)
    import uuid
    payment_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    payment_doc = {
        "id": payment_id,
        "athlete_id": body.athlete_id,
        "society_id": athlete["society_id"],
        "amount": body.amount,
        "description": body.description,
        "paid": False,
        "payment_method": "stripe_pending",
        "created_at": now,
        "registration_date": now,
        "created_by": current_user.get("id"),
    }
    await db.payments.insert_one(payment_doc)

    # Riusa lo stesso builder di checkout URL
    # 🆕 16/07/2026 — URL dinamico: preferisci origin passato dal frontend, poi env,
    # poi X-Forwarded-Host della request (funziona in preview E in produzione).
    base = (body.return_url_base or os.environ.get("FRONTEND_URL") or "").rstrip("/")
    if not base:
        forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        forwarded_proto = request.headers.get("x-forwarded-proto", "https")
        if forwarded_host:
            base = f"{forwarded_proto}://{forwarded_host}"
    if not base:
        base = "https://registrateam-vol.preview.emergentagent.com"
    success_url = f"{base}/parent/payment/success?session_id={{CHECKOUT_SESSION_ID}}&payment_id={payment_id}"
    cancel_url = f"{base}/parent/payment/cancel?payment_id={payment_id}"

    athlete_name = f"{athlete.get('first_name','')} {athlete.get('last_name','')}".strip() or "Atleta"

    try:
        session = stripe.checkout.Session.create(
            api_key=settings["stripe_secret_key"],
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": settings.get("currency", "eur"),
                    "unit_amount": int(round(body.amount * 100)),
                    "product_data": {
                        "name": body.description,
                        "description": f"Atleta: {athlete_name}",
                    },
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "payment_id": payment_id,
                "society_id": athlete["society_id"],
                "athlete_id": body.athlete_id,
                "payer_user_id": current_user.get("id", ""),
            },
        )
    except stripe.error.StripeError as e:
        # Rollback: rimuovi il payment appena creato
        await db.payments.delete_one({"id": payment_id})
        raise HTTPException(status_code=502, detail=f"Errore Stripe: {str(e)}")

    try:
        await db.stripe_payment_attempts.insert_one({
            "id": session.id,
            "payment_id": payment_id,
            "society_id": athlete["society_id"],
            "athlete_id": body.athlete_id,
            "payer_user_id": current_user.get("id"),
            "amount": body.amount,
            "created_at": now,
            "status": "pending",
        })
    except Exception:
        pass

    return {"checkout_url": session.url, "session_id": session.id, "payment_id": payment_id}


@router.post("/payments/{payment_id}/checkout")
async def create_stripe_checkout(
    payment_id: str,
    body: CheckoutRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Crea una Stripe Checkout Session per la rata indicata."""
    payment, athlete, settings = await _get_payment_context(payment_id, current_user)

    society_sk = settings["stripe_secret_key"]
    society_id = athlete["society_id"]

    # Costruisci URL di ritorno frontend (dinamico preview↔produzione)
    base = (body.return_url_base or os.environ.get("FRONTEND_URL") or "").rstrip("/")
    if not base:
        forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        forwarded_proto = request.headers.get("x-forwarded-proto", "https")
        if forwarded_host:
            base = f"{forwarded_proto}://{forwarded_host}"
    if not base:
        base = "https://registrateam-vol.preview.emergentagent.com"
    success_url = f"{base}/parent/payment/success?session_id={{CHECKOUT_SESSION_ID}}&payment_id={payment_id}"
    cancel_url = f"{base}/parent/payment/cancel?payment_id={payment_id}"

    # Importo residuo in centesimi
    amount_cents = int(round(float(payment.get("amount", 0)) * 100))
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")

    athlete_name = f"{athlete.get('first_name','')} {athlete.get('last_name','')}".strip() or "Atleta"
    desc = payment.get("description") or f"Rata iscrizione — {athlete_name}"

    try:
        session = stripe.checkout.Session.create(
            api_key=society_sk,  # multi-tenant: MAI globale!
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": settings.get("currency", "eur"),
                    "unit_amount": amount_cents,
                    "product_data": {
                        "name": desc,
                        "description": f"Atleta: {athlete_name}",
                    },
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "payment_id": payment_id,
                "society_id": society_id,
                "athlete_id": athlete["id"],
                "payer_user_id": current_user.get("id", ""),
            },
        )
    except stripe.error.StripeError as e:
        logger.exception("[stripe] checkout create failed")
        raise HTTPException(status_code=502, detail=f"Errore Stripe: {getattr(e, 'user_message', None) or str(e)}")

    # Log tentativo (audit + fallback per webhook lento)
    try:
        await db.stripe_payment_attempts.insert_one({
            "id": session.id,
            "payment_id": payment_id,
            "society_id": society_id,
            "athlete_id": athlete["id"],
            "payer_user_id": current_user.get("id"),
            "amount": payment.get("amount"),
            "created_at": datetime.now(timezone.utc),
            "status": "pending",
        })
    except Exception:
        pass

    return {"checkout_url": session.url, "session_id": session.id}


@router.get("/payments/{payment_id}/checkout/status")
async def get_checkout_status(
    payment_id: str,
    session_id: str,
    current_user=Depends(get_current_user),
):
    """Fallback client-side: interroga Stripe direttamente dopo il redirect di
    success per aggiornare la UI immediatamente anche se il webhook tarda.
    Idempotente: non altera lo stato se già pagata."""
    payment, athlete, settings = await _get_payment_context(payment_id, current_user)
    society_sk = settings["stripe_secret_key"]

    try:
        session = stripe.checkout.Session.retrieve(session_id, api_key=society_sk)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Errore Stripe: {str(e)}")

    if session.payment_status == "paid":
        # Aggiorno la rata se non ancora aggiornata (idempotente)
        already_paid = await db.payments.find_one({"id": payment_id, "paid": True})
        if not already_paid:
            await db.payments.update_one(
                {"id": payment_id},
                {"$set": {
                    "paid": True,
                    "paid_date": datetime.now(timezone.utc),
                    "payment_method": "stripe",
                    "stripe_session_id": session_id,
                    "stripe_payment_intent": session.payment_intent,
                }},
            )
        return {"paid": True, "session_id": session_id}

    return {"paid": False, "status": session.payment_status}


# --- Webhook: NON usa dipendenze auth (Stripe autentica via firma) ---
@router.post("/webhooks/stripe/{society_id}", include_in_schema=False)
async def stripe_webhook(society_id: str, request: Request):
    """Endpoint webhook dinamico per società.
    L'admin deve configurare in Stripe Dashboard:
      URL: https://<preview_url>/api/webhooks/stripe/{society_id}
      Event: checkout.session.completed (almeno).
    """
    s = await db.settings.find_one({"type": "stripe", "society_id": society_id})
    if not s or not s.get("stripe_webhook_secret"):
        raise HTTPException(status_code=404, detail="Webhook non configurato per questa società")

    whsec = s["stripe_webhook_secret"]
    payload = await request.body()  # raw bytes richiesti per verifica firma
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, whsec)
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload non valido")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Firma non valida")

    event_type = event.get("type")

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        payment_id = (session.get("metadata") or {}).get("payment_id")
        if payment_id:
            # Idempotente: non riaggiornare se già pagato
            already = await db.payments.find_one({"id": payment_id, "paid": True})
            if not already:
                await db.payments.update_one(
                    {"id": payment_id},
                    {"$set": {
                        "paid": True,
                        "paid_date": datetime.now(timezone.utc),
                        "payment_method": "stripe",
                        "stripe_session_id": session.get("id"),
                        "stripe_payment_intent": session.get("payment_intent"),
                    }},
                )
            # Aggiorna anche il log tentativo
            try:
                await db.stripe_payment_attempts.update_one(
                    {"id": session.get("id")},
                    {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc)}},
                )
            except Exception:
                pass
            logger.info(f"[stripe webhook] payment {payment_id} paid via Stripe (society={society_id})")

    elif event_type == "checkout.session.expired":
        session = event["data"]["object"]
        payment_id = (session.get("metadata") or {}).get("payment_id")
        try:
            await db.stripe_payment_attempts.update_one(
                {"id": session.get("id")},
                {"$set": {"status": "expired"}},
            )
        except Exception:
            pass
        # Rimuovi i payment PENDING creati da /payments/create-checkout se scaduti
        if payment_id:
            await db.payments.delete_one({
                "id": payment_id,
                "paid": False,
                "payment_method": "stripe_pending",
            })

    return {"received": True, "type": event_type}


@router.get("/settings/stripe/webhook-url")
async def get_webhook_url_for_admin(request: Request, current_user=Depends(get_current_user)):
    """Ritorna l'URL webhook che l'admin deve incollare in Stripe Dashboard.
    🆕 16/07/2026 — URL dinamico: usa l'host della request corrente (preview OR produzione)
    così l'admin vede sempre il dominio giusto per il suo ambiente."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")
    sid = current_user.get("society_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Società non identificata")

    # Priorità: env var esplicita > header X-Forwarded-Host (dietro proxy Kubernetes) > host della request
    base = os.environ.get("PUBLIC_BACKEND_URL")
    if not base:
        forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        forwarded_proto = request.headers.get("x-forwarded-proto", "https")
        if forwarded_host:
            base = f"{forwarded_proto}://{forwarded_host}"
        else:
            base = str(request.base_url).rstrip("/")

    return {
        "webhook_url": f"{base.rstrip('/')}/api/webhooks/stripe/{sid}",
        "events_to_subscribe": ["checkout.session.completed", "checkout.session.expired"],
    }


@router.get("/settings/stripe/public")
async def get_stripe_public_status(current_user=Depends(get_current_user)):
    """Endpoint pubblico (any authenticated user della società): dice se Stripe è
    abilitato. Usato dal frontend genitore per mostrare/nascondere 'Paga con Carta'."""
    sid = current_user.get("society_id")
    if not sid and current_user.get("role") == "parent":
        # Un genitore può avere figli in società; prendi la prima
        ath = await db.athletes.find_one({"parent_id": current_user.get("id")}, {"society_id": 1})
        if ath:
            sid = ath.get("society_id")
    if not sid:
        return {"stripe_enabled": False}
    s = await db.settings.find_one({"type": "stripe", "society_id": sid})
    return {"stripe_enabled": bool(s and s.get("stripe_enabled"))}
