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

### Modulo Compensi Dirigenti (COMPLETO)
- Stessa funzionalità dei Coach
- Endpoint backend: `/api/dirigente/{id}/compensation/*`
- Pagina frontend: `/dirigente/compensation.tsx`

### Modulo Prime Squadre (COMPLETO - 18/02/2026)
**Backend** (`server.py`):
- Flag `pro_enabled` nelle impostazioni società
- Campi atleta: `is_compensated`, `monthly_compensation`, `other_annual_compensation`, `contract_start_date`, `contract_end_date`, `fees_waived`
- Endpoint `/api/prime-squadre/athletes` - lista atleti con compensi
- Endpoint `/api/prime-squadre/athletes/{id}/enable` - abilita compensi
- Endpoint `/api/prime-squadre/athletes/{id}/disable` - disabilita compensi
- Endpoint `PATCH /api/prime-squadre/athletes/{id}` - aggiorna configurazione completa
- Endpoint `/api/prime-squadre/athletes/{id}/compensation/receipt` - firma quietanza
- Endpoint `/api/prime-squadre/athletes/{id}/threshold-status/{year}` - stato soglie
- Endpoint `/api/prime-squadre/stats` - statistiche modulo
- Limite 50 membri per società

**Frontend**:
- Toggle attivazione in Impostazioni (`settings.tsx`)
- Pagina gestione Prime Squadre (`admin/prime-squadre.tsx`)
- Pagina dettaglio atleta (`admin/prime-squadre/[id].tsx`)
- Modal configurazione completo con:
  - Compenso mensile
  - Compensi pregressi (da altre ASD nell'anno)
  - Date contratto (inizio/fine)
  - Switch esenzione quote (per atleti che passano da giovanile a professionisti)
- Dashboard con statistiche annuali
- Lista membri con compenso e riepilogo annuale
- Icona dashboard dinamica (bloccata/sbloccata)

### Protezione Auth (COMPLETO)
- Layout protetti per admin, coach, parent, dirigente
- Redirect automatico a /login per utenti non autenticati
- API interceptor per gestire errori 401/403

### Gestione Utenti
- Login/registrazione multi-ruolo
- Ruoli: Admin, Coach, Parent, Director (viewer)
- Profili con dati anagrafici e bancari

### Scanner QR
- Scansione presenze atleti
- Fotocamera posteriore di default

### Impostazioni Società
- Campi Email e PEC
- Nome società dinamico
- Toggle Prime Squadre

## Bug Noti
1. **Login Parent** - Da testare con credenziali reali (P2)
2. **Icone @expo/vector-icons** - Non si caricano su web (P3)

## Backlog
- Modello Freemium (limite 30 membri free)
- Integrazione Stripe per abbonamenti (da luglio 2026)
- Refactoring server.py (oltre 8000 righe)
- PDF automatici per atleti PRO
- Email notifiche per atleti PRO
- Nascondere sezione quote per atleti con fees_waived=true

## Ultima Modifica
- Data: 18 Febbraio 2026
- Modifica: Aggiunta gestione completa atleti Prime Squadre con date contratto, compensi pregressi, esenzione quote
