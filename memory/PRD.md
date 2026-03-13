# PRD - Pallavolo Perugia SSD - Sistema Gestionale

## Original Problem Statement
Sistema gestionale per società sportiva (ASD/SSD) con gestione ruoli multipli, compensi sportivi, firma digitale, privacy GDPR, profili utente.

## What's Been Implemented

### Session 13 March 2026
- **Fix Terms of Service Bug**: Schermata T&C admin non appare più due volte
- **Self-Registration Atleti via Email**: Invito admin + auto-registrazione con verifica email
- **Badge Store nelle Email**: Icone App Store/Play Store/link web configurabili via .env
- **Schermata Legale Apple (NUOVA)**: Schermata "Benvenuto in RegistraTEAM" mostrata a TUTTI gli utenti al primo accesso con:
  - Descrizione app, link Termini di utilizzo e Privacy Policy
  - Nota GDPR, checkbox obbligatoria, pulsante CONTINUA
  - Integrata in tutti i 6 layout ruoli (admin, athlete, coach, collaboratore, dirigente, parent)
  - Backend: `POST /api/auth/accept-legal` + campo `legal_accepted_at` in users
  - Per admin: ordine Legal → Termini società → Dashboard

### Previous Sessions
- Flusso Atleta Minorenne, Fix PDF Privacy, Certificato Medico Dirigente
- Notifiche Admin, Termini di Utilizzo, Compensi, QR Code, Export/Import

## Architecture
```
/app
├── backend/server.py, email_service.py
└── frontend/
    ├── app/{admin,athlete,coach,collaboratore,dirigente,parent}/_layout.tsx
    ├── app/invite-register.tsx, verify-email.tsx, register.tsx
    └── src/
        ├── components/LegalAcceptanceScreen.tsx  # NEW
        └── hooks/useLegalCheck.ts                # NEW
```

## P0 - Completato
- [x] Schermata legale Apple per tutti gli utenti
- [x] Self-Registration con verifica email
- [x] Badge store nelle email

## P1 - Media Priorità
- [ ] Checkbox "Responsabile del trattamento" in form admin
- [ ] Aggiornare link Termini e Privacy con URL reali (attualmente placeholder iubenda)
- [ ] Test flusso completo minorenne con genitore

## P2 - Bassa Priorità
- [ ] Verifica flusso cancellazione utente
- [ ] UI compensi atleta a contratto

## Future/Backlog
- Registrazione dominio + pubblicazione store
- Refactoring server.py
- Re-implementazione Stripe

## Config (.env backend)
- APP_STORE_URL, PLAY_STORE_URL, WEB_APP_URL → Link store e portale web
- FRONTEND_URL → URL frontend per link nelle email

## Credentials
- Admin: pallavoloperugia@gmail.com / password
- Society Invite Code: BUZHB0WT
