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

### Session 13 March 2026 (Continued)
- **Self-Registration Atleti con Verifica Email**: Implementato flusso completo:
  - L'atleta si registra con codice invito della società → account in status `pending_email`
  - Il sistema invia automaticamente un'email di verifica (via Brevo) con link di attivazione
  - Login bloccato finché email non verificata (messaggio chiaro in italiano)
  - Click link verifica → account attivato in status `approved`, atleta in `trial` (7 giorni)
  - Admin riceve notifica automatica della nuova auto-registrazione
  - Pagina frontend `/verify-email?token=xxx` per conferma visuale
  - Protezione anti-registrazioni fasulle: senza verifica email l'account non si attiva

### Session 13 March 2026
- **Fix Terms of Service Bug**: Corretto bug dove la schermata T&C appariva due volte
- **Invito Atleta via Email (Admin)**: Admin può invitare atleti via email con link personalizzato
  - 5 endpoint backend, modal frontend, pagina pubblica registrazione
  - Supporto adulti e minorenni, email Brevo, scadenza 7 giorni

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
    │   ├── coach/            # Profilo e compensi coach
    │   ├── collaboratore/    # Profilo e compensi collaboratore
    │   ├── dirigente/        # Profilo e compensi dirigente
    │   ├── parent/           # Vista genitore
    │   ├── invite-register.tsx   # Registrazione via invito admin
    │   ├── verify-email.tsx      # Pagina verifica email (pubblica)
    │   └── register.tsx          # Auto-registrazione con codice invito
    └── src/
        ├── components/       # Componenti riutilizzabili
        ├── store/            # Zustand store (authStore)
        └── services/         # API services
```

## P0 - Completato
- [x] Tutte le feature P0 precedenti
- [x] Termini di Utilizzo (fix bug doppia apparizione)
- [x] Self-Registration Atleti via Email (invito admin + auto-registrazione con verifica email)

## P1 - Media Priorità
- [ ] Checkbox designazione admin come "Responsabile del trattamento"
- [ ] Test flusso atleta minorenne da parte dell'utente
- [ ] Test scansione QR, upload pagamenti/partite, import calendario

## P2 - Bassa Priorità
- [ ] Verifica flusso cancellazione utente
- [ ] UI compensi per atleta a contratto
- [ ] Separazione ruoli Admin/Dirigente

## Future/Backlog
- Refactoring server.py in struttura modulare
- Re-implementazione Stripe
- Pulizia confusione ruoli DB (viewer → dirigente)

## Technical Notes
- **Role Discrepancy**: "Dirigente" in UI = "viewer" in backend
- **Timezone Bug Pattern**: Usare `setHours(12,0,0,0)` prima di `toISOString()`
- **Email Service**: Brevo (primario) con fallback SendGrid
- **Email Verification Flow**: register → pending_email → verify-email → approved/trial
- **Athlete Invitation Flow**: Token univoco admin con scadenza 7 giorni

## Credentials
- Admin: pallavoloperugia@gmail.com / password
- Society Invite Code: BUZHB0WT
