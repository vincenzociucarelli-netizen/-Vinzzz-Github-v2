# PRD - Sport Society Management App (RegistraTeam)

## Problem Statement
Build a comprehensive sports team management application with pre-season registration, end-of-trial period flow, conditional data deletion, notification system, parent cross-linking, and audit logging. The app serves sports clubs managing athletes, parents, coaches, and admin staff.

## Architecture
- **Backend**: FastAPI (Python) with MongoDB via motor
- **Frontend**: React Native (Expo) for web and mobile
- **Email**: Brevo (formerly Sendinblue)
- **Database**: MongoDB (test_database)

## Completed Features (as of March 22, 2026)
- [x] Pre-Season Registration: Campaigns, public form, admin dashboard, CSV export
- [x] End-of-Trial Flow: "Rimani e Firma Privacy" + "Non Rimanere" inline buttons
- [x] Data Deletion: Admin-approved, obligation checks, comprehensive deletion
- [x] Notification System: Manual email + auto cert expiry notifications (30/15 days)
- [x] Parent Cross-Linking: Auto-link when second_parent_email matches
- [x] Audit Logging: Filterable, collapsible, deletion_request_cancelled support
- [x] Minor Dashboard: Certificate expiry + verification status display
- [x] Profile: PW Protezione Dati button
- [x] Certificate Expiry Auto-Notifications: Email at 30 and 15 days before expiry
- [x] **Versione Lite Security Checklist** (March 22, 2026):
  - [x] ID 12 cifre alfanumerico immutabile (qr_identifier)
  - [x] QR contiene solo ID, identico tra Lite e completa
  - [x] Login Lite con nome_lite + PIN (case insensitive)
  - [x] nome_lite unico, validato 3-20 caratteri
  - [x] Blocco progressivo tentativi PIN (3→30s, 5→2min, 7→5min, 10+→15min)
  - [x] nome_lite NON usato per presenze o identificazione
  - [x] Presenze manuali tramite nome+cognome o lista squadra
  - [x] UI Lite: nome reale + iniziale cognome, colore identificativo, emoji personale
  - [x] Personalizzazione colore/emoji dall'atleta in versione Lite
  - [x] Nessuna logica usa nome_lite come identificatore
- [x] Bug fixes: Profile completeness, PDF viewer, admin state persistence, deletion flow

## Pending Tasks
- (P1) Athlete History/Timeline Page
- (P1) Automated Pre-Season Reminders
- (P2) UI for Contracted Athletes
- (P3) Refactor server.py (monolithic, 20K+ lines)
- (P3) Stripe integration
- (P3) DB Cleanup (viewer → dirigente migration)
- (P3) Publication assistance (domain/App Store)

## Key API Endpoints (New/Updated - Session)
- POST /api/athletes/{id}/set-nome-lite - Set unique nome_lite (parent/adult athlete)
- POST /api/athletes/{id}/set-lite-personalization - Set color/emoji (minor only)
- POST /api/auth/minor-login - Login with nome_lite + PIN (progressive blocking)
- POST /api/admin/trigger-certificate-notifications - Manual cert expiry check
- GET /api/minor/dashboard - Returns nome_lite, lite_color, lite_emoji

## DB Collections (New)
- certificate_notifications: Tracks sent expiry notifications
- login_attempts: Tracks failed minor login attempts for progressive blocking

## Key Files
- backend/server.py (main backend, 20K+ lines)
- frontend/app/parent/athlete/[id].tsx (athlete page, 4800+ lines)
- frontend/app/parent/profile.tsx (parent profile with data password)
- frontend/app/minor/index.tsx (minor lite dashboard with personalization)
- frontend/app/login.tsx (login page with Nome Lite)
- frontend/app/admin/settings/audit-logs.tsx (audit log page)

## Credentials (Test Environment)
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent: perla@test.com / Test1234
- Minor Login: MartinaG / PIN 1234
