from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
    assigned_teams: List[str] = []  # For coaches - team IDs they can manage
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None  # Admin ID who approved
    is_scorekeeper: bool = False  # For dirigenti - segnapunti
    
    # Coach specific fields - Dati Anagrafici
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    place_of_birth: Optional[str] = None
    fiscal_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    
    # Coach specific - Tesserino
    coach_license_number: Optional[str] = None  # Numero tesserino allenatore
    coach_license_expiry: Optional[datetime] = None
    
    # Coach specific - Compensi
    monthly_compensation: Optional[float] = None  # Compenso mensile
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
    amount: float
    received: bool = False  # Flag pagamento ricevuto
    received_date: Optional[datetime] = None
    exceeded_5000: bool = False  # Flag superamento €5.000 annuali
    exceeded_5000_date: Optional[datetime] = None
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

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    society_id: Optional[str] = None  # ID della società (multi-tenancy)
    name: str
    description: Optional[str] = None
    created_by_admin_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Payment settings per team
    total_amount: float = 0.0
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
    # Legacy fields (keeping for backward compatibility)
    venue: Optional[str] = None
    training_schedule: Optional[str] = None
    # Championships
    championships: Optional[str] = None
    calendar_link: Optional[str] = None

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    total_amount: float
    installment_1_amount: float
    installment_2_amount: float
    installment_2_due_date: str
    installment_3_amount: float
    installment_3_due_date: str
    bank_info: str
    paypal_email: str
    venue: Optional[str] = None
    training_schedule: Optional[str] = None
    training_sessions: Optional[List[dict]] = []
    match_day: Optional[dict] = None
    championships: Optional[str] = None
    calendar_link: Optional[str] = None

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    total_amount: Optional[float] = None
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
    parent_id: str  # User ID of parent/guardian
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
    trial_end_date: datetime  # 7 days after registration
    privacy_accepted: bool = False
    privacy_accepted_date: Optional[datetime] = None
    image_consent: bool = False
    status: str = "pending"  # pending, trial, active, blocked
    # Approvazione
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    # Sconto personalizzato dall'admin
    discount_amount: float = 0.0  # Sconto in euro da detrarre dall'ultima rata
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
    athlete_characteristics: Optional[List[str]] = None  # Caratteristiche selezionate

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
    discount_note: Optional[str] = None
    status: Optional[str] = None  # trial, active, blocked
    data_password: Optional[str] = None  # Nuova password protezione dati
    is_withdrawn: Optional[bool] = None  # Ritiro atleta
    withdrawn_reason: Optional[str] = None  # Motivo ritiro

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
    payment_method: Optional[str] = None  # 'bonifico', 'paypal', 'contanti'
    is_cash: bool = False  # True se pagamento in contanti
    notes: Optional[str] = None  # Note aggiuntive
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

class Attendance(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    athlete_id: str
    coach_id: str
    check_in_time: datetime = Field(default_factory=datetime.utcnow)
    status: str  # 'allowed' or 'blocked'
    block_reason: Optional[str] = None

class AttendanceCreate(BaseModel):
    qr_code: str

# ==================== HELPER FUNCTIONS ====================

def clean_mongo_doc(doc):
    """Remove _id from MongoDB document for Pydantic serialization"""
    if doc:
        doc.pop('_id', None)
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
    except jwt.JWTError:
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
    
    # All users start as PENDING and need Admin approval
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
    fiscal_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    coach_license_number: Optional[str] = None
    # Compensation fields
    compensation_accepted: Optional[bool] = None
    compensation_history: Optional[dict] = None
    over_5000_limit: Optional[dict] = None

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
    # Compensation fields
    if data.compensation_accepted is not None:
        update_dict["compensation_accepted"] = data.compensation_accepted
        if data.compensation_accepted:
            update_dict["compensation_accepted_date"] = datetime.utcnow()
    if data.compensation_history is not None:
        update_dict["compensation_history"] = data.compensation_history
    if data.over_5000_limit is not None:
        update_dict["over_5000_limit"] = data.over_5000_limit
    
    if update_dict:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_dict}
        )
    
    return {"message": "Profilo aggiornato"}

