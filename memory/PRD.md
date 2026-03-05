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

## Latest Session Updates (04-05/03/2026)

### P0 - Coach Document Fields COMPLETE (05/03/2026)
**Recurring Issue RESOLVED**: Removed ID document fields from Coach profile page
- **Issue**: User reported the same issue twice - document fields were still visible
- **Root Cause**: Previous fix only addressed Admin view (`admin/coach/[id].tsx`), but Coach's OWN profile page (`coach/profile.tsx`) still displayed the fields
- **Fix Applied**:
  - File: `/app/frontend/app/coach/profile.tsx`
  - Removed: Tipo Documento, Numero Documento, Scadenza fields from display
  - Removed: Fronte Documento/Retro Documento image placeholders
  - Result: Section "🏦 Dati Bancari" now shows ONLY: IBAN, Intestatario, Banca
- **Verified**: Screenshot confirms only banking fields visible in coach profile

### P0 - Document Fields Removed from ALL Staff Profiles (05/03/2026)
Extended the document field removal to Collaboratore and Dirigente profiles:
- **Collaboratore Admin View** (`admin/collaboratore/[id].tsx`):
  - Removed entire "🪪 Documento" card with Fronte/Retro images
  - Only "🏦 Dati Bancari" section remains
- **Dirigente Admin View** (`admin/dirigente/[id].tsx`):
  - Removed from editing mode: Tipo Documento selector, Fronte/Retro upload buttons
  - Removed from view mode: Tipo Documento, Documento status, Fronte/Retro images
  - Changed title from "Documento e Dati Bancari" to "🏦 Dati Bancari"
  - Only IBAN, Intestatario, Banca fields remain

### P0 - 6 Admin UI/Logic Fixes Complete (04/03/2026)
Implemented all 6 modifications requested by the user for the Admin section:

1. **Coach Checklist**: Removed "Documento d'identità acquisito" item from onboarding checklist
   - File: `/app/frontend/app/admin/coach/[id].tsx`
   - Reduced totalItems from 5 to 4
   - Removed id_acquired from completedItems array and modal display

2. **Coach Compensation Display**: Removed duplicate "Totale Compenso Contratto (per RAS)" box
   - File: `/app/frontend/app/admin/coach/[id].tsx`
   - Kept only the "Comunicazione RAS - Totale Contratto" box in edit mode
   - Removed redundant totalBox in view mode

3. **Coach Document Fields (Admin View)**: Removed ID document fields (Type, Number, Expiry) from admin view
   - File: `/app/frontend/app/admin/coach/[id].tsx`
   - Section now shows only IBAN, Intestatario Conto, Banca
   - Card title changed from "Documento e Dati Bancari" to "Dati Bancari"

4. **Collaborator Assignment Banner**: Added auto-close for "Assegnazioni salvate" success banner
   - File: `/app/frontend/app/admin/collaboratore/[id].tsx`
   - Web: Creates toast-style banner that auto-removes after 2.5 seconds
   - Mobile: Uses native Alert (no change needed)

5. **Rename Role "Visualizzatore" to "Dirigente"**: Updated all occurrences
   - File: `/app/frontend/app/admin/dirigenti.tsx`
   - getRoleLabel() now returns "Dirigente" instead of "Visualizzatore"
   - Modal button text changed to "Rendi Dirigente"
   - Success alert message updated

6. **Adult Athlete QR Code**: Updated to use new 12-char alphanumeric identifier
   - File: `/app/backend/server.py`
   - Both adult athlete creation endpoints now use `generate_qr_identifier()` + `generate_qr_code_from_identifier()`
   - `qr_identifier` field added to athlete records for consistency with existing minor athlete flow

### Collaborator Checklist Consistency Fix
- Also removed "Documento d'identità acquisito" from Collaboratore checklist to match Coach
- File: `/app/frontend/app/admin/collaboratore/[id].tsx`
- Updated totalItems from 5 to 4, filtered out id_acquired from display

### Testing: 5/5 Frontend Tests Passed
- Test Report: `/app/test_reports/iteration_27.json`

### P0 - Certificate Override Popup Complete
- **Backend**: Added `POST /api/certificates/deny-access` endpoint
  - Logs denial of access for expired certificate in audit log
  - Accessible by Admin and Coach roles
  - Returns: `{message, log_id, athlete_name}`
- **Frontend**: Updated coach QR scanner modal (`/app/frontend/app/coach/index.tsx`)
  - Added two distinct buttons: "RIFIUTA" (red) and "AUTORIZZA" (green)
  - RIFIUTA: Immediately denies access and logs to audit
  - AUTORIZZA: Requires mandatory reason (min 5 chars) before allowing single-session override
  - Added cancel link to close modal without action
  - New styles: `certificateActionButtons`, `certificateDenyButton`, `certificateAuthorizeButton`
- **Testing**: 100% backend tests passed (10/10)
  - Test file: `/app/backend/tests/test_certificate_override.py`

### GDPR Privacy Templates Implementation
- Created 2 new GDPR-compliant PDF templates:
  - `generate_gdpr_adult_privacy_pdf()` - For adults (collaborators, coaches, directors, adult athletes)
  - `generate_gdpr_minor_privacy_pdf()` - For parents signing for minors
- New endpoints:
  - `POST /api/documents/sign-gdpr-privacy` - Sign and save document
  - `POST /api/documents/preview-gdpr-privacy` - Preview PDF without signature
- Full legal metadata: document_version, timestamp, user_id, society_id, hash_document (SHA-256), device_type, ip_address
- Email notification with PDF attachment via `send_document_email()`

### Frontend Privacy Updates
- New component: `GDPRPrivacyModal.tsx` with preview PDF button
- Updated all profile pages to use new GDPR modal
- New page: `/parent/documents` - Documents grouped by child

### P2 Fix - Admin Dashboard Loading
- Implemented `fetchWithRetry()` helper with exponential backoff (max 3 retries)
- Grouped 9 API calls into 3 batches to reduce server load
- Dashboard now more reliable under heavy load

### P3 - Stripe Payment Infrastructure
- Backend endpoints:
  - `GET /api/settings/stripe` - Get settings (masked keys)
  - `PATCH /api/settings/stripe` - Save settings with validation
  - `DELETE /api/settings/stripe/keys` - Remove all keys
- Frontend page: `/admin/settings/stripe.tsx`
- Each society can configure their own Stripe keys
- Automatic test/live mode detection from key prefix

### Bug Fixes
- Removed "Documento e Dati Bancari" section from collaborator profile
- Fixed @expo/vector-icons imports

### Files Created/Modified
- `/app/frontend/app/admin/settings/stripe.tsx` (NEW)
- `/app/frontend/app/parent/documents.tsx` (NEW)
- `/app/frontend/src/components/GDPRPrivacyModal.tsx` (NEW)
- `/app/backend/server.py` (MODIFIED - GDPR, Stripe endpoints)

## Upcoming Tasks (Priority Order)
1. ~~P1: Implement comprehensive logging for critical actions~~ ✅ COMPLETED
2. ~~P1: Strengthen authentication security: rate limiting on login~~ ✅ COMPLETED
3. ~~P0: Certificate override popup with RIFIUTA/AUTORIZZA buttons~~ ✅ COMPLETED (04/03/2026)
4. P2: Verify frontend certificate override popup when ngrok tunnel is operational
5. P2: Test admin dashboard intermittent loading fix
6. P2: Apply "end-of-trial" logic for Parent of minor athlete
7. P3: Global check for @expo/vector-icons imports
8. P3: Stripe Integration for premium plans (postponed to next season)
9. P3: Refactor the monolithic `server.py` into a modular structure

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
