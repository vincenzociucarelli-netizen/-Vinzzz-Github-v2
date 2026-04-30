"""
Notifications routes.
- /admin/notifications/* (admin-only notifications)
- /user/notifications/* (per-user notifications: parents, athletes, coaches, etc.)
- /notifications/photo-removal-request (photo removal request)
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import db
from auth_utils import get_current_user
from models.enums import UserRole
from utils import clean_mongo_doc

router = APIRouter()


class CertificateOverrideAuthorizeRequest(BaseModel):
    reason: str  # Motivo dell'override - obbligatorio (>=5 caratteri)


class CertificateOverrideDenyRequest(BaseModel):
    reason: str = ""  # Motivo opzionale del rifiuto


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


# ==================== CERTIFICATE OVERRIDE FROM NOTIFICATION (athlete-specific) ====================

@router.post("/admin/notifications/{notification_id}/authorize-override")
async def authorize_certificate_override_from_notification(
    notification_id: str,
    data: CertificateOverrideAuthorizeRequest,
    request: Request,
    current_user = Depends(get_current_user)
):
    """
    Approve athlete-specific certificate override from an admin notification.
    Activates a SINGLE-USE override for the specific athlete (consumed on next valid scan).
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può autorizzare l'override")

    if not data.reason or len(data.reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="Motivo obbligatorio (minimo 5 caratteri)")

    notification = await db.admin_notifications.find_one({"id": notification_id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    if notification.get("type") != "expired_cert_scan":
        raise HTTPException(status_code=400, detail="Tipo notifica non valido per override")
    if notification.get("override_status") in ("authorized", "denied"):
        raise HTTPException(status_code=400, detail=f"Notifica già {notification.get('override_status')}")

    athlete_id = notification.get("athlete_id") or (notification.get("data") or {}).get("athlete_id")
    athlete_name = notification.get("athlete_name") or (notification.get("data") or {}).get("athlete_name", "Atleta")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="Atleta non identificabile dalla notifica")

    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")

    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    reason = data.reason.strip()
    now_iso = datetime.utcnow().isoformat()

    # Activate single-use, athlete-specific override (no time expiration: consumed on next scan)
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {
            "certificate_override_active": True,
            "certificate_override_by": current_user["id"],
            "certificate_override_reason": reason,
            "certificate_override_timestamp": now_iso,
            "certificate_override_notification_id": notification_id,
        }}
    )

    # Audit log (legacy + standardized)
    audit_entry = {
        "id": str(uuid.uuid4()),
        "athlete_id": athlete_id,
        "athlete_name": athlete_name,
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name", current_user.get("email")),
        "reason": reason,
        "timestamp": now_iso,
        "ip_address": client_ip,
        "type": "certificate_block_override",
        "override_type": "single_session",
        "source": "admin_notification",
        "notification_id": notification_id,
    }
    await db.audit_logs.insert_one(audit_entry)

    # Update notification status
    await db.admin_notifications.update_one(
        {"id": notification_id},
        {"$set": {
            "override_status": "authorized",
            "override_reason": reason,
            "override_authorized_by": current_user["id"],
            "override_authorized_by_name": current_user.get("full_name", current_user.get("email")),
            "override_authorized_at": now_iso,
            "read": True,
        }}
    )

    return {
        "message": "Override autorizzato",
        "athlete_id": athlete_id,
        "athlete_name": athlete_name,
        "reason": reason,
    }


@router.post("/admin/notifications/{notification_id}/deny-override")
async def deny_certificate_override_from_notification(
    notification_id: str,
    data: CertificateOverrideDenyRequest,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Reject the certificate override request from a notification."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può rifiutare l'override")

    notification = await db.admin_notifications.find_one({"id": notification_id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    if notification.get("type") != "expired_cert_scan":
        raise HTTPException(status_code=400, detail="Tipo notifica non valido")
    if notification.get("override_status") in ("authorized", "denied"):
        raise HTTPException(status_code=400, detail=f"Notifica già {notification.get('override_status')}")

    athlete_id = notification.get("athlete_id") or (notification.get("data") or {}).get("athlete_id")
    athlete_name = notification.get("athlete_name") or (notification.get("data") or {}).get("athlete_name", "Atleta")

    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    now_iso = datetime.utcnow().isoformat()
    deny_reason = (data.reason or "").strip() or "Override rifiutato dall'admin"

    audit_entry = {
        "id": str(uuid.uuid4()),
        "athlete_id": athlete_id,
        "athlete_name": athlete_name,
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name", current_user.get("email")),
        "reason": deny_reason,
        "timestamp": now_iso,
        "ip_address": client_ip,
        "type": "certificate_access_denied",
        "source": "admin_notification",
        "notification_id": notification_id,
    }
    await db.audit_logs.insert_one(audit_entry)

    await db.admin_notifications.update_one(
        {"id": notification_id},
        {"$set": {
            "override_status": "denied",
            "override_deny_reason": deny_reason,
            "override_denied_by": current_user["id"],
            "override_denied_by_name": current_user.get("full_name", current_user.get("email")),
            "override_denied_at": now_iso,
            "read": True,
        }}
    )

    return {"message": "Richiesta override rifiutata", "athlete_id": athlete_id}


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
