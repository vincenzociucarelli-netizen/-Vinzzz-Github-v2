# RegistraTeam - Product Requirements Document

## Original Problem Statement
Sistema di gestione completo per società sportive italiane (pallavolo, basket) che include:
- Gestione atleti (minori e adulti)
- Gestione allenatori
- Gestione dirigenti
- Gestione collaboratori
- Importazione partite da federazioni (FIPAV, FIP)
- Sistema presenze e comunicazioni

---

## 🔒 MODULO PRO (BLOCCATO - Prossimamente)
Le seguenti funzionalità sono bloccate e saranno disponibili nella versione PRO:
- Compensi **Atleti** (rimosso - atleti PRO non esistono più)
- Prime Squadre (gestione atleti retribuiti)

**File di backup**: `/app/frontend/_pro_backup/` (spostato fuori da /app per evitare errori bundling)

---

## ✅ COMPENSI ATTIVI (Coach, Dirigenti, Collaboratori)
Le seguenti funzionalità rimangono **ATTIVE**:
- Compensi Coach/Allenatori
- Compensi Dirigenti
- Compensi Collaboratori (da implementare)
- Quietanze mensili con firma digitale
- Soglie fiscali €5.000 / €15.000
- Documenti di superamento soglie
- Report compensi (per staff)

---

## APP BASE (Attiva)

### Figure Supportate
1. **Genitori** - Registrano figli minorenni a periodo di prova
2. **Atleti Maggiorenni** - Si registrano autonomamente (DA IMPLEMENTARE)
3. **Coach/Allenatori** - Con tessera federale
4. **Dirigenti** - Staff direttivo
5. **Collaboratori** - Preparazione campo, trasporti, pulizie, segreteria (DA IMPLEMENTARE)

### Funzionalità Attive
- ✅ Registrazione atleti (minorenni con genitore)
- ✅ Gestione squadre/categorie
- ✅ Profili utenti
- ✅ Comunicazioni/avvisi
- ✅ Calendario partite
- ✅ Importazione partite da federazione
- ✅ Upload foto profilo
- ✅ Privacy e consensi

---

## Session 2026-02-22 - BLOCCO MODULO PRO

### Modifiche Effettuate
1. **Pagine sostituite con schermata lucchetto**:
   - `/athlete/compensation.tsx` → ProFeatureLock
   - `/coach/compensation.tsx` → ProFeatureLock
   - `/dirigente/compensation.tsx` → ProFeatureLock
   - `/admin/prime-squadre.tsx` → ProFeatureLock
   - `/admin/prime-squadre/[id].tsx` → ProFeatureLock
   - `/admin/athlete/[id]/compensation.tsx` → ProFeatureLock

2. **Componente creato**: `/src/components/ProFeatureLock.tsx`
   - Schermata con lucchetto e messaggio "Prossimamente"
   - Badge PRO dorato
   - Pulsante torna indietro

3. **Voci menu bloccate**:
   - Admin: Report Quietanze → alert PRO
   - Coach Profile: Quietanze Mensili → alert PRO
   - Dirigente Profile: Firma Quietanze → alert PRO

---

## PROSSIMI TASK

### P0 - Priorità Alta
1. **Archivio Documenti Firmati** (NUOVO)
   - **Lato Admin**: Sezione "Archivio Documenti" con filtri per stagione e figura
   - **Lato Utente**: Ogni figura vede i propri documenti firmati ("I Miei Documenti")
   - **Rimuovere** invio email alla società (resta solo email a chi firma)
   - I documenti sono già salvati in `/app/backend/signed_documents/`

2. **Nuova Figura: Collaboratori**
   - Ruolo: `collaboratore`
   - Campi: nome, contatti, documento, IBAN
   - Tipo attività: Preparazione campo, Trasporti, Pulizie, Segreteria, Altro
   - Associazione: Squadra / Palestra / Entrambi
   - Copiare struttura Coach (Solution A)

3. **Registrazione Atleta Maggiorenne**
   - Nuovo flusso: "Sono un atleta maggiorenne"
   - Senza genitore, si registra da solo
   - Periodo di prova come i minorenni

### P1 - Medio termine
- Gestione presenze/allenamenti
- Notifiche push
- Miglioramenti UI

### P2 - Backlog
- Preparazione per pubblicazione Store (iOS/Android)
- Privacy policy e termini di servizio
- Icone e screenshot per store

---

## Implementazioni Precedenti (Reference)
8. ✅ **Backend team null check**: Evitato errore 500 quando team non assegnato
9. ✅ **Athlete model Optional fields**: date_of_birth, is_minor, team_id ora opzionali

