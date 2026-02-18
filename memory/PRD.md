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

### Impostazioni Società (AGGIORNATO - 18/02/2026)
- Campi Email e PEC aggiunti
- Nome società dinamico (caricato da database, non hardcoded)
- Tutti i pulsanti freccia "indietro" con stile corretto (backgroundColor rgba)

## Bug Noti
1. **Login Parent** - Non funziona (P2)
2. **Login Admin** - Navigazione buggy (P1)
3. **Icone @expo/vector-icons** - Non si caricano su web (P3)

## Prossimi Task
1. ~~Estendere modulo compensi ai Dirigenti~~ ✅ COMPLETATO
2. ~~Aggiungere campi Email/PEC a Impostazioni~~ ✅ COMPLETATO
3. Implementare modulo "Prime Squadre" (Fase 2)
4. Fix bug Admin panel authentication

## Backlog
- Modello Freemium (limite 30 membri)
- Integrazione Stripe per abbonamenti (da luglio 2026)
- Limite squadre con messaggio upgrade
- Refactoring server.py (oltre 8000 righe)

## Ultima Modifica
- Data: 18 Febbraio 2026
- Modifica: Aggiunti campi Email e PEC alle impostazioni società, verificate frecce indietro, confermato nome società dinamico

