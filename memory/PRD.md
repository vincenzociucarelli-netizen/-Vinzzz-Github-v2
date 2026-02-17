# RegistraTEAM - Volleyball Club Management Application

## Original Problem Statement
Full-stack React/FastAPI application for managing a volleyball club with:
- QR code-based attendance system
- Digital signature module for monthly receipts
- Sports compensation management with tax threshold declarations (€5k/€15k)
- Email notifications via Brevo

## Core Features Implemented

### Authentication & User Management
- Multi-role system: Admin, Coach, Parent, Dirigente, Athlete
- JWT-based authentication
- Password reset via email

### Coach Compensation Module (Latest - Feb 2026)
- Contract date-based compensation periods
- Prior compensation tracking
- Dual year summaries (start year with priors, end year)
- Tax threshold declarations (€5k previdenziale, €15k fiscale)
- Digital signature for monthly receipts
- PDF generation and email sending

### Email Service
- Migrated from SendGrid to Brevo
- DNS configuration (TXT, CNAME, DMARC)
- Templated emails for receipts and declarations

### UI/UX Updates
- Improved back arrow visibility across all pages
- Contract-based month display in compensation page
- Read-only payment history for coaches

## Technical Architecture

```
/app
├── backend/
│   ├── server.py          # FastAPI main server
│   ├── models.py          # Pydantic models
│   ├── email_service.py   # Brevo integration
│   └── .env               # BREVO_API_KEY, MONGO_URL
└── frontend/
    ├── app/
    │   ├── admin/         # Admin pages
    │   ├── coach/         # Coach pages (profile, compensation)
    │   ├── parent/        # Parent pages
    │   └── login.tsx
    └── src/
        ├── services/api.ts
        └── types/index.ts
```

## Key Database Collections
- **users**: All user types with role-specific fields
- **athletes**: Athlete profiles
- **teams**: Team definitions
- **threshold_declarations**: Signed tax threshold declarations
- **societies**: Club/society settings
- **coach_compensations**: Compensation records with signatures

## Latest Updates (Feb 17, 2026)

### Fixed Issues - Session 2
1. **Quietanze Ott/Nov 2025 non visibili** (P0 - RESOLVED)
   - Le quietanze sono ora visibili nella pagina `/coach/compensation`
   - Ottobre 2025 ✅ e Novembre 2025 ✅ mostrati correttamente

2. **Email non arrivano a Pallavolo Perugia** (P0 - RESOLVED)
   - Causa: campo `email` non era impostato nelle settings società
   - Aggiunto campo `email` a `SocietySettingsUpdate` model
   - Aggiunto `email` a GET/PATCH `/api/settings/society`
   - Configurato `pallavoloperugia@gmail.com` come destinatario
   - Backend ora legge email da `settings` (priorità) o `societies`

3. **Registro quietanze nel profilo** (P1 - IN PROGRESS)
   - Il file `profile.tsx` ha problemi legacy di sintassi
   - La sezione "Storico Pagamenti" esiste ma mostra il vecchio formato
   - Richiede refactoring completo del file

### Fixed Issues - Session 1
1. **Signed Receipts Not Visible** (P0 - RESOLVED)
   - Root cause: react-native-signature-canvas uses WebView which doesn't work on web
   - Solution: Created new `SignaturePadInline` component using `react-signature-canvas` for web

2. **"Il Mio Profilo" Position** (P1 - RESOLVED)
   - Moved link directly under coach name with improved layout

## Pending Issues (P1)
- Parent login not working (frontend redirect issue)
- Compact registry in profile.tsx needs refactoring

## Backlog (P2)
- @expo/vector-icons not rendering on web (recurring issue)
- Stripe integration for payments
- Freemium 30-member limit enforcement
- Professional Athletes with Compensation module

## Test Credentials
- Admin: pallavoloperugia@gmail.com / 11092012
- Coach (Rossi Lia): lia@test.com / Test1234
- Coach (Pietro): coach.pietro@test.com / Test1234
- Parent (Luca): luca@test.com / Test1234

## Test Reports
- Latest: `/app/test_reports/iteration_6.json` - 100% pass rate
