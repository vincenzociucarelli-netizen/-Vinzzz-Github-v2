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
- **Admin**: Gestione completa societa
- **Coach**: Gestione allenamenti e presenze
- **Parent**: Gestione figli minorenni
- **Athlete**: Atleta adulto
- **Minor**: Dashboard read-only per minorenni (codice+PIN)
- **Dirigente/Viewer**: Visualizzazione dati

## Implemented Features (Complete)
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
- Cross-linking automatico genitori (P0 - Completato 2026-03-17)
- Lite Dashboard per Minorenni (P0 - Completato 2026-03-17)
- Gestione Periodo di Prova 7 giorni (Completato 2026-03-17)

## Latest Features (2026-03-17)

### Cross-linking Automatico Genitori
- Quando un atleta viene creato con `second_parent_email`, il sistema cerca automaticamente l'utente e popola `second_parent_id`
- Funziona sia nella creazione che nell'aggiornamento e riattivazione atleta
- Alla registrazione di un nuovo genitore, verifica se ci sono atleti con la sua email come secondo genitore

### Lite Dashboard per Minorenni
- Login tramite codice atleta + PIN (4-6 cifre)
- Dashboard read-only: QR code, orari, presenze, partite, stato prova
- Nessun dato sensibile esposto
- Genitore gestisce PIN e attivazione/disattivazione accesso
- Sezione "Accesso Atleta dal Telefono" nella vista genitore

### Gestione Periodo di Prova
- Attivazione prova da parte del genitore
- Data inizio NON inserita manualmente - coincide con prima presenza (QR scan)
- 7 giorni di prova dalla prima presenza
- Certificato medico NON richiesto durante la prova
- Generazione PDF "Dichiarazione Periodo di Prova" con reportlab
- Stato prova visibile nella dashboard minorenne e vista genitore
- 3 stati: in attesa primo allenamento, prova attiva, prova terminata

## Pending Issues
- **P2**: Logica cancellazione utente ambigua (cosa succede quando un atleta viene cancellato?)

## Upcoming Tasks
- **P1**: Testing guidato dall'utente (ciclo completo Minorenni, Squadre, Template Excel)
- **P2**: Migliorare UI per atleti "a contratto"
- **P3**: Refactoring backend (decomporre server.py)
- **P3**: Integrazione Stripe per pagamenti
- **P3**: Pulizia database (migrare ruolo "viewer" a "dirigente")
- **P3**: Dominio e pubblicazione App Store

## Key API Endpoints (New)
- `POST /api/auth/minor-login` - Login minorenne (codice+PIN)
- `GET /api/minor/dashboard` - Dashboard minorenne
- `POST /api/athletes/{id}/set-minor-pin` - Imposta PIN
- `POST /api/athletes/{id}/toggle-minor-access` - Attiva/disattiva accesso
- `GET /api/athletes/{id}/minor-access-status` - Stato accesso
- `POST /api/athletes/{id}/start-trial` - Attiva periodo prova
- `GET /api/athletes/{id}/trial-status` - Stato prova
- `GET /api/athletes/{id}/trial-document` - PDF dichiarazione prova

## Test Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent Sauro: sauro@test.com / Test1234
- Parent Mara: mara2@test.com / password
- Athlete Luna: luna@18piu.com / Test1234
- Minor Lucia: code KWP9R9PJWJXJ / pin 1234

## Key DB Schema (Athletes)
- `is_trial`: Boolean - Atleta in periodo di prova
- `trial_start_date`: String/null - Data inizio prova (dalla prima presenza)
- `trial_end_date`: String/null - Data fine prova (7 giorni dopo)
- `trial_document_generated`: Boolean - Documento PDF generato
- `minor_pin_hash`: String - PIN hashato per accesso minorenne
- `minor_access_enabled`: Boolean - Accesso minorenne attivo
- `second_parent_id`: String - ID secondo genitore (auto-popolato)
- `second_parent_email`: String - Email secondo genitore
