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
