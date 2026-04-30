"""
Society and Stripe settings routes.
- /settings/society/logo.png (public)
- /settings/society (GET public, PATCH admin)
- /settings/stripe (GET, PATCH, DELETE keys - admin only)
"""
import base64
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from database import db
from auth_utils import get_current_user
from models.enums import UserRole
from models.settings_models import SocietySettingsUpdate, StripeSettingsUpdate

router = APIRouter()


@router.get("/settings/society/logo.png")
async def get_society_logo_image():
    """Serve society logo as PNG image (public, for email embedding)."""
    settings = await db.settings.find_one({"type": "society"}, {"_id": 0, "logo": 1})
    if not settings or not settings.get("logo"):
        raise HTTPException(status_code=404, detail="Logo non trovato")
    logo_bytes = base64.b64decode(settings["logo"])
    return Response(content=logo_bytes, media_type="image/png")


@router.get("/settings/society")
async def get_society_settings():
    """Get society settings (public endpoint - no auth required for logo display)."""
    settings = await db.settings.find_one({"type": "society"})
    if not settings:
        return {
            "name": "Società Sportiva",
            "logo": None,
            "logo_size": 50,
            "sport_image": None,
            "athlete_roles": [],
            "athlete_characteristics": [],
            "dirigente_qualifications": [],
            "venues": [],
            "ragione_sociale": None,
            "sport_praticato": None,
            "address": None,
            "postal_code": None,
            "city": None,
            "province": None,
            "fiscal_code": None,
            "partita_iva": None,
            "phone": None,
            "phone2": None,
            "president_name": None,
            "stamp_signature": None,
            "iban": None,
            "bank_name": None,
            "affiliations": [],
        }
    return {
        "name": settings.get("name", "Società Sportiva"),
        "logo": settings.get("logo"),
        "logo_size": settings.get("logo_size", 50),
        "sport_image": settings.get("sport_image"),
        "athlete_roles": settings.get("athlete_roles", []),
        "athlete_characteristics": settings.get("athlete_characteristics", []),
        "dirigente_qualifications": settings.get("dirigente_qualifications", []),
        "venues": settings.get("venues", []),
        "ragione_sociale": settings.get("ragione_sociale"),
        "sport_praticato": settings.get("sport_praticato"),
        "sport_type": settings.get("sport_type") or settings.get("sport_praticato"),
        "address": settings.get("address"),
        "postal_code": settings.get("postal_code"),
        "city": settings.get("city"),
        "province": settings.get("province"),
        "fiscal_code": settings.get("fiscal_code"),
        "partita_iva": settings.get("partita_iva"),
        "phone": settings.get("phone"),
        "phone2": settings.get("phone2"),
        "president_name": settings.get("president_name"),
        "stamp_signature": settings.get("stamp_signature"),
        "email": settings.get("email"),
        "pec": settings.get("pec"),
        "pro_enabled": settings.get("pro_enabled", False),
        "season_start_month": settings.get("season_start_month", 7),
        "season_start_day": settings.get("season_start_day", 1),
        "block_expired_certificates": settings.get("block_expired_certificates", True),
        "override_keep_disabled": settings.get("override_keep_disabled", False),
        "override_auto_reactivate_at": settings.get("override_auto_reactivate_at"),
        "override_deactivation_reason": settings.get("override_deactivation_reason"),
        "override_deactivated_by_name": settings.get("override_deactivated_by_name"),
        "override_deactivated_at": settings.get("override_deactivated_at"),
        "iban": settings.get("iban"),
        "bank_name": settings.get("bank_name"),
        "affiliations": settings.get("affiliations", []),
        "season_end_month": settings.get("season_end_month", 6),
        "season_end_day": settings.get("season_end_day", 30),
        "trial_max_days": settings.get("trial_max_days", 7),
        "trial_max_sessions": settings.get("trial_max_sessions", 3),
    }


