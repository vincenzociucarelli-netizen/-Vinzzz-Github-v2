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
    """Tells the frontend who is primary, whether the current user IS primary,
    and whether the declaration has been signed."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    primary_id = await _resolve_primary_admin_id()
    primary_user = None
    if primary_id:
        primary_user = await db.users.find_one(
            {"id": primary_id},
            {
                "_id": 0,
                "id": 1,
                "email": 1,
                "full_name": 1,
                "primary_admin_declaration": 1,
                "primary_admin_declaration_at": 1,
            },
        )

    is_current_primary = primary_user is not None and primary_user.get("id") == current_user["id"]
    declaration_signed = bool(primary_user and primary_user.get("primary_admin_declaration") in PRIMARY_DECLARATION_TYPES)

    # Admin list for potential delegation (excluding the current primary)
    admins = []
    if is_current_primary:
        async for a in db.users.find(
            {"role": "admin", "id": {"$ne": primary_id}},
            {"_id": 0, "id": 1, "email": 1, "full_name": 1},
        ).sort("full_name", 1):
            admins.append(a)

    return {
        "primary_admin_id": primary_id,
        "primary_admin_name": (primary_user or {}).get("full_name") if primary_user else None,
        "primary_admin_email": (primary_user or {}).get("email") if primary_user else None,
        "is_current_user_primary": is_current_primary,
        "declaration_signed": declaration_signed,
        "declaration_type": (primary_user or {}).get("primary_admin_declaration") if primary_user else None,
        "declaration_at": (primary_user or {}).get("primary_admin_declaration_at") if primary_user else None,
        # Admin list only if current user is primary (for delegation UI)
        "delegable_admins": admins,
        # If a primary is set via flag; used by FE to distinguish auto-resolved from explicit
        "primary_set_explicitly": bool(await db.users.find_one({"role": "admin", "is_primary_admin": True})),
    }


@router.post("/admin/primary-admin/declare")
async def declare_primary_admin(
    data: PrimaryDeclarationRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Primary admin signs their declaration (legal representative or authorized delegate)."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    if data.declaration_type not in PRIMARY_DECLARATION_TYPES:
        raise HTTPException(status_code=400, detail="Tipo dichiarazione non valido")
    if not data.confirmed:
        raise HTTPException(status_code=400, detail="Devi confermare la dichiarazione")

    if not await is_primary_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo il Responsabile Admin può firmare questa dichiarazione")

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if "," in (client_ip or ""):
        client_ip = client_ip.split(",")[0].strip()

    now_iso = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "is_primary_admin": True,  # ensure the flag is explicit
                "primary_admin_declaration": data.declaration_type,
                "primary_admin_declaration_at": now_iso,
                "primary_admin_declaration_ip": client_ip,
            }
        },
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
    """Current primary admin delegates the role to another admin.
    The new admin must then sign their own declaration.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")

    if not await is_primary_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo il Responsabile Admin attuale può delegare")

    new_admin = await db.users.find_one({"id": data.new_admin_id, "role": "admin"})
    if not new_admin:
        raise HTTPException(status_code=404, detail="Admin destinatario non trovato")
    if new_admin["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi delegare a te stesso")

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if "," in (client_ip or ""):
        client_ip = client_ip.split(",")[0].strip()

    now_iso = datetime.now(timezone.utc).isoformat()

    # Remove primary flag and declaration from the current user
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "is_primary_admin": False,
                "primary_admin_declaration": None,
                "primary_admin_declaration_at": None,
                "primary_admin_declaration_ip": None,
            }
        },
    )
    # Set the flag on the new admin (declaration NOT carried over - must re-sign)
    await db.users.update_one(
        {"id": new_admin["id"]},
        {
            "$set": {
                "is_primary_admin": True,
                "primary_admin_declaration": None,
                "primary_admin_declaration_at": None,
                "primary_admin_declaration_ip": None,
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

    # Also disable any active "keep_disabled" override (new primary must re-decide)
    settings = await db.settings.find_one({"type": "society"})
    if settings and settings.get("override_keep_disabled"):
        await db.settings.update_one(
            {"type": "society"},
            {
                "$set": {
                    "override_keep_disabled": False,
                    "block_expired_certificates": True,
                    "override_auto_reactivate_at": None,
                    "override_deactivation_reason": None,
                    "override_deactivated_by": None,
                    "override_deactivated_by_name": None,
                    "override_deactivated_at": None,
                }
            },
        )

    return {
        "message": "Responsabile Admin delegato",
        "new_primary_admin_id": new_admin["id"],
        "new_primary_admin_name": new_admin.get("full_name", ""),
    }
