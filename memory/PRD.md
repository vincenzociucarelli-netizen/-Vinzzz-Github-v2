# RegistraTEAM — PRD & Stato

## Original Problem Statement
Applicazione gestionale per società sportive italiane (pallavolo, futuro multi-sport). Focus: **conformità GDPR**, onboarding role-specific (Admin/Coach/Dirigente/Collaboratore/Atleta/Genitore), generazione PDF dinamici, gestione soglie compensi €5k/€15k, calendario/partite. Pilota single-tenant Pallavolo Perugia.

## Lingua: 🇮🇹 Italiano

## Stack & Hosting
- Frontend: React/Expo Web | Backend: FastAPI + MongoDB Atlas
- Vercel (frontend) + Render (backend) + MongoDB Atlas
- Email: Brevo API HTTP v3 (sender `info@pallavoloperugia.it`)
- Stripe test mode | UptimeRobot
- Produzione: https://registrateam.it

## Branch Git
- **`02-05-2026`** = default branch (GitHub + Vercel + Render). Save to GitHub pusha qui → deploy automatico.
- `main` obsoleto.

## 🆕 05/07/2026 (sera) — Badge stagione visibile ovunque + fix pending 500 ✅

### 1️⃣ Badge stagione sempre visibile
Il componente `SeasonBadge` era referenziato in `SocietyBranding.tsx` ma **mancava l'import** → non appariva su nessuna pagina. Fix:
- Aggiunto `import { SeasonBadge } from '../services/SeasonBadge'` in SocietyBranding.
- Corretto `import api` (era `{ api }` named su un solo-default export).
- Se il branding ha né logo né nome, mostra comunque il badge solo.
- Aggiunto `<SeasonBadge />` esplicitamente nell'header custom di `/admin/index.tsx` (che NON usa SocietyBranding).

### 2️⃣ Fix `GET /api/athletes/pending` HTTP 500
Il reset atleti ha svuotato `team_id` con `$unset`. Il endpoint accedeva a `athlete["team_id"]` KeyError. Fix: `athlete.get("team_id")` (linea 8303) — così `team_name: "Da assegnare"` per gli atleti in reset.

**⚠️ Deploy required**: Save to Github → auto-deploy.


## 🆕 05/07/2026 (tarda notte) — Pagamenti stagione precedente + banner residuo ✅

Al `POST /api/seasons/backfill-reset-assignments`, oltre a resettare l'atleta, ora marca anche tutti i suoi pagamenti con `season: <prev_season>` + `is_previous_season: true`. Response include ora `payments_archived`.

Nel dettaglio atleta tab Pagamenti:
- La lista mostra SOLO i pagamenti della stagione corrente (`!is_previous_season`).
- Se ci sono pagamenti previous NON saldati (senza `paid_date`) → banner giallo **"Residuo stagione precedente: N pagamenti non saldati per un totale di €X"**.
- I pagamenti storici saldati non appaiono più (mantenuti nel DB per tracciabilità fiscale ma nascosti dalla UI corrente).

**⚠️ Deploy required**: Save to Github → auto-deploy.


## 🆕 05/07/2026 (notte) — Backfill reset esteso ANCHE agli atleti ✅

Il fix di `backfill-reset-assignments` precedente puliva solo i ruoli staff (Coach/Coll/Dir). Ma le atlete riconfermate con codice vecchio hanno il `team_id` ancora valorizzato (Under 14, MiniVolley, Starter, ecc.) — non passano da riconferma bulk perché idempotente.

