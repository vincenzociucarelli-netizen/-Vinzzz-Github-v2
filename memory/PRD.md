# RegistraTeam - Sports Club Management App

## Overview
Full-stack React Native (Expo) + FastAPI + MongoDB application for sports club management (volleyball focus). Supports multiple user roles: Admin, Dirigente, Coach, Collaboratore, Parent, Athlete (adult/minor).

## Architecture
- **Frontend**: React Native with Expo Router, running on port 3000
- **Backend**: FastAPI on port 8001, all routes prefixed with `/api`
- **Database**: MongoDB via `MONGO_URL` environment variable
- **Auth**: JWT-based authentication with role-based access control

## Core Features Implemented
- Multi-role user management (Admin, Dirigente, Coach, Collaboratore, Parent, Athlete)
- Athlete registration (adult and minor flows)
- Team management
- Attendance tracking with QR codes
- Medical certificate management with expiry tracking
- Document management and digital signatures
- Privacy policy signature flow
- Compensation/payment tracking
- Match/event calendar
- Birthday notifications
- Invite code system for society registration

## Current Status (as of 2026-02-27)

### Completed This Session
- [x] **Coach Info Update**: Updated coach name from "ROSSI MARIO" to "SERZI LUCIO" in database
- [x] **WhatsApp Contact**: Added WhatsApp button next to coach name for direct contact
- [x] **Training Day Color**: Changed training day color to dark blue (#1565C0)
- [x] **Document List Cleanup**: Medical certificate removed from "I Miei Documenti" list to avoid duplication
- [x] **Print Certificate Fix**: Improved print functionality with better popup handling and delayed print trigger
- [x] **Receipt Download Fix**: Fixed fiscal receipt download - was calling wrong endpoint, now uses `/payments/{id}/fiscal-receipt`
- [x] **Redundant Fields Removed**: Removed Cognome/Nome from "Dati Iscrizione" section (redundant on user's own profile)
- [x] **Team Quote Section**: Added "Quote" section to payments page showing team installments (€800 total, €300 1st, €250 2nd/3rd with due dates)
- [x] **In-App Notifications**: Implemented expiration notifications (7 days before) for:
  - Medical certificates
  - Payment due dates
  - Works for adult athletes AND parents of minors
  - Yellow banner with "Scadenze in arrivo" title
  - Categories: expired (red), urgent (orange), warning (yellow)

### Previous Session Completions
- Fixed critical Admin Dashboard crash - endpoint `/api/certificates/expiring` was returning null
- Added robust error handling in frontend for all dashboard API calls
- Fixed payment registration bug - backend `PaymentCreate` model was missing fields
- Improved document download endpoint to support both file and base64 storage
- QR Code display on athlete dashboard with enlargeable modal
- Medical certificate upload by athletes themselves
- Privacy signature flow fixes
- UI/UX parity for schedule/payments pages
- "Presenze e Statistiche" page created
- Account deletion flow working

### Pending User Verification
- Compensation page logic (fallback for missing contract dates)

### Known Issues
- P2: `@expo/vector-icons` not rendering correctly on web (recurring)
- P1: Admin dashboard sometimes fails to load lists (intermittent)

## Upcoming Tasks (Priority Order)
1. P0: Apply "end-of-trial" logic for Parent of minor athlete
2. P1: Prepare assets and legal documents for app store submission
3. P2: Stabilize "PRO" Module
4. P3: Stripe Integration for premium plans (postponed)
5. P3: Freemium logic with upgrade prompts

## Key API Endpoints
- `GET /api/stats/overview` - Dashboard statistics (admin only)
- `GET /api/certificates/expiring` - Expiring medical certificates
- `POST /api/attendance/check` - Check-in athlete by ID or code
- `POST /api/documents/sign` - Sign documents digitally
- `POST /api/athletes/upload-medical-certificate` - Upload medical cert
- `GET /api/birthdays/today` - Today's birthdays
- `GET /api/societies/invite-code` - Society invite code

## Test Credentials
- Admin: `test.admin@test.com` / `Test1234`
- Adult Athlete (Lisa): `lisa@test.com` / `Test1234`
- Coach: `coach@test.com` / `Test1234`
- Adult Athlete (Genny): `genny@test.com` / `Test1234`
- Test Deletion: `testcancella@test.com` / `Test1234`

## Technical Notes
- Frontend uses `EXPO_PUBLIC_BACKEND_URL` for API calls
- MongoDB `_id` fields must be excluded from all API responses
- Hot reload enabled for both frontend and backend
- Supervisor manages services (`sudo supervisorctl restart frontend/backend`)

## 3rd Party Integrations
- Brevo/Sendinblue (email)
- reportlab (PDF generation)
- react-signature-canvas (digital signatures)
- python-codicefiscale / codice-fiscale-js (fiscal code validation)
- react-native-qrcode-svg (QR code display)
- @expo/ngrok (tunnel for development)

## Files of Reference
- `/app/frontend/app/admin/index.tsx` - Admin dashboard
- `/app/backend/server.py` - Main backend (needs refactoring)
- `/app/frontend/app/athlete/` - Athlete pages (index, schedule, payments, documents, profile, presenze)
