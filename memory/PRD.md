# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Comprehensive sports team management application for Italian volleyball societies. Features include pre-season registration, athlete management, coach/dirigente management, payment tracking, GDPR-compliant privacy handling, and admin dashboards.

## Core Requirements
- Pre-season registration with campaigns, public forms, conditional questions
- Team management with training schedules, venues, installments
- GDPR-compliant privacy system with granular consent tracking
- Athlete lifecycle management (trial -> registered -> end of season)
- Multi-role access (Admin, Coach, Dirigente, Parent, Athlete)
- "Versione Lite" for athletes (read-only dashboard)
- Automated email reminders for pre-season campaigns

## What's Been Implemented

### Session 2026-03-24 (Latest)
- **NEW: Welcome Screen in Registration Flow**:
  - New "Benvenuto in RegistraTEAM!" step between role selection and registration form
  - Mandatory viewing of Privacy Policy and Terms of Use before proceeding
  - Documents open in new browser tabs, green checkmarks after visit
  - Works for all 5 roles. Tested 100% (13/13 tests)

- **NEW: User Profile Consent Management (GDPR)**:
  - Reusable `ConsentManager` component (`src/components/ConsentManager.tsx`)
  - Shows 4 consent types: privacy_viewed, data_treatment, images_internal, images_promo
  - Toggle switches for modifiable consents (images_internal, images_promo)
  - Full change history with expand/collapse
  - Added to Parent, Coach, and Athlete profile pages
  - Parent profile shows consent cards for each minor athlete child
  - Backend endpoints: GET/PATCH `/api/users/me/consents`, GET/PATCH `/api/athletes/{id}/consents`
  - Tested 100% (13/13 backend + all frontend verified)

- **NEW: Admin Consent Audit Trail**:
  - New page at `/admin/settings/consent-audit`
  - Card in admin settings menu linking to it
  - Shows all users/athletes with consent data
  - Badges showing consent status (green/red)
  - Detail modal with full history, IP addresses, timestamps
  - Backend endpoints: GET `/api/admin/all-consents`, GET `/api/admin/consent-history/{type}/{id}`

### Previous Work
- Critical bug fixes (login, registration, team creation)
- GDPR consent tracking system (4 granular checkboxes, audit trail, PDF snapshots)
- Dynamic team creation form (installments, venues)
- Privacy-first avatars (initials instead of photos)
- Team photo visibility on Admin and Coach views
- Pre-season campaigns and automated reminders
- Athlete timeline, certificate management, payment tracking

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: Expo React Native (Web) - served via expo tunnel
- **Database**: MongoDB (test_database)
- **Email**: Brevo (Sendinblue)
- **Background Jobs**: APScheduler

## Pending / Backlog

### P0 - Immediate
- Support user manual testing and fix bugs as reported

### P1 - Upcoming
- Verify team photo visibility across Admin and Coach views (minor verification task)

### P2 - Future
- UI per atleti con contratto (summer)
- Refactor server.py (monolithic, 21000+ lines)
- Re-implement Stripe payments
- Refactor large frontend components (teams.tsx, etc.)
- Publication assistance (domain + App Store)

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent: perla@test.com / Test1234
- Adult Athlete: luna@18piu.com / Test1234

## Key API Endpoints (Consent)
- `GET /api/users/me/consents` - Get user's consents
- `PATCH /api/users/me/consents` - Update user consents (images only)
- `GET /api/athletes/{id}/consents` - Get athlete consents (parent/admin)
- `PATCH /api/athletes/{id}/consents` - Update athlete consents (parent/admin)
- `GET /api/admin/all-consents` - All entities with consents (admin)
- `GET /api/admin/consent-history/{type}/{id}` - Full audit trail (admin)

## Key Files (Consent)
- `backend/server.py` (~lines 20946-21200) - Consent endpoints
- `frontend/src/components/ConsentManager.tsx` - Reusable consent card
- `frontend/app/admin/settings/consent-audit.tsx` - Admin audit page
- `frontend/app/parent/profile.tsx` - Parent profile with consent cards
- `frontend/app/coach/profile.tsx` - Coach profile with consent card
- `frontend/app/athlete/profile.tsx` - Athlete profile with consent card
