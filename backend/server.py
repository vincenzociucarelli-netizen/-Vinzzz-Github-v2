from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
import base64
import io
import qrcode
from bson import ObjectId

# PDF generation imports
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    HAS_PDF_GENERATION = True
except ImportError:
    HAS_PDF_GENERATION = False
    logging.warning("reportlab not available, PDF generation disabled")

# Image processing
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    logging.warning("PIL not available")

# Emergent LLM integration for image generation
try:
    from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
    HAS_IMAGE_GENERATION = True
except ImportError:
    HAS_IMAGE_GENERATION = False
    logging.warning("emergentintegrations not available, image generation disabled")

# OpenAI client for image editing
try:
    from openai import AsyncOpenAI
    HAS_OPENAI_CLIENT = True
except ImportError:
    HAS_OPENAI_CLIENT = False
    logging.warning("openai client not available")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Signed documents directory
SIGNED_DOCS_DIR = ROOT_DIR / "signed_documents"
SIGNED_DOCS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")  # Set in .env
ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== HEALTH CHECK (ROOT) ====================
# Health check endpoint for Kubernetes
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "backend"}

# ==================== MODELS ====================

import secrets
import string

def generate_invite_code(length=8):
    """Generate a random invite code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

class UserRole:
    ADMIN = "admin"
    VIEWER = "viewer"  # Dirigente solo visualizzazione
    COACH = "coach"
    PARENT = "parent"
    ATHLETE = "athlete"

class UserStatus:
    PENDING = "pending"      # In attesa di approvazione
    APPROVED = "approved"    # Approvato
    REJECTED = "rejected"    # Rifiutato
    SUSPENDED = "suspended"  # Sospeso

# ==================== SOCIETY MODEL (Multi-tenancy) ====================

class Society(BaseModel):
    """Società sportiva - entità principale per multi-tenancy"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    name: str  # Nome società (es. "Pallavolo Perugia SSD")
    logo: Optional[str] = None  # Base64 encoded logo
    invite_code: str = Field(default_factory=lambda: generate_invite_code())  # Codice invito
    
    # Dati società
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    fiscal_code: Optional[str] = None  # Codice fiscale/P.IVA
    
    # Owner (primo admin che ha creato la società)
    owner_id: Optional[str] = None
    
    # Impostazioni
    is_active: bool = True
    subscription_tier: str = "free"  # free, basic, premium
    subscription_expires: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SocietyCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    society_id: Optional[str] = None  # ID della società di appartenenza (multi-tenancy)
    email: EmailStr
    password_hash: str
    role: str  # admin, viewer, coach, parent, athlete
    full_name: str
    status: str = UserStatus.PENDING  # pending, approved, rejected, suspended
    assigned_teams: List[str] = []  # For coaches and dirigenti - team IDs they can manage
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None  # Admin ID who approved
    is_scorekeeper: bool = False  # For dirigenti - segnapunti
    qualification: Optional[str] = None  # For dirigenti - qualifica (es: Presidente, Vice Presidente)
    
    # Coach specific fields - Dati Anagrafici
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    place_of_birth: Optional[str] = None
    birth_province: Optional[str] = None  # Sigla provincia di nascita (es: PG, RM)
    fiscal_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    
    # Documento di identità
    identity_document_type: Optional[str] = None  # Carta di identità, Patente, Passaporto
    identity_document_number: Optional[str] = None  # Numero del documento
    identity_document_expiry: Optional[datetime] = None  # Scadenza documento
    
    # Coach specific - Tesserino
    coach_license_number: Optional[str] = None  # Numero tesserino allenatore
    coach_license_expiry: Optional[datetime] = None
    
    # Coach specific - Compensi
    monthly_compensation: Optional[float] = None  # Compenso mensile da questa ASD
    other_annual_compensation: Optional[float] = None  # Compensi annuali da altre ASD/SSD dichiarati
    compensation_accepted: bool = False  # Flag accettazione compenso
    compensation_accepted_date: Optional[datetime] = None
    contract_start_date: Optional[datetime] = None  # Data inizio contratto
    contract_end_date: Optional[datetime] = None  # Default 31/05 o esonero
    is_terminated: bool = False  # Se esonerato/rinunciato

class CoachCompensation(BaseModel):
    """Monthly compensation record for coaches"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    coach_id: str
    month: int  # 1-12
    year: int
    amount_gross: float  # Compenso lordo
    amount_net: float  # Netto corrisposto (= lordo se sotto €5.000)
    deductions: float = 0.0  # Ritenute (se applicate)
    received: bool = False  # Flag pagamento ricevuto
    received_date: Optional[datetime] = None
    # Quietanza firmata
    receipt_signed: bool = False  # Quietanza firmata
    receipt_signature_base64: Optional[str] = None
    receipt_document_id: Optional[str] = None  # ID del documento PDF generato
    receipt_signed_date: Optional[datetime] = None
    # Soglie superate
    exceeded_5000: bool = False  # Flag superamento €5.000 annuali
    exceeded_5000_date: Optional[datetime] = None
    exceeded_5000_declaration_id: Optional[str] = None  # Documento dichiarazione
    exceeded_15000: bool = False  # Flag superamento €15.000 annuali
    exceeded_15000_date: Optional[datetime] = None
    exceeded_15000_declaration_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DirigenteCompensation(BaseModel):
    """Monthly compensation record for dirigenti (directors)"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    dirigente_id: str
    month: int  # 1-12
    year: int
    amount_gross: float  # Compenso lordo
    amount_net: float  # Netto corrisposto (= lordo se sotto €5.000)
    deductions: float = 0.0  # Ritenute (se applicate)
    received: bool = False  # Flag pagamento ricevuto
    received_date: Optional[datetime] = None
    # Quietanza firmata
    receipt_signed: bool = False  # Quietanza firmata
    receipt_signature_base64: Optional[str] = None
    receipt_document_id: Optional[str] = None  # ID del documento PDF generato
    receipt_signed_date: Optional[datetime] = None
    # Soglie superate
    exceeded_5000: bool = False  # Flag superamento €5.000 annuali
    exceeded_5000_date: Optional[datetime] = None
    exceeded_5000_declaration_id: Optional[str] = None  # Documento dichiarazione
    exceeded_15000: bool = False  # Flag superamento €15.000 annuali
    exceeded_15000_date: Optional[datetime] = None
    exceeded_15000_declaration_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AtletaProCompensation(BaseModel):
    """Monthly compensation record for professional athletes (Atleti PRO)"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    atleta_id: str
    month: int  # 1-12
    year: int
    amount_gross: float  # Compenso lordo
    amount_net: float  # Netto corrisposto (= lordo se sotto €5.000)
    deductions: float = 0.0  # Ritenute (se applicate)
    received: bool = False  # Flag pagamento ricevuto
    received_date: Optional[datetime] = None
    # Quietanza firmata
    receipt_signed: bool = False  # Quietanza firmata
    receipt_signature_base64: Optional[str] = None
    receipt_document_id: Optional[str] = None  # ID del documento PDF generato
    receipt_signed_date: Optional[datetime] = None
    # Soglie superate
    exceeded_5000: bool = False  # Flag superamento €5.000 annuali
    exceeded_5000_date: Optional[datetime] = None
    exceeded_5000_declaration_id: Optional[str] = None  # Documento dichiarazione
    exceeded_15000: bool = False  # Flag superamento €15.000 annuali
    exceeded_15000_date: Optional[datetime] = None
    exceeded_15000_declaration_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)




class ThresholdDeclaration(BaseModel):
    """Dichiarazione di superamento soglia €5.000 o €15.000"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    coach_id: str
    year: int
    threshold_type: str  # "5000" or "15000"
    threshold_amount: float  # 5000.0 or 15000.0
    total_at_declaration: float  # Totale compensi al momento della dichiarazione
    signed: bool = False
    signature_base64: Optional[str] = None
    signed_date: Optional[datetime] = None
    document_id: Optional[str] = None  # PDF document ID
    pdf_path: Optional[str] = None
    email_sent: bool = False
    email_sent_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ThresholdDeclarationRequest(BaseModel):
    """Request to sign a threshold declaration"""
    year: int
    threshold_type: str  # "5000" or "15000"
    signature_base64: str

class AdminNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "coach_exceeded_5000", "coach_exceeded_15000", etc.
    title: str
    message: str
    related_user_id: Optional[str] = None
    related_user_name: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str
    full_name: str
    invite_code: Optional[str] = None  # Codice invito per unirsi a una società esistente
    # Optional coach fields
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    fiscal_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    coach_license_number: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: dict

class TrainingSession(BaseModel):
    day: str  # es: "Lunedì", "Martedì"
    time: str  # es: "18:00 / 20:00"
    venue: str  # es: "Palestra Liceo Alessi"

class MatchDay(BaseModel):
    day: str  # es: "Sabato"
    time: str  # es: "18:00"
    venue: str  # es: "Palestra Liceo Alessi"

class Match(BaseModel):
    """Gara/Partita del calendario"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    society_id: Optional[str] = None
    team_id: str  # ID della squadra
    team_name: Optional[str] = None  # Nome squadra (denormalizzato per comodità)
    match_number: Optional[str] = None  # Numero gara univoco (es: "2713")
    date: datetime  # Data e ora della gara
    opponent: str  # Avversario
    venue: Optional[str] = ""  # Luogo della gara (Palestra)
    address: Optional[str] = None  # Indirizzo palestra
    city: Optional[str] = None  # Città
    home_away: str = "home"  # "home" o "away"
    meeting_time: Optional[str] = None  # Orario ritrovo (es: "1 ora prima")
    notes: Optional[str] = None  # Note aggiuntive
    result: Optional[str] = None  # Risultato (es: "3-1")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class MatchCreate(BaseModel):
    team_id: str
    date: datetime
    opponent: str
    venue: Optional[str] = ""
    address: Optional[str] = None
    city: Optional[str] = None
    home_away: str = "home"
    meeting_time: Optional[str] = None
    notes: Optional[str] = None
    match_number: Optional[str] = None

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    society_id: Optional[str] = None  # ID della società (multi-tenancy)
    name: str
    description: Optional[str] = None
    team_photo: Optional[str] = None  # Foto squadra (base64)
    is_prima_squadra: bool = False  # Se true, esclude pagamenti
    created_by_admin_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Payment settings per team
    total_amount: float = 0.0
    # New flexible installments array (up to 12)
    # Each installment: {name: str, amount: float, due_date: datetime}
    installments: List[dict] = []  # [{name: "Quota iscrizione", amount: 150, due_date: "2024-09-15"}, ...]
    # Legacy fields for backward compatibility
    installment_1_amount: float = 0.0
    installment_2_amount: float = 0.0
    installment_2_due_date: Optional[datetime] = None
    installment_3_amount: float = 0.0
    installment_3_due_date: Optional[datetime] = None
    bank_info: Optional[str] = None
    paypal_email: Optional[str] = None
    # Training schedule - structured
    training_sessions: List[dict] = []  # List of TrainingSession
    match_day: Optional[dict] = None  # MatchDay
    rifinitura: Optional[dict] = None  # Rifinitura mattina gara
    # Legacy fields (keeping for backward compatibility)
    venue: Optional[str] = None
    training_schedule: Optional[str] = None
    # Championships
    championships: Optional[str] = None
    calendar_link: Optional[str] = None

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_prima_squadra: bool = False
    total_amount: float = 0.0
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
    # New flexible installments array
    installments: Optional[List[dict]] = None  # [{name: str, amount: float, due_date: str}, ...]
    # Legacy fields for backward compatibility
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

class AthleteStatus:
    PENDING = "pending"      # In attesa di approvazione admin
    TRIAL = "trial"          # In periodo di prova
    ACTIVE = "active"        # Attivo
    BLOCKED = "blocked"      # Bloccato

class Athlete(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    society_id: Optional[str] = None  # ID della società (multi-tenancy)
    parent_id: Optional[str] = None  # User ID of parent/guardian (None per atleti maggiorenni)
    # Codice univoco atleta (auto-generato: COGNOME3+NOME3-SQUADRA)
    athlete_code: Optional[str] = None  # Es: ROSMAR-U16
    # Tesseramento (gestito da Admin)
    federal_code: Optional[str] = None  # Codice Federale
    is_registered: bool = False  # Tesserato sì/no
    # Anagrafica base
    full_name: str  # Manteniamo per retrocompatibilità
    first_name: Optional[str] = None  # Nome
    last_name: Optional[str] = None  # Cognome
    date_of_birth: datetime
    birth_place: Optional[str] = None  # Luogo di nascita
    birth_province: Optional[str] = None  # Provincia di nascita
    is_minor: bool
    fiscal_code: Optional[str] = None  # Codice fiscale atleta
    email: Optional[str] = None  # Email di contatto
    phone_athlete: Optional[str] = None  # Telefono atleta
    phone_father: Optional[str] = None  # Telefono padre
    phone_mother: Optional[str] = None  # Telefono madre
    # Residenza
    address: Optional[str] = None  # Via, numero civico
    postal_code: Optional[str] = None  # CAP
    city: Optional[str] = None  # Città
    province: Optional[str] = None  # Provincia
    # Dati genitore per detrazione
    tax_payer_name: Optional[str] = None  # Nome cognome genitore detrazione (legacy)
    tax_payer_last_name: Optional[str] = None  # Cognome genitore detrazione
    tax_payer_first_name: Optional[str] = None  # Nome genitore detrazione
    tax_payer_fiscal_code: Optional[str] = None  # CF genitore detrazione
    # Squadra e stato
    team_id: str  # Squadra principale (per pagamenti)
    team_id_2: Optional[str] = None  # Seconda squadra (opzionale)
    qr_code: str  # Base64 encoded QR code
    registration_date: datetime = Field(default_factory=datetime.utcnow)
    trial_end_date: Optional[datetime] = None  # 7 days after registration (None per atleti maggiorenni)
    privacy_accepted: bool = False
    privacy_accepted_date: Optional[datetime] = None
    image_consent: bool = False
    status: str = "pending"  # pending, trial, active, blocked
    # Approvazione
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    # Sconto personalizzato dall'admin
    discount_amount: float = 0.0  # Sconto in euro da detrarre dall'ultima rata
    discount_reason: Optional[str] = None  # Motivo dello sconto
    discount_note: Optional[str] = None  # Nota sullo sconto
    # Password protezione dati sensibili (hash)
    data_password_hash: Optional[str] = None  # Password per accesso/modifica dati sensibili
    # Ritiro atleta
    is_withdrawn: bool = False  # Flag: atleta ritirato dalla squadra
    withdrawn_date: Optional[datetime] = None  # Data ritiro
    withdrawn_reason: Optional[str] = None  # Motivo ritiro
    # Dati tecnici (gestiti da Coach)
    athlete_photo: Optional[str] = None  # Foto atleta (base64)
    athlete_photo_artistic: Optional[str] = None  # Foto stile artistico (base64)
    athlete_role: Optional[str] = None  # Ruolo dell'atleta
    athlete_height: Optional[int] = None  # Altezza in cm
    athlete_weight: Optional[int] = None  # Peso in kg
    athlete_elevation: Optional[int] = None  # Elevazione in cm
    athlete_notes: Optional[str] = None  # Note sull'atleta
    athlete_characteristics: Optional[List[str]] = None  # Caratteristiche selezionate
    second_parent_email: Optional[str] = None  # Email del secondo genitore
    # Tipo atleta
    athlete_type: str = "quota"  # "quota" = paga quote, "compensated" = percepisce compenso
    parents_detached: bool = False  # Se true, genitori "sganciati" (atleta maggiorenne)
    parents_detached_date: Optional[datetime] = None  # Data sgancio genitori
    # Prime Squadre / Compensi fields
    is_compensated: bool = False  # Flag: atleta con compensi attivi
    monthly_compensation: float = 0.0  # Compenso mensile
    other_annual_compensation: float = 0.0  # Compensi già percepiti da altre ASD nell'anno
    contract_start_date: Optional[str] = None  # Data inizio contratto (ISO string)
    contract_end_date: Optional[str] = None  # Data fine contratto (ISO string)
    fees_waived: bool = False  # Se true, l'atleta non paga le quote
    # Dati bancari/economici (per atleti che percepiscono compenso)
    iban: Optional[str] = None  # IBAN per pagamento compensi
    bank_name: Optional[str] = None  # Nome banca
    bank_account_holder: Optional[str] = None  # Intestatario conto
    # Documenti identità (per atleti maggiorenni con compenso)
    document_type: Optional[str] = None  # Tipo documento (carta_identita, patente, passaporto)
    document_number: Optional[str] = None  # Numero documento
    document_expiry: Optional[str] = None  # Scadenza documento (ISO string)
    document_front: Optional[str] = None  # Fronte documento (base64)
    document_back: Optional[str] = None  # Retro documento (base64)

class AthleteCreate(BaseModel):
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: str
    birth_place: Optional[str] = None
    birth_province: Optional[str] = None
    fiscal_code: str
    email: Optional[str] = None
    phone_athlete: Optional[str] = None
    phone_father: Optional[str] = None
    phone_mother: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    tax_payer_name: Optional[str] = None
    tax_payer_last_name: Optional[str] = None
    tax_payer_first_name: Optional[str] = None
    tax_payer_fiscal_code: Optional[str] = None
    team_id: str
    team_id_2: Optional[str] = None  # Seconda squadra (opzionale)
    is_trial: bool = True  # Default: periodo di prova
    privacy_accepted: bool = False
    data_password: Optional[str] = None  # Password protezione dati sensibili
    
class AthleteUpdate(BaseModel):
    # Tesseramento (gestito da Admin)
    federal_code: Optional[str] = None
    is_registered: Optional[bool] = None
    # Anagrafica
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    birth_place: Optional[str] = None
    birth_province: Optional[str] = None
    fiscal_code: Optional[str] = None
    email: Optional[str] = None
    phone_athlete: Optional[str] = None
    phone_father: Optional[str] = None
    phone_mother: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    tax_payer_name: Optional[str] = None
    tax_payer_last_name: Optional[str] = None
    tax_payer_first_name: Optional[str] = None
    tax_payer_fiscal_code: Optional[str] = None
    privacy_accepted: Optional[bool] = None
    privacy_accepted_date: Optional[str] = None
    image_consent: Optional[bool] = None
    team_id: Optional[str] = None
    team_id_2: Optional[str] = None  # Seconda squadra (opzionale)
    discount_amount: Optional[float] = None
    discount_reason: Optional[str] = None
    discount_note: Optional[str] = None
    status: Optional[str] = None  # trial, active, blocked
    data_password: Optional[str] = None  # Nuova password protezione dati
    is_withdrawn: Optional[bool] = None  # Ritiro atleta
    withdrawn_reason: Optional[str] = None  # Motivo ritiro
    # Dati tecnici
    athlete_photo: Optional[str] = None
    athlete_photo_artistic: Optional[str] = None
    athlete_role: Optional[str] = None
    athlete_height: Optional[int] = None
    athlete_weight: Optional[int] = None
    athlete_elevation: Optional[int] = None
    athlete_notes: Optional[str] = None
    athlete_characteristics: Optional[List[str]] = None
    second_parent_email: Optional[str] = None  # Email del secondo genitore
    athlete_code: Optional[str] = None  # Codice atleta per import pagamenti

class Certificate(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    athlete_id: str
    pdf_data: str  # Base64 encoded PDF
    issue_date: datetime
    validity_months: int
    expiry_date: datetime
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class CertificateCreate(BaseModel):
    athlete_id: str
    issue_date: str
    validity_months: int

class CertificateUploadBase64(BaseModel):
    athlete_id: str
    issue_date: str
    validity_months: int
    pdf_base64: str

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    athlete_id: str
    installment_number: Optional[int] = None  # 1, 2, or 3 (null for manual payments)
    description: Optional[str] = None  # Descrizione pagamento
    amount: float
    due_date: Optional[datetime] = None
    paid: bool = False
    paid_date: Optional[datetime] = None
    payment_method: Optional[str] = None  # 'Bonifico', 'POS', 'Contanti', 'Assegno'
    is_cash: bool = False  # True se pagamento in contanti
    notes: Optional[str] = None  # Note aggiuntive
    receipt_number: Optional[str] = None  # Numero ricevuta fiscale (es: RIC-2025-0001)
    registration_date: Optional[datetime] = None  # Data registrazione nel sistema
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None  # Admin ID who created the payment

class PaymentCreate(BaseModel):
    athlete_id: str
    amount: float
    paid_date: str  # formato gg/mm/aaaa
    is_cash: bool = False
    notes: Optional[str] = None

class PaymentSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    season: str  # e.g., "2024-2025"
    installment_1_amount: float
    installment_2_amount: float
    installment_2_due_date: datetime
    installment_3_amount: float
    installment_3_due_date: datetime
    bank_info: str  # IBAN and bank details
    paypal_email: str

class PaymentSettingsCreate(BaseModel):
    season: str
    installment_1_amount: float
    installment_2_amount: float
    installment_2_due_date: str
    installment_3_amount: float
    installment_3_due_date: str
    bank_info: str
    paypal_email: str

# ==================== ARCHIVIO STORICO STAGIONI ====================

class SeasonArchive(BaseModel):
    """Archivio storico di una stagione sportiva (01/07 - 30/06)"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    season_name: str  # e.g., "2024-2025"
    start_date: datetime  # 01/07/YYYY
    end_date: datetime  # 30/06/YYYY+1
    is_current: bool = False  # True se è la stagione corrente
    
    # Snapshot data at end of season
    teams: List[dict] = []  # Team info with athletes and championships
    coaches: List[dict] = []  # Coach info
    total_athletes: int = 0
    total_teams: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    archived_at: Optional[datetime] = None
    archived_by: Optional[str] = None

class SeasonTeamArchive(BaseModel):
    """Snapshot of a team for season archive"""
    team_id: str
    team_name: str
    championships: List[str] = []  # List of championship names
    coach_names: List[str] = []  # Coach names assigned to team
    athlete_names: List[str] = []  # Athlete names in team
    total_athletes: int = 0

class Championship(BaseModel):
    """Championship/Tournament a team participates in"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    name: str  # e.g., "Serie C Femminile"
    season: str  # e.g., "2024-2025"
    team_id: str
    federation: Optional[str] = None  # e.g., "FIPAV"
    category: Optional[str] = None  # e.g., "Under 18"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChampionshipCreate(BaseModel):
    name: str
    team_id: str
    federation: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None

class PaymentUpdate(BaseModel):
    paid: bool
    payment_method: Optional[str] = None

class AssignmentRequest(BaseModel):
    ids: List[str] = []

class Attendance(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    athlete_id: str
    coach_id: str
    check_in_time: datetime = Field(default_factory=datetime.utcnow)
    status: str  # 'allowed' or 'blocked'
    block_reason: Optional[str] = None

class AttendanceCreate(BaseModel):
    qr_code: str
    force: bool = False  # Allow coach to force registration for multi-team training

# ==================== HELPER FUNCTIONS ====================

def clean_mongo_doc(doc):
    """Remove _id from MongoDB document and convert datetime fields for JSON serialization"""
    if doc:
        doc.pop('_id', None)
        # Convert datetime fields to ISO string
        for key, value in list(doc.items()):
            if isinstance(value, datetime):
                doc[key] = value.strftime("%Y-%m-%d")
    return doc

def clean_mongo_docs(docs):
    """Remove _id from list of MongoDB documents"""
    return [clean_mongo_doc(doc) for doc in docs]

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        role = payload.get("role")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "id": user_id, 
            "role": role, 
            "email": user["email"], 
            "full_name": user["full_name"],
            "assigned_teams": user.get("assigned_teams", []),
            "status": user.get("status", "pending"),
            "society_id": user.get("society_id")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logging.error(f"JWT decode error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

def generate_qr_code(athlete_id: str) -> str:
    """Generate QR code and return as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(athlete_id)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def generate_athlete_code(last_name: str, first_name: str, team_name: str) -> str:
    """Generate unique athlete code: COGNOME(3)+NOME(3)-SQUADRA
    Es: ROSMAR-U16, BIAFED-SD"""
    import re
    # Clean and get first 3 chars of last name and first name
    ln = re.sub(r'[^A-Za-z]', '', (last_name or '').upper())[:3]
    fn = re.sub(r'[^A-Za-z]', '', (first_name or '').upper())[:3]
    
    # Clean team name: keep only alphanumeric, remove spaces
    tn = re.sub(r'[^A-Za-z0-9]', '', (team_name or '').upper())
    # Shorten common patterns
    tn = tn.replace('MINIVOLLEY', 'MV').replace('STARTER', 'ST').replace('UNDER', 'U').replace('SERIE', 'S')
    # Max 5 chars for team
    tn = tn[:5] if len(tn) > 5 else tn
    
    return f"{ln}{fn}-{tn}" if tn else f"{ln}{fn}"

async def generate_unique_athlete_code(last_name: str, first_name: str, team_name: str, society_id: str, exclude_athlete_id: str = None) -> str:
    """Generate unique athlete code, adding suffix if duplicate exists.
    Es: ROSMAR-U16, ROSMAR-U16-2, ROSMAR-U16-3"""
    base_code = generate_athlete_code(last_name, first_name, team_name)
    
    # Check if code already exists
    query = {"athlete_code": base_code, "society_id": society_id}
    if exclude_athlete_id:
        query["id"] = {"$ne": exclude_athlete_id}
    
    existing = await db.athletes.find_one(query)
    
    if not existing:
        return base_code
    
    # Find next available suffix
    suffix = 2
    while True:
        new_code = f"{base_code}-{suffix}"
        query["athlete_code"] = new_code
        existing = await db.athletes.find_one(query)
        if not existing:
            return new_code
        suffix += 1
        if suffix > 99:  # Safety limit
            break
    
    return f"{base_code}-{suffix}"

async def update_athlete_code(athlete_id: str):
    """Update athlete code based on current team"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        return None
    
    team = await db.teams.find_one({"id": athlete.get("team_id")})
    team_name = team.get("name", "") if team else ""
    
    code = await generate_unique_athlete_code(
        athlete.get("last_name", ""),
        athlete.get("first_name", ""),
        team_name,
        athlete.get("society_id", ""),
        athlete_id  # Exclude current athlete from duplicate check
    )
    
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {"athlete_code": code}}
    )
    return code

async def check_athlete_status(athlete_id: str):
    """Check if athlete can attend (certificate valid, payments up to date, privacy accepted)"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        return {"allowed": False, "reason": "Atleta non trovato", "warning": None}
    
    # Check if athlete is withdrawn
    if athlete.get("is_withdrawn", False):
        return {"allowed": False, "reason": "⛔ ATLETA RITIRATO - Non più iscritto alla squadra", "warning": None}
    
    # Check if trial period ended and privacy not accepted
    if datetime.utcnow() > athlete["trial_end_date"] and not athlete.get("privacy_accepted"):
        return {"allowed": False, "reason": "Privacy non accettata - periodo di prova terminato", "warning": None}
    
    # Check certificate
    certificate = await db.certificates.find_one({"athlete_id": athlete_id})
    if not certificate:
        return {"allowed": False, "reason": "Certificato medico mancante", "warning": None}
    
    # Certificate expired - BLOCK
    if datetime.utcnow() > certificate["expiry_date"]:
        return {"allowed": False, "reason": "⛔ CERTIFICATO MEDICO SCADUTO - Atleta NON ammesso all'allenamento", "warning": None}
    
    # Check if certificate is expiring soon (within 30 days)
    days_to_expiry = (certificate["expiry_date"] - datetime.utcnow()).days
    cert_warning = None
    if days_to_expiry <= 30:
        cert_warning = f"⚠️ ATTENZIONE: CERTIFICATO MEDICO IN SCADENZA tra {days_to_expiry} giorni! Provvedere al rinnovo prima della scadenza per evitare di non essere ammessi agli allenamenti."
    
    # Check payments - upcoming due (within 7 days)
    payment_warning = None
    upcoming_payments = await db.payments.find({
        "athlete_id": athlete_id,
        "paid": False,
        "due_date": {
            "$gt": datetime.utcnow(),
            "$lt": datetime.utcnow() + timedelta(days=7)
        }
    }).to_list(100)
    
    if upcoming_payments:
        installments = [p["installment_number"] for p in upcoming_payments]
        amounts = sum(p["amount"] for p in upcoming_payments)
        payment_warning = f"💰 PROMEMORIA: Pagamento rata {', '.join(map(str, installments))} (€{amounts:.2f}) in scadenza entro 7 giorni."
    
    # Check payments overdue
    unpaid_payments = await db.payments.find({
        "athlete_id": athlete_id,
        "paid": False,
        "due_date": {"$lt": datetime.utcnow()}
    }).to_list(100)
    
    if unpaid_payments:
        installments = [p["installment_number"] for p in unpaid_payments]
        amounts = sum(p["amount"] for p in unpaid_payments)
        payment_warning = f"💰 ATTENZIONE: Pagamento rata {', '.join(map(str, installments))} (€{amounts:.2f}) SCADUTO! Ricordare all'atleta."
    
    # Combine warnings
    warnings = []
    if cert_warning:
        warnings.append(cert_warning)
    if payment_warning:
        warnings.append(payment_warning)
    
    combined_warning = "\n\n".join(warnings) if warnings else None
    
    return {"allowed": True, "reason": combined_warning, "warning": combined_warning}

# ==================== SOCIETY MANAGEMENT ENDPOINTS (Multi-tenancy) ====================

@api_router.post("/societies")
async def create_society(society_data: SocietyCreate, current_user = Depends(get_current_user)):
    """Create a new society - only for admins without a society or super-admins"""
    # Check if user already has a society
    if current_user.get("society_id"):
        raise HTTPException(status_code=400, detail="Sei già associato a una società")
    
    # Create society with unique invite code
    invite_code = generate_invite_code()
    # Make sure code is unique
    while await db.societies.find_one({"invite_code": invite_code}):
        invite_code = generate_invite_code()
    
    society = Society(
        name=society_data.name,
        email=society_data.email,
        phone=society_data.phone,
        invite_code=invite_code,
        owner_id=current_user["id"]
    )
    
    await db.societies.insert_one(society.dict())
    
    # Update current user with society_id
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"society_id": society.id}}
    )
    
    return {
        "message": "Società creata con successo",
        "society": {
            "id": society.id,
            "name": society.name,
            "invite_code": society.invite_code
        }
    }

@api_router.get("/societies/my")
async def get_my_society(current_user = Depends(get_current_user)):
    """Get current user's society details"""
    if not current_user.get("society_id"):
        raise HTTPException(status_code=404, detail="Non sei associato a nessuna società")
    
    society = await db.societies.find_one({"id": current_user["society_id"]})
    if not society:
        raise HTTPException(status_code=404, detail="Società non trovata")
    
    clean_mongo_doc(society)
    return society

@api_router.get("/societies/invite-code")
async def get_invite_code(current_user = Depends(get_current_user)):
    """Get society invite code - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere il codice invito")
    
    if not current_user.get("society_id"):
        raise HTTPException(status_code=404, detail="Non sei associato a nessuna società")
    
    society = await db.societies.find_one({"id": current_user["society_id"]})
    if not society:
        raise HTTPException(status_code=404, detail="Società non trovata")
    
    return {
        "invite_code": society["invite_code"],
        "society_name": society["name"]
    }

@api_router.post("/societies/regenerate-invite-code")
async def regenerate_invite_code(current_user = Depends(get_current_user)):
    """Regenerate society invite code - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può rigenerare il codice invito")
    
    if not current_user.get("society_id"):
        raise HTTPException(status_code=404, detail="Non sei associato a nessuna società")
    
    # Generate new unique code
    new_code = generate_invite_code()
    while await db.societies.find_one({"invite_code": new_code}):
        new_code = generate_invite_code()
    
    await db.societies.update_one(
        {"id": current_user["society_id"]},
        {"$set": {"invite_code": new_code}}
    )
    
    return {
        "message": "Codice invito rigenerato",
        "invite_code": new_code
    }