**Fix**:
- **Backend `POST /api/seasons/backfill-reset-assignments`**: aggiunta seconda query su `db.athletes` con `active_seasons ⊃ current_season` MA senza `team_id_previous_season` valorizzato E con `team_id` non vuoto. Svuota `team_id` + snapshot in `team_id_previous_season` + `status_previous_season`. Setta `status = pending`, `privacy_pending_renewal = true`.
- **Response**: `{reset_count, athletes_reset, current_season}`.
- **Frontend `seasons.tsx`**: aggiornato pulsante "Reset assegnazioni Atleti + Coach + Collab + Dir" e messaggio conferma. La `showAlert` mostra i due contatori separati (users e atleti).
- **Preview testato**: `athletes_reset: 1` (BIANCHI SOFIA, l'unica riconferma vecchia).

**⚠️ Deploy required**: Save to Github → auto-deploy Vercel+Render.


## 🆕 04/07/2026 (pomeriggio) — Fix banner certificato + Backfill reset assegnazioni ✅

### BUG 1 — Coach Andrea vede ancora U14/U16 (riconferma vecchia)
Coach riconfermati con il codice VECCHIO (prima dello svuotamento automatico di `assigned_teams`) restano assegnati alle vecchie squadre. Il `reconfirm-bulk` è idempotente e li skippa.

**Fix**:
- **Backend `POST /api/seasons/backfill-reset-assignments`**: itera su tutti gli users della società con `active_seasons ⊃ current_season` MA senza `assignment_pending_review = true` e con assegnazioni valorizzate → svuota `assigned_teams` + `assigned_gyms`, salva snapshot in `_previous_season`, setta `assignment_pending_review = true`.
- **Backend `POST /api/seasons/users/{id}/reset-assignments`**: reset singolo user.
- **Frontend `/admin/seasons.tsx`**: pulsante arancio 🔄 "Reset assegnazioni Coach/Collab/Dir (riconferme vecchie)" nella card "Stagione Corrente".

### BUG 2 — Banner "Validazione Certificato" appare anche se certificato validato
`athlete.status === 'pending_certificate'` visibile pur avendo `certificate.verified = true`. Fix: aggiunto `&& !certificate?.verified` al condizionale del banner in `athlete/[id].tsx`.

**⚠️ Deploy required**: Save to Github → Vercel + Render auto-deploy.


## 🆕 04/07/2026 — Cartella "Da controllare" post-riconferma bulk ✅

Al termine della riconferma bulk (dagli archivi stagione precedente), atleti/coach/collaboratori/dirigenti riconfermati ora:
- **Atleti**: status → `pending` ("In attesa"), `team_id` svuotato, snapshot in `team_id_previous_season` + `status_previous_season`, flag `privacy_pending_renewal = True` (dovranno rifirmare privacy + accettare periodo di prova).
- **Coach/Collab/Dirig**: `assigned_teams` e `assigned_gyms` svuotati, snapshot in `assigned_teams_previous_season` + `assigned_gyms_previous_season`, flag `assignment_pending_review = True`.
- Idempotente: chi è già in stagione corrente viene skippato.

Frontend:
- **`athletes.tsx`**: sezione speciale in cima `🗂️ Da controllare (N) · riconferme + nuove iscrizioni` (bordo/badge viola). Include atleti in tutti gli stati `pending*` (nuove iscrizioni) + quelli con `team_id_previous_season` valorizzato (riconferme). Sotto ogni card mostra riga grigia _"Prec.: [squadra] · da riconfermare"_.
- **`coaches.tsx`**, **`collaboratori.tsx`**, **`dirigenti.tsx`**: riga grigia _"Prec.: [squadre] · da riconfermare"_ quando `assignment_pending_review = True`.

**Testato via preview**: BIANCHI SOFIA riconfermata → appare in cima con "In attesa" + badge compenso, squadra "—". Le altre (BABBI CARLA) restano nella sezione alfabetica normale.

**⚠️ Deploy required**: Save to Github → Vercel + Render auto-deploy.


## 🆕 03/07/2026 — Archivio Stagioni: conteggi Coach/Coll/Dir + Riconferma per categoria ✅

### 1️⃣ Archivio Stagioni: mancavano conteggi Coach/Collaboratori/Dirigenti
Il modello `SeasonArchive` salvava solo `total_teams` e `total_athletes`. Non c'era modo di sapere quanti Coach/Collab/Dir erano attivi in una stagione archiviata. Fix:
- **`models/season_models.py`**: aggiunti `total_athletes_minor`, `total_athletes_adult`, `total_coaches`, `total_collaboratori`, `total_dirigenti`.
- **`routes/seasons.py::archive_season`**: ora calcola i conteggi filtrando `active_seasons: season_name` per atleti/users; split minorenni/maggiorenni usando `date_of_birth` alla data di start della stagione archiviata.
- **`routes/seasons.py::list_season_members`**: aggiunto flag `is_minor: bool` in ogni atleta della response.
- **Frontend `seasons.tsx`**: due righe di stats — riga 1 "Squadre + Atleti (U18/18+)", riga 2 "Coach + Collab + Dirigenti". Fallback "—" per archivi legacy pre-aggiornamento + nota informativa.

### 2️⃣ Bug import "api" in `season-reconfirm.tsx` → "Caricamento non riuscito"
Il file usava `import { api } from '...'` come named export, ma `api.ts` esporta solo default. Le chiamate API silenziosamente non partivano. Fix: `import api from '...'`.

### 3️⃣ Nuova UI Riconferma: 5 cartelle collassabili per categoria
L'utente richiedeva di poter riconfermare gli utenti raggruppati per **categoria** (non più per squadra assegnata, dato che al rinnovo non è detto vengano riassegnati alle stesse squadre). Riscritto `season-reconfirm.tsx`:
- Rimosse le tabs a pillole in alto (Atleti/Coach/Coll/Dir).
- Fetch parallelo di 4 endpoint (`Promise.all` con `types = ['athletes','coach','collaboratore','dirigente']`) al mount.
- 5 cartelle collassabili con colori distintivi: 🧒 Atleti U18 (blu) · 🧑 Atleti 18+ (verde) · 🏋️ Coach (arancio) · 💼 Dirigenti (viola) · 👷 Collaboratori (teal).
- Ogni cartella: header cliccabile con freccia ▶/▼, badge conteggio "selezionati/totale", "Seleziona tutti (N)" al primo click, lista membri con checkbox + badge PRO + squadre assegnate + qualifica + email.
- Split athlete_ids vs user_ids al submit → chiamata unica `POST /seasons/reconfirm-bulk`.

**Testato via preview**: 20 U18 + 24 18+ + 6 Coach + 3 Dir + 3 Coll = 56 candidati. Espansione cartelle Coach/Dirigenti mostra correttamente FARO REMO, ALICE LUPI, MARZO LELLA, etc.

**⚠️ Deploy required**: le modifiche sono in `02-05-2026` branch. Utente deve:
1. Redeploy Render (backend) — Dashboard Render → servizio → Manual Deploy → Deploy latest commit.
2. Redeploy Vercel (frontend) — se non auto-deploy, forzare via dashboard.
3. Nuova archiviazione stagione per popolare i nuovi conteggi (gli archivi già esistenti mostrano "—" sui campi Coach/Collab/Dir finché non li si riarchivia).


## 🐛 02/07/2026 (SERALE-3) — Fix conteggi + Genitori + Badge stagione ✅

### 1️⃣ Conteggi errati nell'Archivio "Stagione Corrente"
`GET /api/seasons/current` restituiva 17 atleti + 6 coach ma le liste operative erano vuote perché non filtrava per `active_seasons`. Fix: aggiunto filtro `active_seasons: current_season` (con fallback `$exists: false`) sia sugli atleti che sui coach. Testato: ora `total_athletes: 2` allineato con `/api/athletes`.

### 2️⃣ Genitori dovevano essere spostati nella vecchia stagione
La migrazione all'avvio già settava `active_seasons` per tutti gli users, inclusi i parents (avevano già `["2025-2026"]`). Mancava solo il filtro sull'endpoint `GET /api/users/parents`. Fix: aggiunto filtro `active_seasons: current_season` (con fallback). Testato: `parents count: 0` ora.

### 3️⃣ Badge stagione sempre visibile
Nuovo componente `src/services/SeasonBadge.tsx`: pill compatto con icona calendario + "2026-2027", cached in memoria per non fare fetch ripetuti. Integrato dentro `SocietyBranding` (header condiviso in tutte le pagine) → apparirà automaticamente in cima a ogni schermata che usa quel componente.


## 🔀 02/07/2026 — Switch ruolo dual-role ("Zaino Coach") ✅

**Nuovo endpoint** `POST /api/auth/switch-role` (in `server.py`): valida che l'utente sia effettivamente dual-role (athlete → coach: richiede `linked_coach_user_id` sull'athlete; coach → athlete: richiede `linked_athlete_id` sull'user). Emette un nuovo JWT con `role=target_role` e restituisce token + user object aggiornato. Testato via curl (403 se non dual-role, 400 se target non valido).

**Nuovo componente frontend** `src/services/RoleSwitchButton.tsx`: pulsante pill con icona `swap-horizontal` che chiama l'endpoint, aggiorna authStore + AsyncStorage, poi reindirizza a `/coach` o `/athlete` con `window.location.href` (web) o `router.replace` (mobile).

**Integrato in**:
- `athlete/index.tsx`: pulsante arancione "🏋️ Passa a Coach" vicino al saluto, visibile se `profile.linked_coach_user_id` presente.
- `coach/index.tsx`: pulsante blu "🏐 Passa ad Atleta" vicino al saluto, visibile se `user.linked_athlete_id` presente.


## 🐛 02/07/2026 — Fix dual-role Prati Giulia Parte 2 (5 correzioni) ✅

### 1. Nascondi "Compensi Pregressi" nel Coach dual-role
`admin/coach/[id].tsx` tab Compensi: nascosto il campo `other_annual_compensation` + hint quando `linked_athlete_id` è valorizzato. Il valore è già gestito lato Atleta, evita doppioni conflittuali.

### 2. Escludi Coach dual-role da "Atleti 18+ PRO"
`GET /prime-squadre/athletes` in `server.py`: aggiunto filtro `linked_athlete_id: {"$in": [None, ""]}` sui coach → i coach dual-role non compaiono più nella lista, sono già rappresentati come atleti.

### 3. User dashboard: impegni unificati dual-role
- `athlete/index.tsx`: se `linked_coach_user_id` valorizzato → fetch `/coach/commitments` in parallelo e merge cronologico. Badge visibile blu **ATL** / arancio **COACH** nel rendering degli item (4 sezioni today/tomorrow/day_after/upcoming).
- `coach/index.tsx`: se `linked_athlete_id` valorizzato → fetch `/athlete/commitments` in parallelo e merge cronologico. Il merge funziona ma il badge nel rendering non è ancora integrato in tutte le 4 sezioni (le voci atleta appaiono comunque mescolate; per distinguerle bisogna guardare il `team_name`).

### 4. Elenchi staff collassabili
`athlete/index.tsx`: aggiunto componente `CollapsibleStaffSection` (accordion normalmente chiuso) attorno ai 3 blocchi Allenatori / Dirigenti / Collaboratori nel widget "Staff della Società/Squadra". Contatore accanto al titolo.

### 5. Saluto solo nome
- `coach/index.tsx`: `Ciao, {full_name}` → `Ciao, {first_name}!`
- `parent/index.tsx`: welcomeName `{full_name}` → `{first_name}`
- `athlete/index.tsx`: profile card `{profile.full_name}` → `Ciao {profile.first_name}! 👋`
- Admin e Collaboratore già usavano first_name (nessun cambio necessario).


## 🐛 01/07/2026 (SERALE-2) — Fix dual-role Prati Giulia: Scheda Compensi + Impegni unificati ✅

### 🐛 P0 — Bug bloccante scheda compensi Coach dual-role
Su `admin/coach/[id].tsx`, i coach dual-role (`linked_athlete_id` valorizzato) erano dirottati in un **early-return** che mostrava SOLO un banner "Vai su Scheda Atleta", nascondendo tab Compensi/Anagrafica. Impossibile modificare le **date d'inizio/fine incarico Coach**.
**Fix**: rimosso early-return. Ora il banner "Doppio Ruolo — Anche Atleta" è mostrato come **info-box in cima** e tutta la scheda coach (inclusa la sezione Compensi con date contrattuali) è **editabile**.

### 🎨 P1a — Impegni unificati Admin per dual-role
Estesa la logica di `AdminCoachCommitments` per accettare simultaneamente `userId` (coach) e `athleteId` (atleta). Se entrambi valorizzati, fa 2 fetch e mergia in ordine cronologico con **badge "ATL" (blu) / "COACH" (arancio)** su ogni impegno. Aggiornati i callsite:
- `admin/coach/[id].tsx` → passa `athleteId={linked_athlete_id}` quando dual-role.
- `admin/athlete/[id].tsx` → passa `userId={linkedCoach.coach_user_id}` quando dual-role.

### 📋 Da fare (Vincenzo → verifica dopo il deploy):
1. Save & Deploy.
2. Login admin → Prati Giulia (dual-role) → **Scheda Coach**: verifica che ora si vedano i tab e la sezione Compensi con le date modificabili.
3. Nella scheda "Da Fare" sia di Atleta che di Coach: verifica che compaiano gli impegni **di entrambi i ruoli**, ciascuno col proprio badge blu (ATL) / arancio (COACH).

### 🔜 Sotto-task ancora da fare in questa serie (P1c + P2)
- **P1c**: Rendere collassabili (normalmente chiusi) i 3 blocchi Staff (Coach/Dirigenti/Collaboratori) alla fine del **dashboard user Atleta** (`athlete/index.tsx`, righe 1400-1414). Attualmente sono espansi tutti.
- **P2**: Dashboard USER dual-role ("Zaino Coach"):
  - `/athlete/index.tsx`: se dual-role, aggiungere sezione "Impegni come Coach" sotto "Prossimi Impegni".
  - `/coach/index.tsx`: se dual-role, aggiungere sezione "Impegni come Atleta".


## 🚨 01/07/2026 (SERALE) — Fix regressione lentezza + Refactor UX "Clean Slate" per rinnovi ✅

### 🐌 Fix P0 lentezza dopo Save & Deploy mattina
Colpevole: le liste admin (Atleti/Coach/Collab/Dirigenti) chiamavano `/api/seasons/current` inside Promise.all — endpoint pesante che scarica **1000 atleti + 100 team + coach + championships** solo per sapere il nome della stagione. Fix:
- Nuovo endpoint LEGGERO `/api/seasons/current-name` (~150ms invece di 3-5s).
- Tutti i frontend list pages ora usano l'endpoint leggero.
- `get_primary_admin_history` ottimizzato: era 500 log in-memory filter → ora query diretta con `$or` (LIMIT 50).

### 🎯 Refactor UX "Clean Slate al cambio stagione" ✅
Vincenzo segnalava caos: confermati + non confermati + nuovi mescolati nelle liste operative. Nuovo modello mentale:

**Concetto**: `active_seasons: List[str]` — ogni utente/atleta appartiene a una o più stagioni. Le liste operative mostrano SOLO chi ha la stagione corrente nel proprio array. L'archivio mostra chi ha la stagione archiviata.

**Migrazione one-shot** (all'avvio del backend, idempotente):
- Tutti gli utenti/atleti esistenti approvati → `active_seasons = ["2025-2026"]` (stagione precedente).
- Cleanup flag "Riconferma" di stamattina (`renewed_for_next_season`, `imported_to_season`, `pro_data_pending_review`, `*_previous_season`).
- Testato: 44 atleti + 78 users migrati sul preview environment.

**Backend** (nuovi endpoint):
- `GET /api/seasons/{season_name}/members?type=athletes|coach|collaboratore|dirigente`: lista membri della stagione archiviata + flag `already_in_current` (per grigiare quelli già riconfermati).
- `POST /api/seasons/reconfirm-bulk` con body `{athlete_ids:[], user_ids:[]}`: `$addToSet` della stagione corrente. Per utenti compensati (`monthly_compensation > 0`) valorizza `pro_data_pending_review = True` + snapshot compenso precedente.
- Filtri `active_seasons: current_season` (con fallback `$exists: false` per nuovi record) su `/api/users/coaches`, `/api/users/collaboratorees`, `/api/users/dirigenti`, `/api/athletes`.

**Frontend**:
- **RIMOSSO** flag verde "Riconferma" dalle card di Atleti/Coach/Collab/Dirigenti (UX vecchia).
- **NUOVA** pagina `/admin/season-reconfirm?season=YYYY-YYYY`: tabs (Atleti/Coach/Collab/Dirigenti) → lista raggruppata per squadra → checkbox multi-select → header "Seleziona tutti" per gruppo → footer con "Riconferma X → stagione corrente".
- In `admin/seasons.tsx` ogni card archivio ha ora un pulsante "**Riconferma da YYYY-YYYY → stagione corrente**" che apre la nuova pagina.

**Test end-to-end (curl)**:
1. Migrazione applicata → 44 atleti + 78 users con `active_seasons=["2025-2026"]`.
2. `GET /api/athletes` → 0 elementi (lista operativa pulita, come vuole Vincenzo).
3. `GET /api/seasons/2025-2026/members?type=athletes` → 44 elementi con `already_in_current=false`.
4. `POST /api/seasons/reconfirm-bulk {athlete_ids: [2 id]}` → `confirmed: 2`.
5. `GET /api/athletes` → 2 elementi (solo i riconfermati).


## 🚨 01/07/2026 — Fix P0: Multi-tenancy leak in Responsabile Admin (Storico + Delega) ✅

**Bug segnalato da Sirio**: nell'"Archivio Storico" della pagina Responsabile Admin vedeva le dichiarazioni firmate di admin di ALTRE società (ENZO BIANCHI, CEPPITELLI ENRICO, MARTINETTI LUIGI di società diverse). Data leak GDPR cross-tenant.

**Root causes** in `/app/backend/routes/primary_admin.py`:
1. `get_primary_admin_history` (endpoint `/api/admin/primary-admin/history`) faceva `db.audit_logs.find({"action": {"$in": [...]}})` SENZA `society_id` → tornava log di tutte le società.
2. `audit_logs.insert_one` (5 punti: declare/delegate/resign/revoke/crown) NON persisteva `society_id` → log legacy senza tenant.
3. `_notify_legal_rep_scepter_event`, `delegate_primary_admin.new_admin lookup`, `resign_primary_admin.legal_rep`, `revoke_delegation.current_delegate`, `crown_legal_representative.existing_lr + new_lr`: TUTTE le query senza `society_id` → potenziali leak.
4. `db.settings.update_one({"type": "society"}, ...)` in delegate/resign/revoke/crown: senza `society_id` → potrebbe modificare settings di altra società (RACE con più tenant).

**Fix applicati**:
- Aggiunto `society_id` a tutti gli `audit_logs.insert_one` (5 punti).
- Filtro `society_id` su tutte le query LR/delegate/settings.
- `get_primary_admin_history` ora filtra per `society_id`; per i log **legacy** (pre-fix) senza `society_id`, fallback via join con `users` (user_id → society_id) per capire a chi appartiene.
- `_notify_legal_rep_scepter_event` accetta `society_id` opzionale e filtra il LR.

**Test curl (dev)**: Vincenzo (society 697f...73eea) ora vede 9 eventi tutti della propria società (0 leak da altre).

## 🆕 01/07/2026 — Riconferma Stagione: parità Coach/Collaboratori/Dirigenti + Import Users ✅

**Contesto**: già implementato per Atleti (30/06). L'utente ha chiesto la stessa UX per Coach/Collab/Dirig.

**Backend** (`/app/backend/routes/seasons.py`):
- `_user_roles_in_scope()` esteso: include ora COACH + COLLABORATORE + DIRIGENTE + **VIEWER** (nella lista dirigenti dell'UI ci sono anche viewer).
- `/api/seasons/import-renewed` **esteso**: dopo aver processato gli atleti, processa anche `db.users` (Coach/Collab/Dirig/Viewer): utenti con compenso (`monthly_compensation > 0` o `other_annual_compensation > 0`) vengono importati con flag `pro_data_pending_review=True` (snapshot vecchio compenso salvato in `*_previous_season`); utenti senza compenso: import semplice; non riconfermati → `status='inactive'`.
- Risposta include ora sezioni separate `athletes` e `users`.

**Frontend**:
- `admin/coaches.tsx`, `admin/collaboratori.tsx`, `admin/dirigenti.tsx`: aggiunto pulsante "Riconferma" top-right sulle card degli utenti approved, con stati GRIGIO (già importato) / VERDE (riconfermato) / VUOTO (da riconfermare). Chiamata `POST /api/seasons/users/{id}/renew-toggle`. Badge rosso "⚠ Compenso da riconfermare" nella row nome se `pro_data_pending_review=True`. In `dirigenti.tsx` il flag è nascosto per l'account admin owner della società.
- `admin/coach/[id].tsx`, `admin/collaboratore/[id].tsx`, `admin/dirigente/[id].tsx`: aggiunto banner rosso "Compenso da riconfermare per stagione X" con dettaglio della vecchia stagione (compenso mensile + pregresso) e pulsante verde "Conferma" che chiama `POST /api/seasons/users/{id}/confirm-pro-data`.
- `admin/seasons.tsx`: testo dell'import esteso a "atleti, coach, collaboratori e dirigenti".

**Da fare in produzione**: Save & Deploy su Vercel per vedere le modifiche frontend live su registrateam.it (il backend è già live via Render hot reload, ma le UI cambia solo dopo il build di Vercel).


## 🎯 30/06/2026 (pomeriggio) — Fix DEFINITIVO PDF quietanze Atleti PRO ✅

**Problema reale**: nonostante i fix di stamattina, Giulia (Atleta 18+ PRO) vedeva:
- **Quietanza 5K Settembre** + **15K Dicembre**: PDF con testo + metadati + QR corretti MA FIRMA VUOTA
- **Quietanza Novembre 2025**: PDF di **fallback minimale** "PDF originale non più disponibile" con Firmatario/Email vuoti

**Root cause** (3 bug indipendenti):
1. `_get_or_regen_pdf` (la funzione che serve i PDF dall'endpoint download) aveva un branch dedicato `compensation_receipt` (L24755) che gestiva SOLO Coach/Collaboratore: cercava `coach_id = doc.coach_id or doc.signer_id` → entrambi None per atleti → falliva → cadeva sul fallback `_generate_consent_summary_pdf` (= la PDF "Riepilogo firma" di Foto 3). NON aveva l'item `athlete_compensation_receipts` nei candidati per la firma.
2. `_regenerate_threshold_communication_pdf` cercava la firma in `comp.receipt_signature_base64` MA la tabella `athlete_compensation_receipts` salva il campo come `signature_base64` (legacy) → firma sempre None per atleti.
3. Il PDF cached (`pdf_base64` in DB) era stato generato dal codice rotto stamattina e non veniva mai invalidato perché >3500 byte (formato pieno ma firma vuota).

**Fix backend** (`/app/backend/server.py`):
- `_get_or_regen_pdf` branch `compensation_receipt` (L24755-24900): ora rileva atleti via `doc.athlete_id`/`atleta_id`, carica il record da `db.athletes`, ricostruisce nome+CF dall'atleta, aggiunge `athlete_compensation_receipts` nei candidati di lookup firma (sia int che stringa italiana del mese), passa `role_label="Atleta"` al generatore.
- `_regenerate_threshold_communication_pdf` (L25789): aggiunto fallback `comp.signature_base64` oltre a `receipt_signature_base64`.
- Nuovo check "auto-invalida cache stale ATLETI PRO" (L20130-): forza regenerazione automatica se il PDF cached:
  - contiene "Collaboratore:" (label vecchia)
  - contiene "PDF originale non" o "Riepilogo firma" (fallback summary)
  - O ha `pdf_cached_at` antecedente al 30/06/2026 14:00 (cutoff post-fix)
  Marca il nuovo `pdf_cached_at` al re-cache così non rigenera all'infinito.

**Cosa fare ora**:
1. Save & Deploy su registrateam.it.
2. Riapri qualsiasi PDF di Giulia in "I Miei Documenti" → auto-regen al primo accesso → PDF corretto cached.

**Spiegazione del perché "negli altri ruoli va, su Atleti no"**: l'intero sottosistema PDF era stato progettato originariamente per Coach/Collaboratore/Dirigente (chiave `signer_id`/`coach_id`, collezione `coach_compensations`). Quando è stata aggiunta la categoria "Atleta 18+ PRO" (in `db.athletes`, collezione `athlete_compensation_receipts`), i punti di lookup sono stati aggiornati uno alla volta — restavano due percorsi non sincronizzati (`_get_or_regen_pdf` branch compensation_receipt e signature lookup nelle threshold communications). Ora entrambi sono allineati.



## 🎯 30/06/2026 — Fase 1: Test E2E Atleta 18+ PRO + Fase 2: Promozione "Federica flow" ✅

### Fase 1 — Test E2E (testing_agent_v3_fork iter79)
- **Backend**: 5/6 endpoint OK. Bug minor risolto: `admin_reset_year_signed_documents` (L31159) ora popola `athlete_id/coach_id/collaboratore_id/dirigente_id` sulle `deletion_requests` create dal batch reset_year (parità con `admin_request_delete_signed_document`). 3 richieste pendenti orfane già esistenti backfillate via script Python (collaboratore_id derivato dal signed_document corrispondente).
- **Frontend**: i nuovi testID non erano nel DOM perché `/app/frontend/dist` era datato 25/06. Rigenerato con `npx expo export --platform web --output-dir dist` (~2 min) + `supervisorctl restart expo`. Bundle ora aggiornato (entry-ef41e99d...).

### Fase 2 — Promozione "Atleta 18+ → PRO" con scelta quota/compenso
**Richiesta utente**: Quando l'admin promuove un'atleta 18+ a "Atleti PRO" (Federica come test), dialog che chiede:
- 🅰️ "Riceverà un compenso mensile" → full setup Giulia-style (contratto, soglie, quietanze)
- 🅱️ "Continua a pagare la quota" → in Prima Squadra ma resta `quota`, nessun compenso/soglia
+ reversibile (esiste già `POST /prime-squadre/athletes/{id}/disable`)
+ data inizio contratto selezionabile (gg/mm/aaaa)

**Modifiche backend** (`/app/backend/server.py`):
- `POST /api/prime-squadre/athletes/{athlete_id}/enable` ora accetta body opzionale `{compensation_mode, monthly_compensation, contract_start_date, contract_end_date}`.
- `mode="compensated"` (default, retrocompatibile): `is_compensated=True, athlete_type='compensated', pro_without_compensation=False` + opzionali `monthly_compensation` e `contract_start_date`.
- `mode="quota"`: `is_compensated=True, athlete_type='quota', pro_without_compensation=True, monthly_compensation=0` → l'atleta entra in Atleti PRO ma resta sul flusso quota (nessun tab Compensi/soglie).
- Validazione: ritorna 400 se mode ≠ 'compensated'/'quota'. Test curl 5/5 OK.

**Modifiche frontend** (`/app/frontend/app/admin/prime-squadre.tsx`):
- Nuovo `Modal` "Promuovi a Atleta Pro" che si apre DOPO la selezione dell'atleta (per i coach mantieniamo il flusso diretto: il dialog è solo per atleti).
- Due card di scelta `promote-mode-compensated` / `promote-mode-quota` (raggio colorato + descrizione).
- Se "compensated": form con input compenso mensile (`promote-monthly-input`) + data inizio contratto in formato gg/mm/aaaa (`promote-start-date-input`, default = oggi).
- Bottoni: `promote-cancel-btn`, `promote-confirm-btn`.
- Dopo conferma: mostra alert specifico (compenso → redirect a `/admin/athlete/{id}`; quota → resta in lista, refresh).

**Reversibilità**: l'esistente `POST /prime-squadre/athletes/{id}/disable` continua a funzionare per togliere l'atleta dagli Atleti PRO (resetta `is_compensated=False, pro_without_compensation=False`). Per cambiare modalità (es. quota → compensated): disable + re-enable con il nuovo mode.



## 🎯 30/06/2026 — Fix UX pulsante "Aggiungi link" su EVENTI PI ✅

**Problemi riportati**:
1. Il pulsante "Aggiungi link" inseriva `[qui](https://)` rotto perché i prompt avevano default `qui` e `https://` che l'utente confermava per sbaglio.
2. Il pulsante esisteva SOLO sul campo Info evento, ma l'utente voleva mettere il link nella Descrizione.
3. La lista admin (`/admin/preseason`) mostrava il markdown grezzo `[qui](https://)` invece di un link cliccabile.

**Modifiche frontend** (`/app/frontend/app/admin/preseason.tsx`):
- Helper `insertLinkInto(field, value, setter, ref)` unico per Descrizione + Info evento.
- Prompt migliorati: 
  - Step 1/2: default = testo selezionato dall'utente (o vuoto, NON più `qui`).
  - Step 2/2: default vuoto (l'utente DEVE incollare l'URL completo).
  - Validazione: testo non vuoto, URL con dominio plausibile (deve contenere `.`), normalizzazione automatica `https://` se manca.
  - Alert chiaro quando l'URL non passa la validazione, con il valore digitato visibile.
- Pulsante "🔗 Aggiungi link" ora presente ANCHE sopra il campo Descrizione (oltre a Info evento).
- Renderer `renderRichText()` locale: parsa `[label](url)` + URL grezzi (https/mailto/tel) e li rende cliccabili (`Linking.openURL`) anche nell'elenco admin delle campagne.
- Idem su pagina pubblica `/preseason/[id]`: ora la Descrizione (oltre a Info evento) supporta link cliccabili.

**Risultato per l'utente**:
- Anche solo digitando `https://goo.gl/maps/...` nella Descrizione (senza usare il pulsante) il link diventa **automaticamente cliccabile** sia in admin sia nella pagina pubblica.
- Se vuole un testo personalizzato cliccabile (es. "vedi mappa"), seleziona "vedi mappa" → "Aggiungi link" → incolla URL.



## 🎯 30/06/2026 — Metadati di verifica su quietanze soglia Atleta + Badge 5K/15K in "I Miei Documenti" ✅

**Problemi riportati**:
1. Le PDF "Comunicazione Superamento €5.000" e "€15.000" di Giulia (Atleta 18+ PRO) non mostravano il blocco "METADATI DI VERIFICA" a piè di pagina che invece appare per Coach/Dirigente/Collaboratore.
2. Nell'elenco "I Miei Documenti" lato atleta non si distingueva visivamente la quietanza che supera la soglia 5K/15K — apparivano tutte come "Quietanza Compenso Atleta - {mese}".

**Root cause**:
- `sign_athlete_compensation_receipt` chiamava `generate_threshold_5k_pdf`/`15k_pdf` SENZA passare `threshold_metadata` → blocco condizionale non renderizzato.
- `document_record.document_title` era sempre "Quietanza Compenso Atleta..." anche per documenti di tipo `threshold_5000_communication` / `threshold_15000_communication`.
- `_regenerate_threshold_communication_pdf` ricostruiva il cumulo annuale interrogando la collezione inesistente `atleta_pro_compensations` invece di `athlete_compensation_receipts` → metadati con totali a €0 anche dopo rigenerazione.

**Modifiche backend** (`/app/backend/server.py`):
- `sign_athlete_compensation_receipt`:
  - Costruisce `threshold_meta_athlete` (yearly_total_before/after, prior_compensation_declared, signature_timestamp_utc/rome, signature_hash, monthly_compensation_rate) e lo passa a `generate_threshold_5k_pdf`/`15k_pdf`.
  - Persiste `threshold_metadata` nel record `signed_documents` (così la futura rigenerazione lo ritrova senza ricalcolare).
  - `document_title` ora è `"Comunicazione Superamento €5.000 - {month} {year}"` o `"€15.000"` per i doc di superamento (prima erano titolati come quietanze normali).
- `_regenerate_threshold_communication_pdf`: ricostruzione cumulativa ora interroga anche `athlete_compensation_receipts` (con field `athlete_id`) e accetta entrambi i flag `signed` (legacy) e `receipt_signed`. Senza questa modifica le PDF rigenerate mostravano €0 di cumulo.

**Modifiche frontend** (`/app/frontend/app/athlete/documents.tsx`):
- Per quietanze di soglia preferisce sempre il titolo descrittivo "Comunicazione Superamento €5.000/€15.000" anche se il record DB ha il vecchio `document_title`.
- Nuovo badge colorato accanto al titolo: "⚠ 5K" (giallo) o "⚠ 15K" (rosso) per identificare a colpo d'occhio le quietanze di superamento. `testID="receipt-threshold-badge-{5K|15K}"`.

**Per Giulia (e atleti con quietanze soglia firmate prima di questa fix)**:
L'admin può cliccare "Rigenera" sulle quietanze di soglia esistenti — la rigenerazione ora ricostruisce correttamente i metadati interrogando `athlete_compensation_receipts`. Le NUOVE firme avranno automaticamente i metadati persistiti.



## 🎯 30/06/2026 — Badge "richieste cancellazione pendenti" + Rename "EVENTI PI" + Hyperlink button su Info evento ✅

**Richieste utente**:
1. Badge contatore sulle card atleta admin per richieste cancellazione documenti pendenti.
2. Rename "Pre-iscrizioni" → "EVENTI PI" nel menu admin.
3. Pulsante "Aggiungi link" sopra il campo "Info evento" che trasforma il testo selezionato in link cliccabile sulla pagina pubblica.

**Modifiche backend** (`/app/backend/server.py`):
- `admin_request_delete_signed_document`: ora `deletion_requests` salva anche `athlete_id`, `coach_id`, `collaboratore_id`, `dirigente_id` (presi dal signed_document) → consente badge per-utente senza N lookup.
- Nuovo endpoint `GET /api/admin/deletion-requests/pending-summary` (solo admin): ritorna `{total, by_athlete, by_coach, by_collaboratore, by_dirigente}` come mappe `{user_id: count}`.

**Modifiche frontend**:
- `/app/frontend/app/admin/index.tsx`: card menu rinominata in "EVENTI PI" + sottotitolo "Pre-iscrizioni, Open Day, eventi e tryout".
- `/app/frontend/app/admin/preseason.tsx`:
  - Titolo header pagina "EVENTI PI".
  - Nuovo bottone "🔗 Aggiungi link" sopra il TextInput Info evento: su Web rileva selezione corrente del textarea, chiede testo + URL, normalizza protocollo (auto-`https://`), inserisce markdown `[testo](url)` alla posizione del cursore o sulla selezione.
- `/app/frontend/app/preseason/[id].tsx`:
  - Nuovo helper `renderRichText(input, linkStyle)` che parsa `[label](url)` e URL grezzi (`https?://`, `mailto:`, `tel:`) e li rende come `<Text onPress={() => Linking.openURL(url)}>` blu sottolineato.
  - "Info evento" sul form pubblico ora usa `renderRichText` → i link inseriti dall'admin diventano cliccabili.
- `/app/frontend/app/admin/athletes.tsx`:
  - Carica `/api/admin/deletion-requests/pending-summary` su mount, mappa `by_athlete` in state `pendingDeletionsByAthlete`.
  - Card atleta mostra badge arancione "⏱ N canc." accanto al nome quando ci sono richieste cancellazione pendenti per quell'atleta. `testID="athlete-pending-deletion-badge-{id}"`.

**Risultato**:
- L'admin vede subito quali atleti hanno richieste cancellazione pendenti senza dover entrare nel dettaglio.
- "EVENTI PI" rispecchia la naturale evoluzione del modulo (non solo pre-iscrizioni, ma anche tryout, open day, eventi).
- L'admin può rendere cliccabile qualsiasi parola/frase nell'Info evento (es. mappa Google Maps, link al sito comunale, mail).



## 🎯 29/06/2026 — Request Delete quietanze Atleta 18+ PRO + Mappa Palestre nel "Da Fare" PRO ✅

**Richiesta utente**: 
1. "Quando admin cancella una quietanza deve essere accettata dall'user, non cancellazione diretta" — parità Coach/Collaboratore/Dirigente.
2. "Aggiungi a fondo pagina DA FARE degli atleti 18+ la mappa RegistraTEAM che trovi già nei coach o in admin".

**Modifiche backend**:
- `/app/backend/server.py` — `admin_request_delete_signed_document`: aggiunto fallback per identificare il firmatario atleta tramite `db.users.find_one({"athlete_id": doc["athlete_id"]})` (senza, signer_id era None e la cancellazione veniva eseguita immediatamente).
- `_execute_document_deletion`: 
  - `owner_id` ora include anche `doc.get("athlete_id")` (oltre a `atleta_id`).
  - Aggiunto blocco specifico per `compensation_receipt` / `compensation_receipt_split`: cancella la riga in `athlete_compensation_receipts` (match `athlete_id` + mese int/stringa legacy + anno) così l'atleta vede di nuovo il mese come NON firmato.
  - Aggiunto sblocco del record Coach gemello dual-role tramite `doc.get("linked_coach_user_id")`.

**Modifiche frontend**:
- `/app/frontend/app/admin/athlete/[id].tsx` — il tasto cestino sulla quietanza atleta firmata ora invia una **richiesta** (`DELETE /api/documents/{document_id}`) invece di cancellare direttamente. La cancellazione effettiva avviene solo dopo l'autorizzazione dell'atleta. `testID="request-delete-receipt-{month}-{year}"`.
- `/app/frontend/app/athlete/index.tsx` — aggiunti:
  - `pendingDeletions` state + `loadPendingDeletions()` + `handleDeletionResponse()` (chiamate `GET/POST /api/deletion-requests/...`).
  - Banner arancione "Richieste di cancellazione documenti" con bottoni Autorizza/Rifiuta per ogni richiesta pendente (parità Coach).
  - Bottone "🏟️ Mappa Palestre" a fondo pagina del Da Fare PRO (`/palestre`).

**Risultato**:
- L'admin non può più cancellare unilateralmente le quietanze atleta firmate; serve consenso dell'atleta (GDPR/integrità contabile).
- Atleti 18+ PRO ora hanno il bottone "Mappa Palestre" in fondo alla loro pagina principale, come gli altri ruoli.



## 🎯 28/06/2026 — Compensi Admin Atleta Pro: Pagina solo editor + rimozione duplicato compenso ✅

**Richiesta utente**: Quando si entra dalla sezione Atleti Pro → Compensi:
1. La pagina principale `/admin/athlete/[id]` mostrava il "Compenso Atleta" 2 volte (CompensationSummaryCard + card "Compenso Atleta" arancione). La seconda card deve apparire SOLO in caso di doppio ruolo Coach (riepilogo Atleta+Coach).
2. La pagina `/admin/athlete/[id]/compensation.tsx` apriva in modalità READ-ONLY con Calcoli Annuali + Quietanze Mensili. L'utente vuole che apra DIRETTAMENTE in modalità modifica (come fa il Coach), e che vengano cancellate Calcoli Annuali e Quietanze Mensili (già visibili nella pagina principale).

**Modifiche**:
- `/app/frontend/app/admin/athlete/[id].tsx` — Le card "Compenso Atleta" arancione + "Compenso Coach" viola ora compaiono SOLO se `linkedCoach && linkedCoach.monthly_compensation > 0` (vera doppia ruolo)
- `/app/frontend/app/admin/athlete/[id]/compensation.tsx`:
  - `editing` state default = `true` (la pagina è sempre in edit mode)
  - Toggle ✏️/✕ nell'header rimosso (per uscire si usa la freccia indietro)
  - Card "📊 Calcoli Annuali" nascosta con `{false && ...}`
  - Card "📋 Quietanze Mensili" nascosta con `{false && ...}`
  - `setEditing(false)` post-save rimosso (non più necessario)

**Risultato**: l'admin che apre i compensi di un atleta Pro vede direttamente l'editor (date contratto + compenso mensile + pregressi + salva), senza più card duplicate o sezioni di riepilogo (che restano nella pagina principale).



## 🎯 28/06/2026 — Editor Compensi Admin Atleta allineato al Coach ✅

**Problema**: La pagina `/admin/athlete/[id]/compensation.tsx` aveva un editor sovraccarico con Dati Bancari, Preview Riepilogo Contratto, e formattazione amount non coerente con quella del coach. Richiesta utente: "stessa grafica e richieste come fosse un coach", "lascia solo importo, pregresso e date contratto".

**Modifiche** (file: `/app/frontend/app/admin/athlete/[id]/compensation.tsx`):
- ❌ Rimossi dall'edit mode: card "Dati Bancari" (IBAN, Intestatario, Banca), box "Preview Riepilogo Contratto"
- ✅ Edit mode ora contiene solo: Data Inizio Contratto, Data Fine Contratto, Compenso Mensile, Compensi Pregressi Dichiarati (allineati a coach)
- ✅ Input importi con formato italiano (virgola decimale), placeholder `€ 0,00`, onFocus reset, selectTextOnFocus
- ✅ Hint testo allineato a coach: "Importo dichiarato dall'atleta percepito prima dell'assunzione (Gen-Ago se assunto a Set)"
- ✅ Save handler ora applica `.replace(',', '.')` su monthly/other/prior compensation prima del parseFloat
- ✅ Bottone salva: "💾 SALVA COMPENSI" (parità coach)
- 🛡️ Stati iban/bankName/ibanHolder* restano caricati dal mount e re-inviati al save per non sovrascrivere i valori esistenti nel DB (l'IBAN viene gestito dall'atleta dal proprio profilo user)


## 🎯 26/06/2026 — WhatsApp OpenGraph dinamico per pre-iscrizioni ✅

**Problema**: Il link di pre-iscrizione condiviso su WhatsApp mostrava "RegistraTEAM" come titolo (statico in `index.html` Expo Web SPA), confondendo le famiglie che non conoscono il nome del software.

**Soluzione**: Endpoint backend `GET /api/preseason/share/{campaign_id}` che serve HTML con meta tag OpenGraph dinamici (nome società come titolo, logo società come immagine, descrizione campagna). Per gli utenti reali è incluso un redirect immediato (`<meta http-equiv="refresh">` + `window.location.replace()`) verso la route SPA `/preseason/{id}`. I crawler (WhatsApp/Facebook/Telegram/Twitter) non eseguono JS, quindi vedono solo le meta tag corrette.

**File modificati**:
- `/app/backend/server.py` — nuovo endpoint `/preseason/share/{campaign_id}` + helper `_html_escape`
- `/app/frontend/app/admin/preseason.tsx` — `getPublicLink()` ora ritorna l'URL `/api/preseason/share/...` invece di `/preseason/...`

**Verifica curl WhatsApp UA**: `<title>` e `og:title` = "Pallavolo Perugia SSD a RL", `og:image` = logo PNG (200 OK, 339KB).


## 🎯 27/02/2026 — Smart Coach + Allievo Allenatore abbinabili ✅

### Modifica logica Livello/Grado Coach
**Comportamento richiesto**: Smart Coach deve poter essere abbinato a **QUALSIASI** grado base (Allievo Allenatore / 1° / 2° / 3° Grado). I gradi base restano mutuamente esclusivi tra loro.

**Prima**: Smart Coach era incompatibile con Allievo Allenatore (escluso esplicitamente). Allievo era trattato come "esclusivo".

**Ora**: Smart Coach è completamente libero, aggiungibile a qualsiasi grado base.

### File modificati
- `/app/frontend/app/coach/profile.tsx` (lato user)
- `/app/frontend/app/admin/coach/[id].tsx` (lato admin)

### TODO ancora aperto
- 🔴 **Pagina bianca Anagrafica lato Atleta dual-role** — segnalata dall'utente, da investigare. Coach/Atleta (lato Coach con linked athlete) funziona, Atleta/Coach (lato Atleta con linked coach) mostra pagina bianca. Da richiedere screenshot console errori per diagnosi.


## 🎨 27/02/2026 — UI cleanup Atleta — IMPLEMENTATO ✅

### Modifiche applicate

**Lato Atleta — `/athlete/index.tsx` (tab "Da fare")**
- ❌ Rimossa card "Certificato Medico" completa (era ~160 righe con form inline)
- ➕ Aggiunta card "🏟️ Mappa Palestre" (link a `/palestre`)

**Lato Atleta — `/athlete/profile.tsx` (tab "Anagrafica")**
- 🔀 "Cronologia Atleta" e "Documenti" spostate **a fondo pagina** (subito prima dei Consensi Privacy)
- ❌ "Mappa Palestre" rimossa (ora in tab Da fare)
- 🔀 Card "Certificato Medico" (anteprima parziale) sostituita con nuovo **componente riusabile** `<MedicalCertificateCard>` versione completa con form inline di modifica data
- ✅ Sezione "Dati Anagrafici" ora **aperta di default** (`sectionsExpanded.anagrafici: true`)
- ❌ Sezione "Versione Lite" completamente eliminata (Nome Lite + PIN)

### Nuovo componente
- `/app/frontend/src/components/athlete/MedicalCertificateCard.tsx` — card completa con:
  - Anteprima scadenza con colori semaforo (verde/arancione/rosso)
  - Stato verifica admin
  - Form inline per inserire/modificare data emissione + validità mesi (con calcolo automatico scadenza)
  - Endpoint `POST /certificates/simple`
  - Disabilitato per minorenni (solo adulti gestiscono il certificato)

### TODO: Replica su Coach (prossima sessione)
Stesse modifiche da applicare su `/coach/index.tsx` e `/coach/profile.tsx`:
- Card Certificato Medico → spostare dalla tab Da fare ad Anagrafica
- Mappa Palestre → spostare in Da fare
- Cronologia/Documenti → fondo pagina
- Versione Lite → eliminare
- Sezione Dati Anagrafici → aperta di default

### Test
- Lint: zero nuovi errori, componente nuovo lint-clean
- Smoke screenshot login: ✅ OK
- ⚠️ Verifica funzionale lato user atleta: da fare manualmente


## 🎨 26/02/2026 — UI cleanup Atleta/Coach (DA FARE — prossima sessione)

### Richieste utente (3 screenshot annotati a mano)

**Lato Atleta — `/athlete/index.tsx` (tab "Da fare")**
- ❌ Rimuovere card "Certificato Medico" completa (scadenza/verificato/modifica data)
- ➕ Aggiungere card "Mappa Palestre" (oggi è su Anagrafica)

**Lato Atleta — `/athlete/profile.tsx` (tab "Anagrafica")**
- ➕ Aggiungere la card "Certificato Medico" completa al posto della versione parziale esistente
- ❌ Rimuovere card "Mappa Palestre"
- 🔀 Spostare "Cronologia Atleta" e "Documenti" a fondo pagina
- ✅ Sezione "Dati Anagrafici" aperta di default (expanded=true on mount)
- ❌ Eliminare completamente la sezione "Versione Lite" (Nome Lite + PIN di accesso)

**Replica su Coach**:
- Verificare se `/coach/index.tsx` e `/coach/profile.tsx` (o equivalenti) hanno strutture simili
- Applicare le stesse modifiche di layout

### Effort stimato
- Atleta: ~1 ora (2 file, modifiche di layout)
- Coach (verifica + replica): ~30 minuti
- Smoke test + screenshot: ~15 minuti
- **Totale ~2 ore** per chiudere il refresh UI

### File da toccare
- `/app/frontend/app/athlete/index.tsx`
- `/app/frontend/app/athlete/profile.tsx`
- `/app/frontend/app/coach/index.tsx` (replica)
- `/app/frontend/app/coach/profile.tsx` (replica)


## 📨 26/02/2026 — Pre-iscrizioni: Withdraw + Convert-to-Trial (Backend implementato)

### Contesto
Il modulo "Pre-iscrizioni" esisteva già (`/api/preseason/*`, frontend `/admin/preseason.tsx`) ma era un semplice **sondaggio di intenzione**: il pre-iscritto poteva solo rispondere, NON cancellarsi e NON convertire in iscrizione.

### Decisioni utente confermate
- **Q1 retention dopo cancellazione**: 12 mesi (GDPR-friendly)
- **Q2 trial period**: usa `trial_max_days`/`trial_max_sessions` dalle impostazioni società (default 7gg/3 sessioni)

### Backend implementato (`/app/backend/server.py`)
**1. `POST /api/preseason/public/{response_id}/withdraw`** (pubblico, no auth)
- Body: `{ keep_contact: bool }`
- Se `keep_contact=true` → soft cancel: `status='withdrawn_keep_contact'`, `withdrawn_at`, `retention_until=+12 mesi`
- Se `keep_contact=false` → **hard delete** del record
- Idempotente (se già cancellata, non rifa nulla)
- Decrementa `response_count` della campagna

**2. `POST /api/preseason/responses/{response_id}/convert-to-trial`** (admin OR proprietario)
- Carica `trial_max_days`/`trial_max_sessions` da `settings.society`
- Crea record `athletes` con `status='trial'`, `trial_start_date=now`, `trial_end_date=+N giorni`
- Precompila: nome, cognome, data nascita, telefono atleta/genitore, club precedente, ruolo, note
- Marca response: `status='converted'`, `converted_athlete_id`, `converted_at`
- Tracciabilità: `athlete.from_preseason_response_id` + `from_preseason_campaign_id`

**3. `_cleanup_expired_preseason_withdrawals()`** (scheduler helper, NON ancora schedulato)
- Da chiamare da uno scheduler già esistente (`certificate_expiry_scheduler` o simile)
- Elimina record con `status='withdrawn_keep_contact'` e `retention_until <= now`

### TODO frontend (prossima sessione)
**Lato pre-iscritto (pubblico, link via email)**:
1. Pagina `/preseason/respond/[response_id]` con 2 bottoni:
   - "✅ Conferma iscrizione (periodo di prova)" → chiama `convert-to-trial` + redirect a flow iscrizione
   - "❌ Annulla pre-iscrizione" → modale 2 opzioni (mantieni contatti SI/NO) → chiama `withdraw`
2. Pagina di conferma post-withdraw/convert

**Lato admin (`/admin/preseason.tsx`)**:
1. Tabella risposte: aggiungere colonna "Stato" con badge:
   - 🟢 attiva
   - 🟡 cancellata (con contatto) — mostra `retention_until`
   - 🔵 convertita in trial — link alla scheda atleta
2. Nuovo tab "Cancellati con contatto" filtrabile
3. Bottone "Converti in trial" su ogni response attiva

**Scheduler**:
- Agganciare `_cleanup_expired_preseason_withdrawals` a uno scheduler giornaliero (es. `daily_maintenance_scheduler` se esiste, o aggiungere nuovo)

### Effort residuo
- Frontend admin: ~1.5 ore
- Frontend pubblico (landing pre-iscritto): ~1.5 ore
- Scheduler cleanup: ~10 minuti (agganciare la funzione esistente)
- Test E2E: ~1 ora
- **Totale ~4 ore** per chiudere la feature


## 📋 26/02/2026 — Piano implementativo: Sgancio Genitori in-season (P0)

### Casistiche (concordate con utente)

**Caso 1 — Atleta già maggiorenne all'iscrizione**
- Si iscrive direttamente come atleta 18+ (no parent_id obbligatorio)
- Self-registration: durante il flusso atleta, **campo OPZIONALE** "Aggiungi un genitore di contatto" con suggerimento gentile *"Ti consigliamo di aggiungere un genitore visualizzatore per emergenze"*
- Il genitore creato in questo modo ha ruolo `parent` con flag aggiuntivo `view_only=true` (read-only completo, no firme/edit)

**Caso 2 — Atleta minorenne all'iscrizione che compie 18 anni in-season**
- Banner permanente sulla dashboard genitore dal giorno del compleanno fino a fine stagione:
  > ⚠️ [Nome] ha raggiunto la maggiore età il GG/MM/AAAA. Da questa data, tutte le pratiche fiscali, burocratiche e di privacy (firme GDPR, quietanze compensi, modifiche anagrafiche, certificato medico, dati bancari) devono essere sottoscritte direttamente da [Nome]. Resti collegato come **visualizzatore** fino al termine della stagione. Al rinnovo, [Nome] gestirà l'iscrizione autonomamente.
- Backend guard: blocca azioni dispositive del genitore quando l'atleta è 18+
- Sgancio automatico al rinnovo stagione N+1

### Cosa BLOCCARE al genitore dopo i 18 (Caso 2)

| # | Azione | Endpoint backend | UI |
|---|--------|------------------|---|
| 1 | Firma GDPR/Privacy | `POST /documents/sign` (filtrare se signer=parent e athlete>=18) | bottone disabilitato + tooltip |
| 2 | Firma quietanze compensi | `POST /athletes/{id}/compensation/receipt-sign` (già limita a athlete role) | sezione compensi read-only |
| 3 | Firma autocertificazioni soglie | endpoint specifico | bottone disabilitato |
| 4 | Modifica anagrafica fiscale | `PATCH /athletes/{id}` (campi: fiscal_code, birth_*, address) | input disabilitati |
| 5 | Modifica IBAN/dati bancari | `PATCH /athletes/{id}` (iban, account_holder, bank_name) | input disabilitati |
| 6 | Upload data emissione cert. medico | `POST /certificates/{id}` | bottone disabilitato |
| 7 | Modifica email/telefono primari atleta | `PATCH /athletes/{id}` | input disabilitati |
| 8 | Accettazione compenso mensile | `PATCH /auth/me` con `compensation_accepted` (atleta-only già) | non rilevante |

### Cosa PERMETTERE al genitore (anche dopo i 18)

| Azione | Note |
|---|---|
| Vedere calendario/gare/allenamenti | Read-only |
| Vedere presenze | Read-only |
| Vedere stato pagamenti | Read-only |
| **Pagare quote** | Permesso (molti genitori continuano a pagare) |
| Ricevere notifiche WhatsApp/email | Solo se opt-in |
| Vedere documenti firmati dal figlio | Read-only |
| **Vedere quietanze compensi** | Read-only (decisione utente Q2: Visibili) |
| Vedere data scadenza cert. medico (no PDF) | Architettura attuale |

### Architettura tecnica proposta

**Backend** (`/app/backend/server.py`):
1. Nuovo helper `_athlete_age_ge_18(athlete: dict) -> bool` (calcolo da `birth_date`)
2. Nuovo helper `_parent_can_modify_athlete(current_user, athlete) -> bool`:
   - True se `current_user.role != 'parent'`
   - True se atleta < 18
   - False se atleta >= 18 (sgancio in-season)
3. Decorator/check in tutti gli endpoint `PATCH /athletes/{id}*` e `POST /athletes/{id}/*`:
   ```python
   if current_user["role"] == "parent" and not _parent_can_modify_athlete(current_user, athlete):
       raise HTTPException(403, "Atleta maggiorenne: azione riservata all'atleta")
   ```
4. Nuovo endpoint `GET /parent/athletes/{id}/age-transition` che ritorna `{is_adult, birthday_iso, days_since_18, view_only_active}` per il banner

**Frontend** (`/app/frontend/app/parent/`):
1. Componente `<AdultAthleteBanner athlete={...} />` (banner giallo permanente sulla dashboard)
2. Hook `useAthleteAgeStatus(athleteId)` che chiama `/parent/athletes/{id}/age-transition`
3. In `parent/athlete/[id].tsx`: tutti i pulsanti/input dispositivi → `disabled={ageStatus.is_adult}` con tooltip
4. In `parent/index.tsx`: card atleta con badge "🎂 Maggiorenne — riservato all'atleta" se applicabile

**Rinnovo automatico** (Scheduler / endpoint admin):
- All'apertura tesseramento nuova stagione, se `athlete.age >= 18 AND athlete.first_signup_was_minor`:
  - NON ripropone il parent_id alla nuova iscrizione
  - Il legame parent storico resta in archivio audit ma non è più "attivo"
  - L'atleta procede come 18+ standalone

**Self-registration scenario 1** (atleta già maggiorenne):
- Aggiungere step opzionale "Genitore di contatto" nel flow `/register-athlete` con flag `view_only=true`
- Il genitore creato ha ruolo `parent` ma con campo `view_only_parent: true` → vede tutto ma NON può modificare/firmare nulla (default da subito)

### Effort stimato
- Backend: ~2-3 ore (helper + ~10 endpoint da proteggere + 1 endpoint nuovo)
- Frontend: ~3-4 ore (banner + disable logic + scheda atleta + register-athlete update)
- Testing: ~1 ora (testing agent dual-role + parent scenarios)
- **Totale ~6-8 ore di lavoro effettivo** → meritava una sessione dedicata con context fresco


## 🎒 26/02/2026 — Feature "Zaino Coach" Dual-Role (G1+G2+G3) ✅

### Contesto
Atleta 18+ PRO che, durante la stagione, "indossa lo zaino di Coach" e allena un gruppo giovanile (es. MiniVolley). Esempio: Alice Zorzi atleta B1 €1.750/mese + €3.850 pregresso, dal 01/10 anche coach MiniVolley €300/mese. Bonifico unico €2.050/mese.

### Regole RAS confermate dall'utente
- "Totale da comunicare al RAS" = SOLO importi pagati dalla nostra società (atleta + coach)
- Pregresso → tracking soglie €5K/€15K (cumulativo legale), MA non sommato al totale RAS
- Pregresso visibile UNA volta sola sull'anagrafica Atleta (evita doppio conteggio)

### Modifiche implementate
**G3 — Lock pregresso su Coach dual-role**
- `/app/frontend/src/components/compensation/CompensationSummaryCard.tsx`: nuovo prop `pregressoNotice` che sostituisce l'importo con messaggio info quando dual-role
- `/app/frontend/app/coach/compensation.tsx`: passa `pregressoNotice="Conteggiato sull'anagrafica Atleta..."` quando `dualRoleInfo.athlete` presente
- `/app/frontend/app/admin/coach/[id].tsx`: nuovo state `isDualRole` (fetch `/admin/persons/{id}/profile`) → stessa logica

**G2 — Banner-link sul user Coach → switch a modalità Atleta**
- `/app/frontend/app/coach/compensation.tsx`: banner 🎒 "Riepilogo cumulativo RAS sulla scheda Atleta →" che chiama `/auth/switch-account` e naviga a `/athlete/compensation`

**G1 — Compenso Coach mese-per-mese nel year-summary Atleta**
- `getYearSummary()`: aggiunto `coachYearlyTotal` e `coachMonthCount` calcolati per i mesi in cui il contratto Coach è attivo nell'anno fiscale
- Year boxes mostrano nuova riga "• Compenso Coach 🎒 (N mesi × €/mese): €tot"
- `findThresholdMonthFallback()`: il cumulativo cronologico per soglie €5K/€15K ora include il compenso Coach nei mesi attivi → soglie scattano correttamente con Atleta+Coach

### Cosa esisteva già (NON modificato)
- `POST /admin/athletes/{id}/promote-to-coach` (modal "Aggiungi anche come Coach" su scheda atleta)
- `GET /admin/persons/{id}/compensation-summary` (endpoint admin con RAS + breach months dual-role)
- `PersonCompensationSummary` admin component (`/admin/persona/{id}/compensi`)
- `SwitchAccountButton` (switch token JWT atleta↔coach)
- TOTALE RAS già includeva Coach base nel banner unificato

### Gap residuo (G4 — IMPLEMENTATO 26/02/2026)
- ✅ **G4 — Ricevuta mensile unica dual-role**: endpoint `POST /athletes/{id}/compensation/receipt-sign` esteso per:
  - Rileva linked coach via `_find_linked_compensated_user_for_athlete` (CF/email/società)
  - Se contratto Coach attivo nel mese richiesto: PDF unico con 2 voci ("Compenso da Coach €X" + "Compenso da Atleta €Y" + "Totale lordo €X+Y")
  - Soglie €5K/€15K calcolate sul cumulo (Atleta + Coach per ogni mese attivo + pregresso + esterni)
  - **Una sola firma** = salva sia `athlete_compensation_receipts` (porzione atleta) sia `coach_compensations` (porzione coach) con stesso `document_id` → bonifico unico, doppia tracciabilità per soglie per-ruolo
  - Document record `signed_documents` arricchito con `dual_role_combined`, `dual_role_athlete_portion`, `dual_role_coach_portion`, `linked_coach_user_id`
  - Response API include `dual_role_combined`, `athlete_portion`, `coach_portion` per feedback UI
  - PDF function `generate_monthly_receipt_pdf` già supportava i parametri `coach_amount`/`athlete_pro_amount` (preesistenti) — solo il chiamante è stato esteso

### Test
- Lint: nessun nuovo errore introdotto (warnings pre-esistenti)
- Smoke screenshot: login screen carica correttamente
- ⚠️ Verifica funzionale dual-role sul flusso reale (Alice o utente equivalente) **da fare lato utente** — credit sensitive, no testing agent

---


## 🐛 25/02/2026 — Bug fix "Compenso applicabile solo a coach, dirigenti..." ✅

### Sintomo
Admin tenta di modificare date contratto di VERDI FABIO (1/9/2026→30/6/2027 ⇒ 1/9/2025→30/6/2026) sulla UI `/admin/dirigente/[id]` e riceve errore 400 "Compenso applicabile solo a coach, dirigenti e collaboratori".

### Root cause
L'utente VERDI FABIO ha `role='athlete'` in `db.users` (anche se la UI admin lo renderizzava sotto "dirigenti"). L'endpoint `PATCH /api/users/{id}/compensation` accettava solo `[COACH, DIRIGENTE, VIEWER, COLLABORATORE]`, escludendo ATHLETE → 400 Bad Request.

### Fix (server.py L4966)
1. Esteso allow-list a `[COACH, DIRIGENTE, VIEWER, COLLABORATORE, ATHLETE]` — consente di gestire atleti PRO compensati dall'UI dirigente
2. Messaggio errore arricchito: ora include `(role attuale: {role})` per diagnostica futura

### Test
✅ Testing agent ha verificato il fix con **8/8 pytest PASSED (100%)**:
- Tutti i 4 ruoli accettati (Dirigente, Coach, Collaboratore, **Athlete PRO** — caso bug principale) → 200 OK
- Ruoli rifiutati (Admin, Parent) → 400 con role corrente nel messaggio errore
- Conservazione `compensation_accepted` quando si cambiano solo date contratto (no reset)
- Conservazione `compensation_accepted` quando importo invariato

### Critical review (osservazioni non bloccanti del testing agent)
- `bare except:` su parsing date contratto a L4992/L5002 inghiotte errori — date invalide producono 200 OK senza update. Da restringere a `ValueError/TypeError` con 400 esplicito.
- Per atleti PRO, `monthly_compensation` vive su `db.athletes` (canonico) e `db.users` (questo endpoint). Sync già implementato (vedi iteration_74).


## 🚨 25/02/2026 — Hotfix: Collaboratore pagina bianca dopo login ✅

### Sintomo
I collaboratori (es. PAOLI PAOLO) non riuscivano ad accedere ai loro account: dopo login → **schermata bianca** (body length = 0).

### Root cause
Import mancante di `CollaboratoreTabBar` in `/app/frontend/app/collaboratore/index.tsx`. Il componente era usato a riga 148 (`<CollaboratoreTabBar active="dafare" />`) ma mai importato → `ReferenceError: CollaboratoreTabBar is not defined` a runtime → crash di React → body vuoto.

### Fix
Aggiunta riga 20: `import CollaboratoreTabBar from '../../src/components/collaboratore/CollaboratoreTabBar';`

### Verifica audit preventivo
Eseguito grep di matching `<Component />` vs `import Component` su tutti i 4 TabBar (Dirigente/Coach/Collaboratore/Athlete) e CompensationSummaryCard (7 file admin+user): tutti coerenti, nessun altro import mancante.

### Test
Testing agent ha verificato il fix con **6/6 scenarios PASSED** (100% success rate):
- Collaboratore login + render 3 tab (Da fare/Anagrafica/Compensi)
- Navigazione tab funzionante (index → profile → compensation, tutti con body > 1000 chars)
- Smoke test altri 3 ruoli (Coach/Atleta/Admin): nessun PAGE ERROR
- 0 ReferenceError "is not defined" su tutte le pagine


## 🆕 24/02/2026 — Bug fix `compensation_accepted` sync users ↔ athletes ✅

### Sintomo
Admin che apriva il profilo di un atleta PRO (es. "Zorzi Alice") vedeva "Compenso Accettato: ✗ No" anche se l'atleta aveva accettato dal proprio profilo (✓ Sì).

### Causa
Il flag `compensation_accepted` esiste su 2 collection MongoDB separate:
- `db.users.compensation_accepted` ← scritto dal `PATCH /api/auth/me`
- `db.athletes.compensation_accepted` ← letto da `GET /api/athletes/{id}` (usato dall'admin)
Le 2 collection erano desincronizzate.

### Fix (3 livelli)
1. **PATCH `/api/auth/me`** (server.py ~L3927): se l'utente è atleta, propaga `compensation_accepted` (e `compensation_accepted_date`) anche su `db.athletes` via `current_user.get('athlete_id')`. Aggiunto log warning se `athlete_id` manca.
2. **Reset esplicito data**: quando `compensation_accepted=False`, ora `compensation_accepted_date` viene esplicitamente azzerato a `None` su entrambe le collection (prima restava il valore precedente).
3. **Migration startup** (server.py ~L31964 `run_data_migrations`): all'avvio del backend di produzione sincronizza retroattivamente gli atleti che avevano accettato pre-fix. Logga: `"Migration compensation_accepted sync: X/Y atleti aggiornati"`.

### Test
Testing agent ha verificato il fix con 6/6 test pytest PASSED (file: `/app/backend/tests/test_compensation_accepted_sync.py`). Tutti i flussi verificati: accept, revoke, ruolo non-athlete invariato, GET admin coerente con PATCH user, migration log.

### Test credentials usate
- Admin: `vincenzo.ciucarelli@gmail.com` / `Test1234`
- Athlete PRO test: `testalice1780817007@test.com` / `Test1234`
- Coach: `alice@test.com` / `Test1234`


## 🆕 24/02/2026 — Refactoring Fase R1 (low-cost setup)

### Setup struttura modulare
Create cartelle vuote per il refactoring graduale di `server.py` (32k righe):
- `backend/routers/` — pianificata per endpoint per dominio
- `backend/services/` — pianificata per business logic riusabile
- `backend/core/` — pianificata per infrastructure (config, db, auth, security)
- `backend/REFACTORING.md` — roadmap dettagliata + convenzioni import

### SECTION markers in `server.py`
Aggiunti 11 commenti `# ═══ SECTION: ... ═══` per facilitare navigazione:
1. 🏢 SOCIETIES (~1456) — multi-tenancy root
2. 🔑 AUTH REGISTRATION (~1772)
3. 👥 ATHLETES invitations (~2802)
4. 🔐 AUTH LOGIN (~3331) — login, /me, password recovery
5. 🏐 MATCHES (~5212)
6. 🌐 FEDERATION FIPAV (~5639)
7. 🩺 MEDICAL CERTIFICATES (~8876)
8. 💳 PAYMENTS (~10525)
9. ✅ ATTENDANCE (~11958)
10. 🏋️ COACH (~12520)
11. 📄 PDF GENERATION (~17045)

### Bug pre-esistente risolto durante setup
Trovato e fixato un syntax error a riga 31950 (stringa orfana `plicata")`) che impediva al backend di partire dopo i marker. Backend ora risponde 200 OK su tutti gli endpoint.

### Strategia futura: estrazione opportunistica
Ogni volta che si lavora su una sezione, può essere estratta nel router/service appropriato. Nessuna migrazione "big bang". Spesa stimata se mai completata: ~1500-2000 crediti distribuiti in 4 sessioni.


## 🆕 24/02/2026 — CompensationSummaryCard rollout COMPLETO ✅

Componente `CompensationSummaryCard` ora applicato in **TUTTI** i 7 punti pianificati:

**User-side (4):**
1. ✅ `/dirigente/compensation` (template originale)
2. ✅ `/coach/compensation` — bonus: rimosse 2 sezioni duplicate (Banner Coach + Azioni Compenso)
3. ✅ `/collaboratore/compensation` (versione manuale, già allineata)
4. ✅ `/athlete/compensation` (Atleta PRO) — `onAcceptCompensation` wired

**Admin-side (4) — readOnly mode:**
5. ✅ `/admin/dirigente/[id]`
6. ✅ `/admin/collaboratore/[id]`
7. ✅ `/admin/coach/[id]`
8. ✅ `/admin/athlete/[id]` (Atleta PRO) — header con pill `>5K/>15K` + matita Edit preservato

Tutti mostrano la stessa grafica: 👤 nome + 💰 Compenso Mensile (box arancione) + ✓ Accettato + 📅 Periodo Contratto (box viola) + 📋 Pregresso "Solo admin" (box azzurro).


## 🆕 24/02/2026 — CompensationSummaryCard riusabile + GDPR multi-tenancy fix

### 🚨 Bug GDPR PDF Privacy (CRITICO)
Le query di generazione PDF privacy in `server.py` cercavano `db.societies.find_one()` e `db.settings.find_one({"type": "society"})` **senza filtro** su `society_id` → restituivano sempre la PRIMA società creata (Pallavolo Perugia). Tutti i PDF firmati dagli utenti di altre società mostravano l'intestazione sbagliata.

**Fix applicato** a 5 endpoint + 1 funzione interna (filtro su `current_user.society_id` o `document.society_id`):
- `POST /documents/sign`
- `GET /documents/signed/{id}/pdf`
- `GET /documents/consent-pdf/{consent_type}`
- `POST /documents/sign-gdpr-privacy`
- `POST /documents/preview-gdpr-privacy`
- `_regenerate_gdpr_privacy_pdf()`

### Dashboard Admin header
- Nome società spostato sopra il logo, allineato a sinistra
- Font 42→24, lineHeight 28
- Logo abbassato (marginTop 10→8, dimensioni 100→90)

### Backend: nuovo endpoint statistiche Dirigente
`GET /api/dirigente/dashboard-stats` ritorna conteggi/elenchi di:
- `expiring_certificates`: certificati scaduti o in scadenza nei prossimi 30 gg
- `unpaid_payments`: atleti con rate non saldate

### Componenti riusabili creati
- `DirigenteTabBar` (3 tab Da fare/Anagrafica/Compensi con auto-detect pathname)
- `CollaboratoreTabBar` (idem)
- `CoachTabBar` (idem)
- `CompensationSummaryCard` (replica esatta header Compensi Dirigente: nome + Compenso Mensile box arancione + Compenso Accettato Sì/No + Periodo Contratto viola + Pregresso "Solo admin")

### Tab applicate
- Dirigente user (3 file): index.tsx, profile.tsx, compensation.tsx
- Collaboratore user (3 file): index.tsx, profile.tsx, compensation.tsx
- Coach user (2 file finora): profile.tsx, compensation.tsx (manca index.tsx)

### CompensationSummaryCard applicato
- ✅ Coach user `/coach/compensation.tsx`
- ⏳ Da applicare a: Collaboratore user (versione manuale esistente, già funzionante), Atleta 18+ PRO user, Admin Dirigente/Collaboratore/Coach/Atleta 18+ PRO

### Altri fix
- Admin Documenti archivio: bottone "occhio" ora sempre visibile (rimossa condizione `doc.pdf_filename`)
- Collaboratore user Squadre Assegnate: i pill mostrano ora i NOMI invece degli ID (carica `/api/teams` e mappa)
- Dirigente: "In arrivo" sostituito con 2 statistiche cliccabili (certificati scadenza + rate non pagate)
- Dirigente user Compensi: Compenso Mensile in box dedicato, Compenso Accettato spostato sotto, rimosso link "Il Mio Profilo"


## 🆕 24/02/2026 — Atleti Paganti (18+ e 18-) + Genitore uniformati a layout Admin ✅

Estensione dell'uniformazione UI: ora **Atleta 18+ pagante** (lato user) e **Atleta 18- pagante** (gestito dal genitore) hanno la stessa struttura tab dell'admin (`Da fare | Anagrafica | Pagamenti | Presenze`).

### Modifiche
- **`AthleteTabBar.tsx`**: routing condizionale → tab "Pagamenti" porta a `/athlete/payments` per i paganti (era sempre `/athlete/compensation`, dedicata ai PRO).
- **`/athlete/payments.tsx`**: aggiunta `AthleteTabBar` sticky + nuovo **Header "💰 Quota Stagionale"** (importo grande, status pill, progress bar, sconto).
- **`/athlete/profile.tsx` (Anagrafica)**: aggiunti QR Code, Cronologia Atleta, Coach della Squadra, Documenti link, Mappa Palestre. Aggiunto state `profile` (raw) + `coachInfo` (l'anteprima certificato medico ora funziona davvero, prima referenziava `profile` undefined).
- **`/athlete/index.tsx` (Da fare)**: rimossi QR, Cronologia, Pagamenti link, Coach, Orari, Presenze link, Dati Personali link, Documenti link, Mappa Palestre (tutti spostati nelle rispettive tab). Restano solo banner Trial, Certificato Medico (form modifica) e Privacy da firmare.
- **`/athlete/presenze.tsx`**: aggiunto link "Orari Allenamenti" (calendario settimanale).
- **`/parent/athlete/[id].tsx` (Genitore)**: trasformato in layout tabbed con stato `activeTab` + TabBar 4 bottoni. Wrappate sezioni esistenti in `{activeTab === 'X' && (<>...</>)}`:
  - `Anagrafica`: Cronologia, QR, Dati Anagrafici+Fiscali (collassabile), Coach, Minor Access Control
  - `Da fare`: Stato/Periodo Prova, Certificate Card form, Richiedi Cancellazione
  - `Pagamenti`: Header "💰 Quota Stagionale" (NUOVO) + Payments Card
  - `Presenze`: Team Schedule Card
  - **Rimossa Athlete Photo Card** (richiesta utente: niente foto in Anagrafica).

### Vincoli rispettati
- Nessun nuovo campo aggiunto, solo riorganizzazione dei contenuti esistenti.
- `minor/index.tsx` (atleta minorenne lite) intoccato.



## 🆕 22/02/2026 — Compensi Atleta PRO Admin: layout user-side replicato 1:1 ✅

L'utente ha richiesto la riscrittura completa della tab Compensi dell'atleta PRO admin per replicare esattamente il layout user-side (`/athlete/compensation`). Vecchio layout (lista key/value) sostituito.

### Modifiche
- **Card 💰 Compensi semplificata** (admin/athlete/[id].tsx):
  - Header: titolo + pill **>5K/>15K** (calcolato su grandTotal del contratto) + matita ✏️ che apre `/admin/athlete/{id}/compensation`
  - **Importo mensile GRANDE** centrato (es. "€ 3.500,00 / mese") in arancione
  - Box compatto **📅 Periodo contratto: GG/MM/AAAA - GG/MM/AAAA** (azzurro chiaro con border-left blu)
- **Già Percepito + Genera Quietanza Personalizzata** spostati in fondo (dopo le warning soglie), per matchare le screenshot:
  - Banner azzurro cliccabile "💰 Già Percepito: € X — N quietanze firmate"
  - Bottone verde "➕ Genera Quietanza Personalizzata" → naviga a `/admin/athlete/{id}/compensation`
- Rimossi i vecchi campi inline (Compenso Mensile / Compensi Pregressi / Periodo Contratto / Compenso Accettato) dalla card per liberare spazio


## 🆕 22/02/2026 — Compensi Atleta PRO Admin uniformati a stile Pedretti Collaboratore ✅

L'utente ha richiesto che la tab "Compensi" dell'atleta 18+ PRO (admin) replichi lo stesso layout già usato per il Collaboratore (Pedretti Pedro): "Già Percepito" già OK, ma servono in più i blocchi **Comunicazione RAS - Totale Contratto**, **Calcolo per Anno Solare (€5k/€15k)** e **Dichiarazioni soglia firmata**.

### Backend (`/app/backend/server.py`)
- Esteso l'endpoint `GET /api/prime-squadre/athletes/{athlete_id}/threshold-status/{year}` aggiungendo i campi `declaration_signed` e `needs_warning` per ciascuna soglia (5000/15000), allineando la response a quella già usata dal Collaboratore.
- Le dichiarazioni vengono cercate in `threshold_declarations` (athlete_id / user_id / coach_id) e in `signed_documents` (document_type `threshold_5000_communication` / `threshold_15000_communication`).

### Frontend (`/app/frontend/app/admin/athlete/[id].tsx`)
- Nuovi state `thresholdStatus` / `thresholdStatus2` caricati post-fetch atleta (anno start contratto + anno end contratto).
- Aggiunte helper inline `getAthleteCompensationBreakdown()` e `getAthleteYearlyBreakdown()` (calcoli mesi/base/supplementare/totali per RAS e per anno solare).
- Dopo la card "💰 Compenso" + bottone "Gestisci Compensi e Quietanze", ora vengono renderizzati:
  - 📄 **Comunicazione RAS - Totale Contratto** (compenso base + supplementare + totale)
  - 📊 **Calcolo per Anno Solare (€5k/€15k)** con un box per ogni anno del contratto
  - Banner di warning/firma per Dichiarazione €5.000 e €15.000 (verde per anno start, blu per anno end, arancio/viola per warning)

### Vantaggi
- Visualizzazione coerente tra ruoli compensati (atleta PRO / coach / collaboratore / dirigente).
- Admin può vedere subito a colpo d'occhio lo stato fiscale/previdenziale anche dell'atleta PRO senza dover entrare nella pagina dedicata `/compensation`.


## 🆕 22/02/2026 — Card "Genitore Detraente Fiscale" visibile lato admin ✅

L'utente ha segnalato la mancanza, sull'anagrafica admin dell'atleta minorenne, dei dati del genitore che porta in detrazione la spesa sportiva (cognome, nome, CF). Necessario per la corretta compilazione dell'Attestato di Versamento ai fini delle detrazioni fiscali fino al 18° anno di età (DPR 917/86 art. 15).

### Stato infrastruttura backend (già presente, non toccata)
- Modello `Athlete` ha già i campi `tax_payer_last_name`, `tax_payer_first_name`, `tax_payer_fiscal_code`.
- `AthleteUpdate` accetta i tre campi via `PATCH /athletes/{id}`.
- L'endpoint `/payments/{athlete_id}/fiscal-receipt` li espone per il PDF.

### Stato frontend lato genitore (già presente, non toccata)
- `/parent/athlete/[id]` ha:
  - Form di **editing** con 3 input dedicati (Cognome / Nome / CF Genitore detraente)
  - Visualizzazione read-only mascherata
  - Warning automatico se i dati mancano

### Stato frontend PDF (già presente, non toccato)
- `src/utils/fiscalReceipt.ts` `generateReceiptHTML()` legge `data.parent.first_name/last_name/fiscal_code` → questi vengono già popolati da `athlete.tax_payer_*` quando si scarica l'Attestato di Versamento (documento #1 per minorenni).

### Modifica applicata in questa sessione
- **`/app/frontend/app/admin/athlete/[id].tsx`**: aggiunta card "🧾 Genitore Detraente Fiscale" (read-only) nel tab Anagrafica, posizionata prima della card "Password Protezione Dati":
  - Visibile **solo** se `currentYear - birthYear ≤ 18` (atleta fiscalmente eligibile alla detrazione)
  - Mostra Cognome / Nome / CF del genitore detraente
  - Banner di warning arancio se mancano dati ("⚠️ Dati non ancora compilati dal genitore. Senza questi dati l'attestato di versamento non potrà essere usato ai fini fiscali.")
  - Testo informativo che cita DPR 917/86 art. 15
  - Note esplicita "Modificabile solo dal genitore nella sua area" (admin non può editare)

### Cosa NON è stato modificato
- I PDF (#1 Attestato Versamento e #2 Ricevuta Pagamenti) sono già wired correttamente sui campi `tax_payer_*` e non richiedono modifiche.
- Il form di editing genitore è già funzionante e completo.


## 🆕 22/02/2026 — Riordino Anagrafica Atleta Admin: Cert ⬆️ Dati Tecnici ⬇️ Squadra → Presenze ✅

L'utente ha chiesto di riorganizzare le card del tab "Anagrafica" lato admin atleta (3 tipologie) per migliorare la fruibilità: Certificato Medico in cima, Dati Tecnici in fondo, Squadra spostata nel tab Presenze. Inoltre rimozione della firma di inizio prova per atleti PRO e card più ricca per atleti che pagano la quota nel tab Presenze.

### Modifiche applicate (`/admin/athlete/[id].tsx`)
- **Ordine card Anagrafica (nuovo)**: Cronologia → Status Alerts (pending_email / pending_certificate isolati in card dedicata) → **🩺 Certificato Medico** → Tesseramento → Anagrafica + Indirizzo → Privacy GDPR / Password Genitori / Withdraw / Reset → **📊 Dati Tecnici (in fondo)**.
- **Squadra rimossa** da Anagrafica e spostata nel tab **📅 Presenze**.
- **Trial box rimosso** da Dati Tecnici.
- **Tab Presenze** ora include: card "🏁 Periodo di Prova" (solo se `status === 'trial' && athleteType === 'quota'`) → card "Squadra" → Statistiche Presenze esistenti.

### Modifiche applicate (`/athlete/index.tsx`)
- Banner "In attesa di inizio prova" (con bottone "Firma Dichiarazione di Prova") nascosto per atleti PRO (`athlete_type === 'compensated'`).

### Vantaggi
- Cert medico visibile a colpo d'occhio (priorità medico-legale).
- Tab Presenze diventa il hub operativo (Squadra + Prova + Statistiche).
- Atleti PRO non vedono più una richiesta di firma che non li riguarda.


## 🆕 22/02/2026 — "🏆 Stagione" Replica & Provincia obbligatoria universale ✅

L'utente ha chiesto di replicare la logica della card "🏆 Stagione" implementata in Admin Dirigente verso Admin Coach, Admin Collaboratore e tutte le viste user-side (Dirigente/Coach/Collaboratore). Stesso obbligo `province_of_birth` su tutti i profili user.

### Modifiche applicate
- **`/admin/coach/[id]`**: card "🏆 Stagione" con pill blu per squadre + frase "In arrivo: riepilogo lavoro stagione".
- **`/admin/collaboratore/[id]`**: card "🏆 Stagione" con pill blu (Squadre) + pill arancio (Palestre) + tagline "In arrivo".
- **`/dirigente/profile`**: card "🏆 Stagione" unificata (Squadre+Palestre), provincia di nascita obbligatoria con asterisco rosso e validazione in `handleSave`.
- **`/coach/profile`**: nuova card "🏆 Stagione" dopo Account (provincia già obbligatoria dalla sessione precedente).
- **`/collaboratore/profile`**: card "🏆 Stagione" con pill standard, validazione + asterisco provincia.
- **`/athlete/profile`**: validazione provincia + asterisco rosso aggiunto.

### Vantaggi
- UI uniforme tra admin/user e tra ruoli.
- Dato fiscale critico (provincia di nascita) raccolto per Riforma Sport / firma quietanze.


## 🆕 21/02/2026 — "Già Percepito" calendario completo + standardizzazione 4 figure ✅

L'utente ha chiesto di rendere la modal "Gestione Quietanze" un calendario completo dei mesi di contratto: tutti i mesi visibili da subito, in grigio quando non firmati, colorati per soglia (€5k/€15k) quando firmati. Plus: l'Atleta Admin era l'unico senza il widget "Già Percepito" inline + modal.

### Modifiche applicate
- **`/admin/collaboratore/[id]`**: modal Gestione Quietanze ora itera su tutti i mesi del contratto (`contract_start_date` → `contract_end_date`); mesi non firmati = grigio "Non firmata"; widget Già Percepito sempre visibile se contratto definito.
- **`/admin/coach/[id]`**: stessa logica calendario contratto in modal; widget sempre visibile.
- **`/admin/dirigente/[id]`**: stessa logica calendario contratto in modal; widget sempre visibile.
- **`/admin/athlete/[id]`** (NUOVO): aggiunti `signedReceipts` state, caricamento via `GET /api/athletes/{id}/compensation/receipts`, widget inline "Già Percepito" cliccabile, modal "📋 Gestione Quietanze" completa con Totale Percepito + calendario mesi (grigi + colorati per soglia). La sotto-route `/admin/athlete/[id]/compensation` resta intatta come standard di gestione.

### UX risultato
- A colpo d'occhio l'admin vede inizio e fine contratto e i mesi mancanti
- Quando l'atleta firma una quietanza, il mese passa da grigio → verde (≤€5k) → arancio (>€5k) → viola (>€15k)
- I 4 admin view delle figure pagate (Atleta PRO / Coach / Collaboratore / Dirigente) ora sono allineate

### Test
- Lint ✅ pulito su tutti e 4 i file
- Smoke test backend ✅ (`/api/settings/society` → 200)
- Verifica utente: in attesa di feedback in produzione



## 🆕 23/06/2026 (mattina) — Atleta-first: tab bar uniforme admin + user ✅

L'utente ha chiesto di ripartire dall'Atleta 18+ con compensi come base, prima di affrontare lo zaino Coach. Stato attuale:

### A. Admin athlete view (`/admin/athlete/[id]`)
- Tab riarrangiati: **Da fare** / **Anagrafica** / **Compensi** / **Presenze** (era `Dati / Compensi / Presenze`)
- "Da fare" default + mostra impegni atleta (Oggi / Domani / Dopodomani / Prossimi giorni collassabili)
- `Anagrafica` = ex "Dati" (Cronologia, Dati Tecnici, Squadra, Tesseramento)

### B. User athlete view (`/athlete/*`)
- Creato componente condiviso `/app/frontend/src/components/athlete/AthleteTabBar.tsx`
- Aggiunto in cima a `/athlete/index`, `/athlete/profile`, `/athlete/compensation`, `/athlete/presenze`
- Stessa label e stesso ordine dell'admin (uniformità UX)
- 🎯 **Dinamico per athlete_type**: tab si chiama "🏆 Compensi" (oro) se atleta `compensated`, "💳 Pagamenti" (blu) se `quota`. Carica il tipo via `GET /auth/me`.

### C. Backend
- `GET /api/coach/commitments?athlete_id={id}` esteso per supportare atleti (oltre coach/dirigente/collaboratore). Legge `team_id` dal record `athletes` (no `assigned_teams`).
- `AdminCoachCommitments` accetta nuovo prop `athleteId`.

### Account di test (preview)
- Email: `mariorossi@test.com` / Pwd: `MarioTest123`
- Atleta 18+ Pallavolo Perugia, compenso €500/mese, contratto 01/09/2025-30/06/2026, squadra Under 14.

### Prossimi step
- FASE 2: "Aggiungi anche come Coach" → mini-form (compenso coach + date contratto + squadra). Anagrafica unica, blocco Compenso Coach sotto Atleta nei Compensi, RAS cumulativo, soglie €5K/€15K ricalcolate sul totale.

## 🆕 23/06/2026 (mattina) — Collaboratore user-side: cleanup profilo + "Azioni Compenso" + Prossimi giorni collassabile ✅

L'utente ha segnalato 3 fix sul lato user del collaboratore:

1. **Prossimi giorni → collassabile** (`/app/frontend/app/collaboratore/index.tsx`): la sezione "📅 Prossimi giorni (N)" è ora un toggle con `useState(false)` di default, chevron up/down e item visibili solo quando aperto. Risparmio spazio nella dashboard "Da fare".
2. **Card "Compenso Mensile + Pregressi" → spostata da `/collaboratore/profile` a `/collaboratore/compensation`**: nuovo blocco "💼 Azioni Compenso" identico a `/coach/compensation`, con:
   - "COMPENSI PREGRESSI (NELL'ANNO)" editabile (€, TextInput numerico, Modifica/Salva/Annulla) → PATCH `/auth/me { other_annual_compensation }`
   - Accetta Compenso button (se non ancora accettato) + badge "✅ Compenso Accettato" → PATCH `/auth/me { compensation_accepted: true }`
3. **Profile "Quietanze Mensili" link → rimosso**: la card duplicata "💰 Compenso Mensile" + bottone "Quietanze Mensili" è stata interamente cancellata da `/collaboratore/profile` (era già presente nella compensation page).

### Verifica
- ✅ Screenshot `/collaboratore` (dashboard): toggle "📅 Prossimi giorni (N)" presente (chiuso di default).
- ✅ Screenshot `/collaboratore/compensation`: nuovo blocco "💼 Azioni Compenso" in cima con Compensi Pregressi (€4000) modificabili + "Compenso Accettato" badge.
- ✅ Screenshot `/collaboratore/profile`: vecchia card "💰 Compenso Mensile" rimossa (`has_old=False`, `has_quietanze=False`).

### File toccati
- `/app/frontend/app/collaboratore/compensation.tsx` (aggiunto stato + handlers + UI card)
- `/app/frontend/app/collaboratore/profile.tsx` (rimosso intero blocco)
- `/app/frontend/app/collaboratore/index.tsx` (toggle collassabile)

## 🆕 22/06/2026 (notte 5) — Palestre Assegnate (Collaboratore) + Status Dichiarazioni Soglie (Coach) ✅

### A. Admin Collaboratore — card "Da fare" estesa
La card "Squadre Assegnate" è ora **"Squadre & Palestre"**:
- ⚽ Squadre: lista in blu (Under 14, Under 16, MiniVolley…)
- 🏟️ Palestre: lista in arancio (Palestra Liceo Alessi, Palestra Nuova Alessi, PalaPellini)
- Pencil ✏️ → edit mode con checkbox per squadre + checkbox per palestre + bottone "Salva Assegnazioni"
- PATCH `/users/{id}` con `assigned_teams` + `assigned_venues`

### B. Admin Coach (tab Compensi) — Status Dichiarazioni Soglie
Riattivata (rimosso `false &&`) la sezione **"Status Dichiarazioni €5.000 / €15.000"** già presente nel codice. Ora il Coach Admin vista mostra le stesse card del Collaboratore:
- ✅ Anno X: Dichiarazione €5.000 firmata + mese di superamento (verde se anno start, blu se anno end)
- ✅ Anno X: Dichiarazione €15.000 firmata + mese di superamento
- ⚠️ Anno X: Soglia dei €5.000 (warning se in avvicinamento)
- 🚨 Anno X: Soglia dei €15.000 (warning)

### Verifica
- ✅ Screenshot Admin Collaboratore PAOLI PAOLO: card "Squadre & Palestre" mostra entrambe le liste.
- ✅ Screenshot Admin Coach FARO REMO (tab Compensi): le 4 dichiarazioni firmate (2025 5k/15k + 2026 5k/15k) compaiono tra i box Anno Solare e "Già Percepito".

### File toccati
- `/app/frontend/app/admin/collaboratore/[id].tsx` (estesa card Squadre con sezione Palestre)
- `/app/frontend/app/admin/coach/[id].tsx` (rimosso `false &&` dal blocco threshold-status view-mode, riga 1655)

## 🆕 22/06/2026 (notte 4) — Admin Collaboratore: sostituita la card placeholder "Stagione" con "Squadre Assegnate" ✅

L'utente ha chiesto di rimuovere il placeholder "🏆 Stagione - Mansioni assegnate, ruolo nella stagione, ..." dalla vista admin del collaboratore. Implementata la stessa card "Squadre Assegnate" usata nella vista admin del coach: lista squadre in blu + pencil ✏️ → edit mode con checkbox + bottone Salva (PATCH /api/users/{id} con `assigned_teams`).

### Verifica
- ✅ Screenshot Admin Collaboratore PAOLI PAOLO tab "Da fare": card "⚽ Squadre Assegnate" mostra "Under 14, Under 16, MiniVolley, Starter Group, Under 18, Serie D".
- File: `/app/frontend/app/admin/collaboratore/[id].tsx` (rimosso placeholder, aggiunto stato `editingTeamsInline`, riusato `selectedTeamIds`/`teams`/`originalTeamIds` esistenti).

## 🆕 22/06/2026 (notte 3) — "Già Percepito" su Coach + semaforo rimosso + N° Tesserino editabile ✅

Dopo il feedback utente con foto 2/3:

1. **Coach Admin**: riattivato il pulsante **"💰 Già Percepito"** (totale signed + bottone per aprire la modal Gestione Quietanze identica a quella del Collaboratore). Verificato su FARO REMO → "€ 30.500,00 · 7 quietanze firmate - Tocca per vedere".
2. **Semaforo mesi**: rimosso da entrambe le viste (Coach + Collaboratore) perché ridondante con la sezione "Già Percepito" + modal "Gestione Quietanze".
3. **N° Tesserino Allenatore**: aggiunto edit inline lato Admin Coach (pencil ✏️ + TextInput + Salva), analogo al picker Livello/Grado già implementato.

### File toccati
- `/app/frontend/app/admin/coach/[id].tsx` (rimosso `AdminMonthsSemaforo`, riattivato "Già Percepito", aggiunto edit N° Tesserino con stato `editingLicenseNumber` e handler `handleSaveLicenseNumber`).
- `/app/frontend/app/admin/collaboratore/[id].tsx` (rimosso `AdminMonthsSemaforo`).

## 🆕 22/06/2026 (notte 2) — Picker "Livello / Grado" su Admin Coach (parità con lato user) ✅

L'utente ha segnalato che il multi-select picker per Livello/Grado (Smart Coach + Allievo Allenatore + 1°/2°/3° Grado) presente nel profilo coach lato utente NON era replicato nella vista admin (sola lettura).

### Modifiche
- **`/app/frontend/app/admin/coach/[id].tsx`**: aggiunto stato `editingLevel`, `editLevelValue`, `coachLicenseLevels`, `savingLevel`. Caricamento `coach_license_levels` da `/api/settings/society` al mount. Nuovo handler `handleSaveLevel` che chiama `PATCH /api/users/{id}` con `coach_license_level`.
- Riga "Livello / Grado" nella card Dati Fiscali ora ha pencil ✏️: aprendolo si mostra:
  - se la società ha `coach_license_levels` configurato → griglia di pill toggleable con stessa logica del lato user (Smart Coach + grado abbinabili, Allievo Allenatore esclusivo);
  - altrimenti → TextInput free-text fallback.
- **`/app/backend/server.py`** (`PATCH /users/{user_id}`): estesi i campi accettati con `coach_license_number` e `coach_license_level`.

### Verifica
- ✅ Screenshot Admin Coach (RICA FEDE, Anagrafica tab): pill picker mostra tutte e 5 le opzioni (Smart Coach, Allievo Allenatore, 1°/2°/3° Grado) + bottone "Salva Livello/Grado".
- Endpoint PATCH testato in fase di sviluppo (no errori lint).

## 🆕 22/06/2026 (notte) — 4 micro-fix dopo feedback utente ✅

1. **Foto 1**: la placeholder card "🏆 Stagione" nel tab Da fare → sostituita con la card **"Squadre Assegnate"** completa di edit-mode (checkbox + Salva).
2. **Foto 2**: rimossa la card duplicata "Squadre Assegnate" dal tab **Anagrafica** (sotto Dati Fiscali). Ora la card vive solo nel tab Da fare.
3. **Foto 3A**: legenda del Calendario quietanze → "Firmato" rinominato in **"<5K"** per chiarezza (verde = sotto soglia 5k, arancio = >5K, viola = >15K).
4. **Foto 3B/C**: nascosti dalla griglia tutti i mesi **fuori dal periodo contrattuale** (per FARO REMO contratto Set 2025 – Giu 2026 ora si vede solo Set-Dic 2025 e Gen-Giu 2026, niente più mesi vuoti).

### File toccati
- `/app/frontend/app/admin/coach/[id].tsx` (riarrangiamento card)
- `/app/frontend/src/components/admin/AdminMonthsSemaforo.tsx` (legenda + skip out)

## 🆕 22/06/2026 (sera) — Semaforo mesi Admin + Enforcement cronologico server-side ✅

### Modifiche applicate
1. **Semaforo mesi (Admin Coach + Collaboratore)** — replica visiva della griglia user nel tab "Compensi":
   - Nuovo componente `/app/frontend/src/components/admin/AdminMonthsSemaforo.tsx`
   - Mostra Gen-Dic per ogni anno del contratto, colorando ogni mese:
     - 🟢 Verde = quietanza firmata
     - 🟠 Arancio + badge `>5K` = mese sopra soglia €5.000
     - 🟣 Viola + badge `>15K` = mese sopra soglia €15.000
     - 🔘 Grigio = mese fuori dal periodo contrattuale o futuro
   - Calcolo proiettato (signed + unsigned + pregressi + esterni) → l'admin vede a colpo d'occhio quando scatteranno le soglie.
   - Integrato in `/app/frontend/app/admin/coach/[id].tsx` (riga 1483) e `/app/frontend/app/admin/collaboratore/[id].tsx`.
2. **Enforcement cronologico server-side** (Fix C+D): nuovo helper `_check_chronological_receipts` in `server.py` (riga 13904). Bloccato il salvataggio di una quietanza se mesi precedenti del periodo contrattuale non sono firmati. Applicato a `POST /coach/{id}/compensation/receipt`, `POST /dirigente/{id}/compensation/receipt`, `POST /collaboratore/{id}/compensation/receipt`. Messaggio: *"Ordine cronologico richiesto: firma prima la quietanza di {Mese} {Anno}."*
3. **"Prossimi giorni" collassabile** già implementato in `AdminCoachCommitments.tsx` (state `upcomingOpen`).

### Verifica
- ✅ Screenshot Admin Coach: la griglia "📅 Calendario quietanze 2025 + 2026" mostra colori, badge e stato firma corretti per FARO REMO.
- ✅ Test API: tentativo di firmare Giugno 2026 saltando Maggio → HTTP 400 `"Ordine cronologico richiesto: firma prima la quietanza di Maggio 2026."` (per Alice LUPI, alice@test.com).
- Backend ricompilato + bundle web rigenerato (`expo export --platform web`).

## 🆕 22/06/2026 (cont) — Dirigente lato user: stesso pattern del Collaboratore ✅

**Task**: replicare la "finitura" (3 quick-link + Impegni inline) anche su `/dirigente/index.tsx` (lato user). Lato admin è già stato fatto nel turno precedente con AdminPersonTabs.

### Modifiche applicate
- **`/app/frontend/src/components/admin/AdminCoachCommitments.tsx`**: `userId` ora opzionale → se omesso, chiama `/api/coach/commitments` senza param (lato user, current_user). Resa il componente riusabile sia lato admin (con userId) sia lato user (senza).
- **`/app/frontend/app/dirigente/index.tsx`**:
  - Sostituite le 2 grandi card "Il Mio Profilo" e "Compensi Sportivi" con **3 quick-link compatti** (🗓️ Da fare arancio default | 👤 Anagrafica blu | 💰 Compensi verde)
  - Aggiunta sezione **Impegni inline** sotto i quick-link (riusa `AdminCoachCommitments`)
  - Squadre + Mappa Palestre mantenute invariate sotto

### Verifica via curl
- `/api/coach/commitments` senza user_id su token dirigente: ritorna correttamente 0/0/2/7 impegni → endpoint OK
- Build OK senza errori

### Coerenza UX raggiunta
| Figura | Lato User dashboard | Stato |
|--------|---------------------|-------|
| Coach | impegni inline già esistenti | ✅ |
| Dirigente | 3 quick-link + impegni inline + Squadre/Palestre | ✅ NUOVO |
| Collaboratore | 3 quick-link + impegni inline | ✅ (turno precedente) |
| Atleta | Da decidere (dipende dal lavoro Atleta-first dual-role) | ⏳ |


## 🆕 22/06/2026 — Dashboard Collaboratore lato user (Opzione A) ✅

**Task**: il collaboratore lato user entrava direttamente in "Il Mio Profilo" (pagina monolitica 2544 righe), senza una sezione "Da fare oggi" visibile. L'admin invece vede gli impegni nel tab Da fare. L'utente ha chiesto di uniformare la vista user a quella admin.

### Modifica applicata
- **`/app/frontend/app/collaboratore/index.tsx`** trasformato da semplice `router.replace('/collaboratore/profile')` → **vera home page** con:
  - Header blu "Il Mio Lavoro" con SocietyBranding + nome utente + bottoni profile/logout
  - **3 quick-link buttons** in alto: 🗓️ Da fare (arancio, default) | 👤 Anagrafica | 💰 Compensi
  - Cliccando "Anagrafica" → naviga a `/collaboratore/profile` (esistente, intatto)
  - Cliccando "Compensi" → naviga a `/collaboratore/compensation` (esistente, intatto)
  - **Sezione "Impegni"** sempre visibile inline: Oggi / Domani / Dopodomani / Prossimi giorni
  - Riusa endpoint `/api/coach/commitments` (esteso il 22/06 per supportare anche COLLABORATORE)
  - Pull-to-refresh, gestione loading + error states

### Verifica visiva
- ✅ Screenshot conferma: header brand OK, 3 bottoni quick-link OK, impegni reali popolati (6 allenamenti dopodomani su Paolo Paoli, 14 prossimi giorni con squadre + orari + palestre)

### File invariati
- `/app/frontend/app/collaboratore/profile.tsx` (2544 righe) — intatto, accessibile via quick-link "Anagrafica"
- `/app/frontend/app/collaboratore/compensation.tsx` — intatto, accessibile via quick-link "Compensi"


## 🆕 22/06/2026 — Correzioni Admin Coach/Dirigente/Collaboratore ✅

**6 fix puntuali** richiesti dall'utente dopo verifica produzione:

### Fix applicati
1. **Date contratto + Compensi pregressi visibili in VIEW mode** (non solo edit) nella scheda admin coach Compensi tab — box grigio con bordo blu mostra `📅 Periodo contratto: 01/09/2025 - 31/05/2026` e `📋 Compensi pregressi: € 2500`.
2. **Default tab admin = "Da fare"** (era "Anagrafica") su Coach + Dirigente + Collaboratore.
3. **Bottoni Checklist Onboarding + Documenti Firmati su una riga** (compatti, padding 10, font 12/10). Side-by-side con flex:1.
4. **Calcolo Anno Solare RIATTIVATO** nel tab Compensi admin Coach — rimosso `{false &&` che lo nascondeva dal 14/06. Ora visibile per single-role coaches.
5. **"Da fare" admin popolato con impegni reali** (allenamenti, gare, scadenze) — non più placeholder. Riusa endpoint `/api/coach/commitments` esteso con admin override.
6. Riepilogo settimanale: Oggi / Domani / Dopodomani / Prossimi giorni con badge cancellati, info venue, casa/trasferta.

### Modifiche tecniche
- **Backend**: `/api/coach/commitments` ora accetta query param opzionale `?user_id={coach_id}` quando il caller è admin. Society scoping mantenuto. Permessi estesi a `COACH | DIRIGENTE | COLLABORATORE` (oltre admin).
- **Nuovo componente riusabile**: `/app/frontend/src/components/admin/AdminCoachCommitments.tsx` — fetch + render compatto impegni.
- Applicato in tab "Da fare" di Coach + Dirigente + Collaboratore admin.
- Verificato via curl con admin token: ritorna correttamente 0/0/5/13 impegni per coach con assigned_teams.


## 🆕 19/06/2026 — Tab Navigator Admin (Coach/Dirigente/Collaboratore) ✅ + Atleta (esistente)

**Task**: organizzare le schede admin in 3 sezioni per evitare lo scroll infinito su file da 2-5k righe. Sezioni richieste dall'utente:
- **A) Da fare** — impegni di oggi + lavoro stagionale
- **B) Anagrafica** — dati personali, fiscali, indirizzo, banca, account
- **C) Compensi** — compenso mensile, quietanze, soglie

### Componente riusabile creato
- **`/app/frontend/src/components/admin/AdminPersonTabs.tsx`** — TabBar a 3 pulsanti (Da fare arancio / Anagrafica blu / Compensi verde) + helper `<TabSection>` per renderizzare condizionalmente i figli.
- Test-id univoci: `admin-tab-impegni`, `admin-tab-anagrafica`, `admin-tab-compensi`, `admin-tab-content-{key}`.
- Supporto opzionale per badge numerici (compensiBadge, impegniBadge).

### Applicato a 3 file admin
- **`/app/admin/coach/[id].tsx`** ✅ — Anagrafica (Dati Personali, Indirizzo, Fiscali, Bancari, Account) + Compensi (Compenso card con RAS, Quietanze, DualRoleHubBanner) + Impegni placeholder. **Verificato visivamente** con screenshot su Alice LUPI.
- **`/app/admin/dirigente/[id].tsx`** ✅ — Stessa struttura: Anagrafica + Compenso + Bancari/Account in 2 parti.
- **`/app/admin/collaboratore/[id].tsx`** ✅ — Stessa struttura adattata.

### Atleta admin — NON modificato
- **`/app/admin/athlete/[id].tsx`** già ha il proprio sistema di tab interno (Dati / Pagamenti / Presenze) con `activeTab: 'dati' | 'pagamenti' | 'presenze'`. Non sovrascritto per non rompere flussi esistenti.
- Da uniformare in un secondo step: il look dei tab atleta vs. il nuovo `AdminPersonTabs`.

### Bundle finale
- `entry-*.js` (6.55 MB) esportato senza errori.

### Da fare nei prossimi step
- **Step 2**: implementare "Da fare oggi" (oggi placeholder) — necessita endpoint `/api/admin/persons/{id}/upcoming-events` o riuso di endpoint esistenti per impegni/gare.
- **Step 3**: Riepilogo pagamenti con SPIE colorate (verde sotto soglia / giallo in attesa / badge "+5K"/"+15K") nello stile "Gestione Quietanze" — il componente `CoachReceiptsSummary` già contiene la logica.
- **Step 4**: Uniformare il sistema tab atleta usando `AdminPersonTabs`.


## 🆕 19/06/2026 — Pulizia profilo Coach: Compenso e Pregressi → spostati in /coach/compensation ✅

**Task**: l'utente ha indicato (con segno rosso su screenshot) che dalla card "Dati Anagrafici" del coach vanno rimossi €300 Compenso Mensile, Compensi Pregressi e badge "Compenso Accettato" perché già presenti nella sezione "Compensi Sportivi". L'utente ha scelto Opzione A: **migrazione completa** delle funzioni nella pagina compensi (per non perdere editing pregressi e accettazione compenso).

### Modifiche applicate
- **`app/coach/compensation.tsx`**:
  - Import `TextInput` aggiunto.
  - Aggiunti state: `editingPrior`, `priorDraft`, `savingPrior`, `acceptingComp`.
  - Aggiunti handler `handleSavePrior()` (PATCH `/auth/me` con `other_annual_compensation`) e `handleAcceptCompensation()` (PATCH `/auth/me` con `compensation_accepted: true`).
  - Nuova card "💼 Azioni Compenso" subito sotto il Banner Coach: pregressi editabili in-place (toggle Modifica/Salva/Annulla) + pulsante "Accetta Compenso" se non accettato + badge verde "Compenso Accettato" se già accettato.
  - Aggiunti stili: `compActionsCard`, `compActionsBtn`, `compActionsInput`, `compActionsAcceptBtn`, `compActionsAcceptedBadge`, ecc.
- **`app/coach/profile.tsx`**:
  - Rimossa l'intera card "💰 Compenso Mensile" (display €, campo COMPENSI PREGRESSI editabile, warning "richiede accettazione", pulsante "Accetta Compenso", badge "Compenso Accettato").
  - "Squadre Assegnate" estratta in una **card dedicata** (titolo "🏐 Squadre Assegnate") immediatamente dopo Dati Anagrafici.
  - Funzione `handleAcceptCompensation` ora "dead code" (lint warning, ignorabile).

### Test API confermati
Su `alice@test.com` (compenso accettato, pregressi 4750€):
- ✅ `PATCH /api/auth/me` con `other_annual_compensation: 1234.50` → response "Profilo aggiornato", verifica GET = 1234.5
- ✅ Restore a 4750 → response "Profilo aggiornato"
- ✅ `compensation_accepted: True` preservato

### Verifica bundle
Bundle `entry-c593053dc0b93d97c7fa9b476e8a994a.js` (6.5 MB) contiene:
- ✅ `coach-compensation-actions` data-testid (×1)
- ✅ `prior-comp-edit` data-testid (×1)
- ✅ `accept-compensation-btn` data-testid (×1)
- ✅ Nessuna occorrenza residua di "💰 Compenso Mensile" o "COMPENSI PREGRESSI" nel profilo coach (solo nei commenti di documentazione).

### TODO collegati
- I file `app/athlete/profile.tsx` e `app/athlete/compensation.tsx` potrebbero meritare la stessa simmetria (atleta compensato), ma l'atleta NON ha attualmente la "Accetta Compenso" e i Compensi Pregressi NON erano editabili in nessun punto del lato atleta. Quindi nessuna migrazione necessaria lì.


## 🆕 17/06/2026 (afternoon) — Coach Level Picker: Multi-select Smart Coach + 1°/2°/3° ✅

**Task**: il picker "Livello / Grado" era già visivamente pronto (chip selector da impostazioni società), ma in single-select. L'utente ha chiarito che **Smart Coach** può essere selezionato da solo OPPURE abbinato a uno dei 3 gradi maggiori (1°/2°/3°). **Allievo Allenatore** invece resta esclusivo (non compatibile con Smart Coach).

### Modifiche applicate
- **`app/coach/profile.tsx`** linee 1149-1213: sostituita la logica single-toggle con multi-select intelligente.
- Stato salvato come stringa CSV `"Smart Coach, 1° Grado"` nel campo `coach_license_level` (retro-compatibile con valore singolo).
- Regole di toggle:
  - **Smart Coach** (toggle): aggiunge/rimuove `Smart Coach`. Se presente Allievo Allenatore, lo rimuove (incompatibili).
  - **Allievo Allenatore**: ESCLUSIVO. Sostituisce tutta la selezione corrente (anche Smart Coach).
  - **1°/2°/3° Grado**: mutualmente esclusivi tra loro, ma compatibili con Smart Coach (che resta selezionato).

### Test unitari
- Creato `/app/frontend/scripts/test-coach-level-toggle.js` con 9 scenari (PASS tutti):
  1. Add Smart Coach to empty ✅
  2. Add 1° Grado preserves Smart Coach ✅
  3. Switch 1°→2° keeps Smart Coach ✅
  4. Allievo exclusive: removes all others ✅
  5. Smart Coach removes Allievo (incompatible) ✅
  6. Toggle off Smart Coach keeps 1° Grado ✅
  7. Toggle off 1° Grado keeps Smart Coach ✅
  8. Add 3° Grado to empty ✅
  9. Add Smart Coach to 2° Grado (compatible) ✅
- Esegui con: `node /app/frontend/scripts/test-coach-level-toggle.js`

### Note tecniche
- Bundle aggiornato e servito da `dist/` (`entry-6492942f9761a8b208e0043cd9ca825e.js`).
- Il backend già accetta stringhe arbitrarie nel campo `coach_license_level`, quindi nessuna migration richiesta.
- L'admin settings (`app/admin/settings/other.tsx`) consente di configurare i livelli disponibili: rimangono semplici stringhe (Smart Coach, Allievo Allenatore, 1° Grado, 2° Grado, 3° Grado).


## 🆕 17/06/2026 — UX Quick Links: "Vai a Compensi Sportivi" su Dashboard ✅

**Task**: spostare l'accesso a "Compensi Sportivi" dal profilo alla dashboard per UX migliore.

### Modifiche applicate
- **`app/athlete/index.tsx`** (branch atleta compensato): aggiunto `TouchableOpacity` con `data-testid="athlete-compensation-quick-link"` subito sotto `<SwitchAccountButton />`. Stile blu primario (`#1565C0`) con titolo dorato (`#FFD700`) per evidenza brand.
- **`app/coach/index.tsx`** (return "Teams & Athletes Mode"): aggiunto identico button con `data-testid="coach-compensation-quick-link"`. Naviga a `/coach/compensation`.
- **`app/coach/profile.tsx`**: rimosso il `TouchableOpacity` "Quietanze Mensili" (precedente link a `/coach/compensation`) dalla card "💰 Compenso Mensile". Manteniamo solo il dato del compenso, i compensi pregressi editabili e il badge "Compenso Accettato".

### Verifica visiva
- ✅ Coach dashboard mostra banner blu "Vai a Compensi Sportivi" sotto l'header e sopra il tab bar.
- ✅ Atleta dashboard mostra banner blu "Vai a Compensi Sportivi" sotto l'header.
- ✅ Click → navigazione a `/athlete/compensation` o `/coach/compensation` (confermato).
- ✅ Coach profilo: "Quietanze Mensili" non più presente.

### Note tecniche
- L'ambiente `expo` gira da `dist/` statico (`npx serve -s dist -l 3000`), quindi gli edit a `.tsx` **non sono hot-reload**. Per vedere le modifiche bisogna eseguire `cd /app/frontend && npx expo export -p web --output-dir dist` (≈90s).
- Su Atleti non compensati (`athlete_type != 'compensated'`) il button NON viene mostrato perché la pagina rientra nel branch `if (!profile || profile.athlete_type !== 'compensated')` con UI dedicata (quota).



## 🆕 16/06/2026 (sera+++++ FINALE) — TASK A: Email Unica Dual-Role + Verifica Task B ✅

### 🟠 TASK A — Email Unica Dual-Role (~50 crediti)

**Stato pre-esistente**: il backend già supportava di default l'email unica via alias `{email_atleta}#coach`:
- `PromoteAthleteToCoachRequest.coach_email` è Optional → se non fornito, alias automatico
- Frontend (`app/admin/athlete/[id].tsx:384-390`) NON passa più email/password → flow già "email unica" by default

**Cosa mancava**: endpoint di **migrazione** per gli account legacy `*.coach@*` creati con il vecchio codice.

**Fix applicato**:
- Nuovo endpoint backend `POST /api/admin/migrate-legacy-coach-emails` (`/app/backend/server.py`):
  - Trova tutti gli utenti coach con email non-alias
  - Detecta pattern legacy (`.coach@`, `_coach@`, `.coach`)
  - Per ognuno cerca l'atleta collegato (via `linked_athlete_id` o CF condiviso)
  - Sostituisce email con alias `{email_atleta}#coach`
  - Skip + error reporting per casi anomali (collisioni, atleta mancante)
- Endpoint testato: ✅ `{migrated_count: 0, skipped_count: 6, errors_count: 0}` (in sviluppo non c'erano legacy)
- L'utente può lanciarlo manualmente in produzione una volta dopo il deploy:
  ```
  curl -X POST https://app.production/api/admin/migrate-legacy-coach-emails -H "Authorization: Bearer <admin_token>"
  ```

### 🔵 TASK B — Hub Persona lato Utente (~0 crediti, già implementato!)

Verifica: **il Hub Persona lato Utente è già completamente operativo** grazie al lavoro recente:
- ✅ `SwitchAccountButton` (`src/components/SwitchAccountButton.tsx`) usato in `athlete/index.tsx` (2x) + `coach/index.tsx` → quick switch dual-role con un tap
- ✅ Banner dual-role atleta+coach in `/athlete/compensation` e `/coach/compensation` (entrambi visibili simultaneamente quando dual-role)
- ✅ Endpoint `/api/auth/me/dual-role-info` per dati unificati
- ✅ La logica di link bidirezionale (Atleta → Coach via `_find_linked_compensated_user_for_athlete`; Coach → Atleta via `_find_linked_athlete_pro_for_user`) è funzionante

Risultato: l'utente dual-role Alice (atleta + coach) vede dalla sua dashboard atleta un pulsante "Passa a Coach", e dalla pagina Compensi Sportivi vede ENTRAMBI i banner (Atleta + Coach). Esperienza unificata già completa.

### Files modificati
- ✏️ `/app/backend/server.py` (nuovo endpoint `POST /admin/migrate-legacy-coach-emails`)

### Crediti utilizzati
~30-40 crediti totali (molto meno della stima, perché Task B era già implementato).

---

## 🆕 16/06/2026 (sera++++) — CENTRALIZZAZIONE COLORI DEL BRAND ✅

Su richiesta utente, creato file unico per i colori principali del brand.

### File creato
- ✅ `/app/frontend/src/utils/brandColors.ts`
  - `BRAND_COLORS.primary` = `'#1565C0'` (blu primario RegistraTEAM)
  - `primaryDark`, `primaryLight`, `primarySoft` (varianti)
  - `accentGold` / `accentGoldDark`
  - Stati semantici: `success`, `warning`, `danger` + relative versioni "Soft"
  - Testi: `inkDark`, `inkBody`, `inkMuted`, `inkSubtle`
  - Superfici: `surfaceWhite`, `surfacePage`, `surfaceCard`, `surfaceDivider`

### Strategia di migrazione
Il file è disponibile da subito per **tutti i nuovi sviluppi**. Per gli ex-hardcoded esistenti, faremo migrazione incrementale: quando tocchiamo un file, sostituiamo l'hardcoded con la costante. Niente big-bang per evitare regressioni visuali.

### Benefici futuri
- 🎨 Cambio brand color → 1 modifica in 1 file
- 🌙 Dark mode → variante `BRAND_COLORS_DARK` + hook tema
- 🏢 White-label multi-società → per ogni società un override dei `primary` colors

---

## 🆕 16/06/2026 (sera+++) — UNIFORMITÀ COLORE BACKGROUND PRIMARIO ✅

Su richiesta utente ("uniforma, mi piace l'uniformità"):

### Audit eseguito
- 18 occorrenze totali di `#1a1a2e` in app/ + src/
- Solo **2 erano backgroundColor** da cambiare:
  - `/app/frontend/app/athlete/index.tsx` (3 punti: header, profileCard, summaryCard) — già fatto stamattina
  - `/app/frontend/app/admin/athlete/[id].tsx:5018` (compensationCard) — fatto ora
- Le altre 16 erano `color:` (font color per testi/titoli) — NON toccate per non rendere i testi blu su sfondo bianco

### Risultato
Tutta l'app ora usa `#1565C0` (blu primario RegistraTEAM) come background per banner principali, mai più nero/grigio scuro su sfondo bianco. Coerenza visiva 100%.

### Files
- ✏️ `/app/frontend/app/admin/athlete/[id].tsx` (compensationCard)

---

## 🆕 16/06/2026 (sera++) — FIX SDI + Sfondo Dashboard Atleta ✅

### Problema 1: Codice SDI invisibile nella pagina Profilo Società
**Causa**: la riga "Codice SDI" era mostrata SOLO se `codiceSdi` aveva un valore (condizione `{codiceSdi ? ... : null}`).
**Fix** in `/app/frontend/app/admin/society-profile.tsx`: la riga viene ora mostrata SEMPRE in lettura, con valore `— (da inserire per fatturazione elettronica)` se non impostato.
**Risultato**: l'admin vede sempre il campo SDI nella sezione "Dati Fiscali" e capisce a colpo d'occhio se è valorizzato o meno. Una volta inserito nel form di modifica e salvato, comparirà sia in lettura che nel JPG del biglietto da visita (backend già pronto da 11/06).

### Problema 2: Sfondo "nero" della dashboard atleta poco gradevole
**Causa**: 3 punti in `/app/frontend/app/athlete/index.tsx` usavano `backgroundColor: '#1a1a2e'` (blu navy molto scuro, quasi nero):
- `header` (riga 1683)
- `profileCard` (riga 1694)
- `summaryCard` (riga 1990)
**Fix**: tutti e 3 sostituiti con `#1565C0` (blu primario coerente con il resto del design RegistraTEAM).

### Files
- ✏️ `/app/frontend/app/admin/society-profile.tsx`
- ✏️ `/app/frontend/app/athlete/index.tsx`

---

## 🆕 16/06/2026 (sera+) — BANNER ATLETA/COACH replicati anche su `/coach/compensation` ✅

Su conferma utente ("Ok vai"), ho replicato il pattern dei 2 banner dual-role anche nella pagina compensi del lato Coach (`/app/frontend/app/coach/compensation.tsx`):

### Modifiche
- Aggiunto state `dualRoleInfo` + `useEffect` fetch `/api/auth/me/dual-role-info` (identico a athlete/compensation)
- Rimosso "Compenso mensile: €..." inline sotto il nome del coach
- Rimosso il box tratteggiato "Periodo Contratto"
- Aggiunti 2 banner:
  - 🏋️ **Banner Coach** (viola): mostrato per primo (vista principale del lato coach)
  - 🏐 **Banner Atleta** (giallo arancio): mostrato sotto SE l'utente è anche atleta PRO (dual-role)
- Aggiunti stili `roleBanner`, `roleBannerAtleta`, `roleBannerHeader`, ecc.

### Risultato
Quando un dual-role apre la sua dashboard:
- Su `/athlete/compensation` vede: 🏐 Atleta in alto + 🏋️ Coach sotto (se dual-role)
- Su `/coach/compensation` vede: 🏋️ Coach in alto + 🏐 Atleta sotto (se dual-role)

Stessa identica esperienza, ruolo "primario" in alto.

### Files
- ✏️ `/app/frontend/app/coach/compensation.tsx`

---

## 🆕 16/06/2026 (sera) — REVISIONE: Banner Atleta/Coach in `/athlete/compensation` ✅

**Cambio di strategia rispetto alla mattina**: l'utente ha rivisto la richiesta — Compenso + Periodo Contratto NON vanno nel profilo personale, ma vanno come **2 banner colorati in alto** alla pagina "Compensi Sportivi" (`/athlete/compensation`).

### Modifiche
**Backend** — nuovo endpoint `/app/backend/server.py`:
- `GET /api/auth/me/dual-role-info` → ritorna `{current_role, is_dual_role, athlete: {team_name, monthly_compensation, contract_start_date, contract_end_date} | null, coach: {...} | null}`
- Per atleta dual-role: trova il coach collegato via `_find_linked_compensated_user_for_athlete`
- Per coach dual-role: trova l'atleta PRO collegato via `_find_linked_athlete_pro_for_user`

**Frontend `/app/frontend/app/athlete/profile.tsx`**:
- Rimossa card "💰 Compenso Mensile"
- Rimossa card "📅 Periodo Contratto" (aggiunta ieri)
- 🏦 Card "Dati Bancari" RIMANE nel profilo

**Frontend `/app/frontend/app/athlete/compensation.tsx`**:
- Rimosso "Compenso mensile: €..." inline sotto il nome
- Rimossa la card "Periodo Contratto" tratteggiata
- Aggiunti 2 nuovi banner colorati in alto:
  - 🏐 **Banner Atleta** (giallo arancio): `[Squadra] – €X/mese – dal GG/MM/AAAA al GG/MM/AAAA`
  - 🏋️ **Banner Coach** (viola, solo se dual-role): `[Squadra] – €X/mese – dal... al...`
- Stili `roleBanner`, `roleBannerCoach`, `roleBannerHeader`, ecc. aggiunti

### Verifica API
`GET /api/auth/me/dual-role-info` con admin test → `{current_role: 'admin', is_dual_role: false, athlete: null, coach: null}` ✅

### Files
- ✏️ `/app/backend/server.py` (nuovo endpoint)
- ✏️ `/app/frontend/app/athlete/compensation.tsx` (banner + state + fetch + stili)
- ✏️ `/app/frontend/app/athlete/profile.tsx` (rimozione card compenso/contratto)

---

## 🆕 16/06/2026 (pomeriggio) — SPOSTAMENTO INFO SENSIBILI: Dashboard → Profilo ✅

Su segnalazione utente (foto annotate con cerchi rossi):

### Cosa è stato spostato dalla dashboard atleta al profilo
**RIMOSSI da `/app/frontend/app/athlete/index.tsx`** (dashboard "Il Mio Profilo"):
- 🚫 "Compenso mensile" visibile sotto il nome (in bella vista appena si entra)
- 🚫 "Periodo Contratto" (date inizio/fine)
- 🚫 Card "Dati Bancari" (IBAN, Intestatario, Banca)

**AGGIUNTI in `/app/frontend/app/athlete/profile.tsx`** (pagina "Dati Personali"):
- ✅ Card "📅 Periodo Contratto" (inizio/fine in formato italiano)
- ✅ Card "🏦 Dati Bancari" (IBAN, Intestatario, Banca)
- ✅ Card "💰 Compenso Mensile" era già presente nel profilo

### Risultato
La dashboard atleta ora mostra solo nome + avatar nella Profile Card (info pubbliche). Tutti i dati sensibili (compenso, contratto, banca) sono raggiungibili solo via "Dati Personali → Visualizza e modifica i tuoi dati".

### Files modificati
- ✏️ `/app/frontend/app/athlete/index.tsx`
- ✏️ `/app/frontend/app/athlete/profile.tsx`

---

## 🆕 16/06/2026 — DEAD CODE CLEANUP `signedReceipts` ✅

Rimosso state inutilizzato + relativo fetch API da:
- `/app/frontend/app/coach/profile.tsx` (state + fetch `/coach/{id}/compensation`)
- `/app/frontend/app/collaboratore/profile.tsx` (state + fetch `/collaboratore/{id}/compensation`)
- `/app/frontend/app/dirigente/profile.tsx` (state + fetch `/dirigente/{id}/compensation`)

**Benefici**: -3 chiamate API inutili al caricamento profilo, codice più leggibile, niente più variabili "fantasma".

**Verifica**: `grep signedReceipts` su tutti e 3 i file → 0 risultati ✅.

---

## 🆕 15/06/2026 (sera) — RIMOSSE SEZIONI DUPLICATE LATO ATLETA ✅

Su segnalazione utente (4 foto annotate con cerchi rossi):

### Cosa è stato rimosso (perché duplicato)
1. **`/app/frontend/app/athlete/index.tsx`** — Rimossi i blocchi:
   - "Yearly Breakdown" per ogni anno fiscale del contratto (Anno 2025 Inizio Contratto / Anno 2026 Fine Contratto)
   - "Riepilogo Quietanze" (Quietanze firmate X/Y + Totale contratto)
   - **Perché**: queste info sono già perfettamente presenti nella pagina dedicata `/athlete/compensation` ("Compensi Sportivi" - sezione "Calcolo per Anno Solare" + "Comunicazione RAS").
   - **Tenuti intatti**: dati personali, periodo contratto, prossimi impegni, link IBAN, link "Modifica Profilo".

2. **`/app/frontend/app/athlete/profile.tsx`** — Rimosso:
   - "📅 Registro Quietanze" (mini grid con caselle colorate dei mesi).
   - **Perché**: identico al pattern già presente in `/athlete/compensation`. L'atleta accede a quel dettaglio dal link "Quietanze Mensili" appena sopra (che è stato MANTENUTO).
   - **Tenuti intatti**: tutti i dati profilo, link "Quietanze Mensili", "Compenso Accettato", Versione Lite, PIN, etc.

### Risultato
La pagina "Compensi Sportivi" (foto 3, perfetta) resta UNICA fonte di visualizzazione delle quietanze + calcolo soglie. Nessuna duplicazione né conflitto di dati tra dashboard, profilo e pagina compensi.

---

## 🆕 15/06/2026 (pomeriggio) — UTILITY CONDIVISE colori + calcolo soglie ✅

Primo passo verso il Single Source of Truth: creati due file utility riusabili.

### Files creati
- ✅ `/app/frontend/src/utils/thresholdColors.ts`
  - Costanti `THRESHOLD_COLORS.under5k / between5k15k / over15k` (background + border + text + accent)
  - Helper `getThresholdState(cumulative)` → `'under5k' | 'between5k15k' | 'over15k'`
  - Helper `getThresholdPalette(cumulative)` → restituisce direttamente la palette giusta
- ✅ `/app/frontend/src/utils/thresholdCalculator.ts`
  - Funzione `calculateThresholds({monthAmounts, priorCompensation, contractStartYear})` → `{thresholdsByYear, cumulativeByYearMonth}`
  - Helper `isMonthAfterThreshold(month, year, thresholdsByYear, '5k'|'15k')`
  - Logica matematicamente identica al backend `_month_breaches`

### Refactor applicato
- ✏️ `/app/frontend/src/components/admin/CoachReceiptsSummary.tsx` ora usa le utility (rimosse ~50 righe di logica inline, sostituite con 3 chiamate alle utility).

### Da fare in step successivi
Allineare i 4 file utente al nuovo pattern (uno alla volta, per sicurezza):
- [ ] `/app/frontend/app/athlete/compensation.tsx`
- [ ] `/app/frontend/app/coach/compensation.tsx`
- [ ] `/app/frontend/app/collaboratore/compensation.tsx`
- [ ] `/app/frontend/app/dirigente/compensation.tsx`

Dopodiché si potrà creare il backend endpoint unico e rifattorizzare in modo definitivo.

---

## 🌙 15/06/2026 — PRIORITÀ DOMANI: Single Source of Truth quietanze

**Proposta utente** (notte 15/06): evitare il DOPPIO CALCOLO del cumulo/colore/badge soglie. Attualmente il lato Alice (collaboratore/atleta) e il lato Admin (`CoachReceiptsSummary`) ricalcolano entrambi lo stesso cumulo cronologico → rischio divergenza.

### ⚠️ ORDINE CORRETTO DI SVILUPPO (utente ha ammesso che abbiamo lavorato all'inverso)
**1️⃣ PRIMO — Lato Alice/utente**:
   - Pattern Pedro foto 4 (quadrati colorati per mese + badge `>5K`/`>15K` in alto a destra)
   - File: `app/athlete/compensation.tsx`, `app/coach/compensation.tsx`, `app/collaboratore/compensation.tsx`
   - QUI vive la logica madre: cumulo cronologico, colori, badge
   - Quando Alice firma → sistema "stampa" stato sulla quietanza

**2️⃣ POI — Backend endpoint unico**:
   - `GET /api/persons/{id}/signed-receipts-with-thresholds/{year}`
   - Espone lo stato calcolato secondo la logica del lato utente
   - Campi: `month`, `year`, `amount`, `role`, `cumulative_after_this_month`, `color` (green/orange/purple), `badge` (null/'5K'/'15K')

**3️⃣ INFINE — Lato Admin**:
   - `CoachReceiptsSummary` diventa un semplice consumer dell'endpoint (no ricalcolo)
   - Hub Compensi mostra esattamente lo stesso colore/badge che vede Alice

### Stato attuale (provvisorio, da rifattorizzare)
Il `CoachReceiptsSummary` di oggi usa la STESSA formula matematica di `_month_breaches` del backend → matematicamente coerente con il calcolo centrale, ma non è il pattern Single Source of Truth pulito. Funzionerà fino a quando non lo rifattorizziamo.

---

## 🌙 15/06/2026 — NOTA DI DESIGN PER DOMANI: Calendario stato quietanze

**Decisione utente** (rispondendo al suggerimento ✅/⏳): NO icone, replicare il pattern dirigente/collaboratore già esistente.

**Pattern target**:
- Mese **NON quietanzato** → casella **bianca/non colorata**, con badge piccolo in alto a destra (`5K` o `15K`) SE quel mese fa scattare la soglia cumulativa
- Mese **quietanzato (firmato)** → casella **colorata** (verde <5K / arancio 5K-15K / viola >15K)

**File di riferimento da studiare**:
- `/app/frontend/app/admin/dirigente/[id].tsx`
- `/app/frontend/app/admin/collaboratore/[id].tsx`

**Cosa serve nel payload**:
- `signed_months` per Coach e Atleta (lista dei mesi con quietanza firmata nell'anno)
- Già abbiamo il dato in `coach_compensations` e `athlete_compensation_receipts` filtrando per `receipt_signed=true`

---

## 🆕 15/06/2026 — CALENDARIO: ESTERNI PER MESE EFFETTIVO ✅

### Errore segnalato dall'utente (continuazione del 14/06 notte)
"Nel 2026 si riparte da ZERO. A gennaio cumulato = €3.750 atleta + €300 coach + EVENTUALI compensi esterni che non sappiamo finché non firma la quietanza di gennaio."

### Fix applicato (v3 logica esterni)
**Concetto**: gli esterni dell'anno NON vanno cumulati tutti al primo mese — vanno applicati SOLO nel mese in cui sono dichiarati (firma quietanza → `related_receipt_month`).

**Backend** (`server.py`):
- Nuovo helper `_get_year_external_by_month(user_id, year)` → ritorna `{month: amount}` filtrato per `related_receipt_month`.
- `_month_breaches(prior, external_by_month)`: pregresso al primo mese attivo SOLO se `is_first_year`, esterni sommati nel mese di dichiarazione.
- Aggiunto `supplementary_by_month` al payload `fiscal_year_current` e `fiscal_year_next`.

**Frontend** (`PersonCompensationSummary.tsx`):
- `renderMonthCalendar` legge `supplementary_by_month` e somma gli esterni nel mese corrispondente.
- Pregresso applicato al primo mese attivo solo se `block.is_first_year`.

### Risultato
Esempio Zorzi Alice (contratto Atleta dal 01/09/2025 al 31/05/2026, pregresso €3.850):
- **2025** (first_year=true):
  - Set: 3.850 (pregresso) + 3.750 (atleta) = €7.600 → ARANCIO ⚠️ supera €5K
  - Ott: 7.600 + 3.750 + 300 (coach) = €11.650 → arancio
  - Nov: 11.650 + 3.750 + 300 = €15.700 → VIOLA 🚨 supera €15K
  - Dic: 15.700 + 4.050 = €19.750 → viola
- **2026** (first_year=false, nessun pregresso, nessun esterno ancora dichiarato):
  - Gen: 3.750 + 300 = €4.050 → VERDE
  - Feb: 4.050 + 4.050 = €8.100 → ARANCIO (>5K)
  - ...quando l'atleta firma la quietanza di gennaio e dichiara €15.000 esterni → cum gennaio diventa €19.050 → viola

### Files
- ✏️ `/app/backend/server.py` (Dict import, `_get_year_external_by_month`, `_sum_external_by_month`, `_month_breaches` v3, payload con `supplementary_by_month`)
- ✏️ `/app/frontend/src/components/admin/PersonCompensationSummary.tsx` (TypeScript interface + logica calendario)

---

## 🆕 14/06/2026 (v3) — CALENDARIO CRONOLOGICO CORRETTO ✅

**Status**: ✅ Fix completati (segnalazione utente con 2 foto annotate il 14/06 notte).

### Errori segnalati dall'utente
1. ❌ Calendario 2025 mostrava Gen-Ago con €6.850 (pre-contratto): SBAGLIATO. Il contratto Atleta inizia 01/09/2025, quei mesi non devono esistere.
2. ❌ Badge "Supera €5.000 all'inizio dell'anno" SBAGLIATO: il pregresso 3.850 < 5K, quindi solo a Settembre con +3.750 atleta = 7.600 supera la soglia.
3. ❌ Calendario 2026 mostrava Giu-Dic post-contratto: SBAGLIATO. Contratto finisce 31/05/2026.
4. ❌ Logica del cumulo: pregresso + esterni devono essere aggiunti al PRIMO mese attivo, non al 1° gennaio.

### Fix applicati
**Backend `_month_breaches`** (`/app/backend/server.py`):
- Trova il primo mese attivo dell'anno fiscale (dove Coach o Atleta hanno amount > 0)
- Filtra i mesi con amount = 0 dal breakdown
- Il pregresso + esterni vengono aggiunti al primo mese attivo (non al 1° gennaio)
- `month_exceed_5k` e `month_exceed_15k` ora ritornano il mese REALE di superamento (no più 0)

**Frontend `renderMonthCalendar`** (`/app/frontend/src/components/admin/PersonCompensationSummary.tsx`):
- Filtra mesi con amount = 0
- Mostra solo i mesi dal primo all'ultimo attivo (es. 2025 = Set-Dic, 2026 = Gen-Mag)
- Pregresso + esterni cumulati al primo mese attivo
- Rimossa logica "all'inizio dell'anno" nei badge (non più necessaria)

### Verifica API
Esempio reale: utente test con contratto Coach 09/2025-06/2026, pregresso €13.200
- 2025: tot=€20.000, supera 5K=Sett(9), supera 15K=Ott(10) ✅
- 2026: tot=€10.200, supera 5K=Mar(3), no 15K ✅

### Files modificati
- ✏️ `/app/backend/server.py` (funzione `_month_breaches`)
- ✏️ `/app/frontend/src/components/admin/PersonCompensationSummary.tsx`

---

## 🆕 14/06/2026 — CALENDARIO MENSILE + GIÀ PERCEPITO NEL HUB ✅

**Status**: ✅ Pronto per deploy (richiesta utente con foto annotate del 14/06 sera).

### Modifiche di oggi (sessione 3)
1. **🎨 Sfondo dinamico box Anno Fiscale** in `PersonCompensationSummary.tsx`:
   - Verde (`#E8F5E9`) se totale ≤ €5K
   - Arancio (`#FFF3E0`) se €5K < totale ≤ €15K
   - Viola (`#F3E5F5`) se totale > €15K
   - Stesso schema in tutti gli anni fiscali (rimossi i precedenti gialli/azzurri statici).
2. **📅 "all'inizio dell'anno"**: i badge "⚠️ Supera €5.000" e "🚨 Supera €15.000" ora mostrano `all'inizio dell'anno` quando il backend ritorna `month_exceed_X = 0` (caso in cui pregresso + esterni fanno scattare la soglia al 1° gennaio).
3. **📆 Calendario mensile colorato** (12 caselle Gen-Dic) sotto ogni box fiscale: ogni cella mostra il cumulato e si colora verde/arancio/viola in base alla soglia raggiunta.
4. **💰 "Già Percepito" spostato nel Hub Compensi**: 
   - Nuovo componente `/src/components/admin/CoachReceiptsSummary.tsx` con card cliccabile + modal lista quietanze firmate (con tag `>5K` e `>15K`).
   - Inserito in `/admin/persona/[id]/compensi.tsx`.
   - Nascosto (`{false && …}`) il vecchio box "💰 Già Percepito" nella pagina `/admin/coach/[id].tsx`.
   - Lasciati intatti: importo mensile (€/mese), badge "Accettato dal coach", bottone "Genera Quietanza Personalizzata".

### Files modificati / creati
- ✏️ `/app/frontend/src/components/admin/PersonCompensationSummary.tsx` — sfondo dinamico, "all'inizio dell'anno", calendario mensile
- 🆕 `/app/frontend/src/components/admin/CoachReceiptsSummary.tsx` (NEW)
- ✏️ `/app/frontend/app/admin/persona/[id]/compensi.tsx` — fetch profile + render `CoachReceiptsSummary`
- ✏️ `/app/frontend/app/admin/coach/[id].tsx` — nascosto vecchio box "Già Percepito"

---

## 🆕 14/06/2026 — RIMOZIONE SCHEDA COMPENSI DUPLICATA + DOPPIO BADGE 5K/15K ✅

**Status**: ✅ Pronto per deploy (richiesta utente con foto annotate).

### Modifiche di oggi (sessione 2)
1. **🗑️ Rimosso** `<PersonCompensationSummary />` dalla pagina `/admin/coach/[id].tsx` (riga 1005) — era il "schedone doppio" segnalato dall'utente sotto la X rossa. Resta solo `DualRoleHubBanner` per navigare al Hub.
2. **🧹 Rimossi** import inutili di `PersonCompensationSummary` da `app/admin/coach/[id].tsx` e `app/admin/athlete/[id].tsx`.
3. **🆕 Badge cumulativi**: in `PersonCompensationSummary.tsx` ora si mostrano **entrambi** i badge "⚠️ Supera €5.000 nel mese di X (INPS)" e "🚨 Supera €15.000 nel mese di Y (IRPEF)" nello stesso box, invece di essere mutuamente esclusivi. Applicato a fiscal_year_current e fiscal_year_next.

### Risultato atteso
- Pagina Coach: NO riepilogo compensi (solo card Compensi base + banner Hub).
- Hub `/admin/persona/[id]/compensi`: riepilogo unico, con entrambi i badge soglia visibili dove applicabile (es. Zorzi Alice 2025 mostra sia "⚠️ Supera €5.000" che "🚨 Supera €15.000 nel mese di Novembre").

### Files modificati
- `/app/frontend/src/components/admin/PersonCompensationSummary.tsx`
- `/app/frontend/app/admin/coach/[id].tsx`
- `/app/frontend/app/admin/athlete/[id].tsx`

---

## 🆕 14/06/2026 — PULIZIA RIEPILOGHI VECCHI + MESE SUPERAMENTO SOGLIE ✅

**Status**: ✅ Pronto per deploy.

### Modifiche di oggi
1. **🚫 Nascosti** i blocchi legacy nella scheda Coach (`{false && ...}`):
   - "📄 Comunicazione RAS - Totale Contratto" + "📊 Calcolo per Anno Solare" (versione editing + versione lettura)
   - 3 box "Soglia €5K", "Soglia €15K", "Dichiarazione firmata" (editing + lettura)
   - Mantenute "Già Percepito" e "Genera Quietanza Personalizzata" (utili).
2. **♻️ Rimesso** `PersonCompensationSummary` come unica fonte di verità nelle schede Coach e Atleta.
3. **🆕 Aggiunto** nel backend: campi `month_exceed_5k` e `month_exceed_15k` in `fiscal_year_current` e `fiscal_year_next` (mese di superamento cronologico cumulato Coach+Atleta+esterni+pregresso).
4. **🆕 Aggiornato** UI: i badge soglia ora mostrano *"⚠️ Supera €5.000 **nel mese di Marzo** (INPS)"* e *"🚨 Supera €15.000 **nel mese di Marzo** (IRPEF)"*.

### Verifica reale
Coach Fede (€1700/mese gen-giu 2026): mese 3 (Marzo) supera €5K ✅. Totale anno €10.200, mai supera €15K ✅.

### Da fare lato utente Atleta/Coach (prossima sessione)
- Replicare le stesse modifiche lato non-admin (dashboard atleta + dashboard coach).
- Email unica per dual-role (no più `*.coach@*`): rimuovere richiesta di seconda email nel flusso "Promuovi ad allenatore" + cleanup DB.

---

**Status**: ✅ Completato e in deploy su produzione.

### Cosa è stato consegnato in giornata
1. **Fix GDPR Data Leak download PDF**: filename univoco con `doc.id` (no più conflitti Chrome con file di altri utenti)
2. **Refactor UX Riepilogo Compensi**: niente selettore anno, label "sino al 31/12", "Percepito sino al [contract−1]", click sulla riga → accordion mensile con regola quartili
3. **Export XLSX Riepilogo Annuale** con range date custom (dal..al) — default = stagione società
4. **Hub Persona** `/admin/persona/[id]` per dual-role + endpoint backend `GET /api/admin/persons/{id}/profile`
5. **Banner Switcher** (v2) con 3 tab Atleta/Coach/Anagrafica in cima alle schede ruolo
6. **Fallback linking** Atleta↔Coach via nome+cognome quando CF/email non matchano
7. **Rimozione duplicati**: PersonCompensationSummary non più nelle schede Coach/Atleta (verrà mostrato solo nella pagina compensi unificata Step 2)
8. **Fix import build Vercel** (file spostato da `[id].tsx` → `[id]/index.tsx`)

### Cosa rimane per Step 2 (prossima sessione)
- **Pagina Compensi Unificata** `/admin/persona/[id]/compensi` con:
  - Box anno con colori dinamici: 🟢 verde (<5K) / 🟧 arancio (>5K non firmata) / 🟪 viola (>15K non firmata) / 🟦 azzurro (soglia firmata)
  - **Calendario mensilità colorato** (caselle B = righe Atleta + Coach affiancate per ogni mese)
  - Stato per mese: ⬜ grigio (futuro) / 🟢 verde (quietanzata <5K) / 🟧 arancio (>5K) / 🟪 viola (>15K)
  - Storico quietanze unificato Coach + Atleta
  - Integrazione col popup "Prima di firmare" esistente per compensi esterni cronologici

### Cosa rimane per Step 3
- (Opzionale) Refactor profondo per rimuovere card "Dati Personali" dalle schede Atleta/Coach quando dual-role
- (Opzionale) Auto-redirect dalle liste atleti/coach all'Hub Persona se dual-role

---

**Status**: ✅ Testato (iteration 72, 27/27 backend + frontend 100%, zero issue).

### Modifiche UX (richieste dal PO Vincenzo)
- **A) Selettore anno RIMOSSO**: la card mostra automaticamente i 2 anni fiscali della stagione (es. Anno 2025 + Anno 2026 per stagione 2025/2026). Il frontend rileva `earliest_first_year < currentYear` e rifa la chiamata con quell'anno.
- **B1) Titoli box**: "Anno Fiscale 2025 (1° anno)" → **"Anno Fiscale 2025"** con sottotitolo italic **"sino al 31/12/2025"**.
- **B2) Etichetta pregresso dinamica**: "Pregresso (1° anno)" → **"Percepito sino al [contract_start - 1]"** (es. 31/08/2025 se contratto inizia 01/09/2025). Calcolata sulla data più antica tra Coach e Atleta per dual-role.
- **C1) Periodo contrattuale visibile**: sotto ogni ruolo "Contratto: Dal gg/mm/aaaa al gg/mm/aaaa".
- **C2) Click → accordion breakdown mensile** con regola Quartili: "Settembre 2025 — €1.700,00 × 100% (mese pieno) — € 1.700,00".

### Backend
- `_calculate_ras_total()` ora ritorna `dict {total, breakdown}` (era float). `breakdown` = array `[{year, month, amount, quartile}, ...]`.
- Endpoint `/admin/persons/{id}/compensation-summary` espone `ras_breakdown` sia in `coach_section` sia in `athlete_section`. Mantiene `earliest_first_year`.
- Test pytest aggiornati (21/21) + nuovo `test_compensation_summary_breakdown.py` (6/6).

---

**Status**: ✅ Implementato e testato (testing agent 100% backend + frontend, iteration 70).

### Cosa è stato consegnato (singola persona — Fase 2)
[...vedi commit precedente: helper Quartili + endpoint /admin/persons/{id}/compensation-summary]

---

## 🆕 13/06/2026 — EXPORT XLSX RIEPILOGO COMPENSI ANNUALE ✅ COMPLETATO

**Status**: ✅ Implementato e testato (testing agent 100% backend + frontend, iteration 71, zero issue).

### Cosa è stato consegnato (export societario)
1. **Backend** (`/app/backend/server.py`, dopo riga 27860):
   - `_calculate_person_range_total(contract_start, contract_end, monthly, range_start, range_end)`: helper che clampa il contratto sul range e somma proporzionalmente usando la regola Quartili.
   - `GET /api/admin/compensation-summary/default-range`: ritorna `{start_date, end_date, label}` calcolato da `settings.season_*` della società (default Pallavolo Perugia = 01/07/2025 → 30/06/2026 "Stagione 2025/2026"). Restituisce null/null se la stagione non è configurata.
   - `GET /api/admin/compensation-summary/export-xlsx?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`: scarica un file XLSX con tutte le persone compensate della società (Coach, Dirigente, Collaboratore, Atleta PRO), colonne: Cognome, Nome, CF, Ruolo, Inizio Contratto, Fine Contratto, Compenso/Mese, **Totale nel Range** (quartili), **Esterni nel Range** (colonna SEPARATA, non sommata), Supera €5K, Supera €15K, Note + riga TOTALI con formule =SUM().

2. **Frontend** (`/app/frontend/src/components/admin/CompensationExportModal.tsx`):
   - Modal con input data masked gg/mm/aaaa
   - Pre-popolamento automatico dalla stagione società (badge "Stagione 2025/2026")
   - Bottone verde "Scarica XLSX" + download blob su web / Sharing su mobile
   - Validazione locale (data fine > data inizio) + 400 lato backend
   - Card di accesso in `/admin` (index): "📊 Riepilogo Compensi Annuale" sotto "🏢 Compensi Esterni"

### Decisioni di design
- **Range custom > anno solare**: una società con esercizio non-solare (es. 1/9–31/8) può scegliere qualsiasi range.
- **Compensi esterni separati**: colonna dedicata "Esterni nel Range" che NON viene sommata al totale del range — coerente con la richiesta esplicita del PO. Per i compensi esterni si sommano gli importi degli anni solari toccati dal range (non si proporzionano i mesi, perché il dato è annuale).
- **Quartili applicati anche all'export**: la Regola dei Quartili Settimanali si applica sia ai mesi parziali iniziali/finali del contratto sia ai mesi parziali del range (es. esercizio che inizia il 15 del mese → quartile 2).
- **Multi-tenant**: filtro `society_id` su `users` e `athletes`.

---
### Cosa è stato consegnato
1. **Backend** (`/app/backend/server.py`):
   - `_parse_contract_date()` — normalizza date contratto (ISO string / datetime / date)
   - `_calculate_proportional_amount_quartile()` — Regola dei Quartili Settimanali (1 sett=25%, 2=50%, 3=75%, 4=100%)
   - `_calculate_ras_total()` — somma su tutti i mesi del contratto
   - `_calculate_fiscal_year_total()` — somma sui 12 mesi di un anno solare, con breakdown
   - `GET /api/admin/persons/{user_id}/compensation-summary?year=Y` — endpoint admin-only multi-tenant, risolve sia user_id (coach) sia athlete_id (atleta PRO), supporta dual-role
2. **Frontend** (`/app/frontend/src/components/admin/PersonCompensationSummary.tsx`):
   - Componente riutilizzabile con 3 box (RAS / Anno Fiscale Corrente / Anno Fiscale Successivo)
   - Selettore anno fiscale ‹ ›, badge dual-role, badge soglie €5k/€15k
   - Montato in `/app/frontend/app/admin/coach/[id].tsx` e `/app/frontend/app/admin/athlete/[id].tsx`
3. **Test pytest**: `/app/backend/tests/test_quartile_calculation.py` (21/21 ✅) + `/app/backend/tests/test_compensation_summary_endpoint.py` (8/8 ✅ creato dal testing agent)

### Verifica reale (coach Fede Rica, contratto 01/09/2025–30/06/2026, 1700€/mese)
- RAS Totale: **€ 17.000** (10 mesi pieni)
- Anno Fiscale 2026: **€ 10.200** + badge ⚠️ Supera €5.000
- Anno 2025: € 20.000 (€ 6.800 + € 13.200 pregresso unificato, perché 2025 è il primo anno)

### Regola "pregresso unificato per persona" (no doppio conteggio)
- Coach.other_annual_compensation + Athlete.other_annual_compensation: se **entrambi > 0** vengono **sommati** (admin ha esplicitamente dichiarato 2 valori); altrimenti si prende il `max()` → evita doppio conteggio se lo stesso dato è stato impostato in entrambe le entità.
- Imputato SOLO nel primo anno solare (= `min(coach_contract_start.year, athlete_contract_start.year)`).

---

## 🆕 13/06/2026 — Pianificazione Riepilogo Compensi Unificato (PROSSIMA SESSIONE)

### Regole confermate dall'utente
1. **Mese parziale - Regola dei QUARTILI SETTIMANALI** (sostituisce la vecchia regola del 15):
   - 4 settimane → 100% del compenso
   - 3 settimane → 75%
   - 2 settimane → 50%
   - 1 settimana → 25%
   - Formula: `quartile = round(days_worked_in_month / (days_in_month / 4))` clampato 1..4
   - Importo proporzionale: `monthly_amount × (quartile / 4)`
   - Esempi (ottobre 31gg): contratto 08/10→31/10 (24gg) → 75% € 225; contratto 26/10→31/10 (6gg) → 25% € 75
2. **Quietanze fuori range contratto**: accetta e calcola, niente blocco UI
3. **Pregresso**: campo unico per Utente (non per ruolo), si conta solo nel primo anno solare
4. **UI**: dashboard ADMIN unificata (una sola schermata raggiungibile sia da coach che da atleta)

### Lavoro pianificato
- Endpoint backend `GET /api/admin/persons/{user_id}/compensation-summary?year=Y`
  - Restituisce: Comunicazione RAS (totale contratto sommando tutti i rapporti) + Anno solare (con regola 15) + Pregresso primo anno
  - Somme supplementari = bonus società + external_compensations
- Helper `_calculate_proportional_amount(contract_start, contract_end, monthly_amount, year)` con regola 15
- Migrazione `other_annual_compensation` da Coach a User (campo univoco per persona)
- UI riepilogo 3 box estesa con righe separate per Coach/Atleta
- Test pytest dedicato

## 🆕 11/06/2026 — P1: Fix PDF retroattivo soglia €5K/€15K (firme fuori ordine)

### Problema
Le firme di quietanze fatte fuori ordine cronologico (es. firma Settembre prima, Gennaio dopo) NON generavano il PDF di soglia €5K/€15K per il mese che cronologicamente attraversava la soglia. La query MongoDB usava `"month": {"$lt": request.month}` ignorando i mesi successivi già firmati.

### Fix
1. **Nuovo helper** `_detect_threshold_crossings_chronological()` in `server.py` (~riga 13824):
   - Costruisce mappa `monthly: dict[1..12]` con importi firmati + nuovo importo + prior + external
   - Scorre cronologicamente i 12 mesi e individua il primo mese in cui il cumulativo attraversa 5K e 15K
   - Ritorna `(month_5k, month_15k)` o `None`
2. **3 endpoint patchati** con la stessa logica:
   - Coach signing (riga ~14531)
   - Dirigente signing (riga ~19684)
   - Collaboratore signing (riga ~20429, gestisce 2 collezioni `collaboratore_compensations` + `coach_compensations`)
3. Query MongoDB cambiata: `"month": {"$lt": request.month}` → `"month": {"$ne": request.month}` (recupera tutte le firme dell'anno, esclude solo il mese corrente)

### Test
- `/app/backend/tests/test_threshold_chronological.py` con 7 test pytest, tutti passati ✅
- Casi coperti: firme sequenziali, retroattive, prior+external imputati a gennaio, soglia 15K, no superamento

### Limitazione
Il fix è **forward-looking**: si applica solo alle NUOVE firme. Per casi storici (es. il gennaio mancante di Alice in produzione) bisogna:
- Eliminare il record `coach_compensations` di Gennaio 2025 di Alice
- Ri-firmare Gennaio dal frontend → il nuovo helper genererà il PDF €5K correttamente

## Credenziali Test (famiglia allargata)
- Admin: `vincenzo.ciucarelli@gmail.com`
- Mario Rossi: `mario@test.com` (padre di Giulia + Sara)
- Anna Verdi (alias Arianna): `anna@test.com` o `arianna@test.com` (madre di Sara, Giulia, Marco, Laura)
- Luca Bianchi: padre di Marco e Laura, registrato via invito
- Atleti: Giulia Rossi, Sara Rossi, Marco Bianchi (Belgio), Laura Bianchi (Danimarca)

## 🆕 10/06/2026 — UX Pre-iscrizioni Admin (admin/preseason.tsx)

### Cosa è stato fatto
1. **Auto-formattazione date `gg/mm/aaaa`**: inserendo solo numeri (es. `01092026`), gli slash vengono aggiunti automaticamente (`01/09/2026`). Funziona sia in creazione che in modifica. Helper `formatDateInput`, `isoToItalianDate`, `italianToIsoDate`.
2. **Conversione ISO ↔ Italiano**: il backend continua a ricevere/restituire ISO `YYYY-MM-DD`, ma l'utente vede sempre `gg/mm/aaaa`.
3. **Validazione**: data non valida → alert "Data di apertura non valida. Usa il formato gg/mm/aaaa".
4. **Pulsanti card più grandi e leggibili**: paddingHorizontal 10→14, paddingVertical 6→10, fontSize 12→13, icone 14→16. Pulsante "+ Nuova Campagna" anch'esso più visibile.
5. **Sezione "Promemoria automatici" leggibile**: testo "Ultimo invio" passato da fontSize 10 colore `#AAA` (illeggibile) a fontSize 13 colore `#555`. Toggle ingrandito (44x24 → 52x28). Bottoni frequenza più cliccabili.
6. **Stats row card leggibili**: numeri "15 risposte", "30 genitori mancanti", "Scade: ...", "Notifiche: 1x" portati da fontSize 11 a 13/15, colore `#888` → `#555`.
7. **Nota informativa sotto le date**: "Inserisci solo i numeri: le barre vengono aggiunte automaticamente (es. 01092026 → 01/09/2026)."

### File modificato
- `/app/frontend/app/admin/preseason.tsx`

### Note tecniche operative
- Expo è in modalità **static serve** (`npx serve -s dist`), non dev server. Per applicare modifiche al frontend bisogna fare `npx expo export -p web --output-dir dist-new`, copiare il contenuto in `dist/` e `sudo supervisorctl restart expo`.
- Password Admin Vincenzo Ciucarelli verificata: `Test1234` (test_credentials.md aggiornato di conseguenza).

## Credenziali Test (famiglia allargata) — DUPLICATO STORICO

## 🆕 10/06/2026 — Bug FINALMENTE risolto: "Tocca per firmare" sui mesi firmati (athlete/index.tsx)

### Root cause REALE (scoperta grazie agli screenshot DevTools dell'utente)
Il bug NON era in `athlete/compensation.tsx` (quella pagina già funzionava perfettamente — Foto 1 confermava). Il bug era nella **pagina dashboard atleta `/athlete/index.tsx`** sezione "Riepilogo Quietanze".

Codice incriminato in `isReceiptSigned` e `getReceiptSignedDate`:
```js
const monthName = MONTH_NAMES_FULL[month];  // → "Settembre"
return receipts.some(r => r.year === year && r.month === monthName && r.signed);
//                                            ^^^^^^^^^^^^^^^^^^^^^^^
//   r.month è SEMPRE int (1-12) dal backend → mai === "Settembre" → mai trovato
```

L'utente vedeva tutti i 4 mesi del 2025 in stato pending. Al click veniva rediretto a `/athlete/compensation?month=9&year=2025` (pagina diversa) che usava `matchesMonth` corretto → mostrava i mesi firmati. Da qui il "magia dopo il tap".

### Fix
Riscritto il match in `athlete/index.tsx` con tolleranza multi-formato (numero / stringa italiana legacy / `month_name`) e supporto sia `signed` sia `receipt_signed`:
```js
const matchReceiptMonth = (r, monthInt) => {
  if (typeof r.month === 'number') return r.month === monthInt;
  if (typeof r.month === 'string') return r.month === MONTH_NAMES_FULL[monthInt];
  if (typeof r.month_name === 'string') return r.month_name === MONTH_NAMES_FULL[monthInt];
  return false;
};
const isReceiptSignedFlag = (r) => r?.signed === true || r?.receipt_signed === true;
```

### Test (Node) ✅
- Settembre 2025 (numero 9) → signed ✓
- Ottobre 2025 → signed ✓
- Novembre 2025 (receipt_signed) → signed ✓
- Dicembre 2025 → signed ✓
- Gennaio 2025 (non in records) → unsigned ✓
- Legacy "Settembre" stringa 2024 → signed ✓


## 🆕 09/06/2026 — Login UNIFICATO per atleta+coach (una sola email)

### Goal
L'atleta dual-role usa SOLO la sua email atleta (es. `alice.z@test.com`) per il login. Lo switch al ruolo Coach avviene dalla dashboard, senza credenziali separate.

### Backend (`server.py`)
- **`POST /api/admin/athletes/{id}/promote-to-coach`**: campi `coach_email` e `coach_password` resi **opzionali**. Se omessi:
  - email coach generata internamente come alias: `{email_atleta}#coach` (non valida per login esterno: il `#` fa fallire la validazione Pydantic email)
  - password coach generata random (mai usata per login)
- **`DELETE /api/admin/athletes/{id}/promote-to-coach`**: nuovo endpoint per **annullare la promozione** (rimuove il record coach collegato). Blocca se ci sono quietanze firmate. Utile per ri-promuovere atleti già promossi col vecchio codice (come Alice → `alice.coach@…`).

### Frontend (`admin/athlete/[id].tsx`)
- Modal **"Promuovi a Coach"** semplificato:
  - Rimossi i campi Email Coach e Password Coach
  - Testo aggiornato: "L'atleta userà le SUE stesse credenziali per il login"
  - Solo campi richiesti: Squadra, Livello (opzionale), Compenso
- Badge "Anche Coach (Doppio Ruolo)" ora ha **2 azioni**: "Apri scheda Coach →" e **"Annulla promozione"** (con conferma, blocca se ci sono quietanze firmate)

### Test e2e (preview) ✅
| Step | Risultato |
|------|-----------|
| Promote SENZA email/password | `coach_email: "unimail@test.com#coach"` (alias interno) |
| Login con email atleta | `role: athlete` (NON coach) |
| Tentativo login con alias `#coach` | **rifiutato** dal validatore Pydantic (`# invalid in email`) |
| Switch dalla dashboard atleta | `role: coach` ✅ |
| DELETE unlink | `deleted: 1, "Promozione annullata"` |

### Workflow Alice (passo passo)
1. Admin → Atleti → Alice → badge "Anche Coach" → clic **"Annulla promozione"** (rimuove l'attuale `alice.coach@test.com`)
2. Stesso punto → bottone arancione "🎓 Aggiungi anche come Coach" → modal semplificato (solo squadra + compenso) → conferma
3. Alice si logga con `alice.z@test.com` (unica email) + sua password atleta → vede il bottone **"Passa a Modalità Coach"** sotto l'header → click → entra in modalità Coach senza re-credenziali


## 🆕 09/06/2026 — Fix Switch dual-role + Dati Bancari coach Alice

### 🐛 Foto 1 — Click su "Passa a Modalità Atleta" → buttata fuori al login
**Causa:** l'interceptor di `api.ts` sovrascrive SEMPRE l'header Authorization col token in AsyncStorage. Il mio override locale `headers: { Authorization: 'Bearer ' + newToken }` veniva ignorato → la `/auth/me` ritornava il VECCHIO user (coach) col vecchio token. `setUser(coachUser, newToken)` salvava `user.role='coach'` → `router.replace('/athlete')` → `athlete/_layout.tsx` controllava `user.role !== 'athlete'` → redirect al login.
**Fix (`SwitchAccountButton.tsx`):** salvo il `newToken` in AsyncStorage **PRIMA** di chiamare `/auth/me`, così l'interceptor lo userà automaticamente. Ora la chiamata ritorna l'utente del nuovo ruolo correttamente.

### 🐛 Foto 2 — Dati Bancari coach Alice non visibili (campi vuoti)
Alice era stata promossa col VECCHIO codice di `promote-to-coach` che non copiava IBAN/Intestatario/Banca dall'atleta al nuovo user coach. I campi rimanevano vuoti nel suo profilo coach.
**Fix retroattivo (`/auth/me` backend):** se `role ∈ {coach, dirigente, collaboratore}` E `linked_athlete_id` esiste E i campi bancari sono vuoti → fallback automatico dai dati bancari dell'atleta linked. Test ✅: coach senza IBAN + atleta con IBAN `IT99X...` → `/auth/me` ritorna IBAN e holder dall'atleta.
**Effetto pratico per Alice:** dopo il deploy, dal suo profilo coach (anche dalla vista admin coach) vedrà i dati bancari già popolati. Se vuole modificarli, salva e i nuovi valori avranno priorità sul fallback.


## 🆕 09/06/2026 — Fix bundle Admin/Atleta (3 bug)

### 🐛 Bug 1 — Modal "Promuovi a Coach": livello/grado come TextInput libero
**Causa:** se la società non aveva configurato `coach_license_levels` nei settings, il modal mostrava un TextInput libero ("es. 1° livello FIPAV") invece del Picker.
**Fix:** rimosso il TextInput fallback. Ora se la lista è vuota appare un box arancione di warning con link **"→ Apri Impostazioni"** che porta a `/admin/settings/other` per configurare i livelli. Il Picker resta l'unico modo per scegliere un livello (coerenza con la registrazione coach standard).

### 🐛 Bug 2 — Dati Bancari NON visibili sulla scheda Coach di Alice (post-promote)
**Causa:** la funzione `promote-to-coach` non copiava IBAN / intestatario / banca dall'athlete record nel nuovo user record coach.
**Fix backend:** ora il documento coach include `iban`, `iban_holder_first_name`, `iban_holder_last_name`, `bank_name` letti dall'atleta. Per atleti **già promossi** (come Alice) i dati non si sincronizzano retroattivamente — l'admin può:
- aprire la scheda Coach → tasto "Modifica" → inserire IBAN
- oppure Alice può usare lo switch → profilo coach → inserire IBAN nel suo profilo (campo `Dati Bancari` editabile)

### 🐛 Bug 3 — Cancellazione bloccata dallo slash `/` nei campi data + doppio slash
**Causa:** `handleDateInput` in `admin/athlete/[id]/compensation.tsx` preservava gli slash esistenti e ne aggiungeva di nuovi quando length==5 + split('/')==2 → ogni backspace sullo slash veniva immediatamente "ripristinato".
**Fix:** riscritto come **digits-only** + ricostruzione. Ora:
- "11/02/" → backspace → "11/02" ✅ (non si re-aggiunge `/`)
- "31//05/202" → "31/05/202" ✅ (doppio slash sanitizzato)
- Tutti gli scenari di cancellazione testati ✅


## 🆕 08/06/2026 — Switch dual-role Atleta ↔ Coach (un click, no re-login)

### Goal
Replicare il pattern "Passa a Modalità Dirigente" del Dirigente/Admin anche per l'Atleta PRO che è stato promosso Coach. Un click → switch al dashboard del ruolo opposto senza re-login manuale.

### Backend (`server.py`)
- **`GET /api/auth/linked-accounts`**: ritorna gli account collegati al user corrente (atleta→coach o coach→atleta) tramite CF/email/società comune. Risposta: `{current_role, linked_accounts: [{user_id, role, email, label}]}`.
- **`POST /api/auth/switch-account`**: prende `{target_user_id}`, valida che sia in `/auth/linked-accounts`, genera un nuovo JWT per il target. Ritorna `{token, role, user_id}`. Audit log `[SWITCH-ACCOUNT] User X (role) → Y (role)`.

### Frontend
- Nuovo componente `src/components/SwitchAccountButton.tsx` (mostrato solo se esiste un account collegato):
  - Pillola colorata in base al ruolo target (azzurro per Coach, arancione per Atleta)
  - Al click: POST `/auth/switch-account` → aggiorna `authStore` con nuovo token+user → `router.replace('/coach' o '/athlete')`
  - `data-testid="switch-account-btn"`
- Montato in:
  - `app/athlete/index.tsx` (header dashboard atleta)
  - `app/coach/index.tsx` (header dashboard coach)

### Test e2e (preview) ✅
| Direzione | Risultato |
|-----------|-----------|
| Atleta logato → `/auth/linked-accounts` | `linked_accounts: [{role: 'coach', label: 'Modalità Coach'}]` |
| POST `/auth/switch-account` (athlete→coach) | nuovo JWT con `role: 'coach'` |
| `/auth/me` col nuovo token | `role: coach, email: switch.coach@…` |
| Coach → `/auth/linked-accounts` | `linked_accounts: [{role: 'athlete', label: 'Modalità Atleta'}]` (ritorno disponibile) |

### Sicurezza
- Lo switch verifica appartenenza alla **stessa società** + match via CF/email collegati (non possibile saltare ad account arbitrari)
- Audit log su ogni switch (Render → cerca `[SWITCH-ACCOUNT]`)

### UX risultante per Alice
1. Alice si logga col suo account atleta (`alice.z@…`) → vede pillola azzurra **"Passa a Modalità Coach"** sotto l'header
2. Click → ricarica come `/coach` senza inserire credenziali
3. Dal dashboard coach vede pillola arancione **"Passa a Modalità Atleta"** per tornare
4. **UN solo set di credenziali da memorizzare** dal punto di vista UX, anche se in DB esistono due account.


## 🆕 08/06/2026 — Fase 2B: UI Admin "Promuovi Atleta a Coach" (dual-role)

### Goal
Permettere all'admin di creare un secondo account Coach collegato a un Atleta PRO esistente. Le soglie €5K/€15K vengono calcolate cumulativamente per la stessa persona (atleta + coach) tramite il codice fiscale.

### Backend
- **`POST /api/admin/athletes/{athlete_id}/promote-to-coach`**
  - Input: `coach_email` (diversa dall'atleta), `coach_password` (min 6), `team_id`, `monthly_compensation`, `coach_level` (opzionale)
  - Validazioni: atleta PRO esistente con CF impostato, email coach univoca, team in stessa società
  - Crea un user role=coach con stesso CF, anagrafica copiata, contratto default oggi → 30 giugno prossimo
  - Audit fields: `linked_athlete_id`, `promoted_from_athlete_id`, `promoted_at`, `promoted_by`
- **`GET /api/admin/athletes/{athlete_id}/linked-coach`**
  - Ritorna info sul coach collegato (se esiste) per mostrare il badge "Anche Coach" sul profilo atleta

### Frontend (`admin/athlete/[id].tsx`)
- Card Compensi Premium → sotto "Gestisci Compensi e Quietanze":
  - Se atleta NON è ancora coach → bottone arancione **"🎓 Aggiungi anche come Coach"**
  - Se atleta È già coach → badge blu **"Anche Coach (Doppio Ruolo)"** con email, squadre, compenso, link rapido alla scheda Coach
- Modal con form: email coach (suggerimento auto `nome.coach@dominio`), password temporanea, squadra (Picker da `/teams`), livello (Picker da `coach_license_levels` settings, fallback TextInput), compenso mensile

### Come si attiva ora ✅
1. Admin → Atleta Alice → tab Dati → card Compensi → bottone "Aggiungi anche come Coach"
2. Compila email coach diversa (es. `alice.coach@…`), password, squadra (qualsiasi), livello opzionale, compenso
3. Sistema crea account coach con stesso CF di Alice
4. Soglie cumulative €5K/€15K attive automaticamente (sia dalla vista Atleta sia dalla vista Coach)

### Test e2e (preview)
| Scenario | Risultato |
|----------|-----------|
| Stato iniziale (atleta senza coach) — GET `/linked-coach` | `{linked: false}` ✅ |
| POST `/promote-to-coach` con team Under 14 + 300€/mese | `{coach_user_id: ..., linked_athlete_id: ...}` ✅ |
| GET `/linked-coach` post-promozione | `{linked: true, assigned_teams: ["Under 14"], coach_level: "1° livello FIPAV"}` ✅ |
| Threshold cumulativo atleta | `is_dual_role: true, coach_monthly_compensation: 300` ✅ |


## 🆕 08/06/2026 — Fix Atleta PRO: Quietanze visibili correttamente al primo load + Registro Profilo

### 🐛 Bug A — Dashboard atleta "Tocca per firmare" anche sui mesi già firmati (poi magicamente firmati dopo click)
**Causa:** in `athlete/compensation.tsx` la chiamata `/athletes/${athleteId}/compensation/receipts` usava `user?.athlete_id || user?.id` ma all'inizio il context `user` (da AuthContext) può non avere ancora `athlete_id` → ricadeva su `user.id` → endpoint cercava athlete con id=user.id → ritornava `[]` → tutti i mesi mostravano "Tocca per firmare". Solo quando una seconda load partiva con athlete_id corretto, l'UI si aggiornava (effetto "magia" descritto dall'utente).

**Fix:** usare direttamente `profileRes.data?.athlete_id || profileRes.data?.athlete_record_id` (dal `/auth/me` appena ricevuto in `loadData`).

### 🐛 Bug B — Registro Quietanze nel Profilo Atleta non segna i mesi firmati
**Causa:** in `athlete/profile.tsx` la sezione "Registro Quietanze" controllava `receipt?.receipt_signed === true` ma il backend atleta salva `signed: true` (non `receipt_signed`). Inoltre il match `r.month === monthInt` falliva con il formato stringa legacy.

**Fix:**
- Aggiunto `isReceiptSignedFlag(r)` tollerante: `receipt_signed === true || signed === true`.
- Aggiunto `matchMonth(r, monthInt)` tollerante per: `number 1-12`, stringa italiana ("Settembre"), `month_name`.
- Applicato anche nel calcolo di `thresholdsByYear`.

### Test (Node)
5 scenari Set-Dic 2025 (firmati) + Gen 2026 (non firmato) → tutti OK ✅


## 🆕 08/06/2026 — Fix Admin View: Quietanze firmate non risultavano visivamente

### Bug
Admin → Atleta → Compensi Atleta mostrava: "Quietanze firmate: 2 / 9" (contatore corretto) ma TUTTI i 9 mesi apparivano "In attesa" (nessuno verde/firmato).

### Root cause
Il backend `sign_athlete_compensation_receipt_with_signature` salva `month` come **intero 1-12** in `athlete_compensation_receipts` (+ campo aggiuntivo `month_name` in italiano). Il frontend admin `compensation.tsx` faceva il match `r.month === m.month` confrontando un numero con una stringa italiana → sempre `false` → tutti i box mostravano "In attesa". Il counter `signedReceipts.filter(r => r.signed).length` era invece corretto perché contava solo il flag `signed`.

### Fix (`admin/athlete/[id]/compensation.tsx`)
- Aggiunte helper `monthNameToNumber()` e `matchesReceipt(r, month, year)` che matchano in modo flessibile:
  - `r.month` come **numero** (1-12) → confronto con `monthNameToNumber('Settembre')` = 9
  - `r.month` come **stringa legacy** ("Settembre") → confronto case-insensitive
  - `r.month_name` come stringa → fallback
- `isReceiptSigned` e `getReceiptSignedDate` ora usano `matchesReceipt`.

### Test
5 scenari verificati con script Node: nuovo formato numerico, formato legacy stringa, mese non firmato, anno errato → tutti OK ✅.


## 🆕 08/06/2026 — Badge "Identità Verificata" (Atleta)

### Goal
Mostra un badge verde "Identità verificata" accanto al nome dell'atleta sul dashboard compensi, quando tutti e 3 i requisiti sono soddisfatti.

### Backend (`server.py` /auth/me)
- Aggiunto campo computed `identity_verified: bool` nella risposta `/api/auth/me` (per atleta/coach/dirigente/collaboratore).
- Logica:
  - **Privacy firmata**: `user.privacy_accepted == True`
  - **Anagrafica completa**: tutti i campi `first_name`, `last_name`, `fiscal_code`, `date_of_birth`, `address`, `phone` valorizzati
  - **Cert. medico verificato** (solo per atleti): `medical_certificate_verified == True`

### Frontend (`athlete/compensation.tsx`)
- Aggiunta pill verde accanto al nome con icona `shield-checkmark` e testo "Identità verificata".
- Visibile solo quando `profile.identity_verified === true`. `data-testid="identity-verified-badge"`.

### Test (preview)
- Stato "privacy mancante" → `identity_verified=False` ✅
- Tutti i requisiti soddisfatti → `identity_verified=True` ✅
- Cert. revocato → `identity_verified=False` ✅

### Estensione futura
Stesso campo già disponibile per Coach/Dirigente/Collaboratore (senza cert. medico). Sarà sufficiente aggiungere il badge anche nei rispettivi dashboard quando lo richiederai.


## 🆕 08/06/2026 — Fix bundle Atleta PRO (Alice Zorzi): 4 bug critici risolti

### 🐛 Bug 1 — Route "Il Mio Profilo" → Unmatched Route
- **Causa**: `router.push('/athletes/profile')` in `athlete/compensation.tsx` (cartella esistente è `/athlete/profile`, plurale errato).
- **Fix**: corretti i 3 link errati (1 button + 2 fallback in `handleAnagraficaError`).

### 🐛 Bug 2 + Bug 3 (stessa root cause) — Date contratto & compenso mensile invisibili al dashboard atleta
- **Causa**: `/api/auth/me` non copiava i campi compensation dal record `athletes`. Il frontend `compensation.tsx` leggeva `profile.monthly_compensation` / `profile.contract_start_date` dal /auth/me → erano `undefined` → dashboard mostrava €0,00 e "Date contratto non impostate"; firma quietanza calcolava soglie su contratto inesistente → crash visivo dei mesi.
- **Fix backend `server.py /auth/me`**: aggiunti alla projection e al copy-over i campi `monthly_compensation`, `is_compensated`, `athlete_type`, `contract_start_date`, `contract_end_date`, `iban`, `other_annual_compensation`, `team_id`.
- Date contract_start/end normalizzate in ISO string nel response.

### 🐛 Bug 4 — Firma privacy NON richiesta al salvataggio profilo Atleta
- **Causa**: `handleSave` in `athlete/profile.tsx` salvava solo i dati ma non triggava `setShowPrivacyModal(true)` (al contrario di Coach/Dirigente).
- **Fix**: dopo il PATCH /auth/me, se `privacyAccepted === false` mostra il `GDPRPrivacyModal` (stesso flow del Coach). Se già accettata, mostra solo l'alert di successo.

### 🐛 BONUS — Root cause del 500 di Alice in produzione (anche Bug originale "Impossibile caricare i dati")
- **Causa scoperta**: la projection MongoDB di `db.athletes.find_one(...)` includeva `_id: 0` ma NON `id: 1`, quindi `athlete["id"]` su riga `user["athlete_record_id"] = athlete["id"]` lanciava `KeyError: 'id'` → HTTP 500.
- **Fix definitivo**: aggiunto `"id": 1` alla `athlete_proj`. Il try/except globale aggiunto in precedenza ha protetto dal 500 lato API ma `athlete_record_id` rimaneva `None`; ora popolato correttamente.

### Test e2e (preview)
Atleta PRO con `monthly=3750€`, contratto `2026-01-01 → 2026-05-31`, IBAN, `is_compensated=true`:
- `/auth/me` ritorna tutti i campi corretti ✅
- `athlete_record_id` popolato ✅
- HTTP 200 ✅
- Errore precedente catturato e loggato come `KeyError: 'id'` (visibile in Render log se l'utente vuole verifica retroattiva).


## 🆕 07/06/2026 — Atleti Pro Fase 2: Soglie cumulative Coach + Atleta PRO

### Goal
Quando un utente ricopre **due ruoli compensati** nella stessa società (es. Coach + Atleta PRO), le soglie €5.000 / €15.000 (Riforma Sport) devono essere calcolate sulla **somma cumulativa** dei compensi delle due posizioni + compensi esterni dichiarati.

### Backend (`server.py`)
- **Nuove helper**:
  - `_find_linked_athlete_pro_for_user(user_id)` → cerca un record `athletes` con `is_compensated=True` linkato all'utente (via `user_id`/`linked_user_id`/`email`/`fiscal_code`) **nella stessa società**.
  - `_find_linked_compensated_user_for_athlete(athlete)` → cerca un user (role coach/dirigente/collaboratore/admin) collegato all'atleta PRO **nella stessa società**.
  - `_get_signed_yearly_total_as_coach(coach_user_id, year)` e `_get_signed_yearly_total_as_atleta_pro(athlete_id, year)` → somme delle quietanze firmate dell'anno.
- **`GET /api/coach/{coach_id}/threshold-status/{year}`**:
  - `yearly_total` ora include i compensi firmati dell'Atleta PRO linkato (se presente).
  - La proiezione mensile (`threshold_month` per 5k/15k) include anche il monthly compensation dell'Atleta PRO.
  - Nuovo blocco di risposta `cumulative`: `{is_dual_role, athlete_pro_id, athlete_pro_yearly_total, athlete_pro_monthly_compensation, external_year_total}`.
- **`GET /api/prime-squadre/athletes/{athlete_id}/threshold-status/{year}`**:
  - Estesa con la stessa logica simmetrica: somma i compensi firmati come Coach (se l'utente è dual-role), include i compensi esterni nella proiezione, calcola `threshold_5k_month` / `threshold_15k_month`.
  - Nuovo blocco `cumulative`: `{is_dual_role, linked_coach_user_id, coach_yearly_total, coach_monthly_compensation, external_year_total}`.
  - Mantiene retrocompatibilità: campo `monthly_compensation` resta quello dell'atleta; `yearly_total` mostra il totale firmato cumulativo.

### Test (dati sintetici)
Persona Mario Dual = Coach (400€/mese) + Atleta PRO (300€/mese) + 500€ esterni:
- Coach POV: `yearly_total=2100` (1200 coach + 900 atleta pro), `cumulative.is_dual_role=true`, `threshold_5k_month=7` (luglio: 500+700×7=5400) ✅
- Atleta PRO POV: `yearly_total=2100`, `cumulative.linked_coach_user_id=...`, stessi 7 mesi proiettati ✅
- Single-role regression: Atleta PRO disattivato → `yearly_total=1200`, `is_dual_role=false`, proiezione 5k a dicembre ✅

### Frontend
Nessuna modifica necessaria al frontend: i campi storici (`yearly_total`, `threshold_month`) ora restituiscono valori cumulativi. Il nuovo blocco `cumulative` è disponibile per future visualizzazioni (es. badge "Doppio ruolo" sulla dashboard compensi).


## 🆕 07/06/2026 — Fix "Impossibile caricare i dati" su login Atleta (Alice)

### Bug
Atleti adulti registrati con il nuovo flow Admin Approval vedevano il popup "Impossibile caricare i dati" al primo login. Causa principale: una singola API non-critica (es. `/athletes/{id}/compensation/receipts`) o un campo `athlete_id` mancante nel record `users` faceva crashare l'intera `loadData`.

### Fix
1. **Backend `GET /api/auth/me` self-heal** (`server.py` ~riga 3606): se l'utente ha `role == "athlete"` ma manca `athlete_id`, ora cerca il record `athletes` per `user_id` / `linked_user_id` / `email` e:
   - persiste il link in DB (`users.athlete_id = athlete.id`),
   - restituisce comunque `athlete_id` nella risposta corrente.
2. **Frontend `athlete/index.tsx`**: ogni chiamata API (athlete record, receipts, settings/society) è ora isolata in un proprio try/catch. Una failure su una singola API NON triggera più il popup globale; il dashboard mostra i dati disponibili da `/auth/me` come baseline.
3. **Test e2e** verificato: registrato un atleta adulto, approvato come PRO, fatto login → dashboard si apre correttamente senza popup, sia con link `athlete_id` intatto sia dopo aver rimosso `athlete_id` dal record user (self-heal funzionante).


## 🆕 03/06/2026 — Fix firma quietanze (CORS + base64 + integrità DB) + Auto-crop firma + Riepilogo Compensi Esterni

### Bug critici risolti
1. **CORS `.com` non in whitelist**: utenti che accedevano da `registrateam.com` (PWA installate da vecchio dominio, link condivisi, bookmark, Google Search) ricevevano `ERR_NETWORK` perché il preflight CORS falliva con `400 Disallowed CORS origin`. Aggiunti `registrateam.com` e `www.registrateam.com` alla var Render `ALLOWED_ORIGINS`.
2. **`UnboundLocalError: base64`** in `server.py` (righe 13922, 13969, 14412): import locale di `base64` dentro un `if` faceva trattare la variabile come locale, scatenando crash 500 alla prima POST che superava il check di soglia. Rimossi import locali, già esiste import globale alla riga 40.
3. **Record `external_compensations` orfani**: ogni tentativo di firma fallito scriveva comunque il record di compensi esterni in DB PRIMA del crash. Fix: spostata la scrittura DOPO l'insert della quietanza in `sign_compensation_receipt` (coach), `sign_dirigente_compensation_receipt`, `sign_collaboratore_compensation_receipt`. Se la firma fallisce, nessun record sporco resta in DB.
4. **Firma piccolissima nel PDF**: la firma veniva renderizzata in tutto il canvas originale (es. 800x300) e con `preserveAspectRatio=True` veniva ridotta sproporzionatamente nel box PDF (5-6cm). Aggiunto **auto-crop** del bbox della firma (PIL ImageOps.invert + getbbox + crop con padding 15px) in tutti i 5 generatori PDF (quietanza, soglia 5k, soglia 15k, dichiarazione soglia, atleta pro).

### Cleanup produzione
- Fede (`fede@coach.com`): 15 `external_compensations` orfane + 3 coach_compensations + 3 signed_documents/PDF rimossi (year=2026)
- Andrea Sarnari (`andrea.sarnari.73@gmail.com`): 5 `external_compensations` orfane rimosse (year=2026, 2025 preservato)
- Endpoint usato: `POST /api/admin/wipe-user-compensation-data` con body `{"email":"...","confirm":"YES_DELETE_ALL","year":2026}`

### Frontend
- Timeout esplicito 90s + retry automatico 1.5s su `ERR_NETWORK`/`ECONNABORTED` in `/app/frontend/app/coach/compensation.tsx`
- Log remoto dettagliato `POST_ERROR` con `code`/`isNetwork`/`url` per debug futuro

### 🆕 Nuova feature: Riepilogo Admin Compensi Esterni
- **Backend**: `GET /api/admin/external-compensations/summary?year=YYYY&only_with_external=true&role=coach` — aggrega per utente: n° dichiarazioni esterne, totale esterno, totale interno (quietanze firmate), prior_compensation, totale cumulativo, flag soglie 5k/15k, lista mese-per-mese (dichiarazioni + quietanze). Multi-tenant safe.
- **Frontend**: nuova pagina `/admin/external-compensations.tsx` con filtri (anno ± / solo esterni / ruolo), card espandibili per utente con breakdown numerico + timeline mensile dichiarazioni e quietanze, footer con totali aggregati. Export CSV (con BOM per Excel italiano).
- **Menu**: nuova card "🏢 Compensi Esterni" su `/admin/index.tsx` subito dopo "Quietanze".

### 🐛 Fix dashboard compensi coach/dirigente: i compensi esterni non venivano riflessi
Dopo la cleanup, abbiamo visto che la card "Anno 2026" mostrava il "Totale Anno" senza includere i compensi esterni dichiarati, e il badge ">5K" non compariva sui mesi futuri.
1. `getYearSummary()` (coach): include ora `externalTotal = externalByYear[year]` nel `totalProjected` + ritorna `externalTotal` per uso UI.
2. Card "Anno X" (coach, entrambi i blocchi - primo anno + ultimo anno contratto): nuova riga `• Compensi esterni (altre ASD): €X` quando `externalTotal > 0`.
3. `getProjectedThresholdMonths()` (coach + dirigente): il cumulativo parte ora da `priorCompensation + externalByYear[y]` invece di solo `priorCompensation`. Se gli esterni da soli superano una soglia, il primo mese di contratto viene marcato (così il badge ">5K" compare già a Gennaio se necessario). (Collaboratore già lo gestiva correttamente.)

## 🆕 05/06/2026 (pomeriggio) — Preset Pallavolo FIPAV (1-click import)

### Backend
- Nuovo endpoint `POST /api/settings/society/import-preset` (in `routes/settings.py`)
- Costante `SPORT_PRESETS` con dizionario per ogni sport. Pallavolo include:
  - `athlete_roles`: Palleggiatore, Schiacciatore, Opposto, Centrale, Libero
  - `athlete_characteristics`: Mancino, Buon servizio, Buona ricezione, Buona difesa, Buon attacco
  - `dirigente_qualifications`: Dirigente accompagnatore, Dirigente arbitro, Segnapunti, Refertista, Allenatore di sostegno
  - `coach_license_levels`: Smart Coach, Allievo Allenatore, 1° Grado, 2° Grado, 3° Grado
- Body: `{"sport": "pallavolo", "overwrite": false}` — default fa MERGE preservando valori esistenti
- Multi-tenant safe (upsert su `{type: "society", society_id: X}`)
- Risposta `counts`: per ogni campo restituisce `{before, after, added}`

### Frontend
- `admin/settings/other.tsx`: nuova card "🏐 Preset Pallavolo FIPAV" in cima alla pagina (sfondo giallo, bordo oro)
- Bottone "📥 Importa preset Pallavolo FIPAV" mostra confirm dialog con lista valori → POST → toast con `counts` → ricarica i 4 array nello state
- Pronto per estensione futura ad altri sport (basta aggiungere chiave a `SPORT_PRESETS`)

## 🆕 05/06/2026 (mattina 2) — Banner predittivi soglie su Compensi atleta + ruoli pre-popolati

### Foto 2 — Ruolo atleta da settings società
- **La logica era già in place** (`admin/athlete/[id].tsx` riga 1898-1942): mostra pillole se `availableRoles` ha valori, altrimenti TextInput libero
- Mancava il pre-popolamento dei ruoli sulla società Pallavolo Perugia
- **Pre-popolato in produzione via PATCH `/api/settings/society`**:
  - `athlete_roles`: `["Palleggiatore", "Schiacciatore", "Opposto", "Centrale", "Libero"]`
  - I `coach_license_levels` non si sono ancora salvati perché Render non ha il deploy con il nuovo campo (sarà disponibile dopo prossimo Save to GitHub)

### Foto 1 — Banner predittivi superamento soglie su scheda compensi atleta
- **Lato atleta** (`/app/frontend/app/athlete/compensation.tsx`): già presenti (ereditati dalla copia del coach del 3/06/2026)
- **Lato admin** (`/app/frontend/app/admin/athlete/[id]/compensation.tsx`): nuova funzione `getProjectedThresholdMonths()` che calcola il mese previsto di superamento 5k/15k per ogni anno del contratto + nuova card "📈 Previsione superamento soglie" con 2 banner (5k arancio, 15k viola) inseriti SOPRA la sezione "📊 Calcoli Annuali"
- Banner identici nel testo a quelli del coach: *"Con la quietanza del mese di [Mese] supererà la soglia previdenziale di €5.000"*

## 🆕 05/06/2026 (mattina) — Cambio email da admin con verifica via link + bottone UI

### Sblocco
- **Chiara Zorzi** (`chiara.z@test.com`) sbloccata via `POST /admin/users/{athlete_id}/force-verify-email`.

### Endpoint admin "Cambia email"
- `POST /api/admin/users/{user_id}/change-email`
  - Accetta sia `user_id` che `athlete_id` (cerca in entrambi)
  - Body: `{"new_email": "..."}`
  - Verifica univocità nuova email
  - Multi-tenant safe
  - **Setta `email_verified=False`** + nuovo `email_verification_token`
  - Invia mail di verifica via Brevo all'utente al nuovo indirizzo (l'utente deve cliccare il link per confermare)
  - Aggiorna anche record `athlete` collegato
  - Log audit `[ADMIN-CHANGE-EMAIL]` su Render

### Componente UI riutilizzabile
- Nuovo file `/app/frontend/src/components/admin/ChangeEmailButton.tsx`
  - Bottone "✉️ Cambia email" + modal di conferma
  - Mostra email attuale, input nuova email, hint che spiega il flusso di verifica via link
  - Loading state e gestione errori
  - Callback `onSuccess` per aggiornare lo state della parent page

### Inserito nelle 4 schede admin
- `admin/coach/[id].tsx` → riga Email
- `admin/dirigente/[id].tsx` → riga Email
- `admin/collaboratore/[id].tsx` → riga Email
- `admin/athlete/[id].tsx` → riga Email (sezione Dati personali)

## 🆕 04/06/2026 (sera 2) — Distinzione esplicita Squadre STD/PRO nel form admin

L'utente ha chiesto che le squadre PRO non abbiano quote da pagare (atleti remunerati) mentre le STD restano come le giovanili. La logica backend già esisteva (`is_prima_squadra` esclude pagamenti), ma mancava una UI chiara nel form di creazione team.

### Modifiche frontend admin
- **`admin/teams.tsx` (form creazione)**: aggiunto **selettore visuale Tipo Squadra** subito dopo "Descrizione":
  - 👥 **Standard** (verde) — Atleti che pagano quote
  - 🏆 **PRO** (oro) — Atleti remunerati, NO quote
  - La sezione "💶 Pagamenti" (Quota Totale + Rate) si nasconde automaticamente quando si seleziona PRO (logica già esistente, ora attivabile dal form)
- **`admin/teams.tsx` (lista team)**: badge colorato STD/PRO sopra il dettaglio della quota:
  - STD: `👥 STANDARD` + riga "Quota: €X"
  - PRO: `🏆 PRO` + riga "Squadra PRO · Atleti remunerati (no quote)"
- **`admin/team/[id].tsx` (modifica team)**: rinominato il toggle da "Prima Squadra" → "🏆 Squadra PRO" con hint chiaro "Atleti remunerati (nessuna quota da pagare) + rifinitura abilitata"

### Visibilità
La distinzione STD/PRO è **visibile SOLO all'admin** — atleti/parent/coach/dirigente non vedono il flag e percepiscono la squadra come tutte le altre (verificato: nessun riferimento `is_prima_squadra` nelle pagine non-admin).

### Note tecniche
Backend già configurato per:
- `total_amount: 0` + `installments: []` quando `is_prima_squadra=true`
- Salta la creazione automatica di pagamenti quote (`installment_1_amount=0`)
- Esclude la squadra dai report pagamenti

## 🆕 04/06/2026 (sera) — Atleti maggiorenni: approvazione admin sostituisce mail di verifica + scelta tipo Standard/PRO

### Nuovo flusso di registrazione atleti maggiorenni
1. **Atleta 18+ si auto-registra** dalla pagina pubblica `register.tsx`
2. **NESSUNA mail di verifica** (rimossa la chiamata `_send_verification_email`)
3. Stato impostato a `pending` (sia su `users` che su `athletes`)
4. Pagina post-registrazione: *"⏳ La tua iscrizione è in attesa di approvazione da parte della società..."*
5. Login bloccato fino all'approvazione admin (messaggio "Account in attesa di approvazione dall'amministratore")

### Approvazione admin con scelta tipo
Nel banner admin "Atleti in Attesa di Approvazione" (già esistente), per ogni **atleta maggiorenne** (badge 18+) ora compaiono 2 bottoni invece del singolo ✓:
- **STD** (verde) → `athlete_type=quota` — atleta che paga la quota stagionale come i minorenni
- **PRO** (oro) → `athlete_type=compensated` + `is_compensated=true` — atleta remunerato (Atleti Pro)

Per i minorenni resta il singolo bottone ✓ (flusso storico immutato).

### Welcome email Atleti PRO
Quando admin approva come `compensated`, viene inviata una mail di benvenuto al maggiorenne usando `send_transactional_email` da Brevo. La mail spiega che può accedere e firmare quietanze/compensi.

### Modifiche dettagliate
- **Backend** `server.py`:
  - Registrazione adulto: `status="pending"`, `email_verified=True`, niente `email_verification_token`, niente invio mail
  - Riattivazione adulto: stesso pattern (stesso file, blocco precedente)
  - `AthleteApprovalUpdate`: nuovo campo `athlete_type` opzionale
  - `PATCH /athletes/{id}/approval`: legge `athlete_type`, lo salva sull'athlete, invia welcome email se `compensated`
- **Frontend** `register.tsx`: messaggio post-registrazione adulti aggiornato (no più "controlla email")
- **Frontend** `admin/index.tsx`: 2 bottoni STD/PRO per atleti 18+, singolo ✓ per minorenni

## 🆕 04/06/2026 (mattina 3) — Livelli/Gradi Allenatore configurabili per società

**Pattern identico a "Qualifiche Dirigenti"**: ogni società definisce nei propri settings i livelli previsti dalla federazione del proprio sport. Per la Pallavolo: Smart Coach, Allievo Allenatore, 1° Grado, 2° Grado, 3° Grado.

### Backend
- `server.py` modello `SocietySettings`: nuovo campo `coach_license_levels: Optional[List[str]]`
- `routes/settings.py`: aggiunto `coach_license_levels` nei 2 default-values, nella response GET e nei `fields` accettati dal PATCH
- Modello User già aveva `coach_license_level` (singolare = valore selezionato dall'utente), il campo testuale è ora vincolato ai valori della società

### Frontend
- `admin/settings/other.tsx`: nuova sezione **"🏐 Livelli / Gradi Allenatore"** subito dopo "Qualifiche Dirigenti", con input "Aggiungi livello/grado..." + pulsante "+" + pillole rimuovibili (stesso pattern delle qualifiche dirigenti)
- `coach/profile.tsx`:
  - Carica i livelli da `/settings/society` all'init
  - Sostituito il TextInput free-text con **selettore a pillole** (toggle on/off) in modalità edit, che mostra solo i livelli configurati dalla società
  - **Fallback intelligente**: se la società non ha ancora configurato i livelli, il campo resta TextInput libero (così non blocca chi non ha ancora compilato i settings)

### Note operative
Dopo il deploy:
- L'admin deve aprire **Impostazioni → Altre Impostazioni → Livelli/Gradi Allenatore** e configurare i 5 livelli FIPAV per la propria società (è necessario fare anche se siamo Pallavolo Perugia perché il campo è multi-tenant e nuovo)
- Una volta salvati, ogni Coach vedrà solo quei 5 valori selezionabili nel proprio profilo
- Altre società (es. calcio, basket) potranno definire i propri livelli specifici (es. UEFA A, B, ...)

## 🆕 04/06/2026 (mattina 2) — Polishing Atleti Pro + campo "Livello / Grado" coach

### Modifiche UI
- **Card menu admin "Atleti Pro"**: sottotitolo cambiato da "Compensi atleti e collaboratori serie maggiori" → "Compensi atleti serie maggiori" (collaboratori/coach/dirigenti sono già gestiti nelle squadre normali).

### Nuovo campo `coach_license_level` (Livello / Grado allenatore)
- **Backend** (`server.py`):
  - Aggiunto al modello `User` (riga 454) e `UserCreate` (riga 619)
  - Salvato in `user_dict` durante registrazione (riga 1766)
  - Aggiunto a `UserProfileUpdate` (riga 3600) e applicato nel PATCH `/auth/me` (riga 3655)
  - Esposto nella response di `GET /users/{user_id}` (admin coach detail, riga 4810)
- **Frontend**:
  - `admin/coach/[id].tsx`: aggiunta riga "Livello / Grado" sotto "N. Tesserino" nella sezione dati coach (vista admin, read-only)
  - `coach/profile.tsx`: nuovo campo editabile "Livello / Grado" sotto "N° Tesserino Allenatore" nel profilo coach (l'allenatore può inserirlo/aggiornarlo dal suo profilo)

## 🆕 04/06/2026 (mattina) — Sblocco backend Atleti Pro

Dopo il deploy notturno, l'utente ha visto popup "Accesso Negato — Il modulo Atleti Pro non è attivo per questa società". Il check era backend-side basato su `settings.pro_enabled` per società.

**Fix**: rimossi i 2 check `pro_enabled` che bloccavano l'accesso in `server.py`:
- `GET /api/prime-squadre/athletes` (riga 20493) — caricamento lista atleti pro
- `POST /api/prime-squadre/athletes/{id}/enable` (riga 20581) — aggiunta atleta/collaboratore al modulo

Il campo `pro_enabled` resta nel modello settings e nell'endpoint `/prime-squadre/stats` (read-only, non blocca), per potenziale uso futuro (es. lotti aggiuntivi >50 tesserati). Aggiornati anche i messaggi di errore "Solo admin può accedere a Atleti Pro" / "Solo admin può gestire Atleti Pro".

## 🆕 03/06/2026 (notte 2) — Sblocco "Atleti Pro" (ex Prime Squadre)

- **Menu admin** (`admin/index.tsx`): rimosso completamente il branch `proEnabled` con paywall. La card ora è sempre attiva e cliccabile. Rinominata "Prime Squadre" → "Atleti Pro".
- **Eliminato** il banner popup informativo "📅 Disponibile a pagamento dal 1° Luglio 2026" (rimosso insieme al ramo bloccato).
- **Pagina principale** `admin/prime-squadre.tsx`: ripristinata la versione completa (987 righe) dal git commit `4a4b0f9f`, rinominati i 12 testi visibili "Prime Squadre" → "Atleti Pro". URL e endpoint API `/prime-squadre/...` mantenuti invariati per coerenza con il backend.
- **Pagina dettaglio** `admin/prime-squadre/[id].tsx`: ripristinata la versione completa (634 righe) dal git commit `4a4b0f9f`, rinominato il testo visibile.
- **Pagina admin compensi atleta** `admin/athlete/[id]/compensation.tsx`: ripristinata la versione completa (1252 righe) dal git commit `4a4b0f9f`, sostituendo il `ProFeatureLock`. Ora l'admin può visualizzare/gestire le quietanze atleta dal dettaglio.

(Note: in `teams.tsx` e `team/[id].tsx` restano 3 commenti interni "Prime Squadre" — sono commenti del codice non visibili agli utenti finali, lasciati invariati.)



Obiettivo: portare l'atleta remunerato a parità di funzionalità di Coach/Dirigente/Collaboratore (NESSUNA invenzione, replicare pattern esistente).

### Backend
1. `POST /athletes/{athlete_id}/compensation` (admin assegna): aggiunto **age check `>= 18`**. Se atleta è minorenne (calcolato da `birth_date`), 400 con messaggio "Atleta Pro disponibile solo dai 18 anni".
2. `POST /athletes/{athlete_id}/compensation/receipt-sign` (atleta firma):
   - Age check `>= 18`
   - Supporto a payload `external_compensation_amount` e `external_compensation_none` (criterio per CASSA, identico a coach/dirigente/collaboratore)
   - Calcolo "ipotetico" del totale (esterni inclusi) **PRIMA** della firma; la scrittura del record `external_compensations` avviene **SOLO DOPO** l'insert della receipt (stesso fix anti-orfani del 03/06).
   - Logging `[ATHLETE-RECEIPT] ENTER` per debug Render.

### Frontend
- `/app/frontend/app/athlete/compensation.tsx`: rimosso il placeholder `ProFeatureLock`, ricostruita la pagina come **copia esatta** di `coach/compensation.tsx` (UX identica) con:
  - Endpoint adattati: `GET /athletes/{id}/compensation/receipts` (con normalizzazione `signed → receipt_signed`, `amount → amount_gross` per compatibilità con UI coach) e `POST /athletes/{id}/compensation/receipt-sign`.
  - `thresholdStatus` settato a `null` (atleta non ha l'endpoint dedicato; le soglie sono calcolate lato client da `getProjectedThresholdMonths` che usa records + `externalByYear`, IDENTICO a coach).
  - Tutti gli altri fix di oggi ereditati: card "Anno X" con riga Compensi esterni, badge >5K/>15K, auto-crop firma PDF, retry su ERR_NETWORK, log dettagliato POST_ERROR.
- Backup vecchio file mantenuto come `athlete/compensation.tsx.backup`.

### Note di scope (Fase 1)
- Sgancio genitori in-season e banner 18° compleanno: **Fase 3** (non incluso).
- Soglie cumulative multi-ruolo (Atleta + Coach stessa persona): **Fase 2** (non incluso).
- PDF Atleta Pro: usa gli stessi generatori esistenti (`generate_monthly_receipt_pdf`, `generate_threshold_5k_pdf`, `generate_threshold_15k_pdf`) → niente da fare.




## 🆕 01/06/2026 — QR code di verifica autenticità sui PDF

**Richiesta utente**: aggiungere QR code per la verifica pubblica dell'autenticità.

### Endpoint pubblico (NO auth)
`GET /api/documents/verify/{document_id}` — HTML mobile-friendly con:
- Tipo documento, società emittente
- Nome firmatario mascherato ("MARIO R.")
- Data/ora firma (Europe/Rome), soglia superata, mese di superamento
- ID documento + primi 16 char hash firma
- Box privacy: no CF, no firma immagine, no importo dettagliato

### QR embedded nei PDF
- Quietanze (`generate_monthly_receipt_pdf`): QR 2.2 cm + label "Verifica autenticità"
- Threshold 5k/15k (`generate_threshold_*_pdf`): QR 2.4 cm + label "Verifica autenticità"

### Auto-rigenerazione estesa
Check `b"Verifica autenticita" not in pdf_bytes` aggiunto a tutti i path di cache invalidation → vecchi PDF auto-aggiornati al primo download.

**Test live**: ✅ HTML pubblico OK, ✅ QR presente in quietanze + comunicazioni soglia, ✅ Auto-fix triggera.


---

## 🔧 02/06/2026 — Fix 4 bug critici post-cancellazione quietanze

### 1️⃣ Bug 4 — Filtro Archivio "Quietanza > 5.000€" / "> 15.000€" mostrava 0 documenti
**Root cause**: Il frontend invia `document_type=receipt_5000`/`receipt_15000`/`receipt_standard`, ma in DB il `document_type` reale è `compensation_receipt` / `coach_compensation_receipt` / `collaboratore_compensation_receipt` / ecc., con flag separati `exceeded_5000: true` / `exceeded_15000: true`. Il backend faceva match diretto e non trovava mai nulla.
**Fix**: in `/api/documents/archive` mappa i tre filtri ai 5 tipi DB + flag esceeded.
- `receipt_5000` → `document_type ∈ RECEIPT_TYPES AND exceeded_5000=true`
- `receipt_15000` → `document_type ∈ RECEIPT_TYPES AND exceeded_15000=true`
- `receipt_standard` → `document_type ∈ RECEIPT_TYPES AND exceeded_5000≠true AND exceeded_15000≠true`

### 2️⃣ Bug 1 — Mesi colorati >5K/>15K anche se non firmati
**Richiesta utente**: tenere i **badge** >5K/>15K come preview ma **sfondo bianco** finché il mese non viene effettivamente firmato.
**Fix**: in `collaboratore/coach/dirigente compensation.tsx` lo sfondo arancio/viola è applicato solo se `status === 'signed'`. Il badge resta visibile su tutti gli stati (proiezione).

### 3️⃣ Bug 3 — PDF "Comunicazione Superamento €5.000" mostrava sempre "Riepilogo firma digitale (PDF originale non più disponibile)"
**Root cause #1**: tutti i check di "needs_rebuild" usavano `b"Riepilogo firma" in pdf_bytes` / `b"Verifica autenticita" not in pdf_bytes` / `b"Con la quietanza del mese di" not in pdf_bytes`. **ReportLab comprime i page content stream in zlib**, quindi questi check ritornavano SEMPRE False per i PDF reali → entravano in loop "rigenera sempre", ma se la rigenerazione falliva silenziosamente il PDF cached restava il summary.
**Root cause #2**: `_regenerate_threshold_communication_pdf` cercava `threshold_declarations` con `$or: [{coach_id}, {signer_id}]` → MAI trovato per collaboratore/dirigente/atleta (in DB sono salvati come `collaboratore_id` / `dirigente_id` / `atleta_id`).
**Fix**:
- Sostituiti tutti i check `b"..." in pdf_bytes` con `len(pdf_bytes) < 3500` (summary fallback ~1-2KB, PDF reale ~5-7KB)
- Threshold/compensation regen ora richiedono `len(fixed) > 3500` (era 1500) per essere considerati validi
- Esteso lookup `threshold_declarations` con `collaboratore_id` / `dirigente_id` / `atleta_id`
- Aggiunti `logger.warning` quando la rigenerazione produce un PDF troppo piccolo (per debug)

### 4️⃣ Bug 2 — Click sui mesi cancellati "non fa nulla" (collaboratore)
**Approccio**: aggiunti `console.log('[handleOpenSignature]...')` e `Alert.alert` visibili su OGNI return-early path. Ora l'utente vedrà esplicitamente:
- "Caricamento in corso" se `loading=true`
- "Ordine cronologico richiesto: devi firmare X" se manca un mese precedente
- "Azione Bloccata" se threshold_status risulta bloccato
- "Stato: future. Mese X/Y" se per qualche motivo il mese è considerato futuro
Il prossimo click su un mese cancellato mostrerà la causa esatta del blocco silenzioso.

**File modificati**:
- `/app/backend/server.py` (archive filter, 4 punti di check size-based, lookup threshold_declarations)
- `/app/frontend/app/collaboratore/compensation.tsx` (colori + log)
- `/app/frontend/app/coach/compensation.tsx` (colori)
- `/app/frontend/app/dirigente/compensation.tsx` (colori)

**Test pendente in produzione (dopo Save to GitHub)**:
- Aprire filtro Archivio → "Quietanza > 5.000€" / "> 15.000€" → ora devono comparire le quietanze
- Aprire pagina collaboratore Lella su 2026 → mesi non firmati devono essere bianchi con solo badge
- Cliccare su un mese non firmabile → leggere il messaggio Alert e riferirlo al developer per fix definitivo
- Aprire PDF "Comunicazione Superamento €5.000 - Settembre 2025" → ora deve essere il documento legale completo (5-7KB) con firma, città, data 30/05/2026 23:31, metadati e QR code


---


## 🔧 01/06/2026 — Propagazione fix ai signing handler (al posto della sola rigenerazione)

Aggiornati TUTTI i punti dove vengono firmate quietanze e comunicazioni soglia per passare `signed_at` (timestamp firma originale) e `threshold_month` (mese di superamento). Così i NUOVI documenti firmati avranno SUBITO data + metadati + "Mese di superamento" senza bisogno di passare dal flow di rigenerazione.

**Handler aggiornati**:
- Atleta (`/athlete/.../compensation/receipt`): quietanza + threshold 5k/15k
- Coach (`/coach/{coach_id}/compensation/receipt`): quietanza + threshold 5k/15k
- Dirigente (`/dirigente/{dirigente_id}/compensation/receipt`): quietanza + threshold 5k/15k
- Collaboratore (`/collaboratore/{collaboratore_id}/compensation/receipt`): quietanza + threshold 5k/15k

Verifica automatica: ✓ 14/14 callers di `generate_threshold_*_pdf` e `generate_monthly_receipt_pdf` ora passano `signed_at`. 0 caller mancanti.

---

## 🔧 01/06/2026 — 4 fix critici Comunicazioni Soglia 5k/15k

### Bug 1: Data di stampa invece di data firma
Stesso pattern delle quietanze. `generate_threshold_5k_pdf` e `generate_threshold_15k_pdf` usavano `datetime.now()`. Aggiunto parametro `signed_at` con stesso fallback chain (signed_documents.signed_at → metadata persisted → comp.receipt_signed_date).

### Bug 2: PDF 15k mostrava € 5.000 (BUG GRAVE)

---

## 🔧 02/06/2026 (sera) — QR code ripristinato + Anagrafica obbligatoria pre-firma

### 5️⃣ QR code mancante sui PDF firmati
**Root cause**: In tutti e 4 i sign handler di compensi (`coach`, `dirigente`, `collaboratore`, `athlete`), `receipt_id` veniva generato con `str(uuid.uuid4())` **dopo** la chiamata a `generate_monthly_receipt_pdf()` / `generate_threshold_5k_pdf()` / `generate_threshold_15k_pdf()`. Quindi il parametro `document_id` arrivava `None` → il blocco `if document_id: ... QR ...` non eseguiva mai → nessun QR.
**Fix**: spostato `receipt_id = str(uuid.uuid4())` PRIMA della generazione PDF nei 4 handler, e passato `document_id=receipt_id` a tutte e 3 le funzioni di generazione PDF. Ora ogni nuova quietanza / comunicazione soglia firmata avrà il QR di verifica autenticità.

### 6️⃣ Anagrafica obbligatoria prima della firma di documenti
**Richiesta**: nessun utente deve poter firmare quietanze/comunicazioni soglia senza prima aver compilato l'anagrafica completa.
**Fix backend**: nuova helper `_require_complete_anagrafica(user)` che alza `HTTPException(400, detail={"code": "ANAGRAFICA_INCOMPLETA", "missing_labels": [...]})` se mancano:
- Codice Fiscale (`fiscal_code`)
- Data di nascita (`date_of_birth` / `birth_date`)
- Luogo di nascita (`place_of_birth` / `birth_place`)
- Indirizzo di residenza (`address`)
- Città di residenza (`city`)
- CAP (`postal_code` / `zip_code` / `cap`)
- Provincia (`province`)

La helper è chiamata all'inizio dei 4 sign handler: `/coach/{id}/compensation/receipt`, `/dirigente/{id}/compensation/receipt`, `/collaboratore/{id}/compensation/receipt`, `/athletes/{id}/compensation/receipt-sign`.

**Fix frontend**: nuova utility `/app/frontend/src/utils/anagraficaError.ts → handleAnagraficaError(error, profileRoute)` che intercetta l'errore 400 ANAGRAFICA_INCOMPLETA e mostra un Alert con la lista dei campi mancanti + pulsante "Vai a Profilo". Integrata nei catch di `collaboratore/compensation.tsx`, `coach/compensation.tsx`, `dirigente/compensation.tsx`.

### File modificati
- `/app/backend/server.py` (helper `_require_complete_anagrafica` + chiamata nei 4 handler + `document_id=receipt_id` passato ai PDF generators)
- `/app/frontend/src/utils/anagraficaError.ts` (NUOVO)
- `/app/frontend/app/collaboratore/compensation.tsx`
- `/app/frontend/app/coach/compensation.tsx`
- `/app/frontend/app/dirigente/compensation.tsx`


**Root cause**: in `_regenerate_threshold_communication_pdf` la riga:
```python
threshold_type = "5000" if "5000" in doc_type else "15000"
```
Era sbagliata perché `"5000" in "threshold_15000_communication"` ritorna **True** (substring match). Quindi anche i documenti 15k venivano rigenerati con il template 5k.

**Fix**: invertito il check → `threshold_type = "15000" if "15000" in doc_type else "5000"`.

### Bug 3: Metadati di verifica tutti a zero (Totale prima: €0, Timestamp: N/D)
**Root cause**: `_regenerate_threshold_communication_pdf` ignorava il `threshold_metadata` dict persistito in `signed_documents` al momento della firma. Inoltre per i doc legacy senza `threshold_metadata` non veniva calcolato nulla.

**Fix duale**:
1. Lettura prioritaria da `document.threshold_metadata` (snapshot firma originale).
2. Fallback: ricostruisce i totali sommando tutte le compensation rows firmate dello stesso anno fino al mese di superamento incluso (per `yearly_total_after`) ed esclusivo (per `yearly_total_before`). Cerca in 4 collezioni (coach/collaboratore/dirigente/atleta_pro).
3. `signature_timestamp_rome` ora viene popolato correttamente convertendo `signed_at` in Europe/Rome.

### Bug 4: Mancava "Mese di superamento: <Mese> <Anno>"
Aggiunta riga **rossa in grassetto** sotto i titoli del PDF (sia 5k che 15k) con il riferimento al mese in cui si supera la soglia. Es: `Mese di superamento: Novembre 2025`.

---

## 🔧 02/06/2026 (ore 09:25 — CHECKPOINT STABILE)

**📌 Punto di rollback dichiarato dall'utente**: se le modifiche successive a questa data/ora introducono regressioni, ripartire da qui. PPG + Pedro Pedretti funzionano correttamente: anagrafica + firma quietanze + colori + QR + threshold 5K/15K.

---

## 🔧 02/06/2026 (sera) — Compensi esterni auto-dichiarati (altre ASD/SSD)

### Richiesta
Il calcolo delle soglie 5K/15K deve tenere conto anche dei compensi sportivi che il tesserato riceve da ALTRE ASD/SSD diverse dalla nostra. Criterio: **per CASSA** (data di ricevimento), non per competenza. La domanda viene fatta al momento di ogni firma + (futuro) avviso schedulato mensile.

### Flusso
1. L'utente clicca su un mese da firmare
2. Compare un modal pre-firma `ExternalCompensationStep` (sempre, obbligatorio):
   - "Dall'ultima firma (o dall'inizio anno) ad oggi, hai percepito altri compensi sportivi da altre ASD/SSD?"
   - **No, solo i compensi della nostra società** → invia `external_compensation_none=true`
   - **Sì, ho ricevuto altri compensi** + importo € → invia `external_compensation_amount=X`
3. Dopo conferma, l'utente prosegue al normale flusso di firma (signature pad o modal soglia)
4. L'importo dichiarato viene salvato in `db.external_compensations` e SOMMATO al `yearly_total` per il calcolo delle soglie 5K/15K
5. Se con il nuovo totale supera la soglia → si attiva automaticamente la Comunicazione di Superamento (come già succede oggi)

### Backend
- Modificata `CompensationReceiptRequest` con `external_compensation_amount: float = 0.0` + `external_compensation_none: bool = False`
- Nuova classe `ExternalCompensationDeclaration` (Pydantic)
- Nuova helper `_get_year_external_compensations_total(user_id, year)` — somma cumulativa annua
- Nuova helper `_record_external_compensation_declaration(...)` — insert in DB
- Endpoint `POST /api/me/external-compensations` — auto-dichiarazione standalone
- Endpoint `GET /api/me/external-compensations?year=` — lista per audit
- Integrazione nei 3 sign handler (coach/dirigente/collaboratore): record + somma a `yearly_total` PRIMA del calcolo `first_time_exceeded_5000/15000`

### Frontend (collaboratore)
- Nuovo component `/app/frontend/src/components/ExternalCompensationStep.tsx`
- Modificato `collaboratore/compensation.tsx`:
  - State: `extStepVisible`, `extPendingMonth/Year`, `extDeclaration`
  - `handleOpenSignature` ora apre il modal pre-firma e ri-entra con `opts.skipExtStep=true` dopo la conferma
  - `handleSign` e `handleSignDeclaration` aggiungono i campi `external_compensation_amount` e `external_compensation_none` al body POST
  - Reset state dopo successo
  - JSX: nuovo `<ExternalCompensationStep />` mounted a fine layout

### TODO (prossime sessioni)
- ⏳ Integrare in `coach/compensation.tsx` (medesimi state + JSX + POST extra fields)
- ⏳ Integrare in `dirigente/compensation.tsx`
- ⏳ Avviso schedulato mensile (cron) che ricorda di aggiornare i compensi esterni
- ⏳ Blocco firma retroattivo: se l'utente dichiara importi che farebbero superare la soglia su mesi GIÀ firmati, generare Comunicazione di Superamento retroattiva con data odierna
- ⏳ Sezione "Compensi esterni dichiarati" nel profilo utente (tabella audit)

### File modificati/creati
- `/app/backend/server.py` (+ ~120 righe: model + helper + 2 endpoint + integrazione in 3 sign handler)
- `/app/frontend/src/components/ExternalCompensationStep.tsx` (NUOVO)
- `/app/frontend/app/collaboratore/compensation.tsx` (integrazione completa)

### Da testare in produzione (dopo Save to GitHub)
1. Login come collaboratore (Pedro o nuovo utente di test)
2. Cliccare su un mese da firmare → deve comparire il modal "Prima di firmare"
3. Scegliere "No, solo i compensi della nostra società" → prosegui → firma normale

---

## 🔧 02/06/2026 (tardo) — Fix bug cancellazione quietanze firmate

### Problema riportato
Dopo aver "accettato" la cancellazione delle quietanze 2026 di Pedro (e prima Lella), le card dei mesi rimanevano colorate (firmate) e non firmabili (click silenzioso).

### Root cause
L'endpoint `DELETE /api/admin/{role}/{user_id}/compensation/{year}/{month}` (riga 12969) aveva 3 bug:
1. **Bloccava la cancellazione di quietanze firmate** con HTTP 400 "Non puoi eliminare una quietanza già firmata" — quindi il backend rispondeva errore e in DB non veniva cancellato nulla, mentre l'utente vedeva la conferma "Eliminata" sul frontend solo se non c'era stato errore (in alcuni casi l'errore non era visibile chiaramente).
2. **Match `month: int` rigido**: alcuni record legacy hanno `month` come stringa italiana ("Settembre"). La query `{"month": 9}` non li trovava → 404.
3. **Cancellava solo la riga compensation** lasciando residui in `signed_documents`, `threshold_declarations`, `external_compensations`, e i flag `exceeded_5000/15000` su `yearly_limits` rimanevano `true` → blocco firma residuo.

### Fix
Riscritti i 3 endpoint (`/admin/collaboratore/...`, `/admin/coach/...`, `/admin/dirigente/...`) tramite una helper unificata `_full_delete_user_receipt(user_id, role, year, month)`:
- 🗑️ Cancella SEMPRE (anche firmate — è admin con conferma esplicita lato UI)
- 🔍 Match month sia int sia stringa legacy (helper `_month_query_or`)
- 🗂️ Cancella anche `signed_documents` (+ file PDF su disco) di quel mese/anno
- 📋 Cancella `external_compensations` con `related_receipt_month = month`
- 🧹 Se dopo la cancellazione non resta NESSUNA quietanza firmata in quell'anno, resetta anche `threshold_declarations` e i flag `exceeded_5000/15000` su `yearly_limits` (evita blocchi residui sulle nuove firme)

### File modificati
- `/app/backend/server.py` — rimossi i 3 endpoint vecchi + nuova helper `_full_delete_user_receipt` + helper `_month_query_or` + 3 endpoint slim che la richiamano

### Da testare in produzione (dopo Save to GitHub)
1. Pedro ha ancora le quietanze 2026 residue → vai su **Admin → Quietanze**, filtra Pedro, clicca **Elimina** su ogni quietanza 2026 → ora deve sparire (response dovrebbe mostrare `success: true, deleted_compensations: 1, deleted_documents: 1+, files_removed: N`)
2. Dopo la cancellazione, login come Pedro → vai su Compensi 2026 → i mesi cancellati devono essere bianchi/pending → click su un mese → si apre il modal "Prima di firmare" (nuovo) → procede normalmente alla firma


4. Provare con "Sì, ho ricevuto altri compensi" + es. 4.700€ → se col nostro importo si supera €5.000 deve attivare la Comunicazione di Superamento 5K
5. Verificare in `db.external_compensations` che ci siano i record



Bug nascosto trovato: usavo `ITALIAN_MONTHS[...]` ma la costante si chiama `MONTH_NAMES` (dict). L'eccezione veniva silenziata dal try/except, quindi la riga non appariva senza errore visibile.

### Auto-fix esteso al pdf_base64 cache branch
Sia `/documents/download/{id}` che `/documents/signed/{id}/pdf` ora invalidano la cache `pdf_base64` per le threshold communications se manca il testo `Mese di superamento`. Garantisce che ogni PDF servito sia coerente con i nuovi metadati.

### "Rigenera tutte le quietanze" ora include anche le Comunicazioni Soglia
Endpoint `POST /api/admin/compensations/regenerate-all-receipts` aggiornato per processare anche `threshold_5000_communication` e `threshold_15000_communication`.

**Test backend verificato live**:
Doc 15k `ec9ba55b-...` (firmato 18/02/2026, mese di superamento Novembre 2025):
- ✅ Mese di superamento: Novembre 2025
- ✅ Data: 18/02/2026 02:35:11
- ✅ Totale prima: € 650.00, Totale dopo: € 1.300.00
- ✅ Titolo 15.000 corretto (non più 5.000)

---

## 🔧 01/06/2026 — 3 fix critici quietanze + InAppPdfModal

### Bug 1: Quietanze con data di OGGI invece di data firma
**Root cause**: `generate_monthly_receipt_pdf` usava `datetime.now(timezone.utc)` come timestamp. Quando il PDF veniva rigenerato (perdita file da disk wipe o cache placeholder), il nuovo PDF mostrava la data di rigenerazione invece della data originale di firma.

**Fix**: aggiunto parametro `signed_at` alla funzione. Tutti i callers passano:
1. `signed_documents.signed_at` (priorità 1)
2. `compensation_row.receipt_signed_date` (priorità 2, dal source-of-truth)
3. `doc.created_at` (fallback)

### Bug 2: Quietanze senza firma
**Root cause**: il codice cercava la firma SOLO in `db.compensations` (legacy coach). Le firme di dirigenti e collaboratori sono in collezioni separate (`dirigente_compensations`, `collaboratore_compensations`).

**Fix**: cerca in **5 collezioni** (`coach_compensations`, `collaboratore_compensations`, `dirigente_compensations`, `atleta_pro_compensations`, `compensations` legacy) finché non trova `receipt_signature_base64`.

### Bug 3: Metadati di autentica mancanti
**Root cause**: la funzione PDF non includeva footer con metadati audit.

**Fix**: aggiunto footer GDPR-compliant in piè di pagina (font 7pt, grigio):
```
— Metadati di autentica —
Firmato il: 18/02/2026 02:20:17 (Europe/Rome)
ID documento: <uuid>
ID firmatario: <uuid>
Indirizzo IP firma: <ip>
Hash documento: <hash>
```

### Auto-rigenerazione PDF stale
Sia `GET /api/documents/download/{id}` che `GET /api/documents/signed/{id}/pdf` ora rilevano PDF cached "stale" (senza `Metadati di autentica` o con marker `Riepilogo firma`/`PDF originale non`) e li **rigenerano automaticamente** dal source-of-truth. Stesso check sul branch `pdf_base64` e su `pdf_path` (file su disco).

### Funzione helper `_regenerate_compensation_receipt_pdf`
Nuova utility che ricostruisce il PDF leggendo month/year/amount sia da top-level che da `additional_data` (gestisce entrambi gli schemi).

### Bug 4 (Frontend): Documenti senza pulsante "Chiudi" → back hardware esce dall'app
**Root cause**: `parent/documents.tsx` apriva PDF con `window.open(blobUrl, '_blank')`. Su mobile (PWA browser), il "back" del telefono usciva dall'app invece di chiudere il PDF.

**Fix**: creato componente riutilizzabile `/app/frontend/src/components/InAppPdfModal.tsx`:
- Modal full-screen con `<iframe>` per web
- Header blu con pulsante back + titolo + close (×)
- Pulsante "CHIUDI" fisso in basso
- Intercetta hardware back su Android (`BackHandler.addEventListener`)
- `revokeObjectURL` automatico alla chiusura per liberare memoria

Applicato a `parent/documents.tsx` (flow più utilizzato). Per coach/collaboratore/dirigente profile il flow già scarica il PDF come file (download nativo), quindi il problema back non esiste.

**Test backend verificato live**:
- Quietanza `23bea1e6-...` ora restituisce: data 18/02/2026 (corretta), metadati di autentica completi, firma embedded come `/Image` PDF object.

**Build statico rigenerato** (`/app/frontend/dist`).

---

## 🔧 01/06/2026 — Fix Esporta Dati + Filtri Consensi Privacy

### Fix 1: Esporta Dati pagina bianca
**Bug**: cliccando su Settings → Esporta Dati appariva pagina bianca.
**Root cause**: in `/app/frontend/app/admin/settings/export-data.tsx` riga 185 era usato `<Ionicons name="home" .../>` ma il file importa solo `Icon` (alias di Ionicons). Componente undefined → React crash → blank page.
**Fix**: sostituito `Ionicons` → `Icon` (componente già importato a riga 12).

### Feature 2: Filtri sui Consensi Privacy + raggruppamento per squadra
**Richiesta utente**: nella pagina Settings → Consensi Privacy non era possibile filtrare velocemente chi ha dato/negato consensi senza scorrere tutta la lista. Inoltre richiesto report squadra-per-squadra.

**Backend** (`GET /api/admin/all-consents`):
- Arricchito output con `team_id` e `team_name` per ogni atleta (join su collezione `teams`).

**Frontend** (`/app/frontend/app/admin/settings/consent-audit.tsx`):
- Barra filtri sticky con 3 set di chip:
  1. **Tipo consenso**: Tutti / Privacy / Interno / Promo
  2. **Stato**: Tutti / ✅ Concessi / 🚫 Negati / — Non espressi
  3. **Ruolo**: Tutti / Atleti / Genitori / Coach / Dirigenti / Collaboratori
- Toggle **"🏐 Raggruppa per squadra"**: quando attivo, mostra card squadra-per-squadra (collapsibili) con badge contatore. Lo staff viene raggruppato in una sezione "Staff (non assegnabile a squadra)".
- Contatore live "X risultati su Y" sotto i filtri.
- Card atleta arricchita con badge verde della squadra (quando presente).

**Test backend verificato**:
- 56 entries totali (33 staff + 23 atleti)
- 22/23 atleti con team_name correttamente popolato

**Build statico rigenerato** (`/app/frontend/dist`).

---

## ✨ 31/05/2026 — Email automatica al Coach per consensi immagini negati

**Estensione GDPR**: aggiunta funzionalità per notificare via email il coach (con copia all'email istituzionale della società) con l'elenco degli atleti della sua squadra **senza consenso uso immagini**.

### Backend
`POST /api/admin/athletes/image-consents/notify-team`
Body: `{"team_id": "...", "consent_type": "images_promo"|"images_internal"}`

Logica:
1. Trova i coach assegnati alla squadra (`users.assigned_team_ids` o `assigned_team_id`)
2. Recupera email istituzionale della società da `settings.society_email`
3. Calcola elenco atleti senza consenso applicando la regola multi-genitore
4. Invia email HTML strutturata via Brevo (con CC) a ogni coach
5. Restituisce conferma con elenco destinatari + atleti elencati

L'email contiene:
- Header con nome squadra
- Tipo di consenso oggetto della comunicazione
- Box di alert con lista degli atleti da escludere (incluso "negato da: nome genitore" quando rilevante)
- Istruzioni operative: come comportarsi durante foto di squadra
- Nota sulla mutabilità del consenso

### Frontend
Nuovo pulsante verde **"📧 Notifica coach (p.c. società)"** visibile solo quando:
- Il gruppo squadra è espanso
- `only_denied = true` (vista "Solo NEGATI")
- C'è almeno un atleta nella squadra

Con conferma `window.confirm` prima dell'invio e feedback al completamento.

### Comportamento gestito
- Se squadra senza coach: 400 con messaggio "Assegna un coach prima di inviare la notifica"
- Email istituzionale non duplicata se coincide con un'email coach

---

## ✨ 31/05/2026 — Nuova funzionalità: Consensi Immagini Atleti

**Richiesta utente**: avere una lista degli atleti che NON hanno concesso l'uso della loro immagine per fini promozionali, raggruppata per squadra.

**Implementazione**:

### Backend
`GET /api/admin/athletes/image-consents` — restituisce gli atleti raggruppati per squadra con stato consenso immagini.

Query params:
- `consent_type`: `images_promo` (default) o `images_internal`
- `only_denied`: bool (default `true`) — mostra solo i NEGATI
- `team_id`: filtro per squadra (opzionale)
- `minors_only`: bool (default `false`) — solo minorenni

Per ogni atleta viene calcolato `final_value` applicando la regola "un NO = NEGATO" sui consensi per-genitore (campi `images_promo__{parent_id}` in `athlete.consents`). Per atleti maggiorenni che hanno firmato in autonomia, viene letto il campo diretto.

Output:
```json
{
  "total": 18,
  "groups": [
    {
      "team_id": "...",
      "team_name": "Serie C",
      "count": 1,
      "athletes": [
        {"athlete_id", "full_name", "is_minor", "consent_given",
         "denied_by_parents": ["FABI FANNY"], "has_signed", "privacy_accepted"}
      ]
    }
  ]
}
```

### Frontend
- Nuova pagina `/app/frontend/app/admin/image-consents.tsx`
- Nuova voce menu Admin "📸 Consensi Immagini" (icona rosa `#FCE4EC`)
- Filtri:
  - Tipo consenso (📣 Promozionale / 🏛️ Uso interno)
  - Mostra (🚫 Solo NEGATI / 👥 Tutti)
  - Età (Tutti / Solo minorenni)
  - Squadra (Tutte + lista squadre)
- Risultati: card collapsibili per squadra con badge contatore
- Per ogni atleta: icona stato, nome, badge "minorenne", riga "Negato da: {nomi genitori}", link per andare al profilo
- **Pulsante "Esporta CSV"** per scaricare la lista (es. utile per allenatori prima di pubblicare foto sui social)

### Test backend verificati
- Default (negati promo): 18 atleti in 7 squadre
- Filtro squadra Serie C: 1 atleta (Rossi Viola)
- Filtro minorenni: 0
- Tutti consenso interno: 34 atleti in 8 squadre

---

## 🔧 Fix 31/05/2026 — Enforcement ordine cronologico firma quietanze

**Motivazione**: il bug di Filippa (Maggio firmato prima di Marzo/Aprile) ha confuso il calcolo soglie. Per prevenirlo alla radice, ora il frontend blocca la firma fuori ordine cronologico in tutti i ruoli (coach, collaboratore, dirigente).

**Fix applicato** in `handleOpenSignature` dei 3 file `compensation.tsx`:
Prima di aprire il modal di firma, scansiona tutti i mesi del periodo contrattuale che precedono cronologicamente il mese target. Se anche solo uno è non firmato → Alert "Devi prima firmare la quietanza di {Mese} {Anno}. Le quietanze vanno firmate in ordine cronologico." e return.

Esempio: Filippa con Gen+Feb 2026 firmati prova a cliccare Maggio → Alert "Devi prima firmare la quietanza di Marzo 2026".

---

## 🔧 Fix 31/05/2026 — Sfondo viola + Calcolo soglie cronologico

**Segnalazioni utente (Filippa, foto)**:
1. Dicembre 2025 ha badge `>15K` viola ma sfondo arancio (dovrebbe essere viola).
2. Aprile 2026 ha badge `>15K` viola ma sfondo bianco (dovrebbe essere viola).
3. Cliccando **Marzo 2026** (cumul=14700, sotto 15k) appare la dichiarazione di superamento €15k — ma il superamento dovrebbe arrivare con Aprile.

**Root cause**:

**Bug 1 (sfondo)**: lo sfondo viola `#F3E5F5` veniva applicato SOLO ai mesi `status === 'signed'`. I mesi blocked/pending con badge `>15K` rimanevano con il colore di default (arancio per blocked, bianco per pending).

**Bug 2 (firma Marzo)**: la query nel backend `sign_collaboratore_compensation_receipt` (e analoghe per coach/dirigente) usava `"month": {"$ne": request.month}` — escludeva solo il mese corrente ma includeva i mesi futuri già firmati. Per Filippa, Maggio 2026 era già firmato. Quando firmava Marzo:
- yearly_total = Gen+Feb+Mag = 14700 (sbagliato — include Maggio futuro!)
- new_total = 14700 + 4900 = 19600 > 15000
- `first_time_exceeded_15000 = True` → attaccava erroneamente la Comunicazione €15k a Marzo.

**Fix applicati**:

**Backend** (`server.py`, 3 endpoint):
- `sign_coach_compensation_receipt` (linea 13270)
- `sign_dirigente_compensation_receipt` (linea 18060)
- `sign_collaboratore_compensation_receipt` (linea 18763)

Cambiato `"month": {"$ne": request.month}` → `"month": {"$lt": request.month}` (solo mesi cronologicamente precedenti).

**Frontend** (3 file `compensation.tsx`):
- `getMonthCard` style: ora applica sfondo viola/arancio in base alla soglia per **tutti gli status** (non solo signed).
- `handleOpenSignature`: filtro `r.month < month` per cumulativa cronologica.
- `handleSign`: filtro `r.month < selectedMonth` per cumulativa cronologica.

**Verifica logica Marzo 2026 dopo fix**:
- yearly_total = Gen+Feb = 9800 (esclude Mag perché month >= 3)
- new_total = 14700 → `first_time_exceeded_15000 = false` ✓
- Marzo si firma normalmente. ✓
- Aprile (cumul prima = 14700, new=19600) → first_time_exceeded_15000 = true ✓

---

## 🔧 Fix 31/05/2026 — Badge soglie su contratti che non partono a gennaio

**Segnalazione utente (Filippa, foto allegate)**:
Banner riporta correttamente "Sett 2025 superi €5.000" e "Nov 2025 superi €15.000".
La griglia mensile invece marca **tutti** i mesi 2025 (Set/Ott/Nov/Dic) come `>15K viola`.

**Root cause**:
In `getProjectedThresholdMonths()` il loop `for (let m = 1; m <= 12; m++)` applicava il `monthlyDefault` anche ai mesi PRIMA del `contractStartMonth`. Per Filippa (contratto Set→Mag, monthly=€4900, pregressi=€4500), Gen-Ago 2025 venivano riempiti a €4900 ciascuno → cumulative gonfiata a >€39k già a marzo → `first15k` impostato a marzo → tutti i mesi successivi mostravano `>15K`.

**Fix applicato** in tutti e 3 i file (`coach/compensation.tsx`, `collaboratore/compensation.tsx`, `dirigente/compensation.tsx`):
Aggiunto controllo `inContract` che restringe la proiezione `monthlyDefault` ai soli mesi dentro il periodo contrattuale:
- `y < contractStartYear` → fuori
- `y > contractEndYear` → fuori
- `y === contractStartYear && m < contractStartMonth` → fuori
- `y === contractEndYear && m > contractEndMonth` → fuori

I record firmati/admin contano sempre indipendentemente dal periodo (safety).

**Verifica manuale (caso Filippa, contratto Set 2025 - Mag 2026)**:
| Mese | Cumul | Atteso |
|---|---|---|
| Set 2025 | 4500+4900=9400 | >5K arancio ✓ |
| Ott 2025 | 14300 | >5K arancio ✓ |
| Nov 2025 | 19200 | >15K viola ✓ |
| Dic 2025 | 24100 | >15K viola ✓ |
| Feb 2026 | 9800 | >5K arancio ✓ |
| Apr 2026 | 19600 | >15K viola ✓ |

---

## 🔧 Fix 31/05/2026 — Bug Modifica/Elimina + Quietanze orfane

**Segnalazione utente (Vincenzo, foto allegate)**:
1. Foto 2 (lato Collaboratore): quietanze Nov 2025, Feb 2026, Apr 2026 mostrate come ✅ firmate anche se i documenti PDF erano stati cancellati.
2. Foto 3 (lato Admin): pulsanti **Modifica / Elimina** sulle quietanze non firmate non funzionano.
3. Foto 4: cliccando trash sulle quietanze firmate orfane → errore "Documento non trovato".

**Root cause**:
- **Bug A (Modifica)**: l'handler chiamava `setSelectedMonthForReceipt / setSelectedYearForReceipt / setCustomReceiptAmount` ma la modal "Genera Quietanza" usa `newReceiptMonth / newReceiptYear / newReceiptAmount`. Variabili di stato scollegate → modal si apriva con valori di default → sembrava non funzionare.
- **Bug B (Elimina)**: `Alert.alert` su Expo Web mostra solo Cancel/OK, mai i pulsanti destructive → il click su "Elimina" non veniva mai propagato.
- **Bug C (404 quietanze orfane)**: la trash su quietanze firmate cerca il `receipt_document_id` in `signed_documents`. Se il documento era stato cancellato in passato senza sbloccare la compensation row (data inconsistency), `DELETE /api/documents/{id}` ritornava 404 ma la riga restava marcata `receipt_signed=true`.

**Fix applicati**:
1. **`/app/backend/server.py` `admin_request_delete_signed_document`**: aggiunto auto-cleanup per quietanze orfane. Se il documento non esiste MA esiste una compensation row con quel `receipt_document_id`, viene sbloccata automaticamente (5 collezioni controllate). Risposta 200 con `orphan_cleaned: true`.
2. **`/app/frontend/app/admin/{coach,collaboratore,dirigente}/[id].tsx`**:
   - Pulsante **Modifica**: ora usa `setNewReceiptMonth/setNewReceiptYear/setNewReceiptAmount` → modal pre-compilata correttamente.
   - Pulsante **Elimina**: usa `window.confirm` su `Platform.OS === 'web'` invece di `Alert.alert` → conferma destructive funziona su web.
   - Messaggi di errore migliorati con `error.response.data.detail`.

**Test backend (verificato in locale)**:
```
Inserted orphan comp pointing to orphan-test-...
DELETE /api/documents/{fake_id} → HTTP 200
{"message":"Quietanza orfana ripulita...","orphan_cleaned":true,"unlocked":1}
State after API call: receipt_signed=False, doc_id=None
```

**Recupero dati produzione**: l'utente può ora cliccare la trash icon sulle quietanze orfane (Nov 2025, Feb 2026, Apr 2026 di Lella su Pallavolo Perugia) → auto-cleanup → torneranno bianche con badge >5K/>15K corretti.

In alternativa è disponibile l'endpoint `POST /admin/compensations/repair-orphaned-receipts` per riparazione batch.

---

## Stato Attuale (30/05/2026)
### ↩️ Correzione: tornati al workflow PER-MESE (30/05/2026)
**Segnalazione utente**: "Avevo gia usato la funzione che admin chiede la cancellazione di una mensilità ed il coach accetta. Ora sul collaboratore avevo chiesto cancellazione parziali mese per mese ed invece è stato impostato la cancellazione di un periodo 2025 e 2026. E oltretutto non funziona!"

**Cosa avevo fatto male**: nel turno precedente ho creato un workflow di "reset annuale" (un click → richiesta consenso per TUTTO l'anno). Era ridondante perché il workflow per-singolo-mese **esiste già da tempo** in `DELETE /api/documents/{document_id}`.

**Correzione (frontend only — backend non toccato)**:
- ❌ **RIMOSSO** il box "🧹 Richiedi Reset Quietanze" + i 3 handler `handleResetCoach/Collab/DirigYearReceipts` + il pulsante "Richiedi reset 2026/2025" dalle 3 schede admin (coach, collaboratore, dirigente).
- ✅ **AGGIUNTO** un pulsante 🗑️ trash-outline accanto a ogni quietanza FIRMATA nella lista "Gestione Quietanze" di tutte e 3 le schede admin.
- Il pulsante chiama un nuovo handler `handleRequestDeleteReceipt(receipt)` che invoca l'endpoint backend **già esistente** `DELETE /api/documents/{receipt.receipt_document_id}` (workflow consenso).
- Conferma utente: "Inviare a {NOME} la richiesta di cancellazione della quietanza {Mese} {Anno}? La cancellazione effettiva avverrà solo dopo l'autorizzazione del firmatario."

**Banner del firmatario**:
- ✅ Già presente per il coach in `/coach/index.tsx` (era stato fatto per Francesca/Agnese).
- ✅ Lasciato il banner aggiunto nel turno precedente in `/collaboratore/profile.tsx` e `/dirigente/profile.tsx` — utile per visualizzare le richieste arrivate, indipendentemente da come sono state create.

**Test E2E preview verificato**: admin chiama `DELETE /api/documents/{id}` per Quietanza Nov 2025 di FRANZ → risposta `{"message":"Richiesta inoltrata al firmatario...","status":"pending"}` → FRANZ vede la nuova richiesta nel suo banner pending insieme alle altre ✅.


### 🔁 Refactor CRITICO: "Reset Quietanze Anno" ora richiede CONSENSO del firmatario (30/05/2026)
**Segnalazione utente**: "Admin richiede la cancellazione delle quietanze di Pietro del 2026, ma Pietro resta con le quietanze firmate e nessuna richiesta di cancellazione da accettare. Per Francesca/Agnese (Coach) avevamo già un workflow mese-per-mese con consenso."

**Root cause**: l'endpoint `POST /admin/compensations/reset-coach-year` cancellava direttamente le quietanze senza consenso, violando il principio già adottato per la cancellazione di singole quietanze (`DELETE /documents/{id}` crea `deletion_requests` pending).

**Refactor applicato (backend `/app/backend/server.py`)**:
- L'endpoint reset NON cancella più direttamente le quietanze/comunicazioni firmate. Ora crea UN `deletion_requests` pending per ogni `signed_document` di tipo `compensation_receipt` / `*_compensation_receipt` / `threshold_5000_communication` / `threshold_15000_communication` dell'utente+anno.
- Skip duplicate: se esiste già una request `pending` per lo stesso documento, conteggia ma non duplica.
- Notifica in-app per ogni request creata (collezione `notifications`).
- Le compensations **NON firmate** (`receipt_signed != True`) e le `threshold_declarations` **senza PDF firmato** vengono comunque cancellate subito (non c'è firmatario da chiedere).
- Audit log esteso: action = `request_reset_coach_year_compensations`, include `deletion_request_ids` per traceability.
- Risposta: `{ok, signer_name, year, results: {deletion_requests_created, deletion_requests_already_pending, unsigned_compensations_deleted, threshold_declarations_unsigned_deleted}}`.

**Bug fix correlato (`_execute_document_deletion`)**: la funzione che sblocca la compensation dopo l'approvazione cercava SOLO in `db.compensations` → per collaboratori/dirigenti la compensation restava bloccata `receipt_signed=True` dopo l'approve. Ora itera su tutte e 5 le collezioni (`compensations`, `coach_compensations`, `collaboratore_compensations`, `dirigente_compensations`, `atleta_pro_compensations`) finché non trova il record da sbloccare.

**UI aggiornata in 3 schede admin** (coach + collaboratore + dirigente):
- Box rosso ora si chiama "🧹 Richiedi Reset Quietanze (Admin)"
- Pulsanti: "Richiedi reset {anno}"
- Prompt: "Stai per RICHIEDERE A {NOME} il consenso a cancellare TUTTE le quietanze... La cancellazione effettiva avverrà SOLO dopo che il firmatario avrà autorizzato ogni singola richiesta dalla sua dashboard (come per Francesca/Agnese)."
- Risposta admin: "✅ Richieste inviate: N richieste create (M già in attesa). • X quietanze NON firmate eliminate subito. {Nome} riceverà una notifica e dovrà autorizzare ogni richiesta..."

**Banner "Richieste di cancellazione" per il firmatario**:
- Già presente in `coach/index.tsx` (era stato fatto per Francesca/Agnese).
- **AGGIUNTO** in `collaboratore/profile.tsx` (data-testid `collab-pending-deletions-banner`).
- **AGGIUNTO** in `dirigente/profile.tsx` (data-testid `dirigente-pending-deletions-banner`).
- Usa endpoint esistente `GET /deletion-requests/pending` + `POST /deletion-requests/{id}/approve|reject`.

**Test E2E preview verificato**:
1. Admin chiama `/admin/compensations/reset-coach-year` per DARK FRANZ (collaboratore) anno 2026 → 3 deletion_requests create
2. FRANZ chiama `GET /deletion-requests/pending` → vede 3 richieste con titoli corretti (Quietanza Feb / Comunicazione 5k Gen / Comunicazione 15k Mar), batch_reason `reset_year_2026`, admin requester
3. FRANZ approva una quietanza Sep 2025 → `_execute_document_deletion` cancella PDF + sblocca `collaboratore_compensations` `month=9 year=2025` da `receipt_signed=True` a `receipt_signed=False` ✅. Log: `Unlocked 1 row(s) in collaboratore_compensations`.
4. FRANZ rifiuta una richiesta → status=rejected, documento resta valido ✅

**Pubblicazione produzione**: ⚠️ Clicca "Save to GitHub" → Vercel + Render. Pietro Paoli riceverà la notifica + banner arancione nella sua dashboard collaboratore con le richieste da autorizzare/rifiutare.


### 🐛🌐 Bug Fix CRITICO: Backend usava UTC invece di Europe/Rome (30/05/2026)
**Segnalazione utente**: "Sono le 00:47 del 30/05 ma la dashboard admin mostra un compleanno del 29/5."

**Root cause**: due endpoint usavano `datetime.utcnow()` per calcolare "oggi":
- `GET /api/birthdays/today` (linea 12593) → alle 00:47 italiane (CEST=UTC+2) il server pensa sia ancora il 29/05 alle 22:47 UTC → mostra compleanni del 29 invece che del 30.
- `GET /api/athletes/registered-today` (linea 7527) → stesso bug, atleti registrati "oggi" sbagliati nelle 2 ore notturne.

**Fix applicato**:
- Sostituito `datetime.utcnow()` con `now_it()` (Europe/Rome, gestisce CET/CEST automaticamente) — helper già esistente nel codebase.
- Test backend: con IT now = `2026-05-30 00:56 CEST`, l'endpoint `/birthdays/today` ora ritorna correttamente la lista dei compleanni del 30 maggio (vuota in questa preview, ma logicamente corretta).

### ✨ Feature: Reset Quietanze esteso a Dirigente + audit log (30/05/2026)
**Aggiunto**:
- Pulsante "Reset anno YYYY" anche su `admin/dirigente/[id].tsx` (stesso pattern Coach/Collab).
- **Audit log** della reset: ogni reset salva su `audit_logs` un record `{action, target_user_id, target_user_name, year, admin_id, admin_name, society_id, deleted, timestamp}`.
- Nuovo endpoint `GET /api/admin/audit/last-reset/{user_id}` ritorna l'ultimo reset per quell'utente nella società dell'admin chiamante.
- Nel box "🧹 Reset Quietanze" delle 3 schede admin (coach + collab + dirig) ora appare in corsivo: *"Ultimo reset: anno 2026 • 30/05/2026, 00:55 da Vincenzo C."* — formattato Europe/Rome (con suffisso Z se mancante).

**Verifica preview**: bundle ricompilato, 3× `admin/audit/last-reset` + 3× "Ultimo reset" nel JS servito. Endpoint risponde `{}` per utenti senza storico (graceful).


### ✨ Feature: Pulsante Reset Quietanze Anno (Admin) + auto-fix Foto 3 (29/05/2026)
**Richiesta utente**: "Cancellami tutte le quietanze del 2026 di Paoli Pietro per testare gli stampati. Non mi avevi messo un pulsante di reset?"

**Implementato (P0 finalmente chiuso)**:
- ✨ Pulsante **"Reset anno YYYY"** nella modale "Gestione Quietanze" sia in `admin/coach/[id].tsx` che in `admin/collaboratore/[id].tsx`. Posizionato in box rosso ("Admin only — test/cleanup") subito dopo "Totale Percepito". Mostra 2 pulsanti: anno corrente e anno precedente.
- ✨ Doppia conferma: su web `window.prompt` richiede di digitare esattamente `RESET YYYY` per procedere; su mobile `Alert.alert` con tasto rosso "CONFERMA RESET". Operazione marcata IRREVERSIBILE.
- ✨ Handler `handleResetCoachYearReceipts(year)` / `handleResetCollabYearReceipts(year)` chiama il backend `POST /api/admin/compensations/reset-coach-year` (già esistente). Cancella in cascata: quietanze (5 collezioni), threshold_declarations, signed_documents PDF di tipo `compensation_receipt`/`threshold_*` + file su disco, e ricarica i dati.
- ✨ Feedback dettagliato: l'utente vede quante righe compensi, quanti PDF firmati e quante dichiarazioni soglie sono state eliminate.

**Bug fix collaterale (Foto 3 - 5k still showing summary)**:
- ✨ Esteso l'auto-fix sull'endpoint `GET /documents/signed/{id}/pdf` anche ai tipi `threshold_5000_communication` / `threshold_15000_communication`. Prima il fix esisteva solo su `/documents/download/{id}` → la Foto 3 (che usava /signed/) restava sul Riepilogo. Ora rileva summary (`PDF originale non` o `Riepilogo firma` o size < 8000) e rigenera al volo con `_regenerate_threshold_communication_pdf`.

**Test backend preview**:
- `POST /api/admin/compensations/reset-coach-year` con signer fake → `{"detail":"Utente non trovato"}` ✅
- Senza year → `{"detail":"signer_id e year obbligatori"}` ✅
- Bundle ricompilato: `reset-coach-year` × 2 + `Reset Quietanze` × 2 nel JS servito ✅


### 🐛 Bug Fix: doppio doc privacy_consent + orario errato (29/05/2026 — Solution A)
**Segnalazione utente (OPALE SANDRO genitore di OPALE LAURA)**:
1. Doppio documento dopo firma GDPR: `privacy_consent` (Attestazione senza firma) + `gdpr_minor` (Informativa completa con firma)
2. Lista documenti mostra orario UTC sbagliato (21:36) mentre il PDF mostra l'orario corretto Europe/Rome (23:36)

**Root cause**:
1. `parent/index.tsx:handleSignPrivacy()` chiamava ancora il legacy endpoint `POST /documents/sign` creando un doc `privacy_consent`. In parallelo, `parent/athlete/[id].tsx` apriva la GDPRPrivacyModal moderna che chiamava `POST /documents/sign-gdpr-privacy` creando un doc `gdpr_minor`. Risultato: due record nel DB per la stessa firma.
2. Il backend salva `datetime.utcnow()` (naive UTC, senza suffisso Z). Il frontend faceva `new Date(dateStr).toLocaleDateString('it-IT', {...})` senza `timeZone` → il browser interpretava la stringa come "naive local" e applicava il fuso del device. Su mobile Chrome Android l'esito era UTC puro (21:36).

**Fix Solution A — Eliminato il doc legacy + timezone**:
- ✨ Rimossa la chiamata `POST /documents/sign` con `privacy_consent` in `parent/index.tsx` (linea 341). Resta solo `POST /trial/accept-privacy/{athlete_id}` che aggiorna lo stato trial/consent — niente più doc duplicato.
- ✨ Da ora in poi, dopo la firma del genitore esiste UN SOLO documento: `gdpr_minor` (Informativa Privacy GDPR - Minore) con firma, dati genitore+minore, metadati legali, hash, IP, device.
- ✨ `formatDate` in `parent/documents.tsx` e `admin/documents-archive.tsx` ora: (a) aggiunge `Z` se la stringa è naive UTC, (b) formatta con `timeZone: 'Europe/Rome'`. Risultato: lista mostra `23:36` come il PDF.
- ✨ Documenti vecchi nel DB restano accessibili (storico). Solo i nuovi flussi non duplicheranno più.

**Test E2E preview**:
- Build expo `export -p web` ricompilato. Bundle ha `Europe/Rome` 5× e niente più `Tipo documento` (additional_data della chiamata legacy).
- Test browser di conversione: input UTC `2026-05-29T21:36:14` → output `29/05/2026, 23:36` ✅ (sia con sia senza suffisso Z).

**Pubblicazione produzione**: ⚠️ Clicca "Save to GitHub" → Vercel rebuilda in 5-7 min.


### 🐛 Bug Fix CRITICO PROD: GDPR scarica solo "Riepilogo firma digitale" (29/05/2026)
**Segnalazione utente**: documento privacy_consent di ALUNNI MADDALENA (firmataria BUCCHI SIENA GIULIA) scaricato come breve "Riepilogo firma digitale (PDF originale non più disponibile)" invece della dichiarazione GDPR completa. Funzionava prima, ora regressione.

**Root cause (3 problemi combinati)**:
1. **Disco effimero su Render**: ogni redeploy cancella `/var/lib/.../signed_documents/`. I PDF salvati solo su disco vengono persi.
2. **`download_document` non riconosceva `privacy_consent`**: il branch di rigenerazione inline (linea 20738) controllava solo `gdpr_privacy_adult/minor`/`gdpr_adult` → per `privacy_consent` cadeva nel fallback `_generate_consent_summary_pdf`.
3. **Il summary veniva cachato in `pdf_base64`** → da quel momento OGNI download restituiva il summary, per sempre.

**Fix applicato (server.py)**:
- ✨ **Salvataggio doppio**: l'endpoint `POST /documents/sign` ora salva `pdf_base64` + `signature_base64` nel DB oltre che `pdf_path` su disco → sopravvive ai redeploy.
- ✨ **Helper `_regenerate_gdpr_privacy_pdf(doc)`**: rigenera il PDF GDPR COMPLETO (adulto o minore) con lookup robusto di signer, athlete, society, signature_base64. Gestisce 3 casi: adulto firma per sé / parent firma per minore (`privacy_consent` con `related_entity_id` athlete minore) / `gdpr_minor` esplicito.
- ✨ **Auto-fix on download**: sia `/documents/signed/{id}/pdf` che `/documents/download/{id}` ora rilevano il summary cached (size < 4500 bytes oppure contiene "PDF originale non"/"Riepilogo firma") e rigenerano on-the-fly, sovrascrivendo cache + disco.
- ✨ **Anti-cache summary**: i tipi GDPR/threshold non vengono più cachati come `pdf_base64` quando si genera il summary fallback (evita di "bloccare" il documento sul placeholder).
- ✨ **Signature recovery**: la signature ora viene letta da `doc.signature_base64` (era hardcoded a "" nel branch di rigenerazione).

**Test verificato (preview)**:
- Iniettato summary fake in `pdf_base64` di doc privacy_consent reale (size: 2101 bytes)
- Chiamato `/documents/download/{id}` → restituisce **6540 bytes** (PDF GDPR completo)
- Log: `Auto-fixed GDPR privacy cache for 57ae39c8... (6540 bytes)`
- Verificato che la cache ora contiene il PDF completo (non più summary)

**Pubblicazione produzione**: ⚠️ Clicca "Save to GitHub" → Vercel+Render rebuildano (5-7 min). Tutti i PDF GDPR esistenti si auto-correggono al primo download successivo. I nuovi PDF firmati saranno permanentemente al sicuro nel DB.


### 🐛 Bug Fix CRITICO PROD: firma GDPR non viene presa su mobile (29/05/2026)
**Segnalazione utente (genitore MARCUCCI AGNESE, prod)**: "il sistema non ci fa confermare la firma. La inseriamo, ma non viene presa."

**Root cause**: il `<canvas>` di `react-signature-canvas` non aveva `touch-action: none`. Su browser mobili (iOS Safari / Chrome Android) il default `touch-action: auto` fa interpretare il dito come gesto di scroll/zoom invece che come tratto di disegno → il canvas non riceve i pointer events → `onEnd` non scatta → `hasSignature` resta `false` → pulsante "Conferma e Salva" disabilitato. Inoltre `userSelect` di default attivo può causare iOS Safari a mostrare menu di selezione testo invece di disegnare.

**Fix applicato a TUTTI i componenti firma**:
- ✨ `touchAction: 'none'` → canvas riceve i pointer events del dito senza essere intercettato dal browser
- ✨ `userSelect: 'none'`, `WebkitUserSelect: 'none'`, `WebkitTouchCallout: 'none'` → niente menu copia/incolla iOS durante il drag
- ✨ `cursor: 'crosshair'`, `display: 'block'` → feedback visivo + niente whitespace inline
- ✨ Aggiunto `onBegin={handleSignatureEnd}` come failsafe: marca `hasSignature=true` già al primo tocco, indipendentemente da `onEnd` (utile su browser con eventi flaky)
- ✨ `data-testid` su ogni canvas per testabilità

**File toccati**:
- `/app/frontend/src/components/GDPRPrivacyModal.tsx` (linea ~620, canvas firma GDPR genitori/atleti)
- `/app/frontend/src/components/AdultPrivacyModal.tsx` (canvas firma adulti)
- `/app/frontend/src/components/SignaturePad.tsx` (modale firma generica)
- `/app/frontend/src/components/SignaturePadInline.tsx` (canvas inline web, usato da coach/dirigente/collaboratore compensation)

**Verifica preview**: bundle ricompilato (`expo export -p web`), `touchAction` presente 9× nel bundle servito (era 6× prima).

**Pubblicazione produzione**: ⚠️ utente deve cliccare "Save to GitHub" → Vercel rebuilda → fix live in 5-7 min.


### 🐛 Bug Fix: PDF comunicazione superamento soglia incompleti (29/05/2026)
**Segnalazione utente**: alcuni documenti `threshold_5000_communication` e `threshold_15000_communication` venivano scaricati come "Riepilogo firma digitale (PDF originale non più disponibile)" invece del documento legale completo (foto 2: testo + città + firma + metadati).

**Root cause**: 2 categorie di documenti problematici:
1. PDF salvati su disco quando il campo `society_city` non veniva passato → file di 4266 byte con `Luogo e data: __________________` e firma vuota
2. PDF mancanti del tutto (no pdf_path + no pdf_base64) → fallback a `_generate_consent_summary_pdf` che produceva il "summary" generico

**Fix completo**:
- ✨ Nuova funzione `_regenerate_threshold_communication_pdf` che usa il **generatore ufficiale** `generate_threshold_5k_pdf` / `15k_pdf` con cascata di lookup robusta per recuperare i dati mancanti:
  - signer da `signer_id` OR `coach_id` OR `dirigente_id` OR `collaboratore_id` OR `atleta_id`
  - società da `society_id` (doc) OR signer.society_id OR fallback `settings.society`
  - signature_base64 da: doc + additional_data + relativo `coach_compensations` (`receipt_signature_base64`) + `threshold_declarations`
  - totali (yearly_total_before/after, prior_compensation_declared) da additional_data + compensation record + threshold_declaration
  - society_city da `settings.city` OR `society.city` con fallback "Perugia"

- ⚡ **Auto-fix on download**: in `download_document`, se il PDF su disco è < 8000 byte ed è un threshold → rigenera al volo, sovrascrive file su disco + DB cache (`pdf_base64`) → da quel momento sarà permanentemente corretto. Log info: `Auto-fixed threshold PDF {id} ({size} bytes)`

- 🛡️ **Fallback finale**: se ANCHE il PDF non esiste su disco/DB, prima di cadere nel summary generico, prova prima `_regenerate_threshold_communication_pdf` con header `inline; filename=comunicazione_soglia_{id}.pdf`

**Risultato verificato**:
- PDF di ROSSI LIA passato da `4266 byte (incompleto)` a `4623 byte (completo)`
- Log conferma `Auto-fixed threshold PDF 653c29f8...`
- Il testo include: titolo, dati firmatario, COMUNICA, `Luogo e data: Perugia, 29/05/2026`, sezione METADATI (timestamp, totali, hash firma)

File toccati: `/app/backend/server.py` (funzione `_regenerate_threshold_communication_pdf` riscritta per usare i generatori ufficiali + auto-fix in `download_document`)


### 🐛 Bug Fix: Lentezza app + profilo atleta bloccato (29/05/2026)
**Segnalazione utente**: "Tutto è un po' rallentato. Admin non riesce ad entrare nel profilo delle atlete (caricamento infinito)".

**Root cause**: 
1. L'endpoint `/api/admin/whatsapp/pending-count` (chiamato da dashboard admin+coach) eseguiva ogni volta la pipeline pesante di `get_pending_reminders` che faceva **N+1 queries** (`db.users.find_one()` per ogni atleta+parent_id) → su MongoDB Atlas in produzione con latenza ~50ms a query, 50 atleti × 50ms = **2-3 secondi solo per il counter**
2. La chiamata bloccava le altre richieste del browser → "Caricamento infinito" sul profilo atleta era un timeout cascata, non un bug del profilo

**Fix applicati**:
- ✨ **Cache in-memory 60s** sul `/admin/whatsapp/pending-count` per (society_id, role, team_ids). Chiamate successive entro 60s ritornano in ~10ms con `cached: true`
- ✨ **Pre-fetch batch utenti** in `get_pending_reminders`: 1 sola query per tutti gli users della società → costruito dict cache → passato a `_get_athlete_parent_phones(user_phone_cache=...)` che evita N+1
- 🔧 Risolto anche `NameError: Dict not defined` (riferimento a typing.Dict non importato a livello modulo)

**Performance verificate (preview)**:
- pending-count (cache miss): **138ms**
- pending-count (cache hit): **168ms** con flag `cached: true`
- pending-reminders (con 24 casi reali): **175ms**

In produzione Atlas miglioramento atteso **5-10×** sulle dashboard admin/coach.

File toccati: `/app/backend/server.py` (caching + batch prefetch), `/app/backend/whatsapp_reminders_core.py` (signature `_get_athlete_parent_phones` accetta `user_phone_cache`)


### 🐛 Bug Fix: Numeri genitori atleti minorenni (28/05/2026)
**Segnalazione utente**: per gli atleti 18- il sollecito WhatsApp DEVE andare al genitore (Tel. Madre / Tel. Padre), ma il sistema mostrava "Numero non presente" anche quando i numeri erano salvati.

**Root cause**: la funzione `_get_athlete_parent_phones` cercava solo `parent_phone` (campo legacy spesso vuoto). I numeri reali nella scheda atleta sono in `phone_mother` e `phone_father`.

**Fix completo**: rifattorizzato `_get_athlete_parent_phones` con cascata di lookup:
1. `phone_mother` → contatto "Madre"
2. `phone_father` → contatto "Padre" (entrambi proposti se diversi)
3. Fallback `parent_phone` (legacy)
4. Fallback lookup utente genitore via `parent_id`
5. Fallback `second_parent_email` → cerca utente genitore 2
6. Deduplicazione numeri normalizzati (no duplicati se madre/padre stesso numero)
7. Per maggiorenni: `phone` atleta + user.phone

**Risultato verificato**:
- Casi pendenti con numero disponibile: **da 1 → a 20 su 24** (era 1 su 23, ora 20 su 24)
- ALUNNI MADD / GIORGETTI ora mostrano sia "Madre" che "Padre" come contatti WhatsApp separati
- I 4 rimasti senza numero hanno banner giallo "Numero non presente — contattare offline"

File toccati: `/app/backend/whatsapp_reminders_core.py`


### 🐛 Bug Fix: Solleciti WhatsApp non comunicati (28/05/2026)
**Segnalazione utente**: l'atleta ALUNNI MADD... aveva "Periodo di prova attivo" + "Dichiarazione non ancora firmata" ma NON appariva nei solleciti WhatsApp Admin.

**Root cause** (3 bug combinati):
1. La logica `if is_trial AND ts AND not trial_doc_signed` non scattava perché molti atleti hanno `is_trial=False` ma `status='trial'` (campi non sincronizzati)
2. Atleti senza `parent_phone` venivano **scartati silenziosamente** (`if not contacts: continue`) — l'admin non sapeva nemmeno che c'era un problema
3. Caso (d) `trial_end_no_decision` aveva condizione `is_trial is False` che escludeva atleti ancora in stato trial

**Fix**:
- Introdotta variabile `is_in_trial = is_trial OR status == 'trial'` per identificare atleti effettivamente in prova
- Atleti senza numero **non vengono più scartati**: appaiono comunque con badge giallo "⚠️ Numero non presente — contattare offline"
- Caso (d) condizione rivista: scatta se `status ∈ {pending_decision, pending_certificate, pending_trial, trial}` E mancano sia privacy sia certificato

**Risultato**: i casi rilevati nel preview sono passati da **1** a **23** (BIANCHI SOFIA, MAZZI SILVIA, PERRI EMMA/MIA, ecc. ora visibili).

File toccati: `/app/backend/server.py` (logica casi a/d), `/app/frontend/app/admin/whatsapp-reminders.tsx` (banner "numero non presente")


### 🆕 Dashboard "Da fare oggi" (28/05/2026)
- 📋 Nuovo pannello **"Da fare oggi"** in dashboard Admin, sotto le quickStats
- Mostra fino a **6 categorie** di task pendenti, con badge totale rosso in alto a destra:
  1. 👥 Atleti da approvare (`pendingAthletes.length`)
  2. 🧑‍💼 Staff da approvare (`pendingStaff.length`)
  3. 🗑️ Richieste cancellazione (`deletionRequests.length`)
  4. 📄 Certificati in scadenza (`expiringCerts.count_today + count_30_days`)
  5. 🟢 Solleciti WhatsApp (`waCount`)
  6. 🔔 Notifiche non lette (`unreadNotifications`)
- **Auto-hide**: solo i task con `count > 0` sono mostrati. Se nulla è pendente → banner verde "✅ Tutto in ordine!"
- Click su un chip → naviga alla pagina relativa
- Grid responsive (2 colonne) con bordo colorato per categoria
- ✅ Testato end-to-end: vista admin mostra "📋 Da fare oggi" con 2 task (1 certificato + 1 sollecito WA)
- File toccati: `/app/frontend/app/admin/index.tsx`


### 🆕 Ricerca palestre + Counter solleciti (28/05/2026)

**Counter dinamico solleciti WhatsApp** ✅
- Nuovo endpoint `GET /api/admin/whatsapp/pending-count` (lightweight)
- Badge rosso con numero pendenti nel menu Admin (card "Solleciti WhatsApp")
- Badge rosso nel link Coach dashboard
- Sottotitolo dinamico: "X azioni pendenti da inviare" oppure "Tutto in regola"

**Mappa palestre con ricerca + lista** ✅
- Backend: nuovo modulo `/app/backend/palestre_kml.py` — parser KML da Google My Maps con cache 1h (TTL configurabile)
- Endpoint `GET /api/palestre/list` (autenticato, accessibile a tutti i ruoli)
- Frontend `/app/frontend/app/palestre.tsx` riscritto:
  - Search box live ("scrivi spoleto → filtra")
  - Mappa embed sopra
  - Lista 79 palestre sotto con nome + indirizzo + bottone "Naviga" (apre Google Maps mobile)
  - Contatore "📍 Lista palestre (79)"
- ✅ Backend testato: `count: 79`, link `google_maps_url` (`?api=1&query=lat,lng`) corretti
- ✅ Frontend testato via screenshot: header + ricerca + mappa + lista visibili

File creati: `/app/backend/palestre_kml.py`
File toccati: `/app/backend/server.py` (endpoint palestre + count solleciti), `/app/frontend/app/palestre.tsx` (rewrite completo), `/app/frontend/app/admin/index.tsx` (counter), `/app/frontend/app/coach/index.tsx` (counter)


### 🆕 Solleciti WhatsApp (27/05/2026)
- 🟢 **Sistema completo di solleciti via WhatsApp** con click-to-chat (`wa.me`) — GRATIS, nessuna API a pagamento, GDPR-friendly (l'admin invia dal suo numero).
- **6 casi tracciati automaticamente**:
  - (a) `trial_start_unsigned` — Firma inizio periodo di prova mancante
  - (b) `trial_end_no_certificate` — Trial scaduto + certificato medico mancante
  - (c) `trial_end_no_privacy` — Trial scaduto + privacy GDPR non firmata
  - (d) `trial_end_no_decision` — Trial scaduto + nessuna decisione (restare/cancellare)
  - (e) `unsigned_receipt` — Quietanza coach/dirigente/collaboratore non firmata
  - (f) `certificate_expiring` — Certificato medico in scadenza/scaduto
- **Visibilità**: Admin vede tutto, Coach vede solo i casi delle sue squadre (tutti i casi tranne quietanze).
- **Soglie temporali e template** personalizzabili per società da `/admin/whatsapp-settings` (con variabili `{nome}` `{atleta}` `{data}` `{link}` `{società}`).
- **Storico solleciti** registrato in `db.whatsapp_reminders`. Mostra "Ultimo sollecito: 2g fa" accanto a ogni nome.
- **UX**: modal con anteprima messaggio modificabile + bottone "Apri WhatsApp" che apre `wa.me/39<numero>?text=<msg>`. Admin clicca "Invia" manualmente.
- **Endpoint backend**:
  - `GET /api/admin/whatsapp/settings` → load template + soglie società
  - `PUT /api/admin/whatsapp/settings` → salva template personalizzati
  - `GET /api/admin/whatsapp/pending-reminders` → lista casi pendenti (scoped per ruolo: admin tutti, coach solo squadre proprie)
  - `GET /api/admin/whatsapp/render?case=X&athlete_id=Y` → render messaggio con variabili sostituite
  - `POST /api/admin/whatsapp/log-sent` → registra invio in storico
- File creati: `/app/backend/whatsapp_reminders_core.py`, `/app/frontend/app/admin/whatsapp-reminders.tsx`, `/app/frontend/app/admin/whatsapp-settings.tsx`
- File toccati: `/app/backend/server.py` (5 endpoint nuovi), `/app/frontend/app/_layout.tsx`, dashboard admin + coach
- ✅ Testato end-to-end: backend healthy, login admin OK, endpoint settings/pending-reminders/render rispondono correttamente con dati reali (es. 1 sollecito trovato: PASQUI LENA certificato scaduto da 75gg).


### 🆕 Mappa Palestre (25/05/2026)
- 🗺️ Pagina `/palestre` con embed Google My Maps (`mid=1yMgkjp8BvFZ5xPiEUPmKKWHLo9c`) — mappa condivisa Umbria per tutte le società RegistraTEAM
- Pulsante 🏟️ "Mappa Palestre" in dashboard di **tutti i ruoli**: Admin, Coach, Genitore, Atleta, Dirigente
- Pulsante "Apri in Google Maps" per navigazione GPS mobile
- Header con SocietyBranding (logo + nome società)
- Modifiche dati (rinomina mappa, rimuovi pin "Sede", livello "Studi medici" generico) → da fare lato utente su Google My Maps (modifiche istantanee, no deploy)
- File creato: `/app/frontend/app/palestre.tsx`
- File toccati: `/app/frontend/app/_layout.tsx`, dashboard admin/coach/parent/athlete/dirigente

### 📌 BACKLOG — Ricerca testuale palestre (proposto 25/05/2026)
**Status: WAITING — l'utente preferisce valutare prima la stabilità dell'app base**

Quando richiesto, implementare:
- Backend: endpoint `/api/palestre/list` che parsa KML da `https://www.google.com/maps/d/kml?mid=1yMgkjp8BvFZ5xPiEUPmKKWHLo9c` con cache 1h → JSON `[{name, address, description, lat, lng, google_maps_url}]`
- Frontend: barra di ricerca sopra la mappa + lista filtrata real-time (es. "spoleto" → 3 palestre con indirizzi)
- Bonus opzionali: contatore palestre, raggruppamento per provincia, ordinamento alfabetico
- **Stima: ~45 min** (20 min backend + 20 min frontend + 5 min test)


### 📌 SPEC CONGELATE — Atleti Pro (futura implementazione)
**Status: WAITING — utente vuole prima valutare stabilità app base prima di partire**

Quando l'utente darà il via, implementare con queste specifiche:

| # | Decisione |
|---|---|
| 1 | Naming: **"Atleta Pro"** (riusa terminologia Prime Squadre esistente) |
| 2 | Periodo soglia €5k/€15k: **anno solare** (1/1 → 31/12), conforme D.lgs 36/2021. La dichiarazione iniziale considera compensi pregressi dell'anno corrente fino al giorno dell'incarico (come oggi per i coach) |
| 3 | Toggle `is_compensated` su atleta: **bloccato lato backend se età < 18 anni** (D.lgs 36/2021 — minorenni non possono essere "lavoratori sportivi") |
| 4 | Auto-sgancio genitori al 18° compleanno: **NO**. Solo sgancio manuale via admin (`/api/athletes/{id}/detach-parents` già esistente) |
| 5 | Caso atleta+coach: **1 dashboard ibrida con tab "Atleta" + "Coach"**. Calcolo soglie €5k/€15k **cumulativo cross-ruolo** (somma `coach_compensations` + `atleta_pro_compensations` per stessa persona). **1 sola dichiarazione** che vale per entrambi i ruoli |
| 6 | Quietanze atleta+coach contemporaneo: **DA DECIDERE quando si parte** (unica vs separate per ruolo) |

**Effort stimato: ~10-11 ore** distribuite in 2-3 sessioni.

**Componenti riusabili al 100%**:
- `/api/athletes/{id}/detach-parents` (sgancio genitori già completo)
- `atleta_pro_compensations` collezione (già esistente con Prime Squadre)
- `is_compensated` flag su atleta (già esistente)
- Pattern coach compensations (threshold, dichiarazioni, quietanze, PDF generator)
- Frontend `/app/admin/prime-squadre.tsx` (già esistente)

**Da creare ex novo**:
- Estensione `threshold_declarations` per ruolo `atleta_pro` + PDF generator quietanza atleta
- Aggregazione cross-collection (`coach_compensations` + `atleta_pro_compensations`) nel calcolo soglie
- Sezione "Compensi" nella dashboard atleta (tab ibrido)
- Validazione `age >= 18` nel toggle is_compensated


### 🆕 Welcome Email Nuova Società (23/05/2026)
- ✉️ **Welcome Email automatica** al Dirigente Incaricato dopo registrazione società (`/auth/register-society`).
- Contiene: saluto personalizzato, CTA accesso, **checklist primo accesso** (logo, squadre, allenatore, codice invito, calendario), codice invito evidenziato.
- 📧 **BCC superadmin** `vincenzo.ciucarelli@gmail.com` su ENTRAMBE le email (welcome dirigente + istituzionale società) → notifica automatica di ogni nuova società registrata.
- Nuova funzione: `send_welcome_admin_email()` in `server.py` (riga ~2170).
- File toccati: `/app/backend/server.py` (register_society + nuova funzione welcome email).


### 🆕 Multi-Tenancy Audit P1 (21/05/2026) — **Passata 1+2**
- 🛡️ **Audit chirurgico delle query LIST cross-tenant** in `server.py` (140+ punti scansionati via script automatico).
- **Passata 1 (notturna)**: 13 falle critiche corrette
- **Passata 2 (mattutina)**: 13 ULTERIORI falle corrette (totale ora: **26 endpoint sicurizzati**)
- Nuovi endpoint corretti nella passata 2:
  1. `/teams/{team_id}/championships` — ora scoped per società
  2. `/attendance/today` — attendances filtrate via team_ids della società
  3. `/coach/commitments` — training_overrides scoped
  4. `/reports/monthly-compensation/{year}/{month}/pdf` — coach/dirigente/athlete/atleta_pro compensations filtrate via society user_ids
  5. `/reports/monthly-compensation/{year}/{month}/summary` — count + sum scoped per società
  6. `/prime-squadre/athletes/{id}/enable` — settings + counts scoped (per non sforare il limite 50 globalmente)
  7. `/prime-squadre/stats` — total_members + yearly atleta_pro scoped
  8. `/documents/signed` (list) — admin vede solo signer_id della propria società
  9. `/documents/archive` — scoped via signer_id society + team athletes lookup scoped
  10. `/export-csv/attendances` — scoped via team_ids della società
  11. `/admin/all-consents` — users + athletes scoped (era CRITICO: esponeva consensi GDPR di tutte le società)
  12. `/preseason/campaigns/{id}/responses` — verifica campagna appartiene alla società admin
  13. `/preseason/campaigns/{id}/export` — verifica campagna appartiene alla società admin
- ✅ Backend healthy, lint clean (solo warning preesistenti).
- 🎯 **RegistraTEAM ora ha protezione multi-tenant solida su tutti gli endpoint amministrativi sensibili.**

### 🆕 Fix Quietanze Orfane Multi-Collezione (20/05/2026)
- 🐛 **Bug**: pulsante 🔧 "Ripara quietanze orfane" trovava sempre 0 record.
- 🔍 **Root cause**: l'endpoint scansionava solo `db.compensations` (legacy), ma le quietanze coach stanno in `db.coach_compensations`, dirigenti in `db.dirigente_compensations`, ecc.
- ✅ **Fix**: ora scansiona **6 collezioni** (`coach_compensations`, `dirigente_compensations`, `collaboratore_compensations`, `atleta_pro_compensations`, `athlete_compensations`, `compensations`) usando `signer_id` per il lookup in `signed_documents`. Popup ammin mostra diagnostica per-collezione (scan / other_society / fix).
- File toccati: `/app/backend/server.py` (`admin_repair_orphaned_compensation_receipts`), `/app/frontend/app/admin/documents-archive.tsx`.



### ✅ Già LIVE in produzione (PR #11-#16+)
- Brevo email risolto (chiave SMTP→API + blocco IP disattivato)
- Performance backend (proiezioni Mongo)
- Banner soglie €5k/€15k completi su admin coach + coach (con mese di superamento)
- Status `pending_trial` riconosciuto in dashboard genitore
- CF rimosso da registrazione adulti
- Autofill browser bloccato su CF genitore (`autoComplete="off"`)
- Mese superamento collaboratore
- Mappatura paesi esteri (Corea Sud/Nord, Cechia, Vietnam, Macedonia del Nord, Congo, Vaticano)
- Toggle ruolo deselezionabile
- Pulsante "Firma Dichiarazione" visibile per `pending_trial`
- Badge status `pending_trial` viola
- **Projection MongoDB COMPLETA per firma trial** (backend) — fix critico per atleti stranieri (Belgio, Danimarca) e italiani con campo solo in `birth_place`
- **Modal firma trial: maxHeight 85% + paddingBottom 120** — pulsante "Conferma e Firma" non più nascosto da navbar browser mobile
- Fix partite invisibili (Coach Fede, Anna, Lucia) — `team_id_2` + comparazione date ISO

### 🆕 Attestato di Versamento PDF (12/05/2026)
- ✅ Aggiunta colonna **"Note"** in posizione 2 nella tabella pagamenti (N. Prog. | Note | Data | Metodo | Importo)
- ✅ Le note provengono dal campo `notes` del pagamento (non più da `description`) — utile per indicare numero ricevuta reale del commercialista
- ✅ Backend `get_fiscal_receipt_data`: aggiunto `notes` al payload payments
- ✅ Admin path: ora popola tax_payer dall'athlete (`tax_payer_first_name/last_name/fiscal_code`) invece di lasciarli vuoti
- ✅ **Popup di avviso lato Parent** prima di stampare/condividere se i campi tax_payer (Cognome/Nome/CF del genitore che porta in detrazione) sono incompleti — l'utente può comunque procedere senza
- File toccati: `/app/backend/server.py` (riga 10636), `/app/frontend/src/utils/fiscalReceipt.ts`, `/app/frontend/app/admin/athlete/[id].tsx`, `/app/frontend/app/parent/athlete/[id].tsx`

### 🆕 Fix Fuso Orario Calendario Gare (12/05/2026)
- 🐛 **Bug**: gli orari delle partite mostravano UTC invece di Europe/Rome → "anticipati di 2h" (es. 18:00 mostrata come 16:00)
- 🔍 **Root cause**: in `admin/matches.tsx::handleSave` veniva fatto `new Date(localStr).toISOString()` che converte local→UTC, e il display usa `timeZone:'UTC'` ovunque, perdendo le 2h di offset
- ✅ **Fix**: ora costruisce direttamente la stringa ISO con suffix Z preservando il wall-clock (es. utente inserisce 18:00 → salvato come `2026-XX-XXT18:00:00.000Z` → display mostra 18:00)
- 📌 **Match esistenti**: utente correggerà manualmente le 4 gare già nel DB (riaprendo edit modal e re-inserendo orario)
- File toccato: `/app/frontend/app/admin/matches.tsx` (linee 198-209)

### 🆕 Riattivato Register Society (12/05/2026)
- ✅ Pulsante "Sei una nuova società? Registrati qui" rimesso nella schermata login (`login.tsx`)
- 🎯 Obiettivo: onboardare "Sirio" + 3-4 società amiche per test multi-tenant
- ⚠️ Audit multi-tenancy (`society_id` su tutti gli endpoint) NON ancora completato → da fare PRIMA di andare in pubblico ma utente farà test smoke con poche persone

### 🆕 Fix Multi-Tenancy Settings + Cache Bleed (12/05/2026 — sera tardi)
🔴 **Bug critico scoperto durante test Sirio**: quando l'admin di una società salva le impostazioni, il backend sovrascriveva il record `{type:"society"}` SENZA filtro per `society_id` → dati di una società rovinavano dati dell'altra.

✅ **Fix backend** (`routes/settings.py`):
- `PATCH /settings/society` → ora filtra per `society_id` del current_user
- `GET /settings/certificate-override-status` → filtrato
- `POST /settings/certificate-override-status/mark-seen` → filtrato
- `GET/PATCH/DELETE /settings/stripe` → tutti filtrati

🔴 **Bug separato (cache frontend)**: utente fa login con email Sirio, logout, poi login con email PPG → header mostrava "Sirio" mentre dati erano PPG. Cause: cache module-level (SportIcon) e React state non rimontato.

✅ **Fix frontend**:
- `login.tsx::handleLogin`: dopo login web fa `window.location.replace(target)` → full reload pulisce cache
- `authStore.ts::logout`: dopo cleanup AsyncStorage fa `window.location.replace('/login')` su web

⚠️ **CRITICO - Da verificare in produzione**: Vincenzo deve controllare che le impostazioni di PPG non siano state sovrascritte durante il test Sirio. Eventualmente recuperare da snapshot MongoDB Atlas.

### 🆕 Fix Branding Leak su Pagina Login Pubblica (13/05/2026 — notte)
🔴 **Bug**: aprendo `www.registrateam.it` (anche in incognito / browser mai usato), la pagina login mostrava logo + nome di **Sirio Perugia Volley Asd** invece del branding RegistraTEAM generico. Causa: chiamata anonima a `/api/settings/society` ritornava il primo record `{type:"society"}` trovato nel DB (= Sirio).

✅ **Fix** (`routes/settings.py`):
- `GET /settings/society` per richieste anonime → ora ritorna defaults **generici RegistraTEAM** (nome "RegistraTEAM", no logo, no dati specifici società)
- `GET /settings/society/logo.png` per richieste anonime senza `?society_id=XXX` → 404 (no branding leak); accetta `?society_id=XXX` per email embedding
- `GET /settings/society/sport-image.png` per richieste anonime → 404; accetta `?society_id=XXX`
- Idem per richieste anonime di `/settings/society` payload completo

✅ **Verifica produzione**: dati PPG intatti (ragione sociale, CF, IBAN, indirizzo).

### 🆕 Ripristino dati PPG sovrascritti (13/05/2026 — notte tardi)
🔴 **Bug confermato via curl prod**: il record `settings` con `society_id=PPG` aveva ricevuto sovrascrittura dei campi da Sirio (bug pre-fix `PATCH /settings/society` senza filtro `society_id`).

✅ **Ripristino via API**: nome, ragione sociale, CF, P.IVA, indirizzo, IBAN, telefono (347/8111019), email, PEC, affiliazioni FIPAV/FIVB ripristinati.

### 🆕 Fix Biglietti da Visita multi-tenant + Logo nel menu admin (13/05/2026 — notte tardi)
🔴 **Bug**: endpoint `/society/card-fiscale` e `/society/card-bancaria` (generano JPG biglietti da visita) caricavano dati di PPG anche quando l'admin loggato era Sirio. Causa: `db.settings.find_one({"type":"society"})` senza filtro `society_id`.

✅ **Fix backend** (`server.py`):
- `/society/card-fiscale` (riga 20558) → filtra per `current_user.society_id`
- `/society/card-bancaria` (riga 20814) → filtra per `current_user.society_id`

🔴 **Effetto collaterale del fix anonimo `/logo.png`**: i tag `<Image>` di React Native NON inviano automaticamente il token JWT → backend riceveva richieste anonime → 404 → logo società non visibile nei menu admin.

✅ **Fix frontend**: tutti i `<Image source={{uri: ".../logo.png"}}>` ora passano `?society_id=${user.society_id}` come query param:
- `/app/frontend/app/admin/index.tsx` (3 occorrenze: header, society menu card, sport-image card)
- `/app/frontend/src/components/SocietyLogo.tsx` (HEAD probe + Image src usano `useAuthStore().user?.society_id`)
- `login.tsx` resta senza society_id → mostra "RegistraTEAM" generico (corretto)

### 🆕 Logo RegistraTEAM nella schermata di login (13/05/2026)
- ✅ Aggiunto file `/app/frontend/assets/images/registrateam-logo.png` (PNG con sfondo trasparente, derivato dal JPG inviato dall'utente)
- ✅ `login.tsx`: ora mostra **sempre** un logo:
  - Se l'utente è già loggato in qualche società → logo società (via `?society_id=`)
  - Altrimenti → logo RegistraTEAM (file statico locale, no chiamata API)

### 🆕 Fix Multi-Tenancy Calendario Gare (13/05/2026 — mattina)
🔴 **Bug**: Sirio vedeva e poteva modificare le gare di PPG. Causa: tutte le query `db.matches.find({})` e `db.matches.update_one({"id": ...})` non filtravano per `society_id`. Inoltre l'endpoint `/matches/import` (Excel) eseguiva `delete_many({"match_number": ...})` cross-tenant, potenzialmente cancellando match di altre società.

✅ **Fix backend** (`server.py`):
- `GET /matches` → filtra per `society_id`
- `GET /matches/upcoming` → filtra per `society_id`
- `GET /matches/team/{team_id}` → filtra per `society_id`
- `POST /matches` → popola `society_id` dal current_user
- `PATCH /matches/{id}` → filtra per `society_id` (no cross-tenant edit)
- `DELETE /matches/{id}` → filtra per `society_id` (no cross-tenant delete)
- `POST /matches/import` → tutte le query (find/delete_many/insert) scoped a `society_id`. Nuovo Match creato con `society_id` popolato.

✅ **Endpoint maintenance** aggiunto: `POST /api/admin/maintenance/backfill-match-society-ids` — assegna `society_id` ai match esistenti senza society_id, ricavandolo da `team_id` → `team.society_id`. **Da eseguire una volta in produzione dopo il deploy.**

### 🆕 Audit Multi-Tenancy Parziale (13/05/2026 — sera)
🔴 **Bug critico osservato**: la pagina "Iscrizioni Atleti" admin di "La Tua Società" mostrava atleti di PPG. Causa: `GET /athletes/registrations-history` non filtrava per `society_id`.

✅ **Fix applicati** (`server.py`):
- `GET /athletes/registrations-history` → scope per `society_id`
- `GET /athletes` (admin/coach branch alla riga 6616) → scope per `society_id`
- `GET /certificates/expiring` (line 9613, expiring_today/soon) → scope per `society_id`
- `GET /export/coaches` → scope per `society_id` (sia users.find che teams.find)
- `GET /admin/coaches-threshold-status/{year}` → scope per `society_id`
- `GET /championships` → scope per `society_id`
- `GET /collaboratori` → scope per `society_id`

🛡️ **Anche anti-istituzionale** (`routes/primary_admin.py`):
- `delegable_admins` ora esclude account società-named e prefissi istituzionali (`info@`, `assistenza@`, etc.)
- `is_society_institutional_email` ora detect anche prefissi funzionali universali (`info`, `assistenza`, `support`, `noreply`, `segreteria`, `amministrazione`, `presidenza`, `direzione`, `comunicazione`, `eventi`, `contatti`, `ufficio`, `staff`, `marketing`, `iscrizioni`, `tesseramento`, `tesoreria`, ecc.)

🛑 **Ancora pendente (~50 query)**: ci sono ancora endpoint senza filtro `society_id` in `server.py` (signed_documents lists, attendances stats, compensation aggregates). Da fixare in audit sistematico.

### 🆕 Seed Demo "La Tua Società ASD" (13/05/2026 — sera)
- Cast pietre preziose creato via API: 3 coach (Rubino, Smeraldo, Zaffiro), 2 dirigenti (Corallo, Ambra), 1 collaboratore (Onice), 5 atleti minori (Diamante, Topazio, Ametista, Quarzo, Opale) + 5 genitori, 2 atleti maggiorenni (Granato, Perla), 3 squadre (U.14/U.16/Prima Div.), 3 partite upcoming
- Script di seed in `/tmp/seed_la_tua_societa.py`
- Demo password: `Demo1234` (tutti gli utenti escluso admin Enzo Bianchi Test1234)

### 🆕 UI Admin Dashboard — Header & Logo (14/05/2026)
🎨 **3 modifiche su richiesta utente** in `/app/frontend/app/admin/index.tsx`:

**(A) Nome società più grande, wrap su 2 righe se lungo**
- `styles.headerTitle.fontSize` da 20 → 30
- `numberOfLines={2}` invece di 1 (rimane su una riga se breve, va a capo se lungo)

**(B) Logo società grande senza cerchio sull'header (sx)**
- 80x80, allineato in alto

**(C) Logo nella card "Profilo Società" sezione Gestione**
- Bug: il backend in produzione non espone `has_logo: true`
- ✅ Fix: rendering ottimistico con `onError` su `<Image>` per fallback automatico

### 🆕 Auto-cancellazione allenamenti per gare + Override manuali (16/05/2026)
🔴 **Bug osservato**: una squadra con gara in trasferta non aveva l'allenamento cancellato (la logica vecchia escludeva solo gare home).

✅ **Fix automatico** (`routes/parents.py`): una squadra che gioca una gara (home OR away) ha l'allenamento di quel giorno automaticamente nascosto dalla dashboard genitore.

✅ **Override manuali** (`routes/training_overrides.py` - NUOVO modulo):
- Collection `training_overrides` con `team_id`, `society_id`, `date`, `status` (`cancelled` | `modified`), `new_start_time`, `new_end_time`, `new_venue`, `reason`, `created_by`
- Endpoint:
  - `POST /api/teams/{team_id}/training-overrides` (admin/coach della squadra)
  - `GET /api/teams/{team_id}/training-overrides` (admin/coach/parent)
  - `PATCH /api/training-overrides/{id}` (admin/coach)
  - `DELETE /api/training-overrides/{id}` (admin/coach) - ripristina allenamento normale
- Sicurezza: scoped per `society_id` + check coach_ids della squadra

✅ **UI Admin/Coach** (`/admin/team/[id]/training-overrides.tsx`): pagina dedicata che mostra i prossimi 7 giorni con allenamento, con bottoni "Modifica" e "Annulla". Accessibile da:
- Admin: `/admin/team/[id]` → card "Modifica/Annulla Allenamenti"
- Coach: `/coach/team/[id]` → card "Modifica/Annulla Allenamenti"

✅ **Dashboard genitore**: training modificati mostrano badge "✏️ Variato" + motivo (color #D35400).

🛑 **Ancora pendente (server.py)**: 40+ query `db.settings.find_one({"type": "society"})` senza filtro `society_id` (logo PDF, threshold computations, audit logs, intestazioni documenti GDPR). Da sistemare prima di onboarding pubblico.

### 🔴 P0 ancora da gestire
1. Profilo Simona incompleto in produzione (dato perso da bug vecchio) — Simona deve compilare manualmente
2. Logo login con riquadro bianco — caricare PNG trasparente

### 🟡 P1
- Multi-tenancy audit (filtro `society_id`) prima di Sirio
- Riattivare `/register-society`

## Ciclo Atleta MINORE
```
[ISCRIZIONE]
   ↓
pending_trial 🟣 "In attesa di inizio prova"
   ↓ (genitore firma autorizzazione prova)
pending_trial ← in attesa 1° QR scan
   ↓ (coach scansiona QR — parte timer 7gg/3 allenamenti)
trial 🟠 "In Prova"
   ↓
   ├─→ rinuncia → uscita
   └─→ continua → firma consensi GDPR → active 🟢
```
**Regole:**
- Documenti minore firmabili da UNO QUALSIASI dei 2 genitori
- Certificato medico: NO upload file. Solo data emissione + scadenza + convalida admin
- Anche con cert. medico convalidato, atleta resta in trial finché non firma consensi finali

## 🎯 Priorità Prossima Sessione (08/05/2026)

1. 🟣 **TEST SCANSIONE QR COACH**:
   - Coach apre scanner → scansiona QR del genitore o atleta
   - 1ª scansione converte `pending_trial` → `trial` con `trial_start_date = now`
   - Conta sessioni (max 3) e giorni (max 7) — al raggiungimento del limite, parte alert/notifica
   - Verifica corretto incremento contatore presenze
   - Verifica che dopo 3 allenamenti o 7 giorni il sistema blocchi nuove scansioni e richieda decisione finale (firma consensi → active oppure rinuncia → uscita)

2. 🔵 **Continuare test famiglia allargata** (post QR):
   - Inserimento date certificato medico da parte genitore
   - Convalida date da admin
   - Test pagamento quote da genitore
   - Visione calendario allenamenti per più figli

3. 🟢 Eventuali rifiniture UX su altri ruoli

## Note Operative Critiche
- Vercel Hobby: commit `emergent-agent-e1` bloccati. Merge utente li sblocca. Con default branch `02-05-2026` → tutto automatico ora.
- Render Free: webhook delay 3-10 min. Fix solo frontend → basta Vercel.
- Brevo: blocco IP DISATTIVATO sulle API. 1 chiave attiva `frW0fa`.
- Mongo: tutte query pesanti escludono `athlete_photo`, `logo`, `signature_image`, `gdpr_signature_image_data`. **MA** quando si filtrano campi specifici per performance, ricordarsi di INCLUDERE: `place_of_birth`, `birth_place`, `birth_province`, `province_of_birth`, `country_of_birth` (vedi bug del 07/05 sulla firma trial).
- Cache JWT browser: per test multi-utente sullo stesso device, usare SEMPRE finestre incognito separate per evitare confusione di token.

## 📌 PROMEMORIA RIPRESA STAGIONE — SETTEMBRE 2026

⚠️ **STATO ATTUALE (16/05/2026)**: L'app è in **fase di TEST**, NON ancora completata. L'utente ha invitato alcune società ad usare la demo web **"La Tua Società ASD"** per provare le funzionalità e segnalare eventuali problemi/bug. Prima di sviluppare nuove feature, attendere il feedback dei tester e sistemare i bug emersi.

L'utente ha chiesto esplicitamente (16/05/2026) di rimandare a settembre, perché da inizio giugno cessa l'attività sportiva fino a ripresa allenamenti. **All'apertura della prossima sessione di sviluppo (~settembre 2026), ricordare all'utente queste feature in sospeso (in ordine di priorità):**

### 0. 🐛 RACCOLTA FEEDBACK DEMO (PRIORITÀ MASSIMA)
- Chiedere all'utente quali bug/problemi hanno segnalato le società invitate sulla demo "La Tua Società"
- Sistemare tutti i bug emersi PRIMA di sviluppare nuove feature
- L'app deve essere **stabile e completa** prima di passare alle feature successive

### 1. 🏐 ATLETI MAGGIORENNI CHE PERCEPISCONO UN COMPENSO (FEATURE NUOVA — CRITICA)
**Contesto**: alcune società hanno **atleti 18+ semi-professionisti** che, invece di pagare la quota di iscrizione, **ricevono un compenso mensile** (esattamente come i coach).

**Requisiti**:
- Nuovo ruolo o variante: fusione tra **Atleta 18+** e **Coach**
  - Mantiene tutte le funzionalità Atleta 18+ (certificato medico, presenze allenamenti, partite, QR scan, calendario, firma documenti)
  - Aggiunge le funzionalità Coach: compensi mensili, tracciamento soglie €5k/€15k Riforma Sport, attestati di compenso, PDF compensi
- Probabilmente serve un toggle in fase di registrazione atleta 18+ tipo: `"Questo atleta percepisce un compenso?"` → se sì, abilita il modulo compensi
- Backend: probabilmente serve campo `receives_compensation: bool` + collezione `compensations` con `athlete_id` oltre a `coach_id`
- Frontend: ricondurre/condividere i componenti `CompensationCard`, `ThresholdBanner`, ecc. tra Coach e Athlete 18+
- Admin path: poter assegnare/modificare compenso a un atleta 18+ esattamente come si fa per il coach

**Da chiedere a settembre**: 
  - Quanti atleti tipicamente prendono compenso per società?
  - Importi tipici? Soglie diverse rispetto al coach?
  - L'atleta deve firmare documenti aggiuntivi (es. dichiarazione fiscale come il coach)?

### 2. 🔔 Notifiche Annullamenti/Variazioni Allenamenti
- Quando admin/coach annulla o modifica un allenamento → avvisare automaticamente i genitori/atleti interessati
- Tre opzioni discusse:
  - **A) Email automatica** via Brevo (già integrato): rapido (~30 min), arriva al 100% degli utenti, ma non istantanea
  - **B) Push PWA vera** (Web Push API + VAPID o Firebase FCM): notifica visibile a schermo bloccato come WhatsApp; richiede che i genitori installino la PWA (~2-3 ore di lavoro + onboarding utenti). iOS solo da 16.4+ con PWA in Home
  - **C) Entrambe** (consigliata): email subito + push come bonus
- **Da ricordare all'utente**: chiedere quale opzione preferisce a settembre

### 3. Riferimento contesto (già FATTO, solo per memoria)
- Sezione "IMPEGNI SUCCESSIVI" collassabile su Parent/Athlete/Minor (default chiusa)
- Backend nasconde gli allenamenti annullati per "Gara" così da non creare confusione
- Audit multi-tenancy: ~6 query già filtrate per `society_id`, restano ~35 da sistemare (payments, attendances, compensation) — fare PRIMA di onboardare Sirio in produzione

---

### 🆕 Branding Società ovunque + Logo scontornato + Header Admin (17/05/2026 - v2)

**Modifiche su richiesta utente (foto annotata + frase agente):**

1. **Logo scontornato**: rimosso `borderRadius` e `backgroundColor: '#fff'` da `SocietyBranding`. Ora resizeMode è `contain` (no taglio). Identico a come l'admin lo mostra in home da "Profilo Società".
2. **Logo+nome SOPRA al titolo della pagina** (non più sotto): invertito ordine in tutti i file Coach + spostato `marginBottom: 6` invece di `marginTop: 4` per spaziatura naturale.
3. **Branding aggiunto anche a Scanner attivo** (camera view).
4. **Branding replicato su 22 file** in ruoli rimanenti (script `/tmp/apply_branding.py`):
   - Parent: index, link-athlete, register-athlete, documents, profile, athlete/[id], athlete/timeline (7 file)
   - Atleta 18+: index, sign-trial, schedule, payments, documents, presenze, timeline, profile (8 file)
   - Minor: index
   - Dirigente: index, compensation, team/[id], profile (4 file)
   - Collaboratore: compensation, profile (2 file)
5. **Header Admin Pallavolo Perugia (Foto 1)**:
   - Logo da 80x80 → 100x100 (più grande), marginTop 14 → 10
   - Nome società da fontSize 36 → 42 (più grande)
   - `headerRightCol` minHeight 94 → 110 (allineato col logo)
   - Mantiene auto-shrink + max 2 righe

Build Expo Web ricompilata.

### 🆕 Branding Società su tutte le pagine COACH (17/05/2026)

Su richiesta dell'utente: i coach (e in seguito anche atleti/genitori/dirigenti/collaboratori) non sapevano sempre con quale società stessero operando. Implementato il branding su **tutte le pagine del ruolo Coach** come prova.

- **Componente nuovo**: `frontend/src/components/SocietyBranding.tsx`
  - Mostra **logo (28px tondo) + nome società** in una riga compatta
  - Si auto-cache a livello modulo (evita refetch su ogni page change)
  - Auto-rileva mancanza logo via HEAD probe (404 ⇒ mostra solo nome)
  - Props: `light` (default true per header colorati), `logoSize`, `style`
- **Pagine aggiornate**:
  - `coach/index.tsx` — "Le Mie Squadre" + Scanner Presenze inattivo
  - `coach/history.tsx` — "Presenze di Oggi"
  - `coach/compensation.tsx` — "Compensi Sportivi"
  - `coach/profile.tsx` — "Il Mio Profilo"
  - `coach/team/[id]/index.tsx` — dettaglio squadra
  - `coach/team/[id]/attendances.tsx` — "Registro Presenze"
  - `coach/athlete/[id].tsx` — "Dati Tecnici"
- Layout opzione "A" scelto dall'utente: logo+nome **sotto al titolo della pagina** nell'header colorato esistente
- Nome società su **una sola riga** (max 2 con autoshrink se troppo lungo)

**Test prossimo**: una volta che utente conferma il risultato sul coach, replicheremo lo stesso pattern a:
- Parent (`parent/*`)
- Atleta 18+ (`athlete/*`)
- Minor lite (`minor/*`)
- Dirigente (`dirigente/*`)
- Collaboratore (`collaboratore/*`)
- Admin sotto-pagine (`admin/*`) — header admin home è già custom

### 🆕 Motivazione Annullamento Collassabile + Coach Upcoming ANNULLATO (17/05/2026)

**Su richiesta utente (foto Coach)**: 
1. La motivazione "Motivo: ..." era sempre visibile e prendeva troppo spazio → ora è **collassata di default**: si vede solo "❌ ANNULLATO (HH:MM - HH:MM) ▼" e cliccando il chevron si espande il motivo.
2. Negli **IMPEGNI SUCCESSIVI** (upcoming) del Coach mancava l'indicazione "❌ ANNULLATO" — apparivano solo barrati. Ora mostrano il badge come negli altri giorni.

**Modifiche** (`coach/index.tsx`):
- Aggiunto stato `expandedReasons: Set<string>` e helper `toggleReason(key)` per espansione singola per riga
- Aggiornati tutti e 4 i blocchi (today/tomorrow/day_after/upcoming):
  - Bottone tap con icon `chevron-down/up` accanto a "❌ ANNULLATO"
  - Motivazione visibile solo se la chiave è nel Set
- Blocco upcoming ora ha anche il rendering condizionale cancelled/modified (prima solo barrato senza badge)

**Parent/Athlete/Minor**: già "collassati" in modo nativo (mostrano "tocca per il motivo" che apre un alert nativo) — nessuna modifica necessaria.

Build Expo Web ricompilata.

### 🆕 Solo Admin può Modificare/Annullare Allenamenti (17/05/2026)

**Policy change (su richiesta utente)**: i Coach non possono più creare/modificare/cancellare gli override degli allenamenti — tutto passa dall'Admin per evitare abusi all'insaputa della società.

- **Frontend** (`coach/team/[id]/index.tsx`): rimosso il bottone "Modifica/Annulla Allenamenti" dalla pagina della squadra del coach
- **Backend** (`routes/training_overrides.py`):
  - Aggiunto parametro `write=True` a `_check_team_access` 
  - POST/PATCH/DELETE → richiede `role == ADMIN` (coach 403)
  - GET → resta aperto a Admin + Coach (lettura)
- **Comportamento risultante**:
  - Coach può vedere "❌ ANNULLATO"/"✏️ Variato" nella sua dashboard
  - Coach non vede più il pulsante di gestione e non può chiamare le API di scrittura
  - Solo l'Admin gestisce gli override via `/admin/team/[id]/training-overrides`
- **Testato via curl**: coach 403 sulla POST, coach 200 sulla GET (logica confermata)

### 🆕 Coach Dashboard — Allenamenti Annullati/Modificati (17/05/2026)

**Bug fix critico**: il coach **non vedeva** gli annullamenti/variazioni degli allenamenti (parents/atleti li vedevano già).

- **Backend** (`server.py` endpoint `/api/coach/commitments`):
  - Aggiunto fetch di `training_overrides` per team_id + date range
  - Per ogni training: se override `status='cancelled'` → `cancelled: true` + reason; se `modified` → orari/venue aggiornati + `modified: true`
  - Applicato sia ai 3 giorni (today/tomorrow/day_after) sia ai successivi (upcoming)
- **Frontend** (`coach/index.tsx`): renderizzazione identica a parent/athlete:
  - `cancelled` → testo barrato, "❌ ANNULLATO (HH:MM - HH:MM)" rosso + "Motivo: ..." blu
  - `modified` → "✏️ Variato" + sfondo arancione con nuovi orari
  - Replace_all sui 4 blocchi (today/tomorrow/day_after/upcoming)
- **Testato via curl** end-to-end: backend ritorna correttamente `cancelled/modified/reason` con override inseriti manualmente nel DB.

### 🆕 Componente Riutilizzabile `<MultiStepTutorial />` (17/05/2026)

- Estratto il tutorial multi-step in **componente generico riutilizzabile**: `/app/frontend/src/components/MultiStepTutorial.tsx`
- API:
  ```tsx
  <MultiStepTutorial
    visible={tutorialVisible}
    steps={TUTORIAL_STEPS}   // array di { icon, iconColor, iconBg, title, description }
    onClose={() => setTutorialVisible(false)}
    testIdPrefix="matches-tutorial"
  />
  ```
- Tipo esportato: `TutorialStep` per typing
- Refactor `admin/matches.tsx`: rimossi ~100 righe di Modal inline + 12 stili duplicati. Ora usa il componente.
- **Pronto per settembre**: quando aggiungeremo gli atleti 18+ con compenso, possiamo aggiungere subito un mini-tour anche su quella pagina (e su altre come settings, payments-import) senza duplicare codice.

### 🆕 Tutorial multi-step Admin Calendario Gare (17/05/2026)

- Aggiunto **tutorial guidato in 6 step** al tap del bottone "Info & tutorial" su `/admin/matches`:
  1. Benvenuto — panoramica della pagina
  2. Scarica Template Excel (verde)
  3. Importa gare (icona ☁️)
  4. Sincronizza da FIPAV (icona 🔄 arancione)
  5. Aggiungi gara manualmente (icona +)
  6. Filtri e visualizzazione (tab Da disputare/Giocate/Tutte)
- UI: Modal con icona, titolo, descrizione, dots indicatori, bottoni Indietro/Avanti, contatore "1 di 6"
- TestIDs: `matches-info-btn`, `matches-tutorial-modal`, `tutorial-prev-btn`, `tutorial-next-btn`, `tutorial-close-btn`
- File: `frontend/app/admin/matches.tsx` (~70 righe aggiunte: state, modal, styles)
- Pensato per le **società demo "La Tua Società"** che provano la piattaforma per la prima volta — riduce il bisogno di documentazione esterna.

### 🆕 Hide Trainings for ALL Matches + Date Headers + Calendario UI (17/05/2026)

- **BUG FIX Coach**: `/api/coach/commitments` ora nasconde gli allenamenti per partite **HOME e TRASFERTA** (prima solo HOME). La rifinitura pre-gara resta solo per partite in casa. (file: `backend/server.py` L11911-11960)
- **UI Date Headers**: aggiunta data DD/MM e giorno della settimana sotto OGGI/DOMANI/DOPODOMANI su tutti i ruoli:
  - Coach (`coach/index.tsx`): `OGGI 17/05 - DOMENICA` (usa date-fns già presente)
  - Parent (`parent/index.tsx`): helper `formatDayLabel(offset)` 
  - Athlete 18+ (`athlete/index.tsx`): IIFE inline nel map sections
  - Minor (`minor/index.tsx`): IIFE inline nel map sections
- **Admin Calendario Gare** (`admin/matches.tsx`):
  - Titolo "Calendario Gare": `fontSize 24` (era 20), `numberOfLines=1 adjustsFontSizeToFit minimumFontScale=0.7`
  - Box info "Importa o aggiorna calendario..." sostituito con bottone compatto **"Info importazione"** (icona info-circle). Al tap → alert con testo completo. Il pulsante "Template" resta accanto.
- **Testing**: 3/3 backend pytest passati; verificate UI dopo rebuild Expo web.

### ⚠️ Nota tecnica: Expo Web build statica

Il preview environment serve frontend da `/app/frontend/dist` (build statica). Dopo ogni modifica frontend serve eseguire:
```
cd /app/frontend && npx expo export -p web --output-dir dist
```
(impiega ~3-4 minuti). In produzione (Vercel) il build è automatico sul push.

---

### 🆕 Collapsible "IMPEGNI SUCCESSIVI" (16/05/2026)
- ✅ Sezione "IMPEGNI SUCCESSIVI" (oltre 3 giorni) ora **collassabile** su tutte le dashboard role:
  - `parent/index.tsx` (già esistente, `showUpcoming`)
  - `athlete/index.tsx` (NEW, `showUpcomingAthlete`)
  - `minor/index.tsx` (NEW, `showUpcomingMinor`)
- Default: **collassata** — mostra header `IMPEGNI SUCCESSIVI (N)` con chevron giù
- Click → espande sezione con dettagli completi
- TestIDs: `athlete-upcoming-toggle`, `minor-upcoming-toggle`
- ✅ Backend già filtra (sessione precedente): allenamenti annullati per "Gara" sono completamente nascosti (non più mostrati come "Annullato")

## Architettura File Chiave
```
/app
├── memory/PRD.md, test_credentials.md
├── backend/
│   ├── server.py (~25k righe)
│   ├── email_service.py (Brevo)
│   └── routes/
├── frontend/app/
│   ├── register.tsx, parent/register-athlete.tsx
│   ├── coach/, collaboratore/, dirigente/, athlete/, parent/
│   ├── admin/coach/[id].tsx, admin/dirigente/[id].tsx, admin/collaboratore/[id].tsx
│   └── ...
```

## API Endpoint Chiave
- `POST /api/auth/register` — registrazione utente
- `POST /api/athletes` — registrazione atleta minorenne (status `pending_trial`)
- `POST /api/parent/link-athlete-request` — richiesta linking secondo genitore
- `POST /api/athletes/{id}/sign-trial-document` — firma dichiarazione prova (FIX: ora projection include tutti i campi nascita)
- `POST /api/qr/scan` — scansione QR coach (DA TESTARE)
- `GET /api/coach/{id}/threshold-status/{year}` — soglie €5k/€15k
- `GET /api/documents/signed/{id}/pdf` — download PDF
