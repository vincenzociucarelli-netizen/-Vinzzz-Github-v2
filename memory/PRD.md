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
- [x] Notification System: Manual email notifications via Brevo
- [x] Parent Cross-Linking: Auto-link when second_parent_email matches
- [x] Audit Logging: Filterable, collapsible, with deletion_request_cancelled support
- [x] Minor Dashboard: Certificate expiry + verification status display (FIXED)
- [x] Profile: PW Protezione Dati button added (March 22, 2026)
- [x] Bug fixes: Profile completeness, PDF viewer, admin state persistence, deletion flow

## Recent Changes (March 22, 2026 - Fork Session)
1. **Certificate Expiry in Minor Lite Dashboard**: Fixed backend field name (medical_certificate_expiry), added certificate_verified field
2. **PW Protezione Dati on Parent Profile**: Added button + full management UI for data protection passwords per athlete
3. **Audit Log Enhancements**: Added summary line in collapsed view, deletion_request_cancelled action support
4. **Date formatting**: Fixed Invalid Date handling in minor dashboard

## Pending Tasks
- (P1) Athlete History/Timeline Page
- (P1) Automated Pre-Season Reminders
- (P2) UI for Contracted Athletes
- (P3) Refactor server.py (monolithic, 20K+ lines)
- (P3) Stripe integration
- (P3) DB Cleanup (viewer → dirigente migration)
- (P3) Publication assistance (domain/App Store)

## Key Files
- backend/server.py (main backend, 20K+ lines)
- frontend/app/parent/athlete/[id].tsx (athlete page, 4700+ lines)
- frontend/app/parent/profile.tsx (parent profile with data password)
- frontend/app/minor/index.tsx (minor lite dashboard)
- frontend/app/admin/settings/audit-logs.tsx (audit log page)

## Credentials (Test Environment)
- Admin: admin@test.com (in test_database)
- Parent: perla@test.com / Test1234
- Minor: MARTY2008 / PIN 1234
