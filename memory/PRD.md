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
- Cross-linking automatico genitori
- Lite Dashboard per Minorenni (codice+PIN)
- Profilo Societa dedicato, biglietto da visita digitale
- Affiliazioni sportive, dati bancari, card PDF
- Email invito migliorata
- Audit log + notifiche admin per cancellazione dati
- Banner SUPERAMENTO 5k/15k per dirigente e collaboratore

### Sessione 2026-03-19 (corrente)
- **Fix calcolo "Somme suppl."**: usa importo INTERO delle quietanze diverse dal compenso mensile (6 file: admin/dirigente, admin/collaboratore, admin/coach, dirigente/compensation, coach/compensation, collaboratore/compensation)
- **Fix "TOTALE RAS"**: include correttamente le somme supplementari
- **Pulsante "Passa a Modalità Dirigente"** nella pagina admin/dirigente/[id]
- **Email invito corretta**: "gratuitamente", "Scadenza certificato medico", "Versione Lite per i tuoi giovani atleti", "ricevute utili per la denuncia dei redditi"
- **Popup "Invita Persona" ridisegnato**: header blu, campi stilizzati, pulsante in tema
- **Cross-linking manuale Perla→Laura**: fix second_parent_id mancante
- **Codice Fiscale nel profilo genitore**: nuovo campo editabile
- **Tutti i PDF usano ragione_sociale**: trial doc, soglia 5k, quietanza, card fiscale/bancaria (4 punti corretti)
- **Rimosso codice fiscale genitore dal PDF prova** (potenziale errore genitore sbagliato)

#### Nuovo sistema Periodo di Prova (completo)
- **Impostazioni società**: `trial_max_days` (3-15, default 7) e `trial_max_sessions` (1-5, default 3)
- **Pagina settings admin** (`/admin/settings/trial`): stepper +/-, suggerimenti, regole automatiche
- **PDF dichiarazione prova riscritto**: template professionale con sezioni colorate, valori dinamici da settings
- **API trial-status aggiornata**: restituisce sessions_count, max_sessions, max_days, sessions_remaining, trial_warning, trial_expired
- **Contatore allenamenti**: incrementato ad ogni scansione QR durante la prova
- **Data inizio prova = prima scansione QR**: trial_start_date impostata automaticamente
- **Card stato prova genitore** (3 livelli):
  - BLU: Attivo con allenamenti/giorni rimanenti
  - ARANCIONE: Warning ultimo allenamento/ultimo giorno
  - ROSSO: Scaduto, necessario certificato medico
- **Badge QR coach**: "IN PROVA — 2/3 allenamenti — 5 giorni rimanenti" dopo scansione

## Key API Endpoints
- `GET/PATCH /api/settings/society` - Dati societa + trial settings
- `GET /api/athletes/{id}/trial-status` - Stato prova con sessioni/giorni
- `GET /api/athletes/{id}/trial-document` - PDF dichiarazione prova (dinamico)
- `POST /api/attendance/register` - Registra presenza + incrementa trial_sessions_count
- `GET /api/dirigente/{id}/compensation` - Lista compensi dirigente
- `GET /api/users/dirigenti` - Lista dirigenti

## Test Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent (Sauro): sauro@test.com / password

## Pending / Upcoming Tasks
- (P1) Firma digitale dichiarazione prova (sostituire cartaceo)
- (P1) Notifica automatica a 1 allenamento/2 giorni dalla scadenza prova
- (P1) Test ciclo completo: Minori, Squadre, Excel Templates
- (P2) Migliorare UI atleti "a contratto"
- (P2) Chiarire logica cancellazione utente/atleta
- (P3) Refactoring backend (decomposizione server.py)
- (P3) Integrazione Stripe pagamenti
- (P3) Pulizia database (migrazione ruolo "viewer" -> "dirigente")
- (P3) Pubblicazione App Store / Domain
