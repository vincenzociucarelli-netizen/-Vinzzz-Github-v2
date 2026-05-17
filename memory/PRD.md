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

## Credenziali Test (famiglia allargata)
- Admin: `vincenzo.ciucarelli@gmail.com`
- Mario Rossi: `mario@test.com` (padre di Giulia + Sara)
- Anna Verdi (alias Arianna): `anna@test.com` o `arianna@test.com` (madre di Sara, Giulia, Marco, Laura)
- Luca Bianchi: padre di Marco e Laura, registrato via invito
- Atleti: Giulia Rossi, Sara Rossi, Marco Bianchi (Belgio), Laura Bianchi (Danimarca)

## Stato Attuale (12/05/2026)

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