@router.patch("/settings/society")
async def update_society_settings(request: Request, data: SocietySettingsUpdate, current_user = Depends(get_current_user)):
    """Update society settings (admin only)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare le impostazioni")
    
    # Get client IP
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    update_dict = {}
    fields = [
        "name", "logo", "logo_size", "athlete_roles", "athlete_characteristics",
        "dirigente_qualifications", "venues", "sport_image",
        "ragione_sociale", "sport_praticato", "address", "postal_code", "city",
        "province", "fiscal_code", "partita_iva", "phone", "phone2",
        "president_name", "stamp_signature", "email", "pec", "pro_enabled",
        "season_start_month", "season_start_day",
        "season_end_month", "season_end_day",
        "iban", "bank_name", "affiliations"
    ]
    for f in fields:
        v = getattr(data, f, None)
        if v is not None:
            update_dict[f] = v
    
    # block_expired_certificates: special handling with audit log + auto-reactivation
    if data.block_expired_certificates is not None:
        current_settings = await db.settings.find_one({"type": "society"})
        old_value = current_settings.get("block_expired_certificates", True) if current_settings else True
        new_value = data.block_expired_certificates

        # When DISABLING: require reason (min 5 chars) and record audit + schedule auto-reactivate
        if not new_value:
            reason = (data.override_deactivation_reason or "").strip()
            if len(reason) < 5:
                raise HTTPException(
                    status_code=400,
                    detail="Motivo obbligatorio (minimo 5 caratteri) per disattivare il blocco certificati."
                )
            keep_disabled = bool(data.override_keep_disabled)

            # Compute next midnight Italy time (Europe/Rome ≈ UTC+1 / UTC+2 DST)
            # Approx: current Italy time = UTC+1. Next midnight Italy in UTC = today 23:00 or 22:00 UTC (DST).
            # Use Europe/Rome explicit via datetime
            try:
                from zoneinfo import ZoneInfo
                now_it = datetime.now(ZoneInfo("Europe/Rome"))
                next_midnight_it = (now_it + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                next_midnight_utc = next_midnight_it.astimezone(timezone.utc)
            except Exception:
                next_midnight_utc = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=23, minute=0, second=0, microsecond=0)

            update_dict["block_expired_certificates"] = False
            update_dict["override_keep_disabled"] = keep_disabled
            update_dict["override_deactivation_reason"] = reason
            update_dict["override_deactivated_by"] = current_user["id"]
            update_dict["override_deactivated_by_name"] = current_user.get("full_name") or current_user.get("email")
            update_dict["override_deactivated_at"] = datetime.now(timezone.utc).isoformat()
            update_dict["override_auto_reactivate_at"] = None if keep_disabled else next_midnight_utc.isoformat()
            # Clear per-day first-login dismissal so banner/popup show again
            update_dict["override_last_admin_seen_date"] = None

            await db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "user_email": current_user.get("email", ""),
                "user_name": current_user.get("full_name", ""),
                "society_id": current_user.get("society_id", ""),
                "action": "certificate_block_disabled",
                "details": {
                    "old_value": old_value,
                    "new_value": False,
                    "reason": reason,
                    "keep_disabled": keep_disabled,
                    "auto_reactivate_at": None if keep_disabled else next_midnight_utc.isoformat(),
                },
                "ip_address": client_ip,
                "created_at": datetime.now(timezone.utc),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        else:
            # RE-ENABLING: clear all override metadata and log
            update_dict["block_expired_certificates"] = True
            update_dict["override_keep_disabled"] = False
            update_dict["override_auto_reactivate_at"] = None
            update_dict["override_deactivation_reason"] = None
            update_dict["override_deactivated_by"] = None
            update_dict["override_deactivated_by_name"] = None
            update_dict["override_deactivated_at"] = None

            if old_value is False:
                await db.audit_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["id"],
                    "user_email": current_user.get("email", ""),
                    "user_name": current_user.get("full_name", ""),
                    "society_id": current_user.get("society_id", ""),
                    "action": "certificate_block_enabled",
                    "details": {"old_value": False, "new_value": True, "source": "manual"},
                    "ip_address": client_ip,
                    "created_at": datetime.now(timezone.utc),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
    
    # trial settings: clamp values
    if data.trial_max_days is not None:
        update_dict["trial_max_days"] = max(3, min(15, data.trial_max_days))
    if data.trial_max_sessions is not None:
        update_dict["trial_max_sessions"] = max(1, min(5, data.trial_max_sessions))
    
    if update_dict:
        await db.settings.update_one(
            {"type": "society"},
            {"$set": update_dict},
            upsert=True
        )
    return {"message": "Impostazioni aggiornate con successo"}


# ==================== CERTIFICATE BLOCK OVERRIDE STATUS ====================

@router.get("/settings/certificate-override-status")
async def get_certificate_override_status(current_user = Depends(get_current_user)):
    """
    Return the current society-wide certificate block status
    and whether the Admin has already been shown the popup today.
    Used by the per-session popup on admin dashboard.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può consultare questo stato")
    settings = await db.settings.find_one({"type": "society"}) or {}
    block_enabled = settings.get("block_expired_certificates", True)
    # Today key (Italy) for per-day popup
    try:
        from zoneinfo import ZoneInfo
        today_it = datetime.now(ZoneInfo("Europe/Rome")).strftime("%Y-%m-%d")
    except Exception:
        today_it = datetime.utcnow().strftime("%Y-%m-%d")
    last_seen = settings.get("override_last_admin_seen_date")
    should_show_popup = (not block_enabled) and (last_seen != today_it)
    return {
        "block_expired_certificates": block_enabled,
        "override_keep_disabled": settings.get("override_keep_disabled", False),
        "override_auto_reactivate_at": settings.get("override_auto_reactivate_at"),
        "override_deactivation_reason": settings.get("override_deactivation_reason"),
        "override_deactivated_by_name": settings.get("override_deactivated_by_name"),
        "override_deactivated_at": settings.get("override_deactivated_at"),
        "should_show_popup": should_show_popup,
        "today": today_it,
    }


