# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Comprehensive sports team management application for Italian volleyball societies.

## What's Been Implemented

### Session 2026-03-27 (Fork 4 - Current)
- **Bug Fix: Validazione telefono minori** - Corretto in `invite-register.tsx` e `backend/server.py`: il numero di telefono dell'atleta ora è opzionale per i minori nel flusso di registrazione via invito. Il campo `phone` nel modello `InviteRegisterRequest` è ora `Optional[str]`. Il label UI diventa "Telefono Atleta (opzionale)" per i minori.

### Session 2026-03-26 (Fork 3)
- **Feature: Documenti Personali Genitore con PDF** - Cartella "Documenti di [NOME]" nel profilo, cliccabili con PDF multi-pagina: Pag.1 = testo completo documento, Pag.2 = attestazione accettazione con dati società, dati genitore, accettazione digitale e metadati di firma (IP, version, hash, timestamp).
- **Feature: Endpoint PDF Consensi** - `GET /api/documents/consent-pdf/{consent_type}` genera PDF per privacy_viewed, data_processing, terms.
- **Feature: Checkbox "Informativa Privacy"** - Aggiunta alla registrazione (4 checkbox totali).
- **Feature: Campo Codice Fiscale alla registrazione** - Aggiunto nel form di registrazione tra Nome e Telefono (opzionale).
- **Feature: Banner "Completa anagrafica"** - Mostrato nella dashboard genitore se manca il Codice Fiscale.
- **Feature: Email 2° Genitore visibile nell'anagrafica figlio** - Campo visibile in lettura e modificabile in edit.
- **Bug Fix: Mapping chiavi consensi** - Frontend → Backend → DB tutte allineate.
- **Enhancement: IP e versione alla registrazione** - Backend cattura IP e document_version nei metadati dei consensi.
- **UI: Colori cartelle documenti** - Ogni cartella ha il titolo colorato (viola genitore, rosa/blu figli).
- **UI: Testo banner documenti** - Corretto "per figlio" → "per sezione".

### Previous Sessions
- GDPR consent tracking, audit trail, ConsentManager
- Multi-parent GDPR logic (blocking/signing per-athlete)
- Dynamic team creation, privacy-first avatars
- Pre-season campaigns, automated reminders
- Athlete timeline, certificate management, payment tracking
- Auto-linking 2° genitore alla registrazione (cerca athletes con second_parent_email corrispondente)

## Architecture
- Backend: FastAPI port 8001 | Frontend: Expo React Native Web (static) | DB: MongoDB | Email: Brevo

## Key DB Schema
- `users.consents`: Keys = `privacy_viewed`, `data_processing`, `images_internal`, `images_promo` (each with value, timestamp, source, ip_address, document_version, user_id)
- `users.fiscal_code`: Codice fiscale del genitore (opzionale alla registrazione)
- `athletes`: `second_parent_email`, `second_parent_id`, `parent_id`

## Key API Endpoints
- `GET /api/documents/consent-pdf/{consent_type}` - PDF multi-pagina per consensi personali
- `GET /api/documents/my-documents` - Documenti raggruppati (personali + figli)
- `POST /api/auth/register` - Con 4 consent keys + fiscal_code + IP capture + auto-link 2° genitore
- `GET /api/users/me/consents` - Dati consenso utente

## Key Flows
- **Auto-linking 2° genitore**: Alla registrazione, il sistema cerca atleti con `second_parent_email` corrispondente e imposta `second_parent_id` automaticamente.
- **PDF dinamici**: I documenti consenso vengono generati al volo con dati aggiornati dal DB (incluso codice fiscale se aggiunto successivamente).

## Pending / Backlog
- (P0) Supporto testing manuale attivo - simulazione 3 genitori + 3 figli condivisi
- (P2) Funzionalità "Collegati a un atleta esistente" (per casi particolari)
- (P1) UI atleti con contratto formale
- (P2) Refactor server.py (22000+ lines)
- (P2) Re-implement Stripe
- (P2) Pubblicazione App Store

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent (Sofia): sofia@test.com / Test1234
- Parent (Marco): marco@test.com / Test1234

## Key Files
- `frontend/app/parent/documents.tsx` - Documenti page with consent PDF
- `frontend/app/register.tsx` - Registration with 4 GDPR checkboxes + fiscal code
- `frontend/app/parent/index.tsx` - Dashboard con banner "completa anagrafica"
- `frontend/app/parent/athlete/[id].tsx` - Anagrafica atleta con Email 2° Genitore
- `frontend/src/components/ConsentManager.tsx` - Consent keys source of truth
- `backend/server.py` - `generate_personal_consent_pdf()` + all endpoints

## Test Reports
- `/app/test_reports/iteration_61.json` - Personal documents + consent docs (100% passed)

## Critical Notes
- **Frontend Build**: `npx expo export -p web` + `serve -s dist -l 3000`
- **Consent Keys**: `privacy_viewed`, `data_processing`, `images_internal`, `images_promo`
- **User Language**: Italian
- **Priority critica**: Il flusso onboarding genitori è il punto più importante dell'app. Deve essere fluido e senza intoppi.
