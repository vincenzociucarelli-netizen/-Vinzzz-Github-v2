# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Comprehensive sports team management application for Italian volleyball societies.

## What's Been Implemented

### Session 2026-03-24 (Latest)
- **Welcome Screen Registration Flow**: Mandatory Privacy Policy + Terms viewing before registration
- **User Profile Consent Management**: Reusable ConsentManager for all roles (parent, coach, athlete)
- **Admin Consent Audit Trail**: Full audit page at /admin/settings/consent-audit
- **PhotoViewer Rewrite**: Pinch-to-zoom, auto-rotation, double-tap zoom, pan when zoomed, download
- **Coach Team Photo**: Clickable photo in team detail opens full PhotoViewer
- **Parent Profile Buttons**: Renamed "Password" → "Pw d'accesso", 3 distinct colors (blue/orange/purple)

### Previous Sessions
- GDPR consent tracking system (4 granular checkboxes, audit trail, PDF snapshots)
- Dynamic team creation form (installments, venues)
- Privacy-first avatars (initials instead of photos)
- Team photo visibility on Admin and Coach views
- Pre-season campaigns and automated reminders
- Athlete timeline, certificate management, payment tracking
- Critical bug fixes (login, registration, team creation, SPA routing)

## Architecture
- Backend: FastAPI on port 8001 | Frontend: Expo React Native Web | DB: MongoDB | Email: Brevo

### Session 2026-03-25
- **Bug Fix**: Fixed "Stato di Nascita" (Country of Birth) not saving. Added missing `country_of_birth` field handling in `PATCH /api/athletes/{athlete_id}` endpoint (server.py line ~7341).
- **Bug Fix**: Fixed "Luogo di Nascita" field hidden for foreign-born athletes. The birth place input was only shown when country was "Italia", preventing users from entering a foreign city. Now the field is always visible; only the province field is hidden for non-Italian countries. Fixed in both `athlete/[id].tsx` edit modal and `register-athlete.tsx` form.
- **Feature**: GDPR signing limit — each parent can sign privacy for only ONE child when a second parent exists. The second parent is forced to login and sign for the other child(ren), which auto-activates their own consents. Single parents can sign for all children.
- **Fix**: Parent's own consents now sync when signing GDPR for a minor (mandatory + image consents). Retroactively synced Sofia's consents.
- **Feature**: Added audit log entry for trial document signing (`trial_document_signed` action). Includes signer name, athlete name, document type and timestamp. Added corresponding filter "Firme Prova" in admin audit log UI.
- **Feature**: Added audit logging for QR check-in attendance (`attendance_recorded`) and trial period start (`trial_started`). Created retroactive entries for ISA and PIA.
- **Fix**: Fixed "Documenti" filter using wrong action type (`document_accepted` → `document_signed`)
- **Fix**: Fixed name truncation in audit log cards — names now wrap instead of being cut off with "..."
- **Improvement**: Added new audit log filter tabs: "Presenze", "Inizio Prova"

## Pending / Backlog
- (P0) Support user manual testing
- (P1) UI per atleti con contratto formale (programmato per l'estate, post-pubblicazione)
- (P2) Refactor server.py (21000+ lines)
- (P2) Re-implement Stripe payments
- (P2) Refactor large frontend components

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent: perla@test.com / Test1234
- Adult Athlete: luna@18piu.com / Test1234

## Key Files
- `src/components/PhotoViewer.tsx` - Gesture-based photo viewer
- `src/components/ConsentManager.tsx` - Reusable consent card
- `app/admin/settings/consent-audit.tsx` - Admin audit page
- `app/parent/profile.tsx` - Parent profile (3-color buttons)
- `app/coach/team/[id]/index.tsx` - Coach team detail with photo viewer
