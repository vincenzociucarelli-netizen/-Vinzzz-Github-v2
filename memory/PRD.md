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
- Firma digitale con canvas
- Invio email automatico

### Modulo Compensi Dirigenti (COMPLETO)
- Stessa funzionalità dei Coach

### Modulo Prime Squadre (IN PROGRESS - 18/02/2026)

**Backend COMPLETO:**
- Campo `athlete_type`: "quota" (paga quote) | "compensated" (percepisce compenso)
- Campo `parents_detached`: flag per sganciare genitori da atleta maggiorenne
- Campi economici (come coach): `iban`, `bank_name`, `bank_account_holder`
- Campi documenti: `document_type`, `document_number`, `document_expiry`, `document_front`, `document_back`
- Endpoint `POST /athletes/{id}/detach-parents` - sgancia genitori
- Endpoint `POST /athletes/{id}/reattach-parents` - ricollega genitori
- Endpoint `PATCH /athletes/{id}/type-config` - modifica tipo atleta e configurazione

**Frontend DA IMPLEMENTARE:**
- [ ] Modificare form registrazione atleta con scelta tipo (A/B)
- [ ] Se tipo B + minorenne → mostra sezione genitori
- [ ] Se tipo B + maggiorenne → sezione economica (IBAN, documenti)
- [ ] Pulsante "Sgancia genitori" nella scheda atleta maggiorenne
- [ ] Nascondere sezione quote per atleti con fees_waived=true

### Protezione Auth (COMPLETO)
- Layout protetti per tutti i ruoli
- Redirect automatico a /login

### Gestione Utenti
- Login/registrazione multi-ruolo
- Ruoli: Admin, Coach, Parent, Director

## Bug Noti
1. **Login Parent** - Da testare (P2)
2. **Icone @expo/vector-icons** - Non si caricano su web (P3)

## Prossimi Task
1. Implementare scelta tipo atleta nel form di registrazione
2. Form dati economici per atleti tipo "compensated"
3. Pulsante "Sgancia genitori" nella scheda atleta

## Backlog
- Modello Freemium
- Integrazione Stripe (luglio 2026)
- Refactoring server.py

## Ultima Modifica
- Data: 18 Febbraio 2026
- Modifica: Backend per gestione tipo atleta (quota/compensated), sgancio genitori, dati economici
