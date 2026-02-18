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
- Rimossa sezione "Registro Pagamenti Mensili" dal profilo (obsoleta)
- Accessibile anche agli Admin come Dirigenti

### Gestione Utenti
- Login/registrazione multi-ruolo
- Ruoli: Admin, Coach, Parent, Director
- Profili con dati anagrafici e bancari
- Upload documenti identità

### Scanner QR
- Scansione presenze atleti
- Fotocamera posteriore di default

## Bug Noti
1. **Login Parent** - Non funziona (P2)
2. **Login Admin** - Navigazione buggy (P1)
3. **Icone @expo/vector-icons** - Non si caricano su web (P3)

## Prossimi Task
1. ~~Estendere modulo compensi ai Dirigenti~~ ✅ COMPLETATO
2. Estendere modulo compensi agli Atleti PRO

## Backlog
- Modello Freemium (limite 30 membri)
- Integrazione Stripe per abbonamenti
- Limite squadre con messaggio upgrade

## Ultima Modifica
- Data: 18 Febbraio 2026
- Modifica: Implementato modulo compensi completo per Dirigenti, rimossa sezione "Registro Pagamenti Mensili" obsoleta dal profilo

