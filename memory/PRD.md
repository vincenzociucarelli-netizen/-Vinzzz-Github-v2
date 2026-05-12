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
