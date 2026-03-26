# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Comprehensive sports team management application for Italian volleyball societies.

## What's Been Implemented

### Session 2026-03-26 (Fork 3 - Current)
- **Feature: Documenti Personali Genitore con PDF** - Cartella "Documenti di [NOME]" nel profilo, cliccabili con PDF generato on-the-fly contenente: dati società, dati genitore, testo accettazione, metadati di firma (IP, version, hash, timestamp).
- **Feature: Endpoint PDF Consensi** - `GET /api/documents/consent-pdf/{consent_type}` genera PDF per privacy_viewed, data_processing, terms.
- **Feature: Checkbox "Informativa Privacy"** - Aggiunta alla registrazione.
- **Bug Fix: Mapping chiavi consensi** - Frontend → Backend → DB tutte allineate.
- **Enhancement: IP e versione alla registrazione** - Backend ora cattura IP e document_version nei metadati dei consensi.

### Previous Sessions
- GDPR consent tracking, audit trail, ConsentManager
- Multi-parent GDPR logic (blocking/signing)
- Dynamic team creation, privacy-first avatars
- Pre-season campaigns, automated reminders
- Athlete timeline, certificate management, payment tracking

## Architecture
- Backend: FastAPI port 8001 | Frontend: Expo React Native Web (static) | DB: MongoDB | Email: Brevo

## Key DB Schema
- `users.consents`: Keys = `privacy_viewed`, `data_processing`, `images_internal`, `images_promo` (each with value, timestamp, source, ip_address, document_version, user_id)
- `athletes`: `second_parent_email`, `second_parent_id`

## Key API Endpoints
- `GET /api/documents/consent-pdf/{consent_type}` - Generates PDF for parent's personal consent
- `GET /api/documents/my-documents` - Returns grouped personal + children docs
- `POST /api/auth/register` - With 4 consent keys + IP capture
- `GET /api/users/me/consents` - User consent data

## Pending / Backlog
- (P0) Supporto testing manuale attivo utente
- (P2) Fix validazione telefono minori
- (P1) UI atleti con contratto formale
- (P2) Refactor server.py (22000+ lines)
- (P2) Re-implement Stripe
- (P2) Pubblicazione App Store

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent (Sofia): sofia@test.com / Test1234
- Parent (Marco): marco@test.com / Test1234

## Key Files
- `frontend/app/parent/documents.tsx` - Documenti page with consent PDF opening
- `frontend/app/register.tsx` - Registration with 4 GDPR checkboxes
- `frontend/src/components/ConsentManager.tsx` - Consent keys source of truth
- `backend/server.py` - `generate_personal_consent_pdf()` + `/documents/consent-pdf/` endpoint

## Test Reports
- `/app/test_reports/iteration_61.json` - Personal documents + consent docs (100% passed)

## Critical Notes
- **Frontend Build**: `npx expo export -p web` + `serve -s dist -l 3000`
- **Consent Keys**: `privacy_viewed`, `data_processing`, `images_internal`, `images_promo`
- **User Language**: Italian
