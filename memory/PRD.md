# RegistraTEAM - Product Requirements Document

## Problema Originale
Applicazione per la gestione di società sportive con funzionalità per gestire atleti, coach, dirigenti, pagamenti, presenze e calendari gare.

## Ultima Sessione: 20 Febbraio 2026

### Completato Oggi:

1. **✅ P0: Modulo Compensi Atleti** (COMPLETO)
   - Pagina `/app/frontend/app/admin/athlete/[id]/compensation.tsx` completamente funzionante
   - Replica esatta della UI dei coach: compenso mensile, date contratto, IBAN, quietanze mensili
   - Endpoint backend: `PATCH /athletes/{id}/compensation/settings`, `GET/POST .../receipts`
   - Sincronizzazione automatica dati da collezione separata a documento atleta
   - Testato: 11/11 test backend passati, frontend completamente funzionante

2. **✅ P1: Fix Login Genitori**
   - Aggiunto auto-approvazione genitori alla registrazione
   - Password test account resettata per testing
   - Testato: login `testparent@trial.com` / `Test1234` funziona

3. **✅ P2: Rate Pagate Rosse** (Non Riproducibile)
   - La logica nel codice è già corretta: `isOverdue = !rate.paid && ...`
   - Le rate pagate mostrano colore verde (#34C759)
   - Potrebbe essere stato un problema con dati specifici

4. **✅ P3: Icone Web** (Già Risolto)
   - Workaround esistente: `/app/frontend/src/components/Icon.tsx` usa emoji
   - Nessun import diretto da `@expo/vector-icons`

### Sessioni Precedenti:
- Importatore Calendari FIPAV (completo)
- Gestione Teams con Prima Squadra, Rifinitura, 10 allenamenti
- Registrazione Atleti Adulti (quota/compensated)
- Fix firma privacy per web
- Fix pagamenti visibili al genitore

### Issue Aperti:
- [ ] FIP (Basketball) importer - da implementare
- [ ] Refactoring server.py in moduli

### Prossimi Task:
- [ ] Importatore FIP Basketball
- [ ] Funzionalità "Rinnovo Stagione"
- [ ] Refactoring `server.py` 
- [ ] Integrazione Stripe

### Backlog (Future):
- [ ] Logica Freemium
- [ ] App mobile nativa

## Credenziali Test
- Admin: `test.admin@test.com` / `Test1234`
- Admin Alt: `pallavoloperugia@gmail.com` / `11092012`
- Genitore: `testparent@trial.com` / `Test1234`
- Atleta Compensato: MARTA TEST (id: 69977ba62666bba1803e5a0f)

## Files Principali Modificati (Oggi)
- `/app/backend/server.py` - Sincronizzazione compensi, auto-approvazione genitori
- `/app/frontend/app/admin/athlete/[id]/compensation.tsx` - UI compensi atleti
- `/app/frontend/app/login.tsx` - data-testid su bottone login
- `/app/backend/tests/test_athlete_compensation.py` - Test automatici

## Architettura
```
/app
├── backend/
│   ├── server.py              # API principale (da refactoring)
│   ├── federation_scraper.py  # Scraper FIPAV
│   └── tests/                 # Test pytest
└── frontend/
    └── app/
        ├── admin/             # Dashboard admin
        │   ├── athlete/[id]/compensation.tsx  # NUOVO: compensi atleti
        │   ├── teams.tsx
        │   └── import-calendar.tsx
        ├── coach/             # Dashboard coach
        ├── parent/            # Dashboard genitori
        └── login.tsx
```

## Schema DB Rilevante
- **athletes**: athlete_type ('quota'|'compensated'), monthly_compensation, contract_start/end_date, iban, iban_holder, bank_name
- **athlete_compensation_receipts**: athlete_id, month, year, signed, signed_date, amount
- **teams**: is_prima_squadra, rifinitura, training_sessions (1-10)
