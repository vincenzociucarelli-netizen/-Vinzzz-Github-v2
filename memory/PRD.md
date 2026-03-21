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

#### Feature 1: Fine Periodo di Prova - "Voglio restare"
- Flusso in 3 step obbligatori per diventare membro effettivo:
  - Step 1: Genitore/atleta inserisce data scadenza certificato medico
  - Step 2: Admin verifica di persona il certificato e conferma
  - Step 3: Firma privacy GDPR
- Auto-attivazione: tutti e 3 gli step completati -> atleta da "trial" a "active"
- Notifica admin quando genitore richiede fine prova
- Backend: POST /api/athletes/{id}/request-end-trial, GET /api/athletes/{id}/end-trial-status
- Frontend: stepper UI + modal di scelta nella pagina dettaglio atleta genitore
- Test: 17/17 passati (100%)

#### Feature 2: Fine Periodo di Prova - "Me ne vado" (Cancellazione dati)
- Flusso completo di cancellazione con approvazione admin:
  - Genitore/atleta richiede cancellazione
  - Pre-check obblighi amministrativi (pagamenti non saldati, documenti fiscali, compensi)
  - Admin vede dettaglio obblighi e approva/rifiuta
  - Se nessun obbligo: cancellazione completa (atleta, presenze, documenti, certificati, pagamenti)
  - Se obblighi: archiviazione dati minimi per legge in `archived_deletions`, cancellazione del resto
  - Account genitore cancellato SOLO se nessun altro figlio e nessun obbligo fiscale
- Backend: GET /api/athletes/{id}/deletion-check, POST request-deletion, approve-deletion, reject-deletion
- Frontend: modal conferma con dettaglio dati e obblighi, banner "cancellazione in attesa"
- Admin: pre-check obblighi prima di approvare
- Test: 17/18 passati (94% - 1 errore token test fixture)

## Task In Corso
Nessuno

## Prossimi Task (P0)
- Verifica utente delle nuove UI (stepper fine prova + cancellazione)

## Backlog (P1-P3)
- (P1) Cross-Linking Genitori: collegamento automatico second_parent_id
- (P2) UI atleti contrattualizzati
- (P2) Logica cancellazione utenti (chiarimenti)
- (P3) Refactoring server.py in struttura modulare
- (P3) Re-implementazione Stripe per pagamenti
- (P3) Pulizia DB: migrazione ruolo "viewer" -> "dirigente"
- (P3) Supporto pubblicazione dominio / App Store

## API Chiave
- `POST /api/athletes/{id}/request-end-trial` - Richiesta fine periodo di prova
- `GET /api/athletes/{id}/end-trial-status` - Stato 3 step per fine prova
- `GET /api/athletes/{id}/deletion-check` - Pre-check obblighi prima cancellazione
- `POST /api/athletes/{id}/request-deletion` - Richiesta cancellazione dati
- `POST /api/athletes/{id}/approve-deletion` - Admin approva cancellazione
- `POST /api/athletes/{id}/reject-deletion` - Admin rifiuta cancellazione
- `GET /api/athletes/deletion-requests` - Lista richieste cancellazione (admin)

## Schema DB Rilevante
- `athletes`: status, end_trial_requested, deletion_requested, medical_certificate_expiry/verified, privacy_accepted
- `signed_documents`: document_type, signer_id, related_entity_id, pdf_base64
- `archived_deletions`: dati minimi archiviati per obblighi legali dopo cancellazione
- `admin_notifications`: tipi end_trial_request, deletion_requested, deletion_approved
- `settings` (type: "society"): dati societa, logo, affiliazioni