@api_router.patch("/societies/my")
async def update_my_society(update_data: dict, current_user = Depends(get_current_user)):
    """Update society details - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare la società")
    
    if not current_user.get("society_id"):
        raise HTTPException(status_code=404, detail="Non sei associato a nessuna società")
    
    # Allowed fields to update
    allowed_fields = ["name", "logo", "address", "city", "postal_code", "province", 
                      "phone", "email", "website", "fiscal_code"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if update_dict:
        await db.societies.update_one(
            {"id": current_user["society_id"]},
            {"$set": update_dict}
        )
    
    return {"message": "Società aggiornata"}

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Find society by invite code
    society_id = None
    if user_data.invite_code:
        society = await db.societies.find_one({"invite_code": user_data.invite_code.upper()})
        if not society:
            raise HTTPException(status_code=400, detail="Codice invito non valido")
        if not society.get("is_active", True):
            raise HTTPException(status_code=400, detail="Questa società non è più attiva")
        society_id = society["id"]
    
    # Parents are auto-approved, all other users need Admin approval
    if user_data.role == UserRole.PARENT:
        initial_status = UserStatus.APPROVED
    else:
        initial_status = UserStatus.PENDING
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name,
        status=initial_status,
        society_id=society_id,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone
    )
    
    await db.users.insert_one(user.dict())
    
    # Se l'utente è un genitore, collega automaticamente gli atleti dove è secondo genitore
    if user.role == UserRole.PARENT and society_id:
        # Cerca atleti nella stessa società dove l'email è registrata come second_parent_email
        athletes_to_link = await db.athletes.find({
            "society_id": society_id,
            "second_parent_email": user.email.lower()
        }).to_list(100)
        
        # Per ogni atleta trovato, aggiungi l'ID del nuovo genitore come second_parent_id
        for athlete in athletes_to_link:
            await db.athletes.update_one(
                {"id": athlete["id"]},
                {"$set": {"second_parent_id": user.id}}
            )
    
    token = create_token(user.id, user.role)
    
    return TokenResponse(
        token=token,
        user={
            "id": user.id, 
            "email": user.email, 
            "role": user.role, 
            "full_name": user.full_name,
            "status": user.status,
            "society_id": user.society_id
        }
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    
    # Check if user is approved (except parents who are auto-approved)
    user_status = user.get("status", UserStatus.APPROVED)  # Default for old users
    if user_status == UserStatus.PENDING:
        raise HTTPException(status_code=403, detail="Account in attesa di approvazione dall'amministratore")
    if user_status == UserStatus.REJECTED:
        raise HTTPException(status_code=403, detail="Account non approvato")
    if user_status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Account sospeso")
    
    token = create_token(user["id"], user["role"])
    
    return TokenResponse(
        token=token,
        user={
            "id": user["id"], 
            "email": user["email"], 
            "role": user["role"], 
            "full_name": user["full_name"],
            "status": user_status
        }
    )

@api_router.get("/auth/me")
async def get_me(current_user = Depends(get_current_user)):
    """Get full user profile"""
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    clean_mongo_doc(user)
    # Remove sensitive fields
    user.pop("password_hash", None)
    user.pop("hashed_password", None)
    return user

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    birth_province: Optional[str] = None  # Sigla provincia di nascita
    fiscal_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    coach_license_number: Optional[str] = None
    # Documento di identità
    identity_document_type: Optional[str] = None  # Carta di identità, Patente, Passaporto
    identity_document_number: Optional[str] = None  # Numero del documento
    identity_document_expiry: Optional[str] = None  # Scadenza documento (ISO string)
    # Compensation fields
    compensation_accepted: Optional[bool] = None
    compensation_history: Optional[dict] = None
    over_5000_limit: Optional[dict] = None
    # Profile photo
    profile_photo: Optional[str] = None
    profile_photo_artistic: Optional[str] = None

@api_router.patch("/auth/me")
async def update_me(data: UserProfileUpdate, current_user = Depends(get_current_user)):
    """Update user profile"""
    update_dict = {}
    
    if data.first_name is not None:
        update_dict["first_name"] = data.first_name
    if data.last_name is not None:
        update_dict["last_name"] = data.last_name
    if data.full_name is not None:
        update_dict["full_name"] = data.full_name
    if data.date_of_birth is not None:
        try:
            update_dict["date_of_birth"] = datetime.fromisoformat(data.date_of_birth.replace('Z', '+00:00'))
        except:
            pass
    if data.place_of_birth is not None:
        update_dict["place_of_birth"] = data.place_of_birth
    if data.birth_province is not None:
        update_dict["birth_province"] = data.birth_province
    if data.fiscal_code is not None:
        update_dict["fiscal_code"] = data.fiscal_code
    if data.address is not None:
        update_dict["address"] = data.address
    if data.city is not None:
        update_dict["city"] = data.city
    if data.postal_code is not None:
        update_dict["postal_code"] = data.postal_code
    if data.province is not None:
        update_dict["province"] = data.province
    if data.phone is not None:
        update_dict["phone"] = data.phone
    if data.coach_license_number is not None:
        update_dict["coach_license_number"] = data.coach_license_number
    # Documento di identità
    if data.identity_document_type is not None:
        update_dict["identity_document_type"] = data.identity_document_type
    if data.identity_document_number is not None:
        update_dict["identity_document_number"] = data.identity_document_number
    if data.identity_document_expiry is not None:
        try:
            update_dict["identity_document_expiry"] = datetime.fromisoformat(data.identity_document_expiry.replace('Z', '+00:00'))
        except:
            pass
    # Compensation fields
    if data.compensation_accepted is not None:
        update_dict["compensation_accepted"] = data.compensation_accepted
        if data.compensation_accepted:
            update_dict["compensation_accepted_date"] = datetime.utcnow()
    if data.compensation_history is not None:
        update_dict["compensation_history"] = data.compensation_history
    if data.over_5000_limit is not None:
        # Check if user is declaring they exceeded limits
        old_limit = current_user.get("over_5000_limit", {})
        new_limit = data.over_5000_limit.copy() if isinstance(data.over_5000_limit, dict) else {}
        user_role = current_user.get("role", "")
        user_name = current_user.get('full_name', 'Sconosciuto')
        
        # Add timestamp when declaring exceeded limits
        now = datetime.utcnow()
        if new_limit.get("exceeded_5000") and not old_limit.get("exceeded_5000"):
            new_limit["exceeded_5000_date"] = now.isoformat()
        elif not new_limit.get("exceeded_5000"):
            new_limit["exceeded_5000_date"] = None
        else:
            # Keep existing date if already set
            new_limit["exceeded_5000_date"] = old_limit.get("exceeded_5000_date")
            
        if new_limit.get("exceeded_15000") and not old_limit.get("exceeded_15000"):
            new_limit["exceeded_15000_date"] = now.isoformat()
        elif not new_limit.get("exceeded_15000"):
            new_limit["exceeded_15000_date"] = None
        else:
            # Keep existing date if already set
            new_limit["exceeded_15000_date"] = old_limit.get("exceeded_15000_date")
        
        update_dict["over_5000_limit"] = new_limit
        
        # Determine user type label for notifications
        if user_role == "coach":
            user_type = "Coach"
            notif_type_5k = "coach_exceeded_5000"
            notif_type_15k = "coach_exceeded_15000"
        elif user_role in ["admin", "viewer"]:
            user_type = "Dirigente"
            notif_type_5k = "dirigente_exceeded_5000"
            notif_type_15k = "dirigente_exceeded_15000"
        else:
            user_type = "Utente"
            notif_type_5k = "user_exceeded_5000"
            notif_type_15k = "user_exceeded_15000"
        
        # Notify admin if newly exceeded €5.000
        if new_limit.get("exceeded_5000") and not old_limit.get("exceeded_5000"):
            notification = AdminNotification(
                type=notif_type_5k,
                title=f"⚠️ {user_type} ha superato €5.000",
                message=f"Il {user_type.lower()} {user_name} ha dichiarato di aver superato il limite di €5.000 annuali di compensi sportivi dilettantistici. Data dichiarazione: {now.strftime('%d/%m/%Y %H:%M')}",
                related_user_id=current_user["id"],
                related_user_name=user_name
            )
            await db.admin_notifications.insert_one(notification.dict())
        
        # Notify admin if newly exceeded €15.000
        if new_limit.get("exceeded_15000") and not old_limit.get("exceeded_15000"):
            notification = AdminNotification(
                type=notif_type_15k,
                title=f"🚨 URGENTE: {user_type} ha superato €15.000",
                message=f"ATTENZIONE: Il {user_type.lower()} {user_name} ha dichiarato di aver superato il limite di €15.000 annuali. Data dichiarazione: {now.strftime('%d/%m/%Y %H:%M')}. Questo comporta obblighi fiscali e contributivi aggiuntivi!",
                related_user_id=current_user["id"],
                related_user_name=user_name
            )
            await db.admin_notifications.insert_one(notification.dict())
    
    if update_dict:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_dict}
        )
    
    return {"message": "Profilo aggiornato"}

# ==================== PASSWORD RESET ENDPOINTS ====================

# Email service - uses Brevo with SendGrid fallback
from email_service import send_transactional_email, send_email_with_pdf

SENDER_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "info@pallavoloperugia.it")

def generate_reset_token():
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)

class ImageTransformRequest(BaseModel):
    image_base64: str

@api_router.post("/auth/me/transform-photo")
async def transform_user_photo(data: ImageTransformRequest, current_user = Depends(get_current_user)):
    """Transform user profile photo to artistic style using AI - for coach and dirigente"""
    if current_user["role"] not in [UserRole.COACH, UserRole.VIEWER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Funzionalità disponibile solo per coach e dirigenti")
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Chiave API non configurata")
        
        if HAS_OPENAI_CLIENT:
            client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://llm.integrations.emergent.sh/v1"
            )
            
            image_bytes = base64.b64decode(data.image_base64)
            
            response = await client.images.edit(
                model="gpt-image-1",
                image=image_bytes,
                prompt="Transform into a BLACK AND WHITE PENCIL SKETCH drawing. Remove ALL colors. Only use black, white and gray tones. Add visible pencil strokes and cross-hatching. Make it look hand-drawn on white paper.",
                n=1,
                size="1024x1024"
            )
            
            if response.data and len(response.data) > 0:
                result = response.data[0]
                if hasattr(result, 'b64_json') and result.b64_json:
                    artistic_base64 = result.b64_json
                elif hasattr(result, 'url') and result.url:
                    import httpx
                    async with httpx.AsyncClient() as http_client:
                        img_response = await http_client.get(result.url)
                        artistic_base64 = base64.b64encode(img_response.content).decode('utf-8')
                else:
                    raise HTTPException(status_code=500, detail="Formato risposta non valido")
                
                # Save to user profile
                await db.users.update_one(
                    {"id": current_user["id"]},
                    {"$set": {
                        "profile_photo": data.image_base64,
                        "profile_photo_artistic": artistic_base64
                    }}
                )
                
                return {
                    "success": True,
                    "artistic_photo": artistic_base64
                }
            else:
                raise HTTPException(status_code=500, detail="Nessuna immagine generata")
        else:
            # Fallback
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {
                    "profile_photo": data.image_base64,
                    "profile_photo_artistic": data.image_base64
                }}
            )
            return {
                "success": True,
                "artistic_photo": data.image_base64,
                "note": "Trasformazione non disponibile"
            }
            
    except Exception as e:
        logging.error(f"Error transforming user photo: {str(e)}")
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {
                "profile_photo": data.image_base64,
                "profile_photo_artistic": data.image_base64
            }}
        )
        return {
            "success": True,
            "artistic_photo": data.image_base64,
            "note": f"Errore: {str(e)}"
        }

async def send_password_reset_email(to_email: str, reset_token: str, user_name: str):
    """Send password reset email via Brevo/SendGrid"""
    # Get society name for branding
    settings = await db.settings.find_one({"type": "society"})
    society_name = settings.get("name", "Gestione Società") if settings else "Gestione Società"
    
    # Create reset code (first 8 chars of token for easier communication)
    reset_code = reset_token[:8].upper()
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }}
            .code {{ background-color: #007AFF; color: white; font-size: 28px; font-weight: bold; 
                     padding: 15px 30px; text-align: center; border-radius: 8px; margin: 20px 0;
                     letter-spacing: 4px; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            .warning {{ color: #ff6b6b; font-size: 13px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{society_name}</h1>
            </div>
            <div class="content">
                <p>Ciao <strong>{user_name}</strong>,</p>
                <p>Hai richiesto il reset della password. Usa questo codice per impostare una nuova password:</p>
                
                <div class="code">{reset_code}</div>
                
                <p>Inserisci questo codice nella pagina di reset password dell'app.</p>
                
                <p class="warning">
                    ⚠️ Il codice scade tra <strong>1 ora</strong>.<br>
                    Se non hai richiesto tu il reset della password, ignora questa email.
                </p>
            </div>
            <div class="footer">
                <p>Questa è un'email automatica, non rispondere.</p>
                <p>© {datetime.now().year} {society_name}</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        result = await send_transactional_email(
            to_email=to_email,
            subject=f"🔐 Reset Password - {society_name}",
            html_content=html_content,
            to_name=user_name
        )
        if result.get("success"):
            logging.info(f"Password reset email sent to {to_email} via {result.get('provider', 'unknown')}")
            return True
        else:
            logging.error(f"Failed to send password reset email: {result.get('error')}")
            raise HTTPException(status_code=500, detail=f"Errore invio email: {result.get('error')}")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Email service error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore invio email: {str(e)}")

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Request password reset - sends email with reset code"""
    # Find user by email
    user = await db.users.find_one({"email": data.email.lower()})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "Se l'email esiste, riceverai un codice di reset"}
    
    # Generate reset token
    reset_token = generate_reset_token()
    reset_expires = datetime.utcnow() + timedelta(hours=1)
    
    # Store token in database
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_reset_token": reset_token,
            "password_reset_expires": reset_expires
        }}
    )
    
    # Send email
    try:
        await send_password_reset_email(
            to_email=user["email"],
            reset_token=reset_token,
            user_name=user.get("full_name", "Utente")
        )
    except Exception as e:
        logging.error(f"Failed to send reset email: {str(e)}")
        raise HTTPException(status_code=500, detail="Errore nell'invio dell'email. Riprova più tardi.")
    
    return {"message": "Se l'email esiste, riceverai un codice di reset"}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password using the code received via email"""
    # Find user by email
    user = await db.users.find_one({"email": data.email.lower()})
    
    if not user:
        raise HTTPException(status_code=400, detail="Email non trovata")
    
    # Check if user has a valid reset token
    stored_token = user.get("password_reset_token")
    token_expires = user.get("password_reset_expires")
    
    if not stored_token or not token_expires:
        raise HTTPException(status_code=400, detail="Nessuna richiesta di reset trovata. Richiedi un nuovo codice.")
    
    # Check if token expired
    if datetime.utcnow() > token_expires:
        # Clear expired token
        await db.users.update_one(
            {"id": user["id"]},
            {"$unset": {"password_reset_token": "", "password_reset_expires": ""}}
        )
        raise HTTPException(status_code=400, detail="Codice scaduto. Richiedi un nuovo codice.")
    
    # Verify reset code (first 8 chars of token, case insensitive)
    expected_code = stored_token[:8].upper()
    provided_code = data.reset_code.strip().upper()
    
    if provided_code != expected_code:
        raise HTTPException(status_code=400, detail="Codice non valido")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La password deve avere almeno 6 caratteri")
    
    # Update password and clear reset token
    new_password_hash = hash_password(data.new_password)
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"password_hash": new_password_hash},
            "$unset": {"password_reset_token": "", "password_reset_expires": ""}
        }
    )
    
    return {"message": "Password aggiornata con successo! Ora puoi accedere con la nuova password."}

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, current_user = Depends(get_current_user)):
    """Change password for logged-in user"""
    # Get full user data
    user = await db.users.find_one({"id": current_user["id"]})
    
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Verify current password
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password attuale non corretta")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nuova password deve avere almeno 6 caratteri")
    
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="La nuova password deve essere diversa da quella attuale")
    
    # Update password
    new_password_hash = hash_password(data.new_password)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Password cambiata con successo!"}

# ==================== SOCIETY SETTINGS ENDPOINTS ====================

class SocietySettingsUpdate(BaseModel):
    name: Optional[str] = None
    logo: Optional[str] = None  # Base64 encoded image
    logo_size: Optional[int] = None  # Logo size in pixels
    athlete_roles: Optional[List[str]] = None  # Custom roles for athletes
    athlete_characteristics: Optional[List[str]] = None  # Custom characteristics for athletes
    dirigente_qualifications: Optional[List[str]] = None  # Custom qualifications for dirigenti
    # Fiscal receipt fields
    ragione_sociale: Optional[str] = None  # Company legal name
    sport_praticato: Optional[str] = None  # Sport type (es: Pallavolo, Calcio)
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    fiscal_code: Optional[str] = None  # Cod. Fiscale
    phone: Optional[str] = None
    phone2: Optional[str] = None
    president_name: Optional[str] = None
    stamp_signature: Optional[str] = None  # Base64 encoded image of stamp and signature
    email: Optional[str] = None  # Society email for notifications
    pec: Optional[str] = None  # PEC (Posta Elettronica Certificata)
    pro_enabled: Optional[bool] = None  # Flag per attivare il modulo Prime Squadre

@api_router.get("/settings/society")
async def get_society_settings():
    """Get society settings (public endpoint - no auth required for logo display)"""
    settings = await db.settings.find_one({"type": "society"})
    if not settings:
        return {
            "name": "Società Sportiva", 
            "logo": None, 
            "logo_size": 50, 
            "athlete_roles": [], 
            "athlete_characteristics": [], 
            "dirigente_qualifications": [],
            "ragione_sociale": None,
            "sport_praticato": None,
            "address": None,
            "postal_code": None,
            "city": None,
            "province": None,
            "fiscal_code": None,
            "phone": None,
            "phone2": None,
            "president_name": None,
            "stamp_signature": None
        }
    return {
        "name": settings.get("name", "Società Sportiva"),
        "logo": settings.get("logo"),
        "logo_size": settings.get("logo_size", 50),
        "athlete_roles": settings.get("athlete_roles", []),
        "athlete_characteristics": settings.get("athlete_characteristics", []),
        "dirigente_qualifications": settings.get("dirigente_qualifications", []),
        "ragione_sociale": settings.get("ragione_sociale"),
        "sport_praticato": settings.get("sport_praticato"),
        "address": settings.get("address"),
        "postal_code": settings.get("postal_code"),
        "city": settings.get("city"),
        "province": settings.get("province"),
        "fiscal_code": settings.get("fiscal_code"),
        "phone": settings.get("phone"),
        "phone2": settings.get("phone2"),
        "president_name": settings.get("president_name"),
        "stamp_signature": settings.get("stamp_signature"),
        "email": settings.get("email"),
        "pec": settings.get("pec"),
        "pro_enabled": settings.get("pro_enabled", False)
    }

@api_router.patch("/settings/society")
async def update_society_settings(data: SocietySettingsUpdate, current_user = Depends(get_current_user)):
    """Update society settings (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare le impostazioni")
    
    update_dict = {}
    if data.name is not None:
        update_dict["name"] = data.name
    if data.logo is not None:
        update_dict["logo"] = data.logo
    if data.logo_size is not None:
        update_dict["logo_size"] = data.logo_size
    if data.athlete_roles is not None:
        update_dict["athlete_roles"] = data.athlete_roles
    if data.athlete_characteristics is not None:
        update_dict["athlete_characteristics"] = data.athlete_characteristics
    if data.dirigente_qualifications is not None:
        update_dict["dirigente_qualifications"] = data.dirigente_qualifications
    # Fiscal receipt fields
    if data.ragione_sociale is not None:
        update_dict["ragione_sociale"] = data.ragione_sociale
    if data.sport_praticato is not None:
        update_dict["sport_praticato"] = data.sport_praticato
    if data.address is not None:
        update_dict["address"] = data.address
    if data.postal_code is not None:
        update_dict["postal_code"] = data.postal_code
    if data.city is not None:
        update_dict["city"] = data.city
    if data.province is not None:
        update_dict["province"] = data.province
    if data.fiscal_code is not None:
        update_dict["fiscal_code"] = data.fiscal_code
    if data.phone is not None:
        update_dict["phone"] = data.phone
    if data.phone2 is not None:
        update_dict["phone2"] = data.phone2
    if data.president_name is not None:
        update_dict["president_name"] = data.president_name
    if data.stamp_signature is not None:
        update_dict["stamp_signature"] = data.stamp_signature
    if data.email is not None:
        update_dict["email"] = data.email
    if data.pec is not None:
        update_dict["pec"] = data.pec
    if data.pro_enabled is not None:
        update_dict["pro_enabled"] = data.pro_enabled
    
    if update_dict:
        await db.settings.update_one(
            {"type": "society"},
            {"$set": update_dict},
            upsert=True
        )
    
    return {"message": "Impostazioni aggiornate con successo"}

# ==================== ADMIN NOTIFICATIONS ====================

@api_router.get("/admin/notifications")
async def get_admin_notifications(current_user = Depends(get_current_user)):
    """Get all admin notifications"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le notifiche")
    
    notifications = await db.admin_notifications.find({}).sort("created_at", -1).to_list(100)
    for n in notifications:
        clean_mongo_doc(n)
    return notifications

@api_router.get("/admin/notifications/unread-count")
async def get_unread_notifications_count(current_user = Depends(get_current_user)):
    """Get count of unread notifications"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le notifiche")
    
    count = await db.admin_notifications.count_documents({"read": False})
    return {"count": count}

@api_router.patch("/admin/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user = Depends(get_current_user)):
    """Mark a notification as read"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire le notifiche")
    
    result = await db.admin_notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    
    return {"message": "Notifica segnata come letta"}

@api_router.patch("/admin/notifications/mark-all-read")
async def mark_all_notifications_read(current_user = Depends(get_current_user)):
    """Mark all notifications as read"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire le notifiche")
    
    await db.admin_notifications.update_many(
        {"read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": "Tutte le notifiche segnate come lette"}

@api_router.delete("/admin/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user = Depends(get_current_user)):
    """Delete a notification"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire le notifiche")
    
    result = await db.admin_notifications.delete_one({"id": notification_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    
    return {"message": "Notifica eliminata"}

# ==================== USER MANAGEMENT ENDPOINTS (ADMIN) ====================

class UserUpdateRole(BaseModel):
    role: str  # admin, viewer, coach
    
class UserUpdateStatus(BaseModel):
    status: str  # approved, rejected, suspended

class CoachAssignTeams(BaseModel):
    team_ids: List[str]

@api_router.get("/users/dirigenti")
async def get_dirigenti(current_user = Depends(get_current_user)):
    """Get all dirigenti (admin and viewer roles) - accessible by admin and coach"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH]:
        raise HTTPException(status_code=403, detail="Solo admin e coach possono vedere i dirigenti")
    
    dirigenti = await db.users.find({
        "role": {"$in": [UserRole.ADMIN, UserRole.VIEWER]}
    }).to_list(1000)
    
    # Get all teams to resolve team names
    teams = await db.teams.find({}).to_list(1000)
    team_dict = {t["id"]: t["name"] for t in teams}
    
    result = []
    for d in dirigenti:
        assigned_teams = d.get("assigned_teams", [])
        assigned_team_names = [team_dict.get(tid, "Squadra sconosciuta") for tid in assigned_teams if tid in team_dict]
        
        result.append({
            "id": d["id"],
            "email": d["email"],
            "full_name": d["full_name"],
            "role": d["role"],
            "status": d.get("status", UserStatus.APPROVED),
            "created_at": d.get("created_at"),
            "approved_at": d.get("approved_at"),
            "phone": d.get("phone", ""),
            "profile_photo": d.get("profile_photo", ""),
            "profile_photo_artistic": d.get("profile_photo_artistic", ""),
            "qualification": d.get("qualification", ""),
            "assigned_teams": assigned_teams,
            "assigned_team_names": assigned_team_names,
        })
    
    return result

@api_router.get("/users/coaches")
async def get_coaches(current_user = Depends(get_current_user)):
    """Get all coaches"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i coach")
    
    coaches = await db.users.find({"role": UserRole.COACH}).to_list(1000)
    
    result = []
    for c in coaches:
        result.append({
            "id": c["id"],
            "email": c["email"],
            "full_name": c["full_name"],
            "role": c["role"],
            "status": c.get("status", UserStatus.APPROVED),
            "assigned_teams": c.get("assigned_teams", []),
            "created_at": c.get("created_at"),
            "approved_at": c.get("approved_at"),
            "monthly_compensation": c.get("monthly_compensation", 0),
            "other_annual_compensation": c.get("other_annual_compensation", 0),
            "profile_photo": c.get("profile_photo"),
            "profile_photo_artistic": c.get("profile_photo_artistic"),
        })
    
    return result

@api_router.get("/users/parents")
async def get_parents(current_user = Depends(get_current_user)):
    """Get all parents/athletes - OPTIMIZED with aggregation"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i genitori")
    
    parents = await db.users.find({"role": UserRole.PARENT}).to_list(1000)
    
    # Batch fetch athlete counts using aggregation (avoid N+1 queries)
    pipeline = [
        {"$group": {"_id": "$parent_id", "count": {"$sum": 1}}}
    ]
    athlete_counts = await db.athletes.aggregate(pipeline).to_list(1000)
    counts_dict = {item["_id"]: item["count"] for item in athlete_counts if item["_id"]}
    
    result = []
    for p in parents:
        result.append({
            "id": p["id"],
            "email": p["email"],
            "full_name": p["full_name"],
            "role": p["role"],
            "status": p.get("status", UserStatus.APPROVED),
            "athletes_count": counts_dict.get(p["id"], 0),
            "created_at": p.get("created_at"),
            "approved_at": p.get("approved_at"),
            "phone": p.get("phone", ""),
        })
    
    return result

@api_router.get("/users/pending")
async def get_pending_users(current_user = Depends(get_current_user)):
    """Get all users pending approval"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere gli utenti in attesa")
    
    pending = await db.users.find({"status": UserStatus.PENDING}).to_list(1000)
    
    result = []
    for u in pending:
        result.append({
            "id": u["id"],
            "email": u["email"],
            "full_name": u["full_name"],
            "role": u["role"],
            "status": u.get("status", UserStatus.PENDING),
            "created_at": u.get("created_at"),
            "phone": u.get("phone", ""),
        })
    
    return result

@api_router.patch("/users/me/bank-details")
async def update_my_bank_details(data: dict, current_user = Depends(get_current_user)):
    """Update current user's bank and document details"""
    allowed_fields = ["id_type", "id_front", "id_back", "iban", "account_holder", "bank_name", "doc_front_image", "doc_back_image"]
    update_dict = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_dict:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_dict}
        )
    
    return {"message": "Dati bancari aggiornati"}

@api_router.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, data: UserUpdateRole, current_user = Depends(get_current_user)):
    """Update user role (only for dirigenti: admin/viewer)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare i ruoli")
    
    # Validate role
    if data.role not in [UserRole.ADMIN, UserRole.VIEWER]:
        raise HTTPException(status_code=400, detail="Ruolo non valido per dirigenti")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Only allow role change for admin/viewer users
    if user["role"] not in [UserRole.ADMIN, UserRole.VIEWER]:
        raise HTTPException(status_code=400, detail="Questo utente non è un dirigente")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": data.role}}
    )
    
    return {"message": "Ruolo aggiornato con successo"}

class AdminResetPassword(BaseModel):
    new_password: str

@api_router.patch("/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, data: AdminResetPassword, current_user = Depends(get_current_user)):
    """Admin can reset any user's password"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può resettare le password")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Hash the new password
    password_hash = hash_password(data.new_password)
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": password_hash}}
    )
    
    return {"message": f"Password resettata per {user.get('full_name', user.get('email'))}"}

@api_router.patch("/users/{user_id}/status")
async def update_user_status(user_id: str, data: UserUpdateStatus, current_user = Depends(get_current_user)):
    """Approve, reject or suspend a user"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire gli utenti")
    
    # Validate status
    if data.status not in [UserStatus.APPROVED, UserStatus.REJECTED, UserStatus.SUSPENDED]:
        raise HTTPException(status_code=400, detail="Stato non valido")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    update_data = {"status": data.status}
    if data.status == UserStatus.APPROVED:
        update_data["approved_at"] = datetime.utcnow()
        update_data["approved_by"] = current_user["id"]
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    return {"message": f"Utente {data.status} con successo"}

class CoachOnboardingData(BaseModel):
    onboarding_checklist: Optional[dict] = None
    prior_compensation: Optional[float] = None
    onboarding_completed: Optional[bool] = None
    onboarding_date: Optional[str] = None

@api_router.patch("/users/{user_id}/onboarding")
async def update_coach_onboarding(user_id: str, data: CoachOnboardingData, current_user = Depends(get_current_user)):
    """Update coach onboarding data - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire l'onboarding")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    update_dict = {}
    if data.onboarding_checklist is not None:
        update_dict["onboarding_checklist"] = data.onboarding_checklist
    if data.prior_compensation is not None:
        update_dict["prior_compensation"] = data.prior_compensation
    if data.onboarding_completed is not None:
        update_dict["onboarding_completed"] = data.onboarding_completed
    if data.onboarding_date is not None:
        try:
            update_dict["onboarding_date"] = datetime.fromisoformat(data.onboarding_date.replace('Z', '+00:00'))
        except:
            update_dict["onboarding_date"] = datetime.utcnow()
    
    if update_dict:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_dict}
        )
    
    return {"message": "Dati onboarding aggiornati"}

@api_router.patch("/users/{user_id}/assigned-teams")
async def update_assigned_teams(user_id: str, data: dict, current_user = Depends(get_current_user)):
    """Assign teams to a coach - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può assegnare squadre")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if user["role"] != UserRole.COACH:
        raise HTTPException(status_code=400, detail="Solo i coach possono avere squadre assegnate")
    
    assigned_teams = data.get("assigned_teams", [])
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"assigned_teams": assigned_teams}}
    )
    
    return {"message": "Squadre assegnate con successo"}

@api_router.patch("/users/{user_id}/teams")
async def assign_teams_to_coach(user_id: str, data: CoachAssignTeams, current_user = Depends(get_current_user)):
    """Assign teams to a coach"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può assegnare squadre")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if user["role"] != UserRole.COACH:
        raise HTTPException(status_code=400, detail="Questo utente non è un coach")
    
    # Verify all teams exist
    for team_id in data.team_ids:
        team = await db.teams.find_one({"id": team_id})
        if not team:
            raise HTTPException(status_code=404, detail=f"Squadra {team_id} non trovata")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"assigned_teams": data.team_ids}}
    )
    
    return {"message": "Squadre assegnate con successo"}

@api_router.patch("/users/{user_id}/compensation")
async def update_user_compensation(user_id: str, data: dict, current_user = Depends(get_current_user)):
    """Update monthly compensation for coach/dirigente (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare il compenso")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if user["role"] not in [UserRole.COACH, UserRole.VIEWER, UserRole.ADMIN]:
        raise HTTPException(status_code=400, detail="Compenso applicabile solo a coach e dirigenti")
    
    update_data = {}
    if "monthly_compensation" in data:
        update_data["monthly_compensation"] = float(data["monthly_compensation"])
        update_data["compensation_accepted"] = False  # Reset acceptance when changed
    
    if "other_annual_compensation" in data:
        update_data["other_annual_compensation"] = float(data["other_annual_compensation"]) if data["other_annual_compensation"] else 0
    
    if "contract_start_date" in data:
        if data["contract_start_date"]:
            try:
                # Parse ISO date string (YYYY-MM-DD)
                update_data["contract_start_date"] = datetime.fromisoformat(data["contract_start_date"])
            except:
                pass
        else:
            update_data["contract_start_date"] = None
    
    if "contract_end_date" in data:
        if data["contract_end_date"]:
            try:
                # Parse ISO date string (YYYY-MM-DD)
                update_data["contract_end_date"] = datetime.fromisoformat(data["contract_end_date"])
            except:
                pass
        else:
            update_data["contract_end_date"] = None
    
    if update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
    
    return {"message": "Compenso aggiornato con successo"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user = Depends(get_current_user)):
    """Delete a user (only admin can delete)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare utenti")
    
    # Prevent self-deletion
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi eliminare il tuo account")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    await db.users.delete_one({"id": user_id})
    
    return {"message": "Utente eliminato con successo"}

@api_router.get("/users/{user_id}")
async def get_user_detail(user_id: str, current_user = Depends(get_current_user)):
    """Get detailed user information by ID"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i dettagli utente")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Return all relevant fields
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "status": user.get("status", UserStatus.APPROVED),
        "assigned_teams": user.get("assigned_teams", []),
        "created_at": user.get("created_at"),
        "approved_at": user.get("approved_at"),
        # Personal data
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "date_of_birth": user.get("date_of_birth"),
        "place_of_birth": user.get("place_of_birth"),
        # Contact
        "phone": user.get("phone"),
        "address": user.get("address"),
        "city": user.get("city"),
        "postal_code": user.get("postal_code"),
        "province": user.get("province"),
        # Fiscal
        "fiscal_code": user.get("fiscal_code"),
        "coach_license_number": user.get("coach_license_number"),
        # Qualification (for dirigenti)
        "qualification": user.get("qualification"),
        # Photo
        "profile_photo": user.get("profile_photo"),
        "profile_photo_artistic": user.get("profile_photo_artistic"),
        # Compensation
        "monthly_compensation": user.get("monthly_compensation", 0),
        "other_annual_compensation": user.get("other_annual_compensation", 0),  # Da altre ASD/SSD
        "compensation_accepted": user.get("compensation_accepted", False),
        "compensation_history": user.get("compensation_history", {}),
        "over_5000_limit": user.get("over_5000_limit", {}),
        # Contract dates
        "contract_start_date": user.get("contract_start_date").strftime("%Y-%m-%d") if user.get("contract_start_date") else None,
        "contract_end_date": user.get("contract_end_date").strftime("%Y-%m-%d") if user.get("contract_end_date") else None,
        # Document and Bank details (new fields)
        "id_type": user.get("id_type"),
        "id_front": user.get("id_front"),
        "id_back": user.get("id_back"),
        "doc_front_image": user.get("doc_front_image"),
        "doc_back_image": user.get("doc_back_image"),
        "iban": user.get("iban"),
        "account_holder": user.get("account_holder"),
        "bank_name": user.get("bank_name"),
        # Onboarding fields
        "onboarding_checklist": user.get("onboarding_checklist"),
        "prior_compensation": user.get("prior_compensation"),
        "onboarding_completed": user.get("onboarding_completed"),
        "onboarding_date": user.get("onboarding_date"),
    }

@api_router.patch("/users/{user_id}/bank-details")
async def update_user_bank_details(user_id: str, data: dict, current_user = Depends(get_current_user)):
    """Update document and bank details for coach/dirigente (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare i dati bancari")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    update_data = {}
    if "document_type" in data:
        update_data["document_type"] = data["document_type"]
    if "document_front" in data:
        update_data["document_front"] = data["document_front"]
    if "document_back" in data:
        update_data["document_back"] = data["document_back"]
    if "iban" in data:
        update_data["iban"] = data["iban"]
    if "iban_holder" in data:
        update_data["iban_holder"] = data["iban_holder"]
    if "bank_name" in data:
        update_data["bank_name"] = data["bank_name"]
    
    if update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
    
    return {"message": "Dati bancari aggiornati con successo"}

@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, data: dict, current_user = Depends(get_current_user)):
    """Update user data (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare gli utenti")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    update_data = {}
    
    # Qualification for dirigenti
    if "qualification" in data:
        update_data["qualification"] = data["qualification"]
    
    # Other fields that admin can update
    if "monthly_compensation" in data:
        update_data["monthly_compensation"] = data["monthly_compensation"]
    
    if update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
    
    return {"message": "Utente aggiornato con successo"}

# ==================== MATCHES/GARE ENDPOINTS ====================

@api_router.get("/matches")
async def get_matches(current_user = Depends(get_current_user)):
    """Get all matches for admin"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere tutte le gare")
    
    matches = await db.matches.find({}).sort("date", 1).to_list(500)
    for m in matches:
        clean_mongo_doc(m)
    return matches

@api_router.get("/matches/upcoming")
async def get_upcoming_matches(days: int = 7, current_user = Depends(get_current_user)):
    """Get upcoming matches for next N days"""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = today + timedelta(days=days)
    
    matches = await db.matches.find({
        "date": {"$gte": today, "$lte": end_date}
    }).sort("date", 1).to_list(100)
    
    for m in matches:
        clean_mongo_doc(m)
    return matches

@api_router.get("/matches/team/{team_id}")
async def get_team_matches(team_id: str, current_user = Depends(get_current_user)):
    """Get all matches for a specific team"""
    matches = await db.matches.find({"team_id": team_id}).sort("date", 1).to_list(100)
    for m in matches:
        clean_mongo_doc(m)
    return matches

