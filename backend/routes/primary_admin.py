"""
Primary Admin (Responsabile Admin) management.

The primary admin is the society's reference point — by default the first admin
registered. They must sign a declaration stating whether they are:
  (1) the society's legal representative, OR
  (2) a dirigente authorized by the legal representative.

Only the primary admin with a signed declaration can perform sensitive actions
such as permanently disabling the society-wide medical certificate block
(keep_disabled over midnight).

The primary admin role can be DELEGATED to another admin; delegation invalidates
the current declaration (new admin must sign their own).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import db
from auth_utils import get_current_user
from models.enums import UserRole

logger = logging.getLogger(__name__)

router = APIRouter()


PRIMARY_DECLARATION_TYPES = {"legal_representative", "authorized_delegate"}

# Pattern che indicano un nome di società, non di persona fisica.
# Un account con questi pattern NON può dichiararsi "Legale Rappresentante".
_SOCIETY_PATTERNS = [
    "SSD", "S.S.D", "SRL", "S.R.L", "SPA", "S.P.A", "ASD", "A.S.D",
    "APS", "A.P.S", "APD", "A.P.D", "ONLUS", "ETS", "E.T.S",
    "COOPERATIVA", "SOCIETA", "SOCIETÀ", "ASSOCIAZIONE", "A RL",
]


def looks_like_society_name(full_name: str) -> bool:
    """Heuristic: detects if a full_name likely refers to a society/organization
    (not a physical person). Used to prevent such accounts from declaring themselves
    as Legal Representative."""
    if not full_name:
        return False
    upper = full_name.upper()
    for pat in _SOCIETY_PATTERNS:
        # Match as whole word/token or substring with boundaries
        if pat in upper:
            return True
    return False


async def is_society_institutional_email(user_email: str, society_id: Optional[str] = None) -> bool:
    """Return True if the user's email matches the society's institutional email
    or PEC stored in the society settings. Such accounts MUST NOT declare as
    Legal Representative because the email is institutional, not personal.

    If society_id is given, looks up the settings of that specific society
    (multi-tenant).
    """
    if not user_email:
        return False
    query = {"type": "society"}
    if society_id:
        query["society_id"] = society_id
    settings = await db.settings.find_one(
        query,
        {"_id": 0, "email": 1, "society_email": 1, "pec": 1, "society_pec": 1},
    ) or {}
    society_email = (settings.get("email") or settings.get("society_email") or "").strip().lower()
    society_pec = (settings.get("pec") or settings.get("society_pec") or "").strip().lower()
    u = user_email.strip().lower()
    return u != "" and (u == society_email or u == society_pec)


async def _notify_legal_rep_scepter_event(
    event_type: str,
    summary: str,
    actor_name: str,
    details_html: str = "",
) -> None:
    """Send an email to the current Legal Representative about a scepter-related event.
    Silently ignores errors (email is best-effort notification, not a hard dependency).
    event_type: 'delegated' | 'resigned' | 'revoked' | 'crowned'
    """
    try:
        legal_rep = await db.users.find_one(
            {"role": "admin", "primary_admin_declaration": "legal_representative"}
        )
        if not legal_rep or not legal_rep.get("email"):
            return  # No LR to notify (orphan state, common in bootstrap)

        settings = await db.settings.find_one({"type": "society"}) or {}
        society_name = settings.get("name", "la tua Società")

        subject_map = {
            "delegated": "Scettro delegato — notifica Responsabile",
            "resigned": "Incarico rimesso — scettro tornato a te",
            "revoked": "Delega revocata — hai ripreso lo scettro",
            "crowned": "Incoronato Legale Rappresentante",
        }
        icon_map = {
            "delegated": "🔄",
            "resigned": "↩️",
            "revoked": "🚫",
            "crowned": "👑",
        }
        subject = f"{icon_map.get(event_type, '🔔')} {subject_map.get(event_type, 'Aggiornamento scettro')}"

        html = f"""
        <html><body style="font-family: Arial, sans-serif; color: #333; max-width: 560px; margin: 0 auto;">
          <div style="background:#1565C0; color:#fff; padding:18px; border-radius:8px 8px 0 0;">
            <h2 style="margin:0; font-size:18px;">{icon_map.get(event_type, '🔔')} {subject_map.get(event_type, 'Aggiornamento')}</h2>
            <p style="margin:4px 0 0 0; font-size:13px; opacity:0.9;">{society_name}</p>
          </div>
          <div style="background:#fff; padding:20px; border:1px solid #E0E0E0; border-top:none; border-radius:0 0 8px 8px;">
            <p style="font-size:14px; line-height:20px;">Ciao <strong>{legal_rep.get('full_name', 'Legale Rappresentante')}</strong>,</p>
            <p style="font-size:14px; line-height:20px;">{summary}</p>
            {f'<div style="background:#FAFAFA; border-left:3px solid #1565C0; padding:10px 12px; margin:14px 0; font-size:13px; color:#555;">{details_html}</div>' if details_html else ''}
            <p style="font-size:12px; color:#888; margin-top:18px;">Operazione eseguita da: <strong>{actor_name}</strong></p>
            <p style="font-size:12px; color:#888;">Data: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} UTC</p>
            <p style="font-size:11px; color:#AAA; margin-top:20px; border-top:1px solid #EEE; padding-top:10px;">Questa notifica ti è stata inviata perché risulti registrato come Legale Rappresentante della società nel sistema RegistraTEAM. Se ritieni sia un errore, contatta subito gli admin della società.</p>
          </div>
        </body></html>
        """

        from email_service import send_transactional_email
        await send_transactional_email(
            to_email=legal_rep["email"],
            subject=subject,
            html_content=html,
        )
    except Exception as e:
        logger.warning(f"Failed to send scepter email to legal rep: {e}")


class PrimaryDeclarationRequest(BaseModel):
    declaration_type: str  # "legal_representative" | "authorized_delegate"
    confirmed: bool


class DelegateRequest(BaseModel):
    new_admin_id: str


async def _resolve_primary_admin_id(society_id: Optional[str] = None) -> Optional[str]:
    """Return the current primary admin's user id (scoped per-society in multi-tenant).
    Priority:
      1. user with is_primary_admin=True (within the society if society_id given)
      2. fallback: oldest NON-institutional admin in that society (skip society-name accounts)
    """
    base_q = {"role": "admin"}
    if society_id:
        base_q["society_id"] = society_id
    user = await db.users.find_one(
        {**base_q, "is_primary_admin": True},
        {"_id": 0, "id": 1},
    )
    if user:
        return user.get("id")
    # Fallback: oldest admin by created_at, BUT skip institutional accounts
    # (society-named or society-email/PEC accounts must never hold the scepter)
    settings_query = {"type": "society"}
    if society_id:
        settings_query["society_id"] = society_id
    settings = await db.settings.find_one(
        settings_query,
        {"_id": 0, "email": 1, "society_email": 1, "pec": 1, "society_pec": 1},
    ) or {}
    society_email = (settings.get("email") or settings.get("society_email") or "").strip().lower()
    society_pec = (settings.get("pec") or settings.get("society_pec") or "").strip().lower()
    async for a in db.users.find(
        base_q,
        {"_id": 0, "id": 1, "email": 1, "full_name": 1, "created_at": 1},
    ).sort("created_at", 1):
        email_lc = (a.get("email") or "").strip().lower()
        if looks_like_society_name(a.get("full_name", "")):
            continue
        if email_lc and (email_lc == society_email or email_lc == society_pec):
            continue
        return a.get("id")
    return None


async def is_primary_admin(user: dict) -> bool:
    if user.get("role") != "admin":
        return False
    primary_id = await _resolve_primary_admin_id(user.get("society_id"))
    return primary_id is not None and user.get("id") == primary_id


async def has_valid_primary_declaration(user: dict) -> bool:
    if not await is_primary_admin(user):
        return False
    # Re-fetch from DB to pick up freshly-signed declaration (current_user comes from JWT which may be stale)
    fresh = await db.users.find_one({"id": user.get("id")}, {"_id": 0, "primary_admin_declaration": 1})
    decl = (fresh or {}).get("primary_admin_declaration")
    return decl in PRIMARY_DECLARATION_TYPES


@router.get("/admin/primary-admin/status")
async def get_primary_admin_status(current_user=Depends(get_current_user)):
    """Tells the frontend who is primary, the legal rep, and what actions the current user can take."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    society_id = current_user.get("society_id")
    primary_id = await _resolve_primary_admin_id(society_id)
    primary_user = None
    if primary_id:
        primary_user = await db.users.find_one(
            {"id": primary_id},
            {
                "_id": 0, "id": 1, "email": 1, "full_name": 1,
                "primary_admin_declaration": 1,
                "primary_admin_declaration_at": 1,
                "delegated_by_name": 1, "delegated_at": 1,
            },
        )

    # Legal Representative user (identity that survives delegation) - SCOPED PER SOCIETY
    legal_rep_query = {"role": "admin", "primary_admin_declaration": "legal_representative"}
    if society_id:
        legal_rep_query["society_id"] = society_id
    legal_rep = await db.users.find_one(
        legal_rep_query,
        {"_id": 0, "id": 1, "email": 1, "full_name": 1},
    )

    # Current user's own declaration (fresh from DB)
    me = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "primary_admin_declaration": 1, "is_primary_admin": 1},
    ) or {}
    my_decl = me.get("primary_admin_declaration")

    is_current_primary = primary_user is not None and primary_user.get("id") == current_user["id"]
    declaration_signed = bool(primary_user and primary_user.get("primary_admin_declaration") in PRIMARY_DECLARATION_TYPES)

    # Admins that can RECEIVE delegation (only if caller is legal_rep + primary) - SCOPED PER SOCIETY
    admins = []
    can_delegate = is_current_primary and my_decl == "legal_representative"
    if can_delegate:
        delegate_q = {"role": "admin", "id": {"$ne": primary_id}}
        if society_id:
            delegate_q["society_id"] = society_id
        async for a in db.users.find(
            delegate_q,
            {"_id": 0, "id": 1, "email": 1, "full_name": 1, "primary_admin_declaration": 1},
        ).sort("full_name", 1):
            # Exclude other legal_reps (shouldn't exist but defensive)
            if a.get("primary_admin_declaration") != "legal_representative":
                a.pop("primary_admin_declaration", None)
                admins.append(a)

    # Authorized delegate can RESIGN if legal_rep exists
    can_resign = is_current_primary and my_decl == "authorized_delegate" and legal_rep is not None

    # Legal rep can REVOKE an active delegation (they are legal_rep + NOT currently primary)
    can_revoke = (my_decl == "legal_representative" and not is_current_primary and primary_user is not None)

    # Orphan state: current primary declared as authorized_delegate but no legal_rep exists
    orphan_delegate = is_current_primary and my_decl == "authorized_delegate" and legal_rep is None

    # Account "is_society" for UI: match su nome società O email istituzionale/PEC (PER SOCIETY)
    account_is_society_like = (
        looks_like_society_name(current_user.get("full_name", ""))
        or await is_society_institutional_email(current_user.get("email", ""), society_id)
    )

    # Popup di dichiarazione: da mostrare a QUALSIASI admin se non esiste un Legale Rappresentante
    # e l'utente corrente non ha ancora firmato una dichiarazione (oppure se la sua è diversa dai tipi validi).
    # Se esiste già un LR, nessun admin futuro vede il popup.
    should_show_declaration_popup = (
        legal_rep is None
        and my_decl not in PRIMARY_DECLARATION_TYPES
    )

    # Can crown: orphan delegate primary can crown another admin as legal_rep
    can_crown = orphan_delegate
    # Admins that can be crowned (all other admins, excluding self)
    crownable_admins = []
    if can_crown:
        async for a in db.users.find(
            {"role": "admin", "id": {"$ne": current_user["id"]}},
            {"_id": 0, "id": 1, "email": 1, "full_name": 1},
        ).sort("full_name", 1):
            crownable_admins.append(a)

    return {
        "primary_admin_id": primary_id,
        "primary_admin_name": (primary_user or {}).get("full_name") if primary_user else None,
        "primary_admin_email": (primary_user or {}).get("email") if primary_user else None,
        "is_current_user_primary": is_current_primary,
        "declaration_signed": declaration_signed,
        "declaration_type": (primary_user or {}).get("primary_admin_declaration") if primary_user else None,
        "declaration_at": (primary_user or {}).get("primary_admin_declaration_at") if primary_user else None,
        "delegated_by_name": (primary_user or {}).get("delegated_by_name"),
        "delegated_at": (primary_user or {}).get("delegated_at"),
        "legal_representative_id": (legal_rep or {}).get("id"),
        "legal_representative_name": (legal_rep or {}).get("full_name"),
        "legal_representative_email": (legal_rep or {}).get("email"),
        "can_delegate": can_delegate,
        "can_resign": can_resign,
        "can_revoke": can_revoke,
        "can_crown": can_crown,
        "orphan_delegate": orphan_delegate,
        "should_show_declaration_popup": should_show_declaration_popup,
        "account_looks_like_society": account_is_society_like,
        "delegable_admins": admins,
        "crownable_admins": crownable_admins,
        "primary_set_explicitly": bool(await db.users.find_one(
            {"role": "admin", "is_primary_admin": True, **({"society_id": society_id} if society_id else {})}
        )),
    }


