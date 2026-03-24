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
  - New "Benvenuto in RegistraTEAM!" step added between role selection and registration form
  - Mandatory viewing of Privacy Policy and Terms of Use before proceeding
  - Documents open in new browser tabs
  - Green checkmarks appear after each document is visited
  - "Continua" button disabled until both documents are viewed
  - Back button resets document tracking state
  - Works for all 5 roles (parent, athlete, coach, dirigente, collaboratore)
  - Tested and verified with 100% pass rate (13/13 tests)

- **Fixed**: Frontend static build using old backend URL
- **Fixed**: Login and forgot-password not working due to stale Metro cache
- **Fixed**: Team creation not saving `society_id`
- **Fixed**: `Alert.alert` not working on web
- **Removed**: "Prima Squadra" checkbox from team creation form
- **Changed**: Venue fields -> dropdown selectable from "Altre Impostazioni"
- **Changed**: Installments -> dynamic (1-12 rates), first rate named "Iscrizione"
- **Changed**: Team list shows only total quota, no installment breakdown
- **Changed**: Coach/Dirigenti photos -> initials-based avatars (privacy compliance)
- **GDPR Privacy System (Major Feature)**:
  - 4 granular consent checkboxes for all roles
  - Full consent tracking: value, timestamp, user_id, document_version, IP
  - Audit trail (consent_history) in DB
  - PDF snapshot includes "CONSENSI ESPRESSI" section

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
- **Frontend**: Expo React Native (Web) - served via expo tunnel
- **Database**: MongoDB (test_database)
- **Email**: Brevo (Sendinblue)
- **Background Jobs**: APScheduler (certificate expiry + pre-season reminders)

## Pending / Backlog

### P0 - Immediate
- Support user manual testing and fix bugs as reported

### P1 - Upcoming
- User consent modification page (change consents from profile)
- Consent audit trail admin view
- Verify team photo visibility across Admin and Coach views

### P2 - Future
- UI per atleti con contratto (summer)
- Refactor server.py (monolithic)
- Re-implement Stripe payments
- DB cleanup: viewer -> dirigente role migration
- Publication assistance (domain + App Store)
- Refactor large frontend components

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent: perla@test.com / Test1234
- Adult Athlete: luna@18piu.com / Test1234
