# RegistraTEAM - Product Requirements Document

## Original Problem Statement
App di gestione societa sportiva per pubblicazione su iOS App Store e Google Play Store. Include gestione atleti, genitori, coach, pagamenti, certificati medici, privacy GDPR, e comunicazioni.

## Core Architecture
- **Frontend**: Expo/React Native (Web + Mobile)
- **Backend**: FastAPI + MongoDB
- **Email**: Brevo (Sendinblue)
- **PDF**: ReportLab
- **Fiscal Code**: python-codicefiscale

## User Roles
- **Admin**: Gestione completa societa (= la societa stessa, non una persona)
- **Coach**: Gestione allenamenti e presenze
- **Parent**: Gestione figli minorenni
- **Athlete**: Atleta adulto
- **Minor**: Dashboard read-only per minorenni (codice+PIN)
- **Dirigente/Viewer**: Visualizzazione dati

## Implemented Features (Complete)

### Sessione precedente
- Registrazione self-service atleti/genitori con verifica email
- Accettazione Terms of Use e Privacy Policy
- Gestione atleti minorenni con codice fiscale e secondo genitore
- Password dati separata per genitori (accesso dati sensibili)
- Reset password login e dati (admin + self-service)
- Flusso privacy GDPR con firma per minorenni
- Sistema pagamenti con ricevute sequenziali per stagione
- Esportazione Prima Nota Cassa CSV
- Configurazione date stagione
- Onboarding tutorial per ruoli
- Calcolo codice fiscale (incluso nati all'estero)
- Visualizzazione sicura documenti PDF (fetch+Blob)
- Certificato medico con codifica colore scadenza

### Sessione 2026-03-17
- **Cross-linking automatico genitori**: Quando un atleta viene creato con second_parent_email, il sistema trova automaticamente l'utente e popola second_parent_id
- **Lite Dashboard per Minorenni**: Login tramite codice atleta + PIN, dashboard read-only con QR, orari, presenze, partite
- **Gestione Periodo di Prova 7 giorni**: PDF dichiarazione, inizio automatico da prima presenza QR, bypass certificato medico

### Sessione 2026-03-18
- **Profilo Societa dedicato**: Nuova pagina /admin/society-profile con tutti i dati societa (anagrafici, fiscali, contatti, sede, logo, timbro)
- **Biglietto da visita digitale**: Condivisione via WhatsApp e Email con tutti i dati societa
- **Riorganizzazione Impostazioni**: Dati societa spostati nel profilo, impostazioni tecniche (certificato, stagione) in "Altre Impostazioni"
- **Pulsante Dirigenti**: Accessibile dal profilo societa

## Key Pages/Routes
- `/login` - Login con due tab (Standard + Atleta)
- `/admin` - Dashboard admin
- `/admin/society-profile` - Profilo societa (NEW)
- `/admin/settings/other` - Impostazioni tecniche (cert blocking, stagione, ruoli, etc.)
- `/admin/dirigenti` - Gestione dirigenti
- `/minor` - Dashboard minorenne (NEW)
- `/parent/athlete/[id]` - Vista genitore con periodo prova e accesso minorenne

## Key API Endpoints
- `POST /api/auth/minor-login` - Login minorenne (codice+PIN)
- `GET /api/minor/dashboard` - Dashboard minorenne
- `POST /api/athletes/{id}/set-minor-pin` - Imposta PIN
- `POST /api/athletes/{id}/toggle-minor-access` - Attiva/disattiva accesso
- `GET /api/athletes/{id}/trial-status` - Stato periodo prova
- `GET /api/athletes/{id}/trial-document` - PDF dichiarazione prova
- `POST /api/athletes/{id}/start-trial` - Attiva periodo prova
- `GET /api/settings/society` - Dati societa (usato da profilo E impostazioni)
- `PATCH /api/settings/society` - Aggiorna dati societa

## Test Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent Sauro: sauro@test.com / Test1234
- Parent Mara: mara2@test.com / password
- Athlete Luna: luna@18piu.com / Test1234
- Minor Lucia: code KWP9R9PJWJXJ / pin 1234

## Pending Issues
- **P2**: Logica cancellazione utente ambigua

## Upcoming Tasks
- **P1**: Testing guidato dall'utente
- **P2**: UI atleti "a contratto"
- **P3**: Refactoring backend (decomporre server.py)
- **P3**: Integrazione Stripe pagamenti
- **P3**: Pulizia database (viewer -> dirigente)
- **P3**: Dominio e pubblicazione App Store

## DB Schema (Key Fields - Athletes)
- `is_trial`: Boolean - Atleta in periodo di prova
- `trial_start_date`: String/null - Data inizio prova
- `trial_end_date`: String/null - Data fine prova
- `minor_pin_hash`: String - PIN per accesso minorenne
- `minor_access_enabled`: Boolean - Accesso minorenne attivo
- `second_parent_id`: String - ID secondo genitore (auto-popolato)
