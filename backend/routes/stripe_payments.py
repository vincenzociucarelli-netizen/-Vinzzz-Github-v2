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
from datetime import datetime, timezone, timedelta
try:
    from zoneinfo import ZoneInfo
    _IT_TZ = ZoneInfo("Europe/Rome")
except Exception:  # pragma: no cover
    _IT_TZ = None

_IT_MONTHS = [
    "", "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
]


def _format_receipt_datetime(dt) -> str:
    """🆕 21/09/2026 — Formatta data/ora ricevuta nel fuso ITALIANO (Europe/Rome),
    con mese in italiano. Accetta datetime (naive=UTC o aware) o stringa ISO."""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return dt
    if not isinstance(dt, datetime):
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    if _IT_TZ is not None:
        dt = dt.astimezone(_IT_TZ)
    return f"{dt.day} {_IT_MONTHS[dt.month]} {dt.year}, {dt.strftime('%H:%M')}"

import logging
import os

import stripe

from database import db
from auth_utils import get_current_user
from utils import get_next_receipt_number


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


async def _get_payment_context(payment_id: str, current_user: dict, allow_paid: bool = False) -> tuple[dict, dict, dict]:
    """Restituisce (payment, athlete, society_settings) verificando che l'utente
    corrente sia autorizzato a pagare (genitore collegato, oppure admin di società).
    
    allow_paid=True: NON solleva se la rata è già pagata (usato da /checkout/status
    per confermare al frontend che il webhook ha già fatto il suo lavoro).
    """
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Rata non trovata")
    if payment.get("paid") and not allow_paid:
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
    partial_amount: Optional[float] = None  # 🆕 28/07/2026 — importo parziale (min 50€)


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
        base = "https://zaino-coach-hub.preview.emergentagent.com"
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
        base = "https://zaino-coach-hub.preview.emergentagent.com"
    success_url = f"{base}/parent/payment/success?session_id={{CHECKOUT_SESSION_ID}}&payment_id={payment_id}"
    cancel_url = f"{base}/parent/payment/cancel?payment_id={payment_id}"

    # Importo residuo in centesimi
    total_amount = float(payment.get("amount", 0))
    already_paid = float(payment.get("paid_amount") or 0)
    residual = round(total_amount - already_paid, 2)

    # 🆕 28/07/2026 — Pagamento parziale (min 50€) — vietato su piani ricorrenti
    charge_amount = residual
    is_partial = False
    if body.partial_amount is not None and body.partial_amount > 0:
        if payment.get("recurring_plan_id"):
            raise HTTPException(status_code=400, detail="Il pagamento parziale non è consentito sulle rate di un piano ricorrente")
        if body.partial_amount < 50:
            raise HTTPException(status_code=400, detail="L'importo minimo per un pagamento parziale è 50 €")
        if body.partial_amount > residual + 0.01:
            raise HTTPException(status_code=400, detail=f"L'importo richiesto (€ {body.partial_amount:.2f}) supera il residuo di € {residual:.2f}")
        charge_amount = round(body.partial_amount, 2)
        is_partial = charge_amount < residual - 0.01

    amount_cents = int(round(charge_amount * 100))
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")

    athlete_name = f"{athlete.get('first_name','')} {athlete.get('last_name','')}".strip() or "Atleta"
    base_desc = payment.get("description") or f"Rata iscrizione — {athlete_name}"
    desc = f"{base_desc} — Acconto € {charge_amount:.2f}" if is_partial else base_desc

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
                "partial": "1" if is_partial else "0",
                "charge_amount": str(charge_amount),
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
    payment, athlete, settings = await _get_payment_context(payment_id, current_user, allow_paid=True)
    society_sk = settings["stripe_secret_key"]

    # 🐛 16/07/2026 — Se il webhook ha già segnato la rata come pagata, ritorna
    # subito paid=True senza fare la call inutile a Stripe.
    if payment.get("paid"):
        return {"paid": True, "session_id": session_id}

    try:
        session = stripe.checkout.Session.retrieve(session_id, api_key=society_sk)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Errore Stripe: {str(e)}")

    if session.payment_status == "paid":
        # Aggiorno la rata se non ancora aggiornata (idempotente)
        already_paid = await db.payments.find_one({"id": payment_id, "paid": True})
        if not already_paid:
            set_paid = {
                "paid": True,
                "paid_date": datetime.now(timezone.utc),
                "payment_method": "stripe",
                "stripe_session_id": session_id,
                "stripe_payment_intent": session.payment_intent,
            }
            # 🆕 10/08/2026 — N. Prog. (ricevuta) anche via conferma-al-ritorno
            if not payment.get("receipt_number"):
                try:
                    set_paid["receipt_number"] = await get_next_receipt_number(db, athlete.get("society_id") or "")
                except Exception:
                    pass
            await db.payments.update_one({"id": payment_id}, {"$set": set_paid})
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

    # 🆕 27/07/2026 — Delega al modulo recurring_payments se l'evento è di attivazione piano
    try:
        from routes.recurring_payments import handle_recurring_activation_webhook, handle_recurring_charge_webhook
        if event_type == "checkout.session.completed":
            session = event["data"]["object"]
            metadata = session.get("metadata") or {}
            if metadata.get("type") == "recurring_activation":
                await handle_recurring_activation_webhook(session, society_id)
                return {"received": True, "type": event_type, "handled": "recurring_activation"}
        elif event_type in ("payment_intent.succeeded", "payment_intent.payment_failed"):
            if await handle_recurring_charge_webhook(event, society_id):
                return {"received": True, "type": event_type, "handled": "recurring_charge"}
    except Exception as _e:
        logger.exception(f"[stripe webhook] recurring delegate failed: {_e}")

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata") or {}
        payment_id = metadata.get("payment_id")
        if payment_id:
            # 🆕 28/07/2026 — Supporto pagamento parziale
            is_partial = metadata.get("partial") == "1"
            try:
                charge_amount = float(metadata.get("charge_amount") or 0)
            except (TypeError, ValueError):
                charge_amount = 0.0
            payment_doc = await db.payments.find_one({"id": payment_id})
            if payment_doc:
                total_amount = float(payment_doc.get("amount", 0) or 0)
                already_paid = float(payment_doc.get("paid_amount") or 0)
                new_paid = round(already_paid + (charge_amount if charge_amount > 0 else total_amount - already_paid), 2)
                is_fully_paid = new_paid >= total_amount - 0.01

                # Se il pagamento è già stato marcato come "paid" senza logic parziale
                # (webhook duplicato/redundant), non fare nulla
                already_full = payment_doc.get("paid") and not payment_doc.get("partial_payments")
                if not already_full:
                    now = datetime.now(timezone.utc)
                    set_updates = {
                        "paid_amount": new_paid,
                        "payment_method": "stripe",
                        "stripe_session_id": session.get("id"),
                        "stripe_payment_intent": session.get("payment_intent"),
                    }
                    if is_fully_paid:
                        set_updates["paid"] = True
                        set_updates["paid_date"] = now
                        # 🆕 10/08/2026 — Assegna il N. Prog. (ricevuta) anche agli incassi
                        # Stripe, come per contanti/bonifico, se non già presente.
                        if not payment_doc.get("receipt_number"):
                            try:
                                set_updates["receipt_number"] = await get_next_receipt_number(db, society_id)
                            except Exception:
                                logger.exception("[stripe webhook] receipt_number assignment failed")
                    await db.payments.update_one(
                        {"id": payment_id},
                        {
                            "$set": set_updates,
                            "$push": {
                                "partial_payments": {
                                    "amount": round(charge_amount if is_partial else total_amount - already_paid, 2),
                                    "stripe_session_id": session.get("id"),
                                    "stripe_payment_intent": session.get("payment_intent"),
                                    "paid_at": now,
                                    "is_partial": is_partial,
                                }
                            } if is_partial else {},
                        } if is_partial else {"$set": set_updates},
                    )
            # Aggiorna anche il log tentativo
            try:
                await db.stripe_payment_attempts.update_one(
                    {"id": session.get("id")},
                    {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc), "partial": is_partial, "charge_amount": charge_amount}},
                )
            except Exception:
                pass
            logger.info(f"[stripe webhook] payment {payment_id} paid via Stripe (society={society_id}, partial={is_partial}, amount={charge_amount})")

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


