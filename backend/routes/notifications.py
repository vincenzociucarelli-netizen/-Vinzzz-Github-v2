"""
Notifications routes.
- /admin/notifications/* (admin-only notifications)
- /user/notifications/* (per-user notifications: parents, athletes, coaches, etc.)
- /notifications/photo-removal-request (photo removal request)
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from database import db
from auth_utils import get_current_user
from models.enums import UserRole
from utils import clean_mongo_doc

router = APIRouter()


# ==================== ADMIN NOTIFICATIONS ====================

@router.get("/admin/notifications")
async def get_admin_notifications(current_user = Depends(get_current_user)):
    """Get all admin notifications."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le notifiche")
    
    notifications = await db.admin_notifications.find({}).sort("created_at", -1).to_list(100)
    result = []
    for n in notifications:
        clean_mongo_doc(n)
        if 'created_at' in n and n['created_at']:
            ca = n['created_at']
            if isinstance(ca, datetime):
                n['created_at'] = ca.replace(tzinfo=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
            elif isinstance(ca, str) and len(ca) == 10:
                n['created_at'] = ca + 'T00:00:00+00:00'
        result.append(n)
    return JSONResponse(content=result)


@router.get("/admin/notifications/unread-count")
async def get_unread_notifications_count(current_user = Depends(get_current_user)):
    """Get count of unread admin notifications."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le notifiche")
    
    count = await db.admin_notifications.count_documents({"read": False})
    return {"count": count}


@router.patch("/admin/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user = Depends(get_current_user)):
    """Mark an admin notification as read."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire le notifiche")
    
    result = await db.admin_notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return {"message": "Notifica segnata come letta"}


@router.patch("/admin/notifications/mark-all-read")
async def mark_all_notifications_read(current_user = Depends(get_current_user)):
    """Mark all admin notifications as read."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire le notifiche")
    
    await db.admin_notifications.update_many(
        {"read": False},
        {"$set": {"read": True}}
    )
    return {"message": "Tutte le notifiche segnate come lette"}


@router.delete("/admin/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user = Depends(get_current_user)):
    """Delete an admin notification."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire le notifiche")
    
    result = await db.admin_notifications.delete_one({"id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return {"message": "Notifica eliminata"}


# ==================== USER NOTIFICATIONS (parents, athletes, coaches) ====================

@router.get("/user/notifications")
async def get_user_notifications(current_user = Depends(get_current_user)):
    """Get notifications for the current user."""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).to_list(50)
    result = []
    for n in notifications:
        clean_mongo_doc(n)
        if 'created_at' in n and n['created_at']:
            ca = n['created_at']
            if isinstance(ca, datetime):
                n['created_at'] = ca.replace(tzinfo=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
        result.append(n)
    return result


@router.get("/user/notifications/unread-count")
async def get_user_unread_count(current_user = Depends(get_current_user)):
    """Get count of unread user notifications."""
    count = await db.notifications.count_documents({"user_id": current_user["id"], "read": False})
    return {"count": count}


@router.patch("/user/notifications/{notification_id}/read")
async def mark_user_notification_read(notification_id: str, current_user = Depends(get_current_user)):
    """Mark a user notification as read."""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "OK"}


@router.patch("/user/notifications/mark-all-read")
async def mark_all_user_notifications_read(current_user = Depends(get_current_user)):
    """Mark all user notifications as read."""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "OK"}


# ==================== PHOTO REMOVAL ====================

@router.post("/notifications/photo-removal-request")
async def request_photo_removal(current_user = Depends(get_current_user)):
    """Parent/staff requests removal of their photos from society publications."""
    user_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip()
    
    notification = {
        "id": str(uuid.uuid4()),
        "society_id": current_user.get("society_id"),
        "type": "photo_removal_request",
        "title": "Richiesta rimozione immagini",
        "message": f"{user_name} ({current_user.get('email', '')}) ha richiesto la rimozione delle proprie immagini da tutte le pubblicazioni della società.",
        "priority": "high",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
        "user_id": current_user["id"],
    }
    await db.admin_notifications.insert_one(notification)
    return {"message": "Richiesta di rimozione immagini inviata all'amministratore"}
