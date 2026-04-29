"""
User role and status enumerations.
Used across the backend for role-based access control.
"""


class UserRole:
    ADMIN = "admin"
    VIEWER = "viewer"          # Dirigente solo visualizzazione
    DIRIGENTE = "dirigente"    # Dirigenti sportivi
    COACH = "coach"
    COLLABORATORE = "collaboratore"
    PARENT = "parent"
    ATHLETE = "athlete"


class UserStatus:
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


__all__ = ["UserRole", "UserStatus"]
