# RegistraTEAM - PRD (Product Requirements Document)

## Original Problem Statement
RegistraTEAM è un'applicazione di gestione club di pallavolo, progettata per essere pratica e snella per società medio-piccole focalizzate sui settori giovanili. L'obiettivo è gestire la relazione società/famiglie/coach senza le complessità di software enterprise come Golee.

## Target Audience
- Società sportive di pallavolo di piccole/medie dimensioni
- Settori giovanili
- Famiglie degli atleti
- Coach e dirigenti

## Core Features Implemented

### Gestione Atleti
- Registrazione e profilo atleti completo
- Dati tecnici (ruolo, altezza, peso, elevazione)
- Foto atleta con upload e cropping
- Assegnazione a squadre (primaria e secondaria)
- **Codice atleta editabile manualmente** per import pagamenti (formato: COGNOME_NOME_TEAM_ABBR)
- Badge overpayment visibile su lista e dettaglio atleta
- **Periodo di prova 7 giorni** per nuovi atleti registrati dai genitori

### Gestione Pagamenti
- Import pagamenti da Excel con template migliorato
- Tracking pagamenti per atleta
- Calcolo automatico dovuto/pagato
- Export codici atleti per Excel
- Ricevuta fiscale PDF scaricabile (per genitori)

### Gestione Coach
- Profilo coach con squadre assegnate
- Sistema compensi cumulativi con badge (<5K, <15K)
- Tracking compensi esterni da altri club
- Controllo soglie fiscali

### Sistema Presenze
- QR code per check-in
- Statistiche presenze per squadra
- Storico presenze atleta

### Altre Funzionalità
- Dashboard admin con statistiche
- Gestione squadre e stagioni
- Notifiche (compleanni, certificati in scadenza)
- Calendario gare
- Gestione dirigenti
- Profilo genitore con accesso dati atleta

## Technical Architecture

### Stack
- **Frontend**: React Native / Expo (Web + Mobile)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **PDF Generation**: expo-print (HTML to PDF)
- **Icons**: Custom Icon component with emoji mapping

### Key Technical Decisions
- Icons: Sostituiti `@expo/vector-icons/Ionicons` con componente custom emoji-based per compatibilità Expo Web
- PDF: Usato `expo-print` invece di `jspdf` per evitare problemi Metro bundler

## Files of Reference
- `/app/frontend/src/components/Icon.tsx` - Componente icone emoji-based
- `/app/frontend/src/utils/fiscalReceipt.ts` - Generazione ricevuta PDF
- `/app/backend/server.py` - Backend API
- `/app/frontend/app/admin/index.tsx` - Dashboard admin
- `/app/frontend/app/admin/athlete/[id].tsx` - Dettaglio atleta admin (con modifica codice)
- `/app/frontend/app/parent/athlete/[id].tsx` - Dettaglio atleta (genitore)

## What's Been Implemented (Feb 14, 2025)

### Session 1 - Bug Fixes
1. **Frontend Build Failure** - Risolto crash Metro bundler causato da jspdf, sostituito con expo-print
2. **Icone Non Visibili** - Creato componente Icon con mapping emoji, aggiornati tutti i file
3. **Ricevuta Fiscale** - Implementata generazione PDF via HTML/expo-print

### Session 2 - P1 Features
4. **Modifica Manuale Codice Atleta** - Admin può ora modificare il campo athlete_code dalla pagina dettaglio atleta
   - Aggiunto campo editabile nella sezione Squadra
   - Validazione unicità del codice all'interno della società
   - Visualizzazione codice in modalità view e edit
5. **Periodo di Prova 7 Giorni** - Già implementato nelle sessioni precedenti

---

## Backlog / Upcoming Features (da ricordare all'utente)

### P2 - Prossimi da implementare
- [ ] **Modulo atleti che percepiscono compenso** (non professionisti) - Tracking compensi per atleti
- [ ] **Limite team per società** con messaggio upgrade - Business model

### P3 - Future
- [ ] Integrazione Stripe per pagamenti online
- [ ] PWA per installazione mobile

## Admin Credentials (Test)
- Email: `pallavoloperugia@gmail.com`
- Password: `11092012`
