"""
Pydantic models for season archives.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class SeasonArchive(BaseModel):
    """Archivio storico di una stagione sportiva (01/07 - 30/06)."""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    season_name: str  # e.g., "2024-2025"
    start_date: datetime  # 01/07/YYYY
    end_date: datetime  # 30/06/YYYY+1
    is_current: bool = False
    teams: List[dict] = []
    coaches: List[dict] = []
    total_athletes: int = 0
    total_teams: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    archived_at: Optional[datetime] = None
    archived_by: Optional[str] = None


__all__ = ["SeasonArchive"]