@api_router.post("/matches")
async def create_match(match_data: MatchCreate, current_user = Depends(get_current_user)):
    """Create a new match"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può creare gare")
    
    # Get team name
    team = await db.teams.find_one({"id": match_data.team_id})
    team_name = team.get("name", "") if team else ""
    
    match = Match(
        team_id=match_data.team_id,
        team_name=team_name,
        date=match_data.date,
        opponent=match_data.opponent,
        venue=match_data.venue,
        address=match_data.address,
        city=match_data.city,
        home_away=match_data.home_away,
        meeting_time=match_data.meeting_time,
        notes=match_data.notes
    )
    
    await db.matches.insert_one(match.dict())
    return match.dict()

@api_router.patch("/matches/{match_id}")
async def update_match(match_id: str, match_data: dict, current_user = Depends(get_current_user)):
    """Update a match"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare gare")
    
    match_data["updated_at"] = datetime.utcnow()
    
    # If team_id is being updated, also update team_name
    if "team_id" in match_data:
        team = await db.teams.find_one({"id": match_data["team_id"]})
        match_data["team_name"] = team.get("name", "") if team else ""
    
    result = await db.matches.update_one(
        {"id": match_id},
        {"$set": match_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Gara non trovata")
    
    return {"message": "Gara aggiornata"}

@api_router.delete("/matches/{match_id}")
async def delete_match(match_id: str, current_user = Depends(get_current_user)):
    """Delete a match"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare gare")
    
    result = await db.matches.delete_one({"id": match_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gara non trovata")
    
    return {"message": "Gara eliminata"}

@api_router.post("/matches/import")
async def import_matches_from_excel(file_data: dict, current_user = Depends(get_current_user)):
    """Import matches from Excel data (parsed on frontend)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può importare gare")
    
    matches_data = file_data.get("matches", [])
    imported_count = 0
    deleted_count = 0
    errors = []
    
    # Collect all match_numbers from the import to decide what to delete/update
    match_numbers_to_import = set()
    for row in matches_data:
        if row.get("match_number"):
            match_numbers_to_import.add(row["match_number"])
    
    # If we have match_numbers, delete only those specific matches (upsert logic)
    # Otherwise, fall back to deleting all future matches for those teams
    if match_numbers_to_import:
        # Delete existing matches with same match_number
        result = await db.matches.delete_many({
            "match_number": {"$in": list(match_numbers_to_import)}
        })
        deleted_count = result.deleted_count
        logging.info(f"Deleted {deleted_count} existing matches with match_numbers: {match_numbers_to_import}")
    else:
        # Fallback: delete future matches for teams (old behavior)
        team_ids_to_import = set()
        for row in matches_data:
            if row.get("team_id"):
                team_ids_to_import.add(row["team_id"])
        
        if team_ids_to_import:
            now = datetime.utcnow()
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            for team_id in team_ids_to_import:
                result = await db.matches.delete_many({
                    "team_id": team_id,
                    "date": {"$gte": today}
                })
                deleted_count += result.deleted_count
                logging.info(f"Deleted {result.deleted_count} existing future matches for team {team_id}")
    
    for i, row in enumerate(matches_data):
        try:
            # Log per debug
            logging.info(f"Import row {i}: {row}")
            
            # Validate required fields
            if not row.get("team_id") or not row.get("date") or not row.get("opponent"):
                errors.append(f"Riga {i+1}: dati mancanti (team_id={row.get('team_id')}, date={row.get('date')}, opponent={row.get('opponent')})")
                continue
            
            # Get team name
            team = await db.teams.find_one({"id": row["team_id"]})
            team_name = team.get("name", "") if team else ""
            
            # Parse date
            date_str = row.get("date")
            match_date = None
            if isinstance(date_str, str):
                # Try different date formats (including HH:MM:SS for federation files)
                for fmt in ["%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M", "%Y-%m-%dT%H:%M", "%d/%m/%Y", "%Y-%m-%d"]:
                    try:
                        match_date = datetime.strptime(date_str.strip(), fmt)
                        logging.info(f"Date parsed with format {fmt}: {match_date}")
                        break
                    except:
                        continue
                
                if not match_date:
                    errors.append(f"Riga {i+1}: formato data non valido '{date_str}'")
                    continue
            else:
                match_date = date_str
            
            match = Match(
                team_id=row["team_id"],
                team_name=team_name,
                match_number=row.get("match_number"),  # Numero gara univoco
                date=match_date,
                opponent=row["opponent"],
                venue=row.get("venue", "") or "",
                address=row.get("address"),
                city=row.get("city"),
                home_away=row.get("home_away", "away"),  # Default to away for federation imports
                meeting_time=row.get("meeting_time"),
                notes=row.get("notes")
            )
            
            await db.matches.insert_one(match.dict())
            imported_count += 1
            logging.info(f"Match imported: {match.team_name} ({match.match_number}) vs {match.opponent} on {match.date}")
            
        except Exception as e:
            logging.error(f"Error importing row {i}: {e}")
            errors.append(f"Riga {i+1}: {str(e)}")
    
    return {
        "message": f"Sostituite {deleted_count} gare esistenti. Importate {imported_count} nuove gare.",
        "imported": imported_count,
        "deleted": deleted_count,
        "errors": errors
    }


# ==================== FEDERATION CALENDAR IMPORT ====================

from federation_scraper import FIPAVScraper, FIPScraper

class FederationImportConfig(BaseModel):
    """Configuration for federation calendar import"""
    federation: str  # "fipav" or "fip"
    region: str  # e.g., "umbria"
    society_name: str  # Name of the society to filter matches
    team_mappings: List[dict]  # [{federation_team_name: str, local_team_id: str}, ...]
    season_id: Optional[str] = None
    championship_ids: Optional[List[str]] = None

class FederationSocietyConfig(BaseModel):
    """Configuration stored per society for federation imports"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    society_id: str
    federation: str  # "fipav" or "fip"
    region: str
    federation_society_id: Optional[str] = None  # ID from federation website
    federation_society_name: str  # Name as appears on federation website
    team_mappings: List[dict] = []  # [{federation_team_name: str, local_team_id: str, championship_id: str}, ...]
    last_import: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

@api_router.get("/federation/regions")
async def get_federation_regions(federation: str = "fipav"):
    """Get available regions for a federation"""
    if federation.lower() == "fipav":
        regions = [
            {"id": "umbria", "name": "Umbria"},
            {"id": "lazio", "name": "Lazio"},
            {"id": "toscana", "name": "Toscana"},
            {"id": "emilia", "name": "Emilia Romagna"},
            {"id": "lombardia", "name": "Lombardia"},
            {"id": "piemonte", "name": "Piemonte"},
            {"id": "veneto", "name": "Veneto"},
            {"id": "marche", "name": "Marche"},
            {"id": "abruzzo", "name": "Abruzzo"},
            {"id": "campania", "name": "Campania"},
            {"id": "puglia", "name": "Puglia"},
            {"id": "calabria", "name": "Calabria"},
            {"id": "sicilia", "name": "Sicilia"},
            {"id": "sardegna", "name": "Sardegna"},
            {"id": "liguria", "name": "Liguria"},
            {"id": "friuli", "name": "Friuli Venezia Giulia"},
            {"id": "trentino", "name": "Trentino Alto Adige"},
        ]
    elif federation.lower() == "fip":
        regions = [
            {"id": "umbria", "name": "Umbria"},
            {"id": "lazio", "name": "Lazio"},
            {"id": "toscana", "name": "Toscana"},
        ]
    else:
        regions = []
    
    return regions

@api_router.get("/federation/seasons")
async def get_federation_seasons(federation: str = "fipav", region: str = "umbria"):
    """Get available seasons from federation"""
    try:
        if federation.lower() == "fipav":
            scraper = FIPAVScraper(region=region)
            seasons = await scraper.get_seasons()
            return seasons
        else:
            return []
    except Exception as e:
        logging.error(f"Error getting federation seasons: {e}")
        raise HTTPException(status_code=500, detail=f"Errore recupero stagioni: {str(e)}")

@api_router.get("/federation/championships")
async def get_federation_championships(federation: str = "fipav", region: str = "umbria", season_id: Optional[str] = None):
    """Get available championships from federation"""
    try:
        if federation.lower() == "fipav":
            scraper = FIPAVScraper(region=region)
            championships = await scraper.get_championships(season_id)
            return championships
        else:
            return []
    except Exception as e:
        logging.error(f"Error getting federation championships: {e}")
        raise HTTPException(status_code=500, detail=f"Errore recupero campionati: {str(e)}")

@api_router.get("/federation/societies")
async def get_federation_societies(federation: str = "fipav", region: str = "umbria", season_id: Optional[str] = None):
    """Get available societies from federation"""
    try:
        if federation.lower() == "fipav":
            scraper = FIPAVScraper(region=region)
            societies = await scraper.get_societies(season_id)
            return societies
        else:
            return []
    except Exception as e:
        logging.error(f"Error getting federation societies: {e}")
        raise HTTPException(status_code=500, detail=f"Errore recupero società: {str(e)}")

@api_router.post("/federation/preview")
async def preview_federation_import(config: dict, current_user = Depends(get_current_user)):
    """Preview matches that would be imported from federation"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può importare calendari")
    
    try:
        federation = config.get("federation", "fipav").lower()
        region = config.get("region", "umbria")
        society_name = config.get("society_name", "")
        championship_id = config.get("championship_id")
        
        logging.info(f"Preview request - society_name: '{society_name}', championship_id: {championship_id}")
        season_id = config.get("season_id")
        society_id = config.get("federation_society_id")
        
        if federation == "fipav":
            scraper = FIPAVScraper(region=region)
            matches = await scraper.scrape_matches(
                society_id=society_id,
                championship_id=championship_id,
                season_id=season_id,
                society_name=society_name
            )
            
            # Convert to dict for JSON response
            matches_data = []
            for m in matches:
                matches_data.append({
                    "match_number": m.match_number,
                    "date": m.date.isoformat(),
                    "home_team": m.home_team,
                    "away_team": m.away_team,
                    "result": m.result,
                    "championship": m.championship,
                    "giornata": m.giornata
                })
            
            return {
                "matches": matches_data,
                "count": len(matches_data)
            }
        else:
            return {"matches": [], "count": 0, "message": "FIP non ancora supportato"}
    
    except Exception as e:
        logging.error(f"Error previewing federation import: {e}")
        raise HTTPException(status_code=500, detail=f"Errore preview import: {str(e)}")

@api_router.post("/federation/import")
async def import_from_federation(config: dict, current_user = Depends(get_current_user)):
    """Import matches from federation to local database"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può importare calendari")
    
    try:
        federation = config.get("federation", "fipav").lower()
        region = config.get("region", "umbria")
        society_name = config.get("society_name", "")
        championship_id = config.get("championship_id")
        season_id = config.get("season_id")
        society_id = config.get("federation_society_id")
        team_mappings = config.get("team_mappings", [])  # [{federation_team_name: str, local_team_id: str}, ...]
        
        society_id_local = current_user.get("society_id")
        
        if federation == "fipav":
            scraper = FIPAVScraper(region=region)
            matches = await scraper.scrape_matches(
                society_id=society_id,
                championship_id=championship_id,
                season_id=season_id,
                society_name=society_name
            )
            
            imported_count = 0
            skipped_count = 0
            errors = []
            
            # Build a mapping dict for quick lookup
            mapping_dict = {}
            for mapping in team_mappings:
                fed_name = mapping.get("federation_team_name", "").lower()
                local_id = mapping.get("local_team_id")
                if fed_name and local_id:
                    mapping_dict[fed_name] = local_id
            
            # Also add variations of society_name to mapping
            if society_name:
                for mapping in team_mappings:
                    fed_name = mapping.get("federation_team_name", "").lower()
                    local_id = mapping.get("local_team_id")
                    if local_id:
                        # Add the society_name as a key if it contains the federation name
                        if society_name.lower() in fed_name or fed_name in society_name.lower():
                            mapping_dict[society_name.lower()] = local_id
            
            # Collect match numbers for deletion
            match_numbers = [m.match_number for m in matches if m.match_number]
            
            # Delete existing matches with same match_number
            if match_numbers:
                delete_result = await db.matches.delete_many({
                    "match_number": {"$in": match_numbers},
                    "society_id": society_id_local
                })
                logging.info(f"Deleted {delete_result.deleted_count} existing matches")
            
            for scraped_match in matches:
                # Determine which team this match is for (our team can be home or away)
                local_team_id = None
                is_home = False
                
                # Check home team
                home_lower = scraped_match.home_team.lower()
                for key, value in mapping_dict.items():
                    if key in home_lower or home_lower in key:
                        local_team_id = value
                        is_home = True
                        break
                
                # Check away team if not found in home
                if not local_team_id:
                    away_lower = scraped_match.away_team.lower()
                    for key, value in mapping_dict.items():
                        if key in away_lower or away_lower in key:
                            local_team_id = value
                            is_home = False
                            break
                
                if not local_team_id:
                    skipped_count += 1
                    continue
                
                # Get team info
                team = await db.teams.find_one({"id": local_team_id})
                team_name = team.get("name", "") if team else ""
                
                # Determine opponent
                opponent = scraped_match.away_team if is_home else scraped_match.home_team
                
                # Create match
                match = Match(
                    society_id=society_id_local,
                    team_id=local_team_id,
                    team_name=team_name,
                    match_number=scraped_match.match_number,
                    date=scraped_match.date,
                    opponent=opponent,
                    home_away="home" if is_home else "away",
                    result=scraped_match.result,
                    notes=f"Campionato: {scraped_match.championship}" if scraped_match.championship else None
                )
                
                await db.matches.insert_one(match.dict())
                imported_count += 1
            
            # Save import configuration for future use
            import_config = {
                "society_id": society_id_local,
                "federation": federation,
                "region": region,
                "federation_society_id": society_id,
                "federation_society_name": society_name,
                "championship_id": championship_id,
                "season_id": season_id,
                "team_mappings": team_mappings,
                "last_import": datetime.utcnow()
            }
            
            await db.federation_configs.update_one(
                {"society_id": society_id_local, "federation": federation},
                {"$set": import_config},
                upsert=True
            )
            
            return {
                "message": f"Importate {imported_count} partite dalla federazione",
                "imported": imported_count,
                "skipped": skipped_count,
                "errors": errors
            }
        else:
            raise HTTPException(status_code=400, detail="Federazione non supportata")
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error importing from federation: {e}")
        raise HTTPException(status_code=500, detail=f"Errore import: {str(e)}")

@api_router.post("/federation/import-selected")
async def import_selected_matches(config: dict, current_user = Depends(get_current_user)):
    """Import selected matches directly (without re-scraping)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può importare partite")
    
    try:
        matches = config.get("matches", [])
        society_name = config.get("society_name", "")
        team_mappings = config.get("team_mappings", [])
        
        society_id_local = current_user.get("society_id")
        
        imported_count = 0
        skipped_count = 0
        
        # Build a mapping dict for quick lookup
        mapping_dict = {}
        for mapping in team_mappings:
            fed_name = mapping.get("federation_team_name", "").lower()
            local_id = mapping.get("local_team_id")
            if fed_name and local_id:
                mapping_dict[fed_name] = local_id
        
        # Also add society_name variations
        if society_name:
            for mapping in team_mappings:
                local_id = mapping.get("local_team_id")
                if local_id:
                    mapping_dict[society_name.lower()] = local_id
        
        for match_data in matches:
            home_team = match_data.get("home_team", "")
            away_team = match_data.get("away_team", "")
            match_number = match_data.get("match_number", "")
            match_date_str = match_data.get("date", "")
            result = match_data.get("result")
            
            # Parse date
            try:
                match_date = datetime.fromisoformat(match_date_str.replace('Z', '+00:00'))
            except:
                skipped_count += 1
                continue
            
            # Determine which team this match is for
            local_team_id = None
            is_home = False
            
            # Check home team
            home_lower = home_team.lower()
            for key, value in mapping_dict.items():
                if key in home_lower or home_lower in key:
                    local_team_id = value
                    is_home = True
                    break
            
            # Check away team if not found in home
            if not local_team_id:
                away_lower = away_team.lower()
                for key, value in mapping_dict.items():
                    if key in away_lower or away_lower in key:
                        local_team_id = value
                        is_home = False
                        break
            
            if not local_team_id:
                skipped_count += 1
                continue
            
            # Get team info
            team = await db.teams.find_one({"id": local_team_id})
            team_name = team.get("name", "") if team else ""
            
            # Determine opponent
            opponent = away_team if is_home else home_team
            
            # Delete existing match with same match_number
            if match_number:
                await db.matches.delete_one({
                    "match_number": match_number,
                    "society_id": society_id_local
                })
            
            # Create match
            match = Match(
                society_id=society_id_local,
                team_id=local_team_id,
                team_name=team_name,
                match_number=match_number or f"FIPAV-{match_date.strftime('%Y%m%d%H%M')}",
                date=match_date,
                opponent=opponent,
                home_away="home" if is_home else "away",
                result=result if result and result != '-' else None
            )
            
            await db.matches.insert_one(match.dict())
            imported_count += 1
        
        return {
            "message": f"Importate {imported_count} partite",
            "imported": imported_count,
            "skipped": skipped_count
        }
    
    except Exception as e:
        logging.error(f"Error importing selected matches: {e}")
        raise HTTPException(status_code=500, detail=f"Errore import: {str(e)}")

@api_router.get("/federation/config")
async def get_federation_config(current_user = Depends(get_current_user)):
    """Get saved federation import configuration for current society"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere la configurazione")
    
    society_id = current_user.get("society_id")
    if not society_id:
        return None
    
    config = await db.federation_configs.find_one({"society_id": society_id})
    if config:
        clean_mongo_doc(config)
    
    return config

@api_router.delete("/federation/config")
async def delete_federation_config(current_user = Depends(get_current_user)):
    """Delete federation import configuration"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare la configurazione")
    
    society_id = current_user.get("society_id")
    if not society_id:
        return {"message": "Nessuna configurazione trovata"}
    
    await db.federation_configs.delete_one({"society_id": society_id})
    
    return {"message": "Configurazione eliminata"}



@api_router.get("/parent/commitments")
async def get_parent_commitments(current_user = Depends(get_current_user)):
    """Get commitments (trainings + matches) for parent's children - 7 days"""
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo genitori possono vedere gli impegni")
    
    # Get parent's athletes (include both primary and second parent)
    athletes = await db.athletes.find({
        "$or": [
            {"parent_id": current_user["id"]},
            {"second_parent_id": current_user["id"]}
        ]
    }).to_list(20)
    
    # Crea un dizionario per mappare team_id -> lista di nomi atleti
    team_athletes = {}
    for a in athletes:
        team_id = a.get("team_id")
        if team_id:
            athlete_name = a.get("first_name", a.get("full_name", "").split()[0] if a.get("full_name") else "")
            if team_id not in team_athletes:
                team_athletes[team_id] = []
            team_athletes[team_id].append(athlete_name)
    
    # Get unique team IDs from athletes
    team_ids = list(team_athletes.keys())
    
    if not team_ids:
        return {"today": [], "tomorrow": [], "day_after": [], "upcoming": []}
    
    # Get teams info (for training schedules)
    teams = await db.teams.find({"id": {"$in": team_ids}}).to_list(20)
    teams_dict = {t["id"]: t for t in teams}
    
    # Get current date info
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    end_of_week = today + timedelta(days=7)
    
    # Day of week mapping (Italian)
    days_map = {
        0: "Lunedì", 1: "Martedì", 2: "Mercoledì", 
        3: "Giovedì", 4: "Venerdì", 5: "Sabato", 6: "Domenica"
    }
    
    def get_day_name(date):
        return days_map[date.weekday()]
    
    # Get matches for 7 days FIRST (to know which teams have home matches on which days)
    matches = await db.matches.find({
        "team_id": {"$in": team_ids},
        "date": {"$gte": today, "$lt": end_of_week}
    }).to_list(50)
    
    # Build a set of (team_id, day_key) for home matches - these will skip training
    home_match_days = set()
    for match in matches:
        match_date = match.get("date")
        if isinstance(match_date, str):
            match_date = datetime.fromisoformat(match_date.replace("Z", ""))
        
        # Only home matches hide training
        if match.get("home_away") == "home":
            if today <= match_date < tomorrow:
                home_match_days.add((match.get("team_id"), "today"))
            elif tomorrow <= match_date < day_after:
                home_match_days.add((match.get("team_id"), "tomorrow"))
            elif day_after <= match_date < (day_after + timedelta(days=1)):
                home_match_days.add((match.get("team_id"), "day_after"))
            else:
                # For upcoming, we need to track by date
                home_match_days.add((match.get("team_id"), match_date.strftime("%d/%m")))
    
    # Build commitments for each day
    result = {"today": [], "tomorrow": [], "day_after": [], "upcoming": []}
    
    for day_key, target_date in [("today", today), ("tomorrow", tomorrow), ("day_after", day_after)]:
        day_name = get_day_name(target_date)
        
        # Check trainings for this day
        for team_id in team_ids:
            # Skip training if there's a home match for this team on this day
            if (team_id, day_key) in home_match_days:
                continue
                
            team = teams_dict.get(team_id, {})
            team_name = team.get("name", "Squadra")
            training_sessions = team.get("training_sessions", [])
            # Nomi degli atleti in questa squadra
            athlete_names = team_athletes.get(team_id, [])
            athlete_names_str = ", ".join(athlete_names) if athlete_names else ""
            
            for session in training_sessions:
                if session.get("day") == day_name:
                    result[day_key].append({
                        "type": "training",
                        "team_id": team_id,
                        "team_name": team_name,
                        "athlete_names": athlete_names_str,
                        "time_start": session.get("timeStart", ""),
                        "time_end": session.get("timeEnd", ""),
                        "venue": session.get("venue", ""),
                        "title": f"Allenamento {team_name}"
                    })
    
    # Check trainings for upcoming days (days 4-7)
    for day_offset in range(3, 7):
        target_date = today + timedelta(days=day_offset)
        day_name = get_day_name(target_date)
        date_str = target_date.strftime("%d/%m")
        
        for team_id in team_ids:
            # Skip training if there's a home match for this team on this day
            if (team_id, date_str) in home_match_days:
                continue
                
            team = teams_dict.get(team_id, {})
            team_name = team.get("name", "Squadra")
            training_sessions = team.get("training_sessions", [])
            athlete_names = team_athletes.get(team_id, [])
            athlete_names_str = ", ".join(athlete_names) if athlete_names else ""
            
            for session in training_sessions:
                if session.get("day") == day_name:
                    result["upcoming"].append({
                        "type": "training",
                        "team_id": team_id,
                        "team_name": team_name,
                        "athlete_names": athlete_names_str,
                        "date": date_str,
                        "day_name": day_name,
                        "time_start": session.get("timeStart", ""),
                        "time_end": session.get("timeEnd", ""),
                        "venue": session.get("venue", ""),
                        "title": f"Allenamento {team_name}"
                    })
    
    # Add matches to result
    for match in matches:
        match_date = match.get("date")
        if isinstance(match_date, str):
            match_date = datetime.fromisoformat(match_date.replace("Z", ""))
        
        if today <= match_date < tomorrow:
            day_key = "today"
        elif tomorrow <= match_date < day_after:
            day_key = "tomorrow"
        elif day_after <= match_date < (day_after + timedelta(days=1)):
            day_key = "day_after"
        elif match_date < end_of_week:
            day_key = "upcoming"
        else:
            continue
        
        # Nomi degli atleti per questa squadra
        match_team_id = match.get("team_id")
        athlete_names = team_athletes.get(match_team_id, [])
        athlete_names_str = ", ".join(athlete_names) if athlete_names else ""
        
        match_item = {
            "type": "match",
            "team_id": match_team_id,
            "team_name": match.get("team_name", ""),
            "athlete_names": athlete_names_str,
            "time": match_date.strftime("%H:%M"),
            "venue": match.get("venue", ""),
            "city": match.get("city", ""),
            "address": match.get("address", ""),
            "opponent": match.get("opponent", ""),
            "home_away": match.get("home_away", "home"),
            "meeting_time": match.get("meeting_time"),
            "notes": match.get("notes"),
            "title": f"Gara {match.get('team_name', '')} vs {match.get('opponent', '')}"
        }
        
        if day_key == "upcoming":
            match_item["date"] = match_date.strftime("%d/%m")
            match_item["day_name"] = get_day_name(match_date)
        
        result[day_key].append(match_item)
    
    # Sort by time
    for day_key in ["today", "tomorrow", "day_after"]:
        result[day_key].sort(key=lambda x: x.get("time_start", x.get("time", "00:00")))
    
    # Sort upcoming by date and time
    result["upcoming"].sort(key=lambda x: (x.get("date", ""), x.get("time_start", x.get("time", "00:00"))))
    
    return result

# ==================== TEAM ENDPOINTS (ADMIN) ====================

@api_router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può creare squadre")
    
    # Helper function to parse date in multiple formats
    def parse_date(date_str: str) -> datetime:
        # Try DD/MM/YYYY format first
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                return datetime(int(parts[2]), int(parts[1]), int(parts[0]))
        # Try ISO format (YYYY-MM-DD)
        return datetime.fromisoformat(date_str)
    
    team = Team(
        name=team_data.name,
        description=team_data.description,
        created_by_admin_id=current_user["id"],
        total_amount=team_data.total_amount,
        installment_1_amount=team_data.installment_1_amount,
        installment_2_amount=team_data.installment_2_amount,
        installment_2_due_date=parse_date(team_data.installment_2_due_date),
        installment_3_amount=team_data.installment_3_amount,
        installment_3_due_date=parse_date(team_data.installment_3_due_date),
        bank_info=team_data.bank_info,
        paypal_email=team_data.paypal_email,
        venue=team_data.venue if team_data.venue else None,
        training_schedule=team_data.training_schedule if team_data.training_schedule else None,
        training_sessions=team_data.training_sessions if team_data.training_sessions else [],
        match_day=team_data.match_day if team_data.match_day else None,
        championships=team_data.championships if team_data.championships else None,
        calendar_link=team_data.calendar_link if team_data.calendar_link else None
    )
    
    await db.teams.insert_one(team.dict())
    return team

@api_router.get("/teams", response_model=List[Team])
async def get_teams(current_user = Depends(get_current_user)):
    teams = await db.teams.find().to_list(1000)
    clean_mongo_docs(teams)
    return [Team(**team) for team in teams]

@api_router.get("/teams/{team_id}", response_model=None)
async def get_team(team_id: str, current_user = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    clean_mongo_doc(team)
    
    # Find coaches assigned to this team
    coaches = await db.users.find({
        "role": "coach",
        "assigned_teams": team_id
    }).to_list(10)
    
    print(f"DEBUG: Found {len(coaches)} coaches for team {team_id}")
    
    coach_info = []
    for coach in coaches:
        coach_info.append({
            "id": coach.get("id"),
            "full_name": coach.get("full_name", ""),
            "email": coach.get("email", ""),
            "phone": coach.get("phone", ""),
            "profile_photo": coach.get("profile_photo", ""),
            "profile_photo_artistic": coach.get("profile_photo_artistic", ""),
        })
    
    # Get assigned dirigenti for this team
    dirigenti = await db.users.find({
        "role": {"$in": ["admin", "viewer"]},
        "assigned_teams": team_id
    }).to_list(10)
    
    print(f"DEBUG: Found {len(dirigenti)} dirigenti for team {team_id}")
    
    dirigenti_info = []
    for dirigente in dirigenti:
        dirigenti_info.append({
            "id": dirigente.get("id"),
            "full_name": dirigente.get("full_name", ""),
            "email": dirigente.get("email", ""),
            "phone": dirigente.get("phone", ""),
            "profile_photo": dirigente.get("profile_photo", ""),
            "profile_photo_artistic": dirigente.get("profile_photo_artistic", ""),
            "qualification": dirigente.get("qualification", ""),
        })
    
    team_obj = Team(**team)
    # Add coach_info and dirigenti_info as extra fields
    team_dict = team_obj.dict()
    team_dict["coach_info"] = coach_info
    team_dict["dirigenti_info"] = dirigenti_info
    
    return team_dict

@api_router.patch("/teams/{team_id}", response_model=Team)
async def update_team(team_id: str, team_data: TeamUpdate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare squadre")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    update_dict = {}
    # Campi che possono essere esplicitamente settati a null
    nullable_fields = {'rifinitura', 'description', 'championships', 'calendar_link', 'bank_info', 'paypal_email', 
                       'installment_2_due_date', 'installment_3_due_date'}
    
    for key, value in team_data.dict(exclude_unset=True).items():
        # Permetti di salvare None per i campi nullable
        if value is None and key in nullable_fields:
            update_dict[key] = None
        elif value is not None:
            if "due_date" in key and isinstance(value, str):
                # Parse date in various formats
                try:
                    # Try ISO format first
                    update_dict[key] = datetime.fromisoformat(value)
                except ValueError:
                    # Try DD/MM/YYYY format
                    try:
                        parts = value.split('/')
                        if len(parts) == 3:
                            update_dict[key] = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                        else:
                            raise ValueError("Invalid date format")
                    except:
                        # Skip invalid dates
                        pass
            else:
                update_dict[key] = value
    
    if update_dict:
        await db.teams.update_one({"id": team_id}, {"$set": update_dict})
        team.update(update_dict)
    
    clean_mongo_doc(team)
    return Team(**team)

@api_router.post("/teams/{team_id}/assign-coaches")
async def assign_coaches_to_team(team_id: str, request: AssignmentRequest, current_user = Depends(get_current_user)):
    """Assign coaches to a team - updates coach.assigned_teams field"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può assegnare coach")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    coach_ids = request.ids
    
    # First, remove this team from all coaches who had it assigned
    await db.users.update_many(
        {"role": "coach", "assigned_teams": team_id},
        {"$pull": {"assigned_teams": team_id}}
    )
    
    # Then, add this team to the selected coaches
    if coach_ids:
        await db.users.update_many(
            {"id": {"$in": coach_ids}, "role": "coach"},
            {"$addToSet": {"assigned_teams": team_id}}
        )
    
    return {"success": True, "message": f"Coach assegnati alla squadra {team.get('name')}"}

@api_router.post("/teams/{team_id}/assign-dirigenti")
async def assign_dirigenti_to_team(team_id: str, request: AssignmentRequest, current_user = Depends(get_current_user)):
    """Assign dirigenti to a team - updates dirigente.assigned_teams field"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può assegnare dirigenti")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    dirigente_ids = request.ids
    
    # First, remove this team from all dirigenti who had it assigned
    await db.users.update_many(
        {"role": {"$in": [UserRole.ADMIN, UserRole.VIEWER]}, "assigned_teams": team_id},
        {"$pull": {"assigned_teams": team_id}}
    )
    
    # Then, add this team to the selected dirigenti
    if dirigente_ids:
        await db.users.update_many(
            {"id": {"$in": dirigente_ids}, "role": {"$in": [UserRole.ADMIN, UserRole.VIEWER]}},
            {"$addToSet": {"assigned_teams": team_id}}
        )
    
    return {"success": True, "message": f"Dirigenti assegnati alla squadra {team.get('name')}"}

@api_router.get("/teams/{team_id}/payment-info")
async def get_team_payment_info(team_id: str, current_user = Depends(get_current_user)):
    """Get payment information for a specific team"""
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    clean_mongo_doc(team)
    
    return {
        "total_amount": team.get("total_amount", 0),
        "installment_1_amount": team.get("installment_1_amount", 0),
        "installment_2_amount": team.get("installment_2_amount", 0),
        "installment_2_due_date": team.get("installment_2_due_date"),
        "installment_3_amount": team.get("installment_3_amount", 0),
        "installment_3_due_date": team.get("installment_3_due_date"),
        "bank_info": team.get("bank_info", ""),
        "paypal_email": team.get("paypal_email", "")
    }

@api_router.get("/teams/{team_id}/athletes-count")
async def get_team_athletes_count(team_id: str, current_user = Depends(get_current_user)):
    """Get the count of athletes in a team"""
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    count = await db.athletes.count_documents({"team_id": team_id})
    return {"count": count}

@api_router.get("/teams/{team_id}/athletes")
async def get_team_athletes(team_id: str, current_user = Depends(get_current_user)):
    """Get all athletes in a team - accessible by admin, coach, and viewer (dirigente)"""
    # Allow admin, coach, and viewer to see athletes
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH, UserRole.VIEWER]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    athletes = await db.athletes.find({"team_id": team_id}).to_list(1000)
    
    result = []
    for athlete in athletes:
        result.append({
            "id": athlete["id"],
            "full_name": athlete["full_name"],
            "first_name": athlete.get("first_name"),
            "last_name": athlete.get("last_name"),
            "team_id": athlete["team_id"],
            "status": athlete.get("status", "active"),
            "medical_certificate_expiry": athlete.get("medical_certificate_expiry"),
            "is_withdrawn": athlete.get("is_withdrawn", False),
            "withdrawal_reason": athlete.get("withdrawal_reason"),
        })
    
    return result

@api_router.get("/teams/athletes-count/all")
async def get_all_teams_athletes_count(current_user = Depends(get_current_user)):
    """Get the count of athletes for all teams - OPTIMIZED with aggregation"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere queste statistiche")
    
    # Use aggregation pipeline instead of N+1 queries
    pipeline = [
        {"$group": {"_id": "$team_id", "count": {"$sum": 1}}}
    ]
    counts = await db.athletes.aggregate(pipeline).to_list(1000)
    result = {item["_id"]: item["count"] for item in counts if item["_id"]}
    
    # Also include teams with 0 athletes
    teams = await db.teams.find().to_list(1000)
    for team in teams:
        if team["id"] not in result:
            result[team["id"]] = 0
    
    return result

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user = Depends(get_current_user)):
    """Delete a team (only if empty)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare squadre")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    # Check if team has athletes
    athletes_count = await db.athletes.count_documents({"team_id": team_id})
    if athletes_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossibile eliminare la squadra: ci sono {athletes_count} atleti iscritti. Trasferire o eliminare gli atleti prima."
        )
    
    # Delete the team
    await db.teams.delete_one({"id": team_id})
    
    return {"message": "Squadra eliminata con successo"}

# ==================== ATHLETE ENDPOINTS ====================

@api_router.get("/athletes")
async def get_all_athletes(current_user = Depends(get_current_user)):
    """Get all athletes - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere tutti gli atleti")
    
    athletes = await db.athletes.find({}).to_list(5000)
    
    # Enrich with team names
    team_ids = list(set([a.get("team_id") for a in athletes if a.get("team_id")]))
    teams = await db.teams.find({"id": {"$in": team_ids}}).to_list(100)
    team_names = {t["id"]: t["name"] for t in teams}
    
    # Get payment settings for calculating residuals
    settings = await db.payment_settings.find_one()
    base_fee = settings.get("annual_fee", 0) if settings else 0
    
    # Get all payments for all athletes at once for efficiency
    athlete_ids = [a["id"] for a in athletes]
    all_payments = await db.payments.find({"athlete_id": {"$in": athlete_ids}, "paid": True}).to_list(10000)
    payments_by_athlete = {}
    for p in all_payments:
        aid = p["athlete_id"]
        if aid not in payments_by_athlete:
            payments_by_athlete[aid] = []
        payments_by_athlete[aid].append(p)
    
    result = []
    for a in athletes:
        # Build full_name from last_name + first_name if available
        full_name = a.get("full_name", "")
        if a.get("last_name") or a.get("first_name"):
            full_name = f"{a.get('last_name', '')} {a.get('first_name', '')}".strip()
        
        # Calculate payment residual
        athlete_payments = payments_by_athlete.get(a["id"], [])
        total_paid = sum(p.get("amount", 0) for p in athlete_payments)
        
        # Get team-specific total_amount (same as athlete detail page)
        team_id = a.get("team_id")
        team_total = 0
        if team_id:
            team = next((t for t in teams if t["id"] == team_id), None)
            if team:
                team_total = team.get("total_amount", 0) or 0
        
        # Apply discount_amount (not percentage) - same as athlete detail page
        discount = a.get("discount_amount", 0) or 0
        total_due = team_total - discount
        residual = total_due - total_paid
        
        result.append({
            "id": a["id"],
            "full_name": full_name,
            "first_name": a.get("first_name", ""),
            "last_name": a.get("last_name", ""),
            "team_id": a.get("team_id"),
            "team_name": team_names.get(a.get("team_id"), ""),
            "parent_id": a.get("parent_id"),
            "status": a.get("status", "pending"),
            "date_of_birth": a.get("date_of_birth"),
            # Additional fields for advanced search
            "postal_code": a.get("postal_code"),
            "athlete_role": a.get("athlete_role"),
            "athlete_height": a.get("athlete_height"),
            "athlete_weight": a.get("athlete_weight"),
            "athlete_elevation": a.get("athlete_elevation"),
            "athlete_notes": a.get("athlete_notes"),
            "city": a.get("city"),
            # Payment info
            "payment_residual": residual,
            "has_overpayment": residual < 0,
        })
    
    return result

@api_router.post("/athletes", response_model=Athlete)
async def create_athlete(athlete_data: AthleteCreate, current_user = Depends(get_current_user)):
    # Only parents can create athletes
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo genitori possono registrare atleti")
    
    # Check if team exists
    team = await db.teams.find_one({"id": athlete_data.team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    # Calculate if minor
    dob = datetime.fromisoformat(athlete_data.date_of_birth)
    age = (datetime.utcnow() - dob).days // 365
    is_minor = age < 18
    
    # Create athlete
    athlete_id = str(ObjectId())
    qr_code = generate_qr_code(athlete_id)
    
    # All athletes start as PENDING and need Admin approval
    # is_trial is preserved to know what status to set after approval
    is_trial = getattr(athlete_data, 'is_trial', True)
    privacy_accepted = getattr(athlete_data, 'privacy_accepted', False)
    
    # Hash data password if provided (for minors - protects sensitive data)
    data_password_hash = None
    if athlete_data.data_password and is_minor:
        data_password_hash=hash_password(athlete_data.data_password)
    
    # Get society_id from the user's parent
    parent_user = await db.users.find_one({"id": current_user["id"]})
    society_id = parent_user.get("society_id") if parent_user else None
    
    # Generate unique athlete code
    athlete_code = await generate_unique_athlete_code(
        athlete_data.last_name,
        athlete_data.first_name,
        team.get("name", "") if team else "",
        society_id
    )
    
    athlete = Athlete(
        id=athlete_id,
        parent_id=current_user["id"],
        society_id=society_id,
        athlete_code=athlete_code,
        full_name=athlete_data.full_name,
        first_name=athlete_data.first_name,
        last_name=athlete_data.last_name,
        date_of_birth=dob,
        is_minor=is_minor,
        fiscal_code=athlete_data.fiscal_code,
        email=athlete_data.email,
        address=athlete_data.address,
        city=athlete_data.city,
        postal_code=athlete_data.postal_code,
        province=athlete_data.province,
        phone_athlete=athlete_data.phone_athlete,
        phone_father=athlete_data.phone_father,
        phone_mother=athlete_data.phone_mother,
        tax_payer_name=athlete_data.tax_payer_name,
        tax_payer_last_name=athlete_data.tax_payer_last_name,
        tax_payer_first_name=athlete_data.tax_payer_first_name,
        tax_payer_fiscal_code=athlete_data.tax_payer_fiscal_code,
        team_id=athlete_data.team_id,
        team_id_2=athlete_data.team_id_2,
        qr_code=qr_code,
        trial_end_date=datetime.utcnow() + timedelta(days=7) if is_trial else datetime.utcnow(),
        status=AthleteStatus.PENDING,  # ALL athletes start as PENDING
        privacy_accepted=privacy_accepted,
        privacy_accepted_date=datetime.utcnow() if privacy_accepted else None,
        data_password_hash=data_password_hash,
    )
    
    await db.athletes.insert_one(athlete.dict())
    
    # Payment records are created when admin approves the athlete
    # This ensures payments are only created for approved athletes
    
    return athlete

# Endpoint per registrare atleti maggiorenni (solo Admin)
class AdultAthleteCreate(BaseModel):
    first_name: str
    last_name: str
    fiscal_code: Optional[str] = None
    date_of_birth: str  # YYYY-MM-DD
    email: Optional[str] = None
    phone: Optional[str] = None
    team_id: str
    athlete_type: str = "quota"  # "quota" o "compensated"

@api_router.post("/athletes/adult")
async def create_adult_athlete(data: AdultAthleteCreate, current_user = Depends(get_current_user)):
    """Registra un atleta maggiorenne direttamente dall'admin"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin possono registrare atleti maggiorenni")
    
    # Check if team exists
    team = await db.teams.find_one({"id": data.team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    # Verify athlete is adult (18+)
    dob = datetime.fromisoformat(data.date_of_birth)
    age = (datetime.utcnow() - dob).days // 365
    if age < 18:
        raise HTTPException(status_code=400, detail="L'atleta deve essere maggiorenne (18+ anni)")
    
    # Get admin's society_id
    admin_user = await db.users.find_one({"id": current_user["id"]})
    society_id = admin_user.get("society_id") if admin_user else None
    
    # Generate unique athlete code
    athlete_code = await generate_unique_athlete_code(
        data.last_name,
        data.first_name,
        team.get("name", "") if team else "",
        society_id
    )
    
    # Create athlete
    athlete_id = str(ObjectId())
    qr_code = generate_qr_code(athlete_id)
    
    full_name = f"{data.first_name} {data.last_name}"
    
    athlete_dict = {
        "id": athlete_id,
        "parent_id": None,  # No parent for adult athletes
        "society_id": society_id,
        "athlete_code": athlete_code,
        "full_name": full_name,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "date_of_birth": dob,
        "is_minor": False,
        "fiscal_code": data.fiscal_code,
        "email": data.email,
        "phone_athlete": data.phone,
        "team_id": data.team_id,
        "qr_code": qr_code,
        "status": "active",  # Adult athletes are immediately active
        "athlete_type": data.athlete_type,  # "quota" or "compensated"
        "parents_detached": True,  # No parents for adult athletes
        "created_at": datetime.utcnow(),
        "privacy_accepted": True,  # Adult handles their own privacy
        "privacy_accepted_date": datetime.utcnow(),
    }
    
    await db.athletes.insert_one(athlete_dict)
    
    # If athlete pays quota, create payment records
    if data.athlete_type == "quota":
        # Get team payment settings
        if team.get("total_amount", 0) > 0:
            # Use new installments format if available
            installments = team.get("installments", [])
            if installments:
                for i, inst in enumerate(installments):
                    payment = {
                        "id": str(ObjectId()),
                        "athlete_id": athlete_id,
                        "society_id": society_id,
                        "installment_number": i + 1,
                        "installment_name": inst.get("name", f"Rata {i + 1}"),
                        "amount": inst.get("amount", 0),
                        "due_date": inst.get("due_date"),
                        "paid": False,
                        "paid_date": None,
                        "created_at": datetime.utcnow(),
                    }
                    await db.payments.insert_one(payment)
    
    clean_mongo_doc(athlete_dict)
    return {"message": "Atleta registrato con successo", "athlete_id": athlete_id, "athlete_code": athlete_code}

@api_router.get("/athletes/my", response_model=List[Athlete])
async def get_my_athletes(current_user = Depends(get_current_user)):
    if current_user["role"] == UserRole.PARENT:
        # Include both primary and second parent
        athletes = await db.athletes.find({
            "$or": [
                {"parent_id": current_user["id"]},
                {"second_parent_id": current_user["id"]}
            ]
        }).to_list(1000)
    elif current_user["role"] in [UserRole.ADMIN, UserRole.COACH]:
        athletes = await db.athletes.find().to_list(1000)
    else:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    clean_mongo_docs(athletes)
    return [Athlete(**athlete) for athlete in athletes]

# Athlete Compensation endpoints
@api_router.get("/athletes/{athlete_id}/compensation")
async def get_athlete_compensation(athlete_id: str, current_user = Depends(get_current_user)):
    """Get compensation settings for an athlete"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i compensi")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check if athlete is compensated type
    if athlete.get("athlete_type") != "compensated":
        raise HTTPException(status_code=400, detail="Questo atleta non è di tipo 'compensato'")
    
    comp = await db.athlete_compensations.find_one({"athlete_id": athlete_id})
    if not comp:
        return None
    
    clean_mongo_doc(comp)
    return comp

@api_router.post("/athletes/{athlete_id}/compensation")
async def set_athlete_compensation(athlete_id: str, data: dict, current_user = Depends(get_current_user)):
    """Set or update compensation for an athlete"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può impostare i compensi")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Ensure athlete is marked as compensated
    if athlete.get("athlete_type") != "compensated":
        await db.athletes.update_one(
            {"id": athlete_id},
            {"$set": {"athlete_type": "compensated"}}
        )
    
    monthly_amount = data.get("monthly_amount", 0)
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    
    # Parse dates if provided
    if start_date and isinstance(start_date, str):
        try:
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        except:
            start_date = None
    
    if end_date and isinstance(end_date, str):
        try:
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            end_date = None
    
    comp_data = {
        "athlete_id": athlete_id,
        "society_id": athlete.get("society_id"),
        "monthly_amount": monthly_amount,
        "start_date": start_date,
        "end_date": end_date,
        "updated_at": datetime.utcnow(),
    }
    
    # Upsert compensation
    result = await db.athlete_compensations.update_one(
        {"athlete_id": athlete_id},
        {"$set": comp_data},
        upsert=True
    )
    
    return {"message": "Compenso aggiornato con successo"}

@api_router.patch("/athletes/{athlete_id}/compensation/settings")
async def update_athlete_compensation_settings(athlete_id: str, data: dict, current_user = Depends(get_current_user)):
    """Update full compensation settings for an athlete (like coaches)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare i compensi")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    update_data = {}
    
    # Monthly compensation
    if "monthly_compensation" in data:
        update_data["monthly_compensation"] = data["monthly_compensation"]
    
    # Other annual compensation (prior)
    if "other_annual_compensation" in data:
        update_data["other_annual_compensation"] = data["other_annual_compensation"]
    
    if "prior_compensation" in data:
        update_data["prior_compensation"] = data["prior_compensation"]
    
    # Contract dates
    if "contract_start_date" in data:
        val = data["contract_start_date"]
        if val and isinstance(val, str):
            try:
                update_data["contract_start_date"] = datetime.fromisoformat(val.replace('Z', '+00:00')).isoformat()
            except:
                update_data["contract_start_date"] = val
        else:
            update_data["contract_start_date"] = val
    
    if "contract_end_date" in data:
        val = data["contract_end_date"]
        if val and isinstance(val, str):
            try:
                update_data["contract_end_date"] = datetime.fromisoformat(val.replace('Z', '+00:00')).isoformat()
            except:
                update_data["contract_end_date"] = val
        else:
            update_data["contract_end_date"] = val
    
    # Bank info
    if "iban" in data:
        update_data["iban"] = data["iban"]
    if "iban_holder" in data:
        update_data["iban_holder"] = data["iban_holder"]
    if "bank_name" in data:
        update_data["bank_name"] = data["bank_name"]
    
    if update_data:
        await db.athletes.update_one({"id": athlete_id}, {"$set": update_data})
    
    return {"message": "Impostazioni compenso aggiornate"}

@api_router.get("/athletes/{athlete_id}/compensation/receipts")
async def get_athlete_compensation_receipts(athlete_id: str, current_user = Depends(get_current_user)):
    """Get signed receipts for an athlete"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le quietanze")
    
    receipts = await db.athlete_compensation_receipts.find({"athlete_id": athlete_id}).to_list(100)
    clean_mongo_docs(receipts)
    return receipts

