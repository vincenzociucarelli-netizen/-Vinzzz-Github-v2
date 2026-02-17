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

## Pending Issues (P1)
- Parent login not working (frontend redirect issue)

## Backlog (P2)
- @expo/vector-icons not rendering on web
- Stripe integration for payments
- Freemium 30-member limit enforcement

## Test Credentials
- Admin: pallavoloperugia@gmail.com / 11092012
- Coach (Rossi Lia): lia@test.com / Test1234
- Coach (Pietro): coach.pietro@test.com / Test1234
