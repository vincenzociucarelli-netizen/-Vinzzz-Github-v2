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

## Branch Git
- **`02-05-2026`** = default branch (GitHub + Vercel + Render). Save to GitHub pusha qui → deploy automatico. Niente più merge manuali.
- `main` obsoleto, non lo usiamo più.

## Credenziali
- Admin: `vincenzo.ciucarelli@gmail.com`
- Istituzionale: `pallavoloperugia@gmail.com`
- Test coach: STINZI SIMONA (registrata il 06/05/2026)

## Stato Attuale (06/05/2026 — sera)

### ✅ Già live in produzione (PR #11, #12, #13, #14, #15)
- Brevo email risolto (era SMTP key al posto di API key)
- Performance backend (proiezioni MongoDB)
- HEAD /api/health
- Anti-duplicati GDPR + cancellazione atleta
- Fix NameError approvazione cancellazione
- UI login, Modal Termini/Privacy, layout athlete
- Registrazione anagrafica completa (coach/dirigente)
- Download PDF firmati (mobile + 401 + filename)
- Banner soglie €5k/€15k in proiezione (coach + admin coach)
- Pulsante back universale
- Banner admin coach visibili in modalità lettura
- Derivazione `_derivedStartYear` da date contratto
- Banner verdi "firmata" con "(superata nel mese di X)" — coach + admin

### ⏳ Pending push GitHub (3 fix locali stasera 06/05 tarda sera)
1. **CF rimosso dalla registrazione ADULTI** (`register.tsx`): coach/dirigente/collaboratore/atleta/genitore NON devono più inserire CF in registrazione. Lo aggiungeranno dopo nel profilo. Meno invasivo.
2. **CF genitore tax_payer** (`register-athlete.tsx`, solo minorenni): MANTENUTO perché serve per Attestato di Versamento. Aggiunto `autoComplete="off"` + `autoCorrect={false}` + `textContentType="none"` per bloccare il browser autofill (che riempiva con nome utente Google troncato).
3. **Status `pending_trial` riconosciuto nel frontend genitore** (3 file: `parent/index.tsx`, `parent/athlete/[id].tsx`, `parent/athlete/timeline.tsx`): ora gli atleti minorenni appena iscritti appaiono come "In attesa di inizio prova" 🟣 invece di "Attivo" 🟢.

### 🔴 Issue P0 attive
1. Simona ha profilo incompleto in produzione (dati persi nel bug vecchio). Deve completare da "Modifica Profilo".
2. Logo login con riquadro bianco → l'utente deve caricare un PNG trasparente.

### 🟡 Issue P1
- Multi-tenancy audit (filtro `society_id`) prima di onboardare Sirio.
- Riattivare `/register-society` per nuove società.

### 🟢 P2/P3
- Pulizia audit log (firma duplicata Luigi Bianchi)
- Aggiornare CF Luigi Bianchi
- Preview Excel re-import calendario
- Stripe live mode
- Account Brevo dedicato info@registrateam.it
- Refactoring `server.py` (~25k righe)
- ~38 `db.find_one()` senza projections

## Ciclo di vita ATLETA MINORE (requisito utente)
```
[ISCRIZIONE GENITORE]
   ↓
pending_trial  ← 🟣 "In attesa di inizio prova" (appena iscritto)
   ↓ (genitore firma autorizzazione prova)
pending_trial  ← ancora in attesa del 1° QR scan
   ↓ (coach fa 1a scansione QR — parte timer 7gg/3allenamenti)
trial          ← 🟠 "In prova"
   ↓
   ├─→ rinuncia → uscita
   └─→ continua → firma consensi privacy GDPR → active ← 🟢 "Attivo"
```
**NOTA**: Anche con certificato medico inserito e convalidato da admin, l'atleta **resta in prova** finché il genitore non firma i consensi finali.

## Regole Documenti/Firma GDPR
- Documenti di un minore possono essere firmati da **UNO QUALSIASI** dei 2 genitori (non serve la firma di entrambi).
- Certificato medico: **NO upload file**. Solo data emissione + data scadenza + convalida admin.

## 🎯 Priorità Prossima Sessione (07/05/2026)

1. 🔵 **Save to GitHub** dei 3 fix pendenti di stasera (CF + autofill + pending_trial)

2. 🔵 **Continuare test famiglia allargata**:
   - **Setup già fatto**: Mario Rossi + Anna Verdi registrati (padre+madre), Giulia Rossi (atleta loro) + Marco Bianchi (atleta di Anna da precedente unione) caricati.
   - **Prossimo step**: Admin invita **Luca Bianchi** (padre biologico di Marco) via email → Luca si registra → sistema chiede "Hai figli già caricati?" → Luca dice SÌ → seleziona Marco → sistema invia richiesta ad Anna (già registrata come altra genitrice di Marco) → Anna accetta → Luca vede Marco in dashboard (ma NON Giulia).

3. 🔵 **Test scenari critici**:
   - 1 atleta (Marco) → 2 genitori (Anna + Luca): entrambi possono vedere Marco; firmare documenti basta uno qualsiasi.
   - 1 genitore (Anna) → 2 atleti (Giulia + Marco): vede entrambi in dashboard.
   - Visione calendario, pagamenti quote, inserimento date certificato medico, autorizzazione prova.

4. 🟣 Completare scanner QR coach (presenze).

## Architettura File Chiave
```
/app
├── memory/PRD.md, test_credentials.md
├── backend/
│   ├── server.py (~25k righe)
│   ├── email_service.py (Brevo API HTTP v3)
│   └── routes/
├── frontend/
│   ├── app/
│   │   ├── register.tsx, parent/register-athlete.tsx
│   │   ├── login.tsx
│   │   ├── coach/, collaboratore/, dirigente/, athlete/, parent/
│   │   └── admin/coach/[id].tsx, admin/dirigente/[id].tsx, admin/collaboratore/[id].tsx
│   └── src/components/
```

## API Endpoint Chiave
- `POST /api/auth/register` — registra utente (ora salva tutti i campi anagrafici ma CF è opzionale da UI)
- `POST /api/parent/register-athlete` — registra atleta minorenne (status iniziale `pending_trial`)
- `GET /api/coach/{id}/threshold-status/{year}` — soglie €5k/€15k
- `GET /api/documents/signed/{id}/pdf` — download PDF firmato
- QR scan handler (riga ~11247 server.py) — converte `pending_trial` → `trial` al 1° scan

## Note Operative Critiche
- **Vercel Hobby**: commit di `emergent-agent-e1` vengono bloccati. Con il merge di un commit utente, sbloccano.
- **Render Free**: webhook delay 3-10 min. Per fix solo frontend basta Vercel.
- **Brevo**: blocco IP DISATTIVATO sulle API (Render non ha IP statici). 1 chiave attiva `frW0fa` (RegistraTEAM Render v2).
- **Mongo**: tutte le query pesanti escludono `athlete_photo`, `logo`, `signature_image`, `gdpr_signature_image_data`.
- **Autofill browser su CF genitore**: risolto con `autoComplete="off"` + `autoCorrect={false}` + `textContentType="none"`. Se riappare in futuro su altri campi, usa stessa combinazione.
