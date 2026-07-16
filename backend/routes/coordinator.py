"""
Ruolo COORDINATORE — figura intermedia Admin/Dirigente.
🆕 27/02/2026 (v7.15).

Il Coordinatore ha permessi granulari impostati dal Main Admin. Vede/edita
solo le sezioni contrassegnate dal Main Admin nel campo
`users.coordinator_permissions` (list of strings — chiavi in `COORDINATOR_PERMISSIONS`).

Endpoint:
- GET    /admin/coordinators                  → lista coordinatori della società
- POST   /admin/coordinators                  → crea nuovo coordinatore
- PATCH  /admin/coordinators/{id}/permissions → aggiorna permessi (checkbox admin)
- PATCH  /admin/coordinators/{id}             → aggiorna anagrafica base
- DELETE /admin/coordinators/{id}             → rimuove il coordinatore
- GET    /coordinator/permissions             → il coordinatore recupera i propri permessi (login flow)
- GET    /admin/coordinator-permission-keys   → lista chiavi disponibili + label (per UI admin)
"""

import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from database import db
from auth_utils import get_current_user


router = APIRouter(prefix="", tags=["coordinator"])

ADMIN_ROLE = "admin"
COORDINATOR_ROLE = "coordinatore"


# --- Modelli input ---
class CoordinatorCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    fiscal_code: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)


class CoordinatorPermissionsUpdate(BaseModel):
    permissions: List[str]


class CoordinatorProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    fiscal_code: Optional[str] = None


# --- Helpers ---
def _require_admin(user: Dict[str, Any]):
    if user.get("role") != ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Solo admin")


def _get_permission_keys() -> Dict[str, str]:
    # Import lazy per evitare dipendenze circolari
    from server import COORDINATOR_PERMISSIONS  # type: ignore
    return dict(COORDINATOR_PERMISSIONS)


def _clean_permissions(perms: List[str]) -> List[str]:
    """Filtra le permission passate dall'utente mantenendo solo quelle valide."""
    valid = set(_get_permission_keys().keys())
    return [p for p in (perms or []) if isinstance(p, str) and p in valid]


# --- Endpoint chiavi permessi (per admin UI) ---
@router.get("/admin/coordinator-permission-keys")
async def get_permission_keys(current_user=Depends(get_current_user)):
    _require_admin(current_user)
    keys = _get_permission_keys()
    return [{"key": k, "label": v} for k, v in keys.items()]


# --- Lista coordinatori ---
@router.get("/admin/coordinators")
async def list_coordinators(current_user=Depends(get_current_user)):
    _require_admin(current_user)
    sid = current_user.get("society_id")
    q = {"role": COORDINATOR_ROLE, "society_id": sid}
    proj = {"_id": 0, "id": 1, "email": 1, "first_name": 1, "last_name": 1,
            "phone": 1, "fiscal_code": 1, "coordinator_permissions": 1,
            "status": 1, "created_at": 1}
    items = await db.users.find(q, proj).sort("last_name", 1).to_list(200)
    return items


# --- Crea coordinatore ---
@router.post("/admin/coordinators")
async def create_coordinator(data: CoordinatorCreate, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    sid = current_user.get("society_id")

    email = data.email.lower().strip()
    exists = await db.users.find_one({"email": email})
    if exists:
        raise HTTPException(status_code=400, detail=f"Email già registrata: {email}")

    perms = _clean_permissions(data.permissions)

    new_id = str(uuid.uuid4())
    doc = {
        "id": new_id,
        "society_id": sid,
        "role": COORDINATOR_ROLE,
        "email": email,
        "first_name": (data.first_name or "").title(),
        "last_name": (data.last_name or "").upper(),
        "full_name": f"{(data.last_name or '').upper()} {(data.first_name or '').title()}".strip(),
        "phone": data.phone,
        "fiscal_code": (data.fiscal_code or "").upper() or None,
        "coordinator_permissions": perms,
        "status": "pending_email",  # deve completare registrazione via link email
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["id"],
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    return doc


# --- Aggiorna permessi (checkbox flow) ---
@router.patch("/admin/coordinators/{coord_id}/permissions")
async def update_permissions(coord_id: str, data: CoordinatorPermissionsUpdate,
                              current_user=Depends(get_current_user)):
    _require_admin(current_user)
    sid = current_user.get("society_id")
    perms = _clean_permissions(data.permissions)
    r = await db.users.update_one(
        {"id": coord_id, "society_id": sid, "role": COORDINATOR_ROLE},
        {"$set": {"coordinator_permissions": perms}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coordinatore non trovato")
    return {"success": True, "permissions": perms}


# --- Aggiorna anagrafica ---
@router.patch("/admin/coordinators/{coord_id}")
async def update_coordinator_profile(coord_id: str, data: CoordinatorProfileUpdate,
                                      current_user=Depends(get_current_user)):
    _require_admin(current_user)
    sid = current_user.get("society_id")
    update: Dict[str, Any] = {}
    if data.first_name is not None:
        update["first_name"] = data.first_name.title()
    if data.last_name is not None:
        update["last_name"] = data.last_name.upper()
    if data.first_name is not None or data.last_name is not None:
        # aggiorna full_name
        u = await db.users.find_one({"id": coord_id, "society_id": sid},
                                     {"_id": 0, "first_name": 1, "last_name": 1})
        if u:
            fn = update.get("first_name", u.get("first_name", ""))
            ln = update.get("last_name", u.get("last_name", ""))
            update["full_name"] = f"{ln} {fn}".strip()
    if data.phone is not None:
        update["phone"] = data.phone
    if data.fiscal_code is not None:
        update["fiscal_code"] = data.fiscal_code.upper() or None
    if not update:
        return {"success": True, "message": "Nulla da aggiornare"}
    r = await db.users.update_one(
        {"id": coord_id, "society_id": sid, "role": COORDINATOR_ROLE},
        {"$set": update},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coordinatore non trovato")
    return {"success": True}


# --- Elimina coordinatore ---
@router.delete("/admin/coordinators/{coord_id}")
async def delete_coordinator(coord_id: str, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    sid = current_user.get("society_id")
    r = await db.users.delete_one(
        {"id": coord_id, "society_id": sid, "role": COORDINATOR_ROLE},
    )
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coordinatore non trovato")
    return {"success": True}


# --- Endpoint per il coordinatore che recupera i propri permessi ---
@router.get("/coordinator/permissions")
async def get_own_permissions(current_user=Depends(get_current_user)):
    if current_user.get("role") != COORDINATOR_ROLE:
        raise HTTPException(status_code=403, detail="Solo coordinatore")
    perms = current_user.get("coordinator_permissions") or []
    keys = _get_permission_keys()
    return {
        "permissions": perms,
        "labels": {k: keys[k] for k in perms if k in keys},
    }
