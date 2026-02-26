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
- Pagina Schedule con layout compatto (senza "Storico Presenze")
- Flusso withdrawal con due opzioni:
  - "Rimani e Firma Privacy" → status diventa pending_privacy
  - "Non Rimanere" → elimina account
- Modal firma privacy (AdultPrivacyModal) funzionante
- Privacy acceptance genera PDF firmato tramite /documents/sign
- Pagina documenti mostra icona download se PDF disponibile

**Parent Flow (Genitore di Minorenne)**
- Check automatico atleti con trial scaduto
- Modal con opzioni: "Accetta Privacy" (firma digitale) o "Cancella Dati"
- Generazione PDF privacy firmato con invio email
- Doppia conferma per cancellazione dati

**Admin Features**
- Sezione "Privacy GDPR" nella pagina dettaglio atleta
- Modifica athlete_code funzionante
- Pulsante "Reset Password" presente
- Visualizzazione stato atleti

**Payment System**
- Calcolo corretto importi pagati/da pagare
- Ricevute con sport_type corretto

**Compensation System (Coach/Dirigente/Collaboratore)**
- Warning quando date contratto non impostate
- Mostra solo mesi fino a quello corrente (non tutti 12)

**Icons Fix**
- Tutti i file usano componente Icon.tsx con fallback emoji
- Nessun file usa più @expo/vector-icons direttamente

### 📋 Backlog

**P1 - High Priority**
- Preparare documenti per app store submission
- Decidere se implementare Stripe ora o rimandare

**P2 - Medium Priority**
- Stabilizzare modulo PRO
- Refactoring server.py in struttura modulare

**P3 - Low Priority**
- Integrazione Stripe per piani premium
- Implementare logica Freemium

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
- Custom Icon component with emoji fallback

### Key Files
- `/app/backend/server.py` - Main API server
- `/app/frontend/app/athlete/index.tsx` - Athlete dashboard
- `/app/frontend/app/parent/index.tsx` - Parent dashboard (with trial logic)
- `/app/frontend/app/athlete/schedule.tsx` - Schedule page
- `/app/frontend/app/athlete/documents.tsx` - Documents page
- `/app/frontend/app/admin/athlete/[id].tsx` - Admin athlete detail
- `/app/frontend/src/components/Icon.tsx` - Icon component with emoji fallback
- `/app/frontend/app/coach/compensation.tsx` - Coach compensation
- `/app/frontend/app/dirigente/compensation.tsx` - Dirigente compensation
- `/app/frontend/app/collaboratore/compensation.tsx` - Collaboratore compensation

## Test Credentials
- **Admin**: `test.admin@test.com` / `Test1234`
- **Athlete (Lisa)**: `lisa@test.com` / `Test1234`

## Recent Changes (26 Feb 2026)
1. Fixed icon import in documents-archive.tsx
2. Added warning + limited months for compensation pages without contract dates
3. Verified parent trial flow is already implemented
4. Removed "Storico Presenze" section from schedule page
5. Removed confusing info message from documents page
6. Added "Privacy GDPR" section to admin athlete detail
7. Updated privacy signature flow to generate PDF

## Known Issues Resolved
- ✅ @expo/vector-icons on web - all files now use Icon.tsx
- ✅ 12 months compensation display - now shows warning and limited months
- ✅ Parent trial logic - already implemented and working
