# PRD - Sport Society Management App

## Problema Originale
Applicazione full-stack per la gestione di societa sportive. Include gestione atleti, squadre, presenze, documenti legali, profilo societa, e ruoli multipli (admin, coach, genitore, dirigente).

## Architettura
- **Frontend**: React Native/Expo (web) con TypeScript
- **Backend**: FastAPI (Python) con MongoDB

## Funzionalita Completate

### Sessioni Precedenti
- Firma digitale documenti di prova, PDF, email
- Fix coach presenze, visibilita atleti, stati "In prova"/"In attesa"
- Download documenti mobile, UI admin/genitori
- Biglietto da Visita Fiscale JPG
- Vista Coach: badge "In prova", ordinamento, fix scroll
- Versione Lite Atleta: accesso adulti, codice personalizzato, login memorizzato, dashboard redesign

### Sessione Corrente (21 Mar 2026)

#### Feature 1: Fine Periodo di Prova - "Voglio restare"
- Stepper 3 step: certificato medico -> verifica admin -> firma privacy -> auto-attivazione
- Test: 17/17 (100%)

#### Feature 2: Fine Periodo di Prova - "Me ne vado" (Cancellazione)
- Cancellazione completa con approvazione admin, pre-check obblighi fiscali, archiviazione legale
- Cancellazione account genitore condizionale
- Test: 17/18 (94%)

#### Feature 3: Pre-iscrizioni Stagione Successiva
- Admin crea campagna con date personalizzabili
- Link pubblico condivisibile (WhatsApp, social) — nessun login richiesto
- Form: Nome, Cognome, Nascita, Telefoni, Gia iscritto?, Club precedente, Campionati, Ruolo, Interesse, Note
- Dashboard admin con statistiche + export CSV
- Test: 20/20 (100%)

#### Feature 4: Sistema Notifiche Pre-iscrizioni
- Email automatiche ai genitori che non hanno ancora risposto (Brevo)
- Notifiche in-app per genitori
- Admin controlla invio: bottone "Notifica" nella gestione campagna
- Esclude automaticamente chi ha gia risposto
- Contatore notifiche inviate sulla campagna
- Test: endpoint testato con successo (18 email inviate, 0 errori)

## Frontend Pages
- `/preseason/{id}` — Form pubblico (no auth)
- `/admin/preseason` — Gestione campagne admin
- Menu admin: bottone "Pre-iscrizioni" nell'area admin

## API Pre-iscrizioni
- `POST /api/preseason/campaigns` — Crea campagna
- `GET /api/preseason/campaigns` — Lista campagne
- `PATCH /api/preseason/campaigns/{id}` — Modifica
- `DELETE /api/preseason/campaigns/{id}` — Elimina + risposte
- `GET /api/preseason/campaigns/{id}/responses` — Risposte + stats
- `GET /api/preseason/campaigns/{id}/export` — CSV
- `POST /api/preseason/campaigns/{id}/send-notifications` — Email + notifiche in-app
- `GET /api/preseason/public/{id}` — Info pubblica (no auth)
- `POST /api/preseason/public/{id}/respond` — Risposta pubblica (no auth)
- `POST /api/preseason/campaigns/{id}/respond` — Risposta autenticata
- `GET /api/preseason/active` — Campagna attiva per banner

## Backlog
- (P1) Cross-Linking Genitori automatico
- (P2) UI atleti contrattualizzati
- (P3) Refactoring server.py
- (P3) Stripe pagamenti
- (P3) Pulizia DB "viewer" -> "dirigente"
- (P3) Pubblicazione dominio / App Store
