# RegistraTEAM - Product Requirements Document

## Descrizione Prodotto
Applicazione per la gestione di club di pallavolo con funzionalità di gestione atleti, coach, compensi e documenti.

## Architettura Tecnica
- **Frontend**: React Native / Expo Router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Email**: Brevo
- **PDF**: fpdf2 / Pillow

## Funzionalità Implementate

### Modulo Compensi Coach (COMPLETO)
- Generazione PDF quietanze mensili
- Gestione soglie fiscali €5K e €15K
- Colorazione card mesi (verde/arancio/rosso)
- Firma digitale con canvas
- Invio email automatico
- Vista admin con storico quietanze

### Modulo Compensi Dirigenti (COMPLETO - 18/02/2026)
- Stessa funzionalità dei Coach
- Endpoint backend: `/api/dirigente/{id}/compensation/*`
- Pagina frontend: `/dirigente/compensation.tsx`
- Accessibile anche agli Admin come Dirigenti

### Modulo Prime Squadre (COMPLETO - 18/02/2026)
- **Backend** (`server.py`):
  - Flag `pro_enabled` nelle impostazioni società
  - Endpoint `/api/prime-squadre/athletes` - lista atleti con compensi
  - Endpoint `/api/prime-squadre/athletes/{id}/enable` - abilita compensi
  - Endpoint `/api/prime-squadre/athletes/{id}/disable` - disabilita compensi
  - Endpoint `/api/prime-squadre/athletes/{id}/set-compensation` - imposta compenso mensile
  - Endpoint `/api/prime-squadre/athletes/{id}/compensation/receipt` - firma quietanza
  - Endpoint `/api/prime-squadre/athletes/{id}/threshold-status/{year}` - stato soglie
  - Endpoint `/api/prime-squadre/stats` - statistiche modulo
  - Limite 50 membri per società
- **Frontend**:
  - Toggle attivazione in Impostazioni (`settings.tsx`)
  - Pagina gestione Prime Squadre (`admin/prime-squadre.tsx`)
  - Dashboard con statistiche annuali
  - Lista membri con compenso e riepilogo annuale
  - Modal per aggiungere atleti
  - Modal per impostare compenso mensile
  - Icona dashboard dinamica (bloccata/sbloccata)

### Protezione Auth (FIX - 18/02/2026)
- Layout protetti per admin, coach, parent, dirigente
- Redirect automatico a /login per utenti non autenticati
- API interceptor per gestire errori 401/403
- Routing corretto per ruolo 'viewer' (Dirigente)

### Gestione Utenti
- Login/registrazione multi-ruolo
- Ruoli: Admin, Coach, Parent, Director (viewer)
- Profili con dati anagrafici e bancari
- Upload documenti identità

### Scanner QR
- Scansione presenze atleti
- Fotocamera posteriore di default

### Impostazioni Società
- Campi Email e PEC aggiunti
- Nome società dinamico
- Toggle Prime Squadre

## Bug Risolti (18/02/2026)
1. ✅ Protezione route Admin/Coach/Parent/Dirigente
2. ✅ Redirect automatico su errori auth 401/403
3. ✅ Routing ruolo 'viewer' (Dirigente)

## Bug Noti
1. **Login Parent** - Da testare con credenziali reali (P2)
2. **Icone @expo/vector-icons** - Non si caricano su web (P3)

## Prossimi Task
1. ~~Fix bug Admin panel authentication~~ ✅ COMPLETATO
2. ~~Implementare modulo "Prime Squadre"~~ ✅ COMPLETATO
3. Test completo Prime Squadre con utente reale
4. Implementare firma quietanze atleti PRO

## Backlog
- Modello Freemium (limite 30 membri free)
- Integrazione Stripe per abbonamenti (da luglio 2026)
- Refactoring server.py (oltre 8000 righe)
- PDF automatici per atleti PRO
- Email notifiche per atleti PRO

## Ultima Modifica
- Data: 18 Febbraio 2026
- Modifica: Implementato modulo Prime Squadre completo (backend + frontend), fix auth admin panel
