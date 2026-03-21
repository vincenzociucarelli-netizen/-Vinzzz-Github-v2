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
- Versione Lite Atleta: accesso adulti, codice personalizzato, login memorizzato, dashboard redesign

### Sessione Corrente (21 Mar 2026)

#### Feature 1: Fine Periodo di Prova - "Voglio restare"
- Flusso in 3 step: certificato medico -> verifica admin -> firma privacy GDPR
- Auto-attivazione quando tutti e 3 gli step sono completati
- Test: 17/17 passati (100%)

#### Feature 2: Fine Periodo di Prova - "Me ne vado" (Cancellazione dati)
- Cancellazione completa con approvazione admin
- Pre-check obblighi amministrativi (pagamenti, documenti fiscali, compensi)
- Archiviazione dati minimi per obblighi legali se presenti
- Cancellazione account genitore se nessun altro figlio e nessun obbligo
- Test: 17/18 passati (94%)

#### Feature 3: Pre-iscrizioni Stagione Successiva
- Admin crea campagna pre-iscrizione con titolo, stagione, date apertura/chiusura
- Link pubblico condivisibile (WhatsApp, social) - nessun login richiesto
- Form: Nome, Cognome, Data nascita, Telefono atleta/genitore, Gia iscritto?, Club precedente, Campionati, Ruolo, Interesse, Note
- Dashboard admin con statistiche (Interessati/Ci pensano/No, Iscritti/Nuovi)
- Esportazione CSV delle risposte
- Copia link, Apri/Chiudi campagna, Elimina
- Test: 20/20 passati (100%)

## Prossimi Task (P0)
- Verifica utente delle nuove feature

## Backlog (P1-P3)
- (P1) Cross-Linking Genitori: collegamento automatico second_parent_id
- (P2) UI atleti contrattualizzati
- (P3) Refactoring server.py in struttura modulare
- (P3) Re-implementazione Stripe per pagamenti
- (P3) Pulizia DB: migrazione ruolo "viewer" -> "dirigente"
- (P3) Supporto pubblicazione dominio / App Store

## API Pre-iscrizioni
- `POST /api/preseason/campaigns` - Crea campagna
- `GET /api/preseason/campaigns` - Lista campagne
- `PATCH /api/preseason/campaigns/{id}` - Modifica campagna
- `DELETE /api/preseason/campaigns/{id}` - Elimina campagna + risposte
- `GET /api/preseason/campaigns/{id}/responses` - Risposte con statistiche
- `GET /api/preseason/campaigns/{id}/export` - Esporta CSV
- `GET /api/preseason/public/{id}` - Info pubblica campagna (no auth)
- `POST /api/preseason/public/{id}/respond` - Risposta pubblica (no auth)
- `POST /api/preseason/campaigns/{id}/respond` - Risposta autenticata
- `GET /api/preseason/active` - Campagna attiva per banner genitore

## Schema DB Rilevante
- `preseason_campaigns`: id, society_id, title, season, description, open_date, close_date, is_active
- `preseason_responses`: id, campaign_id, first_name, last_name, birth_date, phone_athlete, phone_parent, already_member, previous_club, championships_played, role_played, interest_level, notes, source
- `athletes`: status, end_trial_requested, deletion_requested
- `archived_deletions`: dati minimi archiviati per obblighi legali
- `admin_notifications`: notifiche per fine prova, cancellazione
