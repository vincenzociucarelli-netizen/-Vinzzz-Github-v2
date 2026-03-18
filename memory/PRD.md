# RegistraTEAM - Product Requirements Document

## Original Problem Statement
App di gestione societa sportiva per pubblicazione su iOS App Store e Google Play Store.

## Core Architecture
- **Frontend**: Expo/React Native (Web + Mobile)
- **Backend**: FastAPI + MongoDB
- **Email**: Brevo (Sendinblue)
- **PDF**: ReportLab

## Implemented Features (Complete)

### Sessioni precedenti
- Registrazione self-service con verifica email
- Terms of Use, Privacy Policy, GDPR con firma
- Gestione atleti minorenni con codice fiscale e secondo genitore
- Password dati separata + reset (admin e self-service)
- Pagamenti con ricevute sequenziali, Prima Nota Cassa CSV
- Certificato medico con codifica colore scadenza
- Onboarding tutorial, calcolo codice fiscale
- Visualizzazione sicura documenti PDF

### Sessione 2026-03-17
- Cross-linking automatico genitori
- Lite Dashboard per Minorenni (codice+PIN)
- Gestione Periodo di Prova 7 giorni

### Sessione 2026-03-18
- Profilo Societa dedicato (spostato da impostazioni)
- Biglietto da visita digitale (WhatsApp/Email)
- Affiliazioni sportive editabili (FIPAV, UISP, etc.)
- Dati bancari: IBAN e nome banca
- Card PDF dati fiscali condivisibile
- Card PDF dati bancari condivisibile
- Cellulare come campo principale (per WhatsApp)
- Rimosso pulsante Dirigenti dal profilo (esterni alla societa)
- Immagine sport spostata in Altre Impostazioni dopo stagione
- Certificato medico e stagione in Altre Impostazioni

## Key API Endpoints
- `GET/PATCH /api/settings/society` - Dati societa (iban, bank_name, affiliations, season_end)
- `GET /api/society/card-fiscale` - PDF card dati fiscali
- `GET /api/society/card-bancaria` - PDF card dati bancari
- `POST /api/auth/minor-login` - Login minorenne
- `GET /api/minor/dashboard` - Dashboard minorenne
- `GET /api/athletes/{id}/trial-document` - PDF dichiarazione prova

## Test Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent Sauro: sauro@test.com / Test1234
- Minor Lucia: code KWP9R9PJWJXJ / pin 1234

## Pending Issues
- **P2**: Logica cancellazione utente ambigua

## Upcoming Tasks
- **P1**: Testing guidato (Minorenni, Squadre, Template Excel)
- **P2**: UI atleti "a contratto"
- **P3**: Refactoring backend, Stripe, pulizia DB, pubblicazione App Store