@api_router.post("/athletes/{athlete_id}/compensation/receipt")
async def sign_athlete_compensation_receipt(athlete_id: str, data: dict, current_user = Depends(get_current_user)):
    """Sign or unsign a monthly receipt for an athlete"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può firmare le quietanze")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    month = data.get("month")
    year = data.get("year")
    signed = data.get("signed", True)
    
    if not month or not year:
        raise HTTPException(status_code=400, detail="Mese e anno sono obbligatori")
    
    receipt_data = {
        "athlete_id": athlete_id,
        "society_id": athlete.get("society_id"),
        "month": month,
        "year": year,
        "signed": signed,
        "signed_date": datetime.utcnow() if signed else None,
        "amount": athlete.get("monthly_compensation", 0),
        "updated_at": datetime.utcnow(),
    }
    
    # Upsert receipt
    await db.athlete_compensation_receipts.update_one(
        {"athlete_id": athlete_id, "month": month, "year": year},
        {"$set": receipt_data},
        upsert=True
    )
    
    return {"message": "Quietanza aggiornata"}

@api_router.get("/athletes/{athlete_id}/team")
async def get_athlete_team(athlete_id: str, current_user = Depends(get_current_user)):
    """Get the team for an athlete"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    team = await db.teams.find_one({"id": athlete.get("team_id")})
    if not team:
        return None
    
    clean_mongo_doc(team)
    return team

@api_router.get("/athletes/pending")
async def get_pending_athletes(current_user = Depends(get_current_user)):
    """Get all athletes pending approval - admin only - OPTIMIZED"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere gli atleti in attesa")
    
    pending = await db.athletes.find({"status": AthleteStatus.PENDING}).to_list(1000)
    
    # Batch fetch teams and users to avoid N+1 queries
    teams_list = await db.teams.find().to_list(1000)
    teams_dict = {t["id"]: t for t in teams_list}
    
    users_list = await db.users.find().to_list(1000)
    users_dict = {u["id"]: u for u in users_list}
    
    result = []
    for athlete in pending:
        team = teams_dict.get(athlete["team_id"])
        parent = users_dict.get(athlete["parent_id"])
        result.append({
            "id": athlete["id"],
            "full_name": athlete["full_name"],
            "first_name": athlete.get("first_name"),
            "last_name": athlete.get("last_name"),
            "date_of_birth": athlete.get("date_of_birth"),
            "fiscal_code": athlete.get("fiscal_code"),
            "team_id": athlete["team_id"],
            "team_name": team["name"] if team else "Sconosciuta",
            "parent_name": parent["full_name"] if parent else "Sconosciuto",
            "parent_email": parent["email"] if parent else "",
            "registration_date": athlete.get("registration_date"),
            "status": athlete.get("status", "pending"),
        })
    
    return result

class AthleteApprovalUpdate(BaseModel):
    status: str  # trial, active, rejected

@api_router.patch("/athletes/{athlete_id}/approval")
async def update_athlete_approval(athlete_id: str, data: AthleteApprovalUpdate, current_user = Depends(get_current_user)):
    """Approve or reject an athlete - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può approvare atleti")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Validate status
    if data.status not in [AthleteStatus.TRIAL, AthleteStatus.ACTIVE, "rejected"]:
        raise HTTPException(status_code=400, detail="Stato non valido. Usa: trial, active, rejected")
    
    update_data = {
        "status": data.status,
        "approved_at": datetime.utcnow(),
        "approved_by": current_user["id"]
    }
    
    # If approving to trial, set trial end date from now
    if data.status == AthleteStatus.TRIAL:
        update_data["trial_end_date"] = datetime.utcnow() + timedelta(days=7)
    
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": update_data}
    )
    
    # AUTO-APPROVE PARENT: When approving an athlete, also approve their parent
    if data.status in [AthleteStatus.TRIAL, AthleteStatus.ACTIVE]:
        parent_id = athlete.get("parent_id")
        if parent_id:
            parent = await db.users.find_one({"id": parent_id})
            if parent and parent.get("status") == UserStatus.PENDING:
                await db.users.update_one(
                    {"id": parent_id},
                    {"$set": {
                        "status": UserStatus.APPROVED,
                        "approved_at": datetime.utcnow(),
                        "approved_by": current_user["id"]
                    }}
                )
    
    # If approving, create payment records
    if data.status in [AthleteStatus.TRIAL, AthleteStatus.ACTIVE]:
        # Check if payments already exist
        existing_payments = await db.payments.count_documents({"athlete_id": athlete_id})
        if existing_payments == 0:
            team = await db.teams.find_one({"id": athlete["team_id"]})
            if team and team.get("installment_1_amount", 0) > 0:
                trial_end = update_data.get("trial_end_date", datetime.utcnow())
                # Installment 1 - Rata Iscrizione
                payment1 = Payment(
                    athlete_id=athlete_id,
                    installment_number=1,
                    description="Rata Iscrizione",
                    amount=team["installment_1_amount"],
                    due_date=trial_end,
                    paid=False
                )
                await db.payments.insert_one(payment1.dict())
                
                # Installment 2 - Prima Rata
                if team.get("installment_2_amount", 0) > 0:
                    due_date_2 = team.get("installment_2_due_date") or datetime.utcnow()
                    payment2 = Payment(
                        athlete_id=athlete_id,
                        installment_number=2,
                        description="1ª Rata",
                        amount=team["installment_2_amount"],
                        due_date=due_date_2,
                        paid=False
                    )
                    await db.payments.insert_one(payment2.dict())
                
                # Installment 3 - Seconda Rata
                if team.get("installment_3_amount", 0) > 0:
                    due_date_3 = team.get("installment_3_due_date") or datetime.utcnow()
                    payment3 = Payment(
                        athlete_id=athlete_id,
                        installment_number=3,
                        description="2ª Rata",
                        amount=team["installment_3_amount"],
                        due_date=due_date_3,
                        paid=False
                    )
                    await db.payments.insert_one(payment3.dict())
    
    status_text = {
        AthleteStatus.TRIAL: "approvato (periodo di prova)",
        AthleteStatus.ACTIVE: "approvato (attivo)",
        "rejected": "rifiutato"
    }
    
    return {"message": f"Atleta {status_text.get(data.status, data.status)} con successo"}

@api_router.get("/athletes/deletion-requests")
async def get_deletion_requests(current_user = Depends(get_current_user)):
    """Get all athletes with deletion requests - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere le richieste di cancellazione")
    
    requests = await db.athletes.find({"deletion_requested": True}).to_list(1000)
    
    # Batch fetch related data
    teams_list = await db.teams.find().to_list(1000)
    teams_dict = {t["id"]: t for t in teams_list}
    users_list = await db.users.find().to_list(1000)
    users_dict = {u["id"]: u for u in users_list}
    
    result = []
    for athlete in requests:
        team = teams_dict.get(athlete.get("team_id"))
        parent = users_dict.get(athlete.get("parent_id"))
        requested_by = users_dict.get(athlete.get("deletion_requested_by"))
        result.append({
            "id": athlete["id"],
            "full_name": athlete["full_name"],
            "team_name": team["name"] if team else "Sconosciuta",
            "parent_name": parent["full_name"] if parent else "Sconosciuto",
            "parent_email": parent["email"] if parent else "",
            "requested_at": athlete.get("deletion_requested_at"),
            "requested_by_name": requested_by["full_name"] if requested_by else "Sconosciuto",
        })
    
    return result

@api_router.get("/athletes/{athlete_id}", response_model=Athlete)
async def get_athlete(athlete_id: str, current_user = Depends(get_current_user)):
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions - allow primary and second parent
    if current_user["role"] == UserRole.PARENT:
        is_primary_parent = athlete.get("parent_id") == current_user["id"]
        is_second_parent = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary_parent and not is_second_parent:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # For compensated athletes, sync compensation data from separate collection if needed
    if athlete.get("athlete_type") == "compensated":
        # Check if compensation fields are missing but exist in separate collection
        if not athlete.get("monthly_compensation") or not athlete.get("contract_start_date"):
            comp = await db.athlete_compensations.find_one({"athlete_id": athlete_id})
            if comp:
                # Sync data to athlete document and response
                sync_data = {}
                if comp.get("monthly_amount") and not athlete.get("monthly_compensation"):
                    sync_data["monthly_compensation"] = comp["monthly_amount"]
                    athlete["monthly_compensation"] = comp["monthly_amount"]
                if comp.get("start_date"):
                    start_date = comp["start_date"]
                    if isinstance(start_date, datetime):
                        start_date = start_date.strftime("%Y-%m-%d")
                    if not athlete.get("contract_start_date"):
                        sync_data["contract_start_date"] = start_date
                        athlete["contract_start_date"] = start_date
                if comp.get("end_date"):
                    end_date = comp["end_date"]
                    if isinstance(end_date, datetime):
                        end_date = end_date.strftime("%Y-%m-%d")
                    if not athlete.get("contract_end_date"):
                        sync_data["contract_end_date"] = end_date
                        athlete["contract_end_date"] = end_date
                
                # Persist sync to database
                if sync_data:
                    await db.athletes.update_one({"id": athlete_id}, {"$set": sync_data})
    
    return Athlete(**athlete)

@api_router.get("/athletes/{athlete_id}/technical-data")
async def get_athlete_technical_data(athlete_id: str, current_user = Depends(get_current_user)):
    """Get only technical data of an athlete - accessible by coach, admin, and parent"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Get certificate info
    certificate = await db.certificates.find_one({"athlete_id": athlete_id})
    cert_status = None
    cert_expiry = None
    if certificate:
        cert_expiry = certificate.get("expiry_date")
        if cert_expiry:
            expiry_date = datetime.fromisoformat(cert_expiry.replace('Z', '+00:00')) if isinstance(cert_expiry, str) else cert_expiry
            if expiry_date < datetime.now(expiry_date.tzinfo) if expiry_date.tzinfo else datetime.utcnow():
                cert_status = "expired"
            elif expiry_date < (datetime.now(expiry_date.tzinfo) if expiry_date.tzinfo else datetime.utcnow()) + timedelta(days=30):
                cert_status = "expiring_soon"
            else:
                cert_status = "valid"
    
    # Get parent contact info for emergencies
    parent = await db.users.find_one({"id": athlete.get("parent_id")})
    parent_phone = parent.get("phone") if parent else None
    parent_name = parent.get("full_name") if parent else None
    
    # Also get emergency phone from athlete record
    emergency_phone = athlete.get("emergency_phone")
    
    # Return technical data + certificate status + emergency contacts
    return {
        "id": athlete["id"],
        "full_name": athlete.get("full_name"),
        "first_name": athlete.get("first_name"),
        "last_name": athlete.get("last_name"),
        "date_of_birth": athlete.get("date_of_birth"),  # For age calculation only
        "team_id": athlete.get("team_id"),
        "team_id_2": athlete.get("team_id_2"),
        # Athlete code
        "athlete_code": athlete.get("athlete_code"),
        # Technical data
        "athlete_photo": athlete.get("athlete_photo"),
        "athlete_photo_artistic": athlete.get("athlete_photo_artistic"),
        "athlete_role": athlete.get("athlete_role"),
        "athlete_height": athlete.get("athlete_height"),
        "athlete_weight": athlete.get("athlete_weight"),
        "athlete_elevation": athlete.get("athlete_elevation"),
        "athlete_notes": athlete.get("athlete_notes"),
        "athlete_characteristics": athlete.get("athlete_characteristics", []),
        "second_parent_email": athlete.get("second_parent_email"),
        # Certificate info (visible to all)
        "certificate_status": cert_status,
        "certificate_expiry": cert_expiry,
        # Emergency contacts (visible to coach for emergencies)
        "parent_name": parent_name,
        "parent_phone": parent_phone,
        "emergency_phone": emergency_phone,
    }

@api_router.patch("/athletes/{athlete_id}/technical-data")
async def update_athlete_technical_data(athlete_id: str, data: dict, current_user = Depends(get_current_user)):
    """Update only technical data of an athlete - accessible by coach and admin"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH]:
        raise HTTPException(status_code=403, detail="Solo admin e coach possono modificare i dati tecnici")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Only allow updating technical fields
    allowed_fields = ["athlete_photo", "athlete_photo_artistic", "athlete_role", 
                      "athlete_height", "athlete_weight", "athlete_elevation", 
                      "athlete_notes", "athlete_characteristics"]
    
    update_dict = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_dict:
        await db.athletes.update_one(
            {"id": athlete_id},
            {"$set": update_dict}
        )
    
    return {"message": "Dati tecnici aggiornati con successo"}

@api_router.patch("/athletes/{athlete_id}", response_model=Athlete)
async def update_athlete(athlete_id: str, update_data: AthleteUpdate, current_user = Depends(get_current_user)):
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions - allow primary and second parent
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    update_dict = {}
    
    # Campi testuali
    # Tesseramento (solo admin)
    if update_data.federal_code is not None:
        update_dict["federal_code"] = update_data.federal_code
    if update_data.is_registered is not None:
        update_dict["is_registered"] = update_data.is_registered
    # Anagrafica
    if update_data.full_name is not None:
        update_dict["full_name"] = update_data.full_name
    if update_data.first_name is not None:
        update_dict["first_name"] = update_data.first_name
    if update_data.last_name is not None:
        update_dict["last_name"] = update_data.last_name
    if update_data.date_of_birth is not None:
        try:
            update_dict["date_of_birth"] = datetime.fromisoformat(update_data.date_of_birth)
        except:
            pass
    if update_data.birth_place is not None:
        update_dict["birth_place"] = update_data.birth_place
    if update_data.birth_province is not None:
        update_dict["birth_province"] = update_data.birth_province
    if update_data.fiscal_code is not None:
        update_dict["fiscal_code"] = update_data.fiscal_code
    if update_data.email is not None:
        update_dict["email"] = update_data.email
    if update_data.phone_athlete is not None:
        update_dict["phone_athlete"] = update_data.phone_athlete
    if update_data.phone_father is not None:
        update_dict["phone_father"] = update_data.phone_father
    if update_data.phone_mother is not None:
        update_dict["phone_mother"] = update_data.phone_mother
    if update_data.address is not None:
        update_dict["address"] = update_data.address
    if update_data.postal_code is not None:
        update_dict["postal_code"] = update_data.postal_code
    if update_data.city is not None:
        update_dict["city"] = update_data.city
    if update_data.province is not None:
        update_dict["province"] = update_data.province
    if update_data.tax_payer_name is not None:
        update_dict["tax_payer_name"] = update_data.tax_payer_name
    if update_data.tax_payer_last_name is not None:
        update_dict["tax_payer_last_name"] = update_data.tax_payer_last_name
    if update_data.tax_payer_first_name is not None:
        update_dict["tax_payer_first_name"] = update_data.tax_payer_first_name
    if update_data.tax_payer_fiscal_code is not None:
        update_dict["tax_payer_fiscal_code"] = update_data.tax_payer_fiscal_code
    if update_data.team_id is not None:
        # Verify team exists
        team = await db.teams.find_one({"id": update_data.team_id})
        if team:
            update_dict["team_id"] = update_data.team_id
            # Auto-update athlete code when team changes
            athlete = await db.athletes.find_one({"id": athlete_id})
            if athlete:
                new_code = await generate_unique_athlete_code(
                    athlete.get("last_name", ""),
                    athlete.get("first_name", ""),
                    team.get("name", ""),
                    athlete.get("society_id", ""),
                    athlete_id
                )
                update_dict["athlete_code"] = new_code
    
    # Manual athlete_code override (takes priority over auto-generated)
    if update_data.athlete_code is not None:
        if update_data.athlete_code.strip():
            # Verify uniqueness within society
            athlete = await db.athletes.find_one({"id": athlete_id})
            if athlete:
                existing = await db.athletes.find_one({
                    "athlete_code": update_data.athlete_code.upper().strip(),
                    "society_id": athlete.get("society_id"),
                    "id": {"$ne": athlete_id}
                })
                if existing:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Codice atleta '{update_data.athlete_code}' già in uso da un altro atleta"
                    )
                update_dict["athlete_code"] = update_data.athlete_code.upper().strip()
    
    # Seconda squadra (opzionale)
    if update_data.team_id_2 is not None:
        if update_data.team_id_2 == "":
            # Remove secondary team
            update_dict["team_id_2"] = None
        else:
            # Verify team exists
            team2 = await db.teams.find_one({"id": update_data.team_id_2})
            if team2:
                update_dict["team_id_2"] = update_data.team_id_2
    
    # Sconto
    if update_data.discount_amount is not None:
        update_dict["discount_amount"] = update_data.discount_amount
    if update_data.discount_reason is not None:
        update_dict["discount_reason"] = update_data.discount_reason
    if update_data.discount_note is not None:
        update_dict["discount_note"] = update_data.discount_note
    
    # Dati tecnici atleta (solo admin e coach)
    if current_user["role"] in [UserRole.ADMIN, UserRole.COACH]:
        if update_data.athlete_role is not None:
            update_dict["athlete_role"] = update_data.athlete_role
        if update_data.athlete_height is not None:
            update_dict["athlete_height"] = update_data.athlete_height
        if update_data.athlete_weight is not None:
            update_dict["athlete_weight"] = update_data.athlete_weight
        if update_data.athlete_elevation is not None:
            update_dict["athlete_elevation"] = update_data.athlete_elevation
        if update_data.athlete_notes is not None:
            update_dict["athlete_notes"] = update_data.athlete_notes
        if update_data.second_parent_email is not None:
            new_email = update_data.second_parent_email.lower().strip() if update_data.second_parent_email else None
            update_dict["second_parent_email"] = new_email
            
            # Se c'è un'email, cerca se esiste un utente con questa email e collegalo
            if new_email:
                # Trova l'atleta per ottenere la society_id
                athlete = await db.athletes.find_one({"id": athlete_id})
                if athlete:
                    # Cerca l'utente genitore con questa email nella stessa società
                    second_parent = await db.users.find_one({
                        "email": new_email,
                        "society_id": athlete.get("society_id"),
                        "role": UserRole.PARENT
                    })
                    if second_parent:
                        update_dict["second_parent_id"] = second_parent["id"]
                    else:
                        # Nessun utente trovato, rimuovi l'ID precedente
                        update_dict["second_parent_id"] = None
            else:
                # Email rimossa, rimuovi anche l'ID
                update_dict["second_parent_id"] = None
        if update_data.athlete_photo is not None:
            update_dict["athlete_photo"] = update_data.athlete_photo
        if update_data.athlete_photo_artistic is not None:
            update_dict["athlete_photo_artistic"] = update_data.athlete_photo_artistic
    
    # Campi booleani
    if update_data.privacy_accepted is not None:
        update_dict["privacy_accepted"] = update_data.privacy_accepted
        if update_data.privacy_accepted:
            update_dict["privacy_accepted_date"] = datetime.utcnow()
    
    if update_data.image_consent is not None:
        update_dict["image_consent"] = update_data.image_consent
    
    # Status
    if update_data.status is not None:
        if update_data.status in ["trial", "active", "blocked"]:
            update_dict["status"] = update_data.status
    
    # Ritiro atleta (solo admin)
    if update_data.is_withdrawn is not None and current_user["role"] == UserRole.ADMIN:
        update_dict["is_withdrawn"] = update_data.is_withdrawn
        if update_data.is_withdrawn:
            update_dict["withdrawn_date"] = datetime.utcnow()
            if update_data.withdrawn_reason:
                update_dict["withdrawn_reason"] = update_data.withdrawn_reason
    
    if update_dict:
        await db.athletes.update_one({"id": athlete_id}, {"$set": update_dict})
        athlete.update(update_dict)
    
    return Athlete(**athlete)

# ==================== DATA PASSWORD ENDPOINTS ====================

class VerifyDataPassword(BaseModel):
    password: str

class ChangeDataPassword(BaseModel):
    old_password: Optional[str] = None  # Opzionale solo se non esiste password
    new_password: str

@api_router.post("/athletes/{athlete_id}/verify-password")
async def verify_data_password(athlete_id: str, data: VerifyDataPassword, current_user = Depends(get_current_user)):
    """Verify data password for an athlete - returns True if correct"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions (parent or admin can verify) - allow primary and second parent
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # If no password is set, return special response
    if not athlete.get("data_password_hash"):
        return {"verified": True, "has_password": False}
    
    # Verify password
    is_valid = verify_password(data.password, athlete["data_password_hash"])
    return {"verified": is_valid, "has_password": True}

@api_router.post("/athletes/{athlete_id}/change-password")
async def change_data_password(athlete_id: str, data: ChangeDataPassword, current_user = Depends(get_current_user)):
    """Change or set data password for an athlete (parent only)"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Only parent can change password - allow primary and second parent
    if current_user["role"] != UserRole.PARENT:
        raise HTTPException(status_code=403, detail="Solo il genitore può modificare la password")
    is_primary = athlete.get("parent_id") == current_user["id"]
    is_second = athlete.get("second_parent_id") == current_user["id"]
    if not is_primary and not is_second:
        raise HTTPException(status_code=403, detail="Solo il genitore può modificare la password")
    
    # If password exists, verify old password
    if athlete.get("data_password_hash"):
        if not data.old_password:
            raise HTTPException(status_code=400, detail="Inserisci la password attuale")
        if not verify_password(data.old_password, athlete["data_password_hash"]):
            raise HTTPException(status_code=401, detail="Password attuale non corretta")
    
    # Hash and set new password
    new_hash = hash_password(data.new_password)
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {"data_password_hash": new_hash}}
    )
    
    return {"message": "Password dati aggiornata con successo"}

@api_router.get("/athletes/{athlete_id}/has-password")
async def check_has_password(athlete_id: str, current_user = Depends(get_current_user)):
    """Check if athlete has a data password set"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    return {"has_password": bool(athlete.get("data_password_hash"))}

class AdminResetDataPassword(BaseModel):
    new_password: str

@api_router.patch("/athletes/{athlete_id}/reset-data-password")
async def admin_reset_data_password(athlete_id: str, data: AdminResetDataPassword, current_user = Depends(get_current_user)):
    """Admin can reset an athlete's data password (used to protect minor's data)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può resettare la password dati")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Hash the new password
    password_hash = hash_password(data.new_password)
    
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {"data_password_hash": password_hash}}
    )
    
    return {"message": f"Password dati resettata per {athlete.get('first_name', '')} {athlete.get('last_name', '')}"}

@api_router.post("/athletes/{athlete_id}/transform-photo")
async def transform_athlete_photo(athlete_id: str, data: ImageTransformRequest, current_user = Depends(get_current_user)):
    """Transform athlete photo to artistic style using AI"""
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions - admin, coach, or parent of athlete (primary or second)
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    try:
        # Get API key
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Chiave API non configurata")
        
        # Use OpenAI client for image editing
        if HAS_OPENAI_CLIENT:
            client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://llm.integrations.emergent.sh/v1"
            )
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(data.image_base64)
            
            # Create image edit request - transform to pencil sketch style
            response = await client.images.edit(
                model="gpt-image-1",
                image=image_bytes,
                prompt="Transform into a BLACK AND WHITE PENCIL SKETCH drawing. Remove ALL colors. Only use black, white and gray tones. Add visible pencil strokes and cross-hatching. Make it look hand-drawn on white paper.",
                n=1,
                size="1024x1024"
            )
            
            if response.data and len(response.data) > 0:
                # Get the result - could be base64 or URL
                result = response.data[0]
                if hasattr(result, 'b64_json') and result.b64_json:
                    artistic_base64 = result.b64_json
                elif hasattr(result, 'url') and result.url:
                    # Download from URL and convert to base64
                    import httpx
                    async with httpx.AsyncClient() as http_client:
                        img_response = await http_client.get(result.url)
                        artistic_base64 = base64.b64encode(img_response.content).decode('utf-8')
                else:
                    raise HTTPException(status_code=500, detail="Formato risposta non valido")
                
                # Save both photos to the athlete record
                await db.athletes.update_one(
                    {"id": athlete_id},
                    {"$set": {
                        "athlete_photo": data.image_base64,
                        "athlete_photo_artistic": artistic_base64
                    }}
                )
                
                return {
                    "success": True,
                    "artistic_photo": artistic_base64
                }
            else:
                raise HTTPException(status_code=500, detail="Nessuna immagine generata")
        else:
            # Fallback - save original photo without transformation
            await db.athletes.update_one(
                {"id": athlete_id},
                {"$set": {
                    "athlete_photo": data.image_base64,
                    "athlete_photo_artistic": data.image_base64
                }}
            )
            return {
                "success": True,
                "artistic_photo": data.image_base64,
                "note": "Trasformazione non disponibile, salvata foto originale"
            }
            
    except Exception as e:
        logging.error(f"Error generating artistic photo: {str(e)}")
        # Fallback - save original photo
        await db.athletes.update_one(
            {"id": athlete_id},
            {"$set": {
                "athlete_photo": data.image_base64,
                "athlete_photo_artistic": data.image_base64
            }}
        )
        return {
            "success": True,
            "artistic_photo": data.image_base64,
            "note": f"Errore trasformazione: {str(e)}"
        }

@api_router.post("/athletes/{athlete_id}/request-deletion")
async def request_athlete_deletion(athlete_id: str, current_user = Depends(get_current_user)):
    """Request deletion of an athlete - sends notification to admin"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions - only parent of the athlete can request deletion (primary or second)
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Mark athlete for deletion request
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {
            "deletion_requested": True,
            "deletion_requested_at": datetime.utcnow(),
            "deletion_requested_by": current_user["id"]
        }}
    )
    
    return {"message": "Richiesta di cancellazione inviata"}

@api_router.post("/athletes/{athlete_id}/approve-deletion")
async def approve_athlete_deletion(athlete_id: str, current_user = Depends(get_current_user)):
    """Approve deletion request and delete the athlete - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può approvare le cancellazioni")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Delete all related data
    await db.certificates.delete_many({"athlete_id": athlete_id})
    await db.payments.delete_many({"athlete_id": athlete_id})
    await db.attendances.delete_many({"athlete_id": athlete_id})
    
    # Delete the athlete
    await db.athletes.delete_one({"id": athlete_id})
    
    return {"message": "Atleta eliminato con successo"}

@api_router.post("/athletes/{athlete_id}/reject-deletion")
async def reject_athlete_deletion(athlete_id: str, current_user = Depends(get_current_user)):
    """Reject deletion request - admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può rifiutare le cancellazioni")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Remove deletion request flag
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$unset": {
            "deletion_requested": "",
            "deletion_requested_at": "",
            "deletion_requested_by": ""
        }}
    )
    
    return {"message": "Richiesta di cancellazione rifiutata"}

