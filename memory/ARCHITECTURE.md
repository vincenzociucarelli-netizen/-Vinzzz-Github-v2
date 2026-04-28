# RegistraTEAM — Architettura tecnica

**Aggiornato**: 28/04/2026

## 🎯 Visione generale

RegistraTEAM è una **PWA (Progressive Web App)** per società sportive italiane (volley, calcio, ecc.) con focus su:
- Compliance GDPR (consensi multipli, PDF dinamici)
- Riforma dello Sport (soglie 5k/15k EUR, dichiarazioni fiscali/previdenziali)
- Onboarding multi-ruolo (admin/coach/dirigente/collaboratore/atleta/genitore)
- Sincronizzazione automatica con federazioni (es. FIPAV)

## 🏗️ Stack tecnologico

| Layer | Tecnologia | Note |
|---|---|---|
| **Frontend** | React Native + Expo (build statico web) | `npx expo export -p web` produce `dist/` servito con `serve -s dist -l 3000` |
| **Backend** | FastAPI (Python 3.11) | Server uvicorn su porta 8001, gestito da supervisor |
| **Database** | MongoDB | Connessione via `motor` async |
| **Email** | Brevo (ex Sendinblue) | API in `email_service.py` |
| **PDF** | ReportLab | Generazione documenti dinamici (privacy, quietanze, dichiarazioni) |
| **Scraping federazioni** | BeautifulSoup | `federation_scraper.py` per FIPAV (calendari partite) |
| **Codice fiscale** | python-codicefiscale | Generazione automatica CF italiani/esteri |
| **Domini** | Aruba | registrateam.it (principale), .com/.net (redirect 301) |
| **Email mittenti** | info@, assistenza@ (su .it) + registrateam@gmail.com (operativo) | |

## 📁 Struttura repository (post-refactoring previsto)

```
/app/
├── backend/
│   ├── server.py                # FastAPI app, lifespan, scheduler, mount routers
│   ├── database.py              # MongoDB client + db singleton
│   ├── auth_utils.py            # JWT, get_current_user, password hashing
│   ├── routes/                  # Tutti gli endpoint per dominio
│   │   ├── auth.py
│   │   ├── athletes.py
│   │   ├── coaches.py
│   │   ├── dirigenti.py
│   │   ├── collaboratori.py
│   │   ├── parents.py
│   │   ├── teams.py
│   │   ├── matches.py
│   │   ├── payments.py
│   │   ├── certificates.py
│   │   ├── documents.py
│   │   ├── notifications.py
│   │   ├── settings.py
│   │   ├── societies.py
│   │   ├── seasons.py
│   │   ├── preseason.py
│   │   ├── federation.py
│   │   ├── prime_squadre.py
│   │   ├── trial.py
│   │   ├── attendance.py
│   │   ├── reports.py
│   │   ├── export.py
│   │   ├── admin.py
│   │   └── misc.py
│   ├── models/                  # Pydantic models per dominio
│   ├── services/                # Business logic riutilizzabile
│   │   ├── pdf_generator.py
│   │   ├── email_service.py
│   │   ├── threshold_calc.py
│   │   ├── codice_fiscale.py
│   │   ├── federation_scraper.py
│   │   ├── notification_service.py
│   │   └── consent_service.py
│   ├── tests/                   # Test pytest (smoke + integration)
│   ├── docs/                    # Manuali HTML per ruolo
│   ├── promo-registrateam.html  # Flyer promozionale
│   ├── signed_documents/        # PDF firmati persistenti
│   └── requirements.txt
└── frontend/
    ├── app/                     # Expo Router (file-based routing)
    │   ├── admin/
    │   ├── coach/
    │   ├── dirigente/
    │   ├── collaboratore/
    │   ├── athlete/
    │   ├── parent/
    │   └── _layout.tsx
    ├── components/
    │   └── ui/                  # Shadcn components
    ├── dist/                    # Build statico (generato)
    ├── package.json
    └── app.json
```

## 🔐 Flussi di autenticazione

1. **Login**: `POST /api/auth/login` → ritorna JWT (validità 30 giorni)
2. **JWT payload**: `{user_id, role, exp, athlete_id?}`
3. **`get_current_user` dependency** in `auth_utils.py`: estrae il token, valida, carica utente da `db.users` (o `db.athletes` per il ruolo `minor`)
4. **Ruolo `minor`**: NON ha entry in `users`, vive solo in `athletes` (registrazione fatta dal genitore)

