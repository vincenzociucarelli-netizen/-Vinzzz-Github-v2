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
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import db
from auth_utils import get_current_user
from models.enums import UserRole

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


async def is_society_institutional_email(user_email: str) -> bool:
    """Return True if the user's email matches the society's institutional email
    or PEC stored in the society settings. Such accounts MUST NOT declare as
    Legal Representative because the email is institutional, not personal.
    """
    if not user_email:
        return False
    settings = await db.settings.find_one({"type": "society"}) or {}
    society_email = (settings.get("email") or "").strip().lower()
    society_pec = (settings.get("pec") or "").strip().lower()
    u = user_email.strip().lower()
    return u != "" and (u == society_email or u == society_pec)


class PrimaryDeclarationRequest(BaseModel):
    declaration_type: str  # "legal_representative" | "authorized_delegate"
    confirmed: bool


class DelegateRequest(BaseModel):
    new_admin_id: str


async def _resolve_primary_admin_id() -> Optional[str]:
    """Return the current primary admin's user id.
    Priority:
      1. user with is_primary_admin=True
      2. oldest admin by created_at (fallback)
    """
    user = await db.users.find_one({"role": "admin", "is_primary_admin": True})
    if user:
        return user.get("id")
    # Fallback: oldest admin
    oldest = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1, "created_at": 1}).sort("created_at", 1).to_list(1)
    if oldest:
        return oldest[0].get("id")
    return None


async def is_primary_admin(user: dict) -> bool:
    if user.get("role") != "admin":
        return False
    primary_id = await _resolve_primary_admin_id()
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

    primary_id = await _resolve_primary_admin_id()
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

    # Legal Representative user (identity that survives delegation)
    legal_rep = await db.users.find_one(
        {"role": "admin", "primary_admin_declaration": "legal_representative"},
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

    # Admins that can RECEIVE delegation (only if caller is legal_rep + primary)
    admins = []
    can_delegate = is_current_primary and my_decl == "legal_representative"
    if can_delegate:
        async for a in db.users.find(
            {"role": "admin", "id": {"$ne": primary_id}},
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

    # Account "is_society" for UI: match su nome società O email istituzionale/PEC
    account_is_society_like = (
        looks_like_society_name(current_user.get("full_name", ""))
        or await is_society_institutional_email(current_user.get("email", ""))
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
        "primary_set_explicitly": bool(await db.users.find_one({"role": "admin", "is_primary_admin": True})),
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

    if data.declaration_type == "legal_representative":
        # GUARD 1: accounts that look like a society cannot be Legal Representative
        if looks_like_society_name(current_user.get("full_name", "")):
            raise HTTPException(
                status_code=400,
                detail="Questo account risulta essere intestato ad una società (non ad una persona fisica). Il Legale Rappresentante deve essere SEMPRE una persona fisica (Presidente, Amministratore, ecc.). Registra il Legale Rappresentante con il suo nome e cognome personali."
            )
        # GUARD 2: email corrisponde all'email istituzionale/PEC registrata nel profilo Società
        if await is_society_institutional_email(current_user.get("email", "")):
            raise HTTPException(
                status_code=400,
                detail="Questa email risulta essere l'email istituzionale o PEC della Società (registrata nel profilo). Il Legale Rappresentante deve firmare con la propria email personale."
            )

        # Reject if another LR already exists
        other_legal_rep = await db.users.find_one({
            "role": "admin",
            "primary_admin_declaration": "legal_representative",
            "id": {"$ne": current_user["id"]},
        })
        if other_legal_rep:
            raise HTTPException(
                status_code=400,
                detail=f"Esiste già un Legale Rappresentante registrato ({other_legal_rep.get('full_name', 'altro admin')}). Può esistere un solo Legale Rappresentante per società."
            )

        # Demote any existing orphan primary (who was an authorized_delegate)
        current_primary = await db.users.find_one({
            "role": "admin",
            "is_primary_admin": True,
            "id": {"$ne": current_user["id"]},
        })
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
        # Become primary only if no other primary exists (first admin / bootstrap case)
        explicit_primary = await db.users.find_one({
            "role": "admin",
            "is_primary_admin": True,
            "id": {"$ne": current_user["id"]},
        })
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

    return {
        "message": "Delega effettuata",
        "new_primary_admin_id": new_admin["id"],
        "new_primary_admin_name": new_admin.get("full_name", ""),
    }


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