@api_router.delete("/athletes/{athlete_id}")
async def delete_athlete(athlete_id: str, current_user = Depends(get_current_user)):
    """Delete an athlete and all related data (certificates, payments, attendances)"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions - only parent of the athlete or admin can delete (primary or second)
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Delete all related data
    await db.certificates.delete_many({"athlete_id": athlete_id})
    await db.payments.delete_many({"athlete_id": athlete_id})
    await db.attendances.delete_many({"athlete_id": athlete_id})
    
    # Delete the athlete
    await db.athletes.delete_one({"id": athlete_id})
    
    return {"message": "Atleta eliminato con successo"}

# ==================== CERTIFICATE ENDPOINTS ====================

@api_router.post("/certificates")
async def upload_certificate(
    athlete_id: str,
    issue_date: str,
    validity_months: int,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    # Check athlete exists and permissions
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Read PDF and encode to base64
    pdf_data = await file.read()
    pdf_base64 = base64.b64encode(pdf_data).decode()
    
    # Calculate expiry date
    issue_dt = datetime.fromisoformat(issue_date)
    expiry_dt = issue_dt + timedelta(days=validity_months * 30)
    
    # Delete old certificate if exists
    await db.certificates.delete_many({"athlete_id": athlete_id})
    
    # Create certificate
    certificate = Certificate(
        athlete_id=athlete_id,
        pdf_data=pdf_base64,
        issue_date=issue_dt,
        validity_months=validity_months,
        expiry_date=expiry_dt
    )
    
    await db.certificates.insert_one(certificate.dict())
    
    return {"message": "Certificato caricato con successo", "expiry_date": expiry_dt.isoformat()}

@api_router.post("/certificates/upload-base64")
async def upload_certificate_base64(
    data: CertificateUploadBase64,
    current_user = Depends(get_current_user)
):
    # Check athlete exists and permissions
    athlete = await db.athletes.find_one({"id": data.athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Calculate expiry date: (issue_date + validity_months) - 1 day
    # Example: issue 15/12/2025 + 12 months - 1 day = 14/12/2026
    issue_dt = datetime.fromisoformat(data.issue_date)
    
    # Add months by using relativedelta-like calculation
    expiry_year = issue_dt.year + (issue_dt.month + data.validity_months - 1) // 12
    expiry_month = (issue_dt.month + data.validity_months - 1) % 12 + 1
    expiry_day = issue_dt.day
    
    # Handle month overflow (e.g., Jan 31 + 1 month = Feb 28/29)
    import calendar
    max_day = calendar.monthrange(expiry_year, expiry_month)[1]
    if expiry_day > max_day:
        expiry_day = max_day
    
    expiry_dt = datetime(expiry_year, expiry_month, expiry_day) - timedelta(days=1)
    
    # Delete old certificate if exists
    await db.certificates.delete_many({"athlete_id": data.athlete_id})
    
    # Create certificate
    certificate = Certificate(
        athlete_id=data.athlete_id,
        pdf_data=data.pdf_base64,
        issue_date=issue_dt,
        validity_months=data.validity_months,
        expiry_date=expiry_dt
    )
    
    await db.certificates.insert_one(certificate.dict())
    
    return {"message": "Certificato caricato con successo", "expiry_date": expiry_dt.isoformat()}


class CertificateSimple(BaseModel):
    athlete_id: str
    expiry_date: str  # ISO format
    pdf_data: Optional[str] = None  # Optional image of the certificate (base64)

@api_router.post("/certificates/simple")
async def create_certificate_simple(
    data: CertificateSimple,
    current_user = Depends(get_current_user)
):
    """Create/update certificate with just expiry date - Admin only"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può aggiungere certificati")
    
    # Check athlete exists
    athlete = await db.athletes.find_one({"id": data.athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Parse expiry date
    try:
        expiry_dt = datetime.fromisoformat(data.expiry_date.replace('Z', '+00:00'))
    except:
        raise HTTPException(status_code=400, detail="Formato data non valido")
    
    # Delete old certificate if exists
    await db.certificates.delete_many({"athlete_id": data.athlete_id})
    
    # Create certificate
    certificate = Certificate(
        athlete_id=data.athlete_id,
        pdf_data=data.pdf_data or "",
        issue_date=datetime.utcnow(),
        validity_months=12,
        expiry_date=expiry_dt
    )
    
    await db.certificates.insert_one(certificate.dict())
    
    return {
        "id": certificate.id,
        "athlete_id": certificate.athlete_id,
        "expiry_date": certificate.expiry_date.isoformat(),
        "message": "Certificato salvato con successo"
    }


@api_router.get("/certificates/expiring")
async def get_expiring_certificates(current_user = Depends(get_current_user)):
    """Get certificates expiring today and within next 30 days"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i certificati in scadenza")
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    thirty_days = today + timedelta(days=30)
    
    expiring_today = []
    expiring_soon = []
    
    # Get all certificates
    certificates = await db.certificates.find({}).to_list(1000)
    
    for cert in certificates:
        expiry = cert.get("expiry_date")
        if not expiry:
            continue
            
        if isinstance(expiry, str):
            try:
                expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
            except:
                continue
        
        # Get athlete info
        athlete = await db.athletes.find_one({"id": cert.get("athlete_id")})
        if not athlete:
            continue
        
        # Check if withdrawn
        if athlete.get("is_withdrawn"):
            continue
            
        cert_info = {
            "id": str(cert.get("_id")),
            "athlete_id": athlete["id"],
            "athlete_name": athlete["full_name"],
            "expiry_date": expiry.isoformat(),
            "team_id": athlete.get("team_id")
        }
        
        # Expiring today
        if expiry.date() == today.date():
            expiring_today.append(cert_info)
        # Expiring within 30 days
        elif today < expiry <= thirty_days:
            cert_info["days_until_expiry"] = (expiry - today).days
            expiring_soon.append(cert_info)
    
    return {
        "expiring_today": expiring_today,
        "expiring_soon": sorted(expiring_soon, key=lambda x: x.get("days_until_expiry", 30)),
        "count_today": len(expiring_today),
        "count_30_days": len(expiring_soon)
    }


@api_router.get("/certificates/{athlete_id}")
async def get_certificate(athlete_id: str, current_user = Depends(get_current_user)):
    certificate = await db.certificates.find_one({"athlete_id": athlete_id})
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificato non trovato")
    
    # Check permissions - allow primary and second parent
    athlete = await db.athletes.find_one({"id": athlete_id})
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    return Certificate(**certificate)

def count_training_days_in_period(training_sessions: list, start_date: datetime, end_date: datetime) -> int:
    """
    Count how many training days occurred between start_date and end_date (inclusive).
    Based on team's configured training_sessions.
    """
    if not training_sessions:
        return 0
    
    # Map Italian day names to weekday numbers (Monday=0, Sunday=6)
    day_map = {
        'lunedì': 0, 'lunedi': 0,
        'martedì': 1, 'martedi': 1,
        'mercoledì': 2, 'mercoledi': 2,
        'giovedì': 3, 'giovedi': 3,
        'venerdì': 4, 'venerdi': 4,
        'sabato': 5,
        'domenica': 6
    }
    
    # Get training weekdays from team config
    training_weekdays = set()
    for session in training_sessions:
        day_name = session.get('day', '').lower().strip()
        if day_name in day_map:
            training_weekdays.add(day_map[day_name])
    
    if not training_weekdays:
        return 0
    
    # Count training days in the period
    count = 0
    current = start_date
    while current <= end_date:
        if current.weekday() in training_weekdays:
            count += 1
        current += timedelta(days=1)
    
    return count

@api_router.get("/teams/{team_id}/attendance-stats")
async def get_team_attendance_stats(team_id: str, current_user = Depends(get_current_user)):
    """Get attendance statistics for all athletes in a team"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH]:
        raise HTTPException(status_code=403, detail="Solo admin o coach possono vedere le statistiche")
    
    # Check team exists
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    # Get all athletes in the team
    athletes = await db.athletes.find({"team_id": team_id}).to_list(1000)
    
    # Get team's training sessions configuration
    training_sessions = team.get("training_sessions", [])
    trainings_per_week = len(training_sessions) if training_sessions else 3  # fallback to 3
    
    # Get current date info
    now = datetime.now()
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Set week_start to Monday 00:00:00
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    # Set month_start to 1st of month 00:00:00
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate expected trainings based on ACTUAL training days up to TODAY
    expected_weekly = count_training_days_in_period(training_sessions, week_start, today_end)
    expected_monthly = count_training_days_in_period(training_sessions, month_start, today_end)
    
    # Calculate stats for each athlete
    stats = []
    for athlete in athletes:
        athlete_id = athlete["id"]
        
        # Get registration date for total calculation (fallback to created_at or today)
        reg_date = athlete.get("registration_date") or athlete.get("created_at") or today_start
        if isinstance(reg_date, str):
            reg_date = datetime.fromisoformat(reg_date)
        
        # Calculate expected total trainings from registration to today
        expected_total = count_training_days_in_period(training_sessions, reg_date, today_end)
        
        # Get all attendances for this athlete
        all_attendances = await db.attendances.count_documents({"athlete_id": athlete_id})
        
        # Get weekly attendances (use datetime objects, not strings for MongoDB comparison)
        week_attendances = await db.attendances.count_documents({
            "athlete_id": athlete_id,
            "check_in_time": {"$gte": week_start}
        })
        
        # Get monthly attendances
        month_attendances = await db.attendances.count_documents({
            "athlete_id": athlete_id,
            "check_in_time": {"$gte": month_start}
        })
        
        # Calculate percentages based on actual expected trainings
        total_percentage = round((all_attendances / max(expected_total, 1)) * 100, 1)
        monthly_percentage = round((month_attendances / max(expected_monthly, 1)) * 100, 1)
        weekly_percentage = round((week_attendances / max(expected_weekly, 1)) * 100, 1)
        
        # Cap at 100%
        total_percentage = min(total_percentage, 100)
        monthly_percentage = min(monthly_percentage, 100)
        weekly_percentage = min(weekly_percentage, 100)
        
        stats.append({
            "athlete_id": athlete_id,
            "athlete_name": athlete["full_name"],
            "total_attendances": all_attendances,
            "weekly_attendances": week_attendances,
            "monthly_attendances": month_attendances,
            "expected_weekly": expected_weekly,
            "expected_monthly": expected_monthly,
            "expected_total": expected_total,
            "total_percentage": total_percentage,
            "monthly_percentage": monthly_percentage,
            "weekly_percentage": weekly_percentage,
        })
    
    # Sort by name
    stats.sort(key=lambda x: x["athlete_name"])
    
    return {
        "team_name": team["name"],
        "total_athletes": len(athletes),
        "trainings_per_week": trainings_per_week,
        "week_start": week_start.strftime("%d/%m/%Y"),
        "month_name": now.strftime("%B %Y"),
        "expected_weekly": expected_weekly,
        "expected_monthly": expected_monthly,
        "athletes": stats
    }

# ==================== PAYMENT ENDPOINTS ====================

@api_router.post("/payment-settings", response_model=PaymentSettings)
async def create_payment_settings(settings_data: PaymentSettingsCreate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può impostare i pagamenti")
    
    settings = PaymentSettings(
        season=settings_data.season,
        installment_1_amount=settings_data.installment_1_amount,
        installment_2_amount=settings_data.installment_2_amount,
        installment_2_due_date=datetime.fromisoformat(settings_data.installment_2_due_date),
        installment_3_amount=settings_data.installment_3_amount,
        installment_3_due_date=datetime.fromisoformat(settings_data.installment_3_due_date),
        bank_info=settings_data.bank_info,
        paypal_email=settings_data.paypal_email
    )
    
    # Delete old settings and insert new
    await db.payment_settings.delete_many({})
    await db.payment_settings.insert_one(settings.dict())
    
    return settings

@api_router.get("/payment-settings")
async def get_payment_settings(current_user = Depends(get_current_user)):
    settings = await db.payment_settings.find_one()
    if not settings:
        raise HTTPException(status_code=404, detail="Impostazioni pagamento non trovate")
    clean_mongo_doc(settings)
    return PaymentSettings(**settings)

@api_router.get("/payments/export-athletes-codes")
async def export_athletes_with_codes(current_user = Depends(get_current_user)):
    """Export list of athletes with their codes for payment reference"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    
    society_id = current_user.get("society_id")
    
    # Get all athletes - include those without society_id or with matching society_id
    # Also include legacy data where society_id might be "None" string or empty string
    query = {
        "$or": [
            {"society_id": society_id},
            {"society_id": None},
            {"society_id": {"$exists": False}},
            {"society_id": "None"},  # Legacy: some athletes have "None" as string
            {"society_id": ""}       # Legacy: some athletes have empty string
        ],
        "is_withdrawn": {"$ne": True}
    }
    
    athletes = await db.athletes.find(query).to_list(1000)
    teams = await db.teams.find({}).to_list(100)
    team_dict = {t["id"]: t["name"] for t in teams}
    
    result = []
    for a in athletes:
        # Generate code if missing
        if not a.get("athlete_code"):
            team_name = team_dict.get(a.get("team_id"), "")
            code = await generate_unique_athlete_code(
                a.get("last_name", ""), 
                a.get("first_name", ""), 
                team_name,
                society_id,
                a["id"]
            )
            await db.athletes.update_one({"id": a["id"]}, {"$set": {"athlete_code": code}})
            a["athlete_code"] = code
        
        result.append({
            "CodiceAtleta": a.get("athlete_code", ""),
            "Cognome": a.get("last_name", ""),
            "Nome": a.get("first_name", ""),
            "Squadra": team_dict.get(a.get("team_id"), ""),
        })
    
    # Sort by Cognome alphabetically
    result.sort(key=lambda x: (x.get("Cognome", "") or "").upper())
    
    return result

@api_router.get("/payments/{athlete_id}", response_model=List[Payment])
async def get_athlete_payments(athlete_id: str, current_user = Depends(get_current_user)):
    # Check permissions
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Return only PAID payments (manual payments registered by admin)
    payments = await db.payments.find({
        "athlete_id": athlete_id, 
        "paid": True
    }).sort("paid_date", -1).to_list(100)
    clean_mongo_docs(payments)
    return [Payment(**payment) for payment in payments]

@api_router.post("/payments/manual")
async def create_manual_payment(payment_data: PaymentCreate, current_user = Depends(get_current_user)):
    """Create a manual payment record (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può registrare pagamenti")
    
    # Check athlete exists
    athlete = await db.athletes.find_one({"id": payment_data.athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Parse date (format: gg/mm/aaaa)
    try:
        parts = payment_data.paid_date.split('/')
        paid_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
    except:
        raise HTTPException(status_code=400, detail="Formato data non valido. Usa gg/mm/aaaa")
    
    payment = Payment(
        athlete_id=payment_data.athlete_id,
        amount=payment_data.amount,
        paid=True,
        paid_date=paid_date,
        is_cash=payment_data.is_cash,
        payment_method="contanti" if payment_data.is_cash else "bonifico",
        notes=payment_data.notes,
        description=f"Pagamento del {payment_data.paid_date}",
        created_by=current_user["id"]
    )
    
    await db.payments.insert_one(payment.dict())
    
    return payment

@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user = Depends(get_current_user)):
    """Delete a payment record (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare pagamenti")
    
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    await db.payments.delete_one({"id": payment_id})
    
    return {"message": "Pagamento eliminato"}

class PaymentUpdate(BaseModel):
    amount: float
    paid_date: str
    is_cash: bool = False
    notes: Optional[str] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None

@api_router.put("/payments/manual/{payment_id}")
async def update_manual_payment(payment_id: str, payment_data: PaymentUpdate, current_user = Depends(get_current_user)):
    """Update a manual payment record (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare pagamenti")
    
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    # Parse date (format: gg/mm/aaaa)
    try:
        parts = payment_data.paid_date.split('/')
        paid_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
    except:
        raise HTTPException(status_code=400, detail="Formato data non valido. Usa gg/mm/aaaa")
    
    # Use provided payment_method or derive from is_cash
    payment_method = payment_data.payment_method if payment_data.payment_method else ("Contanti" if payment_data.is_cash else "Bonifico")
    
    # Use provided description or generate default
    description = payment_data.description if payment_data.description else f"Pagamento del {payment_data.paid_date}"
    
    update_data = {
        "amount": payment_data.amount,
        "paid_date": paid_date,
        "is_cash": payment_data.is_cash or payment_method == "Contanti",
        "payment_method": payment_method,
        "notes": payment_data.notes,
        "description": description,
    }
    
    await db.payments.update_one({"id": payment_id}, {"$set": update_data})
    
    updated_payment = await db.payments.find_one({"id": payment_id})
    clean_mongo_docs([updated_payment])
    return Payment(**updated_payment)

@api_router.get("/payments/{athlete_id}/summary")
async def get_payment_summary(athlete_id: str, current_user = Depends(get_current_user)):
    """Get payment summary for an athlete including total due, paid, and residual"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Get team for quote amounts
    team = await db.teams.find_one({"id": athlete["team_id"]})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    total_due = team.get("total_amount", 0)
    discount = athlete.get("discount_amount", 0)
    total_after_discount = total_due - discount
    
    # Get all payments
    payments = await db.payments.find({"athlete_id": athlete_id, "paid": True}).to_list(100)
    total_paid = sum(p.get("amount", 0) for p in payments)
    
    # Calculate residual - can be negative if overpaid
    residual = total_after_discount - total_paid
    
    return {
        "total_due": total_due,
        "discount": discount,
        "discount_note": athlete.get("discount_note", ""),
        "total_after_discount": total_after_discount,
        "total_paid": total_paid,
        "residual": residual,
        "installments": {
            "first": team.get("installment_1_amount", 0),
            "second": team.get("installment_2_amount", 0),
            "third": team.get("installment_3_amount", 0) - discount  # Sconto su ultima rata
        }
    }

@api_router.get("/payments/{athlete_id}/fiscal-receipt")
async def get_fiscal_receipt_data(athlete_id: str, current_user = Depends(get_current_user)):
    """Get all data needed to generate a fiscal receipt for an athlete"""
    # Get athlete
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions - parent can only access their children
    if current_user["role"] == UserRole.PARENT:
        if athlete.get("parent_id") != current_user["id"] and athlete.get("second_parent_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Get parent data
    parent = await db.users.find_one({"id": athlete.get("parent_id")})
    
    # Get team
    team = await db.teams.find_one({"id": athlete.get("team_id")})
    
    # Get society settings from correct collection
    society = await db.settings.find_one({"type": "society"})
    
    # Get all payments for this athlete
    payments = await db.payments.find({"athlete_id": athlete_id, "paid": True}).sort("paid_date", 1).to_list(100)
    
    # Generate receipt number based on date and athlete
    from datetime import datetime
    now = datetime.utcnow()
    receipt_count = await db.payments.count_documents({"athlete_id": athlete_id, "paid": True})
    receipt_number = f"RF-{now.year}-{str(receipt_count).zfill(4)}"
    
    # Determine season (July to June)
    if now.month >= 7:
        season = f"{now.year}/{now.year + 1}"
    else:
        season = f"{now.year - 1}/{now.year}"
    
    return {
        "athlete": {
            "first_name": athlete.get("first_name", ""),
            "last_name": athlete.get("last_name", ""),
            "fiscal_code": athlete.get("fiscal_code", ""),
            "address": athlete.get("address", ""),
            "postal_code": athlete.get("postal_code", ""),
            "city": athlete.get("city", ""),
            "province": athlete.get("province", ""),
            "date_of_birth": athlete.get("date_of_birth"),
            "birth_place": athlete.get("birth_place", ""),
            "birth_province": athlete.get("birth_province", ""),
        },
        "parent": {
            "first_name": parent.get("first_name", "") if parent else current_user.get("first_name", ""),
            "last_name": parent.get("last_name", "") if parent else current_user.get("last_name", ""),
            "fiscal_code": parent.get("tax_code", "") if parent else current_user.get("tax_code", ""),
            "address": parent.get("address", "") if parent else "",
            "postal_code": parent.get("postal_code", "") if parent else "",
            "city": parent.get("city", "") if parent else "",
            "province": parent.get("province", "") if parent else "",
        },
        "society": {
            "name": society.get("ragione_sociale") or society.get("name", "SOCIETÀ SPORTIVA") if society else "SOCIETÀ SPORTIVA",
            "address": society.get("address", "") if society else "",
            "city": society.get("city", "") if society else "",
            "postal_code": society.get("postal_code", "") if society else "",
            "province": society.get("province", "") if society else "",
            "fiscal_code": society.get("fiscal_code", "") if society else "",
            "phone": society.get("phone", "") if society else "",
            "phone2": society.get("phone2", "") if society else "",
            "president_name": society.get("president_name", "") if society else "",
            "logo": society.get("logo", "") if society else "",
            "stamp_signature": society.get("stamp_signature", "") if society else "",
        },
        "team_name": team.get("name", "") if team else "",
        "season": season,
        "receipt_number": receipt_number,
        "payments": [
            {
                "date": p.get("paid_date").isoformat() if p.get("paid_date") else "",
                "receipt_number": p.get("receipt_number", ""),
                "amount": p.get("amount", 0),
                "description": p.get("description", ""),
                "payment_method": p.get("payment_method", ""),
            }
            for p in payments
        ],
    }

@api_router.patch("/payments/{payment_id}", response_model=Payment)
async def update_payment(payment_id: str, update_data: PaymentUpdate, current_user = Depends(get_current_user)):
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    # Check permissions - allow primary and second parent
    athlete = await db.athletes.find_one({"id": payment["athlete_id"]})
    if current_user["role"] == UserRole.PARENT:
        is_primary = athlete.get("parent_id") == current_user["id"]
        is_second = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary and not is_second:
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    update_dict = {}
    if update_data.paid is not None:
        update_dict["paid"] = update_data.paid
        if update_data.paid:
            update_dict["paid_date"] = datetime.utcnow()
            if update_data.payment_method:
                update_dict["payment_method"] = update_data.payment_method
    
    if update_dict:
        await db.payments.update_one({"id": payment_id}, {"$set": update_dict})
        payment.update(update_dict)
    
    return Payment(**payment)

async def get_next_receipt_number(society_id: str) -> str:
    """Generate next receipt number for the current year: RIC-2025-0001"""
    current_year = datetime.utcnow().year
    prefix = f"RIC-{current_year}-"
    
    # Find the highest receipt number for this year and society
    last_payment = await db.payments.find_one(
        {
            "receipt_number": {"$regex": f"^{prefix}"},
        },
        sort=[("receipt_number", -1)]
    )
    
    if last_payment and last_payment.get("receipt_number"):
        # Extract the number and increment
        try:
            last_num = int(last_payment["receipt_number"].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{next_num:04d}"

@api_router.post("/payments/import")
async def import_payments(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    """Import payments from Excel file. Matches athletes by athlete_code."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può importare pagamenti")
    
    content = await file.read()
    
    try:
        import pandas as pd
        from io import BytesIO
        
        df = pd.read_excel(BytesIO(content))
        
        # Required columns
        required_cols = ['CodiceAtleta', 'DataPagamento', 'Importo', 'TipoPagamento']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(status_code=400, detail=f"Colonne mancanti: {', '.join(missing_cols)}")
        
        society_id = current_user.get("society_id")
        imported = 0
        errors = []
        duplicates = []  # Track duplicate payments
        
        for idx, row in df.iterrows():
            try:
                athlete_code = str(row['CodiceAtleta']).strip().upper()
                
                # Find athlete by code - include legacy athletes with null/None society_id
                athlete = await db.athletes.find_one({
                    "athlete_code": athlete_code,
                    "$or": [
                        {"society_id": society_id},
                        {"society_id": None},
                        {"society_id": "None"},
                        {"society_id": ""},
                        {"society_id": {"$exists": False}}
                    ]
                })
                
                if not athlete:
                    errors.append(f"Riga {idx+2}: Atleta {athlete_code} non trovato")
                    continue
                
                # Parse dates
                data_pagamento = row['DataPagamento']
                if isinstance(data_pagamento, str):
                    try:
                        data_pagamento = datetime.strptime(data_pagamento, "%d/%m/%Y")
                    except:
                        data_pagamento = datetime.strptime(data_pagamento, "%Y-%m-%d")
                
                data_registrazione = None
                if 'DataRegistrazione' in df.columns and pd.notna(row.get('DataRegistrazione')):
                    dr = row['DataRegistrazione']
                    if isinstance(dr, str):
                        try:
                            data_registrazione = datetime.strptime(dr, "%d/%m/%Y")
                        except:
                            data_registrazione = datetime.strptime(dr, "%Y-%m-%d")
                    else:
                        data_registrazione = dr
                
                # Get amount - handle € format (e.g., "€ 150,00" or "150,00" or 150.00)
                importo_raw = row['Importo']
                if isinstance(importo_raw, str):
                    # Remove € symbol, spaces, and convert comma to dot
                    importo_clean = importo_raw.replace('€', '').replace(' ', '').replace('.', '').replace(',', '.')
                    importo = float(importo_clean)
                else:
                    importo = float(importo_raw)
                
                # ============ DUPLICATE CHECK ============
                # Check if a payment with same date and amount already exists for this athlete
                # We use a date range of the same day to handle timezone issues
                date_start = data_pagamento.replace(hour=0, minute=0, second=0, microsecond=0)
                date_end = data_pagamento.replace(hour=23, minute=59, second=59, microsecond=999999)
                
                existing_payment = await db.payments.find_one({
                    "athlete_id": athlete["id"],
                    "amount": importo,
                    "paid_date": {"$gte": date_start, "$lte": date_end}
                })
                
                if existing_payment:
                    athlete_name = athlete.get("full_name", athlete_code)
                    duplicates.append(f"Riga {idx+2}: {athlete_name} - €{importo:.2f} del {data_pagamento.strftime('%d/%m/%Y')} (già registrato)")
                    continue
                # ============ END DUPLICATE CHECK ============
                
                # Get payment method - support both letter and full name
                tipo_raw = row.get('TipoPagamento', '')
                if pd.isna(tipo_raw) or tipo_raw is None or str(tipo_raw).strip() == '':
                    tipo = 'Altro'
                else:
                    tipo_raw = str(tipo_raw).strip().upper()
                    tipo_map = {
                        'B': 'Bonifico', 'BONIFICO': 'Bonifico',
                        'P': 'POS', 'POS': 'POS',
                        'C': 'Contanti', 'CONTANTI': 'Contanti',
                        'A': 'Assegno', 'ASSEGNO': 'Assegno',
                        'O': 'Online', 'ONLINE': 'Online',
                    }
                    tipo = tipo_map.get(tipo_raw, 'Altro')
                
                # Causale (optional) - handle NaN, None, empty strings properly
                causale_raw = row.get('Causale', '')
                if pd.isna(causale_raw) or causale_raw is None or str(causale_raw).strip() in ['', 'nan', 'None']:
                    causale = f"Pagamento importato - {tipo}"
                else:
                    causale = str(causale_raw).strip()
                
                # Generate receipt number
                receipt_number = await get_next_receipt_number(society_id)
                
                # Create payment
                payment = Payment(
                    athlete_id=athlete["id"],
                    description=causale,
                    amount=importo,
                    paid=True,
                    paid_date=data_pagamento,
                    payment_method=tipo,
                    is_cash=(tipo == 'Contanti'),
                    receipt_number=receipt_number,
                    registration_date=data_registrazione or datetime.utcnow(),
                    created_by=current_user["id"],
                )
                
                await db.payments.insert_one(payment.dict())
                imported += 1
                
            except Exception as e:
                errors.append(f"Riga {idx+2}: {str(e)}")
        
        # Build response message
        message_parts = [f"Importati {imported} pagamenti"]
        if duplicates:
            message_parts.append(f"{len(duplicates)} duplicati ignorati")
        if errors:
            message_parts.append(f"{len(errors)} errori")
        
        return {
            "success": True,
            "imported": imported,
            "duplicates": duplicates,
            "duplicates_count": len(duplicates),
            "errors": errors,
            "message": " - ".join(message_parts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore lettura file: {str(e)}")

# ==================== ATTENDANCE ENDPOINTS (COACH) ====================

@api_router.post("/attendance/check", response_model=Attendance)
async def check_attendance(attendance_data: AttendanceCreate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.COACH:
        raise HTTPException(status_code=403, detail="Solo coach può registrare presenze")
    
    # Extract athlete_id from QR code
    athlete_id = attendance_data.qr_code
    
    # Find athlete
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check if already registered today (skip if force=True)
    if not attendance_data.force:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
        
        existing_attendance = await db.attendances.find_one({
            "athlete_id": athlete_id,
            "check_in_time": {"$gte": today_start, "$lte": today_end}
        })
        
        if existing_attendance:
            # Return a NEW attendance object with "already_registered" status
            # This does NOT create a new record in the database
            return Attendance(
                id=existing_attendance["id"],
                athlete_id=athlete_id,
                coach_id=existing_attendance["coach_id"],
                check_in_time=existing_attendance["check_in_time"],
                status="already_registered",
                block_reason="GIÀ REGISTRATA OGGI"
            )
    
    # Check status
    status_check = await check_athlete_status(athlete_id)
    
    attendance = Attendance(
        athlete_id=athlete_id,
        coach_id=current_user["id"],
        status="allowed" if status_check["allowed"] else "blocked",
        block_reason=status_check["reason"]
    )
    
    await db.attendances.insert_one(attendance.dict())
    
    return attendance

@api_router.get("/attendance/athlete/{athlete_id}", response_model=List[Attendance])
async def get_athlete_attendances(athlete_id: str, current_user = Depends(get_current_user)):
    attendances = await db.attendances.find({"athlete_id": athlete_id}).sort("check_in_time", -1).to_list(1000)
    return [Attendance(**att) for att in attendances]

@api_router.get("/attendance/today", response_model=List[dict])
async def get_today_attendances(current_user = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.COACH, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Get today's attendances
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    attendances = await db.attendances.find({
        "check_in_time": {"$gte": today_start}
    }).sort("check_in_time", -1).to_list(1000)
    
    # Enrich with athlete info
    result = []
    for att in attendances:
        clean_mongo_doc(att)
        athlete = await db.athletes.find_one({"id": att["athlete_id"]})
        if athlete:
            result.append({
                **att,
                "athlete_name": athlete["full_name"],
                "team_id": athlete["team_id"]
            })
    
    return result

# ==================== COACH ENDPOINTS ====================

@api_router.get("/coach/my-teams")
async def get_coach_teams(current_user = Depends(get_current_user)):
    """Get teams assigned to the current coach"""
    if current_user["role"] != UserRole.COACH:
        raise HTTPException(status_code=403, detail="Solo coach può accedere")
    
    # Get teams assigned to this coach
    assigned_team_ids = current_user.get("assigned_teams", [])
    
    if not assigned_team_ids:
        return []
    
    teams = await db.teams.find({"id": {"$in": assigned_team_ids}}).to_list(100)
    clean_mongo_docs(teams)
    return [Team(**team) for team in teams]

@api_router.get("/coach/commitments")
async def get_coach_commitments(current_user = Depends(get_current_user)):
    """Get commitments (trainings + matches) for coach's teams - 7 days"""
    if current_user["role"] != UserRole.COACH:
        raise HTTPException(status_code=403, detail="Solo coach può vedere gli impegni")
    
    # Get coach's assigned teams
    team_ids = current_user.get("assigned_teams", [])
    
    if not team_ids:
        return {"today": [], "tomorrow": [], "day_after": [], "upcoming": []}
    
    # Get teams info (for training schedules)
    teams = await db.teams.find({"id": {"$in": team_ids}}).to_list(20)
    teams_dict = {t["id"]: t for t in teams}
    
    # Get current date info
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    
    # Day of week mapping (Italian)
    days_map = {
        0: "Lunedì", 1: "Martedì", 2: "Mercoledì", 
        3: "Giovedì", 4: "Venerdì", 5: "Sabato", 6: "Domenica"
    }
    
    def get_day_name(date):
        return days_map[date.weekday()]
    
    # Get matches for 7 days FIRST (to know which teams have home matches on which days)
    end_of_week = today + timedelta(days=7)
    matches = await db.matches.find({
        "team_id": {"$in": team_ids},
        "date": {"$gte": today, "$lt": end_of_week}
    }).to_list(50)
    
    # Build a set of (team_id, day_key) for home matches - these will skip training
    home_match_days = set()
    for match in matches:
        match_date = match.get("date")
        if isinstance(match_date, str):
            match_date = datetime.fromisoformat(match_date.replace("Z", ""))
        
        # Only home matches hide training
        if match.get("home_away") == "home":
            if today <= match_date < tomorrow:
                home_match_days.add((match.get("team_id"), "today"))
            elif tomorrow <= match_date < day_after:
                home_match_days.add((match.get("team_id"), "tomorrow"))
            elif day_after <= match_date < (day_after + timedelta(days=1)):
                home_match_days.add((match.get("team_id"), "day_after"))
            else:
                # For upcoming, we need to track by date
                home_match_days.add((match.get("team_id"), match_date.strftime("%d/%m")))
    
    # Build commitments for each day
    result = {"today": [], "tomorrow": [], "day_after": [], "upcoming": []}
    
    for day_key, target_date in [("today", today), ("tomorrow", tomorrow), ("day_after", day_after)]:
        day_name = get_day_name(target_date)
        
        # Check trainings for this day
        for team_id in team_ids:
            # Skip training if there's a home match for this team on this day
            if (team_id, day_key) in home_match_days:
                continue
            
            team = teams_dict.get(team_id, {})
            team_name = team.get("name", "Squadra")
            training_sessions = team.get("training_sessions", [])
            
            for session in training_sessions:
                if session.get("day") == day_name:
                    result[day_key].append({
                        "type": "training",
                        "team_id": team_id,
                        "team_name": team_name,
                        "time_start": session.get("timeStart", ""),
                        "time_end": session.get("timeEnd", ""),
                        "venue": session.get("venue", ""),
                        "title": f"Allenamento {team_name}"
                    })
    
    # Check trainings for upcoming days (days 4-7)
    for day_offset in range(3, 7):
        target_date = today + timedelta(days=day_offset)
        day_name = get_day_name(target_date)
        date_str = target_date.strftime("%d/%m")
        
        for team_id in team_ids:
            # Skip training if there's a home match for this team on this day
            if (team_id, date_str) in home_match_days:
                continue
            
            team = teams_dict.get(team_id, {})
            team_name = team.get("name", "Squadra")
            training_sessions = team.get("training_sessions", [])
            
            for session in training_sessions:
                if session.get("day") == day_name:
                    result["upcoming"].append({
                        "type": "training",
                        "team_id": team_id,
                        "team_name": team_name,
                        "date": date_str,
                        "day_name": day_name,
                        "time_start": session.get("timeStart", ""),
                        "time_end": session.get("timeEnd", ""),
                        "venue": session.get("venue", ""),
                        "title": f"Allenamento {team_name}"
                    })
    
    for match in matches:
        match_date = match.get("date")
        if isinstance(match_date, str):
            match_date = datetime.fromisoformat(match_date.replace("Z", ""))
        
        if today <= match_date < tomorrow:
            day_key = "today"
        elif tomorrow <= match_date < day_after:
            day_key = "tomorrow"
        elif day_after <= match_date < (day_after + timedelta(days=1)):
            day_key = "day_after"
        elif match_date < end_of_week:
            day_key = "upcoming"
        else:
            continue
        
        match_item = {
            "type": "match",
            "team_id": match.get("team_id"),
            "team_name": match.get("team_name", ""),
            "time": match_date.strftime("%H:%M"),
            "venue": match.get("venue", ""),
            "city": match.get("city", ""),
            "address": match.get("address", ""),
            "opponent": match.get("opponent", ""),
            "home_away": match.get("home_away", "home"),
            "meeting_time": match.get("meeting_time"),
            "notes": match.get("notes"),
            "title": f"Gara {match.get('team_name', '')} vs {match.get('opponent', '')}"
        }
        
        if day_key == "upcoming":
            match_item["date"] = match_date.strftime("%d/%m")
            match_item["day_name"] = get_day_name(match_date)
        
        result[day_key].append(match_item)
    
    # Sort by time
    for day_key in ["today", "tomorrow", "day_after"]:
        result[day_key].sort(key=lambda x: x.get("time_start", x.get("time", "00:00")))
    
    # Sort upcoming by date and time
    result["upcoming"].sort(key=lambda x: (x.get("date", ""), x.get("time_start", x.get("time", "00:00"))))
    
    return result

@api_router.get("/coach/team/{team_id}/athletes")
async def get_coach_team_athletes(team_id: str, current_user = Depends(get_current_user)):
    """Get athletes for a team (coach view - limited info)"""
    if current_user["role"] != UserRole.COACH:
        raise HTTPException(status_code=403, detail="Solo coach può accedere")
    
    # Check if coach is assigned to this team
    assigned_team_ids = current_user.get("assigned_teams", [])
    if team_id not in assigned_team_ids:
        raise HTTPException(status_code=403, detail="Non sei assegnato a questa squadra")
    
    # Get athletes
    athletes = await db.athletes.find({"team_id": team_id}).to_list(1000)
    clean_mongo_docs(athletes)
    
    # Get certificate info and return limited data
    result = []
    for athlete in athletes:
        cert = await db.certificates.find_one({"athlete_id": athlete["id"]})
        
        athlete_data = {
            "id": athlete["id"],
            "full_name": athlete.get("full_name", ""),
            "first_name": athlete.get("first_name", ""),
            "last_name": athlete.get("last_name", ""),
            "certificate_expiry": cert["expiry_date"].isoformat() if cert and cert.get("expiry_date") else None,
            "is_expired": cert["expiry_date"] < datetime.now() if cert and cert.get("expiry_date") else True
        }
        result.append(athlete_data)
    
    return result

# ==================== EXPORT ENDPOINTS ====================

@api_router.get("/export/dirigenti")
async def export_dirigenti(current_user = Depends(get_current_user)):
    """Export all dirigenti (admin/viewer) to JSON for Excel conversion"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può esportare")
    
    users = await db.users.find({
        "role": {"$in": [UserRole.ADMIN, UserRole.VIEWER]}
    }).to_list(1000)
    clean_mongo_docs(users)
    
    export_data = []
    for user in users:
        export_data.append({
            "Nome Completo": user.get("full_name", ""),
            "Email": user.get("email", ""),
            "Ruolo": "Admin" if user.get("role") == "admin" else "Visualizzatore",
            "Stato": "Approvato" if user.get("status") == "approved" else "In attesa",
            "Data Registrazione": user.get("created_at", "")
        })
    
    return export_data

@api_router.get("/export/coaches")
async def export_coaches(current_user = Depends(get_current_user)):
    """Export all coaches to JSON for Excel conversion - OPTIMIZED"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può esportare")
    
    users = await db.users.find({"role": UserRole.COACH}).to_list(1000)
    clean_mongo_docs(users)
    
    # Batch fetch all teams to avoid N+1 queries
    teams_list = await db.teams.find().to_list(1000)
    teams_dict = {t["id"]: t for t in teams_list}
    
    # Get team names for assigned teams
    export_data = []
    for user in users:
        assigned_teams = user.get("assigned_teams", [])
        team_names = [teams_dict.get(tid, {}).get("name", "") for tid in assigned_teams if teams_dict.get(tid)]
        
        export_data.append({
            "Nome Completo": user.get("full_name", ""),
            "Email": user.get("email", ""),
            "Stato": "Approvato" if user.get("status") == "approved" else "In attesa",
            "Squadre Assegnate": ", ".join(team_names),
            "Data Registrazione": user.get("created_at", "")
        })
    
    return export_data

@api_router.get("/export/athletes")
async def export_athletes(current_user = Depends(get_current_user)):
    """Export all athletes to JSON for Excel conversion - OPTIMIZED"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può esportare")
    
    society_id = current_user.get("society_id")
    athletes = await db.athletes.find({"society_id": society_id}).to_list(5000)
    clean_mongo_docs(athletes)
    
    # Batch fetch all related data to avoid N+1 queries
    teams_list = await db.teams.find({"society_id": society_id}).to_list(1000)
    teams_dict = {t["id"]: t for t in teams_list}
    
    athlete_ids = [a["id"] for a in athletes]
    certs_list = await db.certificates.find({"athlete_id": {"$in": athlete_ids}}).to_list(5000)
    certs_dict = {c["athlete_id"]: c for c in certs_list}
    
    payments_list = await db.payments.find({"athlete_id": {"$in": athlete_ids}}).to_list(10000)
    payments_by_athlete = {}
    for p in payments_list:
        athlete_id = p.get("athlete_id")
        if athlete_id not in payments_by_athlete:
            payments_by_athlete[athlete_id] = []
        payments_by_athlete[athlete_id].append(p)
    
    export_data = []
    for athlete in athletes:
        # Get team name from dict
        team = teams_dict.get(athlete.get("team_id", ""))
        team_name = team.get("name", "") if team else ""
        
        # Get certificate info from dict
        cert = certs_dict.get(athlete["id"])
        cert_expiry = ""
        cert_status = "Mancante"
        if cert and cert.get("expiry_date"):
            cert_expiry = cert["expiry_date"].strftime("%d/%m/%Y") if isinstance(cert["expiry_date"], datetime) else cert["expiry_date"]
            cert_status = "Scaduto" if cert["expiry_date"] < datetime.now() else "Valido"
        
        # Get payment summary from dict
        payments = payments_by_athlete.get(athlete["id"], [])
        total_paid = sum(p.get("amount", 0) for p in payments if p.get("paid"))
        
        # Format birth date to DD/MM/YYYY
        birth_date_str = ""
        dob = athlete.get("date_of_birth")
        if dob:
            if isinstance(dob, datetime):
                birth_date_str = dob.strftime("%d/%m/%Y")
            elif isinstance(dob, str):
                try:
                    # Try to parse ISO format
                    parsed = datetime.fromisoformat(dob.replace('Z', '+00:00').split('T')[0])
                    birth_date_str = parsed.strftime("%d/%m/%Y")
                except:
                    birth_date_str = dob
        
        export_data.append({
            "Cognome": athlete.get("last_name", ""),
            "Nome": athlete.get("first_name", ""),
            "Nome Completo": athlete.get("full_name", ""),
            "Data Nascita": birth_date_str,
            "Luogo Nascita": athlete.get("birth_place", ""),
            "Codice Fiscale": athlete.get("fiscal_code", ""),
            "Codice Federale": athlete.get("federal_code", ""),
            "Tesserato": "Sì" if athlete.get("is_registered") else "No",
            "Squadra": team_name,
            "Email": athlete.get("email", ""),
            "Tel. Atleta": athlete.get("phone_athlete", ""),
            "Tel. Madre": athlete.get("phone_mother", ""),
            "Tel. Padre": athlete.get("phone_father", ""),
            "Indirizzo": athlete.get("address", ""),
            "CAP": athlete.get("postal_code", ""),
            "Città": athlete.get("city", ""),
            "Provincia": athlete.get("province", ""),
            "Scadenza Certificato": cert_expiry,
            "Stato Certificato": cert_status,
            "Totale Pagato": total_paid,
            "Sconto": athlete.get("discount_amount", 0),
            "Nota Sconto": athlete.get("discount_note", ""),
        })
    
    return export_data

# ==================== STATS ENDPOINTS (ADMIN) ====================

@api_router.get("/stats/overview")
async def get_stats_overview(current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere statistiche")
    
    total_teams = await db.teams.count_documents({})
    total_athletes = await db.athletes.count_documents({})
    active_athletes = await db.athletes.count_documents({"status": "active"})
    
    # Today's attendances
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_attendances = await db.attendances.count_documents({
        "check_in_time": {"$gte": today_start}
    })
    
    return {
        "total_teams": total_teams,
        "total_athletes": total_athletes,
        "active_athletes": active_athletes,
        "today_attendances": today_attendances
    }

@api_router.get("/birthdays/today")
async def get_today_birthdays(current_user = Depends(get_current_user)):
    """Get all birthdays for today - athletes, coaches, and dirigenti"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i compleanni")
    
    today = datetime.utcnow()
    today_month = today.month
    today_day = today.day
    
    birthdays = []
    
    society_id = current_user.get("society_id")
    
    # Check athletes - filter by society
    athletes = await db.athletes.find({"society_id": society_id}).to_list(1000)
    for athlete in athletes:
        dob = athlete.get("date_of_birth")
        if dob:
            if isinstance(dob, str):
                try:
                    dob = datetime.fromisoformat(dob.replace('Z', '+00:00'))
                except:
                    continue
            if dob.month == today_month and dob.day == today_day:
                age = today.year - dob.year
                birthdays.append({
                    "id": athlete["id"],
                    "name": athlete["full_name"],
                    "type": "atleta",
                    "age": age,
                    "icon": "person"
                })
    
    # Check users (coaches and dirigenti)
    users = await db.users.find({
        "role": {"$in": [UserRole.COACH, UserRole.VIEWER, UserRole.ADMIN]},
        "status": UserStatus.APPROVED
    }).to_list(1000)
    
    for user in users:
        dob = user.get("date_of_birth")
        if dob:
            if isinstance(dob, str):
                try:
                    dob = datetime.fromisoformat(dob.replace('Z', '+00:00'))
                except:
                    continue
            if dob.month == today_month and dob.day == today_day:
                age = today.year - dob.year
                role_label = "coach" if user["role"] == UserRole.COACH else "dirigente"
                if user["role"] == UserRole.ADMIN:
                    role_label = "admin"
                birthdays.append({
                    "id": user["id"],
                    "name": user["full_name"],
                    "type": role_label,
                    "age": age,
                    "icon": "fitness" if user["role"] == UserRole.COACH else "briefcase"
                })
    
    return birthdays


# ==================== COACH COMPENSATION ENDPOINTS ====================

@api_router.get("/coach/{coach_id}/compensation")
async def get_coach_compensation(coach_id: str, current_user = Depends(get_current_user)):
    """Get compensation records for a coach"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    if current_user["role"] == UserRole.COACH and current_user["id"] != coach_id:
        raise HTTPException(status_code=403, detail="Puoi vedere solo i tuoi compensi")
    
    records = await db.coach_compensations.find({"coach_id": coach_id}).sort([("year", -1), ("month", -1)]).to_list(100)
    clean_mongo_docs(records)
    return records

@api_router.post("/coach/{coach_id}/compensation")
async def set_coach_compensation(coach_id: str, amount: float, current_user = Depends(get_current_user)):
    """Set monthly compensation for a coach (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può impostare compensi")
    
    # Update coach record
    await db.users.update_one(
        {"id": coach_id, "role": UserRole.COACH},
        {"$set": {
            "monthly_compensation": amount,
            "compensation_accepted": False  # Reset acceptance
        }}
    )
    
    return {"message": "Compenso mensile impostato", "amount": amount}

@api_router.post("/coach/{coach_id}/accept-compensation")
async def accept_coach_compensation(coach_id: str, current_user = Depends(get_current_user)):
    """Coach accepts the compensation offer"""
    if current_user["role"] != UserRole.COACH or current_user["id"] != coach_id:
        raise HTTPException(status_code=403, detail="Solo il coach può accettare il proprio compenso")
    
    # Update coach record
    now = datetime.utcnow()
    # Calculate contract end date (31/05 of current season)
    season_end_year = now.year if now.month <= 5 else now.year + 1
    contract_end = datetime(season_end_year, 5, 31)
    
    await db.users.update_one(
        {"id": coach_id},
        {"$set": {
            "compensation_accepted": True,
            "compensation_accepted_date": now,
            "contract_start_date": now,
            "contract_end_date": contract_end
        }}
    )
    
    return {"message": "Compenso accettato", "contract_end": contract_end.strftime("%d/%m/%Y")}

@api_router.post("/coach/{coach_id}/compensation/{year}/{month}/received")
async def mark_compensation_received(
    coach_id: str, 
    year: int, 
    month: int, 
    exceeded_5000: bool = False,
    exceeded_15000: bool = False,
    current_user = Depends(get_current_user)
):
    """Coach marks compensation as received for a specific month"""
    if current_user["role"] != UserRole.COACH or current_user["id"] != coach_id:
        raise HTTPException(status_code=403, detail="Solo il coach può confermare i propri compensi")
    
    # Get coach's monthly compensation amount
    coach = await db.users.find_one({"id": coach_id})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach non trovato")
    
    amount = coach.get("monthly_compensation", 0)
    
    # Check if record exists
    existing = await db.coach_compensations.find_one({
        "coach_id": coach_id,
        "year": year,
        "month": month
    })
    
    now = datetime.utcnow()
    
    if existing:
        # Update existing
        await db.coach_compensations.update_one(
            {"id": existing["id"]},
            {"$set": {
                "received": True,
                "received_date": now,
                "exceeded_5000": exceeded_5000,
                "exceeded_5000_date": now if exceeded_5000 else None,
                "exceeded_15000": exceeded_15000,
                "exceeded_15000_date": now if exceeded_15000 else None
            }}
        )
    else:
        # Create new record
        record = CoachCompensation(
            coach_id=coach_id,
            month=month,
            year=year,
            amount=amount,
            received=True,
            received_date=now,
            exceeded_5000=exceeded_5000,
            exceeded_5000_date=now if exceeded_5000 else None,
            exceeded_15000=exceeded_15000,
            exceeded_15000_date=now if exceeded_15000 else None
        )
        await db.coach_compensations.insert_one(record.dict())
    
    # If exceeded €5000, notify admin
    if exceeded_5000:
        # Create notification for admin
        notification = AdminNotification(
            type="coach_exceeded_5000",
            title="⚠️ Coach ha superato €5.000",
            message=f"Il coach {coach.get('full_name', 'Sconosciuto')} ha dichiarato di aver superato il limite di €5.000 annuali di compensi sportivi dilettantistici.",
            related_user_id=coach_id,
            related_user_name=coach.get('full_name', '')
        )
        await db.admin_notifications.insert_one(notification.dict())
    
    # If exceeded €15000, notify admin (more urgent!)
    if exceeded_15000:
        notification = AdminNotification(
            type="coach_exceeded_15000",
            title="🚨 URGENTE: Coach ha superato €15.000",
            message=f"ATTENZIONE: Il coach {coach.get('full_name', 'Sconosciuto')} ha dichiarato di aver superato il limite di €15.000 annuali. Questo comporta obblighi fiscali e contributivi aggiuntivi!",
            related_user_id=coach_id,
            related_user_name=coach.get('full_name', '')
        )
        await db.admin_notifications.insert_one(notification.dict())
    
    return {"message": "Compenso confermato", "exceeded_5000": exceeded_5000, "exceeded_15000": exceeded_15000}

@api_router.get("/coach/{coach_id}/compensation/annual/{year}")
async def get_annual_compensation_summary(coach_id: str, year: int, current_user = Depends(get_current_user)):
    """Get annual summary of compensations"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    records = await db.coach_compensations.find({
        "coach_id": coach_id,
        "year": year,
        "received": True
    }).to_list(12)
    
    total = sum(r.get("amount", 0) for r in records)
    exceeded_month = next((r for r in records if r.get("exceeded_5000")), None)
    
    return {
        "year": year,
        "total_received": total,
        "months_received": len(records),
        "exceeded_5000": exceeded_month is not None,
        "exceeded_month": exceeded_month.get("month") if exceeded_month else None
    }

# Quietanza Compenso Sportivo Request model
class CompensationReceiptRequest(BaseModel):
    month: int
    year: int
    amount_gross: float
    signature_base64: str
    exceeded_5000: bool = False
    exceeded_15000: bool = False

@api_router.post("/coach/{coach_id}/compensation/receipt")
async def sign_compensation_receipt(
    coach_id: str,
    request: CompensationReceiptRequest,
    current_user = Depends(get_current_user)
):
    """Coach firma la quietanza mensile di compenso sportivo dilettantistico"""
    if current_user["role"] != UserRole.COACH or current_user["id"] != coach_id:
        raise HTTPException(status_code=403, detail="Solo il coach può firmare le proprie quietanze")
    
    # Get coach data
    coach = await db.users.find_one({"id": coach_id})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach non trovato")
    
    # Get society data from settings and societies collection
    society_settings = await db.settings.find_one({"type": "society"})
    society = await db.societies.find_one()
    # Prioritize settings over societies collection
    society_name = (society_settings.get("name") if society_settings else None) or (society.get("name") if society else None) or "ASD/SSD"
    admin_email = (society_settings.get("email") if society_settings else None) or (society.get("email") if society else None)
    society_city = (society_settings.get("city") if society_settings else None) or (society.get("city") if society else None) or "Perugia"
    
    # Get prior compensation (declared at hiring)
    prior_compensation = coach.get("other_annual_compensation", 0) or 0
    
    # Calculate yearly totals to check thresholds
    yearly_records = await db.coach_compensations.find({
        "coach_id": coach_id,
        "year": request.year,
        "received": True
    }).to_list(12)
    
    yearly_total_from_receipts = sum(r.get("amount_gross", r.get("amount", 0)) for r in yearly_records)
    
    # Add prior compensation to the first year of contract
    contract_start = coach.get("contract_start_date")
    contract_start_year = None
    if contract_start:
        if isinstance(contract_start, str):
            contract_start_year = int(contract_start.split('-')[0])
        elif hasattr(contract_start, 'year'):
            contract_start_year = contract_start.year
    
    # Include prior compensation in the first year of contract
    if contract_start_year and request.year == contract_start_year:
        yearly_total = yearly_total_from_receipts + prior_compensation
    else:
        yearly_total = yearly_total_from_receipts
    
    new_total = yearly_total + request.amount_gross
    logging.info(f"Compensation calculation: prior={prior_compensation}, yearly_receipts={yearly_total_from_receipts}, year={request.year}, contract_start_year={contract_start_year}, new_total={new_total}")
    
    # Calculate net amount (lordo = netto fino a €5.000)
    amount_net = request.amount_gross
    deductions = 0.0
    
    # Determina se QUESTA è la prima volta che si supera €5.000 o €15.000
    # Il backend deve calcolare questo, non affidarsi al frontend
    first_time_exceeded_5000 = (new_total > 5000 and yearly_total <= 5000)
    first_time_exceeded_15000 = (new_total > 15000 and yearly_total <= 15000)
    
    # Log per debug
    logging.info(f"Threshold check: yearly_total={yearly_total}, new_total={new_total}, first_5k={first_time_exceeded_5000}, first_15k={first_time_exceeded_15000}")
    
    # Se si supera €5.000 o €15.000 si applicano ritenute
    if new_total > 5000:
        # Dopo €5.000: ritenuta IRPEF 23% sull'importo eccedente
        # Semplificato: per ora mostriamo solo che ci sono deduzioni
        if new_total > 15000:
            # Oltre €15.000: contributi INPS + IRPEF
            # Per semplicità: ritenuta ~33% (IRPEF + contributi)
            deductions = request.amount_gross * 0.33
        else:
            # Tra €5.000 e €15.000: solo IRPEF 23%
            deductions = request.amount_gross * 0.23
        amount_net = request.amount_gross - deductions
    
    # Check if record exists for this month
    existing = await db.coach_compensations.find_one({
        "coach_id": coach_id,
        "year": request.year,
        "month": request.month
    })
    
    now = datetime.utcnow()
    month_names = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                   "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
    month_name = month_names[request.month]
    
    # Generate receipt PDF - solo importo lordo
    receipt_text = f"""QUIETANZA COMPENSO SPORTIVO DILETTANTISTICO

ASD/SSD: {society_name}

Collaboratore: {coach.get('full_name', 'N/D')}
Codice Fiscale: {coach.get('fiscal_code', 'N/D')}

Mese di riferimento: {month_name} {request.year}

Compenso lordo: € {request.amount_gross:.2f}

Totale annuo progressivo: € {new_total:.2f}

Il collaboratore dichiara che, alla data odierna, non sono intervenute variazioni rispetto all'autocertificazione dei compensi sportivi dilettantistici precedentemente resa.
"""

    # Add threshold declaration if needed (based on backend calculation, not frontend)
    if first_time_exceeded_5000 and not first_time_exceeded_15000:
        receipt_text += f"""
⚠️ DICHIARAZIONE SUPERAMENTO SOGLIA €5.000
Il collaboratore dichiara di aver superato, nell'anno {request.year}, la soglia di €5.000 di compensi sportivi dilettantistici complessivi.
"""
    elif first_time_exceeded_15000:
        receipt_text += f"""
🚨 DICHIARAZIONE SUPERAMENTO SOGLIA €15.000
Il collaboratore dichiara di aver superato, nell'anno {request.year}, la soglia di €15.000 di compensi sportivi dilettantistici complessivi. 
Il collaboratore è consapevole degli obblighi fiscali e contributivi derivanti da tale superamento.
"""

    try:
        # Generate the appropriate PDF based on threshold status
        if first_time_exceeded_15000:
            # Generate €15K threshold communication
            pdf_bytes = generate_threshold_15k_pdf(
                society_name=society_name,
                collaborator_name=coach.get('full_name', 'Collaboratore'),
                collaborator_fiscal_code=coach.get('fiscal_code', ''),
                year=request.year,
                signature_base64=request.signature_base64,
                society_city=society_city
            )
            pdf_filename_prefix = "comunicazione_15k"
            doc_type = "threshold_15000_communication"
            doc_title = f"Comunicazione Superamento €15.000 - {month_name} {request.year}"
        elif first_time_exceeded_5000:
            # Generate €5K threshold communication
            pdf_bytes = generate_threshold_5k_pdf(
                society_name=society_name,
                collaborator_name=coach.get('full_name', 'Collaboratore'),
                collaborator_fiscal_code=coach.get('fiscal_code', ''),
                year=request.year,
                signature_base64=request.signature_base64,
                society_city=society_city
            )
            pdf_filename_prefix = "comunicazione_5k"
            doc_type = "threshold_5000_communication"
            doc_title = f"Comunicazione Superamento €5.000 - {month_name} {request.year}"
        else:
            # Generate standard receipt
            pdf_bytes = generate_monthly_receipt_pdf(
                society_name=society_name,
                collaborator_name=coach.get('full_name', 'Collaboratore'),
                collaborator_fiscal_code=coach.get('fiscal_code', ''),
                month_name=month_name,
                year=request.year,
                amount_gross=request.amount_gross,
                signature_base64=request.signature_base64
            )
            pdf_filename_prefix = "quietanza"
            doc_type = "compensation_receipt"
            doc_title = f"Quietanza Compenso - {month_name} {request.year}"
    except Exception as e:
        logging.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nella generazione del PDF: {str(e)}")
    
    # Save PDF
    receipt_id = str(uuid.uuid4())
    pdf_filename = f"{pdf_filename_prefix}_{coach_id}_{request.year}_{request.month:02d}_{receipt_id}.pdf"
    pdf_path = os.path.join(SIGNED_DOCS_DIR, pdf_filename)
    
    try:
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)
    except Exception as e:
        logging.error(f"Error saving PDF: {e}")
        raise HTTPException(status_code=500, detail="Errore nel salvataggio del documento")
    
    # Store document record
    document_record = {
        "id": receipt_id,
        "document_type": doc_type,
        "document_title": doc_title,
        "coach_id": coach_id,
        "coach_name": coach.get('full_name', ''),
        "month": request.month,
        "year": request.year,
        "amount_gross": request.amount_gross,
        "amount_net": amount_net,
        "deductions": deductions,
        "pdf_path": pdf_path,
        "pdf_filename": pdf_filename,
        "signed_at": now,
        "exceeded_5000": first_time_exceeded_5000,
        "exceeded_15000": first_time_exceeded_15000
    }
    await db.signed_documents.insert_one(document_record)
    
    # Update or create compensation record
    if existing:
        await db.coach_compensations.update_one(
            {"id": existing["id"]},
            {"$set": {
                "amount_gross": request.amount_gross,
                "amount_net": amount_net,
                "deductions": deductions,
                "received": True,
                "received_date": now,
                "receipt_signed": True,
                "receipt_signature_base64": request.signature_base64,
                "receipt_document_id": receipt_id,
                "receipt_signed_date": now,
                "exceeded_5000": first_time_exceeded_5000,
                "exceeded_5000_date": now if first_time_exceeded_5000 else None,
                "exceeded_15000": first_time_exceeded_15000,
                "exceeded_15000_date": now if first_time_exceeded_15000 else None
            }}
        )
    else:
        record = CoachCompensation(
            coach_id=coach_id,
            month=request.month,
            year=request.year,
            amount_gross=request.amount_gross,
            amount_net=amount_net,
            deductions=deductions,
            received=True,
            received_date=now,
            receipt_signed=True,
            receipt_signature_base64=request.signature_base64,
            receipt_document_id=receipt_id,
            receipt_signed_date=now,
            exceeded_5000=first_time_exceeded_5000,
            exceeded_5000_date=now if first_time_exceeded_5000 else None,
            exceeded_15000=first_time_exceeded_15000,
            exceeded_15000_date=now if first_time_exceeded_15000 else None
        )
        await db.coach_compensations.insert_one(record.dict())
    
    # Send emails
    coach_email = coach.get('email')
    
    if coach_email:
        try:
            import base64
            
            # Email to coach
            body = f"""
            <html>
            <body>
            <h2>Quietanza Compenso Sportivo - {month_name} {request.year}</h2>
            <p>Gentile {coach.get('full_name', 'Collaboratore')},</p>
            <p>In allegato trova la quietanza del compenso sportivo dilettantistico firmata per il mese di {month_name} {request.year}.</p>
            <p><strong>Riepilogo:</strong></p>
            <ul>
            <li>Compenso lordo: € {request.amount_gross:.2f}</li>
            <li>Totale annuo progressivo: € {new_total:.2f}</li>
            </ul>
            <hr>
            <p><em>Documento generato automaticamente da RegistraTEAM</em></p>
            </body>
            </html>
            """
            
            # Encode PDF for attachment
            encoded_pdf = base64.b64encode(pdf_bytes).decode()
            
            # Send to coach
            result = await send_email_with_pdf(
                to_email=coach_email,
                subject=f"Quietanza Compenso - {month_name} {request.year} - {society_name}",
                html_content=body,
                pdf_base64=encoded_pdf,
                pdf_filename=pdf_filename,
                to_name=coach.get('full_name', 'Collaboratore')
            )
            
            if result.get("success"):
                logging.info(f"Compensation receipt email sent to {coach_email} via {result.get('provider', 'unknown')}")
            else:
                logging.error(f"Error sending receipt email to coach: {result.get('error')}")
        except Exception as e:
            logging.error(f"Error sending receipt email to coach: {e}")
    
    # Send copy to admin
    if admin_email and admin_email != coach_email:
        try:
            import base64
            
            admin_body = f"""
            <html>
            <body>
            <h2>Quietanza Compenso Firmata - {coach.get('full_name', 'Coach')}</h2>
            <p>Il collaboratore <strong>{coach.get('full_name', 'N/D')}</strong> ha firmato la quietanza del compenso sportivo per {month_name} {request.year}.</p>
            <p><strong>Dettagli:</strong></p>
            <ul>
            <li>Compenso lordo: € {request.amount_gross:.2f}</li>
            <li>Totale annuo progressivo: € {new_total:.2f}</li>
            </ul>
            {'<p style="color: orange;"><strong>⚠️ ATTENZIONE: Il collaboratore ha superato la soglia di €5.000</strong></p>' if first_time_exceeded_5000 else ''}
            {'<p style="color: red;"><strong>🚨 URGENTE: Il collaboratore ha superato la soglia di €15.000</strong></p>' if first_time_exceeded_15000 else ''}
            <hr>
            <p><em>In allegato il documento firmato.</em></p>
            </body>
            </html>
            """
            
            encoded_pdf = base64.b64encode(pdf_bytes).decode()
            
            result = await send_email_with_pdf(
                to_email=admin_email,
                subject=f"[RegistraTEAM] Quietanza firmata - {coach.get('full_name', 'Coach')} - {month_name} {request.year}",
                html_content=admin_body,
                pdf_base64=encoded_pdf,
                pdf_filename=pdf_filename
            )
            
            if result.get("success"):
                logging.info(f"Receipt copy sent to admin {admin_email} via {result.get('provider', 'unknown')}")
            else:
                logging.error(f"Error sending receipt email to admin: {result.get('error')}")
        except Exception as e:
            logging.error(f"Error sending receipt email to admin: {e}")
    
    # Check if this is the FIRST time exceeding €5.000 threshold this year
    # Generate and send "COMUNICAZIONE DI SUPERAMENTO DELLA SOGLIA" document
    if first_time_exceeded_5000:
        # Check if there are previous records this year that already exceeded €5.000
        previous_exceeded = await db.coach_compensations.find_one({
            "coach_id": coach_id,
            "year": request.year,
            "month": {"$lt": request.month},
            "exceeded_5000": True
        })
        
        if not previous_exceeded:
            # This is the FIRST month exceeding €5.000 - generate the threshold document
            try:
                # Use new formatted PDF function
                threshold_pdf_bytes = generate_threshold_5k_pdf(
                    society_name=society_name,
                    collaborator_name=coach.get('full_name', ''),
                    collaborator_fiscal_code=coach.get('fiscal_code', ''),
                    year=request.year,
                    signature_base64=request.signature_base64,
                    society_city=society_city
                )
                
                # Save threshold document
                threshold_doc_id = str(uuid.uuid4())
                threshold_filename = f"comunicazione_superamento_5000_{coach_id}_{request.year}_{threshold_doc_id}.pdf"
                threshold_path = os.path.join(SIGNED_DOCS_DIR, threshold_filename)
                with open(threshold_path, 'wb') as f:
                    f.write(threshold_pdf_bytes)
                
                # Store threshold document record
                threshold_doc_record = {
                    "id": threshold_doc_id,
                    "document_type": "threshold_5000_communication",
                    "document_title": f"Comunicazione Superamento €5.000 - {request.year}",
                    "coach_id": coach_id,
                    "coach_name": coach.get('full_name', ''),
                    "year": request.year,
                    "month": request.month,
                    "total_at_threshold": new_total,
                    "pdf_path": threshold_path,
                    "pdf_filename": threshold_filename,
                    "signed_at": now
                }
                await db.signed_documents.insert_one(threshold_doc_record)
                
                # Send threshold document to coach
                if coach_email:
                    threshold_body = f"""
                    <html>
                    <body>
                    <h2>⚠️ Comunicazione Superamento Soglia €5.000 - Anno {request.year}</h2>
                    <p>Gentile {coach.get('full_name', 'Collaboratore')},</p>
                    <p>Con la quietanza del mese di {month_name} {request.year}, il totale dei compensi sportivi dilettantistici percepiti nell'anno solare {request.year} ha superato la soglia di €5.000.</p>
                    <p><strong>Totale annuo raggiunto: €{new_total:.2f}</strong></p>
                    <p>In allegato trova la <strong>Comunicazione di Superamento della Soglia Previdenziale</strong> firmata.</p>
                    <p>Da questo momento, i compensi eccedenti sono soggetti agli obblighi previdenziali previsti dalla normativa vigente.</p>
                    <p>Cordiali saluti,<br>{society_name}</p>
                    </body>
                    </html>
                    """
                    
                    threshold_pdf_b64 = base64.b64encode(threshold_pdf_bytes).decode('utf-8')
                    result = await send_email_with_pdf(
                        to_email=coach_email,
                        subject=f"⚠️ Comunicazione Superamento €5.000 - Anno {request.year}",
                        body=threshold_body,
                        pdf_base64=threshold_pdf_b64,
                        filename=threshold_filename
                    )
                    if result.get('success'):
                        logging.info(f"Threshold €5.000 communication sent to {coach_email}")
                
                # Send threshold document to admin
                if admin_email:
                    admin_threshold_body = f"""
                    <html>
                    <body>
                    <h2>⚠️ NOTIFICA: Coach ha superato €5.000 - Anno {request.year}</h2>
                    <p>Il coach <strong>{coach.get('full_name', '')}</strong> ha superato la soglia di €5.000 di compensi sportivi dilettantistici.</p>
                    <p><strong>Totale annuo raggiunto: €{new_total:.2f}</strong></p>
                    <p>In allegato la Comunicazione di Superamento firmata dal collaboratore.</p>
                    <p>Ricordiamo che da questo momento i compensi eccedenti sono soggetti agli obblighi previdenziali.</p>
                    </body>
                    </html>
                    """
                    
                    result = await send_email_with_pdf(
                        to_email=admin_email,
                        subject=f"⚠️ {coach.get('full_name', 'Coach')} - Superamento €5.000 Anno {request.year}",
                        body=admin_threshold_body,
                        pdf_base64=threshold_pdf_b64,
                        filename=threshold_filename
                    )
                    if result.get('success'):
                        logging.info(f"Threshold €5.000 notification sent to admin {admin_email}")
                
            except Exception as e:
                logging.error(f"Error generating threshold €5.000 document: {e}")
    
    # Create admin notifications for threshold crossings
    if first_time_exceeded_5000 and not first_time_exceeded_15000:
        notification = AdminNotification(
            type="coach_exceeded_5000",
            title="⚠️ Coach ha superato €5.000",
            message=f"Il coach {coach.get('full_name', 'Sconosciuto')} ha dichiarato di aver superato il limite di €5.000 annuali di compensi sportivi dilettantistici. Data dichiarazione: {now.strftime('%d/%m/%Y %H:%M')}",
            related_user_id=coach_id,
            related_user_name=coach.get('full_name', '')
        )
        await db.admin_notifications.insert_one(notification.dict())
    
    if first_time_exceeded_15000:
        notification = AdminNotification(
            type="coach_exceeded_15000",
            title="🚨 URGENTE: Coach ha superato €15.000",
            message=f"ATTENZIONE: Il coach {coach.get('full_name', 'Sconosciuto')} ha dichiarato di aver superato il limite di €15.000 annuali. Questo comporta obblighi fiscali e contributivi aggiuntivi! Data: {now.strftime('%d/%m/%Y %H:%M')}",
            related_user_id=coach_id,
            related_user_name=coach.get('full_name', '')
        )
        await db.admin_notifications.insert_one(notification.dict())
    
    return {
        "success": True,
        "document_id": receipt_id,
        "message": f"Quietanza firmata con successo. Una copia è stata inviata a {coach_email}",
        "amount_gross": request.amount_gross,
        "amount_net": amount_net,
        "deductions": deductions,
        "yearly_total": new_total,
        "exceeded_5000": first_time_exceeded_5000,
        "exceeded_15000": first_time_exceeded_15000
    }

# ==================== THRESHOLD DECLARATIONS (€5.000 / €15.000) ====================

@api_router.get("/coach/{coach_id}/threshold-status/{year}")
async def get_coach_threshold_status(
    coach_id: str,
    year: int,
    current_user = Depends(get_current_user)
):
    """
    Get the threshold status for a coach for a specific year.
    Returns info about €5.000 and €15.000 thresholds including:
    - Current yearly total
    - Monthly compensation
    - Warning thresholds (total >= threshold - monthly_compensation)
    - Required declarations (total >= threshold)
    - Signed declarations
    """
    # Verify access
    if current_user["role"] not in [UserRole.ADMIN, UserRole.COACH]:
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")
    
    if current_user["role"] == UserRole.COACH and current_user["id"] != coach_id:
        raise HTTPException(status_code=403, detail="Puoi vedere solo i tuoi dati")
    
    # Get coach data
    coach = await db.users.find_one({"id": coach_id})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach non trovato")
    
    monthly_compensation = coach.get("monthly_compensation", 0) or 0
    
    # Calculate yearly total from signed receipts
    yearly_records = await db.coach_compensations.find({
        "coach_id": coach_id,
        "year": year,
        "receipt_signed": True
    }).to_list(12)
    
    yearly_total = sum(r.get("amount_gross", r.get("amount", 0)) for r in yearly_records)
    
    # Get existing declarations for this year
    declarations = await db.threshold_declarations.find({
        "coach_id": coach_id,
        "year": year
    }).to_list(10)
    
    declaration_5000 = next((d for d in declarations if d.get("threshold_type") == "5000"), None)
    declaration_15000 = next((d for d in declarations if d.get("threshold_type") == "15000"), None)
    
    # Calculate thresholds
    warning_5000_threshold = 5000 - monthly_compensation
    warning_15000_threshold = 15000 - monthly_compensation
    
    # Status flags
    needs_warning_5000 = yearly_total >= warning_5000_threshold and yearly_total < 5000
    needs_warning_15000 = yearly_total >= warning_15000_threshold and yearly_total < 15000
    
    needs_declaration_5000 = yearly_total >= 5000 and (not declaration_5000 or not declaration_5000.get("signed"))
    needs_declaration_15000 = yearly_total >= 15000 and (not declaration_15000 or not declaration_15000.get("signed"))
    
    # Blocking status: can't sign new receipts if declaration is needed
    is_blocked = needs_declaration_5000 or needs_declaration_15000
    
    return {
        "coach_id": coach_id,
        "coach_name": coach.get("full_name", ""),
        "year": year,
        "monthly_compensation": monthly_compensation,
        "yearly_total": yearly_total,
        "thresholds": {
            "5000": {
                "threshold": 5000,
                "warning_at": warning_5000_threshold,
                "needs_warning": needs_warning_5000,
                "needs_declaration": needs_declaration_5000,
                "declaration_signed": bool(declaration_5000 and declaration_5000.get("signed")),
                "declaration_date": declaration_5000.get("signed_date") if declaration_5000 else None,
                "document_id": declaration_5000.get("document_id") if declaration_5000 else None
            },
            "15000": {
                "threshold": 15000,
                "warning_at": warning_15000_threshold,
                "needs_warning": needs_warning_15000,
                "needs_declaration": needs_declaration_15000,
                "declaration_signed": bool(declaration_15000 and declaration_15000.get("signed")),
                "declaration_date": declaration_15000.get("signed_date") if declaration_15000 else None,
                "document_id": declaration_15000.get("document_id") if declaration_15000 else None
            }
        },
        "is_blocked": is_blocked,
        "block_reason": "Devi firmare la dichiarazione di superamento soglia prima di poter firmare nuove quietanze" if is_blocked else None
    }


@api_router.post("/coach/{coach_id}/threshold-declaration")
async def sign_threshold_declaration(
    coach_id: str,
    request: ThresholdDeclarationRequest,
    current_user = Depends(get_current_user)
):
    """
    Sign a threshold declaration (€5.000 or €15.000).
    This unblocks the coach from signing new monthly receipts.
    """
    # Verify coach is signing their own declaration
    if current_user["role"] != UserRole.COACH or current_user["id"] != coach_id:
        raise HTTPException(status_code=403, detail="Solo il coach può firmare le proprie dichiarazioni")
    
    if request.threshold_type not in ["5000", "15000"]:
        raise HTTPException(status_code=400, detail="Tipo soglia non valido. Usa '5000' o '15000'")
    
    threshold_amount = 5000.0 if request.threshold_type == "5000" else 15000.0
    
    # Get coach data
    coach = await db.users.find_one({"id": coach_id})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach non trovato")
    
    # Get society data
    society = await db.societies.find_one()
    society_name = society.get("name", "ASD/SSD") if society else "ASD/SSD"
    admin_email = society.get("email") if society else None
    
    # Get settings for more society info
    settings = await db.settings.find_one({"type": "society"})
    fiscal_code_society = settings.get("fiscal_code", "") if settings else ""
    
    # Calculate current yearly total
    yearly_records = await db.coach_compensations.find({
        "coach_id": coach_id,
        "year": request.year,
        "receipt_signed": True
    }).to_list(12)
    
    yearly_total = sum(r.get("amount_gross", r.get("amount", 0)) for r in yearly_records)
    
    # Check if declaration already exists
    existing = await db.threshold_declarations.find_one({
        "coach_id": coach_id,
        "year": request.year,
        "threshold_type": request.threshold_type
    })
    
    if existing and existing.get("signed"):
        raise HTTPException(status_code=400, detail="Dichiarazione già firmata per questo anno e soglia")
    
    now = datetime.utcnow()
    
    # Determine declaration type (previdenziale vs fiscale)
    if request.threshold_type == "5000":
        declaration_type = "PREVIDENZIALE"
        obligation_text = "i compensi eccedenti sono soggetti agli obblighi previdenziali previsti dalla normativa vigente"
        title_suffix = "SOGLIA PREVIDENZIALE €5.000"
    else:
        declaration_type = "FISCALE"
        obligation_text = "i compensi eccedenti sono soggetti a imposizione fiscale secondo la normativa vigente"
        title_suffix = "SOGLIA FISCALE €15.000"
    
    # Generate declaration PDF text
    declaration_text = f"""COMUNICAZIONE DI SUPERAMENTO DELLA SOGLIA {declaration_type} DI COMPENSI SPORTIVI DILETTANTISTICI DI € {threshold_amount:,.2f}

Il/La sottoscritto/a
Nome e Cognome: {coach.get('full_name', 'N/D')}
Codice Fiscale: {coach.get('fiscal_code', 'N/D')}

in relazione al rapporto di collaborazione sportiva dilettantistica con
ASD/SSD: {society_name}
{f"C.F./P.IVA: {fiscal_code_society}" if fiscal_code_society else ""}

COMUNICA

che, alla data odierna, il totale dei compensi percepiti per attività sportiva dilettantistica nell'anno solare {request.year}, anche da altri enti sportivi, ha raggiunto e/o superato l'importo complessivo di € {threshold_amount:,.2f}.

Il sottoscritto dichiara di essere a conoscenza che, dal momento del superamento della suddetta soglia, {obligation_text}.

Si impegna inoltre a comunicare tempestivamente eventuali ulteriori variazioni della propria situazione.

Totale compensi dichiarati: € {yearly_total:,.2f}

Luogo e data: _________________, {now.strftime('%d/%m/%Y')}
"""

    try:
        # Generate PDF
        pdf_bytes = generate_signed_pdf(
            document_title=f"Dichiarazione Superamento {title_suffix}",
            document_text=declaration_text,
            signer_name=coach.get('full_name', 'Collaboratore'),
            signature_base64=request.signature_base64,
            society_name=society_name
        )
    except Exception as e:
        logging.error(f"Error generating declaration PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nella generazione del PDF: {str(e)}")
    
    # Save PDF
    declaration_id = str(uuid.uuid4())
    pdf_filename = f"dichiarazione_{request.threshold_type}_{coach_id}_{request.year}_{declaration_id}.pdf"
    pdf_path = os.path.join(SIGNED_DOCS_DIR, pdf_filename)
    
    try:
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)
    except Exception as e:
        logging.error(f"Error saving declaration PDF: {e}")
        raise HTTPException(status_code=500, detail="Errore nel salvataggio del documento")
    
    # Create or update declaration record
    declaration_data = {
        "coach_id": coach_id,
        "year": request.year,
        "threshold_type": request.threshold_type,
        "threshold_amount": threshold_amount,
        "total_at_declaration": yearly_total,
        "signed": True,
        "signature_base64": request.signature_base64,
        "signed_date": now,
        "document_id": declaration_id,
        "pdf_path": pdf_path
    }
    
    if existing:
        await db.threshold_declarations.update_one(
            {"id": existing["id"]},
            {"$set": declaration_data}
        )
        declaration_data["id"] = existing["id"]
    else:
        declaration = ThresholdDeclaration(**declaration_data)
        await db.threshold_declarations.insert_one(declaration.dict())
        declaration_data["id"] = declaration.id
    
    # Store document record
    document_record = {
        "id": declaration_id,
        "document_type": f"threshold_declaration_{request.threshold_type}",
        "document_title": f"Dichiarazione Superamento {title_suffix}",
        "coach_id": coach_id,
        "coach_name": coach.get('full_name', ''),
        "year": request.year,
        "threshold_type": request.threshold_type,
        "threshold_amount": threshold_amount,
        "pdf_path": pdf_path,
        "pdf_filename": pdf_filename,
        "signed_at": now
    }
    await db.signed_documents.insert_one(document_record)
    
    # Send emails
    coach_email = coach.get('email')
    email_sent = False
    
    # Import email service
    try:
        from email_service import send_email_with_pdf
        import base64
        
        pdf_base64 = base64.b64encode(pdf_bytes).decode()
        
        if coach_email:
            email_body = f"""
            <html>
            <body>
            <h2>Dichiarazione Superamento Soglia € {threshold_amount:,.0f} - Anno {request.year}</h2>
            <p>Gentile {coach.get('full_name', 'Collaboratore')},</p>
            <p>In allegato trova la dichiarazione di superamento della soglia {declaration_type.lower()} di € {threshold_amount:,.2f} firmata.</p>
            <p><strong>Riepilogo:</strong></p>
            <ul>
            <li>Soglia: € {threshold_amount:,.2f}</li>
            <li>Totale compensi dichiarati: € {yearly_total:,.2f}</li>
            <li>Data dichiarazione: {now.strftime('%d/%m/%Y %H:%M')}</li>
            </ul>
            <p><em>Si prega di conservare questo documento per eventuali controlli fiscali.</em></p>
            <hr>
            <p><em>Documento generato automaticamente da RegistraTEAM</em></p>
            </body>
            </html>
            """
            
            result = await send_email_with_pdf(
                to_email=coach_email,
                subject=f"Dichiarazione Superamento € {threshold_amount:,.0f} - Anno {request.year}",
                html_content=email_body,
                pdf_base64=pdf_base64,
                pdf_filename=pdf_filename,
                cc_email=admin_email if admin_email and admin_email != coach_email else None
            )
            
            email_sent = result.get("success", False)
            if email_sent:
                logging.info(f"Declaration email sent to {coach_email}")
        
        # Send separate notification to admin
        if admin_email and admin_email != coach_email:
            alert_emoji = "⚠️" if request.threshold_type == "5000" else "🚨"
            urgency = "ATTENZIONE" if request.threshold_type == "5000" else "URGENTE"
            
            admin_body = f"""
            <html>
            <body>
            <h2>{alert_emoji} {urgency}: Dichiarazione Superamento Soglia € {threshold_amount:,.0f}</h2>
            <p>Il collaboratore <strong>{coach.get('full_name', 'N/D')}</strong> ha firmato la dichiarazione di superamento della soglia {declaration_type.lower()} di € {threshold_amount:,.2f}.</p>
            <p><strong>Dettagli:</strong></p>
            <ul>
            <li>Anno: {request.year}</li>
            <li>Soglia superata: € {threshold_amount:,.2f}</li>
            <li>Totale compensi: € {yearly_total:,.2f}</li>
            <li>Data firma: {now.strftime('%d/%m/%Y %H:%M')}</li>
            </ul>
            <p><em>In allegato il documento firmato.</em></p>
            </body>
            </html>
            """
            
            await send_email_with_pdf(
                to_email=admin_email,
                subject=f"[RegistraTEAM] {alert_emoji} Dichiarazione €{threshold_amount:,.0f} - {coach.get('full_name', 'Coach')}",
                html_content=admin_body,
                pdf_base64=pdf_base64,
                pdf_filename=pdf_filename
            )
    except Exception as e:
        logging.error(f"Error sending declaration email: {e}")
    
    # Update email sent status
    if email_sent:
        await db.threshold_declarations.update_one(
            {"coach_id": coach_id, "year": request.year, "threshold_type": request.threshold_type},
            {"$set": {"email_sent": True, "email_sent_date": now}}
        )
    
    # Create admin notification
    alert_emoji = "⚠️" if request.threshold_type == "5000" else "🚨"
    urgency = "" if request.threshold_type == "5000" else "URGENTE: "
    
    notification = AdminNotification(
        type=f"coach_declaration_{request.threshold_type}",
        title=f"{alert_emoji} {urgency}Dichiarazione €{threshold_amount:,.0f} firmata",
        message=f"Il coach {coach.get('full_name', 'Sconosciuto')} ha firmato la dichiarazione di superamento della soglia {declaration_type.lower()} di € {threshold_amount:,.2f} per l'anno {request.year}. Totale compensi: € {yearly_total:,.2f}",
        related_user_id=coach_id,
        related_user_name=coach.get('full_name', '')
    )
    await db.admin_notifications.insert_one(notification.dict())
    
    return {
        "success": True,
        "declaration_id": declaration_id,
        "threshold_type": request.threshold_type,
        "threshold_amount": threshold_amount,
        "yearly_total": yearly_total,
        "message": f"Dichiarazione firmata con successo. Una copia è stata inviata a {coach_email}",
        "email_sent": email_sent
    }


@api_router.get("/admin/threshold-declarations")
async def get_all_threshold_declarations(
    year: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    """Get all threshold declarations (admin only) with coach info"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere tutte le dichiarazioni")
    
    query = {}
    if year:
        query["year"] = year
    
    declarations = await db.threshold_declarations.find(query).sort([("year", -1), ("signed_date", -1)]).to_list(200)
    
    # Enrich with coach info
    result = []
    for d in declarations:
        coach = await db.users.find_one({"id": d.get("coach_id")})
        clean_mongo_doc(d)
        d["coach_name"] = coach.get("full_name", "N/D") if coach else "N/D"
        d["coach_email"] = coach.get("email", "") if coach else ""
        result.append(d)
    
    return result


@api_router.get("/admin/coaches-threshold-status/{year}")
async def get_all_coaches_threshold_status(
    year: int,
    current_user = Depends(get_current_user)
):
    """Get threshold status for all coaches for a specific year (admin dashboard)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere lo stato di tutti i coach")
    
    # Get all coaches
    coaches = await db.users.find({"role": UserRole.COACH}).to_list(100)
    
    result = []
    for coach in coaches:
        coach_id = coach.get("id")
        monthly_compensation = coach.get("monthly_compensation", 0) or 0
        
        # Get yearly total
        yearly_records = await db.coach_compensations.find({
            "coach_id": coach_id,
            "year": year,
            "receipt_signed": True
        }).to_list(12)
        yearly_total = sum(r.get("amount_gross", r.get("amount", 0)) for r in yearly_records)
        
        # Get declarations
        declarations = await db.threshold_declarations.find({
            "coach_id": coach_id,
            "year": year
        }).to_list(10)
        
        declaration_5000 = next((d for d in declarations if d.get("threshold_type") == "5000"), None)
        declaration_15000 = next((d for d in declarations if d.get("threshold_type") == "15000"), None)
        
        # Calculate warning thresholds
        warning_5000 = yearly_total >= (5000 - monthly_compensation) and yearly_total < 5000
        warning_15000 = yearly_total >= (15000 - monthly_compensation) and yearly_total < 15000
        
        needs_5000 = yearly_total >= 5000 and (not declaration_5000 or not declaration_5000.get("signed"))
        needs_15000 = yearly_total >= 15000 and (not declaration_15000 or not declaration_15000.get("signed"))
        
        status = "ok"
        if needs_15000:
            status = "blocked_15000"
        elif needs_5000:
            status = "blocked_5000"
        elif warning_15000:
            status = "warning_15000"
        elif warning_5000:
            status = "warning_5000"
        
        result.append({
            "coach_id": coach_id,
            "coach_name": coach.get("full_name", ""),
            "coach_email": coach.get("email", ""),
            "monthly_compensation": monthly_compensation,
            "yearly_total": yearly_total,
            "status": status,
            "warning_5000": warning_5000,
            "warning_15000": warning_15000,
            "needs_declaration_5000": needs_5000,
            "needs_declaration_15000": needs_15000,
            "declaration_5000_signed": bool(declaration_5000 and declaration_5000.get("signed")),
            "declaration_15000_signed": bool(declaration_15000 and declaration_15000.get("signed"))
        })
    
    # Sort by status (blocked first, then warnings, then ok)
    status_order = {"blocked_15000": 0, "blocked_5000": 1, "warning_15000": 2, "warning_5000": 3, "ok": 4}
    result.sort(key=lambda x: status_order.get(x["status"], 5))
    
    return result

# ==================== CHAMPIONSHIP ENDPOINTS ====================

@api_router.get("/championships")
async def get_championships(current_user = Depends(get_current_user)):
    """Get all championships"""
    championships = await db.championships.find({}).to_list(100)
    clean_mongo_docs(championships)
    return championships

@api_router.get("/teams/{team_id}/championships")
async def get_team_championships(team_id: str, current_user = Depends(get_current_user)):
    """Get championships for a specific team"""
    championships = await db.championships.find({"team_id": team_id}).to_list(100)
    clean_mongo_docs(championships)
    return championships

@api_router.post("/championships")
async def create_championship(data: ChampionshipCreate, current_user = Depends(get_current_user)):
    """Create a new championship (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può creare campionati")
    
    # Determine current season
    now = datetime.utcnow()
    if now.month >= 7:
        season = f"{now.year}-{now.year + 1}"
    else:
        season = f"{now.year - 1}-{now.year}"
    
    championship = Championship(
        name=data.name,
        team_id=data.team_id,
        season=season,
        federation=data.federation,
        category=data.category,
        notes=data.notes
    )
    
    await db.championships.insert_one(championship.dict())
    return championship

@api_router.delete("/championships/{championship_id}")
async def delete_championship(championship_id: str, current_user = Depends(get_current_user)):
    """Delete a championship (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può eliminare campionati")
    
    await db.championships.delete_one({"id": championship_id})
    return {"message": "Campionato eliminato"}

# ==================== SEASON ARCHIVE ENDPOINTS ====================

def get_current_season():
    """Get current season name based on date (July to June)"""
    now = datetime.utcnow()
    if now.month >= 7:
        return f"{now.year}-{now.year + 1}"
    else:
        return f"{now.year - 1}-{now.year}"

@api_router.get("/seasons")
async def get_seasons(current_user = Depends(get_current_user)):
    """Get all season archives (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere l'archivio")
    
    seasons = await db.season_archives.find({}).sort("start_date", -1).to_list(100)
    clean_mongo_docs(seasons)
    return seasons

@api_router.get("/seasons/current")
async def get_current_season_data(current_user = Depends(get_current_user)):
    """Get current season summary"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i dati stagione")
    
    season_name = get_current_season()
    
    # Get all teams
    teams = await db.teams.find({}).to_list(100)
    clean_mongo_docs(teams)
    
    # Get all athletes
    athletes = await db.athletes.find({}).to_list(1000)
    clean_mongo_docs(athletes)
    
    # Get all coaches
    coaches = await db.users.find({"role": UserRole.COACH, "status": UserStatus.APPROVED}).to_list(100)
    clean_mongo_docs(coaches)
    
    # Get all championships
    championships = await db.championships.find({"season": season_name}).to_list(100)
    clean_mongo_docs(championships)
    
    # Build team summaries
    team_data = []
    for team in teams:
        team_athletes = [a for a in athletes if a.get("team_id") == team["id"] or a.get("team_id_2") == team["id"]]
        team_championships = [c for c in championships if c.get("team_id") == team["id"]]
        team_coaches = [c for c in coaches if team["id"] in c.get("assigned_teams", [])]
        
        team_data.append({
            "id": team["id"],
            "name": team["name"],
            "total_athletes": len(team_athletes),
            "athlete_names": [a["full_name"] for a in team_athletes],
            "championships": [c["name"] for c in team_championships],
            "coach_names": [c["full_name"] for c in team_coaches]
        })
    
    return {
        "season": season_name,
        "is_current": True,
        "total_teams": len(teams),
        "total_athletes": len(athletes),
        "total_coaches": len(coaches),
        "teams": team_data
    }

@api_router.post("/seasons/archive")
async def archive_season(current_user = Depends(get_current_user)):
    """Archive current season and create new one (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può archiviare stagioni")
    
    # Get current season data
    current_data = await get_current_season_data(current_user)
    
    now = datetime.utcnow()
    season_name = get_current_season()
    
    # Determine season dates
    year_parts = season_name.split("-")
    start_year = int(year_parts[0])
    start_date = datetime(start_year, 7, 1)
    end_date = datetime(start_year + 1, 6, 30)
    
    # Create archive record
    archive = SeasonArchive(
        season_name=season_name,
        start_date=start_date,
        end_date=end_date,
        is_current=False,
        teams=current_data["teams"],
        coaches=[{"name": c} for c in set(
            name for t in current_data["teams"] for name in t.get("coach_names", [])
        )],
        total_athletes=current_data["total_athletes"],
        total_teams=current_data["total_teams"],
        archived_at=now,
        archived_by=current_user["id"]
    )
    
    # Check if already archived
    existing = await db.season_archives.find_one({"season_name": season_name})
    if existing:
        # Update existing
        await db.season_archives.update_one(
            {"season_name": season_name},
            {"$set": archive.dict()}
        )
    else:
        await db.season_archives.insert_one(archive.dict())
    
    return {"message": f"Stagione {season_name} archiviata con successo"}

@api_router.get("/seasons/{season_name}")
async def get_season_archive(season_name: str, current_user = Depends(get_current_user)):
    """Get specific season archive details"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere l'archivio")
    
    archive = await db.season_archives.find_one({"season_name": season_name})
    if not archive:
        raise HTTPException(status_code=404, detail="Stagione non trovata")
    
    clean_mongo_doc(archive)
    return archive

# ==================== ROOT ====================

# === TRIAL PERIOD ENDPOINTS ===

@api_router.get("/trial/status/{athlete_id}")
async def get_trial_status(athlete_id: str, current_user = Depends(get_current_user)):
    """Get trial period status for an athlete"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    trial_end_date = athlete.get("trial_end_date")
    privacy_accepted = athlete.get("privacy_accepted", False)
    
    # Check if trial has ended
    trial_ended = False
    if trial_end_date:
        if isinstance(trial_end_date, str):
            trial_end_date = datetime.fromisoformat(trial_end_date.replace('Z', '+00:00'))
        trial_ended = datetime.utcnow() > trial_end_date
    
    return {
        "athlete_id": athlete_id,
        "athlete_name": athlete.get("full_name"),
        "trial_end_date": trial_end_date.isoformat() if trial_end_date else None,
        "trial_ended": trial_ended,
        "privacy_accepted": privacy_accepted,
        "status": athlete.get("status"),
        "requires_action": trial_ended and not privacy_accepted
    }

@api_router.post("/trial/accept-privacy/{athlete_id}")
async def accept_privacy_and_continue(athlete_id: str, current_user = Depends(get_current_user)):
    """Accept privacy and confirm to continue after trial period"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Verify user is the parent of this athlete or the athlete themselves
    if current_user["role"] == "parent":
        is_primary_parent = athlete.get("parent_id") == current_user["id"]
        is_second_parent = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary_parent and not is_second_parent:
            raise HTTPException(status_code=403, detail="Non sei autorizzato a modificare questo atleta")
    elif current_user["role"] == "athlete":
        if athlete.get("email") != current_user["email"]:
            raise HTTPException(status_code=403, detail="Non sei autorizzato a modificare questo atleta")
    elif current_user["role"] not in ["admin"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    # Update athlete with privacy accepted
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {
            "privacy_accepted": True,
            "privacy_accepted_date": datetime.utcnow(),
            "status": "active"
        }}
    )
    
    return {
        "message": f"Privacy accettata per {athlete.get('full_name')}. L'atleta è ora attivo.",
        "status": "active"
    }

@api_router.post("/trial/request-deletion/{athlete_id}")
async def request_data_deletion(athlete_id: str, current_user = Depends(get_current_user)):
    """Request deletion of all athlete data after trial period"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Verify user is the parent of this athlete or the athlete themselves
    if current_user["role"] == "parent":
        is_primary_parent = athlete.get("parent_id") == current_user["id"]
        is_second_parent = athlete.get("second_parent_id") == current_user["id"]
        if not is_primary_parent and not is_second_parent:
            raise HTTPException(status_code=403, detail="Non sei autorizzato a eliminare questo atleta")
    elif current_user["role"] == "athlete":
        if athlete.get("email") != current_user["email"]:
            raise HTTPException(status_code=403, detail="Non sei autorizzato a eliminare questo atleta")
    elif current_user["role"] not in ["admin"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    athlete_name = athlete.get("full_name")
    athlete_email = athlete.get("email")
    parent_email = athlete.get("parent_email")
    
    # Delete all related data
    # 1. Delete payments
    await db.payments.delete_many({"athlete_id": athlete_id})
    
    # 2. Delete certificates
    await db.certificates.delete_many({"athlete_id": athlete_id})
    
    # 3. Delete attendances
    await db.attendances.delete_many({"athlete_id": athlete_id})
    
    # 4. Delete the athlete
    await db.athletes.delete_one({"id": athlete_id})
    
    # 5. Create notification for admin
    notification = {
        "id": str(uuid.uuid4()),
        "type": "athlete_deleted",
        "title": "Atleta cancellato",
        "message": f"L'atleta {athlete_name} ha richiesto la cancellazione dei propri dati al termine del periodo di prova.",
        "related_user_id": athlete_id,
        "related_user_name": athlete_name,
        "read": False,
        "created_at": datetime.utcnow(),
        "society_id": athlete.get("society_id")
    }
    await db.admin_notifications.insert_one(notification)
    
    return {
        "message": f"Tutti i dati di {athlete_name} sono stati eliminati.",
        "deleted_athlete": athlete_name
    }

@api_router.get("/trial/check-pending")
async def check_pending_trials(current_user = Depends(get_current_user)):
    """Check if current user has athletes with expired trial period requiring action"""
    if current_user["role"] not in ["parent", "athlete"]:
        return {"athletes_requiring_action": []}
    
    # Find athletes linked to this user
    if current_user["role"] == "parent":
        athletes = await db.athletes.find({
            "$or": [
                {"parent_id": current_user["id"]},
                {"second_parent_id": current_user["id"]}
            ]
        }).to_list(100)
    else:  # athlete
        athletes = await db.athletes.find({
            "email": current_user["email"]
        }).to_list(100)
    
    athletes_requiring_action = []
    for athlete in athletes:
        trial_end_date = athlete.get("trial_end_date")
        privacy_accepted = athlete.get("privacy_accepted", False)
        
        if trial_end_date:
            if isinstance(trial_end_date, str):
                trial_end_date = datetime.fromisoformat(trial_end_date.replace('Z', '+00:00'))
            
            trial_ended = datetime.utcnow() > trial_end_date
            
            if trial_ended and not privacy_accepted:
                athletes_requiring_action.append({
                    "id": athlete.get("id"),
                    "full_name": athlete.get("full_name"),
                    "team_name": athlete.get("team_name"),
                    "trial_end_date": trial_end_date.isoformat()
                })
    
    return {"athletes_requiring_action": athletes_requiring_action}

# ==========================================
# DIGITAL SIGNATURE ENDPOINTS
# ==========================================

class SignatureDocumentRequest(BaseModel):
    document_type: str  # "privacy_consent", "coach_contract", "compensation_receipt"
    document_title: str
    document_text: str
    signer_name: str
    signer_email: str
    signature_base64: str  # Base64 encoded signature image
    related_entity_id: Optional[str] = None  # athlete_id, coach_id, etc.
    additional_data: Optional[dict] = None  # Any extra data to include

def generate_monthly_receipt_pdf(
    society_name: str,
    collaborator_name: str,
    collaborator_fiscal_code: str,
    month_name: str,
    year: int,
    amount_gross: float,
    signature_base64: str
) -> bytes:
    """Generate monthly compensation receipt PDF with proper formatting"""
    if not HAS_PDF_GENERATION:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    timestamp = datetime.now().strftime("%d/%m/%Y")
    
    # Title - centered, bold
    c.setFont("Helvetica-Bold", 14)
    title = "QUIETANZA COMPENSO SPORTIVO DILETTANTISTICO"
    c.drawCentredString(width/2, height - 3*cm, title)
    
    # Society name
    c.setFont("Helvetica", 11)
    y = height - 4.5*cm
    c.drawString(2*cm, y, f"ASD/SSD: {society_name}")
    
    # Collaborator info
    y -= 1*cm
    c.drawString(2*cm, y, f"Collaboratore: {collaborator_name}")
    
    y -= 0.6*cm
    c.drawString(2*cm, y, f"Codice Fiscale: {collaborator_fiscal_code or '________________________'}")
    
    # Reference month
    y -= 1*cm
    c.drawString(2*cm, y, f"Mese di riferimento: {month_name} {year}")
    
    # Amount - ONLY GROSS, no net
    y -= 1.2*cm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(2*cm, y, f"Compenso lordo: € {amount_gross:.2f}")
    
    # Declaration text
    y -= 1.5*cm
    c.setFont("Helvetica", 10)
    declaration = "Il collaboratore dichiara che, alla data odierna, non sono intervenute variazioni rispetto all'autocertificazione dei compensi sportivi dilettantistici precedentemente resa."
    
    # Word wrap declaration
    words = declaration.split(' ')
    lines = []
    current_line = ""
    max_width = width - 4*cm
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, "Helvetica", 10) < max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    for line in lines:
        c.drawString(2*cm, y, line)
        y -= 0.5*cm
    
    # Signature section
    y -= 1.5*cm
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, y, f"Data: {timestamp}")
    c.drawString(width - 8*cm, y, "Firma collaboratore:")
    
    # Add signature image
    if signature_base64 and HAS_PIL:
        try:
            if ',' in signature_base64:
                signature_base64 = signature_base64.split(',')[1]
            
            sig_data = base64.b64decode(signature_base64)
            sig_image = Image.open(io.BytesIO(sig_data))
            
            # Convert to RGB
            if sig_image.mode != 'RGB':
                if sig_image.mode == 'RGBA':
                    background = Image.new('RGB', sig_image.size, (255, 255, 255))
                    background.paste(sig_image, mask=sig_image.split()[3])
                    sig_image = background
                else:
                    sig_image = sig_image.convert('RGB')
            
            # Normalize colors
            pixels = sig_image.load()
            w, h = sig_image.size
            for py in range(h):
                for px in range(w):
                    r, g, b = pixels[px, py]
                    luminance = (r * 0.299 + g * 0.587 + b * 0.114)
                    if luminance < 200:
                        pixels[px, py] = (0, 0, 0)
                    else:
                        pixels[px, py] = (255, 255, 255)
            
            sig_buffer = io.BytesIO()
            sig_image.save(sig_buffer, format='PNG')
            sig_buffer.seek(0)
            
            from reportlab.lib.utils import ImageReader
            img_reader = ImageReader(sig_buffer)
            c.drawImage(img_reader, width - 8*cm, y - 2.5*cm, width=6*cm, height=2*cm, preserveAspectRatio=True)
        except Exception as e:
            logging.error(f"Error adding signature: {e}")
    
    c.save()
    return buffer.getvalue()

def generate_threshold_5k_pdf(
    society_name: str,
    collaborator_name: str,
    collaborator_fiscal_code: str,
    year: int,
    signature_base64: str,
    society_city: str = "Perugia"
) -> bytes:
    """Generate €5,000 threshold communication PDF"""
    if not HAS_PDF_GENERATION:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    timestamp = datetime.now().strftime("%d/%m/%Y")
    
    # Name is already stored as "COGNOME NOME" in database - use as-is
    formatted_name = collaborator_name
    
    # Title - centered, bold
    c.setFont("Helvetica-Bold", 12)
    title1 = "COMUNICAZIONE DI SUPERAMENTO DELLA SOGLIA PREVIDENZIALE"
    title2 = "DI COMPENSI SPORTIVI DILETTANTISTICI DI € 5.000,00 (Cinquemila/00)"
    c.drawCentredString(width/2, height - 2.5*cm, title1)
    c.drawCentredString(width/2, height - 3.2*cm, title2)
    
    # Intro
    y = height - 5*cm
    c.setFont("Helvetica", 11)
    c.drawString(2*cm, y, "Il/La sottoscritto/a")
    
    # Name and fiscal code - using "Cognome e Nome"
    y -= 0.8*cm
    c.drawString(2*cm, y, f"Cognome e Nome: {formatted_name}")
    
    y -= 0.6*cm
    c.drawString(2*cm, y, f"Codice Fiscale: {collaborator_fiscal_code or '________________________'}")
    
    # Relationship
    y -= 1*cm
    c.drawString(2*cm, y, "in relazione al rapporto di collaborazione sportiva dilettantistica con")
    
    y -= 0.6*cm
    c.drawString(2*cm, y, f"ASD/SSD: {society_name}")
    
    # COMUNICA - centered, spaced
    y -= 1.5*cm
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, y, "C O M U N I C A")
    
    # Communication text
    y -= 1.2*cm
    c.setFont("Helvetica", 10)
    text = f"che, alla data odierna, il totale dei compensi percepiti per attività sportiva dilettantistica nell'anno solare {year}, anche da altri enti sportivi, ha raggiunto e/o superato l'importo complessivo di € 5.000,00."
    
    # Word wrap
    words = text.split(' ')
    lines = []
    current_line = ""
    max_width = width - 4*cm
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, "Helvetica", 10) < max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    for line in lines:
        c.drawString(2*cm, y, line)
        y -= 0.5*cm
    
    # Declaration paragraphs
    y -= 0.8*cm
    decl1 = "Il sottoscritto dichiara di essere a conoscenza che, dal momento del superamento della suddetta soglia, i compensi eccedenti sono soggetti agli obblighi previdenziali previsti dalla normativa vigente."
    
    words = decl1.split(' ')
    lines = []
    current_line = ""
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, "Helvetica", 10) < max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    for line in lines:
        c.drawString(2*cm, y, line)
        y -= 0.5*cm
    
    y -= 0.5*cm
    decl2 = "Si impegna inoltre a comunicare tempestivamente eventuali ulteriori variazioni della propria situazione."
    c.drawString(2*cm, y, decl2)
    
    # Signature section
    y -= 2*cm
    c.drawString(2*cm, y, f"Luogo e data: {society_city}, {timestamp}")
    c.drawString(width - 7*cm, y, "Firma:")
    
    # Add signature image
    if signature_base64 and HAS_PIL:
        try:
            if ',' in signature_base64:
                signature_base64 = signature_base64.split(',')[1]
            
            sig_data = base64.b64decode(signature_base64)
            sig_image = Image.open(io.BytesIO(sig_data))
            
            if sig_image.mode != 'RGB':
                if sig_image.mode == 'RGBA':
                    background = Image.new('RGB', sig_image.size, (255, 255, 255))
                    background.paste(sig_image, mask=sig_image.split()[3])
                    sig_image = background
                else:
                    sig_image = sig_image.convert('RGB')
            
            pixels = sig_image.load()
            w, h = sig_image.size
            for py in range(h):
                for px in range(w):
                    r, g, b = pixels[px, py]
                    luminance = (r * 0.299 + g * 0.587 + b * 0.114)
                    if luminance < 200:
                        pixels[px, py] = (0, 0, 0)
                    else:
                        pixels[px, py] = (255, 255, 255)
            
            sig_buffer = io.BytesIO()
            sig_image.save(sig_buffer, format='PNG')
            sig_buffer.seek(0)
            
            from reportlab.lib.utils import ImageReader
            img_reader = ImageReader(sig_buffer)
            c.drawImage(img_reader, width - 7*cm, y - 2.5*cm, width=5*cm, height=2*cm, preserveAspectRatio=True)
        except Exception as e:
            logging.error(f"Error adding signature: {e}")
    
    c.save()
    return buffer.getvalue()

def generate_threshold_15k_pdf(
    society_name: str,
    collaborator_name: str,
    collaborator_fiscal_code: str,
    year: int,
    signature_base64: str,
    society_city: str = "Perugia"
) -> bytes:
    """Generate €15,000 threshold communication PDF"""
    if not HAS_PDF_GENERATION:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    timestamp = datetime.now().strftime("%d/%m/%Y")
    
    # Name is already stored as "COGNOME NOME" in database - use as-is
    formatted_name = collaborator_name
    
    # Title
    c.setFont("Helvetica-Bold", 12)
    title1 = "COMUNICAZIONE DI SUPERAMENTO DELLA SOGLIA FISCALE"
    title2 = "DEI COMPENSI SPORTIVI DILETTANTISTICI DI € 15.000,00 (Quindicimila)"
    c.drawCentredString(width/2, height - 2.5*cm, title1)
    c.drawCentredString(width/2, height - 3.2*cm, title2)
    
    # Intro
    y = height - 5*cm
    c.setFont("Helvetica", 11)
    c.drawString(2*cm, y, "Il/La sottoscritto/a")
    
    y -= 0.8*cm
    c.drawString(2*cm, y, f"Cognome e Nome: {formatted_name}")
    
    y -= 0.6*cm
    c.drawString(2*cm, y, f"Codice Fiscale: {collaborator_fiscal_code or '________________________'}")
    
    y -= 1*cm
    c.drawString(2*cm, y, "in relazione al rapporto di collaborazione sportiva dilettantistica con")
    
    y -= 0.6*cm
    c.drawString(2*cm, y, f"ASD/SSD: {society_name}")
    
    # COMUNICA
    y -= 1.5*cm
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, y, "C O M U N I C A")
    
    # Communication text
    y -= 1.2*cm
    c.setFont("Helvetica", 10)
    text = f"che, alla data odierna, il totale dei compensi percepiti per attività sportiva dilettantistica nell'anno solare {year}, anche da altri enti sportivi, ha raggiunto e/o superato l'importo complessivo di € 15.000,00."
    
    words = text.split(' ')
    lines = []
    current_line = ""
    max_width = width - 4*cm
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, "Helvetica", 10) < max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    for line in lines:
        c.drawString(2*cm, y, line)
        y -= 0.5*cm
    
    # Declaration - FISCAL instead of PREVIDENZIALE
    y -= 0.8*cm
    decl1 = "Il sottoscritto dichiara di essere a conoscenza che, dal momento del superamento della suddetta soglia, i compensi eccedenti sono soggetti a imposizione fiscale secondo la normativa vigente."
    
    words = decl1.split(' ')
    lines = []
    current_line = ""
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, "Helvetica", 10) < max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    for line in lines:
        c.drawString(2*cm, y, line)
        y -= 0.5*cm
    
    y -= 0.5*cm
    decl2 = "Si impegna inoltre a comunicare tempestivamente eventuali ulteriori variazioni della propria situazione."
    c.drawString(2*cm, y, decl2)
    
    # Signature
    y -= 2*cm
    c.drawString(2*cm, y, f"Luogo e data: {society_city}, {timestamp}")
    c.drawString(width - 7*cm, y, "Firma:")
    
    if signature_base64 and HAS_PIL:
        try:
            if ',' in signature_base64:
                signature_base64 = signature_base64.split(',')[1]
            
            sig_data = base64.b64decode(signature_base64)
            sig_image = Image.open(io.BytesIO(sig_data))
            
            if sig_image.mode != 'RGB':
                if sig_image.mode == 'RGBA':
                    background = Image.new('RGB', sig_image.size, (255, 255, 255))
                    background.paste(sig_image, mask=sig_image.split()[3])
                    sig_image = background
                else:
                    sig_image = sig_image.convert('RGB')
            
            pixels = sig_image.load()
            w, h = sig_image.size
            for py in range(h):
                for px in range(w):
                    r, g, b = pixels[px, py]
                    luminance = (r * 0.299 + g * 0.587 + b * 0.114)
                    if luminance < 200:
                        pixels[px, py] = (0, 0, 0)
                    else:
                        pixels[px, py] = (255, 255, 255)
            
            sig_buffer = io.BytesIO()
            sig_image.save(sig_buffer, format='PNG')
            sig_buffer.seek(0)
            
            from reportlab.lib.utils import ImageReader
            img_reader = ImageReader(sig_buffer)
            c.drawImage(img_reader, width - 7*cm, y - 2.5*cm, width=5*cm, height=2*cm, preserveAspectRatio=True)
        except Exception as e:
            logging.error(f"Error adding signature: {e}")
    
    c.save()
    return buffer.getvalue()

def generate_signed_pdf(
    document_title: str,
    document_text: str,
    signer_name: str,
    signature_base64: str,
    society_name: str = "PALLAVOLO PERUGIA SSD A RL",
    additional_data: dict = None
) -> bytes:
    """Generate a signed PDF document with timestamp"""
    if not HAS_PDF_GENERATION:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Timestamp
    timestamp = datetime.now().strftime("%d/%m/%Y alle %H:%M:%S")
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 2*cm, society_name)
    
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, height - 2.6*cm, "Documento con firma digitale")
    
    # Line separator
    c.setStrokeColor(colors.grey)
    c.line(2*cm, height - 3*cm, width - 2*cm, height - 3*cm)
    
    # Document title
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2*cm, height - 4*cm, document_title)
    
    # Document text - wrap long text
    c.setFont("Helvetica", 10)
    text_lines = []
    words = document_text.split(' ')
    current_line = ""
    max_width = width - 4*cm
    
    for word in words:
        test_line = current_line + " " + word if current_line else word
        if c.stringWidth(test_line, "Helvetica", 10) < max_width:
            current_line = test_line
        else:
            text_lines.append(current_line)
            current_line = word
    if current_line:
        text_lines.append(current_line)
    
    y_position = height - 5*cm
    for line in text_lines[:20]:  # Limit to 20 lines
        c.drawString(2*cm, y_position, line)
        y_position -= 0.5*cm
    
    if len(text_lines) > 20:
        c.drawString(2*cm, y_position, "...")
        y_position -= 0.5*cm
    
    # Additional data if present
    if additional_data:
        y_position -= 0.5*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2*cm, y_position, "Dati aggiuntivi:")
        y_position -= 0.5*cm
        c.setFont("Helvetica", 9)
        for key, value in additional_data.items():
            if y_position < 8*cm:
                break
            c.drawString(2.5*cm, y_position, f"- {key}: {value}")
            y_position -= 0.4*cm
    
    # Signature section
    y_position = min(y_position - 1*cm, 7*cm)
    
    # Signature box
    c.setStrokeColor(colors.HexColor("#007AFF"))
    c.setLineWidth(1)
    c.rect(2*cm, y_position - 3*cm, 8*cm, 3*cm)
    
    # Add signature image
    if signature_base64 and HAS_PIL:
        try:
            # Remove data URL prefix if present
            if ',' in signature_base64:
                signature_base64 = signature_base64.split(',')[1]
            
            sig_data = base64.b64decode(signature_base64)
            sig_image = Image.open(io.BytesIO(sig_data))
            
            # Debug: log image info
            logging.info(f"Signature image mode: {sig_image.mode}, size: {sig_image.size}")
            
            # Convert to RGB first regardless of mode
            if sig_image.mode != 'RGB':
                if sig_image.mode == 'RGBA':
                    # Create white background
                    background = Image.new('RGB', sig_image.size, (255, 255, 255))
                    # Paste using alpha as mask
                    background.paste(sig_image, mask=sig_image.split()[3])
                    sig_image = background
                elif sig_image.mode == 'P':
                    sig_image = sig_image.convert('RGBA')
                    background = Image.new('RGB', sig_image.size, (255, 255, 255))
                    background.paste(sig_image, mask=sig_image.split()[3])
                    sig_image = background
                else:
                    sig_image = sig_image.convert('RGB')
            
            # Now process to ensure black signature on white background
            # Convert any non-white pixels to black
            pixels = sig_image.load()
            width, height = sig_image.size
            
            for y in range(height):
                for x in range(width):
                    r, g, b = pixels[x, y]
                    # Calculate luminance
                    luminance = (r * 0.299 + g * 0.587 + b * 0.114)
                    if luminance < 200:  # Dark pixel (signature stroke)
                        pixels[x, y] = (0, 0, 0)  # Make it pure black
                    else:  # Light pixel (background)
                        pixels[x, y] = (255, 255, 255)  # Make it pure white
            
            # Save to buffer
            sig_buffer = io.BytesIO()
            sig_image.save(sig_buffer, format='PNG')
            sig_buffer.seek(0)
            
            # Draw signature image
            from reportlab.lib.utils import ImageReader
            img_reader = ImageReader(sig_buffer)
            c.drawImage(img_reader, 2.2*cm, y_position - 2.8*cm, width=7.6*cm, height=2.6*cm, preserveAspectRatio=True)
        except Exception as e:
            logging.error(f"Error adding signature image: {e}")
            c.drawString(4*cm, y_position - 1.5*cm, "[Firma digitale]")
    
    # Signer info
    c.setFont("Helvetica-Bold", 10)
    c.drawString(11*cm, y_position - 0.5*cm, "Firmato da:")
    c.setFont("Helvetica", 10)
    c.drawString(11*cm, y_position - 1*cm, signer_name)
    
    c.setFont("Helvetica", 9)
    c.drawString(11*cm, y_position - 1.6*cm, f"Data: {timestamp}")
    
    # Footer with legal notice
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.grey)
    footer_text = "Documento generato automaticamente con firma digitale grafica. Valido ai sensi della normativa vigente."
    c.drawCentredString(width/2, 1.5*cm, footer_text)
    c.drawCentredString(width/2, 1*cm, f"Generato il {timestamp}")
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()