## Test Credentials
- **Admin**: test.admin@test.com / Test1234
- **Athlete (PRO)**: atleta.prova@test.com / TestAthlete123
- **Parent**: lidia@test.com / Test1234

## Test Reports
- `/app/test_reports/iteration_11.json` - Test badge PRO, formato date, form semplificato (100% PASS)

## Pending Issues (Backlog)
1. **P3**: @expo/vector-icons rendering on web (workaround con emoji in place)

## Upcoming Features
1. **P2**: Season renewal workflow
2. **P3**: Refactor server.py into modular routes (/routes, /models)
3. **P3**: Consolidare codice duplicato coach/atleta
4. **P3**: Stripe integration for premium plans

## Architecture
```
/app
├── backend/
│   ├── server.py         # Monolithic FastAPI server
│   ├── email_service.py  # SendGrid/Brevo integration
│   └── federation_scraper.py  # FIPAV/FIP importer
└── frontend/
    └── app/
        ├── admin/        # Admin dashboard
        ├── athlete/      # Athlete dashboard (PRO)
        ├── coach/        # Coach dashboard
        ├── dirigente/    # Director dashboard
        └── parent/       # Parent dashboard
```

## Last Updated
2026-02-23: Firma Privacy PDF per Coach/Collaboratore implementata

## Session 2026-02-23 - Firma Privacy PDF

### Implementazione Firma Privacy con PDF ✅

1. **Backend - Endpoint `/documents/sign` Migliorato**
   - Aggiunta logica per salvare `coach_id`, `dirigente_id`, `collaboratore_id` in base al ruolo utente
   - I documenti firmati ora appaiono correttamente nell'archivio Admin filtrati per tipo figura
   - **File**: `/app/backend/server.py` linee 8991-9045

2. **Frontend - Coach Privacy (`coach/profile.tsx`)**
   - `handlePrivacySign` ora genera PDF completo via `/documents/sign`
   - Include testo informativa privacy con dati anagrafici
   - Email di conferma automatica
   - Aggiunta funzione `formatDate` per formattazione date
   - **File**: `/app/frontend/app/coach/profile.tsx`

3. **Frontend - Collaboratore Privacy (`collaboratore/profile.tsx`)**
   - Stesso flusso del Coach con testo specifico per Collaboratore
   - PDF firmato + email + archivio
   - **File**: `/app/frontend/app/collaboratore/profile.tsx`

### Test Effettuati ✅
- Registrazione Coach: `coach.test.privacy@test.com` / `Test1234`
- Firma privacy: Documento creato con ID `1cd79d8c-cbcf-405f-b446-ec64b0c83031`
- Archivio Admin: Documento appare con `figure_type: coach`

---

## Session 2026-02-23 - Registrazione Atleta Maggiorenne

### Nuova Funzionalità ✅

**Registrazione Atleta Maggiorenne (18+)**

1. **Backend - Nuovo Endpoint `/auth/register-adult-athlete`**
   - Crea un account user con ruolo `athlete`
   - Crea un record `athlete` collegato
   - L'atleta inizia in stato `trial` per 7 giorni
   - Richiede un codice invito valido della società
   - L'atleta viene auto-approvato (non richiede approvazione admin)
   - **File**: `/app/backend/server.py`

2. **Frontend - Form di Registrazione Aggiornato**
   - Aggiunta opzione "Atleta Maggiorenne (18+)" nella selezione ruoli
   - Info box specifico per atleti con messaggio sui 7 giorni di prova
   - Redirect a `/athlete` dopo la registrazione
   - **File**: `/app/frontend/app/register.tsx`

### Test Effettuati ✅
- Endpoint `/auth/register-adult-athlete` testato con successo
- Login atleta funzionante
- Endpoint `/auth/me` restituisce correttamente `athlete_id`

### Credenziali Test
- **Atleta Test**: `marco.bianchi.test@test.com` / `Test1234`
- **Codice Invito Società**: `BUZHB0WT`

---

## Session 2026-02-23 - Bug Fix Profilo Dirigente e Archivio

### Bug Risolti ✅

1. **Bug A.1 - Download Documenti nel Profilo Dirigente**
   - **Problema**: Mancava l'import di `AsyncStorage` nel file
   - **Soluzione**: Aggiunto import + definita costante `API_URL`
   - **File**: `/app/frontend/app/dirigente/profile.tsx`

2. **Bug A.2 - Link "Vedi Tutti i Documenti"**
   - **Problema**: Non c'era modo di vedere tutti i documenti personali
   - **Soluzione**: Aggiunto Modal con lista completa + paginazione (mostra solo 3 iniziali)
   - **File**: `/app/frontend/app/dirigente/profile.tsx`

