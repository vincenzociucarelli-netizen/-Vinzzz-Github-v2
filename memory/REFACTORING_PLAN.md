# RegistraTEAM - Piano Refactoring backend/server.py

**File analizzato**: `/app/backend/server.py`  
**Data analisi**: 28/04/2026  
**Dimensione attuale**: 24.905 righe (DOPO prima ondata refactoring 29/04)

## ✅ STATO REFACTORING

| Step | Status | Note |
|---|---|---|
| Setup cartelle (routes/, models/, services/) | ✅ Completato 28/04 | |
| `database.py` (MongoDB singleton) | ✅ Completato 28/04 | |
| `auth_utils.py` (JWT + get_current_user) | ✅ Completato 28/04 | |
| `utils.py` (MONTH_NAMES, to_rome_time, clean_mongo_doc) | ✅ Completato 29/04 | |
| `models/enums.py` (UserRole, UserStatus) | ✅ Completato 29/04 | |
| `routes/notifications.py` (10 endpoint) | ✅ Completato 29/04 | Test smoke 14/14 ✅ |
| Estrazione altri gruppi route | ⏸️ Da continuare | Pattern verificato |

## 📊 Statistiche

| Metrica | Valore |
|---|---|
| Righe totali | 25.037 |
| Endpoint API (`@api_router`) | **304** |
| Modelli Pydantic (`class ... BaseModel`) | **92** |
| Funzioni async | 328 |
| Funzioni sync | 32 |

## 🗺️ Mappa endpoint per dominio

| Dominio | # endpoint | File destinazione |
|---|---|---|
| `/athletes/*` | 67 | `routes/athletes.py` |
| `/admin/*` | 24 | `routes/admin.py` |
| `/users/*` | 20 | `routes/users.py` |
| `/auth/*` | 16 | `routes/auth.py` |
| `/teams/*` | 14 | `routes/teams.py` |
| `/payments/*` + `/payment-settings/*` | 15 | `routes/payments.py` |
| `/preseason/*` | 12 | `routes/preseason.py` |
| `/federation/*` | 11 | `routes/federation.py` |
| `/coach/*` | 11 | `routes/coaches.py` |
| `/documents/*` | 10 | `routes/documents.py` |
| `/prime-squadre/*` | 9 | `routes/prime_squadre.py` |
| `/certificates/*` | 9 | `routes/certificates.py` |
| `/matches/*` + `/championships/*` | 11 | `routes/matches.py` |
| `/societies/*` + `/society/*` | 9 | `routes/societies.py` |
| `/collaboratore/*` + `/collaboratori/*` | 9 | `routes/collaboratori.py` |
| `/settings/*` | 6 | `routes/settings.py` |
| `/dirigente/*` | 6 | `routes/dirigenti.py` |
| `/export-csv/*` + `/export-xlsx/*` + `/export/*` | 9 | `routes/export.py` |
| `/seasons/*` | 4 | `routes/seasons.py` |
| `/parent-link/*` + `/parent/*` | 5 | `routes/parents.py` |
| `/trial/*` | 4 | `routes/trial.py` |
| `/notifications/*` | 2 | `routes/notifications.py` |
| `/attendance/*` | 3 | `routes/attendance.py` |
| `/reports/*` + `/stats/*` + `/audit-logs/*` | 4 | `routes/reports.py` |
| Altri minori (`/health`, `/promo`, `/docs`, `/utils`, `/staff`, `/birthdays`, `/attestati`, `/minor`) | ~10 | `routes/misc.py` |

## 🏗️ Struttura proposta finale

