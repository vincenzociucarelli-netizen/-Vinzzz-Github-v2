# PRD - Pallavolo Perugia SSD - Sistema Gestionale

## Original Problem Statement
Sistema gestionale per società sportiva che include:
- Gestione ruoli multipli (Admin, Coach, Collaboratore, Dirigente, Atleta)
- Gestione compensi sportivi con soglie fiscali €5k/€15k
- Firma digitale quietanze mensili
- Gestione privacy GDPR
- Profili utente con dati anagrafici, fiscali e bancari

## Core Requirements
1. **Profili Utente Standardizzati**: Tutti i ruoli devono avere UI coerente
2. **Sezioni Collassabili**: Dati Anagrafici, Fiscali e Bancari collassabili per usabilità
3. **Compensi Sportivi**: Gestione con soglie €5k/€15k e relative dichiarazioni
4. **Firma Digitale**: Quietanze mensili firmabili digitalmente
5. **Privacy GDPR**: Consenso privacy obbligatorio per tutti gli utenti adulti

## User Personas
- **Admin**: Gestisce tutti gli utenti, compensi, documenti
- **Coach**: Allenatori con compensi sportivi
- **Collaboratore**: Staff tecnico con compensi
- **Dirigente**: Staff dirigenziale con compensi
- **Atleta**: Atleti maggiorenni e minorenni
- **Genitore**: Genitori di atleti minorenni

## What's Been Implemented

### Session 13 March 2026
- **Fix Terms of Service Bug**: Corretto bug dove la schermata T&C appariva due volte. Il componente ora è renderizzato inline nel layout admin, evitando loop di redirect. Rimosso file `terms-acceptance.tsx` non più necessario.
- **Self-Registration Atleti via Email**: Implementato flusso completo:
  - Backend: `POST /api/athletes/invite` (admin invia invito), `GET /api/athletes/invite-info/{token}` (info pubbliche invito), `POST /api/athletes/invite-register` (registrazione pubblica via token)
  - Backend: `GET /api/athletes/invitations` (lista inviti), `DELETE /api/athletes/invitations/{id}` (annulla invito)
  - Frontend Admin: Pulsante verde "Invita via Email" nella lista atleti con modal (email, nome, cognome, minorenne toggle, squadra)
  - Frontend: Pagina pubblica `/invite-register?token=xxx` con form pre-compilato dai dati dell'invito
  - Email con template HTML professionale inviata via Brevo
  - Supporto adulti (crea user athlete + athlete record) e minorenni (crea parent user + minor athlete)
  - Notifica admin alla registrazione
  - Inviti con scadenza 7 giorni e protezione da riuso
  - Bug fix: `create_token()` missing `role` argument (trovato e corretto da testing agent)

### Session 12 March 2026
- **Flusso Atleta Minorenne Completo**: Creazione da admin con link genitore, vista read-only, sgancio genitori
- **Fix PDF Privacy**: Allineato testo PDF backend con anteprima frontend
- **Certificato Medico Dirigente**: Gestione certificati medici da parte del dirigente
- **Fix Timezone Certificati**: Date a ore 12:00 per evitare shift UTC
- **Notifica Admin per Certificati**: Notifiche quando non-admin aggiorna certificato
- **Termini di Utilizzo**: Schermata obbligatoria T&C per admin al primo accesso

### Previous Sessions
- Standardizzazione pagine compensi (Coach, Collaboratore, Dirigente)
- Codice Atleta Permanente, Certificati Medici V2
- Pagamenti Atleta V2 con rate dinamiche
- QR Code scansione presenze
- Export Excel, Import calendario federazioni
- Multiple UI/UX improvements

## Architecture
```
/app
├── backend/
│   ├── server.py             # FastAPI backend con MongoDB
│   └── email_service.py      # Servizio email Brevo/SendGrid
└── frontend/
    ├── app/
    │   ├── admin/            # Dashboard e gestione utenti admin
    │   ├── athlete/          # Profilo e compensi atleta
    │   ├── coach/            # Profilo e compensi coach
    │   ├── collaboratore/    # Profilo e compensi collaboratore
    │   ├── dirigente/        # Profilo e compensi dirigente
    │   ├── parent/           # Vista genitore
    │   ├── invite-register.tsx # Pagina pubblica registrazione via invito
    │   └── register.tsx      # Registrazione con codice invito
    └── src/
        ├── components/       # Componenti riutilizzabili
        ├── store/            # Zustand store (authStore)
        └── services/         # API services
```

## P0 - Completato
- [x] Tutte le feature P0 precedenti
- [x] Termini di Utilizzo (fix bug doppia apparizione)
- [x] Self-Registration Atleti via Email

## P1 - Media Priorità
- [ ] Checkbox designazione admin come "Responsabile del trattamento" nel form creazione admin
- [ ] Test flusso completo pagamenti per atleta adulto (18+)
- [ ] Test flusso firma privacy con account preparati
- [ ] Test scansione QR code, upload pagamenti/partite, import automatico partite

## P2 - Bassa Priorità
- [ ] Verifica flusso cancellazione utente (record `users` rimane dopo delete atleta)
- [ ] UI compensi per atleta a contratto
- [ ] Separazione ruoli Admin/Dirigente
- [ ] Admin dashboard - problema caricamento intermittente

## Future/Backlog
- Funzionalità compensi per Atleta a contratto (giugno/luglio 2026)
- Refactoring server.py in struttura modulare
- Re-implementazione Stripe
- Pulizia confusione ruoli DB (viewer → dirigente)

## Technical Notes
- **Role Discrepancy**: "Dirigente" in UI = "viewer" in backend. Causa frequenti bug di permessi
- **Timezone Bug Pattern**: Usare `setHours(12,0,0,0)` prima di `toISOString()` per evitare off-by-one
- **Email Service**: Brevo (primario) con fallback SendGrid
- **Athlete Invitation Flow**: Token univoco con scadenza 7 giorni, protezione da riuso

## Credentials
- Admin: pallavoloperugia@gmail.com / password