@api_router.post("/documents/sign")
async def sign_document(request: SignatureDocumentRequest, current_user = Depends(get_current_user)):
    """Create a signed document with digital signature and send via email"""
    
    # Get society info
    society = await db.societies.find_one()
    society_name = society.get("name", "PALLAVOLO PERUGIA SSD A RL") if society else "PALLAVOLO PERUGIA SSD A RL"
    society_email = society.get("email") if society else None
    
    # Generate PDF
    try:
        pdf_bytes = generate_signed_pdf(
            document_title=request.document_title,
            document_text=request.document_text,
            signer_name=request.signer_name,
            signature_base64=request.signature_base64,
            society_name=society_name,
            additional_data=request.additional_data
        )
    except Exception as e:
        logging.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nella generazione del PDF: {str(e)}")
    
    # Store signed document record in database
    document_record = {
        "id": str(uuid.uuid4()),
        "document_type": request.document_type,
        "document_title": request.document_title,
        "signer_name": request.signer_name,
        "signer_email": request.signer_email,
        "signer_id": current_user["id"],
        "related_entity_id": request.related_entity_id,
        "signed_at": datetime.utcnow(),
        "pdf_base64": base64.b64encode(pdf_bytes).decode('utf-8'),
        "additional_data": request.additional_data
    }
    await db.signed_documents.insert_one(document_record)
    
    # Send email with PDF attachment
    timestamp_str = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"documento_firmato_{timestamp_str}.pdf"
    
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
    <h2 style="color: #FF9500;">{society_name}</h2>
    <p>Gentile {request.signer_name},</p>
    <p>In allegato trova il documento firmato digitalmente:</p>
    <p><strong>{request.document_title}</strong></p>
    <p>Data firma: {datetime.now().strftime("%d/%m/%Y alle %H:%M")}</p>
    <br>
    <p style="color: #666; font-size: 12px;">
    Questo documento è stato generato automaticamente. 
    Conservi questa email come ricevuta della firma.
    </p>
    <hr>
    <p style="color: #999; font-size: 11px;">
    {society_name}<br>
    Documento firmato digitalmente tramite RegistraTEAM
    </p>
    </body>
    </html>
    """
    
    # Encode PDF for attachment
    encoded_pdf = base64.b64encode(pdf_bytes).decode()
    
    # Send to signer
    try:
        result = await send_email_with_pdf(
            to_email=request.signer_email,
            subject=f"Documento firmato: {request.document_title}",
            html_content=email_body,
            pdf_base64=encoded_pdf,
            pdf_filename=filename,
            to_name=request.signer_name
        )
        
        if result.get("success"):
            logging.info(f"Signed document email sent to {request.signer_email} via {result.get('provider', 'unknown')}")
        else:
            logging.error(f"Error sending email to signer: {result.get('error')}")
    except Exception as e:
        logging.error(f"Error sending email to signer: {e}")
    
    # Send copy to society admin if different email
    if society_email and society_email != request.signer_email:
        try:
            admin_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #FF9500;">{society_name}</h2>
            <p><strong>Nuovo documento firmato</strong></p>
            <p>Tipo documento: {request.document_type}</p>
            <p>Titolo: {request.document_title}</p>
            <p>Firmato da: {request.signer_name}</p>
            <p>Email: {request.signer_email}</p>
            <p>Data firma: {datetime.now().strftime("%d/%m/%Y alle %H:%M")}</p>
            <br>
            <p>Il documento firmato è allegato a questa email.</p>
            </body>
            </html>
            """
            
            result = await send_email_with_pdf(
                to_email=society_email,
                subject=f"[Copia] Documento firmato da {request.signer_name}: {request.document_title}",
                html_content=admin_body,
                pdf_base64=encoded_pdf,
                pdf_filename=filename
            )
            
            if result.get("success"):
                logging.info(f"Signed document copy sent to admin {society_email} via {result.get('provider', 'unknown')}")
            else:
                logging.error(f"Error sending email to admin: {result.get('error')}")
        except Exception as e:
            logging.error(f"Error sending email to admin: {e}")
    
    return {
        "success": True,
        "document_id": document_record["id"],
        "message": f"Documento firmato con successo. Una copia è stata inviata a {request.signer_email}"
    }

