# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Comprehensive sports team management application for Italian volleyball societies.

## What's Been Implemented

### Session 2026-03-26 (Latest - Fork 2)
- **Bug Fix (P0)**: Added missing "Presa visione Informativa Privacy" checkbox to registration welcome screen (`register.tsx`). Now all 4 GDPR consent checkboxes are present: privacy_viewed, data_processing, images_internal, images_promo.
- **Bug Fix (P0)**: Fixed consent key mapping mismatch between frontend and backend. Frontend now sends keys matching DB schema directly (`images_internal`, `images_promo` instead of `internal_images`, `promotional_images`).
- **Bug Fix**: Backend no longer hardcodes `privacy_viewed` to `True` - it reads the actual value from the frontend payload.
- **UX**: The `privacy_viewed` checkbox auto-checks when user opens the Privacy Policy document.

### Session 2026-03-26 (Fork 1)
- **Bug Fix (P0 CRITICO)**: Corretto `GDPRPrivacyModal` che mostrava i dati della famiglia sbagliata nel PDF di anteprima.
- **Security Fix**: Aggiunta validazione di ownership nell'endpoint `POST /api/documents/sign-gdpr-privacy`.
- **UI Enhancement**: Ampliato contenuto notifiche Admin con dettagli strutturati.
- **Refactoring GDPR/Secondo Genitore**: Rimosso cross-linking automatico. Secondo genitore gestito per-atleta.
- **Logic**: Blocco firma GDPR solo se 2° genitore registrato nel sistema.
- **Onboarding**: Consensi GDPR spostati nella registrazione iniziale per tutti i ruoli.

### Session 2026-03-25
- **Bug Fix**: Fixed "Stato di Nascita" (Country of Birth) not saving.
- **Bug Fix**: Fixed "Luogo di Nascita" field hidden for foreign-born athletes.
- **Feature**: GDPR signing limit per parent.
- **Feature**: Audit log entries for trial document signing, QR check-in, trial period start.

### Session 2026-03-24
- **Welcome Screen Registration Flow**: Mandatory Privacy Policy + Terms viewing before registration
- **User Profile Consent Management**: Reusable ConsentManager for all roles
- **Admin Consent Audit Trail**: Full audit page at /admin/settings/consent-audit
- **PhotoViewer Rewrite**: Pinch-to-zoom, auto-rotation, double-tap zoom
- **Coach Team Photo**: Clickable photo in team detail opens full PhotoViewer
- **Parent Profile Buttons**: Renamed and color-coded

### Previous Sessions
- GDPR consent tracking system (4 granular checkboxes, audit trail, PDF snapshots)
- Dynamic team creation form (installments, venues)
- Privacy-first avatars (initials instead of photos)
- Team photo visibility on Admin and Coach views
- Pre-season campaigns and automated reminders
- Athlete timeline, certificate management, payment tracking
- Critical bug fixes (login, registration, team creation, SPA routing)

## Architecture
- Backend: FastAPI on port 8001 | Frontend: Expo React Native Web (static build) | DB: MongoDB | Email: Brevo

## Key DB Schema
- `users.consents`: Keys = `privacy_viewed`, `data_processing`, `images_internal`, `images_promo`
- `athletes`: `second_parent_email`, `second_parent_id`

## Pending / Backlog
- (P0) Supporto testing manuale attivo utente
- (P2) Fix validazione numero di telefono per minori (issue ricorrente)
- (P1) UI per atleti con contratto formale (programmato per l'estate)
- (P2) Refactor server.py (21000+ lines)
- (P2) Re-implement Stripe payments
- (P2) Refactor large frontend components

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent (Sofia): sofia@test.com / Test1234
- Parent (Marco): marco@test.com / Test1234

## Key Files
- `app/register.tsx` - Registration with 4 GDPR consent checkboxes
- `src/components/ConsentManager.tsx` - Reusable consent card (source of truth for keys)
- `src/components/GDPRPrivacyModal.tsx` - GDPR privacy signing modal
- `app/admin/settings/consent-audit.tsx` - Admin audit page
- `app/parent/athlete/[id].tsx` - Parent athlete detail (GDPR blocking UI)
- `app/parent/profile.tsx` - Parent profile (consent display)

## Test Reports
- `/app/test_reports/iteration_60.json` - GDPR blocking tests (8/8 passed)

## Critical Notes
- **Frontend Build**: Must use `npx expo export -p web` + `serve -s dist -l 3000`. Hot reload/tunnel does NOT work.
- **Consent Keys**: Frontend, Backend, and ConsentManager must ALL use: `privacy_viewed`, `data_processing`, `images_internal`, `images_promo`