@router.post("/admin/primary-admin/declare")
async def declare_primary_admin(
    data: PrimaryDeclarationRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Any admin can sign their declaration.
    
    Logic:
    - If declaration_type == 'legal_representative':
        - Rejected if another LR already exists
        - The caller becomes primary + legal_rep
        - Any existing orphan primary (authorized_delegate) is demoted
    - If declaration_type == 'authorized_delegate':
        - The caller records their declaration
        - Becomes primary ONLY if no other primary exists yet (first admin use case)
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    if data.declaration_type not in PRIMARY_DECLARATION_TYPES:
        raise HTTPException(status_code=400, detail="Tipo dichiarazione non valido")
    if not data.confirmed:
        raise HTTPException(status_code=400, detail="Devi confermare la dichiarazione")

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if "," in (client_ip or ""):
        client_ip = client_ip.split(",")[0].strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    society_id = current_user.get("society_id")

    # GUARD GLOBALE: account societari (nome società o email/PEC istituzionale) non possono
    # firmare NESSUNA dichiarazione di Responsabile Admin. L'account resta solo operativo/email.
    if looks_like_society_name(current_user.get("full_name", "")):
        raise HTTPException(
            status_code=400,
            detail="Questo account risulta intestato ad una società, non ad una persona fisica. Non può firmare dichiarazioni di ruolo. Registra il Responsabile Admin con un account personale (nome e cognome)."
        )
    if await is_society_institutional_email(current_user.get("email", ""), society_id):
        raise HTTPException(
            status_code=400,
            detail="Questa email risulta essere l'email istituzionale o PEC della Società. È riservata alle comunicazioni societarie e non può firmare dichiarazioni di ruolo. Il Responsabile Admin deve usare la propria email personale."
        )

    if data.declaration_type == "legal_representative":
        # Reject if another LR already exists IN THE SAME SOCIETY
        legal_rep_q = {
            "role": "admin",
            "primary_admin_declaration": "legal_representative",
            "id": {"$ne": current_user["id"]},
        }
        if society_id:
            legal_rep_q["society_id"] = society_id
        other_legal_rep = await db.users.find_one(legal_rep_q)
        if other_legal_rep:
            raise HTTPException(
                status_code=400,
                detail=f"Esiste già un Legale Rappresentante registrato ({other_legal_rep.get('full_name', 'altro admin')}). Può esistere un solo Legale Rappresentante per società."
            )

        # Demote any existing orphan primary IN THE SAME SOCIETY (who was an authorized_delegate)
        primary_q = {
            "role": "admin",
            "is_primary_admin": True,
            "id": {"$ne": current_user["id"]},
        }
        if society_id:
            primary_q["society_id"] = society_id
        current_primary = await db.users.find_one(primary_q)
        if current_primary:
            await db.users.update_one(
                {"id": current_primary["id"]},
                {"$set": {"is_primary_admin": False}},
            )

        # Promote self: become primary + legal_rep
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {
                "is_primary_admin": True,
                "primary_admin_declaration": "legal_representative",
                "primary_admin_declaration_at": now_iso,
                "primary_admin_declaration_ip": client_ip,
            }},
        )

    else:  # authorized_delegate
        # Become primary only if no other primary exists IN THE SAME SOCIETY (first admin / bootstrap case)
        primary_q = {
            "role": "admin",
            "is_primary_admin": True,
            "id": {"$ne": current_user["id"]},
        }
        if society_id:
            primary_q["society_id"] = society_id
        explicit_primary = await db.users.find_one(primary_q)
        should_become_primary = explicit_primary is None
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {
                "is_primary_admin": should_become_primary or bool(current_user.get("is_primary_admin")),
                "primary_admin_declaration": "authorized_delegate",
                "primary_admin_declaration_at": now_iso,
                "primary_admin_declaration_ip": client_ip,
            }},
        )

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "user_name": current_user.get("full_name", ""),
        "action": "primary_admin_declaration_signed",
        "details": {"declaration_type": data.declaration_type},
        "ip_address": client_ip,
        "created_at": datetime.now(timezone.utc),
        "timestamp": now_iso,
    })

    # If user just signed as LR, send them a welcome email summarizing the role
    if data.declaration_type == "legal_representative":
        await _notify_legal_rep_scepter_event(
            event_type="crowned",
            summary="Ti sei registrato come <strong>Legale Rappresentante</strong> della società. Lo scettro di Responsabile Admin è nelle tue mani.",
            actor_name=current_user.get("full_name", current_user.get("email", "—")),
            details_html="Da questa pagina (Impostazioni → Responsabile Admin) puoi delegare lo scettro ad un admin di fiducia, revocare eventuali deleghe e consultare lo storico.",
        )

    return {
        "message": "Dichiarazione registrata",
        "declaration_type": data.declaration_type,
        "declaration_at": now_iso,
    }


