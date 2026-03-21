# PRD - Sport Society Management App

## Problema Originale
Applicazione full-stack per la gestione di societa sportive. Include gestione atleti, squadre, presenze, documenti legali (firma digitale periodo di prova), profilo societa con biglietto da visita, e ruoli multipli (admin, coach, genitore, dirigente).

## Architettura
- **Frontend**: React Native/Expo (web) con TypeScript
- **Backend**: FastAPI (Python) con MongoDB
- **File principali**: `backend/server.py`, `frontend/app/admin/`, `frontend/app/coach/`, `frontend/app/parent/`

## Funzionalita Completate

### Sessioni Precedenti
- Sistema completo di firma digitale per documenti di prova
- Flusso firma -> PDF con metadati legali -> email al genitore -> archivio documenti
- Fix crash vista coach presenze (datetime timezone-aware)
- Visibilita atleti seconda squadra e atleti in prova per coach
- Fix display stato "In prova" vs "In attesa" per admin
- Fix download documenti su mobile
- UI migliorata per admin e genitori (box periodo di prova, menu riordinato)
- Biglietto da Visita Fiscale (JPG): Redesign completo
- Vista Coach - Elenco Atleti: badge "In prova", ordinamento, fix scroll
- Vista Coach - Registro Presenze: ordinamento trial prima
- Versione Lite Atleta: accesso adulti, codice personalizzato, login memorizzato, dashboard redesign

### Sessione Corrente (21 Mar 2026)
- **Fine Periodo di Prova ("Voglio restare")**:
  - Nuovo flusso in 3 step per terminare il periodo di prova e diventare membro effettivo
  - Step 1: Genitore/atleta inserisce data scadenza certificato medico
  - Step 2: Admin verifica di persona il certificato e conferma
  - Step 3: Genitore/atleta firma il documento privacy GDPR
  - Auto-attivazione: quando tutti e 3 gli step sono completati, l'atleta passa da "trial" a "active"
  - Notifica admin quando un genitore richiede la fine del periodo di prova
  - Backend: nuovi endpoint POST /api/athletes/{id}/request-end-trial, GET /api/athletes/{id}/end-trial-status
  - Frontend: stepper UI nella pagina dettaglio atleta del genitore con stato di avanzamento
  - Modal di scelta con spiegazione dei 3 passaggi
  - Test backend: 17/17 passati (100%)

## Task In Corso
Nessuno

## Prossimi Task (P0)
- **Verifica utente**: L'utente deve verificare la UI dello stepper e il flusso completo dalla vista genitore

## Backlog (P1-P3)
- (P1) **Cross-Linking Genitori**: Collegamento automatico `second_parent_id` quando email secondo genitore corrisponde a utente esistente
- (P2) **Opzione "Me ne vado"**: Implementare la cancellazione dati quando l'atleta decide di andarsene (deprioritizzata - utente deve informarsi)
- (P2) Miglioramenti UI per atleti contrattualizzati
- (P2) Chiarire e implementare logica cancellazione utenti
- (P3) Refactoring `server.py` in struttura modulare
- (P3) Re-implementazione Stripe per pagamenti
- (P3) Pulizia DB: migrazione ruolo "viewer" -> "dirigente"
- (P3) Supporto pubblicazione dominio / App Store

## API Chiave
- `POST /api/athletes/{id}/request-end-trial` - Richiesta fine periodo di prova
- `GET /api/athletes/{id}/end-trial-status` - Stato dei 3 step per fine prova
- `POST /api/society/card-fiscale` - Genera JPG biglietto da visita
- `GET /api/society/card-bancaria` - Genera JPG dati bancari
- `POST /api/athletes/{id}/sign-trial-document` - Firma digitale documento prova
- `GET /api/coach/team/{team_id}/athletes` - Lista atleti squadra (con status trial)
- `GET /api/teams/{team_id}/attendance-stats` - Statistiche presenze
- `POST /api/athletes/{id}/set-custom-code` - Imposta codice personalizzato per Accesso Lite

## Schema DB Rilevante
- `athletes`: include `status` (active/trial), `end_trial_requested`, `end_trial_requested_date`, `medical_certificate_expiry`, `medical_certificate_verified`, `privacy_accepted`, `athlete_code`, `qr_identifier`
- `signed_documents`: `document_type`, `signer_id`, `minor_id`, `pdf_blob`
- `settings` (type: "society"): dati societa, logo, affiliazioni
- `admin_notifications`: include tipo `end_trial_request` per richieste fine prova
