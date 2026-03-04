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

## Current Status (as of 2026-03-03)

### Completed Today (03/03/2026)
- [x] **GDPR Facilitator Model - Profile Photo Removal**: Completed removal of profile photos from all Admin views
  - Dirigenti list: Now shows icon (shield-checkmark for admin, briefcase for dirigente)
  - Coaches list: Already using emoji icons only
  - Collaboratori list: Already using emoji icons only
  - Athletes list: Already text-only without photos
  - All detail pages (Coach, Collaboratore, Dirigente): Show placeholder icon instead of photo
- [x] **Compensation Calculation Bug Fix**: Fixed date format bug in Collaboratore detail page
  - Issue: `split('-')` was used on dates in `dd/mm/yyyy` format
  - Fix: Dates now display directly without transformation
  - Verified: Month calculation works correctly (e.g., 10 mesi for Sep 2025 - Jun 2026)
- [x] **GDPR Audit Logging System**: Implemented comprehensive audit trail for critical actions
  - New `audit_logs` collection in MongoDB
  - Standardized `log_audit()` function for consistent logging
  - Actions logged: Login, Certificate Modified, Certificate Override, Compensation Modified, Document Accepted, User Deleted
  - Admin API endpoint: `GET /api/audit-logs` to view logs
- [x] **Progressive Rate Limiting (Login Security)**: Implemented brute-force protection
  - Uses `login_rate_limits` MongoDB collection to track attempts per IP
  - Progressive escalation: 5 attempts→1min, 10→5min, 15+→1hr+password reset suggestion
  - Resets on successful login
- [x] **Profile Photo Space Removal**: Removed placeholder icons from Coach, Collaboratore, Dirigente detail pages for cleaner UI
- [x] **QR Code System Refactor (Backend)**: Implemented new attendance system per spec
  - **QR Identifier**: 12-char alphanumeric code per athlete (permanent, no personal data)
  - **Attendance Model**: athlete_id + team_id + date + training_slot
  - **Validation**: Active athlete check, medical certificate check, duplicate detection
  - **Double Scan**: Returns "already_registered" with info popup option
  - **Force Registration**: Creates new record with `forced=true` and `force_note`
  - **Admin Endpoints**: 
    - `POST /api/admin/generate-all-qr-identifiers` - Generate QR for all athletes
    - `POST /api/admin/regenerate-all-qr-codes` - Regenerate all (invalidates old QRs)
- [x] **QR Code System Refactor (Frontend Coach)**: Updated attendance scanner UI
  - Added team selector before scanning (required)
  - Auto-selects team if coach has only one
  - Shows athlete name in success/error messages
  - "Already registered" shows detailed popup with time and team name
  - Force registration now includes note input
  - Added Modal for team selection
- [x] **QR Code Display/Print (Parent & Admin)**: Updated athlete card
  - QR modal shows new `qr_identifier` (12-char alphanumeric code)
  - Print function generates clean printable page with athlete name and QR code
  - Share function allows sharing QR as image/HTML
  - Perfect for minivolley kids without phones - parents can print and laminate
- [x] **Admin Audit Logs Page**: Created dedicated page to view all audit logs
  - Path: `/admin/settings/audit-logs`
  - Filters by action type (Login, Certificati, Override, Compensi, Documenti, Eliminazioni)
  - Shows: timestamp, user, target user, action details, IP address
  - Pagination with "load more" for large datasets
  - Accessible from Admin Settings menu
- [x] **CSV Export Feature**: Export data for GDPR compliance and reporting
  - Path: `/admin/settings/export-data`
  - 4 export types: Atleti, Presenze, Compensi Staff, Audit Log
  - Downloads CSV files with Italian headers
  - API endpoints: `/api/export-csv/athletes`, `/api/export-csv/attendances`, `/api/export-csv/compensations`, `/api/export-csv/audit-logs`
  - Accessible from Admin Settings menu (cyan card)
- [x] **Society Isolation (Multi-tenancy)**: Verified and fixed data isolation
  - All major endpoints now filter by `society_id`:
    - `/teams`, `/athletes`, `/athletes/pending`
    - `/users/coaches`, `/users/collaboratorees`, `/users/dirigentees`, `/users/parents`, `/users/pending`
    - `/stats/overview`, `/birthdays/today`
  - Fixed legacy data: assigned `society_id` to 6 teams, 4 athletes, 7 users missing it
  - Each ASD can only see their own data
- [x] **Athlete Limit (150 per ASD)**: Technical limit until 30/06/2026
  - Check enforced on `POST /api/athletes` when parent registers athlete
  - Error message: "Limite di 150 atleti raggiunto. Contatta l'amministratore per piani premium."
  - `/api/stats/overview` now includes `athlete_limit` object with max, current, remaining, active, end_date
  - Limit automatically disabled after 30/06/2026

