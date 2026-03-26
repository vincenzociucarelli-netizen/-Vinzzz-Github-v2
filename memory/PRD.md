# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Comprehensive sports team management application for Italian volleyball societies.

## What's Been Implemented

### Session 2026-03-26 (Fork 3 - Current)
- **Feature: Documenti Personali Genitore** - Aggiunta cartella "Documenti di [NOME GENITORE]" nella pagina "I Miei Documenti", separata dalle cartelle dei figli. Mostra 3 documenti di accettazione privacy con metadati (data, fonte, versione). Backend genera "documenti virtuali" dai consensi in `users.consents`.
- **Bug Fix (P0): Checkbox "Informativa Privacy visionata"** - Aggiunta la checkbox mancante nella registrazione. Ora 4 checkbox: privacy_viewed, data_processing, images_internal, images_promo.
- **Bug Fix (P0): Mapping chiavi consensi** - Frontend ora invia chiavi allineate al DB (`images_internal`, `images_promo`). Backend non hardcoda più `privacy_viewed`.

### Session 2026-03-26 (Fork 2)
- Bug Fix P0 CRITICO: GDPR Modal data leak + ownership validation
- UI Enhancement: Notifiche Admin con dettagli completi
- Refactoring: Secondo genitore per-atleta, blocco firma GDPR condizionale
- Onboarding: Consensi GDPR spostati nella registrazione

### Previous Sessions
- GDPR consent tracking, audit trail, ConsentManager
- Dynamic team creation, privacy-first avatars
- Pre-season campaigns, automated reminders
- Athlete timeline, certificate management, payment tracking

## Architecture
- Backend: FastAPI on port 8001 | Frontend: Expo React Native Web (static build) | DB: MongoDB | Email: Brevo

## Key DB Schema
- `users.consents`: Keys = `privacy_viewed`, `data_processing`, `images_internal`, `images_promo`
- `athletes`: `second_parent_email`, `second_parent_id`
- `signed_documents`: Physical signed PDFs (GDPR, trial docs, receipts)

## Key API Endpoints
- `GET /api/documents/my-documents`: Returns `grouped.personal` (with consent virtual docs), `grouped.minors`, `grouped.parent_name`
- `POST /api/auth/register`: Accepts `consents` dict with 4 keys
- `GET /api/users/me/consents`: Returns user's consent data
- `PATCH /api/users/consents/me`: Update consents

## Pending / Backlog
- (P0) Supporto testing manuale attivo utente
- (P2) Fix validazione numero di telefono per minori
- (P1) UI per atleti con contratto formale (programmato per l'estate)
- (P2) Refactor server.py (21000+ lines)
- (P2) Re-implement Stripe payments
- (P2) Pubblicazione App Store e dominio

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent (Sofia): sofia@test.com / Test1234
- Parent (Marco): marco@test.com / Test1234

## Key Files
- `frontend/app/parent/documents.tsx` - Documenti page with personal + children sections
- `frontend/app/register.tsx` - Registration with 4 GDPR consent checkboxes
- `frontend/src/components/ConsentManager.tsx` - Consent card (keys source of truth)
- `backend/server.py` - Monolithic backend (21000+ lines)

## Test Reports
- `/app/test_reports/iteration_61.json` - Personal documents + consent docs (100% passed)
- `/app/test_reports/iteration_60.json` - GDPR blocking tests (8/8 passed)

## Critical Notes
- **Frontend Build**: Must use `npx expo export -p web` + `serve -s dist -l 3000`. Hot reload/tunnel does NOT work.
- **Consent Keys**: Frontend, Backend, and ConsentManager must ALL use: `privacy_viewed`, `data_processing`, `images_internal`, `images_promo`
- **User Language**: Always respond in Italian