# ==================== PASSWORD RESET ENDPOINTS ====================

# SendGrid Email Setup
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@example.com")

def generate_reset_token():
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)

async def send_password_reset_email(to_email: str, reset_token: str, user_name: str):
    """Send password reset email via SendGrid"""
    if not SENDGRID_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
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
    
    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=to_email,
        subject=f"🔐 Reset Password - {society_name}",
        html_content=html_content
    )
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        logging.error(f"SendGrid error: {str(e)}")
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

@api_router.get("/settings/society")
async def get_society_settings():
    """Get society settings (public endpoint - no auth required for logo display)"""
    settings = await db.settings.find_one({"type": "society"})
    if not settings:
        return {"name": "Società Sportiva", "logo": None, "logo_size": 50, "athlete_roles": [], "athlete_characteristics": []}
    return {
        "name": settings.get("name", "Società Sportiva"),
        "logo": settings.get("logo"),
        "logo_size": settings.get("logo_size", 50),
        "athlete_roles": settings.get("athlete_roles", []),
        "athlete_characteristics": settings.get("athlete_characteristics", [])
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
    
    if update_dict:
        await db.settings.update_one(
            {"type": "society"},
            {"$set": update_dict},
            upsert=True
        )
    
    return {"message": "Impostazioni aggiornate con successo"}

# ==================== USER MANAGEMENT ENDPOINTS (ADMIN) ====================

class UserUpdateRole(BaseModel):
    role: str  # admin, viewer, coach
    
class UserUpdateStatus(BaseModel):
    status: str  # approved, rejected, suspended

class CoachAssignTeams(BaseModel):
    team_ids: List[str]

@api_router.get("/users/dirigenti")
async def get_dirigenti(current_user = Depends(get_current_user)):
    """Get all dirigenti (admin and viewer roles)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può vedere i dirigenti")
    
    dirigenti = await db.users.find({
        "role": {"$in": [UserRole.ADMIN, UserRole.VIEWER]}
    }).to_list(1000)
    
    result = []
    for d in dirigenti:
        result.append({
            "id": d["id"],
            "email": d["email"],
            "full_name": d["full_name"],
            "role": d["role"],
            "status": d.get("status", UserStatus.APPROVED),
            "created_at": d.get("created_at"),
            "approved_at": d.get("approved_at"),
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
        # Compensation
        "monthly_compensation": user.get("monthly_compensation", 0),
        "compensation_accepted": user.get("compensation_accepted", False),
        "compensation_history": user.get("compensation_history", {}),
        "over_5000_limit": user.get("over_5000_limit", {}),
        # Document and Bank details (new fields)
        "id_type": user.get("id_type"),
        "id_front": user.get("id_front"),
        "id_back": user.get("id_back"),
        "doc_front_image": user.get("doc_front_image"),
        "doc_back_image": user.get("doc_back_image"),
        "iban": user.get("iban"),
        "account_holder": user.get("account_holder"),
        "bank_name": user.get("bank_name"),
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

@api_router.get("/teams/{team_id}", response_model=Team)
async def get_team(team_id: str, current_user = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    clean_mongo_doc(team)
    return Team(**team)

@api_router.patch("/teams/{team_id}", response_model=Team)
async def update_team(team_id: str, team_data: TeamUpdate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può modificare squadre")
    
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Squadra non trovata")
    
    update_dict = {}
    for key, value in team_data.dict(exclude_unset=True).items():
        if value is not None:
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
    
    result = []
    for a in athletes:
        result.append({
            "id": a["id"],
            "full_name": f"{a.get('last_name', '')} {a.get('first_name', '')}".strip(),
            "first_name": a.get("first_name", ""),
            "last_name": a.get("last_name", ""),
            "team_id": a.get("team_id"),
            "team_name": team_names.get(a.get("team_id"), ""),
            "parent_id": a.get("parent_id"),
            "status": a.get("status", "pending"),
            "date_of_birth": a.get("date_of_birth"),
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
        data_password_hash = hash_password(athlete_data.data_password)
    
    # Get society_id from the user's parent
    parent_user = await db.users.find_one({"id": current_user["id"]})
    society_id = parent_user.get("society_id") if parent_user else None
    
    athlete = Athlete(
        id=athlete_id,
        parent_id=current_user["id"],
        society_id=society_id,
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

@api_router.get("/athletes/my", response_model=List[Athlete])
async def get_my_athletes(current_user = Depends(get_current_user)):
    if current_user["role"] == UserRole.PARENT:
        athletes = await db.athletes.find({"parent_id": current_user["id"]}).to_list(1000)
    elif current_user["role"] in [UserRole.ADMIN, UserRole.COACH]:
        athletes = await db.athletes.find().to_list(1000)
    else:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    clean_mongo_docs(athletes)
    return [Athlete(**athlete) for athlete in athletes]

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
                # Installment 1
                payment1 = Payment(
                    athlete_id=athlete_id,
                    installment_number=1,
                    amount=team["installment_1_amount"],
                    due_date=trial_end
                )
                await db.payments.insert_one(payment1.dict())
                
                # Installment 2
                if team.get("installment_2_amount", 0) > 0 and team.get("installment_2_due_date"):
                    payment2 = Payment(
                        athlete_id=athlete_id,
                        installment_number=2,
                        amount=team["installment_2_amount"],
                        due_date=team["installment_2_due_date"]
                    )
                    await db.payments.insert_one(payment2.dict())
                
                # Installment 3
                if team.get("installment_3_amount", 0) > 0 and team.get("installment_3_due_date"):
                    payment3 = Payment(
                        athlete_id=athlete_id,
                        installment_number=3,
                        amount=team["installment_3_amount"],
                        due_date=team["installment_3_due_date"]
                    )
                    await db.payments.insert_one(payment3.dict())
    
    status_text = {
        AthleteStatus.TRIAL: "approvato (periodo di prova)",
        AthleteStatus.ACTIVE: "approvato (attivo)",
        "rejected": "rifiutato"
    }
    
    return {"message": f"Atleta {status_text.get(data.status, data.status)} con successo"}

@api_router.get("/athletes/{athlete_id}", response_model=Athlete)
async def get_athlete(athlete_id: str, current_user = Depends(get_current_user)):
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    return Athlete(**athlete)

@api_router.patch("/athletes/{athlete_id}", response_model=Athlete)
async def update_athlete(athlete_id: str, update_data: AthleteUpdate, current_user = Depends(get_current_user)):
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    if update_data.tax_payer_fiscal_code is not None:
        update_dict["tax_payer_fiscal_code"] = update_data.tax_payer_fiscal_code
    if update_data.team_id is not None:
        # Verify team exists
        team = await db.teams.find_one({"id": update_data.team_id})
        if team:
            update_dict["team_id"] = update_data.team_id
    
    # Sconto
    if update_data.discount_amount is not None:
        update_dict["discount_amount"] = update_data.discount_amount
    if update_data.discount_note is not None:
        update_dict["discount_note"] = update_data.discount_note
    
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
    
    # Check permissions (parent or admin can verify)
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    
    # Only parent can change password
    if current_user["role"] != UserRole.PARENT or athlete["parent_id"] != current_user["id"]:
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

@api_router.post("/athletes/{athlete_id}/request-deletion")
async def request_athlete_deletion(athlete_id: str, current_user = Depends(get_current_user)):
    """Request deletion of an athlete - sends notification to admin"""
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    # Check permissions - only parent of the athlete can request deletion
    if current_user["role"] == UserRole.PARENT and athlete.get("parent_id") != current_user["id"]:
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
    
    # Check permissions - only parent of the athlete or admin can delete
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    
    # Check permissions
    athlete = await db.athletes.find_one({"id": athlete_id})
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    return Certificate(**certificate)

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
    
    # Get current date info
    now = datetime.now()
    week_start = now - timedelta(days=now.weekday())  # Monday
    month_start = now.replace(day=1)
    
    # Calculate stats for each athlete
    stats = []
    for athlete in athletes:
        athlete_id = athlete["id"]
        
        # Get all attendances for this athlete
        all_attendances = await db.attendances.count_documents({"athlete_id": athlete_id})
        
        # Get weekly attendances
        week_attendances = await db.attendances.count_documents({
            "athlete_id": athlete_id,
            "check_in_time": {"$gte": week_start.isoformat()}
        })
        
        # Get monthly attendances
        month_attendances = await db.attendances.count_documents({
            "athlete_id": athlete_id,
            "check_in_time": {"$gte": month_start.isoformat()}
        })
        
        # Estimate expected trainings based on team training days
        # Assuming 3 trainings per week (typical)
        reg_date = athlete["registration_date"]
        if isinstance(reg_date, str):
            reg_date = datetime.fromisoformat(reg_date)
        weeks_active = max(1, (now - reg_date).days // 7)
        expected_total = weeks_active * 3  # 3 trainings per week estimate
        expected_monthly = 12  # ~3 trainings per week * 4 weeks
        expected_weekly = 3
        
        # Calculate percentages
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
            "total_percentage": total_percentage,
            "monthly_percentage": monthly_percentage,
            "weekly_percentage": weekly_percentage,
        })
    
    # Sort by name
    stats.sort(key=lambda x: x["athlete_name"])
    
    return {
        "team_name": team["name"],
        "total_athletes": len(athletes),
        "week_start": week_start.strftime("%d/%m/%Y"),
        "month_name": now.strftime("%B %Y"),
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

@api_router.get("/payments/{athlete_id}", response_model=List[Payment])
async def get_athlete_payments(athlete_id: str, current_user = Depends(get_current_user)):
    # Check permissions
    athlete = await db.athletes.find_one({"id": athlete_id})
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta non trovato")
    
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    
    update_data = {
        "amount": payment_data.amount,
        "paid_date": paid_date,
        "is_cash": payment_data.is_cash,
        "payment_method": "contanti" if payment_data.is_cash else "bonifico",
        "notes": payment_data.notes,
        "description": f"Pagamento del {payment_data.paid_date}",
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
    
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    
    residual = max(0, total_after_discount - total_paid)
    
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

@api_router.patch("/payments/{payment_id}", response_model=Payment)
async def update_payment(payment_id: str, update_data: PaymentUpdate, current_user = Depends(get_current_user)):
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    # Check permissions
    athlete = await db.athletes.find_one({"id": payment["athlete_id"]})
    if current_user["role"] == UserRole.PARENT and athlete["parent_id"] != current_user["id"]:
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
    
    athletes = await db.athletes.find({}).to_list(5000)
    clean_mongo_docs(athletes)
    
    # Batch fetch all related data to avoid N+1 queries
    teams_list = await db.teams.find().to_list(1000)
    teams_dict = {t["id"]: t for t in teams_list}
    
    certs_list = await db.certificates.find().to_list(5000)
    certs_dict = {c["athlete_id"]: c for c in certs_list}
    
    payments_list = await db.payments.find().to_list(10000)
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
    
    # Check athletes
    athletes = await db.athletes.find({}).to_list(1000)
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
                "exceeded_5000_date": now if exceeded_5000 else None
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
            exceeded_5000_date=now if exceeded_5000 else None
        )
        await db.coach_compensations.insert_one(record.dict())
    
    # If exceeded €5000, notify admin
    if exceeded_5000:
        # Create notification for admin (we can implement this later)
        pass
    
    return {"message": "Compenso confermato", "exceeded_5000": exceeded_5000}

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
