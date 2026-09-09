"""
Society and Stripe settings routes.
- /settings/society/logo.png (public)
- /settings/society (GET public, PATCH admin)
- /settings/stripe (GET, PATCH, DELETE keys - admin only)
"""
import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from database import db
from auth_utils import get_current_user
from models.enums import UserRole
from models.settings_models import SocietySettingsUpdate, StripeSettingsUpdate
from routes.primary_admin import is_primary_admin, has_valid_primary_declaration

router = APIRouter()


# ─────────────────────── Preset per sport ───────────────────────
# Liste di default per ogni sport. L'admin può importarle in 1 click
# dalla pagina Impostazioni → Altre Impostazioni → "Importa preset".
SPORT_PRESETS = {
    "pallavolo": {
        "athlete_roles": ["Palleggiatore", "Schiacciatore", "Opposto", "Centrale", "Libero"],
        "athlete_characteristics": ["Mancino", "Buon servizio", "Buona ricezione", "Buona difesa", "Buon attacco"],
        "dirigente_qualifications": ["Dirigente accompagnatore", "Dirigente arbitro", "Segnapunti", "Refertista", "Allenatore di sostegno"],
        "coach_license_levels": ["Smart Coach", "Allievo Allenatore", "1° Grado", "2° Grado", "3° Grado"],
    },
}