@router.post("/settings/certificate-override-status/mark-seen")
async def mark_certificate_override_seen(current_user = Depends(get_current_user)):
    """Mark that the current admin has seen today's popup (per-day dismissal)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eseguire questa operazione")
    try:
        from zoneinfo import ZoneInfo
        today_it = datetime.now(ZoneInfo("Europe/Rome")).strftime("%Y-%m-%d")
    except Exception:
        today_it = datetime.utcnow().strftime("%Y-%m-%d")
    await db.settings.update_one(
        {"type": "society"},
        {"$set": {"override_last_admin_seen_date": today_it}},
        upsert=True,
    )
    return {"message": "Popup marcato come visto per oggi", "date": today_it}


# ==================== STRIPE PAYMENT SETTINGS ====================

@router.get("/settings/stripe")
async def get_stripe_settings(current_user = Depends(get_current_user)):
    """Get Stripe payment settings (admin only, keys partially masked)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le impostazioni Stripe")
    
    settings = await db.settings.find_one({"type": "stripe"})
    if not settings:
        return {
            "stripe_enabled": False,
            "stripe_mode": "test",
            "currency": "eur",
            "send_payment_emails": True,
            "has_publishable_key": False,
            "has_secret_key": False,
            "has_webhook_secret": False
        }
    
    def mask_key(key: str) -> str:
        if not key or len(key) < 12:
            return ""
        return f"{key[:7]}...{key[-4:]}"
    
    return {
        "stripe_enabled": settings.get("stripe_enabled", False),
        "stripe_mode": settings.get("stripe_mode", "test"),
        "stripe_publishable_key_masked": mask_key(settings.get("stripe_publishable_key", "")),
        "stripe_secret_key_masked": mask_key(settings.get("stripe_secret_key", "")),
        "stripe_webhook_secret_masked": mask_key(settings.get("stripe_webhook_secret", "")),
        "has_publishable_key": bool(settings.get("stripe_publishable_key")),
        "has_secret_key": bool(settings.get("stripe_secret_key")),
        "has_webhook_secret": bool(settings.get("stripe_webhook_secret")),
        "payment_description": settings.get("payment_description", ""),
        "currency": settings.get("currency", "eur"),
        "send_payment_emails": settings.get("send_payment_emails", True)
    }