@router.post("/admin/primary-admin/delegate")
async def delegate_primary_admin(
    data: DelegateRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Current Legal Representative delegates the scepter to another admin.
    Only the Legal Representative (with signed declaration) can delegate.
    The target automatically becomes an 'authorized_delegate' and holds the scepter
    until they resign (or the legal rep revokes the delegation).
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    # Must be the current primary AND the legal representative
    if not await is_primary_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo il Responsabile Admin attuale può delegare")
    me_fresh = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "primary_admin_declaration": 1})
    if (me_fresh or {}).get("primary_admin_declaration") != "legal_representative":
        raise HTTPException(
            status_code=403,
            detail="Solo il Legale Rappresentante può delegare. I Dirigenti autorizzati possono solo rimettere l'incarico."
        )

    new_admin = await db.users.find_one({"id": data.new_admin_id, "role": "admin"})
    if not new_admin:
        raise HTTPException(status_code=404, detail="Admin destinatario non trovato")
    if new_admin["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi delegare a te stesso")
    if new_admin.get("primary_admin_declaration") == "legal_representative":
        raise HTTPException(status_code=400, detail="Non puoi delegare ad un altro Legale Rappresentante")

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if "," in (client_ip or ""):
        client_ip = client_ip.split(",")[0].strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Step down: legal_rep loses primary flag BUT keeps declaration='legal_representative' (identity)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_primary_admin": False}},
    )
    # Promote: target becomes primary, auto-declared as authorized_delegate
    await db.users.update_one(
        {"id": new_admin["id"]},
        {
            "$set": {
                "is_primary_admin": True,
                "primary_admin_declaration": "authorized_delegate",
                "primary_admin_declaration_at": now_iso,
                "primary_admin_declaration_ip": client_ip,
                "delegated_by_id": current_user["id"],
                "delegated_by_name": current_user.get("full_name", ""),
                "delegated_at": now_iso,
            }
        },
    )

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "user_name": current_user.get("full_name", ""),
        "action": "primary_admin_delegated",
        "details": {
            "from_user_id": current_user["id"],
            "from_user_name": current_user.get("full_name", ""),
            "to_user_id": new_admin["id"],
            "to_user_name": new_admin.get("full_name", ""),
        },
        "ip_address": client_ip,
        "created_at": datetime.now(timezone.utc),
        "timestamp": now_iso,
    })

    # Any active 'keep_disabled' override must be reset on delegation (new holder must re-authorize)
    settings = await db.settings.find_one({"type": "society"})
    if settings and settings.get("override_keep_disabled"):
        await db.settings.update_one(
            {"type": "society"},
            {"$set": {
                "override_keep_disabled": False,
                "block_expired_certificates": True,
                "override_auto_reactivate_at": None,
                "override_deactivation_reason": None,
                "override_deactivated_by": None,
                "override_deactivated_by_name": None,
                "override_deactivated_at": None,
            }},
        )

    # Notify LR by email (best effort)
    await _notify_legal_rep_scepter_event(
        event_type="delegated",
        summary=f"Hai delegato lo <strong>scettro di Responsabile Admin</strong> a <strong>{new_admin.get('full_name', '')}</strong> ({new_admin.get('email', '')}), che ora agirà come Dirigente autorizzato fino a quando non rimetterà l'incarico (o revocherai la delega).",
        actor_name=current_user.get("full_name", current_user.get("email", "—")),
        details_html=f"<strong>Dirigente autorizzato</strong>: {new_admin.get('full_name', '')}<br><strong>Email</strong>: {new_admin.get('email', '')}",
    )

    return {
        "message": "Delega effettuata",
        "new_primary_admin_id": new_admin["id"],
        "new_primary_admin_name": new_admin.get("full_name", ""),
    }


