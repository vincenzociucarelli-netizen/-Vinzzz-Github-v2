# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Sistema di gestione per società sportive (pallavolo) con:
- Gestione atleti (maggiorenni e minorenni)
- Gestione staff (coach, dirigenti, collaboratori)
- Gestione pagamenti e quote
- Gestione presenze e allenamenti
- Flusso di registrazione con periodo di prova
- Privacy GDPR compliance

## Current State (26 Feb 2026)

### ✅ Completed Features

**Adult Athlete Flow (Atleta Maggiorenne)**
- Dashboard completa con foto profilo, nome, status
- Layout compatto: email/telefono sulla stessa riga
- Link "Presenze e Statistiche" evidenziato
- Sezione "Documenti" aggiunta
- Pagina Schedule con layout compatto (tabella orari)
- Sezione "Storico Presenze" nella pagina schedule
- Flusso withdrawal con due opzioni:
  - "Rimani e Firma Privacy" → status diventa pending_privacy
  - "Non Rimanere" → elimina account
- Modal firma privacy (AdultPrivacyModal) funzionante
- Privacy acceptance aggiorna status da pending_privacy a active

**Payment System**
- Calcolo corretto importi pagati/da pagare (usa campo `paid: boolean`)
- Ricevute con sport_type corretto dalle impostazioni società

**Admin Features**
- Modifica athlete_code funzionante
- Pulsante "Reset Password" presente
- Visualizzazione stato atleti

### 🔄 In Progress

**Test User for Deletion Flow**
- Created: `testcancella@test.com` / `Test1234`
- Status: trial
- Ready to test "Non Rimanere" (delete account) flow

### 📋 Backlog

**P1 - High Priority**
- Applicare logica "fine prova" per Genitore di atleta minorenne
- Preparare documenti per app store submission

**P2 - Medium Priority**
- Risolvere @expo/vector-icons rendering sul web
- Correggere visualizzazione mesi compensi (mostra 12 mesi invece dei mesi contratto)
- Stabilizzare modulo PRO

**P3 - Low Priority**
- Integrazione Stripe per piani premium
- Implementare logica Freemium
- Refactoring server.py in struttura modulare

## Architecture

### Backend
- FastAPI server (`/app/backend/server.py`)
- MongoDB database
- JWT authentication
- Brevo/SendGrid for emails

### Frontend
- React Native / Expo
- expo-router for navigation
- AsyncStorage for auth tokens

### Key Files
- `/app/backend/server.py` - Main API server
- `/app/frontend/app/athlete/index.tsx` - Athlete dashboard
- `/app/frontend/app/athlete/schedule.tsx` - Schedule page
- `/app/frontend/app/athlete/documents.tsx` - Documents page
- `/app/frontend/src/components/AdultPrivacyModal.tsx` - Privacy signature modal

## Test Credentials
- **Admin**: `test.admin@test.com` / `Test1234`
- **Athlete (Lisa)**: `lisa@test.com` / `Test1234`
- **Test Cancellazione**: `testcancella@test.com` / `Test1234`

## Known Issues
- Frontend environment (Expo/ngrok) can be unstable - may need restart
- @expo/vector-icons don't render on web