### Completed Previously (28/02/2026)
- [x] **Residuo Dovuto Fix**: Fixed calculation to use `Quota Totale - Sconto - Pagato` (now shows €200 correctly)
- [x] **3ª Rata con Sconto**: Shows "(con sconto)" label and discounted amount (€250 - €50 = €200)
- [x] **Notifications Removed**: Removed "Scadenze in arrivo" section from athlete dashboard
- [x] **Sport Icon**: Replaced volleyball emoji (🏐) with actual sport_image from society settings
- [x] **Receipt Payment Method**: Added payment method (POS/Bonifico/Contanti) to downloadable receipt
- [x] **Admin Receipt for Adults**: Admin now sees simple receipt (same as athlete) for adult athletes, formal Attestato only for minors

### Completed Previous Session (27/02/2026)
- [x] **Coach Info Update**: Updated coach name from "ROSSI MARIO" to "SERZI LUCIO" in database
- [x] **WhatsApp Contact**: Added WhatsApp button next to coach name for direct contact
- [x] **Training Day Color**: Changed training day color to dark blue (#1565C0)
- [x] **Document List Cleanup**: Medical certificate removed from "I Miei Documenti" list to avoid duplication
- [x] **Print Certificate Fix**: Improved print functionality with better popup handling and delayed print trigger
- [x] **Receipt Download Fix**: Fixed fiscal receipt download - was calling wrong endpoint, now uses `/payments/{id}/fiscal-receipt`
- [x] **Redundant Fields Removed**: Removed Cognome/Nome from "Dati Iscrizione" section (redundant on user's own profile)
- [x] **Team Quote Section**: Added "Quote" section to payments page showing team installments (€800 total, €300 1st, €250 2nd/3rd with due dates)
- [x] **In-App Notifications**: Implemented expiration notifications (7 days before) for medical certificates and payment due dates
- [x] **UI Cleanup - Documents**: Removed "Carica Certificato Medico" section from "I Miei Documenti" page
- [x] **UI Cleanup - Payments Header**: Removed duplicate download icon from payments page header
- [x] **Renamed Receipt**: Changed "Ricevuta Fiscale" to "Ricevuta Pagamenti" (button and document title)
- [x] **Medical Certificates Archive**: Implemented 5-year archive for ASD legal compliance
  - Automatic archive when athlete uploads new certificate
  - Admin page to view/search/download archived certificates
  - Shows: last name, first name, issue date, expiry date, team
  - Stats by year with legal compliance note

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

## Latest Session Updates (04/03/2026)

### GDPR Privacy Templates Implementation
- Created 2 new GDPR-compliant PDF templates:
  - `generate_gdpr_adult_privacy_pdf()` - For adults (collaborators, coaches, directors, adult athletes)
  - `generate_gdpr_minor_privacy_pdf()` - For parents signing for minors
- New endpoint: `POST /api/documents/sign-gdpr-privacy`
- Full legal metadata: document_version, timestamp, user_id, society_id, hash_document (SHA-256), device_type, ip_address
- Email notification with PDF attachment via `send_document_email()`

### Frontend Updates
- New component: `GDPRPrivacyModal.tsx` supporting both adult and minor privacy flows
- Updated all profile pages to use new GDPR modal:
  - `/app/collaboratore/profile.tsx`
  - `/app/coach/profile.tsx`
  - `/app/dirigente/profile.tsx`
  - `/app/athlete/profile.tsx`
  - `/app/athlete/index.tsx`

### Bug Fixes
- Removed "Documento e Dati Bancari" section from collaborator profile (kept only IBAN/Bank)
- Fixed @expo/vector-icons imports in export-data.tsx and audit-logs.tsx

### Known Issues
- P2: Admin dashboard sometimes fails to load lists (intermittent) - 9 parallel API calls may cause race conditions under load
- ~~P3: `@expo/vector-icons` not rendering correctly on web~~ ✅ FIXED (04/03/2026)
- ~~P3: Discount field input bug results in leading zeros~~ ✅ FIXED

## Upcoming Tasks (Priority Order)
1. ~~P1: Implement comprehensive logging for critical actions~~ ✅ COMPLETED
2. ~~P1: Strengthen authentication security: rate limiting on login~~ ✅ COMPLETED
3. P2: Verify that all backend database queries strictly filter by `society_id` for data isolation
4. P2: Apply "end-of-trial" logic for Parent of minor athlete
5. P2: Data export feature (CSV format for athletes, attendance, compensations, logs)
6. P2: Technical limit of 150 athletes per sports club (ASD)
7. P3: Stripe Integration for premium plans
8. P3: Refactor the monolithic `server.py` into a modular structure

## Key API Endpoints
- `GET /api/stats/overview` - Dashboard statistics (admin only)
- `GET /api/certificates/expiring` - Expiring medical certificates
- `POST /api/attendance/check` - Check-in athlete by ID or code
- `POST /api/documents/sign` - Sign documents digitally
- `POST /api/athletes/upload-medical-certificate` - Upload medical cert
- `GET /api/birthdays/today` - Today's birthdays
- `GET /api/societies/invite-code` - Society invite code
- `GET /api/audit-logs` - View audit logs (admin only) ✅ NEW

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
