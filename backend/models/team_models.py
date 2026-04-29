"""
Pydantic models for teams.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class TrainingSession(BaseModel):
    day: str  # es: "Lunedì", "Martedì"
    time: str  # es: "18:00 / 20:00"
    venue: str  # es: "Palestra Liceo Alessi"


class MatchDay(BaseModel):
    day: str  # es: "Sabato"
    time: str  # es: "18:00"
    venue: str  # es: "Palestra Liceo Alessi"


class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    society_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    team_photo: Optional[str] = None
    is_prima_squadra: bool = False
    created_by_admin_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    total_amount: float = 0.0
    installments: List[dict] = []
    installment_1_amount: float = 0.0
    installment_2_amount: float = 0.0
    installment_2_due_date: Optional[datetime] = None
    installment_3_amount: float = 0.0
    installment_3_due_date: Optional[datetime] = None
    bank_info: Optional[str] = None
    paypal_email: Optional[str] = None
    training_sessions: List[dict] = []
    match_day: Optional[dict] = None
    rifinitura: Optional[dict] = None
    warmup_session: Optional[dict] = None
    venue: Optional[str] = None
    training_schedule: Optional[str] = None
    championships: Optional[str] = None
    calendar_link: Optional[str] = None


class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_prima_squadra: bool = False
    total_amount: float = 0.0
    installments: Optional[List[dict]] = []
    installment_1_amount: float = 0.0
    installment_2_amount: float = 0.0
    installment_2_due_date: Optional[str] = None
    installment_3_amount: float = 0.0
    installment_3_due_date: Optional[str] = None
    bank_info: Optional[str] = None
    paypal_email: Optional[str] = None
    venue: Optional[str] = None
    training_schedule: Optional[str] = None
    training_sessions: Optional[List[dict]] = []
    trainings: Optional[List[dict]] = []
    match_day: Optional[dict] = None
    rifinitura: Optional[dict] = None
    championships: Optional[str] = None
    calendar_link: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    team_photo: Optional[str] = None
    is_prima_squadra: Optional[bool] = None
    total_amount: Optional[float] = None
    installments: Optional[List[dict]] = None
    installment_1_amount: Optional[float] = None
    installment_2_amount: Optional[float] = None
    installment_2_due_date: Optional[str] = None
    installment_3_amount: Optional[float] = None
    installment_3_due_date: Optional[str] = None
    bank_info: Optional[str] = None
    paypal_email: Optional[str] = None
    venue: Optional[str] = None
    training_schedule: Optional[str] = None
    training_sessions: Optional[List[dict]] = None
    match_day: Optional[dict] = None
    rifinitura: Optional[dict] = None
    championships: Optional[str] = None
    calendar_link: Optional[str] = None


class AssignmentRequest(BaseModel):
    ids: List[str] = []


__all__ = ["TrainingSession", "MatchDay", "Team", "TeamCreate", "TeamUpdate", "AssignmentRequest"]
