"""
Bacheca Note Admin — task list condivisa per amministratori.
🆕 19/07/2026.

Tutti gli admin della società vedono TUTTE le note e chiunque può:
- Creare una nota (con titolo, descrizione, priorità, scadenza opzionale)
- Prendere in carico una nota (flag "presa in carico")
- Marcarla come completata (flag "fatto") → sposta in sezione "Già fatto"
- Riaprire una nota completata (torna alle note attive)
- Modificare/eliminare una nota (solo il creatore o qualsiasi admin)

Endpoint (prefix /api):
- GET    /admin/notes                    → lista note attive della società
- GET    /admin/notes/completed          → lista note completate (DESC per completed_at)
- POST   /admin/notes                    → crea nota
- PATCH  /admin/notes/{id}               → modifica title/description/priority/due_date
- POST   /admin/notes/{id}/take          → prende in carico (self-assign)
- POST   /admin/notes/{id}/untake        → rilascia la presa in carico
- POST   /admin/notes/{id}/complete      → marca come completata
- POST   /admin/notes/{id}/reopen        → riapre nota completata
- DELETE /admin/notes/{id}               → elimina nota
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from auth_utils import get_current_user


router = APIRouter(prefix="", tags=["admin_notes"])

ADMIN_ROLE = "admin"


def _require_admin(user: dict):
    if user.get("role") != ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Solo gli admin possono accedere alla bacheca note")


def _display_name(user: dict) -> str:
    """Nome leggibile per audit. get_current_user() restituisce `full_name`
    ma non first_name/last_name, quindi diamo priorità a full_name."""
    full = (user.get("full_name") or "").strip()
    if full:
        return full
    fn = (user.get("first_name") or "").strip()
    ln = (user.get("last_name") or "").strip()
    combined = f"{fn} {ln}".strip()
    return combined or (user.get("email") or "Admin")


def _serialize(note: dict) -> dict:
    """Serializza una nota rimuovendo _id di Mongo e normalizzando i datetime."""
    out = {k: v for k, v in note.items() if k != "_id"}
    for k in ("created_at", "taken_at", "completed_at"):
        v = out.get(k)
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


# --- Modelli input ---
class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Literal["high", "medium", "low"] = "medium"
    due_date: Optional[str] = None  # ISO date "YYYY-MM-DD"


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[Literal["high", "medium", "low"]] = None
    due_date: Optional[str] = None  # empty string → clear


# --- Endpoints ---
@router.get("/admin/notes")
async def list_active_notes(current_user=Depends(get_current_user)):
    """Lista note non ancora completate, ordinate: prima le prese in carico (per data)
    e poi le libere, con priorità alta in cima."""
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    if not society_id:
        return []
    priority_order = {"high": 0, "medium": 1, "low": 2}
    cursor = db.admin_notes.find({"society_id": society_id, "completed": False})
    notes = [_serialize(n) async for n in cursor]
    notes.sort(key=lambda n: (
        priority_order.get(n.get("priority", "medium"), 1),
        n.get("due_date") or "9999-12-31",
        n.get("created_at") or "",
    ))
    return notes


@router.get("/admin/notes/completed")
async def list_completed_notes(limit: int = 100, current_user=Depends(get_current_user)):
    """Lista note completate, DESC per completed_at (le più recenti in cima)."""
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    if not society_id:
        return []
    limit = max(1, min(500, int(limit or 100)))
    cursor = (
        db.admin_notes
        .find({"society_id": society_id, "completed": True})
        .sort("completed_at", -1)
        .limit(limit)
    )
    return [_serialize(n) async for n in cursor]


@router.post("/admin/notes")
async def create_note(payload: NoteCreate, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    if not society_id:
        raise HTTPException(status_code=400, detail="Società non identificata")

    now = datetime.now(timezone.utc)
    note = {
        "id": str(uuid.uuid4()),
        "society_id": society_id,
        "title": payload.title.strip(),
        "description": (payload.description or "").strip() or None,
        "priority": payload.priority,
        "due_date": (payload.due_date or "").strip() or None,
        "created_by": current_user["id"],
        "created_by_name": _display_name(current_user),
        "created_at": now,
        "taken_by": None,
        "taken_by_name": None,
        "taken_at": None,
        "completed": False,
        "completed_by": None,
        "completed_by_name": None,
        "completed_at": None,
    }
    await db.admin_notes.insert_one(note)
    return _serialize(note)


@router.patch("/admin/notes/{note_id}")
async def update_note(note_id: str, payload: NoteUpdate, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    note = await db.admin_notes.find_one({"id": note_id, "society_id": society_id})
    if not note:
        raise HTTPException(status_code=404, detail="Nota non trovata")

    updates: dict = {}
    if payload.title is not None:
        updates["title"] = payload.title.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip() or None
    if payload.priority is not None:
        updates["priority"] = payload.priority
    if payload.due_date is not None:
        val = payload.due_date.strip()
        updates["due_date"] = val or None

    if updates:
        await db.admin_notes.update_one({"id": note_id}, {"$set": updates})
    updated = await db.admin_notes.find_one({"id": note_id})
    return _serialize(updated)


@router.post("/admin/notes/{note_id}/take")
async def take_note(note_id: str, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    note = await db.admin_notes.find_one({"id": note_id, "society_id": society_id})
    if not note:
        raise HTTPException(status_code=404, detail="Nota non trovata")
    if note.get("completed"):
        raise HTTPException(status_code=400, detail="Nota già completata")
    # 🐛 20/07/2026 — Non permettere di sovrascrivere una presa in carico di
    # un altro admin. Solo chi non l'ha ancora presa può assegnarsela.
    current_taker = note.get("taken_by")
    if current_taker and current_taker != current_user["id"]:
        raise HTTPException(
            status_code=409,
            detail=f"Nota già presa in carico da {note.get('taken_by_name') or 'un altro admin'}",
        )

    await db.admin_notes.update_one(
        {"id": note_id},
        {"$set": {
            "taken_by": current_user["id"],
            "taken_by_name": _display_name(current_user),
            "taken_at": datetime.now(timezone.utc),
        }},
    )
    updated = await db.admin_notes.find_one({"id": note_id})
    return _serialize(updated)


@router.post("/admin/notes/{note_id}/untake")
async def untake_note(note_id: str, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    note = await db.admin_notes.find_one({"id": note_id, "society_id": society_id})
    if not note:
        raise HTTPException(status_code=404, detail="Nota non trovata")
    # 🐛 20/07/2026 — Solo chi ha preso in carico può deselezionarsi.
    current_taker = note.get("taken_by")
    if current_taker and current_taker != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail=f"Solo {note.get('taken_by_name') or 'chi ha preso in carico'} può rilasciare questa nota",
        )

    await db.admin_notes.update_one(
        {"id": note_id},
        {"$set": {"taken_by": None, "taken_by_name": None, "taken_at": None}},
    )
    updated = await db.admin_notes.find_one({"id": note_id})
    return _serialize(updated)


@router.post("/admin/notes/{note_id}/complete")
async def complete_note(note_id: str, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    note = await db.admin_notes.find_one({"id": note_id, "society_id": society_id})
    if not note:
        raise HTTPException(status_code=404, detail="Nota non trovata")
    if note.get("completed"):
        raise HTTPException(status_code=400, detail="Nota già completata")

    await db.admin_notes.update_one(
        {"id": note_id},
        {"$set": {
            "completed": True,
            "completed_by": current_user["id"],
            "completed_by_name": _display_name(current_user),
            "completed_at": datetime.now(timezone.utc),
        }},
    )
    updated = await db.admin_notes.find_one({"id": note_id})
    return _serialize(updated)


@router.post("/admin/notes/{note_id}/reopen")
async def reopen_note(note_id: str, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    note = await db.admin_notes.find_one({"id": note_id, "society_id": society_id})
    if not note:
        raise HTTPException(status_code=404, detail="Nota non trovata")
    if not note.get("completed"):
        raise HTTPException(status_code=400, detail="La nota non risulta completata")

    await db.admin_notes.update_one(
        {"id": note_id},
        {"$set": {
            "completed": False,
            "completed_by": None,
            "completed_by_name": None,
            "completed_at": None,
        }},
    )
    updated = await db.admin_notes.find_one({"id": note_id})
    return _serialize(updated)


@router.delete("/admin/notes/{note_id}")
async def delete_note(note_id: str, current_user=Depends(get_current_user)):
    _require_admin(current_user)
    society_id = current_user.get("society_id")
    note = await db.admin_notes.find_one({"id": note_id, "society_id": society_id})
    if not note:
        raise HTTPException(status_code=404, detail="Nota non trovata")
    await db.admin_notes.delete_one({"id": note_id})
    return {"message": "Nota eliminata"}
