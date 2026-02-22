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
2026-02-22: Archivio Documenti Firmati completato + rimozione email alla società

## Session 2026-02-22 - Archivio Documenti Firmati

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
   - **Privacy (Archivio + Email al firmatario)** - DA IMPLEMENTARE:
     - Atleta/Genitore: firma alla fine del periodo prova
     - Coach/Dirigente/Collaboratore: firma all'iscrizione

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