@api_router.get("/documents/signed/{document_id}/pdf")
async def get_signed_document_pdf(document_id: str, current_user = Depends(get_current_user)):
    """Download a signed document PDF"""
    document = await db.signed_documents.find_one({"id": document_id})
    
    if not document:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    # Check access: only signer or admin can view
    if document["signer_id"] != current_user["id"] and current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non autorizzato a visualizzare questo documento")
    
    pdf_bytes = base64.b64decode(document["pdf_base64"])
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=documento_firmato_{document_id}.pdf"}
    )

@api_router.get("/documents/signed")
async def list_signed_documents(current_user = Depends(get_current_user)):
    """List signed documents for current user or all for admin"""
    query = {}
    
    if current_user["role"] != UserRole.ADMIN:
        query["signer_id"] = current_user["id"]
    
    documents = await db.signed_documents.find(query, {"pdf_base64": 0}).to_list(100)
    
    for doc in documents:
        clean_mongo_doc(doc)
    
    return documents

# ==================== DIRIGENTE COMPENSATION ENDPOINTS ====================

@api_router.get("/dirigente/{dirigente_id}/compensation")
async def get_dirigente_compensation(dirigente_id: str, current_user = Depends(get_current_user)):
    """Get compensation records for a dirigente"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.VIEWER]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    if current_user["role"] == UserRole.VIEWER and current_user["id"] != dirigente_id:
        raise HTTPException(status_code=403, detail="Puoi vedere solo i tuoi compensi")
    
    records = await db.dirigente_compensations.find({"dirigente_id": dirigente_id}).sort([("year", -1), ("month", -1)]).to_list(100)
    clean_mongo_docs(records)
    return records

@api_router.post("/dirigente/{dirigente_id}/compensation")
async def set_dirigente_compensation(dirigente_id: str, amount: float, current_user = Depends(get_current_user)):
    """Set monthly compensation for a dirigente (admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può impostare compensi")
    
    # Update dirigente record
    await db.users.update_one(
        {"id": dirigente_id, "role": UserRole.VIEWER},
        {"$set": {
            "monthly_compensation": amount,
            "compensation_accepted": False  # Reset acceptance
        }}
    )
    
    return {"message": "Compenso mensile impostato", "amount": amount}

@api_router.post("/dirigente/{dirigente_id}/accept-compensation")
async def accept_dirigente_compensation(dirigente_id: str, current_user = Depends(get_current_user)):
    """Dirigente accepts the compensation offer"""
    # Allow both VIEWER (dirigente) and ADMIN to accept their own compensation
    if current_user["id"] != dirigente_id:
        raise HTTPException(status_code=403, detail="Solo il dirigente può accettare il proprio compenso")
    if current_user["role"] not in [UserRole.VIEWER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Update dirigente record
    now = datetime.utcnow()
    # Calculate contract end date (31/05 of current season)
    season_end_year = now.year if now.month <= 5 else now.year + 1
    contract_end = datetime(season_end_year, 5, 31)
    
    await db.users.update_one(
        {"id": dirigente_id},
        {"$set": {
            "compensation_accepted": True,
            "compensation_accepted_date": now,
            "contract_start_date": now,
            "contract_end_date": contract_end
        }}
    )
    
    return {"message": "Compenso accettato", "contract_end": contract_end.strftime("%d/%m/%Y")}

@api_router.get("/dirigente/{dirigente_id}/compensation/annual/{year}")
async def get_dirigente_annual_compensation_summary(dirigente_id: str, year: int, current_user = Depends(get_current_user)):
    """Get annual summary of compensations for dirigente"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.VIEWER]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    records = await db.dirigente_compensations.find({
        "dirigente_id": dirigente_id,
        "year": year,
        "received": True
    }).to_list(12)
    
    total = sum(r.get("amount", 0) for r in records)
    exceeded_month = next((r for r in records if r.get("exceeded_5000")), None)
    
    return {
        "year": year,
        "total_received": total,
        "months_received": len(records),
        "exceeded_5000": exceeded_month is not None,
        "exceeded_month": exceeded_month.get("month") if exceeded_month else None
    }

@api_router.post("/dirigente/{dirigente_id}/compensation/receipt")
async def sign_dirigente_compensation_receipt(
    dirigente_id: str,
    request: CompensationReceiptRequest,
    current_user = Depends(get_current_user)
):
    """Dirigente firma la quietanza mensile di compenso sportivo dilettantistico"""
    # Allow both VIEWER (dirigente) and ADMIN to sign their own receipts
    if current_user["id"] != dirigente_id:
        raise HTTPException(status_code=403, detail="Solo il dirigente può firmare le proprie quietanze")
    if current_user["role"] not in [UserRole.VIEWER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    # Get dirigente data
    dirigente = await db.users.find_one({"id": dirigente_id})
    if not dirigente:
        raise HTTPException(status_code=404, detail="Dirigente non trovato")
    
    # Get society data from settings and societies collection
    society_settings = await db.settings.find_one({"type": "society"})
    society = await db.societies.find_one()
    society_name = (society_settings.get("name") if society_settings else None) or (society.get("name") if society else None) or "ASD/SSD"
    admin_email = (society_settings.get("email") if society_settings else None) or (society.get("email") if society else None)
    society_city = (society_settings.get("city") if society_settings else None) or (society.get("city") if society else None) or "Perugia"
    
    # Get prior compensation (declared at hiring)
    prior_compensation = dirigente.get("other_annual_compensation", 0) or 0
    
    # Calculate yearly totals to check thresholds
    yearly_records = await db.dirigente_compensations.find({
        "dirigente_id": dirigente_id,
        "year": request.year,
        "received": True
    }).to_list(12)
    
    yearly_total_from_receipts = sum(r.get("amount_gross", r.get("amount", 0)) for r in yearly_records)
    
    # Add prior compensation to the first year of contract
    contract_start = dirigente.get("contract_start_date")
    contract_start_year = None
    if contract_start:
        if isinstance(contract_start, str):
            contract_start_year = int(contract_start.split('-')[0])
        elif hasattr(contract_start, 'year'):
            contract_start_year = contract_start.year
    
    # Include prior compensation in the first year of contract
    if contract_start_year and request.year == contract_start_year:
        yearly_total = yearly_total_from_receipts + prior_compensation
    else:
        yearly_total = yearly_total_from_receipts
    
    new_total = yearly_total + request.amount_gross
    logging.info(f"Dirigente compensation calculation: prior={prior_compensation}, yearly_receipts={yearly_total_from_receipts}, year={request.year}, contract_start_year={contract_start_year}, new_total={new_total}")
    
    # Calculate net amount (lordo = netto fino a €5.000)
    amount_net = request.amount_gross
    deductions = 0.0
    
    # Determina se QUESTA è la prima volta che si supera €5.000 o €15.000
    first_time_exceeded_5000 = (new_total > 5000 and yearly_total <= 5000)
    first_time_exceeded_15000 = (new_total > 15000 and yearly_total <= 15000)
    
    logging.info(f"Dirigente threshold check: yearly_total={yearly_total}, new_total={new_total}, first_5k={first_time_exceeded_5000}, first_15k={first_time_exceeded_15000}")
    
    # Se si supera €5.000 o €15.000 si applicano ritenute
    if new_total > 5000:
        if new_total > 15000:
            deductions = request.amount_gross * 0.33
        else:
            deductions = request.amount_gross * 0.23
        amount_net = request.amount_gross - deductions
    
    # Check if record exists for this month
    existing = await db.dirigente_compensations.find_one({
        "dirigente_id": dirigente_id,
        "year": request.year,
        "month": request.month
    })
    
    now = datetime.utcnow()
    month_names = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                   "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
    month_name = month_names[request.month]
    
    try:
        # Generate the appropriate PDF based on threshold status
        if first_time_exceeded_15000:
            pdf_bytes = generate_threshold_15k_pdf(
                society_name=society_name,
                collaborator_name=dirigente.get('full_name', 'Collaboratore'),
                collaborator_fiscal_code=dirigente.get('fiscal_code', ''),
                year=request.year,
                signature_base64=request.signature_base64,
                society_city=society_city
            )
            pdf_filename_prefix = "comunicazione_15k_dirigente"
            doc_type = "threshold_15000_communication"
            doc_title = f"Comunicazione Superamento €15.000 - {month_name} {request.year}"
        elif first_time_exceeded_5000:
            pdf_bytes = generate_threshold_5k_pdf(
                society_name=society_name,
                collaborator_name=dirigente.get('full_name', 'Collaboratore'),
                collaborator_fiscal_code=dirigente.get('fiscal_code', ''),
                year=request.year,
                signature_base64=request.signature_base64,
                society_city=society_city
            )
            pdf_filename_prefix = "comunicazione_5k_dirigente"
            doc_type = "threshold_5000_communication"
            doc_title = f"Comunicazione Superamento €5.000 - {month_name} {request.year}"
        else:
            pdf_bytes = generate_monthly_receipt_pdf(
                society_name=society_name,
                collaborator_name=dirigente.get('full_name', 'Collaboratore'),
                collaborator_fiscal_code=dirigente.get('fiscal_code', ''),
                month_name=month_name,
                year=request.year,
                amount_gross=request.amount_gross,
                signature_base64=request.signature_base64
            )
            pdf_filename_prefix = "quietanza_dirigente"
            doc_type = "compensation_receipt"
            doc_title = f"Quietanza Compenso Dirigente - {month_name} {request.year}"
    except Exception as e:
        logging.error(f"Error generating PDF for dirigente: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nella generazione del PDF: {str(e)}")
    
    # Save PDF
    receipt_id = str(uuid.uuid4())
    pdf_filename = f"{pdf_filename_prefix}_{dirigente_id}_{request.year}_{request.month:02d}_{receipt_id}.pdf"
    pdf_path = os.path.join(SIGNED_DOCS_DIR, pdf_filename)
    
    try:
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)
    except Exception as e:
        logging.error(f"Error saving PDF for dirigente: {e}")
        raise HTTPException(status_code=500, detail="Errore nel salvataggio del documento")
    
    # Store document record
    document_record = {
        "id": receipt_id,
        "document_type": doc_type,
        "document_title": doc_title,
        "dirigente_id": dirigente_id,
        "dirigente_name": dirigente.get('full_name', ''),
        "month": request.month,
        "year": request.year,
        "amount_gross": request.amount_gross,
        "amount_net": amount_net,
        "deductions": deductions,
        "pdf_path": pdf_path,
        "pdf_filename": pdf_filename,
        "signed_at": now,
        "exceeded_5000": first_time_exceeded_5000,
        "exceeded_15000": first_time_exceeded_15000
    }
    await db.signed_documents.insert_one(document_record)
    
    # Update or create compensation record
    if existing:
        await db.dirigente_compensations.update_one(
            {"id": existing["id"]},
            {"$set": {
                "amount_gross": request.amount_gross,
                "amount_net": amount_net,
                "deductions": deductions,
                "received": True,
                "received_date": now,
                "receipt_signed": True,
                "receipt_signature_base64": request.signature_base64,
                "receipt_document_id": receipt_id,
                "receipt_signed_date": now,
                "exceeded_5000": first_time_exceeded_5000,
                "exceeded_5000_date": now if first_time_exceeded_5000 else None,
                "exceeded_15000": first_time_exceeded_15000,
                "exceeded_15000_date": now if first_time_exceeded_15000 else None
            }}
        )
    else:
        record = DirigenteCompensation(
            dirigente_id=dirigente_id,
            month=request.month,
            year=request.year,
            amount_gross=request.amount_gross,
            amount_net=amount_net,
            deductions=deductions,
            received=True,
            received_date=now,
            receipt_signed=True,
            receipt_signature_base64=request.signature_base64,
            receipt_document_id=receipt_id,
            receipt_signed_date=now,
            exceeded_5000=first_time_exceeded_5000,
            exceeded_5000_date=now if first_time_exceeded_5000 else None,
            exceeded_15000=first_time_exceeded_15000,
            exceeded_15000_date=now if first_time_exceeded_15000 else None
        )
        await db.dirigente_compensations.insert_one(record.dict())
    
    # Send emails
    dirigente_email = dirigente.get('email')
    
    if dirigente_email:
        try:
            body = f"""
            <html>
            <body>
            <h2>Quietanza Compenso Sportivo - {month_name} {request.year}</h2>
            <p>Gentile {dirigente.get('full_name', 'Collaboratore')},</p>
            <p>In allegato trova la quietanza del compenso sportivo dilettantistico firmata per il mese di {month_name} {request.year}.</p>
            <p><strong>Riepilogo:</strong></p>
            <ul>
            <li>Compenso lordo: € {request.amount_gross:.2f}</li>
            <li>Totale annuo progressivo: € {new_total:.2f}</li>
            </ul>
            <hr>
            <p><em>Documento generato automaticamente da RegistraTEAM</em></p>
            </body>
            </html>
            """
            
            encoded_pdf = base64.b64encode(pdf_bytes).decode()
            
            result = await send_email_with_pdf(
                to_email=dirigente_email,
                subject=f"Quietanza Compenso Dirigente - {month_name} {request.year} - {society_name}",
                html_content=body,
                pdf_base64=encoded_pdf,
                pdf_filename=pdf_filename,
                to_name=dirigente.get('full_name', 'Collaboratore')
            )
            
            if result.get("success"):
                logging.info(f"Dirigente compensation receipt email sent to {dirigente_email} via {result.get('provider', 'unknown')}")
            else:
                logging.error(f"Error sending receipt email to dirigente: {result.get('error')}")
        except Exception as e:
            logging.error(f"Error sending receipt email to dirigente: {e}")
    
    # Send copy to admin
    if admin_email and admin_email != dirigente_email:
        try:
            admin_body = f"""
            <html>
            <body>
            <h2>Quietanza Compenso Firmata - {dirigente.get('full_name', 'Dirigente')}</h2>
            <p>Il dirigente <strong>{dirigente.get('full_name', 'N/D')}</strong> ha firmato la quietanza del compenso sportivo per {month_name} {request.year}.</p>
            <p><strong>Dettagli:</strong></p>
            <ul>
            <li>Compenso lordo: € {request.amount_gross:.2f}</li>
            <li>Totale annuo progressivo: € {new_total:.2f}</li>
            </ul>
            {'<p style="color: orange;"><strong>⚠️ ATTENZIONE: Il dirigente ha superato la soglia di €5.000</strong></p>' if first_time_exceeded_5000 else ''}
            {'<p style="color: red;"><strong>🚨 URGENTE: Il dirigente ha superato la soglia di €15.000</strong></p>' if first_time_exceeded_15000 else ''}
            <hr>
            <p><em>In allegato il documento firmato.</em></p>
            </body>
            </html>
            """
            
            encoded_pdf = base64.b64encode(pdf_bytes).decode()
            
            result = await send_email_with_pdf(
                to_email=admin_email,
                subject=f"[RegistraTEAM] Quietanza firmata - {dirigente.get('full_name', 'Dirigente')} - {month_name} {request.year}",
                html_content=admin_body,
                pdf_base64=encoded_pdf,
                pdf_filename=pdf_filename
            )
            
            if result.get("success"):
                logging.info(f"Dirigente receipt copy sent to admin {admin_email}")
            else:
                logging.error(f"Error sending dirigente receipt email to admin: {result.get('error')}")
        except Exception as e:
            logging.error(f"Error sending dirigente receipt email to admin: {e}")
    
    # Notify admin if thresholds exceeded
    if first_time_exceeded_5000:
        notification = AdminNotification(
            type="dirigente_exceeded_5000",
            title="⚠️ Dirigente ha superato €5.000",
            message=f"Il dirigente {dirigente.get('full_name', 'Sconosciuto')} ha superato il limite di €5.000 annuali di compensi sportivi dilettantistici.",
            related_user_id=dirigente_id,
            related_user_name=dirigente.get('full_name', '')
        )
        await db.admin_notifications.insert_one(notification.dict())
    
    if first_time_exceeded_15000:
        notification = AdminNotification(
            type="dirigente_exceeded_15000",
            title="🚨 URGENTE: Dirigente ha superato €15.000",
            message=f"ATTENZIONE: Il dirigente {dirigente.get('full_name', 'Sconosciuto')} ha superato il limite di €15.000 annuali. Obblighi fiscali e contributivi!",
            related_user_id=dirigente_id,
            related_user_name=dirigente.get('full_name', '')
        )
        await db.admin_notifications.insert_one(notification.dict())
    
    return {
        "message": "Quietanza firmata con successo",
        "receipt_id": receipt_id,
        "amount_gross": request.amount_gross,
        "amount_net": amount_net,
        "deductions": deductions,
        "yearly_total": new_total,
        "exceeded_5000": first_time_exceeded_5000,
        "exceeded_15000": first_time_exceeded_15000
    }

@api_router.get("/dirigente/{dirigente_id}/threshold-status/{year}")
async def get_dirigente_threshold_status(dirigente_id: str, year: int, current_user = Depends(get_current_user)):
    """Get threshold status for a dirigente in a specific year"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.VIEWER]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    if current_user["role"] == UserRole.VIEWER and current_user["id"] != dirigente_id:
        raise HTTPException(status_code=403, detail="Puoi vedere solo i tuoi dati")
    
    dirigente = await db.users.find_one({"id": dirigente_id})
    if not dirigente:
        raise HTTPException(status_code=404, detail="Dirigente non trovato")
    
    monthly_compensation = dirigente.get("monthly_compensation", 0) or 0
    prior_compensation = dirigente.get("other_annual_compensation", 0) or 0
    
    yearly_records = await db.dirigente_compensations.find({
        "dirigente_id": dirigente_id,
        "year": year,
        "receipt_signed": True
    }).to_list(12)
    
    yearly_total = sum(r.get("amount_gross", r.get("amount", 0)) for r in yearly_records)
    
    # Add prior compensation if this is the first year of contract
    contract_start = dirigente.get("contract_start_date")
    contract_start_year = None
    if contract_start:
        if isinstance(contract_start, str):
            contract_start_year = int(contract_start.split('-')[0])
        elif hasattr(contract_start, 'year'):
            contract_start_year = contract_start.year
    
    if contract_start_year and year == contract_start_year:
        yearly_total += prior_compensation
    
    # Check if thresholds have been exceeded
    exceeded_5000_record = next((r for r in yearly_records if r.get("exceeded_5000")), None)
    exceeded_15000_record = next((r for r in yearly_records if r.get("exceeded_15000")), None)
    
    # Calculate if we're approaching thresholds
    next_total = yearly_total + monthly_compensation
    approaching_5000 = (yearly_total < 5000 and next_total > 4500)
    approaching_15000 = (yearly_total < 15000 and next_total > 14500)
    
    # Check if blocked (exceeded but not declared)
    needs_5000_declaration = (yearly_total > 5000 and not exceeded_5000_record)
    needs_15000_declaration = (yearly_total > 15000 and not exceeded_15000_record)
    is_blocked = needs_5000_declaration or needs_15000_declaration
    
    return {
        "dirigente_id": dirigente_id,
        "year": year,
        "monthly_compensation": monthly_compensation,
        "prior_compensation": prior_compensation,
        "yearly_total": yearly_total,
        "thresholds": {
            "5000": {
                "threshold": 5000,
                "warning_at": 4500,
                "needs_warning": approaching_5000,
                "needs_declaration": needs_5000_declaration,
                "declaration_signed": exceeded_5000_record is not None,
                "declaration_date": exceeded_5000_record.get("exceeded_5000_date") if exceeded_5000_record else None
            },
            "15000": {
                "threshold": 15000,
                "warning_at": 14500,
                "needs_warning": approaching_15000,
                "needs_declaration": needs_15000_declaration,
                "declaration_signed": exceeded_15000_record is not None,
                "declaration_date": exceeded_15000_record.get("exceeded_15000_date") if exceeded_15000_record else None
            }
        },
        "is_blocked": is_blocked,
        "block_reason": "Devi prima firmare la dichiarazione di superamento soglia." if is_blocked else None
    }



# ==================== PRIME SQUADRE (ATLETI PRO) ENDPOINTS ====================

@api_router.get("/prime-squadre/athletes")
async def get_prime_squadre_athletes(current_user = Depends(get_current_user)):
    """Get list of athletes with compensation enabled (Prime Squadre members)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può accedere a Prime Squadre")
    
    # Check if pro_enabled is true for this society
    settings = await db.settings.find_one({"type": "society"})
    if not settings or not settings.get("pro_enabled", False):
        raise HTTPException(status_code=403, detail="Modulo Prime Squadre non attivato per questa società")
    
    # Get athletes with is_compensated = True
    athletes = await db.athletes.find({"is_compensated": True}).to_list(100)
    clean_mongo_docs(athletes)
    
    # Get their compensation records for the current year
    current_year = datetime.utcnow().year
    for athlete in athletes:
        records = await db.atleta_pro_compensations.find({
            "atleta_id": athlete["id"],
            "year": current_year
        }).to_list(12)
        
        yearly_total = sum(r.get("amount_gross", 0) for r in records if r.get("receipt_signed"))
        months_received = len([r for r in records if r.get("receipt_signed")])
        
        athlete["compensation_summary"] = {
            "yearly_total": yearly_total,
            "months_received": months_received,
            "monthly_amount": athlete.get("monthly_compensation", 0)
        }
    
    return athletes

@api_router.post("/prime-squadre/athletes/{athlete_id}/enable")
async def enable_athlete_compensation(athlete_id: str, current_user = Depends(get_current_user)):
    """Enable compensation for an athlete (add to Prime Squadre)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire Prime Squadre")
    
    # Check if pro_enabled
    settings = await db.settings.find_one({"type": "society"})
    if not settings or not settings.get("pro_enabled", False):
        raise HTTPException(status_code=403, detail="Modulo Prime Squadre non attivato")
    
    # Check member limit (50)
    current_count = await db.athletes.count_documents({"is_compensated": True})
    if current_count >= 50:
        raise HTTPException(status_code=400, detail="Raggiunto il limite massimo di 50 membri Prime Squadre")
    
    # Update athlete - just enable, config will be done via update endpoint
    result = await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {"is_compensated": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    return {"message": "Atleta aggiunto a Prime Squadre", "athlete_id": athlete_id}


class PrimeSquadreAthleteUpdate(BaseModel):
    """Update Prime Squadre athlete configuration"""
    monthly_compensation: Optional[float] = None
    other_annual_compensation: Optional[float] = None
    contract_start_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    fees_waived: Optional[bool] = None


@api_router.patch("/prime-squadre/athletes/{athlete_id}")
async def update_prime_squadre_athlete(
    athlete_id: str, 
    data: PrimeSquadreAthleteUpdate,
    current_user = Depends(get_current_user)
):
    """Update Prime Squadre athlete configuration (compensation, contract dates, fees)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare Prime Squadre")
    
    # Verify athlete is in Prime Squadre
    athlete = await db.athletes.find_one({"id": athlete_id, "is_compensated": True})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato in Prime Squadre")
    
    update_dict = {}
    if data.monthly_compensation is not None:
        update_dict["monthly_compensation"] = data.monthly_compensation
    if data.other_annual_compensation is not None:
        update_dict["other_annual_compensation"] = data.other_annual_compensation
    if data.contract_start_date is not None:
        update_dict["contract_start_date"] = data.contract_start_date
    if data.contract_end_date is not None:
        update_dict["contract_end_date"] = data.contract_end_date
    if data.fees_waived is not None:
        update_dict["fees_waived"] = data.fees_waived
    
    if update_dict:
        await db.athletes.update_one(
            {"id": athlete_id},
            {"$set": update_dict}
        )
    
    # Return updated athlete
    updated = await db.athletes.find_one({"id": athlete_id})
    clean_mongo_docs([updated])
    return updated


@api_router.post("/prime-squadre/athletes/{athlete_id}/disable")
async def disable_athlete_compensation(athlete_id: str, current_user = Depends(get_current_user)):
    """Disable compensation for an athlete (remove from Prime Squadre)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire Prime Squadre")
    
    result = await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {"is_compensated": False, "monthly_compensation": 0}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    return {"message": "Atleta rimosso da Prime Squadre", "athlete_id": athlete_id}

@api_router.post("/prime-squadre/athletes/{athlete_id}/set-compensation")
async def set_athlete_compensation(athlete_id: str, amount: float, current_user = Depends(get_current_user)):
    """Set monthly compensation for an athlete"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può impostare compensi")
    
    # Verify athlete is in Prime Squadre
    athlete = await db.athletes.find_one({"id": athlete_id, "is_compensated": True})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato in Prime Squadre")
    
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {"monthly_compensation": amount}}
    )
    
    return {"message": "Compenso mensile impostato", "amount": amount}

@api_router.get("/prime-squadre/athletes/{athlete_id}/compensation")
async def get_athlete_compensation_records(athlete_id: str, current_user = Depends(get_current_user)):
    """Get compensation records for an athlete"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può visualizzare i compensi")
    
    records = await db.atleta_pro_compensations.find({"atleta_id": athlete_id}).sort([("year", -1), ("month", -1)]).to_list(100)
    clean_mongo_docs(records)
    return records

@api_router.post("/prime-squadre/athletes/{athlete_id}/compensation/receipt")
async def sign_athlete_compensation_receipt(
    athlete_id: str,
    request: CompensationReceiptRequest,
    current_user = Depends(get_current_user)
):
    """Sign monthly compensation receipt for an athlete (admin signs on behalf)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire le quietanze")
    
    # Get athlete
    athlete = await db.athletes.find_one({"id": athlete_id, "is_compensated": True})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato in Prime Squadre")
    
    monthly_compensation = athlete.get("monthly_compensation", 0)
    if monthly_compensation <= 0:
        raise HTTPException(status_code=400, detail="Compenso mensile non impostato")
    
    # Get society settings for PDF generation
    society_settings = await db.settings.find_one({"type": "society"})
    if not society_settings:
        raise HTTPException(status_code=400, detail="Impostazioni società non configurate")
    
    year = request.year
    month = request.month
    
    # Check if already signed
    existing = await db.atleta_pro_compensations.find_one({
        "atleta_id": athlete_id,
        "year": year,
        "month": month,
        "receipt_signed": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="Quietanza già firmata per questo mese")
    
    # Calculate yearly total to check thresholds
    prior_compensation = athlete.get("other_annual_compensation", 0) or 0
    yearly_records = await db.atleta_pro_compensations.find({
        "atleta_id": athlete_id,
        "year": year,
        "receipt_signed": True
    }).to_list(12)
    
    yearly_total = sum(r.get("amount_gross", 0) for r in yearly_records)
    
    # Add prior compensation if this is the first year of contract
    contract_start = athlete.get("contract_start_date")
    contract_start_year = None
    if contract_start:
        if isinstance(contract_start, str):
            contract_start_year = int(contract_start.split('-')[0])
        elif hasattr(contract_start, 'year'):
            contract_start_year = contract_start.year
    
    if contract_start_year and year == contract_start_year:
        yearly_total += prior_compensation
    
    new_total = yearly_total + monthly_compensation
    exceeded_5000 = new_total > 5000
    exceeded_15000 = new_total > 15000
    
    now = datetime.utcnow()
    
    # Create or update record
    record_id = str(ObjectId())
    record = AtletaProCompensation(
        id=record_id,
        atleta_id=athlete_id,
        month=month,
        year=year,
        amount_gross=monthly_compensation,
        amount_net=monthly_compensation,
        deductions=0,
        received=True,
        received_date=now,
        receipt_signed=True,
        receipt_signature_base64=request.signature_base64,
        receipt_signed_date=now,
        exceeded_5000=exceeded_5000,
        exceeded_5000_date=now if exceeded_5000 else None,
        exceeded_15000=exceeded_15000,
        exceeded_15000_date=now if exceeded_15000 else None
    )
    
    # Check if record exists (update) or insert new
    existing_record = await db.atleta_pro_compensations.find_one({
        "atleta_id": athlete_id,
        "year": year,
        "month": month
    })
    
    if existing_record:
        await db.atleta_pro_compensations.update_one(
            {"atleta_id": athlete_id, "year": year, "month": month},
            {"$set": record.dict()}
        )
    else:
        await db.atleta_pro_compensations.insert_one(record.dict())
    
    return {
        "message": "Quietanza firmata con successo",
        "record_id": record_id,
        "amount": monthly_compensation,
        "yearly_total": new_total,
        "exceeded_5000": exceeded_5000,
        "exceeded_15000": exceeded_15000
    }

@api_router.get("/prime-squadre/athletes/{athlete_id}/threshold-status/{year}")
async def get_athlete_threshold_status(athlete_id: str, year: int, current_user = Depends(get_current_user)):
    """Get threshold status for an athlete in a specific year"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    athlete = await db.athletes.find_one({"id": athlete_id, "is_compensated": True})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato in Prime Squadre")
    
    monthly_compensation = athlete.get("monthly_compensation", 0) or 0
    prior_compensation = athlete.get("other_annual_compensation", 0) or 0
    
    yearly_records = await db.atleta_pro_compensations.find({
        "atleta_id": athlete_id,
        "year": year,
        "receipt_signed": True
    }).to_list(12)
    
    yearly_total = sum(r.get("amount_gross", 0) for r in yearly_records)
    
    # Add prior compensation if this is the first year of contract
    contract_start = athlete.get("contract_start_date")
    contract_start_year = None
    if contract_start:
        if isinstance(contract_start, str):
            contract_start_year = int(contract_start.split('-')[0])
        elif hasattr(contract_start, 'year'):
            contract_start_year = contract_start.year
    
    if contract_start_year and year == contract_start_year:
        yearly_total += prior_compensation
    
    exceeded_5000_record = next((r for r in yearly_records if r.get("exceeded_5000")), None)
    exceeded_15000_record = next((r for r in yearly_records if r.get("exceeded_15000")), None)
    
    next_total = yearly_total + monthly_compensation
    approaching_5000 = (yearly_total < 5000 and next_total > 4500)
    approaching_15000 = (yearly_total < 15000 and next_total > 14500)
    
    return {
        "athlete_id": athlete_id,
        "year": year,
        "monthly_compensation": monthly_compensation,
        "prior_compensation": prior_compensation,
        "yearly_total": yearly_total,
        "thresholds": {
            "5000": {
                "threshold": 5000,
                "exceeded": exceeded_5000_record is not None,
                "exceeded_month": exceeded_5000_record.get("month") if exceeded_5000_record else None,
                "approaching": approaching_5000
            },
            "15000": {
                "threshold": 15000,
                "exceeded": exceeded_15000_record is not None,
                "exceeded_month": exceeded_15000_record.get("month") if exceeded_15000_record else None,
                "approaching": approaching_15000
            }
        }
    }

@api_router.get("/prime-squadre/stats")
async def get_prime_squadre_stats(current_user = Depends(get_current_user)):
    """Get statistics for Prime Squadre module"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può visualizzare le statistiche")
    
    # Check if pro_enabled
    settings = await db.settings.find_one({"type": "society"})
    pro_enabled = settings.get("pro_enabled", False) if settings else False
    
    # Count members
    total_members = await db.athletes.count_documents({"is_compensated": True})
    max_members = 50
    
    # Get current year totals
    current_year = datetime.utcnow().year
    yearly_records = await db.atleta_pro_compensations.find({
        "year": current_year,
        "receipt_signed": True
    }).to_list(1000)
    
    total_compensations = sum(r.get("amount_gross", 0) for r in yearly_records)
    total_receipts = len(yearly_records)
    
    return {
        "pro_enabled": pro_enabled,
        "total_members": total_members,
        "max_members": max_members,
        "available_slots": max_members - total_members,
        "current_year": current_year,
        "yearly_stats": {
            "total_compensations": total_compensations,
            "total_receipts": total_receipts
        }
    }


# ==================== GESTIONE ATLETI - GENITORI ====================

@api_router.post("/athletes/{athlete_id}/detach-parents")
async def detach_parents(athlete_id: str, current_user = Depends(get_current_user)):
    """Sgancia i genitori da un atleta maggiorenne"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può sganciare i genitori")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Verifica che l'atleta sia maggiorenne
    if athlete.get("is_minor", True):
        raise HTTPException(status_code=400, detail="L'atleta è ancora minorenne")
    
    # Sgancia i genitori
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {
            "parents_detached": True,
            "parents_detached_date": datetime.utcnow(),
            # Opzionalmente possiamo cancellare i dati dei genitori
            # "phone_father": None,
            # "phone_mother": None,
            # "tax_payer_name": None,
            # etc.
        }}
    )
    
    return {"message": "Genitori sganciati con successo", "athlete_id": athlete_id}


