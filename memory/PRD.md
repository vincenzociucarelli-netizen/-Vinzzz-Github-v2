# PRD - Sport Society Management App

## Problema Originale
Applicazione full-stack per la gestione di società sportive. Include gestione atleti, squadre, presenze, documenti legali (firma digitale periodo di prova), profilo società con biglietto da visita, e ruoli multipli (admin, coach, genitore, dirigente).

## Architettura
- **Frontend**: React Native/Expo (web) con TypeScript
- **Backend**: FastAPI (Python) con MongoDB
- **File principali**: `backend/server.py`, `frontend/app/admin/`, `frontend/app/coach/`, `frontend/app/parent/`

## Funzionalità Completate

### Sessioni Precedenti
- Sistema completo di firma digitale per documenti di prova
- Flusso firma → PDF con metadati legali → email al genitore → archivio documenti
- Fix crash vista coach presenze (datetime timezone-aware)
- Visibilità atleti seconda squadra e atleti in prova per coach
- Fix display stato "In prova" vs "In attesa" per admin
- Fix download documenti su mobile
- UI migliorata per admin e genitori (box periodo di prova, menu riordinato)

### Sessione Corrente (21 Mar 2026)
- **Biglietto da Visita Fiscale (JPG)**: Redesign completo
  - Dimensioni compatte (~8.5x2.3 cm), crop dinamico al contenuto
  - Nome società da campo `name` in grassetto (font 26pt, auto-sizing)
  - Solo ruolo utente sotto il nome (no duplicazione nome se uguale a società)
  - Sport rimosso, affiliazioni (FIPAV/CSI) su una riga
  - Headers anti-cache + timestamp frontend per evitare cache browser
  
- **Vista Coach - Elenco Atleti**: 
  - Aggiunto badge "In prova" (viola) nell'elenco atleti (come nel registro presenze)
  - Nascosto info certificato medico per atleti in prova
  - Ordinamento: atleti in prova PRIMA, poi alfabetico (entrambe le liste)
  - Fix scroll: sostituito FlatList con .map() per eliminare conflitto scroll con ScrollView

- **Vista Coach - Registro Presenze**:
  - Ordinamento: trial prima, poi alfabetico (backend + frontend)

## Task In Corso
Nessuno

## Prossimi Task (P0)
- **Versione Lite Atleta**: Card/badge semplificata per uso quotidiano degli atleti
  - Da implementare sia per atleti minorenni che maggiorenni
  - Toggle on/off per atleti maggiorenni
  - Pratica e sicura per uso di tutti i giorni

## Backlog (P1-P3)
- (P1) **Cross-Linking Genitori**: Collegamento automatico `second_parent_id` quando email secondo genitore corrisponde a utente esistente
- (P2) Miglioramenti UI per atleti contrattualizzati
- (P2) Chiarire e implementare logica cancellazione utenti
- (P3) Refactoring `server.py` in struttura modulare
- (P3) Re-implementazione Stripe per pagamenti
- (P3) Pulizia DB: migrazione ruolo "viewer" → "dirigente"
- (P3) Supporto pubblicazione dominio / App Store

## API Chiave
- `GET /api/society/card-fiscale` - Genera JPG biglietto da visita (con anti-cache)
- `GET /api/society/card-bancaria` - Genera JPG dati bancari
- `POST /api/athletes/{id}/sign-trial-document` - Firma digitale documento prova
- `GET /api/coach/team/{team_id}/athletes` - Lista atleti squadra (con status trial)
- `GET /api/teams/{team_id}/attendance-stats` - Statistiche presenze (ordinate: trial prima)

## Schema DB Rilevante
- `athletes`: include `status` (active/trial), `trial_start_date`, `trial_document_signed_date`, `team_id`, `team_id_2`
- `signed_documents`: `document_type`, `signer_id`, `minor_id`, `pdf_blob`
- `settings` (type: "society"): dati società, logo, affiliazioni