@router.post("/settings/society/import-preset")
async def import_society_preset(payload: dict, current_user=Depends(get_current_user)):
    """Admin-only: importa preset di tassonomie per uno sport.

    Body: { "sport": "pallavolo", "overwrite": false }
    Default: overwrite=false → fa MERGE (aggiunge solo i valori mancanti)
    """
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    sport = (payload.get("sport") or "").strip().lower()
    overwrite = bool(payload.get("overwrite", False))
    if sport not in SPORT_PRESETS:
        raise HTTPException(status_code=400, detail=f"Sport '{sport}' non disponibile. Sport supportati: {list(SPORT_PRESETS.keys())}")

    preset = SPORT_PRESETS[sport]
    society_id = current_user.get("society_id")
    settings_filter = {"type": "society"}
    if society_id:
        settings_filter["society_id"] = society_id

    existing = await db.settings.find_one(settings_filter, {"_id": 0}) or {}
    update_fields = {}
    counts = {}
    for key, preset_values in preset.items():
        current_values = existing.get(key) or []
        if overwrite:
            merged = list(preset_values)
        else:
            # merge preserving order: existing first, then new ones not yet present
            merged = list(current_values)
            for v in preset_values:
                if v not in merged:
                    merged.append(v)
        update_fields[key] = merged
        counts[key] = {"before": len(current_values), "after": len(merged), "added": len(merged) - len(current_values)}

    # upsert settings doc
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        settings_filter,
        {"$set": update_fields, "$setOnInsert": {**settings_filter, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"success": True, "sport": sport, "overwrite": overwrite, "counts": counts}



@router.api_route("/settings/society/logo.png", methods=["GET", "HEAD"])
async def get_society_logo_image(request: Request, society_id: Optional[str] = None):
    """Serve society logo as PNG image.
    Multi-tenant rules:
    - Authenticated request → society from JWT
    - Anonymous + explicit ?society_id=XXX query (used by email embedding) → that society
    - Anonymous + no society_id (e.g. public /login page) → 404 (no branding leak)
    """
    query = {"type": "society"}
    has_society_scope = False
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        try:
            import jwt as _jwt
            from auth_utils import SECRET_KEY, ALGORITHM
            token = auth_header.split(" ", 1)[1].strip()
            payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            uid = payload.get("user_id")
            if uid:
                u = await db.users.find_one({"id": uid}, {"_id": 0, "society_id": 1})
                if u and u.get("society_id"):
                    query["society_id"] = u["society_id"]
                    has_society_scope = True
        except Exception:
            pass
    if not has_society_scope and society_id:
        query["society_id"] = society_id
        has_society_scope = True
    if not has_society_scope:
        # Public/anonymous request without explicit society → no branding leak
        raise HTTPException(status_code=404, detail="Logo non trovato")
    settings = await db.settings.find_one(query, {"_id": 0, "logo": 1, "logo_storage_path": 1})
    if not settings:
        raise HTTPException(status_code=404, detail="Logo non trovato")
    # ⚡ 06/2026 — Dual-read: prima lo storage dedicato, poi fallback base64 legacy.
    _lp = settings.get("logo_storage_path")
    if _lp:
        from storage_util import get_image
        _content, _ctype = await get_image(_lp)
        if _content:
            return Response(content=_content, media_type=_ctype or "image/jpeg", headers={"Cache-Control": "public, max-age=300"})
    if not settings.get("logo"):
        raise HTTPException(status_code=404, detail="Logo non trovato")
    # 🐛 27/02/2026 — Gestisce sia il caso raw base64 sia il caso data URI con prefisso
    logo_str = settings["logo"]
    media_type = "image/png"
    if isinstance(logo_str, str) and logo_str.startswith("data:"):
        try:
            header, b64 = logo_str.split(",", 1)
            media_type = header.split(";")[0].replace("data:", "") or media_type
            logo_bytes = base64.b64decode(b64)
        except Exception:
            raise HTTPException(status_code=404, detail="Logo non decodificabile")
    else:
        logo_bytes = base64.b64decode(logo_str)
    return Response(content=logo_bytes, media_type=media_type, headers={"Cache-Control": "public, max-age=300"})


@router.get("/settings/society/sport-image.png")
async def get_society_sport_image(request: Request, society_id: Optional[str] = None):
    """Serve society sport image as PNG image. Public endpoint with short cache."""
    query = {"type": "society"}
    has_society_scope = False
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        try:
            import jwt as _jwt
            from auth_utils import SECRET_KEY, ALGORITHM
            token = auth_header.split(" ", 1)[1].strip()
            payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            uid = payload.get("user_id")
            if uid:
                u = await db.users.find_one({"id": uid}, {"_id": 0, "society_id": 1})
                if u and u.get("society_id"):
                    query["society_id"] = u["society_id"]
                    has_society_scope = True
        except Exception:
            pass
    if not has_society_scope and society_id:
        query["society_id"] = society_id
        has_society_scope = True
    if not has_society_scope:
        raise HTTPException(status_code=404, detail="Sport image non trovata")
    settings = await db.settings.find_one(query, {"_id": 0, "sport_image": 1})
    if not settings or not settings.get("sport_image"):
        raise HTTPException(status_code=404, detail="Sport image non trovata")
    img_bytes = base64.b64decode(settings["sport_image"])
    return Response(content=img_bytes, media_type="image/png", headers={"Cache-Control": "public, max-age=300"})


@router.get("/settings/society/stamp-signature.png")
async def get_society_stamp_signature(request: Request):
    """Serve society stamp/signature as PNG image. Authenticated via optional token."""
    query = {"type": "society"}
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        try:
            import jwt as _jwt
            from auth_utils import SECRET_KEY, ALGORITHM
            token = auth_header.split(" ", 1)[1].strip()
            payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            uid = payload.get("user_id")
            if uid:
                u = await db.users.find_one({"id": uid}, {"_id": 0, "society_id": 1})
                if u and u.get("society_id"):
                    query["society_id"] = u["society_id"]
        except Exception:
            pass
    settings = await db.settings.find_one(query, {"_id": 0, "stamp_signature": 1})
    if not settings or not settings.get("stamp_signature"):
        raise HTTPException(status_code=404, detail="Timbro non trovato")
    raw = settings["stamp_signature"]
    # stamp_signature can sometimes include the data: URI prefix
    if isinstance(raw, str) and raw.startswith("data:"):
        raw = raw.split(",", 1)[1] if "," in raw else raw
    img_bytes = base64.b64decode(raw)
    return Response(content=img_bytes, media_type="image/png", headers={"Cache-Control": "public, max-age=300"})


@router.get("/settings/society")
async def get_society_settings(request: Request, include_images: bool = False):
    """Get society settings scoped to the requester's society.
    Public endpoint (no auth required) for use in login/register pages, but if
    an auth token is present the settings of THAT user's society are returned
    (multi-tenant).

    By default, heavy base64 fields (logo, sport_image, stamp_signature) are
    EXCLUDED to keep the payload small (~4KB instead of ~700KB). Pass
    ?include_images=true to include them (used by PDF generation and admin
    edit pages). Dedicated endpoints serve images:
    - /settings/society/logo.png
    - /settings/society/sport-image.png
    - /settings/society/stamp-signature.png
    """
    is_authenticated_request = False
    auth_header_probe = request.headers.get("authorization") or ""
    if auth_header_probe.lower().startswith("bearer "):
        try:
            import jwt as _jwt2
            from auth_utils import SECRET_KEY as _SK2, ALGORITHM as _AL2
            _payload2 = _jwt2.decode(auth_header_probe.split(" ", 1)[1].strip(), _SK2, algorithms=[_AL2])
            _uid2 = _payload2.get("user_id")
            if _uid2:
                _u2 = await db.users.find_one({"id": _uid2}, {"_id": 0, "society_id": 1})
                if _u2 and _u2.get("society_id"):
                    is_authenticated_request = True
        except Exception:
            pass
    # Multi-tenant safety: anonymous requests (public /login page on registrateam.it)
    # MUST NOT see any specific society's branding. Return generic RegistraTEAM
    # defaults so the public landing/login page looks like a SaaS, not a tenant.
    if not is_authenticated_request:
        return {
            "name": "RegistraTEAM",
            "logo": None,
            "logo_size": 50,
            "sport_image": None,
            "athlete_roles": [],
            "athlete_characteristics": [],
            "dirigente_qualifications": [],
            "coach_license_levels": [],
            "venues": [],
            "ragione_sociale": None,
            "sport_praticato": None,
            "address": None,
            "postal_code": None,
            "city": None,
            "province": None,
            "fiscal_code": None,
            "partita_iva": None,
            "codice_sdi": None,
            "phone": None,
            "phone2": None,
            "president_name": None,
            "stamp_signature": None,
            "iban": None,
            "bank_name": None,
            "affiliations": [],
            "has_logo": False,
            "has_sport_image": False,
            "has_stamp_signature": False,
        }

    query = {"type": "society"}
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        try:
            import jwt as _jwt
            from auth_utils import SECRET_KEY, ALGORITHM
            token = auth_header.split(" ", 1)[1].strip()
            payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            uid = payload.get("user_id")
            if uid:
                u = await db.users.find_one({"id": uid}, {"_id": 0, "society_id": 1})
                if u and u.get("society_id"):
                    query["society_id"] = u["society_id"]
        except Exception:
            pass
    # Use projection to avoid fetching heavy base64 fields from MongoDB unless requested
    if include_images:
        settings = await db.settings.find_one(query, {"_id": 0})
        # ⚡ 06/2026 — Dual-read: se il logo è su object storage (logo_storage_path)
        # e il campo base64 è vuoto, lo idratiamo dallo storage così le pagine che
        # richiedono il base64 (preview edit logo, generazione PDF) continuano a funzionare.
        if settings and settings.get("logo_storage_path") and not settings.get("logo"):
            try:
                from storage_util import get_image_datauri
                _du = await get_image_datauri(settings["logo_storage_path"])
                if _du:
                    settings["logo"] = _du
            except Exception:
                pass
        # 🚀 16/08/2026 — Compressione on-read delle immagini pesanti (logo, sport_image,
        # stamp_signature): questo endpoint è caricato con include_images=true da più
        # pagine (es. anagrafica atleta) e un'immagine grande non compressa rallentava
        # l'apertura. Comprimiamo (max 1280px, JPEG q72) e persistiamo, solo se > ~500KB.
        if settings:
            try:
                import asyncio as _asyncio_img
                from utils import compress_base64_image
                _img_updates = {}
                for _pk in ("logo", "sport_image", "stamp_signature"):
                    _val = settings.get(_pk)
                    if isinstance(_val, str) and len(_val) > 500_000:
                        # 🚀 18/08/2026 — Compressione OFF dall'event loop (thread separato):
                        # PIL è CPU-bound e su Render (1 worker) bloccava tutte le altre
                        # richieste in coda finché non finiva (stalli fino a 7s).
                        _comp = await _asyncio_img.to_thread(compress_base64_image, _val)
                        if _comp and _comp != _val and len(_comp) < len(_val):
                            settings[_pk] = _comp
                            _img_updates[_pk] = _comp
                if _img_updates:
                    await db.settings.update_one(query, {"$set": _img_updates})
            except Exception:
                pass
    else:
        # Lightweight: probe whether each image exists, but don't transfer it
        settings = await db.settings.find_one(query, {"_id": 0, "logo": 0, "sport_image": 0, "stamp_signature": 0})
        # Add boolean flags so the frontend knows whether to render <Image> tags
        # pointing at the dedicated /logo.png endpoints.
        if settings:
            existence_probe = {}
            try:
                _cursor = db.settings.aggregate([
                    {"$match": query},
                    {"$project": {
                        "_id": 0,
                        "has_logo": {"$or": [
                            {"$gt": [{"$strLenBytes": {"$ifNull": ["$logo", ""]}}, 0]},
                            {"$gt": [{"$strLenBytes": {"$ifNull": ["$logo_storage_path", ""]}}, 0]},
                        ]},
                        "has_sport_image": {"$gt": [{"$strLenBytes": {"$ifNull": ["$sport_image", ""]}}, 0]},
                        "has_stamp_signature": {"$gt": [{"$strLenBytes": {"$ifNull": ["$stamp_signature", ""]}}, 0]},
                    }},
                    {"$limit": 1},
                ])
                _rows = await _cursor.to_list(length=1)
                if _rows:
                    existence_probe = _rows[0]
            except Exception:
                existence_probe = {}
            settings["has_logo"] = bool(existence_probe.get("has_logo"))
            settings["has_sport_image"] = bool(existence_probe.get("has_sport_image"))
            settings["has_stamp_signature"] = bool(existence_probe.get("has_stamp_signature"))
    if not settings:
        return {
            "name": "Società Sportiva",
            "logo": None,
            "logo_size": 50,
            "sport_image": None,
            "athlete_roles": [],
            "athlete_characteristics": [],
            "dirigente_qualifications": [],
            "coach_license_levels": [],
            "venues": [],
            "ragione_sociale": None,
            "sport_praticato": None,
            "address": None,
            "postal_code": None,
            "city": None,
            "province": None,
            "fiscal_code": None,
            "partita_iva": None,
            "codice_sdi": None,
            "phone": None,
            "phone2": None,
            "president_name": None,
            "stamp_signature": None,
            "iban": None,
            "bank_name": None,
            "affiliations": [],
            "kit_price": None,
            "kit_sponsor": None,
        }
    return {
        "name": settings.get("name", "Società Sportiva"),
        "logo": settings.get("logo"),
        "logo_size": settings.get("logo_size", 50),
        "sport_image": settings.get("sport_image"),
        "athlete_roles": settings.get("athlete_roles", []),
        "athlete_characteristics": settings.get("athlete_characteristics", []),
        "dirigente_qualifications": settings.get("dirigente_qualifications", []),
        "coach_license_levels": settings.get("coach_license_levels", []),
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
        "codice_sdi": settings.get("codice_sdi"),
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
        "kit_price": settings.get("kit_price"),
        "kit_sponsor": settings.get("kit_sponsor"),
        # 🐛 16/08/2026 — I flag di esistenza immagini venivano calcolati ma persi nel
        # rebuild del dict di ritorno: senza di essi il frontend non sapeva se le immagini
        # esistevano (e poteva ricaricare sempre le versioni pesanti). Ora inclusi.
        "has_logo": settings.get("has_logo", bool(settings.get("logo"))),
        "has_sport_image": settings.get("has_sport_image", bool(settings.get("sport_image"))),
        "has_stamp_signature": settings.get("has_stamp_signature", bool(settings.get("stamp_signature"))),
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
        "dirigente_qualifications", "coach_license_levels", "venues", "sport_image",
        "ragione_sociale", "sport_praticato", "address", "postal_code", "city",
        "province", "fiscal_code", "partita_iva", "codice_sdi", "phone", "phone2",
        "president_name", "stamp_signature", "email", "pec", "pro_enabled",
        "season_start_month", "season_start_day",
        "season_end_month", "season_end_day",
        "iban", "bank_name", "affiliations",
        "kit_price", "kit_sponsor"
    ]
    for f in fields:
        v = getattr(data, f, None)
        if v is not None:
            update_dict[f] = v
    
    # block_expired_certificates: special handling with audit log + auto-reactivation
    if data.block_expired_certificates is not None:
        _society_id_local_probe = current_user.get("society_id")
        _probe_query = {"type": "society"}
        if _society_id_local_probe:
            _probe_query["society_id"] = _society_id_local_probe
        current_settings = await db.settings.find_one(_probe_query)
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

            # GUARD: only the Primary Admin (with signed declaration) can set keep_disabled=True
            if keep_disabled:
                if not await is_primary_admin(current_user):
                    raise HTTPException(
                        status_code=403,
                        detail="Solo il Responsabile Admin può mantenere l'override disattivato oltre la mezzanotte."
                    )
                if not await has_valid_primary_declaration(current_user):
                    raise HTTPException(
                        status_code=403,
                        detail="Devi firmare la dichiarazione di Responsabile Admin (Legale Rappresentante o Dirigente autorizzato) prima di usare questa opzione."
                    )

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
        update_dict["trial_max_sessions"] = max(1, min(10, data.trial_max_sessions))

    # ⚡ 06/2026 — Migrazione logo → Emergent Object Storage. Il logo può arrivare
    # come data URI (data:image/...;base64,...) oppure come base64 grezzo (alcuni
    # picker inviano solo il base64). In entrambi i casi lo comprimiamo e carichiamo
    # su storage: nel doc MongoDB resta solo logo_storage_path (doc leggero). Se
    # l'upload fallisce, teniamo il valore originale come fallback (dual-read su /logo.png).
    _lg_val = update_dict.get("logo")
    if isinstance(_lg_val, str) and len(_lg_val) > 100 and not _lg_val.startswith("http"):
        from storage_util import store_image_from_datauri, storage_path_for
        _sid_logo = current_user.get("society_id") or "shared"
        _path = storage_path_for("logo", _sid_logo, _sid_logo)
        _stored = await store_image_from_datauri(_path, _lg_val, max_dim=800, target_kb=180)
        if _stored:
            update_dict["logo_storage_path"] = _stored
            update_dict["logo"] = ""

    if update_dict:
        # Multi-tenant: scope settings to the admin's society to prevent
        # cross-tenant data leakage (e.g. Sirio admin overwriting PPG settings).
        society_id_local = current_user.get("society_id")
        filter_query = {"type": "society"}
        if society_id_local:
            filter_query["society_id"] = society_id_local
            update_dict["society_id"] = society_id_local
        await db.settings.update_one(
            filter_query,
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
    _sid = current_user.get("society_id")
    _q = {"type": "society"}
    if _sid:
        _q["society_id"] = _sid
    # 🚀 18/08/2026 PERF — Projection: NON scaricare le immagini base64 (logo,
    # sport_image, stamp_signature) che qui non servono. Questo endpoint gira in
    # polling ogni 30s e senza projection trasferiva diversi MB dal DB ad ogni
    # chiamata → ~7s di risposta su Render (confermato dai log X-Response-Time).
    settings = await db.settings.find_one(
        _q, {"logo": 0, "sport_image": 0, "stamp_signature": 0}
    ) or {}
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
    _sid = current_user.get("society_id")
    _q = {"type": "society"}
    _set_dict = {"override_last_admin_seen_date": today_it}
    if _sid:
        _q["society_id"] = _sid
        _set_dict["society_id"] = _sid
    await db.settings.update_one(
        _q,
        {"$set": _set_dict},
        upsert=True,
    )
    return {"message": "Popup marcato come visto per oggi", "date": today_it}


# ==================== STRIPE PAYMENT SETTINGS ====================

@router.get("/settings/stripe")
async def get_stripe_settings(current_user = Depends(get_current_user)):
    """Get Stripe payment settings (admin only, keys partially masked)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le impostazioni Stripe")
    
    _sid = current_user.get("society_id")
    _q = {"type": "stripe"}
    if _sid:
        _q["society_id"] = _sid
    settings = await db.settings.find_one(_q)
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
    
    # Compute stripe_mode dynamically from the actual saved publishable key.
    # This guarantees UI badge and webhook link always match the real keys,
    # even if the stored stripe_mode field is stale (e.g. keys were migrated
    # or inserted without going through the PATCH endpoint that recomputes it).
    pk = settings.get("stripe_publishable_key", "") or ""
    if pk.startswith("pk_live_"):
        computed_mode = "live"
    elif pk.startswith("pk_test_"):
        computed_mode = "test"
    else:
        computed_mode = settings.get("stripe_mode", "test")
    
    return {
        "stripe_enabled": settings.get("stripe_enabled", False),
        "stripe_mode": computed_mode,
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
    
    _sid = current_user.get("society_id")
    _q = {"type": "stripe"}
    if _sid:
        _q["society_id"] = _sid
        update_dict["society_id"] = _sid
    await db.settings.update_one(
        _q,
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
    
    _sid = current_user.get("society_id")
    _q = {"type": "stripe"}
    if _sid:
        _q["society_id"] = _sid
    await db.settings.update_one(
        _q,
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
