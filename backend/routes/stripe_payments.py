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

    amount = float(payment.get("amount", 0) or 0)
    paid_date = payment.get("paid_date")
    if isinstance(paid_date, datetime):
        date_str = paid_date.strftime("%d %B %Y, %H:%M")
    elif isinstance(paid_date, str):
        try:
            dt = datetime.fromisoformat(paid_date.replace("Z", "+00:00"))
            date_str = dt.strftime("%d %B %Y, %H:%M")
        except Exception:
            date_str = paid_date
    else:
        date_str = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M")

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

      <div class="label-amount">Importo totale:</div>
      <div class="amount">€ {amount:,.2f}</div>
      <div class="date">{date_str}</div>

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