3. **Bug B - Immagine Documento Identità nel Profilo View**
   - **Problema**: Mancava lo stile `docImage` per visualizzare le immagini
   - **Soluzione**: Aggiunto stile `docImage` nella sezione StyleSheet
   - **File**: `/app/frontend/app/dirigente/profile.tsx`

4. **Bug D - Admin Archive non mostrava Coach/Dirigente**
   - **Problema**: L'URL dell'API mancava del prefisso `/api`
   - **Soluzione**: Corretti URL da `/documents/archive` a `/api/documents/archive`
   - **File**: `/app/frontend/app/admin/documents-archive.tsx`

### Test Results
- `/app/test_reports/iteration_15.json` - 13/13 test passati (backend only)
- Archive endpoint: 37 documenti totali (10 coach, 11 dirigente)
- Download endpoint: Restituisce PDF correttamente

### Note
- Frontend Ngrok tunnel instabile durante il test
- Backend completamente funzionante e verificato

---

## Session 2026-02-22 - Implementazione Collaboratori

### Funzionalità Completate ✅

1. **Backend - Modello e Ruolo Collaboratore**
   - Aggiunto `UserRole.COLLABORATORE` al sistema
   - Creato modello `CollaboratoreCompensation`
   - Collection: `collaboratore_compensations`

2. **Backend - Endpoint CRUD Collaboratori**
   - `GET /api/collaboratori` - Lista tutti
   - `POST /api/collaboratori` - Crea nuovo
   - `GET /api/collaboratore/{id}` - Dettaglio singolo
   - `PUT /api/collaboratore/{id}` - Aggiorna
   - `DELETE /api/collaboratore/{id}` - Elimina

3. **Backend - Endpoint Compensi Collaboratori**
   - `GET /api/collaboratore/{id}/compensation` - Storico compensi
   - `POST /api/collaboratore/{id}/compensation/receipt` - Firma quietanza
   - `GET /api/collaboratore/{id}/compensation/annual/{year}` - Status annuale

4. **Frontend - Pagine Collaboratore**
   - `/app/frontend/app/collaboratore/index.tsx` - Dashboard
   - `/app/frontend/app/collaboratore/compensation.tsx` - Firma quietanze
   - `/app/frontend/app/collaboratore/profile.tsx` - Profilo

5. **Frontend - Admin**
   - `/app/frontend/app/admin/collaboratori.tsx` - Gestione collaboratori
   - Menu "Collaboratori" aggiunto al dashboard admin

6. **Login redirect per ruolo collaboratore**

### Politica Email Collaboratori (come Coach)
- Quietanze mensili → Solo archivio
- Superamento €5.000/€15.000 → Archivio + Email (firmatario + admin)

### Account Test
- Email: `mario.collab@test.com`
- Password: `Test1234`

---

### Funzionalità Completate ✅

1. **Backend - Endpoint Archivio Documenti**
   - `GET /api/documents/archive` - Lista documenti con filtri (stagione, figura, ricerca)
   - `GET /api/documents/download/{id}` - Download PDF documento
   - `GET /api/documents/my-documents` - Documenti dell'utente corrente

2. **Frontend Admin - Pagina Archivio**
   - `/app/frontend/app/admin/documents-archive.tsx`
   - Filtri per stagione e tipo figura (coach, dirigente, collaboratore, atleta)
   - Ricerca per nome
   - Paginazione
   - Download PDF diretto

3. **Dashboard Admin - Link Archivio**
   - Aggiunto "📁 Archivio Documenti" nel menu principale

