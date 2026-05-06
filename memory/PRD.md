# RegistraTEAM — PRD & Stato

## Original Problem Statement
Applicazione gestionale per società sportive italiane (pallavolo, futuro multi-sport). Focus principale: **conformità GDPR**, flussi di onboarding role-specific (Admin / Coach / Dirigente / Collaboratore / Atleta / Genitore), generazione dinamica di documenti legali (PDF), gestione soglie compensi sportivi (€5k previdenziale + €15k fiscale), sincronizzazione automatica calendario/partite. Pilota single-tenant per **Pallavolo Perugia**, da estendere in seguito multi-tenant.

## Lingua di lavoro
🇮🇹 **Italiano** (l'utente parla solo italiano)

## Stack & Hosting
- Frontend: React/Expo Web (build statica `npx expo export -p web` + `serve -s dist`)
- Backend: FastAPI + MongoDB Atlas
- Hosting: **Vercel** (frontend) + **Render** (backend) + **MongoDB Atlas** (DB)
- Email: **Brevo** (API HTTP v3, sender `info@pallavoloperugia.it`)
- Pagamenti: Stripe (test mode)
- Uptime: UptimeRobot (HEAD /api/health)
- Produzione: https://registrateam.it

## Credenziali
- Admin: `vincenzo.ciucarelli@gmail.com`
- Istituzionale: `pallavoloperugia@gmail.com`
- Test coach: STINZI SIMONA (registrata il 06/05/2026)

## Workflow Deploy
1. `Save to GitHub` → branch `02-05-2026`
2. Merge PR su `main` (via GitHub web)
3. Vercel deploya **automaticamente** quando vede il merge da utente reale (non `emergent-agent-e1`)
4. Render deploya da branch `02-05-2026` con delay 3-10 min (Free tier)
5. Hard refresh `Ctrl+Shift+R` su registrateam.it

## Stato Attuale (06/05/2026 — fine sessione)

### ✅ Completato in produzione
- 23 fix pushati e LIVE in produzione (PR #11 + PR #12):
  - Brevo email integration **risolta** (era key SMTP al posto di key API → "Key not found")
  - Performance backend (proiezioni MongoDB, ~30s → <1s)
  - Indexes MongoDB
  - HEAD /api/health per UptimeRobot
  - Anti-duplicati GDPR + cancellazione atleta
  - Fix NameError approvazione cancellazione
  - UI: ricevuta "Dichiarazione dei Redditi", logo login, allineamenti
  - Modal in-app per Termini/Privacy in registrazione (no più window.open)
  - **Salvataggio campi anagrafici** in `POST /auth/register` (data nascita, luogo, indirizzo, città, CAP, provincia, n° tesserino) — bug critico per coach/dirigenti
  - **Download PDF firmati** (coach/collaboratore/dirigente) — sostituito window.open con `<a download>` per bypassare popup blocker mobile + gestione 401 (sessione scaduta) + nome file pulito
  - **Banner soglie €5k/€15k** in proiezione (frontend + backend `needs_warning`) — vista coach + admin
  - **Pulsante back universale** in 21 file (canGoBack/replace fallback)
  - **Banner soglie nella vista admin coach in modalità lettura** (era solo in editing)
  - Derivazione automatica `contract_start_year`/`contract_end_year` da date in admin coach

### ⏳ Pending push GitHub (2 fix)
- **Banner verdi "firmata"** ora mostrano "(superata nel mese di X)" — applicato in 6 file × 4 banner = 24 punti
- Eventuali altri micro-fix dalla prossima sessione

### 🔴 Issue P0 attive
1. **Simona ha profilo incompleto** in produzione (data nascita & co perse a causa del bug di registrazione). Soluzione: deve compilare manualmente da "Modifica Profilo".
2. **Logo login con riquadro bianco** → l'utente deve caricare un PNG con sfondo trasparente in Impostazioni Società.

### 🟡 Issue P1
- **Multi-tenancy audit**: Audit di tutti i `db.find()` per garantire filtro `society_id`. Necessario prima di onboardare la seconda società ("Sirio").
- **Riattivare /register-society** con flusso onboarding nuove società.

### 🟢 P2/P3
- Pulizia audit log (firma duplicata Luigi Bianchi 04/05)
- Aggiornare CF Luigi Bianchi (fu vittima del bug registrazione)
- Preview Excel re-import calendario
- Stripe live mode (oggi è test mode)
- Account Brevo dedicato `info@registrateam.it`
- Refactoring `server.py` (~25k righe) → spezzare in `routes/`
- ~38 `db.settings.find_one()` ancora senza projections

## 🎯 Priorità Prossima Sessione (07/05/2026)
**L'utente ha specificato**: la presentazione di RegistraTEAM ai **genitori** deve essere PERFETTA. Quindi prima di altro, priorità assoluta:
1. ✅ **Push fix banner verdi "superata nel mese di X"** (2 fix locali pendenti)
2. 🔵 **Test completo flusso GENITORE + ATLETA MINORENNE**:
   - Invito genitore via email
   - Registrazione genitore (CF, data nascita, ecc. — verificare che ora si salvino)
   - Linking atleta esistente (workflow manuale parent-athlete)
   - Firma documenti GDPR per il minore
   - Pagamento quote
   - Upload certificato medico
   - Visione calendario allenamenti del figlio
3. 🟣 **Completare scanner QR coach** (presenze allenamenti/gare)
4. 🟢 Bug "fix prima delle altre presentazioni" (Coach/Dirigente sono utenti obbligati, possono tollerare qualche bug)

## Architettura File Chiave
```
/app
├── memory/PRD.md, test_credentials.md
├── backend/
│   ├── server.py                 # ~25k righe (in attesa di refactoring)
│   ├── email_service.py          # Brevo API HTTP v3
│   ├── routes/
│   │   ├── settings.py
│   │   └── primary_admin.py
│   └── render.yaml
├── frontend/
│   ├── app/
│   │   ├── login.tsx, register.tsx
│   │   ├── coach/profile.tsx, compensation.tsx, index.tsx
│   │   ├── collaboratore/profile.tsx, compensation.tsx
│   │   ├── dirigente/profile.tsx, compensation.tsx
│   │   ├── athlete/, parent/
│   │   └── admin/
│   │       ├── coach/[id].tsx
│   │       ├── collaboratore/[id].tsx
│   │       ├── dirigente/[id].tsx
│   │       └── athlete/[id]/
│   └── src/components/
```

## API Endpoint Chiave
- `POST /api/auth/register` — registrazione utente (FIXATO 06/05: salva tutti i campi anagrafici)
- `GET /api/coach/{id}/threshold-status/{year}` — calcolo soglie €5k/€15k
- `GET /api/coach/my-teams` — squadre assegnate
- `GET /api/documents/signed/{id}/pdf` — download PDF firmato
- `POST /api/documents/sign` — firma documento GDPR
- `GET /api/health` (GET + HEAD per UptimeRobot)

## Note Operative Critiche
- **Vercel Hobby** blocca commit di `emergent-agent-e1`: serve un commit utente reale (es. modifica README.md aggiungendo uno spazio) per sbloccare deploy. **MA** se l'utente fa il merge della PR, il commit di merge è suo e Vercel deploya senza problemi.
- **Render Free** ha webhook con delay 3-10 min. Per fix solo frontend non serve aspettarlo (Vercel basta).
- **Brevo**: blocco IP DISATTIVATO sulle API perché Render non ha IP statici. Solo 1 chiave API attiva: `frW0fa` (RegistraTEAM Render v2).
- **Mongo projections**: tutte le query pesanti escludono `athlete_photo`, `logo`, `signature_image`, `gdpr_signature_image_data`. Da estendere a ~38 query rimaste.