@router.patch("/settings/stripe")
async def update_stripe_settings(data: StripeSettingsUpdate, current_user = Depends(get_current_user)):
    """Update Stripe payment settings (admin only)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare le impostazioni Stripe")
    
    if data.stripe_publishable_key:
        if not data.stripe_publishable_key.startswith(("pk_test_", "pk_live_")):
            raise HTTPException(status_code=400, detail="La chiave pubblica Stripe deve iniziare con pk_test_ o pk_live_")
    
    if data.stripe_secret_key:
        if not data.stripe_secret_key.startswith(("sk_test_", "sk_live_")):
            raise HTTPException(status_code=400, detail="La chiave segreta Stripe deve iniziare con sk_test_ o sk_live_")
    
    if data.stripe_webhook_secret:
        if not data.stripe_webhook_secret.startswith("whsec_"):
            raise HTTPException(status_code=400, detail="Il webhook secret deve iniziare con whsec_")
    
    if data.stripe_publishable_key and data.stripe_secret_key:
        pk_mode = "live" if "pk_live_" in data.stripe_publishable_key else "test"
        sk_mode = "live" if "sk_live_" in data.stripe_secret_key else "test"
        if pk_mode != sk_mode:
            raise HTTPException(status_code=400, detail="Le chiavi pubblica e segreta devono essere entrambe test o entrambe live")
        data.stripe_mode = pk_mode
    
    update_dict = {}
    if data.stripe_enabled is not None:
        update_dict["stripe_enabled"] = data.stripe_enabled
    if data.stripe_publishable_key is not None:
        update_dict["stripe_publishable_key"] = data.stripe_publishable_key
    if data.stripe_secret_key is not None:
        update_dict["stripe_secret_key"] = data.stripe_secret_key
    if data.stripe_webhook_secret is not None:
        update_dict["stripe_webhook_secret"] = data.stripe_webhook_secret
    if data.stripe_mode is not None:
        update_dict["stripe_mode"] = data.stripe_mode
    if data.payment_description is not None:
        update_dict["payment_description"] = data.payment_description
    if data.currency is not None:
        update_dict["currency"] = data.currency
    if data.send_payment_emails is not None:
        update_dict["send_payment_emails"] = data.send_payment_emails
    
    update_dict["type"] = "stripe"
    update_dict["updated_at"] = datetime.now(timezone.utc)
    update_dict["updated_by"] = current_user["id"]
    
    await db.settings.update_one(
        {"type": "stripe"},
        {"$set": update_dict},
        upsert=True
    )
    
    await db.audit_logs.insert_one({
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "society_id": current_user.get("society_id", ""),
        "action": "stripe_settings_updated",
        "details": {
            "stripe_enabled": data.stripe_enabled,
            "stripe_mode": data.stripe_mode
        },
        "ip_address": "system",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Impostazioni Stripe aggiornate con successo"}


@router.delete("/settings/stripe/keys")
async def delete_stripe_keys(current_user = Depends(get_current_user)):
    """Delete all Stripe keys (admin only) - for security when switching accounts."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare le chiavi Stripe")
    
    await db.settings.update_one(
        {"type": "stripe"},
        {"$unset": {
            "stripe_publishable_key": "",
            "stripe_secret_key": "",
            "stripe_webhook_secret": ""
        },
        "$set": {
            "stripe_enabled": False,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["id"]
        }}
    )
    
    await db.audit_logs.insert_one({
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "society_id": current_user.get("society_id", ""),
        "action": "stripe_keys_deleted",
        "details": {},
        "ip_address": "system",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Chiavi Stripe eliminate con successo"}
