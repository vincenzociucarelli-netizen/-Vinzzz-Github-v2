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

### Sessione 2026-03-18 (mattina)
- Profilo Societa dedicato (spostato da impostazioni)
- Biglietto da visita digitale (WhatsApp/Email)
- Affiliazioni sportive editabili (FIPAV, UISP, etc.)
- Dati bancari: IBAN e nome banca
- Card PDF dati fiscali/bancari condivisibili
- Cellulare come campo principale (per WhatsApp)
- Immagine sport spostata in Altre Impostazioni
- Fix login case-insensitive email

### Sessione 2026-03-18 (pomeriggio)
- Email invito migliorata con 5 benefici accattivanti
- Card "Stato" unificata con "Periodo di Prova" (una sola card)
- Badge dashboard genitore: viola (attesa), arancione (in prova), verde (attivo)
- Testo dichiarazione prova migliorato
- "Accesso Lite per [nome]" con descrizione QR/orari/gare/PIN
- Pulsante "Desidero non rimanere, cancella tutti i miei dati" nella GDPR modal
- Fix bug cancellazione: Alert.alert() non funzionava su Chrome/web
- Admin/Dirigenti: ripristinati come voce separata nel dashboard admin
- Rimosso "Il Mio Profilo" (doppio profilo) dal dashboard admin
- Account societa nascosto dalla lista dirigenti
- Audit log + notifiche admin per richieste cancellazione dati
- Ripristinati banner SUPERAMENTO 5k/15k per dirigente e collaboratore

### Sessione 2026-03-18 (sera) - QUESTA SESSIONE
- **Fix calcolo "Somme suppl."**: da hardcoded 0 a importo INTERO delle quietanze diverse dal compenso mensile (6 file aggiornati: admin/dirigente, admin/collaboratore, admin/coach, dirigente/compensation, coach/compensation, collaboratore/compensation)
- **Fix "TOTALE RAS"**: include correttamente le somme supplementari
- **Fix "Compenso base"**: mostra baseAmount separato da supplementary nel breakdown annuale
- **Pulsante "Passa a Modalità Dirigente"** nella pagina admin/dirigente/[id] (checklist e documenti compattati su una riga)
- **Rimosso pulsante duplicato** "Passa a Modalità Dirigente" dalla dashboard admin (c'era già l'icona briefcase nell'header)
- **Email invito corretta**: "sotto controllo gratuitamente:", "Scadenza certificato medico" (senza "del"), "Versione Lite per i tuoi giovani atleti" (senza "gratuita"), "Pagamenti, scadenze e ricevute utili per la denuncia dei redditi"
- **Popup "Invita Persona" ridisegnato**: header blu con icona, campi stilizzati, checkbox con highlight, pulsante blu "Invia Invito" in linea con il tema app

## Key API Endpoints
- `GET/PATCH /api/settings/society` - Dati societa
- `GET /api/society/card-fiscale` - PDF card dati fiscali
- `GET /api/society/card-bancaria` - PDF card dati bancari
- `POST /api/auth/minor-login` - Login minorenne
- `GET /api/minor/dashboard` - Dashboard minorenne
- `GET /api/athletes/{id}/trial-document` - PDF dichiarazione prova
- `POST /api/athletes/{id}/request-deletion` - Richiesta cancellazione (con audit+notifica)
- `GET /api/dirigente/{id}/compensation` - Lista compensi dirigente
- `GET /api/dirigente/{id}/threshold-status/{year}` - Stato soglie dirigente
- `GET /api/users/dirigenti` - Lista dirigenti (esclude account societa)

## Test Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent (Sauro): sauro@test.com / password
- Parent (Mara): mara2@test.com / password

## Pending / Upcoming Tasks
- (P1) Test ciclo completo: Minori, Squadre, Excel Templates
- (P2) Migliorare UI atleti "a contratto"
- (P2) Chiarire logica cancellazione utente/atleta
- (P3) Refactoring backend (decomposizione server.py)
- (P3) Integrazione Stripe pagamenti
- (P3) Pulizia database (migrazione ruolo "viewer" -> "dirigente")
- (P3) Pubblicazione App Store / Domain