```
/app/backend/
├── server.py                    (snello: app FastAPI, middleware, lifespan, scheduler, mount routers)
├── database.py                  (connessione MongoDB, db = client[DB_NAME])
├── auth_utils.py                (get_current_user, JWT, password hashing, role checks)
├── routes/
│   ├── __init__.py
│   ├── auth.py                  (16 endpoint)
│   ├── users.py                 (20 endpoint)
│   ├── athletes.py              (67 endpoint - file più grande)
│   ├── coaches.py               (11 endpoint)
│   ├── dirigenti.py             (6 endpoint)
│   ├── collaboratori.py         (9 endpoint)
│   ├── parents.py               (5 endpoint)
│   ├── teams.py                 (14 endpoint)
│   ├── matches.py               (11 endpoint)
│   ├── payments.py              (15 endpoint)
│   ├── certificates.py          (9 endpoint)
│   ├── documents.py             (10 endpoint)
│   ├── notifications.py         (2 endpoint)
│   ├── settings.py              (6 endpoint)
│   ├── societies.py             (9 endpoint)
│   ├── seasons.py               (4 endpoint)
│   ├── preseason.py             (12 endpoint)
│   ├── federation.py            (11 endpoint)
│   ├── prime_squadre.py         (9 endpoint)
│   ├── trial.py                 (4 endpoint)
│   ├── attendance.py            (3 endpoint)
│   ├── reports.py               (4 endpoint)
│   ├── export.py                (9 endpoint)
│   ├── admin.py                 (24 endpoint)
│   └── misc.py                  (~10 endpoint minori)
├── models/
│   ├── __init__.py
│   ├── user_models.py           (User, UserCreate, UserUpdate, etc.)
│   ├── athlete_models.py
│   ├── team_models.py
│   ├── payment_models.py
│   ├── compensation_models.py
│   ├── document_models.py
│   └── common_models.py         (Address, etc.)
├── services/
│   ├── __init__.py
│   ├── pdf_generator.py         (generazione PDF privacy, quietanze, dichiarazioni)
│   ├── email_service.py         (già esiste, mantengo - integra Brevo)
│   ├── threshold_calc.py        (calcolo soglie 5k/15k - logica condivisa)
│   ├── codice_fiscale.py        (generazione CF italiani/esteri)
│   ├── federation_scraper.py    (già esiste - FIPAV scraping)
│   ├── notification_service.py  (creazione notifiche)
│   └── consent_service.py       (gestione consensi GDPR)
├── tests/
│   ├── __init__.py
│   ├── test_auth.py
│   ├── test_athletes.py
│   ├── test_compensations.py
│   └── conftest.py              (fixtures pytest)
├── promo-registrateam.html
├── docs/                        (manuali HTML)
├── signed_documents/
└── requirements.txt
```

## 🛠️ Strategia di esecuzione

### Fase 1 — Setup (15 min, sicuro al 100%)
1. ✅ Creare cartelle `routes/`, `models/`, `services/` (FATTO)
2. Creare `database.py` con la connessione MongoDB
3. Creare `auth_utils.py` con `get_current_user`, JWT helpers
4. Verificare backend si avvia ancora (`sudo supervisorctl restart backend`)

### Fase 2 — Estrazione modelli Pydantic (30 min, basso rischio)
1. Spostare i 92 modelli Pydantic nelle cartelle `models/`
2. Mantenere `from models.user_models import User` in server.py
3. Verificare backend funzionante

### Fase 3 — Estrazione servizi (30 min, basso rischio)
1. Spostare le funzioni helper (PDF, CF, threshold) in `services/`
2. Aggiornare gli import in server.py
3. Verificare backend

### Fase 4 — Estrazione route (1-2 ore, RICHIEDE PRESENZA UTENTE)
1. Iniziare dai gruppi più semplici (`/notifications/`, `/settings/`)
2. Procedere per gruppi via via più grandi
3. Dopo ogni gruppo: test curl + restart backend
4. Finire con `/athletes/*` (più grande)

### Fase 5 — Test e verifica finale
1. Suite di test pytest con fixtures
2. Test end-to-end manuale dei flussi critici
3. Documentazione architettura aggiornata

## ⚠️ Punti di attenzione critici

1. **`get_current_user`** è chiamato in praticamente ogni endpoint → deve essere in modulo importabile
2. **`db` (MongoDB client)** è usato ovunque → singleton in `database.py`
3. **Logger globale** → centralizzare in `logging_config.py`
4. **APIRouter prefix `/api`** → deve restare invariato (i router router-figli vanno inclusi senza prefix `/api`, sono già montati dentro)
5. **Scheduler** (cert expiry, pre-season) → resta in `server.py` (lifecycle dell'app)
6. **Import circolari** → attenzione a `from auth_utils import get_current_user` chiamato in `database.py` o viceversa

## 🛡️ Snapshot pre-refactoring

**Backup utente confermato su GitHub** in data 28/04/2026 — possiamo procedere in sicurezza.

## ✅ Esito atteso

- Tempo manutenzione futura: **-50%** (file più piccoli e focalizzati)
- Crediti consumati per ogni futura modifica: **-30/40%**
- Nessuna modifica funzionale per gli utenti finali
- Nessuna modifica al database
- Tutti gli endpoint mantengono lo stesso URL/comportamento
