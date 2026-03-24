# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Comprehensive sports team management application for Italian volleyball societies. Features include pre-season registration, athlete management, coach/dirigente management, payment tracking, GDPR-compliant privacy handling, and admin dashboards.

## Core Requirements
- Pre-season registration with campaigns, public forms, conditional questions
- Team management with training schedules, venues, installments
- GDPR-compliant privacy system with granular consent tracking
- Athlete lifecycle management (trial → registered → end of season)
- Multi-role access (Admin, Coach, Dirigente, Parent, Athlete)
- "Versione Lite" for athletes (read-only dashboard)
- Automated email reminders for pre-season campaigns

## What's Been Implemented

### Session 2026-03-24 (Current)
- **Fixed**: Frontend static build using old backend URL (sports-portal-10 → season-enroll)
- **Fixed**: Login and forgot-password not working due to stale Metro cache
- **Fixed**: Team creation not saving `society_id` → teams invisible in list
- **Fixed**: `Alert.alert` not working on web → replaced with `window.alert`
- **Removed**: "Prima Squadra" checkbox from team creation form
- **Changed**: Venue fields in team creation → dropdown selectable from "Altre Impostazioni"
- **Changed**: Installments → dynamic (1-12 rates), first rate named "Iscrizione"
- **Changed**: Team list shows only total quota, no installment breakdown
- **Changed**: Coach/Dirigenti photos → initials-based avatars (privacy compliance)
- **GDPR Privacy System (Major Feature)**:
  - Updated Privacy Policy (new Section 7: Images/Video, Section 4: Management software)
  - 4 granular consent checkboxes for minors (parent registration):
    - Presa visione informativa (mandatory)
    - Autorizzazione trattamento dati (mandatory)
    - Utilizzo immagini uso interno (optional)
    - Utilizzo immagini finalità promozionali (optional)
  - Same 4 checkboxes in GDPRPrivacyModal for staff/adult athletes
  - Full consent tracking: value, timestamp, user_id, document_version, IP
  - Audit trail (consent_history) in DB
  - PDF snapshot includes "CONSENSI ESPRESSI" section with all checkbox values and metadata
  - Blocking logic: mandatory checkboxes must be checked to proceed

### Previous Sessions
- Dynamic pre-season form with conditional logic
- Automated pre-season reminders (APScheduler)
- "Missing parents" counter on admin dashboard
- Configurable "Nome Sport" in settings
- Athlete Timeline (Cronologia Atleta)
- End of trial period workflow
- Data deletion flow with admin approval
- Email notification system (Brevo)
- Certificate management
- Payment tracking with installments
- QR code attendance system

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: Expo React Native (Web) - static builds served via `npx serve`
- **Database**: MongoDB (test_database)
- **Email**: Brevo (Sendinblue)
- **Background Jobs**: APScheduler (certificate expiry + pre-season reminders)

## Pending / Backlog

### P1 - Upcoming
- User consent modification page (change consents from profile)
- Consent audit trail admin view
- Full manual testing of all flows

### P2 - Future
- UI per atleti con contratto (summer)
- Refactor server.py (monolithic)
- Re-implement Stripe payments
- DB cleanup: viewer → dirigente role migration
- Publication assistance (domain + App Store)
- Refactor frontend/app/parent/athlete/[id].tsx

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent: perla@test.com / Test1234
- Adult Athlete: luna@18piu.com / Test1234
