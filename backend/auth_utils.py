"""
Authentication utilities.
JWT token creation/verification, password hashing, get_current_user dependency.

Usage:
    from auth_utils import get_current_user, hash_password, verify_password, create_token
"""
import os
import logging
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import jwt

from database import db

# Security context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash a plain password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_token(user_id: str, role: str, athlete_id: str = None) -> str:
    """Create a JWT token for the given user."""
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    if athlete_id:
        payload["athlete_id"] = athlete_id
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """FastAPI dependency to extract and validate the current user from JWT."""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        role = payload.get("role")
        
        # Minor role: user_id is the athlete_id, no user document
        if role == "minor":
            athlete = await db.athletes.find_one(
                {"id": user_id},
                {"_id": 0, "id": 1, "full_name": 1, "status": 1, "society_id": 1},
            )
            if not athlete:
                raise HTTPException(status_code=401, detail="Atleta non trovato")
            return {
                "id": user_id,
                "role": "minor",
                "email": "",
                "full_name": athlete.get("full_name", ""),
                "assigned_teams": [],
                "status": athlete.get("status", "active"),
                "society_id": athlete.get("society_id"),
                "athlete_id": user_id,
            }

        # Projection: fetch only the fields we actually need to avoid transferring
        # heavy base64 image fields (profile_photo, etc.) on EVERY request.
        user = await db.users.find_one(
            {"id": user_id},
            {
                "_id": 0,
                "email": 1,
                "full_name": 1,
                "assigned_teams": 1,
                "status": 1,
                "society_id": 1,
                "athlete_id": 1,
                "coach_id": 1,
            },
        )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "id": user_id, 
            "role": role, 
            "email": user["email"], 
            "full_name": user["full_name"],
            "assigned_teams": user.get("assigned_teams", []),
            "status": user.get("status", "pending"),
            "society_id": user.get("society_id"),
            "athlete_id": user.get("athlete_id"),
            "coach_id": user.get("coach_id"),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logging.error(f"JWT decode error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")


__all__ = [
    "pwd_context",
    "security",
    "SECRET_KEY",
    "ALGORITHM",
    "hash_password",
    "verify_password",
    "create_token",
    "get_current_user",
]