# Hook: email notification to LR after delegate (placed here so it runs after response isn't blocked)
async def _send_delegate_email_hook(actor_name: str, new_admin_name: str, new_admin_email: str):
    await _notify_legal_rep_scepter_event(
        event_type="delegated",
        summary=f"Hai delegato lo <strong>scettro di Responsabile Admin</strong> a <strong>{new_admin_name}</strong> ({new_admin_email}), che ora agirà come Dirigente autorizzato fino a quando non rimetterà l'incarico (o revocherai la delega).",
        actor_name=actor_name,
        details_html=f"<strong>Dirigente autorizzato</strong>: {new_admin_name}<br><strong>Email</strong>: {new_admin_email}",
    )


@router.post("/admin/primary-admin/resign")
async def resign_primary_admin(
    request: Request,
    current_user=Depends(get_current_user),
):
    """The current authorized_delegate (NOT legal_rep) returns the scepter to the legal representative."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    if not await is_primary_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo il Responsabile Admin in carica può rimettere l'incarico")
    me_fresh = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "primary_admin_declaration": 1})
    if (me_fresh or {}).get("primary_admin_declaration") != "authorized_delegate":
        raise HTTPException(
            status_code=403,
            detail="Solo un Dirigente autorizzato può rimettere l'incarico. Il Legale Rappresentante non può 'rimettersi' lo scettro."
        )
    legal_rep = await db.users.find_one({"role": "admin", "primary_admin_declaration": "legal_representative"})
    if not legal_rep:
        raise HTTPException(
            status_code=400,
            detail="Nessun Legale Rappresentante registrato: impossibile rimettere l'incarico. Chiedi al Legale Rappresentante di registrarsi nel sistema."
        )

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if "," in (client_ip or ""):
        client_ip = client_ip.split(",")[0].strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Clear delegate's primary + declaration
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "is_primary_admin": False,
            "primary_admin_declaration": None,
            "primary_admin_declaration_at": None,
            "primary_admin_declaration_ip": None,
            "delegated_by_id": None,
            "delegated_by_name": None,
            "delegated_at": None,
        }},
    )
    # Restore legal_rep as primary
    await db.users.update_one(
        {"id": legal_rep["id"]},
        {"$set": {"is_primary_admin": True}},
    )

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "user_name": current_user.get("full_name", ""),
        "action": "primary_admin_resigned",
        "details": {
            "from_user_id": current_user["id"],
            "from_user_name": current_user.get("full_name", ""),
            "to_user_id": legal_rep["id"],
            "to_user_name": legal_rep.get("full_name", ""),
        },
        "ip_address": client_ip,
        "created_at": datetime.now(timezone.utc),
        "timestamp": now_iso,
    })

    # Reset override keep_disabled (new holder decides)
    await db.settings.update_one(
        {"type": "society"},
        {"$set": {"override_keep_disabled": False, "block_expired_certificates": True}},
    )

    # Notify LR by email
    await _notify_legal_rep_scepter_event(
        event_type="resigned",
        summary=f"Il Dirigente autorizzato <strong>{current_user.get('full_name', '—')}</strong> ha <strong>rimesso l'incarico</strong>. Lo scettro di Responsabile Admin è tornato nelle tue mani.",
        actor_name=current_user.get("full_name", current_user.get("email", "—")),
        details_html="Ora sei di nuovo Responsabile Admin operativo. Se desideri, puoi delegare nuovamente dalla pagina Impostazioni → Responsabile Admin.",
    )

    return {
        "message": "Incarico rimesso al Legale Rappresentante",
        "legal_rep_id": legal_rep["id"],
        "legal_rep_name": legal_rep.get("full_name", ""),
    }


@router.post("/admin/primary-admin/revoke")
async def revoke_delegation(
    request: Request,
    current_user=Depends(get_current_user),
):
    """The Legal Representative revokes an active delegation and reclaims the scepter."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    me_fresh = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "primary_admin_declaration": 1, "is_primary_admin": 1})
    if (me_fresh or {}).get("primary_admin_declaration") != "legal_representative":
        raise HTTPException(status_code=403, detail="Solo il Legale Rappresentante può revocare una delega")
    if me_fresh.get("is_primary_admin"):
        raise HTTPException(status_code=400, detail="Sei già Responsabile Admin: nessuna delega attiva da revocare")

    current_delegate = await db.users.find_one({"role": "admin", "is_primary_admin": True})
    if not current_delegate:
        raise HTTPException(status_code=400, detail="Nessun delegato attualmente in carica")
    if current_delegate["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Stato incoerente: sei già il Responsabile")

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if "," in (client_ip or ""):
        client_ip = client_ip.split(",")[0].strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Clear delegate
    await db.users.update_one(
        {"id": current_delegate["id"]},
        {"$set": {
            "is_primary_admin": False,
            "primary_admin_declaration": None,
            "primary_admin_declaration_at": None,
            "primary_admin_declaration_ip": None,
            "delegated_by_id": None,
            "delegated_by_name": None,
            "delegated_at": None,
        }},
    )
    # Restore legal_rep
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_primary_admin": True}},
    )

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "user_name": current_user.get("full_name", ""),
        "action": "primary_admin_delegation_revoked",
        "details": {
            "revoked_user_id": current_delegate["id"],
            "revoked_user_name": current_delegate.get("full_name", ""),
        },
        "ip_address": client_ip,
        "created_at": datetime.now(timezone.utc),
        "timestamp": now_iso,
    })

    # Reset override keep_disabled (scepter changed hands)
    await db.settings.update_one(
        {"type": "society"},
        {"$set": {"override_keep_disabled": False, "block_expired_certificates": True}},
    )

    # Notify (self) LR: this is a self-triggered action, but an email confirming the action is a useful audit for the LR inbox
    await _notify_legal_rep_scepter_event(
        event_type="revoked",
        summary=f"Hai <strong>revocato la delega</strong> a <strong>{current_delegate.get('full_name', '')}</strong> e ripreso l'incarico di Responsabile Admin.",
        actor_name=current_user.get("full_name", current_user.get("email", "—")),
        details_html=f"<strong>Delegato revocato</strong>: {current_delegate.get('full_name', '')}<br><strong>Email</strong>: {current_delegate.get('email', '')}",
    )

    return {
        "message": "Delega revocata. Hai ripreso l'incarico.",
        "revoked_user_id": current_delegate["id"],
        "revoked_user_name": current_delegate.get("full_name", ""),
    }