## 📊 Modelli MongoDB principali

| Collection | Documento tipico |
|---|---|
| `users` | admin, coach, dirigenti, collaboratori, atleti18+, genitori |
| `athletes` | tutti gli atleti (anche minorenni: hanno `parents: [user_id, ...]`) |
| `teams` | squadre con `name`, `assigned_coaches`, `venue` |
| `payments` | pagamenti rateali (`paid: true/false/None`) |
| `compensations` | compensi mensili coach/dirigente/collaboratore |
| `coach_compensations` / `dirigente_compensations` / `collaboratore_compensations` | quietanze firmate |
| `signed_documents` | metadati documenti firmati (privacy, dichiarazioni) |
| `settings` | configurazione società (ragione sociale, ruoli, palestre, sport) |
| `notifications` | notifiche admin/utenti |
| `audit_logs` | tracciamento azioni GDPR-rilevanti |
| `matches` | calendario partite (sincronizzate da FIPAV) |

## 💰 Calcolo soglie 5k/15k (Riforma Sport)

Logica centralizzata in `services/threshold_calc.py` (post-refactoring):

1. **Dati input**: `monthly_compensation`, `prior_compensation` (pregressi extra-società), `contract_start_date`, `contract_end_date`
2. **Proiezione**: somma cumulativa per ogni mese del contratto fino a fine anno
3. **Output**: `threshold_5k_month` (mese in cui supera 5k) e `threshold_15k_month` (mese in cui supera 15k)
4. **Banner UI**: vengono mostrati nelle pagine compensation di dirigente/coach/collaboratore + viste admin

API endpoints per questo calcolo:
- `GET /api/dirigente/{id}/threshold-status/{year}`
- `GET /api/coach/{coach_id}/threshold-status/{year}`
- `GET /api/collaboratore/{collaboratore_id}/threshold-status/{year}`

## 🧪 Test

| File | Cosa testa |
|---|---|
| `tests/test_smoke_regression.py` | **14 smoke test** rapidi: login, /me, /settings, /users, /teams, /athletes, /notifications, /export-csv, /threshold-status. Eseguire dopo OGNI refactoring. |
| `tests/test_*.py` | Test specifici per dominio (atleti, compensi, GDPR, ecc.) |

Esecuzione:
```bash
cd /app/backend && python -m pytest tests/test_smoke_regression.py -v
```

## 🌐 Ambienti

| Ambiente | URL | Uso |
|---|---|---|
| **Preview** | `https://registrateam-vol.preview.emergentagent.com` | Sviluppo + test interno |
| **Locale** | `http://localhost:3000` (frontend) + `http://localhost:8001` (backend) | Dev |
| **Produzione** | TBD (`https://app.registrateam.it`) | Da fare deploy |

## 🚀 Deploy produzione (TODO)

1. ☐ Hosting backend: Render free tier (o Aruba Cloud, Railway)
2. ☐ MongoDB Atlas free tier (512MB)
3. ☐ Frontend su Vercel/Netlify
4. ☐ DNS registrateam.it → server produzione
5. ☐ HTTPS con Let's Encrypt (automatico)
6. ☐ Aggiornare redirect .com/.net da http → https
7. ☐ Brevo: validare assistenza@registrateam.it (SPF + DKIM)
8. ☐ Sentry per error tracking
9. ☐ MongoDB backup automatici

## 🔧 Comandi utili

```bash
# Backend restart
sudo supervisorctl restart backend

# Frontend rebuild + restart
cd /app/frontend && npx expo export -p web && sudo supervisorctl restart expo

# Logs backend
tail -f /var/log/supervisor/backend.err.log

# Smoke test
cd /app/backend && python -m pytest tests/test_smoke_regression.py -v

# Linting
cd /app/backend && python -m ruff check . --fix
```

## 📚 File di memoria

| File | Contenuto |
|---|---|
| `/app/memory/PRD.md` | Product Requirements + storia lavoro |
| `/app/memory/LOCKED_FILES.md` | File "bloccati" non da modificare senza OK utente |
| `/app/memory/REFACTORING_PLAN.md` | Piano dettagliato refactoring server.py |
| `/app/memory/test_credentials.md` | Credenziali test utenti |
| `/app/memory/ARCHITECTURE.md` | (questo file) |