@api_router.post("/athletes/{athlete_id}/reattach-parents")
async def reattach_parents(athlete_id: str, current_user = Depends(get_current_user)):
    """Riattiva il collegamento con i genitori per un atleta"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire i genitori")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    await db.athletes.update_one(
        {"id": athlete_id},
        {"$set": {
            "parents_detached": False,
            "parents_detached_date": None
        }}
    )
    
    return {"message": "Genitori ricollegati con successo", "athlete_id": athlete_id}


class AthleteTypeUpdate(BaseModel):
    """Modifica il tipo di atleta e la configurazione compensi"""
    athlete_type: Optional[str] = None  # "quota" | "compensated"
    fees_waived: Optional[bool] = None
    is_compensated: Optional[bool] = None
    monthly_compensation: Optional[float] = None
    other_annual_compensation: Optional[float] = None
    contract_start_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    iban: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_holder: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    document_expiry: Optional[str] = None
    document_front: Optional[str] = None
    document_back: Optional[str] = None


@api_router.patch("/athletes/{athlete_id}/type-config")
async def update_athlete_type_config(
    athlete_id: str,
    data: AthleteTypeUpdate,
    current_user = Depends(get_current_user)
):
    """Aggiorna il tipo di atleta e la configurazione compensi/quote"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare la configurazione")
    
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    update_dict = {}
    
    if data.athlete_type is not None:
        if data.athlete_type not in ["quota", "compensated"]:
            raise HTTPException(status_code=400, detail="Tipo atleta non valido")
        update_dict["athlete_type"] = data.athlete_type
        # Se passa a "compensated", attiva automaticamente is_compensated
        if data.athlete_type == "compensated":
            update_dict["is_compensated"] = True
    
    if data.fees_waived is not None:
        update_dict["fees_waived"] = data.fees_waived
    if data.is_compensated is not None:
        update_dict["is_compensated"] = data.is_compensated
    if data.monthly_compensation is not None:
        update_dict["monthly_compensation"] = data.monthly_compensation
    if data.other_annual_compensation is not None:
        update_dict["other_annual_compensation"] = data.other_annual_compensation
    if data.contract_start_date is not None:
        update_dict["contract_start_date"] = data.contract_start_date
    if data.contract_end_date is not None:
        update_dict["contract_end_date"] = data.contract_end_date
    if data.iban is not None:
        update_dict["iban"] = data.iban
    if data.bank_name is not None:
        update_dict["bank_name"] = data.bank_name
    if data.bank_account_holder is not None:
        update_dict["bank_account_holder"] = data.bank_account_holder
    if data.document_type is not None:
        update_dict["document_type"] = data.document_type
    if data.document_number is not None:
        update_dict["document_number"] = data.document_number
    if data.document_expiry is not None:
        update_dict["document_expiry"] = data.document_expiry
    if data.document_front is not None:
        update_dict["document_front"] = data.document_front
    if data.document_back is not None:
        update_dict["document_back"] = data.document_back
    
    if update_dict:
        await db.athletes.update_one(
            {"id": athlete_id},
            {"$set": update_dict}
        )
    
    # Return updated athlete
    updated = await db.athletes.find_one({"id": athlete_id})
    clean_mongo_docs([updated])
    return updated


# ============= REPORT MENSILE QUIETANZE =============

def generate_monthly_compensation_report_pdf(
    society_name: str,
    month_name: str,
    year: int,
    receipts: list,
    total_amount: float
) -> bytes:
    """Generate a monthly summary PDF of all signed compensation receipts"""
    if not HAS_PDF_GENERATION:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    timestamp = datetime.now().strftime("%d/%m/%Y alle %H:%M")
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 2*cm, "REPORT MENSILE QUIETANZE")
    
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width/2, height - 2.8*cm, f"Compensi Sportivi Dilettantistici")
    
    # Society and period info
    c.setFont("Helvetica", 11)
    c.drawString(2*cm, height - 4*cm, f"Società: {society_name}")
    c.drawString(2*cm, height - 4.6*cm, f"Periodo: {month_name} {year}")
    c.drawString(2*cm, height - 5.2*cm, f"Generato il: {timestamp}")
    
    # Table header
    y = height - 6.5*cm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.Color(0.9, 0.9, 0.9))
    c.rect(1.5*cm, y - 0.3*cm, width - 3*cm, 0.7*cm, fill=True)
    c.setFillColor(colors.black)
    
    c.drawString(2*cm, y, "Tipo")
    c.drawString(4*cm, y, "Nominativo")
    c.drawString(11*cm, y, "Importo")
    c.drawString(14*cm, y, "Data Firma")
    
    # Table rows
    y -= 0.9*cm
    c.setFont("Helvetica", 9)
    
    for i, receipt in enumerate(receipts):
        if y < 3*cm:
            # New page
            c.showPage()
            c.setFont("Helvetica", 9)
            y = height - 3*cm
        
        # Alternating row colors
        if i % 2 == 0:
            c.setFillColor(colors.Color(0.97, 0.97, 0.97))
            c.rect(1.5*cm, y - 0.3*cm, width - 3*cm, 0.6*cm, fill=True)
            c.setFillColor(colors.black)
        
        tipo = receipt.get("type", "N/D")
        nome = receipt.get("name", "N/D")
        importo = receipt.get("amount", 0)
        data_firma = receipt.get("signed_date", "N/D")
        
        c.drawString(2*cm, y, tipo)
        c.drawString(4*cm, y, nome[:35] + "..." if len(nome) > 35 else nome)
        c.drawString(11*cm, y, f"€ {importo:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
        c.drawString(14*cm, y, data_firma if isinstance(data_firma, str) else str(data_firma)[:10])
        
        y -= 0.6*cm
    
    # Total
    y -= 0.5*cm
    c.setFont("Helvetica-Bold", 11)
    c.line(1.5*cm, y + 0.3*cm, width - 1.5*cm, y + 0.3*cm)
    c.drawString(2*cm, y, f"TOTALE QUIETANZE FIRMATE: {len(receipts)}")
    c.drawString(11*cm, y, f"€ {total_amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
    
    # Footer
    y -= 1.5*cm
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.Color(0.5, 0.5, 0.5))
    c.drawString(2*cm, y, "Questo documento è generato automaticamente e riporta le quietanze firmate nel periodo indicato.")
    c.drawString(2*cm, y - 0.4*cm, f"Report generato da {society_name} - {timestamp}")
    
    c.save()
    return buffer.getvalue()


@api_router.get("/reports/monthly-compensation/{year}/{month}")
async def get_monthly_compensation_report(
    year: int,
    month: int,
    current_user = Depends(get_current_user)
):
    """Generate monthly compensation report PDF with all signed receipts"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può generare report")
    
    society_id = current_user.get("society_id")
    
    # Get society name
    society_settings = await db.settings.find_one({"type": "society"})
    society = await db.societies.find_one()
    society_name = (society_settings.get("name") if society_settings else None) or \
                   (society.get("name") if society else None) or "ASD/SSD"
    
    # Month names in Italian
    month_names = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ]
    month_name = month_names[month - 1] if 1 <= month <= 12 else f"Mese {month}"
    
    all_receipts = []
    total_amount = 0.0
    
    # 1. Get coach compensations
    coach_comps = await db.coach_compensations.find({
        "year": year,
        "month": month,
        "received": True
    }).to_list(100)
    
    for comp in coach_comps:
        coach = await db.users.find_one({"id": comp.get("coach_id")})
        coach_name = coach.get("full_name", "N/D") if coach else "N/D"
        amount = comp.get("amount_gross", comp.get("amount", 0))
        signed_date = comp.get("signed_at") or comp.get("updated_at")
        if isinstance(signed_date, datetime):
            signed_date = signed_date.strftime("%d/%m/%Y")
        elif signed_date:
            signed_date = str(signed_date)[:10]
        
        all_receipts.append({
            "type": "Coach",
            "name": coach_name,
            "amount": amount,
            "signed_date": signed_date or "N/D"
        })
        total_amount += amount
    
    # 2. Get dirigente compensations
    dirigente_comps = await db.dirigente_compensations.find({
        "year": year,
        "month": month,
        "received": True
    }).to_list(100)
    
    for comp in dirigente_comps:
        dirigente = await db.users.find_one({"id": comp.get("dirigente_id")})
        dirigente_name = dirigente.get("full_name", "N/D") if dirigente else "N/D"
        amount = comp.get("amount_gross", comp.get("amount", 0))
        signed_date = comp.get("signed_at") or comp.get("updated_at")
        if isinstance(signed_date, datetime):
            signed_date = signed_date.strftime("%d/%m/%Y")
        elif signed_date:
            signed_date = str(signed_date)[:10]
        
        all_receipts.append({
            "type": "Dirigente",
            "name": dirigente_name,
            "amount": amount,
            "signed_date": signed_date or "N/D"
        })
        total_amount += amount
    
    # 3. Get athlete compensation receipts
    athlete_receipts = await db.athlete_compensation_receipts.find({
        "year": year,
        "month": month_name,
        "signed": True
    }).to_list(100)
    
    for receipt in athlete_receipts:
        athlete = await db.athletes.find_one({"id": receipt.get("athlete_id")})
        athlete_name = athlete.get("full_name", "N/D") if athlete else "N/D"
        amount = receipt.get("amount", 0)
        signed_date = receipt.get("signed_date")
        if isinstance(signed_date, datetime):
            signed_date = signed_date.strftime("%d/%m/%Y")
        elif signed_date:
            signed_date = str(signed_date)[:10]
        
        all_receipts.append({
            "type": "Atleta",
            "name": athlete_name,
            "amount": amount,
            "signed_date": signed_date or "N/D"
        })
        total_amount += amount
    
    # 4. Get atleta pro compensations (Prime Squadre)
    atleta_pro_comps = await db.atleta_pro_compensations.find({
        "year": year,
        "month": month,
        "received": True
    }).to_list(100)
    
    for comp in atleta_pro_comps:
        athlete = await db.athletes.find_one({"id": comp.get("atleta_id")})
        athlete_name = athlete.get("full_name", "N/D") if athlete else "N/D"
        amount = comp.get("amount_gross", comp.get("amount", 0))
        signed_date = comp.get("signed_at") or comp.get("updated_at")
        if isinstance(signed_date, datetime):
            signed_date = signed_date.strftime("%d/%m/%Y")
        elif signed_date:
            signed_date = str(signed_date)[:10]
        
        all_receipts.append({
            "type": "Atleta PRO",
            "name": athlete_name,
            "amount": amount,
            "signed_date": signed_date or "N/D"
        })
        total_amount += amount
    
    # Sort by type, then by name
    all_receipts.sort(key=lambda x: (x["type"], x["name"]))
    
    # Generate PDF
    pdf_bytes = generate_monthly_compensation_report_pdf(
        society_name=society_name,
        month_name=month_name,
        year=year,
        receipts=all_receipts,
        total_amount=total_amount
    )
    
    # Return as downloadable file
    filename = f"report_quietanze_{year}_{month:02d}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/pdf"
        }
    )


@api_router.get("/reports/monthly-compensation/{year}/{month}/summary")
async def get_monthly_compensation_summary(
    year: int,
    month: int,
    current_user = Depends(get_current_user)
):
    """Get summary of monthly compensation receipts (without PDF)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può visualizzare i report")
    
    month_names = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ]
    month_name = month_names[month - 1] if 1 <= month <= 12 else f"Mese {month}"
    
    # Count receipts by type
    coach_count = await db.coach_compensations.count_documents({
        "year": year, "month": month, "received": True
    })
    
    dirigente_count = await db.dirigente_compensations.count_documents({
        "year": year, "month": month, "received": True
    })
    
    athlete_count = await db.athlete_compensation_receipts.count_documents({
        "year": year, "month": month_name, "signed": True
    })
    
    atleta_pro_count = await db.atleta_pro_compensations.count_documents({
        "year": year, "month": month, "received": True
    })
    
    # Calculate totals
    coach_total = 0
    async for comp in db.coach_compensations.find({"year": year, "month": month, "received": True}):
        coach_total += comp.get("amount_gross", comp.get("amount", 0))
    
    dirigente_total = 0
    async for comp in db.dirigente_compensations.find({"year": year, "month": month, "received": True}):
        dirigente_total += comp.get("amount_gross", comp.get("amount", 0))
    
    athlete_total = 0
    async for receipt in db.athlete_compensation_receipts.find({"year": year, "month": month_name, "signed": True}):
        athlete_total += receipt.get("amount", 0)
    
    atleta_pro_total = 0
    async for comp in db.atleta_pro_compensations.find({"year": year, "month": month, "received": True}):
        atleta_pro_total += comp.get("amount_gross", comp.get("amount", 0))
    
    return {
        "year": year,
        "month": month,
        "month_name": month_name,
        "breakdown": {
            "coach": {"count": coach_count, "total": coach_total},
            "dirigente": {"count": dirigente_count, "total": dirigente_total},
            "atleta": {"count": athlete_count, "total": athlete_total},
            "atleta_pro": {"count": atleta_pro_count, "total": atleta_pro_total}
        },
        "total_count": coach_count + dirigente_count + athlete_count + atleta_pro_count,
        "total_amount": coach_total + dirigente_total + athlete_total + atleta_pro_total
    }


@api_router.get("/")
async def root():
    return {"message": "Athlete Attendance API"}

@api_router.get("/health")
async def api_health():
    """Health check endpoint for Kubernetes"""
    return {"status": "healthy", "service": "backend"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