@router.post("/admin/primary-admin/crown")
async def crown_legal_representative(
    data: DelegateRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Orphan authorized_delegate primary crowns another admin as Legal Representative.
    The target becomes legal_rep + primary. The caller loses primary but keeps
    'authorized_delegate' declaration (can be re-delegated later by the new legal_rep).
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    if not await is_primary_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo il Responsabile Admin può incoronare")

    me_fresh = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "primary_admin_declaration": 1})
    if (me_fresh or {}).get("primary_admin_declaration") != "authorized_delegate":
        raise HTTPException(status_code=403, detail="Solo un Dirigente autorizzato può incoronare un Legale Rappresentante")

    existing_legal_rep = await db.users.find_one({"role": "admin", "primary_admin_declaration": "legal_representative"})
    if existing_legal_rep:
        raise HTTPException(
            status_code=400,
            detail=f"Esiste già un Legale Rappresentante registrato ({existing_legal_rep.get('full_name', '')}). Nessuna incoronazione necessaria."
        )

    new_legal_rep = await db.users.find_one({"id": data.new_admin_id, "role": "admin"})
    if not new_legal_rep:
        raise HTTPException(status_code=404, detail="Admin destinatario non trovato")
    if new_legal_rep["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi incoronare te stesso. Modifica invece la tua dichiarazione.")

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if "," in (client_ip or ""):
        client_ip = client_ip.split(",")[0].strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Step down: current primary loses primary flag but keeps authorized_delegate declaration
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_primary_admin": False}},
    )
    # Crown: target becomes legal_rep + primary
    await db.users.update_one(
        {"id": new_legal_rep["id"]},
        {"$set": {
            "is_primary_admin": True,
            "primary_admin_declaration": "legal_representative",
            "primary_admin_declaration_at": now_iso,
            "primary_admin_declaration_ip": client_ip,
            "crowned_by_id": current_user["id"],
            "crowned_by_name": current_user.get("full_name", ""),
            "crowned_at": now_iso,
        }},
    )

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "user_name": current_user.get("full_name", ""),
        "action": "primary_admin_crowned",
        "details": {
            "crowned_by_id": current_user["id"],
            "crowned_by_name": current_user.get("full_name", ""),
            "new_legal_rep_id": new_legal_rep["id"],
            "new_legal_rep_name": new_legal_rep.get("full_name", ""),
        },
        "ip_address": client_ip,
        "created_at": datetime.now(timezone.utc),
        "timestamp": now_iso,
    })

    # Reset override keep_disabled (new scepter-holder must re-decide)
    await db.settings.update_one(
        {"type": "society"},
        {"$set": {"override_keep_disabled": False, "block_expired_certificates": True}},
    )

    # The newly crowned user is now the Legal Representative: the helper looks up
    # the current LR from DB, which is exactly the person we just promoted.
    await _notify_legal_rep_scepter_event(
        event_type="crowned",
        summary="Sei stato registrato come <strong>Legale Rappresentante</strong> della società. Lo scettro di Responsabile Admin è ora nelle tue mani.",
        actor_name=current_user.get("full_name", current_user.get("email", "—")),
        details_html=f"Incoronazione eseguita da: <strong>{current_user.get('full_name', '—')}</strong> (Dirigente autorizzato).<br>Ora puoi delegare ad un admin di fiducia o operare direttamente.",
    )

    return {
        "message": "Legale Rappresentante incoronato",
        "new_legal_rep_id": new_legal_rep["id"],
        "new_legal_rep_name": new_legal_rep.get("full_name", ""),
    }


@router.get("/admin/primary-admin/history")
async def get_primary_admin_history(current_user=Depends(get_current_user)):
    """Return audit log entries related to the Responsabile Admin role."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    actions = [
        "primary_admin_declaration_signed",
        "primary_admin_delegated",
        "primary_admin_resigned",
        "primary_admin_delegation_revoked",
        "primary_admin_crowned",
    ]
    events = []
    async for log in db.audit_logs.find(
        {"action": {"$in": actions}},
        {"_id": 0},
    ).sort("created_at", -1).limit(50):
        log.pop("_id", None)
        if "created_at" in log and not isinstance(log["created_at"], str):
            try:
                log["created_at"] = log["created_at"].isoformat()
            except Exception:
                log["created_at"] = str(log["created_at"])
        events.append(log)
    return {"events": events}