4. **Politica Email Documenti**
   - **Solo Archivio (NO email)**:
     - Quietanze mensili standard Coach/Dirigente
   - **Archivio + Email (firmatario + admin)**:
     - Superamento soglia €5.000 Coach/Dirigente
     - Superamento soglia €15.000 Coach/Dirigente
   - **Archivio + Email (solo firmatario)**:
     - Privacy Genitore/Atleta (alla fine del periodo di prova)
     - Privacy Coach/Dirigente/Collaboratore (all'iscrizione)

5. **Firma Privacy Genitori - IMPLEMENTATA** ✅
   - Endpoint `/documents/sign` aggiornato per salvare PDF su disco
   - Aggiunto `parent_id`, `parent_name`, `athlete_id`, `athlete_name` al record
   - Email inviata al genitore firmatario con PDF allegato
   - NO email all'admin (disponibile solo in archivio)
   - Filtro "Genitori" aggiunto all'archivio documenti

### Bug Fix Precedenti (stessa sessione) ✅
- Backend Dirigente: protezione ri-firma quietanze
- Frontend Modal: pulsanti fuori ScrollView
- Frontend: helper `matchesMonth()` per dati legacy

---

## Session 2026-02-21 (Late Night Update)

### New Features Implemented
1. **Eliminazione Atleta con Conferma** ✅
   - Pulsante "Elimina Atleta Definitivamente" nella pagina dettaglio atleta
   - Modal di conferma con avviso IRREVERSIBILE
   - Elenca tutti i dati che verranno eliminati (pagamenti, presenze, certificati)
   - Backend: utilizza endpoint DELETE `/athletes/{id}` esistente

2. **Calcolo Automatico Codice Fiscale** ✅ (Implementato per TUTTI)
   - Nuova libreria: `python-codicefiscale==0.11.3`
   - Endpoint: `POST /api/utils/calcola-cf`
   - Input: nome, cognome, data_nascita (GG/MM/AAAA), luogo_nascita, sesso (M/F)
   - Output: codice fiscale calcolato o messaggio di errore
   - **Implementato in**:
     - ✅ Form registrazione atleta adulto (admin)
     - ✅ Profilo atleta (atleta PRO)
     - ✅ Profilo coach (allenatore)
     - ✅ Profilo dirigente

3. **Campo Sesso (M/F)** ✅
   - Aggiunto in tutti i profili: atleta, coach, dirigente
   - Toggle buttons M/F con stile coerente
   - Salvato nel database e utilizzato per calcolo CF

4. **Rimozione Icone QR dalla Lista Atleti** ✅
   - Rimosse le piccole icone QR code prima del nome
   - Miglior leggibilità su mobile

### Files Modified
- `/app/backend/server.py`: Aggiunto import codicefiscale, endpoint `/utils/calcola-cf`
- `/app/backend/requirements.txt`: Aggiunto python-codicefiscale
- `/app/frontend/app/admin/athletes.tsx`: Form CF aggiornato, rimosso QR icon, nuovi stili
- `/app/frontend/app/admin/athlete/[id].tsx`: Pulsante elimina, modal conferma, funzione delete
- `/app/frontend/app/athlete/profile.tsx`: Campo sesso, pulsante calcola CF, nuovi stili
- `/app/frontend/app/coach/profile.tsx`: Campo sesso, pulsante calcola CF, nuovi stili
- `/app/frontend/app/dirigente/profile.tsx`: Campo sesso, pulsante calcola CF, nuovi stili



## Session 2025-12-20 (Bug Fixes - Ricevute Atleti PRO)

### Critical Bug Fixes Implemented
1. **Fix ricevute firmate che scompaiono dopo reload** ✅
   - **Problema**: Il frontend usava `receipt_signed` ma il backend ritorna `signed`
   - **Soluzione**: Aggiornato l'interface `CompensationRecord` e tutti i riferimenti nel frontend
   - **File**: `/app/frontend/app/athlete/compensation.tsx`

2. **Fix formato mese nelle ricevute** ✅
   - **Problema**: Il backend salvava `month: "Settembre"` (stringa) invece di `month: 9` (numero)
   - **Soluzione**: Corretto backend per salvare numero + aggiunto `matchesMonth()` helper nel frontend per supporto legacy
   - **File**: `/app/backend/server.py` (riga ~4257-4273), `/app/frontend/app/athlete/compensation.tsx`

3. **Fix campo gender non salvato** ✅
   - **Problema**: Il campo `gender` per il Codice Fiscale non veniva accettato dai modelli Pydantic
   - **Soluzione**: Aggiunto `gender: Optional[str] = None` ai modelli `UserProfileUpdate` e `AthleteUpdate`
   - **File**: `/app/backend/server.py`

### Files Modified
- `/app/backend/server.py`:
  - Linea ~587: Aggiunto `gender` a `AthleteUpdate`
  - Linea ~1217: Aggiunto `gender` a `UserProfileUpdate`  
  - Linea ~1259: Handling gender in update_me()
  - Linea ~4257-4273: Corretto storage mese come numero intero
  - Linea ~4688-4690: Handling gender in update_athlete()

- `/app/frontend/app/athlete/compensation.tsx`:
  - Linea ~25-32: Aggiunta funzione `matchesMonth()` per compatibilità legacy
  - Linea ~34-46: Aggiornata interface con `signed` invece di `receipt_signed`
  - Tutte le occorrenze di `receipt_signed` → `signed`
  - Tutte le occorrenze di filtro per mese ora usano `matchesMonth()`

### Pending Issues
1. **P0**: Bug "doppio click" per aprire modal firma (richiede ulteriore investigazione state management)
2. **P1**: Verificare funzione "Elimina Atleta" (implementata ma non testata)
3. **P2**: Parent login non funzionante
4. **P2**: @expo/vector-icons non renderizza su web

### Known Environment Issues
- **Expo tunnel watcher limit**: L'ambiente ha un limite di inotify watchers che impedisce l'avvio di Expo con hot-reload. Il backend funziona correttamente.

### Test Status
- **Backend API**: ✅ Testato con curl - gender salva correttamente
- **Frontend**: ⚠️ Non testabile a causa del problema inotify watchers

## Session 2026-02-21 (Password Reset & Filter Fix)

### New Features Implemented
1. **Admin Reset Password per Atleti** ✅
   - **Endpoint**: `POST /api/admin/athletes/{athlete_id}/reset-password`
   - **Funzionalità**: L'admin può inviare email di reset password agli atleti con email registrata
   - **Frontend**: Pulsante "Invia Email Reset Password" nella pagina dettaglio atleta
   - **Modal conferma**: Mostra email atleta prima dell'invio
   - **Email**: Inviata via Brevo con codice di reset
   - **File modificati**:
     - `/app/backend/server.py`: Linee 2048-2110 (nuovo endpoint)
     - `/app/frontend/app/admin/athlete/[id].tsx`: State, handler, pulsante, modal

2. **Fix Filtro Ricerca Prime Squadre** ✅
   - **Problema**: Il filtro non funzionava dopo l'aggiunta dei coach
   - **Soluzione**: Migliorata logica filtro per cercare in più campi
   - **Campi ricercabili**: nome, cognome, nome squadra, tipo (atleta/coach)
   - **Supporto query vuota**: Mostra tutti i risultati se nessuna ricerca
   - **File modificato**: `/app/frontend/app/admin/prime-squadre.tsx` (linee 303-315)

### Test Results
- `/app/test_reports/iteration_12.json`
- **Backend**: 100% (11 passed, 1 skipped)
- **Frontend**: Verificato via code review
- **Email service**: Confermato invio email via Brevo logs

### Pending Issues
1. **P1**: Bug "doppio click" per aprire modal firma
2. **P1**: Verificare funzione "Elimina Atleta"
3. **P2**: Parent login non funzionante
4. **P2**: @expo/vector-icons non renderizza su web

### Last Updated
2026-02-22: Bug fixes + Firma Privacy completa (Maggiorenni + Genitore minorenni)

## Session 2026-02-22 (Bug Fixes + Privacy Module)

### Bug Fixes Implementati
1. **Fix A - Foto Profilo Atleta Non Memorizzata** ✅
   - **File**: `/app/backend/server.py` linee 1201-1223

2. **Fix C - Layout "Mesi nel contratto"** ✅
   - **File**: `/app/frontend/app/athlete/compensation.tsx`, `/app/frontend/app/coach/compensation.tsx`

3. **Fix D - Pulsanti Firma Non Visibili** ✅
   - **File**: stessi file sopra, stile `modalScroll`

4. **Fix Bug Doppio Click Firma Coach** ✅
   - **File**: `/app/frontend/app/coach/compensation.tsx`

### Test Results Bug Fixes
- `/app/test_reports/iteration_13.json` - Backend 100%

---

## Nuova Funzionalità: Firma Privacy COMPLETA ✅

### 1. Privacy Maggiorenni (Atleti adulti, Coach, Dirigenti)
- **Componente**: `/app/frontend/src/components/AdultPrivacyModal.tsx`
- **Contenuto aggiornato**:
  - ✓ Consenso trattamento dati per attività sportiva
  - ✓ Comunicazione dati a Federazioni (FIPAV) e EPS per tesseramento
  - ✓ Utilizzo foto/video su social (Facebook, Instagram, TikTok, YouTube)
  - ✓ Comunicazione dati ad assicurazioni e enti sanitari
  - ✓ Per coach/dirigenti: consenso trattamento dati compensi
- **Integrazione**:
  - Coach Profile: `/app/frontend/app/coach/profile.tsx`
  - Dirigente Profile: `/app/frontend/app/dirigente/profile.tsx`
  - Atleta adulto (18+): `/app/frontend/app/athlete/profile.tsx`

### 2. Privacy Genitore (per atleti minorenni a fine prova)
- **File**: `/app/frontend/app/parent/index.tsx`
- **Contenuto aggiornato**:
  - ✓ Consenso trattamento dati del minore
  - ✓ Comunicazione dati a Federazioni (FIPAV) e EPS per tesseramento
  - ✓ Utilizzo foto/video sui social e materiale promozionale
  - ✓ Comunicazione dati ad assicurazioni e enti sanitari
- **Workflow**: A fine periodo di prova, genitore può:
  1. Firmare privacy e confermare iscrizione
  2. Rinunciare e richiedere cancellazione dati

### Backend
- **File**: `/app/backend/server.py`
- Aggiunto campo `privacy_accepted` a `UserProfileUpdate`
- Endpoint `PUT /auth/me` salva `privacy_accepted` e `privacy_accepted_date`

---

### Da Testare (Prossima sessione)
- [ ] Login come coach → modale privacy appare
- [ ] Login come dirigente → modale privacy appare
- [ ] Login come atleta adulto (18+) → modale privacy appare
- [ ] Login come genitore con atleta in prova → workflow privacy/rinuncia
- [ ] Firma e conferma → salvataggio in DB verificato

### Pending Issues
1. **P2**: Parent login non funzionante
2. **P2**: @expo/vector-icons non renderizza su web

### Upcoming Features
1. **P1**: Firma privacy genitore a fine periodo prova
2. **P1**: Firma privacy per maggiorenni (atleti, coach, dirigenti)
3. **P2**: Season renewal workflow
4. **P3**: Refactor server.py into modular routes
---

## Session 2026-02-24 - Flusso Privacy GDPR-Compliant per Atleti

### Implementazioni Completate ✅

1. **Backend - Endpoint GDPR Cancellazione Dati**
   - **Nuovo Endpoint**: `DELETE /api/auth/delete-my-data`
   - Cancella: user, athlete record, signed_documents, receipts, notifications, certificates
   - Risposta con conteggio elementi eliminati
   - Conforme GDPR con log delle operazioni
   - **File**: `/app/backend/server.py` linee 11475-11552

2. **Backend - Miglioramento /auth/me per Atleti**
   - Ora restituisce `trial_end_date` da collezione athlete
   - Restituisce `date_of_birth` da collezione athlete se mancante in user
   - Restituisce `privacy_accepted` da athlete se non presente in user
   - **File**: `/app/backend/server.py` linee 1348-1383

3. **Frontend - Flusso Fine Prova Atleta Adulto**
   - Componente `TrialEndModal` già esistente collegato al profilo atleta
   - Modal con due scelte: "Voglio Restare" (privacy) o "Non Voglio Continuare" (cancellazione dati)
   - Al click "Accetta": alert certificato medico → firma privacy
   - Al click "Elimina": chiamata DELETE endpoint → logout
   - **File**: `/app/frontend/app/athlete/profile.tsx`

4. **Frontend - Correzione Errori Build**
   - Aggiunta variabile di stato `isAdult` mancante
   - Corretti riferimenti a variabili non definite (`profile` → `profileData`)
   - **File**: `/app/frontend/app/athlete/profile.tsx`

5. **Frontend - Miglioramento Privacy Sign per Atleti**
   - Firma privacy ora usa endpoint `/documents/sign` per generare PDF
   - PDF firmato + email + archivio (come per Coach/Dirigente/Collaboratore)
   - **File**: `/app/frontend/app/athlete/profile.tsx`

### Test Results ✅
- `/app/test_reports/iteration_16.json` - 11/11 test passati (backend)
- GDPR DELETE endpoint: Verificato corretto funzionamento
- /auth/me: Restituisce trial_end_date e date_of_birth per atleti

### Credenziali Test
- **Atleta Adulto Test**: `adult.athlete@test.com` / `Test1234`
- **Admin**: `test.admin@test.com` / `Test1234`
- **Codice Invito**: `BUZHB0WT`

### Note
- Il flusso privacy per Staff (Coach, Dirigente, Collaboratore) era già implementato correttamente
- Il modal TrialEndModal si attiva solo quando `trial_end_date` è scaduta e `privacy_accepted` è false

---

## PROSSIMI TASK AGGIORNATI

### P1 - Priorità Alta
1. **Flusso Fine Prova per Genitori** (Parent di minori)
   - Applicare stessa logica del flusso atleti adulti
   - Trigger al termine dei 7 giorni di prova dell'atleta

### P2 - Medio termine  
- Stabilizzare modulo "PRO"
- Integrazione Stripe per piani premium
- Logica Freemium con upgrade prompts

### P3 - Backlog
- Refactoring `server.py` in struttura modulare (routers, services, models)
- Fix @expo/vector-icons rendering web

---

## Last Updated
2026-02-24: Implementato flusso GDPR per atleti adulti con cancellazione dati

---

## Session 2026-02-24 - Bug Fix Coach Registration & Scanner

### Bug Risolti ✅

1. **Bug A - Documento Duplicato €5.000**
   - **Problema**: Alla registrazione coach, quando si supera la soglia €5.000, venivano creati 2 documenti: uno con mese (es. "Ottobre 2025") e uno senza (solo "2025")
   - **Causa**: Codice duplicato nel backend che generava il documento due volte
   - **Soluzione**: Rimosso il blocco di codice duplicato (linee 7494-7544) che generava il secondo documento
   - **File**: `/app/backend/server.py`

2. **Bug B.1 - Mancava Freccia Ritorno Scanner**
   - **Problema**: Nella schermata Scanner Presenze (sia pagina iniziale che con camera aperta) mancava la freccia per tornare indietro
   - **Soluzione**: Aggiunto pulsante con icona `arrow-back` nell'header che torna alla tab "Squadre"
   - **File**: `/app/frontend/app/coach/index.tsx`

3. **Bug B.2 - Pulsanti Sovrapposti con Camera Aperta**
   - **Problema**: Quando la camera è aperta, il pulsante verde "Start Camera" della libreria html5-qrcode si sovrappone al pulsante "Chiudi Scanner"
   - **Soluzione**: Aggiunto CSS con padding-bottom e margin-bottom per separare gli elementi
   - **File**: `/app/frontend/app/coach/index.tsx`

4. **Bug B.3 - Istruzioni Permesso Fotocamera Migliorati**
   - **Problema**: Il suggerimento per memorizzare il permesso fotocamera era troppo generico
   - **Soluzione**: Aggiunto box dettagliato con due metodi:
     - Metodo 1: Dalle impostazioni del telefono (Impostazioni → App → Chrome → Fotocamera → Consenti sempre)
     - Metodo 2: Dalle impostazioni del browser
   - **File**: `/app/frontend/app/coach/index.tsx`

### Test Risultati
- Backend riavviato correttamente
- Hot reload frontend attivo


---

## LINEE GUIDA UI/UX DA RICORDARE

### 1. Date - Formato Italiano
- **SEMPRE** usare formato `gg/mm/aaaa` (es. 01/09/2025)
- **MAI** usare formato ISO americano `yyyy-mm-dd`
- Quando si carica una data dal backend (ISO), convertirla subito in italiano
- Quando si salva, convertire da italiano a ISO per il backend
- **EVITARE** `new Date()` per il parsing - causa problemi di timezone. Usare split diretto della stringa.

### 2. Campi Valuta (€)
- Quando l'utente clicca su un campo con valore "0", **azzerare il campo** per facilitare l'input
- Usare `selectTextOnFocus={true}` per selezionare tutto il testo
- Usare `onFocus` per cancellare se valore è 0:
  ```jsx
  onFocus={() => { if (value === '0') setValue(''); }}
  ```

### 3. Placeholder
- Date: `gg/mm/aaaa`
- Valute: `0.00`

---


---

## Session 2026-02-24 - Bug Fix Collaboratori (P0)

### Bug Critici Risolti ✅

1. **Bug A - Privacy Modal Loop** (profile.tsx)
   - **Problema**: Il modal della privacy riappariva continuamente anche dopo la firma
   - **Causa**: La variabile `isPrivacyAccepted` non era definita, causava comportamento imprevedibile
   - **Soluzione**: Definita correttamente: `const isPrivacyAccepted = data.privacy_accepted === true`
   - **File**: `/app/frontend/app/collaboratore/profile.tsx` linea 176

2. **Bug B - Dati Profilo Non Salvati** (server.py)
   - **Problema**: Il campo `collaboratore_license_number` non veniva salvato nel backend
   - **Soluzione**: Aggiunto campo `collaboratore_license_number` al modello `UserProfileUpdate` e relativo handler
   - **File**: `/app/backend/server.py` linee 1431, 1483-1484

3. **Bug C - Scroll Bloccato nel Modal Firma Quietanze** (compensation.tsx)
   - **Problema**: Nel modal delle quietanze mensili, l'utente non riusciva a scrollare per raggiungere il pulsante "Conferma"
   - **Causa**: Il contenitore usava `<View>` invece di `<ScrollView>`
   - **Soluzione**: Sostituito `<View>` con `<ScrollView>` con i pulsanti fissi in basso
   - **File**: `/app/frontend/app/collaboratore/compensation.tsx` linee 995-1016

4. **Bug Fix Minore - Format API Response** (compensation.tsx)
   - **Problema**: `recordsRes.data` era un oggetto `{records: []}` ma il codice si aspettava un array
   - **Soluzione**: Estratto correttamente `recordsRes.data.records` con fallback ad array vuoto
   - **File**: `/app/frontend/app/collaboratore/compensation.tsx` linee 212-219

### Test Results
- `/app/test_reports/iteration_17.json` - 100% Backend (14/14), 100% Frontend verificato
- Tutti e 4 i bug confermati risolti dal testing agent

### Credenziali Test Collaboratori
- **Collaboratore Lara**: `lara@test.com` / `Collab2025`
- **Collaboratore Iva**: `iva@test.com` / `Collab2025`
- **Admin**: `test.admin@test.com` / `Test1234`

---

## Issue Backlog Aggiornato

### P0 - Completati ✅
- Bug Privacy Modal Loop → FIXED
- Bug Dati Non Salvati → FIXED
- Bug Scroll Modal Quietanze → FIXED

### P1 - Da Fare
- Applicare logica "fine periodo prova" per Genitori (come Atleti)
- Fix icone `@expo/vector-icons` che non si caricano sul web

### P2 - Backlog
- Compensi: mostrare solo mesi del periodo contratto (non tutti i 12 mesi)
- Stabilizzare modulo "PRO"

### P3 - Futuro
- Integrazione Stripe per piani premium
- Logica Freemium con prompt upgrade
- Refactoring `server.py` in struttura modulare

---

---

## Session 2026-02-24 (Sera) - Completamento Collaboratori + Riorganizzazione

### Bug Critici Risolti ✅
1. **Firma Quietanza non funzionante** - Aggiunta costante `MONTH_NAMES` mancante + fix funzione PDF
2. **Palestre non memorizzate** - Aggiunto `assigned_venues` all'endpoint GET `/users/{id}`
3. **Totale quota squadre non aggiornato** - Calcolo dinamico dalla somma delle rate

### Nuove Funzionalità ✅
1. **Sezione "I Miei Documenti"** nel profilo collaboratore
2. **Layout pulsante "Il Mio Profilo"** su due righe
3. **Password visibile** nel reset collaboratore
4. **Logica ri-accettazione compenso** quando l'importo cambia (per tutti: coach, dirigenti, collaboratori)
5. **Box "Già Percepito"** nelle pagine admin (somma quietanze firmate)
6. **Campi da Gioco / Palestre** nelle impostazioni società
7. **Dropdown palestre** nella pagina squadra (invece di testo libero)
8. **Assegnazione Squadre + Palestre** ai collaboratori
9. **Sezione "Quietanze Firmate"** in evidenza (verde)

### Miglioramenti UX ✅
1. **Province a 2 caratteri** con conversione automatica maiuscolo
2. **Provincia di nascita** aggiunta al Dirigente
3. **Frecce di ritorno** più visibili (sfondo bianco + icona blu)

### Riorganizzazione Impostazioni ✅
La pagina Impostazioni è ora divisa in due sotto-pagine:
- `/admin/settings` - Pagina principale con 2 pulsanti
- `/admin/settings/society` - Dati società, logo, fiscali, timbro
- `/admin/settings/other` - Ruoli, caratteristiche, qualifiche, palestre

### File Creati
- `/app/frontend/app/admin/settings/index.tsx`
- `/app/frontend/app/admin/settings/society.tsx`
- `/app/frontend/app/admin/settings/other.tsx`

### Test Effettuati ✅
- Test atleta maggiorenne: `/app/test_reports/iteration_18.json` - PASSED
- Test collaboratori: `/app/test_reports/iteration_17.json` - PASSED

---

## Session 2026-02-25 - Miglioramento UI Icone Header

### Miglioramenti Completati ✅

1. **Icone Header Dashboard Admin più Visibili**
   - Tutte le icone nella barra header (🔔 notifiche, 💼 dirigente, ⚙️ impostazioni, 🚪 logout) ora hanno:
     - Sfondo bianco circolare (40x40px)
     - Ombra per maggiore contrasto
     - Bordo arrotondato (borderRadius: 20)
   - L'ingranaggio delle impostazioni ora è **molto più visibile** sullo sfondo blu
   - **File modificato**: `/app/frontend/app/admin/index.tsx`

2. **Pulizia File Obsoleto**
   - Eliminato `/app/frontend/app/admin/settings_old.tsx.bak`

### Struttura Impostazioni Confermata ✅
La nuova struttura delle impostazioni funziona correttamente:
- `/admin/settings` → Pagina indice con 2 pulsanti
- `/admin/settings/society` → Dati società
- `/admin/settings/other` → Altre impostazioni (ruoli, palestre)

---

## Da Testare Domani
- [ ] Flusso completo atleta maggiorenne (registrazione → approvazione → profilo → privacy)
- [ ] Flusso genitore + atleta minorenne

## Prossimi Passi (Pubblicazione Store)
1. Account Apple Developer ($99) + Google Play ($25)
2. Privacy Policy su URL pubblico
3. Screenshot app
4. Build production con Expo EAS
5. Submit agli store

---