# ============================================================================
# 🆕 26/07/2026 — SCONTRINO STIPE (stile Nexi)
# ============================================================================

def _build_nexi_style_receipt_html(
    society: dict,
    athlete: dict,
    payment: dict,
    card_last4: Optional[str] = None,
    card_brand: Optional[str] = None,
    receipt_number: str = "",
    team_name: Optional[str] = None,
    total_installments: int = 0,
) -> str:
    """Genera HTML della ricevuta pagamento stile Nexi.
    Aperto in nuova tab dal frontend, l'utente può stampare/salvare come PDF."""
    society_name = (society.get("ragione_sociale") or society.get("society_name") or society.get("name") or "Società Sportiva").upper()
    society_logo = society.get("logo") or society.get("company_logo_base64") or ""
    if society_logo and not society_logo.startswith("data:"):
        society_logo = f"data:image/png;base64,{society_logo}"

    athlete_name = f"{athlete.get('last_name','')} {athlete.get('first_name','')}".strip()

    total_amount = float(payment.get("amount", 0) or 0)
    partial_payments = payment.get("partial_payments") or []
    # 🆕 28/07/2026 — Se ci sono pagamenti parziali, la ricevuta si riferisce all'ULTIMO acconto
    is_partial_receipt = False
    displayed_amount = total_amount
    residual_after = 0.0
    if partial_payments:
        # Ordina per data e prendi l'ultimo
        try:
            sorted_pp = sorted(partial_payments, key=lambda p: p.get("paid_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        except Exception:
            sorted_pp = partial_payments
        latest = sorted_pp[0]
        if latest.get("is_partial"):
            is_partial_receipt = True
            displayed_amount = float(latest.get("amount") or 0)
            paid_amount_total = float(payment.get("paid_amount") or 0)
            residual_after = max(0.0, round(total_amount - paid_amount_total, 2))
    amount = displayed_amount
    date_str = _format_receipt_datetime(payment.get("paid_date"))

    session_id = payment.get("stripe_session_id") or ""
    payment_intent = payment.get("stripe_payment_intent") or ""
    codice_aut = payment_intent[-8:].upper() if payment_intent else session_id[-8:].upper() if session_id else "-"
    card_display = f"**********{card_last4}" if card_last4 else "**********"
    card_brand_label = (card_brand or "carta").upper()

    # Numero ricevuta: last 6 di payment_id, uppercase
    if not receipt_number:
        pid = payment.get("id", "") or ""
        receipt_number = pid[-6:].upper() if len(pid) >= 6 else pid.upper()

    society_fc = society.get("fiscal_code") or society.get("company_tax_code") or ""
    society_addr_parts = [society.get("address") or "", society.get("city") or "", (f"({society.get('province')})" if society.get("province") else "")]
    society_addr = " ".join([p for p in society_addr_parts if p])

    # 🆕 27/07/2026 — Composizione descrizione più esplicita:
    # Priorità: installment_name > description > "Rata iscrizione"
    # Aggiunge "X di Y" se installment_number e total_installments disponibili
    # Aggiunge team_name e stagione come contesto (in una riga separata)
    inst_name = payment.get("installment_name") or ""
    inst_num = payment.get("installment_number")
    inst_desc = payment.get("description") or ""
    if inst_name:
        primary_desc = inst_name
    elif inst_num:
        primary_desc = f"Rata {inst_num}"
    else:
        primary_desc = inst_desc or "Rata iscrizione"
    # Aggiungi "X di Y" senza duplicare il numero se già presente
    if inst_num and total_installments and total_installments > 1:
        already_has_number = str(inst_num) in primary_desc
        already_has_of_total = f"di {total_installments}" in primary_desc
        if not already_has_number:
            # es. "Prima rata Iscrizione" → "Prima rata Iscrizione — 1 di 3"
            primary_desc = f"{primary_desc} — {inst_num} di {total_installments}"
        elif not already_has_of_total:
            # es. "Rata 2" → "Rata 2 di 3"
            primary_desc = f"{primary_desc} di {total_installments}"

    # 🆕 28/07/2026 — Prefisso "Acconto" se ricevuta parziale
    if is_partial_receipt:
        primary_desc = f"Acconto — {primary_desc}"

    # Riga contesto: [Squadra] · Stagione YYYY/YYYY
    context_parts = []
    if team_name:
        context_parts.append(team_name)
    season = payment.get("_resolved_season") or payment.get("season") or athlete.get("season") or ""
    if season:
        context_parts.append(f"Stagione {season}")
    context_line = " · ".join(context_parts)

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ricevuta pagamento — {society_name}</title>
  <style>
    @page {{ size: A4; margin: 20mm; }}
    * {{ box-sizing: border-box; -webkit-font-smoothing: antialiased; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0; padding: 24px 12px;
      background: #F5F7FA; color: #333;
    }}
    .wrap {{ max-width: 360px; margin: 0 auto; }}
    .logo-hdr {{
      text-align: center; margin-bottom: 18px;
    }}
    .logo-hdr img {{ max-width: 140px; max-height: 60px; object-fit: contain; }}
    .logo-hdr .brand {{
      font-size: 22px; font-weight: 800; color: #1a4b8f; letter-spacing: -0.5px;
    }}
    .receipt {{
      background: #fff; border-radius: 16px; padding: 24px 22px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #EAEDF2;
    }}
    .intro {{
      font-size: 13px; color: #666; margin: 0 0 6px 0; line-height: 1.4;
    }}
    .society-name {{
      font-size: 15px; font-weight: 700; color: #222; margin-bottom: 18px; text-transform: uppercase;
    }}
    .divider {{ height: 1px; background: #EAEDF2; margin: 14px 0; }}
    .label-amount {{ font-size: 13px; color: #666; margin-bottom: 4px; }}
    .amount {{
      font-size: 30px; font-weight: 800; color: #111; margin: 0 0 6px 0; letter-spacing: -0.5px;
    }}
    .date {{ font-size: 12px; color: #999; }}
    .row {{ margin: 10px 0; }}
    .row .k {{ font-size: 12px; font-weight: 700; color: #333; margin-bottom: 2px; }}
    .row .v {{ font-size: 13px; color: #444; font-family: "SF Mono", "Roboto Mono", monospace; letter-spacing: 0.3px; }}
    .status {{
      font-size: 13px; font-weight: 700; color: #2E7D32; margin: 10px 0 4px 0;
    }}
    .card-line {{
      font-size: 14px; color: #333; font-family: "SF Mono", "Roboto Mono", monospace; margin-bottom: 8px;
    }}
    .aut {{ font-size: 12px; color: #333; }}
    .aut .k {{ font-weight: 700; }}
    .footer-note {{
      font-size: 11px; color: #999; text-align: center; margin-top: 16px; line-height: 1.5;
    }}
    .powered {{
      text-align: center; font-size: 10px; color: #bbb; margin-top: 18px;
    }}
    .actions {{ text-align: center; margin: 18px 0 8px 0; }}
    .btn {{
      display: inline-block; padding: 10px 18px; border-radius: 8px;
      background: #635BFF; color: #fff; text-decoration: none; font-weight: 700;
      font-size: 13px; letter-spacing: 0.3px;
    }}
    @media print {{
      body {{ background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
      .actions {{ display: none; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo-hdr">
      {'<img src="' + society_logo + '" alt="logo" />' if society_logo else f'<div class="brand">{society_name}</div>'}
    </div>

    <div class="receipt">
      <p class="intro">Questa è la ricevuta del tuo pagamento presso:</p>
      <div class="society-name">{society_name}</div>

      <div class="divider"></div>

      <div class="label-amount">Importo{" pagato ora" if is_partial_receipt else " totale"}:</div>
      <div class="amount">€ {amount:,.2f}</div>
      <div class="date">{date_str}</div>
      {f'<div style="margin-top:10px; padding:10px 12px; background:#FFF3E0; border-radius:8px; border-left:4px solid #EF6C00;"><div style="font-size:11px; font-weight:700; color:#E65100;">ACCONTO PARZIALE</div><div style="font-size:13px; color:#333; margin-top:2px;">Importo totale rata: € {total_amount:,.2f}</div><div style="font-size:14px; font-weight:800; color:#E65100; margin-top:2px;">Residuo da pagare: € {residual_after:,.2f}</div></div>' if is_partial_receipt else ''}

      <div class="divider"></div>

      <div class="row">
        <div class="k">Atleta</div>
        <div class="v">{athlete_name or '-'}</div>
      </div>
      <div class="row">
        <div class="k">Descrizione</div>
        <div class="v">{primary_desc}</div>
        {f'<div style="font-size:11px; color:#888; margin-top:2px;">{context_line}</div>' if context_line else ''}
      </div>
      <div class="row">
        <div class="k">Numero ricevuta</div>
        <div class="v">{receipt_number or '-'}</div>
      </div>
      <div class="row">
        <div class="k">ID Transazione</div>
        <div class="v">{(payment_intent or session_id or '-')[:24]}</div>
      </div>
      {f'<div class="row"><div class="k">C.F. Società</div><div class="v">{society_fc}</div></div>' if society_fc else ''}

      <div class="divider"></div>

      <div class="status">✓ Transazione autorizzata</div>
      <div class="card-line">{card_display}{f' — {card_brand_label}' if card_last4 else ''}</div>

      <div class="aut">
        <span class="k">Codice AUT:</span> {codice_aut}
      </div>

      <div class="divider"></div>

      <div class="footer-note">
        Ti consigliamo di conservare nel tuo archivio<br/>
        una copia della ricevuta.
      </div>
    </div>

    <div class="actions">
      <a href="javascript:window.print()" class="btn">🖨 Stampa / Salva come PDF</a>
    </div>

    <div class="powered">Pagamento elaborato in sicurezza tramite Stripe · {society_addr or society_name}</div>
  </div>
</body>
</html>
"""


@router.get("/payments/{payment_id}/receipt", include_in_schema=True)
async def get_payment_receipt_html(payment_id: str, current_user=Depends(get_current_user)):
    """Ritorna HTML della ricevuta stile Nexi per una rata pagata via Stripe.
    L'utente può stamparla come PDF tramite il bottone integrato."""
    from fastapi.responses import HTMLResponse

    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Rata non trovata")
    if not payment.get("paid"):
        raise HTTPException(status_code=400, detail="Rata non ancora pagata")

    athlete = await db.athletes.find_one({"id": payment["athlete_id"]})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")

    society_id = athlete.get("society_id")
    # Autorizzazione: admin società, o genitore linkato, o atleta stesso
    role = current_user.get("role")
    ok = False
    if role in ("admin", "viewer") and current_user.get("society_id") == society_id:
        ok = True
    elif role == "parent" and current_user["id"] in [athlete.get("parent_id"), athlete.get("second_parent_id")]:
        ok = True
    elif role == "athlete" and (athlete.get("id") == current_user.get("id") or current_user.get("fiscal_code") == athlete.get("fiscal_code")):
        ok = True
    if not ok:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    # Società (settings profilo, non stripe)
    society_settings = await db.settings.find_one({"type": "society", "society_id": society_id}) or {}

    # 🆕 27/07/2026 — Ricostruisci descrizione più esplicita: "Rata X/Y — [Team] — Stagione YYYY/YYYY"
    team_name = None
    team_installments_count = 0
    team_season = None
    if athlete.get("team_id"):
        team = await db.teams.find_one({"id": athlete["team_id"]}, {"name": 1, "installments": 1, "season": 1})
        if team:
            team_name = team.get("name")
            team_season = team.get("season")
            # Prendi dalla configurazione squadra: più affidabile del count sui payment
            installments_cfg = team.get("installments") or []
            if isinstance(installments_cfg, list):
                team_installments_count = len(installments_cfg)

    # Stagione: prova più fonti (payment > team > athlete > stagione corrente società)
    if not payment.get("season") and not athlete.get("season") and not team_season:
        try:
            from utils import get_current_season_for_society
            fallback_season = await get_current_season_for_society(db, society_id)
        except Exception:
            fallback_season = None
    else:
        fallback_season = None
    payment["_resolved_season"] = payment.get("season") or team_season or athlete.get("season") or fallback_season

    # Totale rate: preferisci la config squadra; altrimenti conta i payment con installment_number
    total_installments = team_installments_count
    if not total_installments and payment.get("installment_number"):
        try:
            total_installments = await db.payments.count_documents({
                "athlete_id": athlete["id"],
                "society_id": society_id,
                "installment_number": {"$exists": True, "$ne": None},
            })
        except Exception:
            total_installments = 0

    # Card last4 / brand: prova a recuperare da Stripe se abbiamo il payment_intent
    card_last4 = None
    card_brand = None
    if payment.get("stripe_payment_intent") and payment.get("payment_method") == "stripe":
        stripe_settings = await db.settings.find_one({"type": "stripe", "society_id": society_id})
        if stripe_settings and stripe_settings.get("stripe_secret_key"):
            try:
                pi = stripe.PaymentIntent.retrieve(
                    payment["stripe_payment_intent"],
                    api_key=stripe_settings["stripe_secret_key"],
                    expand=["latest_charge.payment_method_details"],
                )
                charge = pi.get("latest_charge") if isinstance(pi, dict) else pi.latest_charge
                if charge:
                    pmd = charge.get("payment_method_details") if isinstance(charge, dict) else charge.payment_method_details
                    if pmd:
                        card = pmd.get("card") if isinstance(pmd, dict) else pmd.card
                        if card:
                            card_last4 = card.get("last4") if isinstance(card, dict) else card.last4
                            card_brand = card.get("brand") if isinstance(card, dict) else card.brand
            except Exception:
                pass  # non-blocking

    html = _build_nexi_style_receipt_html(
        society=society_settings,
        athlete=athlete,
        payment=payment,
        card_last4=card_last4,
        card_brand=card_brand,
        team_name=team_name,
        total_installments=total_installments,
    )
    return HTMLResponse(content=html, status_code=200)


# ============================================================================
# 🆕 27/07/2026 — RIMBORSO STRIPE (admin)
# ============================================================================

class RefundRequest(BaseModel):
    reason: str  # obbligatorio: motivo del rimborso
    amount: Optional[float] = None  # se None → rimborso totale


@router.post("/admin/payments/{payment_id}/refund")
async def admin_refund_payment(
    payment_id: str,
    data: RefundRequest,
    current_user=Depends(get_current_user),
):
    """Admin: rimborsa un pagamento Stripe (totale o parziale).
    Salva motivo, importo, admin autore e timestamp nel documento payment."""
    if current_user.get("role") not in ("admin", "viewer"):
        raise HTTPException(status_code=403, detail="Solo admin")

    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    if payment.get("society_id") != current_user.get("society_id"):
        raise HTTPException(status_code=403, detail="Pagamento di un'altra società")
    if not payment.get("paid"):
        raise HTTPException(status_code=400, detail="Il pagamento non risulta ancora incassato")
    if not payment.get("stripe_payment_intent"):
        raise HTTPException(status_code=400, detail="Solo pagamenti Stripe possono essere rimborsati da qui")
    if payment.get("refunded"):
        raise HTTPException(status_code=409, detail="Pagamento già completamente rimborsato")
    if not (data.reason or "").strip():
        raise HTTPException(status_code=400, detail="Il motivo è obbligatorio")

    settings = await _get_society_stripe_settings(payment["society_id"])
    sk = settings["stripe_secret_key"]

    # Calcola importo rimborso
    total_amount = float(payment.get("amount", 0))
    already_refunded = float(payment.get("refund_amount") or 0)
    remaining = total_amount - already_refunded
    if remaining <= 0:
        raise HTTPException(status_code=409, detail="Nessun importo residuo da rimborsare")

    refund_amount = data.amount if data.amount and data.amount > 0 else remaining
    if refund_amount > remaining + 0.001:
        raise HTTPException(status_code=400, detail=f"Importo richiesto (€ {refund_amount:.2f}) supera il residuo rimborsabile (€ {remaining:.2f})")

    try:
        refund = stripe.Refund.create(
            api_key=sk,
            payment_intent=payment["stripe_payment_intent"],
            amount=int(round(refund_amount * 100)),
            reason="requested_by_customer",
            metadata={
                "internal_reason": data.reason[:500],
                "admin_user_id": current_user["id"],
                "admin_email": current_user.get("email") or "",
                "payment_id": payment_id,
                "athlete_id": payment.get("athlete_id") or "",
            },
        )
    except stripe.error.StripeError as e:
        logger.exception("[refund] Stripe error")
        raise HTTPException(status_code=502, detail=f"Errore Stripe: {str(e)}")

    new_refund_amount = already_refunded + refund_amount
    is_full_refund = new_refund_amount >= total_amount - 0.001

    now = datetime.now(timezone.utc)
    update = {
        "refund_amount": round(new_refund_amount, 2),
        "last_refund_at": now,
        "last_refund_reason": data.reason,
        "last_refund_admin_id": current_user["id"],
        "last_refund_admin_email": current_user.get("email"),
        "last_refund_id": refund.id,
    }
    # Storico rimborsi
    await db.payments.update_one(
        {"id": payment_id},
        {
            "$set": {**update, "refunded": is_full_refund, "paid": False if is_full_refund else True},
            "$push": {
                "refunds_log": {
                    "stripe_refund_id": refund.id,
                    "amount": refund_amount,
                    "reason": data.reason,
                    "created_at": now,
                    "admin_id": current_user["id"],
                    "admin_email": current_user.get("email"),
                }
            },
        },
    )

    return {
        "message": f"Rimborso di € {refund_amount:.2f} effettuato",
        "refund_id": refund.id,
        "total_refunded_now": round(new_refund_amount, 2),
        "is_full_refund": is_full_refund,
        "stripe_status": refund.status,
    }


# ============================================================================
# 🆕 28/07/2026 — REMINDER RESIDUO ACCONTO (dopo 7 giorni)
# ============================================================================

async def _send_partial_reminder_email(payment: dict, athlete: dict, society_name: str, parent_email: str, parent_name: str):
    """Manda email al genitore per il residuo da saldare."""
    from email_service import send_transactional_email
    total = float(payment.get("amount", 0) or 0)
    paid_amount = float(payment.get("paid_amount", 0) or 0)
    residual = round(total - paid_amount, 2)
    ath_name = f"{athlete.get('first_name','')} {athlete.get('last_name','')}".strip()
    rata_desc = payment.get("installment_name") or payment.get("description") or "Rata"
    subject = f"⏰ Promemoria residuo € {residual:.2f} — {society_name}"
    html = f"""
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#F9A825,#EF6C00);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:22px;">⏰ Promemoria pagamento</h1>
        <p style="margin:8px 0 0;opacity:0.9;">{society_name}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e0e0e0;border-radius:0 0 12px 12px;">
        <p>Ciao <strong>{parent_name or ''}</strong>,</p>
        <p>Ti ricordiamo che sulla rata <strong>{rata_desc}</strong> di <strong>{ath_name}</strong> risulta ancora un residuo da saldare.</p>
        <div style="background:#FFF3E0;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #EF6C00;">
          <div style="font-size:12px;color:#666;">Importo totale rata</div>
          <div style="font-size:16px;font-weight:700;color:#333;">€ {total:.2f}</div>
          <div style="font-size:12px;color:#666;margin-top:8px;">Già versato</div>
          <div style="font-size:16px;font-weight:700;color:#2E7D32;">€ {paid_amount:.2f}</div>
          <div style="font-size:12px;color:#666;margin-top:8px;">Residuo da pagare</div>
          <div style="font-size:22px;font-weight:800;color:#EF6C00;">€ {residual:.2f}</div>
        </div>
        <p style="font-size:13px;color:#555;">
          Puoi completare il pagamento in qualsiasi momento dalla tua area genitore. Se hai difficoltà, contatta la segreteria della società.
        </p>
        <p style="font-size:12px;color:#999;margin-top:24px;text-align:center;">
          Cordiali saluti,<br><strong>{society_name}</strong>
        </p>
      </div>
    </div>
    """
    await send_transactional_email(
        to_email=parent_email,
        subject=subject,
        html_content=html,
        to_name=parent_name,
    )


async def process_partial_payment_reminders() -> dict:
    """Trova rate parzialmente pagate con acconto risalente a >7gg e nessun reminder inviato negli ultimi 7gg.
    Manda email al genitore. Aggiorna last_partial_reminder_sent_at."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    partials = await db.payments.find({
        "paid_amount": {"$gt": 0},
        "paid": {"$ne": True},
        "$expr": {"$lt": ["$paid_amount", "$amount"]},
    }).to_list(2000)

    stats = {"processed": 0, "sent": 0, "skipped": 0, "errors": 0}
    for p in partials:
        stats["processed"] += 1
        # Data dell'ultimo acconto
        pp = p.get("partial_payments") or []
        if not pp:
            stats["skipped"] += 1
            continue
        latest_dates = [x.get("paid_at") for x in pp if x.get("paid_at")]
        if not latest_dates:
            stats["skipped"] += 1
            continue
        try:
            last_paid_at = max(d for d in latest_dates if isinstance(d, datetime))
        except ValueError:
            stats["skipped"] += 1
            continue
        if last_paid_at > seven_days_ago:
            stats["skipped"] += 1
            continue
        # Dedup: se abbiamo già mandato un reminder negli ultimi 7 giorni, skippa
        last_reminder = p.get("last_partial_reminder_sent_at")
        if isinstance(last_reminder, datetime) and last_reminder > seven_days_ago:
            stats["skipped"] += 1
            continue

        athlete = await db.athletes.find_one({"id": p.get("athlete_id")})
        if not athlete:
            stats["skipped"] += 1
            continue
        # Ricava email genitore (primary o secondary)
        parent_email = None
        parent_name = None
        parent_id = athlete.get("parent_id") or athlete.get("second_parent_id")
        if parent_id:
            u = await db.users.find_one({"id": parent_id}, {"email": 1, "full_name": 1})
            if u:
                parent_email = u.get("email")
                parent_name = u.get("full_name")
        if not parent_email:
            stats["skipped"] += 1
            continue
        # Nome società
        soc = await db.settings.find_one({"type": "society", "society_id": p.get("society_id")}) or {}
        society_name = soc.get("ragione_sociale") or soc.get("society_name") or soc.get("name") or "Società"

        try:
            await _send_partial_reminder_email(p, athlete, society_name, parent_email, parent_name)
            await db.payments.update_one(
                {"id": p["id"]},
                {"$set": {"last_partial_reminder_sent_at": now}, "$inc": {"partial_reminder_count": 1}},
            )
            stats["sent"] += 1
            logger.info(f"[partial reminder] sent to {parent_email} for payment {p['id']}")
        except Exception as e:
            stats["errors"] += 1
            logger.warning(f"[partial reminder] failed for payment {p.get('id')}: {e}")
    return stats


async def partial_reminders_scheduler():
    """Background task: gira ogni 24h per inviare reminder sui residui > 7gg."""
    import asyncio as _asyncio
    await _asyncio.sleep(120)  # attesa 2min dopo startup
    while True:
        try:
            stats = await process_partial_payment_reminders()
            if stats["processed"] > 0:
                logger.info(f"[partial reminders scheduler] tick: {stats}")
        except Exception as e:
            logger.exception(f"[partial reminders scheduler] error: {e}")
        await _asyncio.sleep(24 * 3600)  # ogni 24 ore


@router.post("/admin/partial-payments/send-reminders")
async def admin_trigger_partial_reminders(current_user=Depends(get_current_user)):
    """Admin: trigger manuale dello scheduler dei reminder (per test/debug)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")
    return await process_partial_payment_reminders()
