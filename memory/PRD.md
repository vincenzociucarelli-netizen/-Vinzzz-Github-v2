# PRD - Pallavolo Perugia SSD - Sistema Gestionale

## Original Problem Statement
Sistema gestionale per società sportiva che include:
- Gestione ruoli multipli (Admin, Coach, Collaboratore, Dirigente, Atleta)
- Gestione compensi sportivi con soglie fiscali 5k/15k EUR
- Firma digitale quietanze mensili
- Gestione privacy GDPR
- Profili utente con dati anagrafici, fiscali e bancari

## Core Requirements
1. Profili Utente Standardizzati con UI coerente
2. Sezioni Collassabili: Dati Anagrafici, Fiscali e Bancari
3. Compensi Sportivi con soglie 5k/15k EUR
4. Firma Digitale quietanze mensili
5. Privacy GDPR obbligatoria per adulti

## What's Been Implemented

### Session 13 March 2026
- Fix Terms of Service Bug (doppia apparizione)
- Self-Registration Atleti via Email (invito admin + auto-registrazione con verifica email)
- Badge App Store / Play Store / link web nelle email
  - Configurabili via .env: APP_STORE_URL, PLAY_STORE_URL, WEB_APP_URL

### Previous Sessions
- Flusso Atleta Minorenne Completo
- Fix PDF Privacy, Certificato Medico Dirigente
- Notifica Admin per Certificati, Termini di Utilizzo
- Standardizzazione pagine compensi
- Codice Atleta Permanente, Certificati Medici V2, Pagamenti Atleta V2
- QR Code, Export Excel, Import calendario

## Architecture
```
/app
├── backend/
│   ├── server.py             # FastAPI backend con MongoDB
│   ├── email_service.py      # Servizio email Brevo/SendGrid
│   └── tests/                # Test pytest
└── frontend/
    ├── app/
    │   ├── admin/            # Dashboard e gestione utenti admin
    │   ├── athlete/          # Profilo e compensi atleta
    │   ├── invite-register.tsx   # Registrazione via invito admin
    │   ├── verify-email.tsx      # Pagina verifica email
    │   └── register.tsx          # Auto-registrazione con codice invito
    └── src/
```

## P0 - Completato
- [x] Termini di Utilizzo (fix bug)
- [x] Self-Registration Atleti via Email
- [x] Badge store nelle email

## P1 - Media Priorità
- [ ] Checkbox designazione admin come "Responsabile del trattamento"
- [ ] Registrare dominio e aggiornare WEB_APP_URL
- [ ] Pubblicare app su store e aggiornare link
- [ ] Test flusso atleta minorenne

## P2 - Bassa Priorità
- [ ] Verifica flusso cancellazione utente
- [ ] UI compensi atleta a contratto

## Future/Backlog
- Refactoring server.py in struttura modulare
- Re-implementazione Stripe
- Pulizia ruoli DB (viewer -> dirigente)

## Technical Notes
- Role Discrepancy: "Dirigente" UI = "viewer" backend
- Timezone Bug: setHours(12,0,0,0) prima di toISOString()
- Email Service: Brevo primario, SendGrid fallback
- Email Verification: register -> pending_email -> verify -> approved/trial
- Store links configurabili via .env

## Credentials
- Admin: pallavoloperugia@gmail.com / password
- Society Invite Code: BUZHB0WT
