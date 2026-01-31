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
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserRole:
    ADMIN = "admin"
    COACH = "coach"
    PARENT = "parent"
    ATHLETE = "athlete"

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    email: EmailStr
    password_hash: str
    role: str  # admin, coach, parent, athlete
    full_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: dict

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
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
    # Training schedule
    venue: Optional[str] = None  # Palestra/Campo es: "Palestra Liceo Alessi"
    training_schedule: Optional[str] = None  # es: "Lunedì 18:00-20:00, Mercoledì 19:00-21:00"
    # Championships
    championships: Optional[str] = None  # es: "Serie C, Coppa Italia"
    calendar_link: Optional[str] = None  # Link al calendario federazione

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
    championships: Optional[str] = None
    calendar_link: Optional[str] = None

class Athlete(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    parent_id: str  # User ID of parent/guardian
    full_name: str
    date_of_birth: datetime
    is_minor: bool
    # New fields - anagrafica completa (opzionali per retrocompatibilità)
    fiscal_code: Optional[str] = None  # Codice fiscale atleta
    address: Optional[str] = None  # Via, numero civico
    city: Optional[str] = None  # Città
    postal_code: Optional[str] = None  # CAP
    province: Optional[str] = None  # Provincia
    phone_athlete: Optional[str] = None  # Telefono atleta
    phone_father: Optional[str] = None  # Telefono padre
    phone_mother: Optional[str] = None  # Telefono madre
    email: Optional[str] = None  # Email di contatto
    # Dati genitore per detrazione
    tax_payer_name: Optional[str] = None  # Nome cognome genitore detrazione
    tax_payer_fiscal_code: Optional[str] = None  # CF genitore detrazione
    # Existing fields
    team_id: str
    qr_code: str  # Base64 encoded QR code
    registration_date: datetime = Field(default_factory=datetime.utcnow)
    trial_end_date: datetime  # 7 days after registration
    privacy_accepted: bool = False
    privacy_accepted_date: Optional[datetime] = None
    image_consent: bool = False
    status: str = "trial"  # trial, active, blocked

class AthleteCreate(BaseModel):
    full_name: str
    date_of_birth: str
    fiscal_code: str  # Obbligatorio per nuove iscrizioni
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone_athlete: Optional[str] = None
    phone_father: Optional[str] = None
    phone_mother: Optional[str] = None
    email: Optional[str] = None
    tax_payer_name: Optional[str] = None
    tax_payer_fiscal_code: Optional[str] = None
    team_id: str
    
class AthleteUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    fiscal_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    province: Optional[str] = None
    phone_athlete: Optional[str] = None
    phone_father: Optional[str] = None
    phone_mother: Optional[str] = None
    email: Optional[str] = None
    tax_payer_name: Optional[str] = None
    tax_payer_fiscal_code: Optional[str] = None
    privacy_accepted: Optional[bool] = None
    image_consent: Optional[bool] = None

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
    installment_number: int  # 1, 2, or 3
    amount: float
    due_date: datetime
    paid: bool = False
    paid_date: Optional[datetime] = None
    payment_method: Optional[str] = None  # 'bonifico' or 'paypal'
    created_at: datetime = Field(default_factory=datetime.utcnow)

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
        
        return {"id": user_id, "role": role, "email": user["email"], "full_name": user["full_name"]}
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
        return {"allowed": False, "reason": "Atleta non trovato"}
    
    # Check if trial period ended and privacy not accepted
    if datetime.utcnow() > athlete["trial_end_date"] and not athlete.get("privacy_accepted"):
        return {"allowed": False, "reason": "Privacy non accettata - periodo di prova terminato"}
    
    # Check certificate
    certificate = await db.certificates.find_one({"athlete_id": athlete_id})
    if not certificate:
        return {"allowed": False, "reason": "Certificato medico mancante"}
    
    if datetime.utcnow() > certificate["expiry_date"]:
        return {"allowed": False, "reason": "Certificato medico scaduto"}
    
    # Check payments
    unpaid_payments = await db.payments.find({
        "athlete_id": athlete_id,
        "paid": False,
        "due_date": {"$lt": datetime.utcnow()}
    }).to_list(100)
    
    if unpaid_payments:
        installments = [p["installment_number"] for p in unpaid_payments]
        return {"allowed": False, "reason": f"Rate non pagate: {', '.join(map(str, installments))}"}
    
    return {"allowed": True, "reason": None}

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name
    )
    
    await db.users.insert_one(user.dict())
    
    token = create_token(user.id, user.role)
    
    return TokenResponse(
        token=token,
        user={"id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name}
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    
    token = create_token(user["id"], user["role"])
    
    return TokenResponse(
        token=token,
        user={"id": user["id"], "email": user["email"], "role": user["role"], "full_name": user["full_name"]}
    )

@api_router.get("/auth/me")
async def get_me(current_user = Depends(get_current_user)):
    return current_user

# ==================== TEAM ENDPOINTS (ADMIN) ====================

@api_router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user = Depends(get_current_user)):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può creare squadre")
    
    team = Team(
        name=team_data.name,
        description=team_data.description,
        created_by_admin_id=current_user["id"],
        total_amount=team_data.total_amount,
        installment_1_amount=team_data.installment_1_amount,
        installment_2_amount=team_data.installment_2_amount,
        installment_2_due_date=datetime.fromisoformat(team_data.installment_2_due_date),
        installment_3_amount=team_data.installment_3_amount,
        installment_3_due_date=datetime.fromisoformat(team_data.installment_3_due_date),
        bank_info=team_data.bank_info,
        paypal_email=team_data.paypal_email,
        venue=team_data.venue if team_data.venue else None,
        training_schedule=team_data.training_schedule if team_data.training_schedule else None,
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
                update_dict[key] = datetime.fromisoformat(value)
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

# ==================== ATHLETE ENDPOINTS ====================

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
    
    athlete = Athlete(
        id=athlete_id,
        parent_id=current_user["id"],
        full_name=athlete_data.full_name,
        date_of_birth=dob,
        is_minor=is_minor,
        fiscal_code=athlete_data.fiscal_code,
        address=athlete_data.address,
        city=athlete_data.city,
        postal_code=athlete_data.postal_code,
        province=athlete_data.province,
        phone_athlete=athlete_data.phone_athlete,
        phone_father=athlete_data.phone_father,
        phone_mother=athlete_data.phone_mother,
        tax_payer_name=athlete_data.tax_payer_name,
        tax_payer_fiscal_code=athlete_data.tax_payer_fiscal_code,
        team_id=athlete_data.team_id,
        qr_code=qr_code,
        trial_end_date=datetime.utcnow() + timedelta(days=7)
    )
    
    await db.athletes.insert_one(athlete.dict())
    
    # Create payment records using team's payment settings
    if team.get("installment_1_amount", 0) > 0:
        # Installment 1 - due after trial period
        payment1 = Payment(
            athlete_id=athlete.id,
            installment_number=1,
            amount=team["installment_1_amount"],
            due_date=athlete.trial_end_date
        )
        await db.payments.insert_one(payment1.dict())
        
        # Installment 2
        if team.get("installment_2_amount", 0) > 0 and team.get("installment_2_due_date"):
            payment2 = Payment(
                athlete_id=athlete.id,
                installment_number=2,
                amount=team["installment_2_amount"],
                due_date=team["installment_2_due_date"]
            )
            await db.payments.insert_one(payment2.dict())
        
        # Installment 3
        if team.get("installment_3_amount", 0) > 0 and team.get("installment_3_due_date"):
            payment3 = Payment(
                athlete_id=athlete.id,
                installment_number=3,
                amount=team["installment_3_amount"],
                due_date=team["installment_3_due_date"]
            )
            await db.payments.insert_one(payment3.dict())
    
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
    if update_data.full_name is not None:
        update_dict["full_name"] = update_data.full_name
    if update_data.date_of_birth is not None:
        try:
            update_dict["date_of_birth"] = datetime.fromisoformat(update_data.date_of_birth)
        except:
            pass
    if update_data.fiscal_code is not None:
        update_dict["fiscal_code"] = update_data.fiscal_code
    if update_data.address is not None:
        update_dict["address"] = update_data.address
    if update_data.city is not None:
        update_dict["city"] = update_data.city
    if update_data.postal_code is not None:
        update_dict["postal_code"] = update_data.postal_code
    if update_data.province is not None:
        update_dict["province"] = update_data.province
    if update_data.phone_athlete is not None:
        update_dict["phone_athlete"] = update_data.phone_athlete
    if update_data.phone_father is not None:
        update_dict["phone_father"] = update_data.phone_father
    if update_data.phone_mother is not None:
        update_dict["phone_mother"] = update_data.phone_mother
    if update_data.email is not None:
        update_dict["email"] = update_data.email
    if update_data.tax_payer_name is not None:
        update_dict["tax_payer_name"] = update_data.tax_payer_name
    if update_data.tax_payer_fiscal_code is not None:
        update_dict["tax_payer_fiscal_code"] = update_data.tax_payer_fiscal_code
    
    # Campi booleani
    if update_data.privacy_accepted is not None:
        update_dict["privacy_accepted"] = update_data.privacy_accepted
        if update_data.privacy_accepted:
            update_dict["privacy_accepted_date"] = datetime.utcnow()
    
    if update_data.image_consent is not None:
        update_dict["image_consent"] = update_data.image_consent
    
    if update_dict:
        await db.athletes.update_one({"id": athlete_id}, {"$set": update_dict})
        athlete.update(update_dict)
    
    return Athlete(**athlete)

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
    
    # Calculate expiry date
    issue_dt = datetime.fromisoformat(data.issue_date)
    expiry_dt = issue_dt + timedelta(days=data.validity_months * 30)
    
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
    
    payments = await db.payments.find({"athlete_id": athlete_id}).sort("installment_number", 1).to_list(100)
    clean_mongo_docs(payments)
    return [Payment(**payment) for payment in payments]

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

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Athlete Attendance API"}

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
