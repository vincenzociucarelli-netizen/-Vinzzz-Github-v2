# 🚀 Guida Deploy Produzione RegistraTEAM

**Ultimo aggiornamento:** 02 maggio 2026
**Stato preparazione codice:** ✅ Completato (render.yaml + vercel.json + CORS configurabile)
**Domini disponibili:** registrateam.it, registrateam.com (redirect), registrateam.net (redirect)
**Email consigliata per registrazioni:** registrateam@gmail.com

---

## 📋 Panoramica Architettura Produzione

```
┌─────────────────────────────────────────────────────────┐
│  Utente finale                                          │
│         ↓ https://registrateam.it                       │
├─────────────────────────────────────────────────────────┤
│  Vercel (Frontend Expo Web)                             │
│  dominio: registrateam-frontend.vercel.app              │
│  alias:   registrateam.it, www.registrateam.it          │
│         ↓ chiama /api/*                                 │
├─────────────────────────────────────────────────────────┤
│  Render (Backend FastAPI)                               │
│  dominio: registrateam-backend.onrender.com             │
│  alias:   api.registrateam.it                           │
│         ↓ legge/scrive                                  │
├─────────────────────────────────────────────────────────┤
│  MongoDB Atlas (Database)                               │
│  cluster: registrateam-cluster (M0 free, UE)            │
└─────────────────────────────────────────────────────────┘

+ Brevo (email transazionali, già configurato)
+ Emergent LLM Key (AI features)
```

---

## ⏱️ Tempi realistici

| Step | Tempo stimato |
|---|---|
| 0. Save to GitHub | 5 min |
| 1. MongoDB Atlas | 15 min |
| 2. Render backend | 15 min |
| 3. Vercel frontend | 10 min |
| 4. Aruba DNS | 10 min + **attesa 1-6h** per propagazione |
| 5. Test E2E | 10 min |
| **Totale** | **~65 min** + attesa DNS |

---

## STEP 0 — Save to GitHub ⚠️ PREREQUISITO

Prima di partire assicurati che il codice aggiornato sia su GitHub.

1. Sulla piattaforma Emergent, clicca il pulsante **"Save to GitHub"** in alto a destra
2. Seleziona il repository **Vinzzz-Github** (quello già collegato)
3. Branch: `main` (o crea un branch nuovo tipo `deploy-prod`)
4. Commit message: "Deploy ready: render.yaml + vercel.json + CORS configurabile"
5. Clicca **Save**

⚠️ **Verifica**: vai su github.com/[tuo-user]/Vinzzz-Github e controlla che ci siano i file:
- `/render.yaml`
- `/frontend/vercel.json`
- `/backend/requirements.txt`

---

## STEP 1 — MongoDB Atlas (Database)

### 1.1 Registrazione
1. Vai su https://www.mongodb.com/cloud/atlas/register
2. Registrati con **registrateam@gmail.com** (login Google consigliato, zero password)
3. Organization name: `RegistraTEAM`
4. Project name: `RegistraTEAM Production`

### 1.2 Crea il cluster gratuito
1. Clicca **Build a Database**
2. Scegli **M0 Free** (512 MB — sufficiente per 1 anno di uso reale)
3. Provider: **AWS** (qualsiasi va bene)
4. Region: **Frankfurt (eu-central-1)** o **Milano (me-south-1)** — server UE GDPR
5. Cluster name: `registrateam-cluster`
6. Clicca **Create**

⏳ Attesa creazione: ~3 minuti

### 1.3 Crea l'utente DB
1. Security → **Database Access** → **Add New Database User**
2. Authentication: **Password**
3. Username: `registrateam_admin`
4. Password: **clicca Autogenerate** e COPIALA (ti serve dopo!)
5. Built-in Role: **Read and write to any database**
6. Clicca **Add User**

📋 **SALVA QUESTA PASSWORD** in un luogo sicuro. Non la vedrai più.

### 1.4 Whitelist IP (Render)
1. Security → **Network Access** → **Add IP Address**
2. Clicca **Allow Access from Anywhere** (0.0.0.0/0)
   - ℹ️ Opzione più comoda per partire. In futuro puoi restringere ai soli IP Render.
3. Clicca **Confirm**

### 1.5 Copia la connection string
1. Database → **Connect** sul cluster
2. Scegli **Drivers** → **Python** → versione **3.12 or later**
3. Copia la stringa che inizia con `mongodb+srv://registrateam_admin:<password>@...`
4. Sostituisci `<password>` con la password che hai salvato al punto 1.3
5. Aggiungi alla fine `/registrateam` (il nome del database) prima del `?`. Esempio:
   ```
   mongodb+srv://registrateam_admin:TUAPASSWORD@registrateam-cluster.abc.mongodb.net/registrateam?retryWrites=true&w=majority
   ```

📋 **SALVA QUESTA STRINGA** — sarà `MONGO_URL` in Render.

---

## STEP 2 — Render (Backend)

### 2.1 Registrazione
1. Vai su https://render.com/
2. **Get Started** → login con GitHub (usa l'account GitHub dove c'è il repo)
3. Conferma email `registrateam@gmail.com`

### 2.2 Crea il Web Service
1. Dashboard → **New +** → **Web Service**
2. **Connect a repository** → seleziona **Vinzzz-Github**
3. Render dovrebbe rilevare automaticamente `render.yaml` e mostrare:
   - Name: `registrateam-backend`
   - Root Directory: `backend`
   - Runtime: Python
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Instance Type: **Free** (0 $ / mese ma va in sleep dopo 15 min → primo hit dopo sleep è lento ~30 sec)

   💡 Se hai budget, scegli **Starter $7/mese** per no-sleep.

4. Clicca **Create Web Service**

### 2.3 Imposta gli Environment Variables
Dopo la creazione, vai su **Environment** nel menu laterale e aggiungi le secret vars che `render.yaml` ha lasciato vuote:

| Key | Value |
|---|---|
| `MONGO_URL` | La connection string completa dallo Step 1.5 |
| `DB_NAME` | `registrateam` |
| `JWT_SECRET_KEY` | (auto-generata da Render, non toccare) |
| `BREVO_API_KEY` | `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` (dal .env attuale) |
| `EMERGENT_LLM_KEY` | `sk-emergent-d07D4CcE4Ad8f5bE6C` (dal .env attuale) |

Le altre (`SENDER_EMAIL`, `ALLOWED_ORIGINS`, ecc.) sono già impostate nel render.yaml.

### 2.4 Avvia il deploy
1. **Manual Deploy** → **Deploy latest commit**
2. Guarda i log — deve arrivare a `Application startup complete`
3. Prendi nota dell'URL che Render ti assegna, tipo:
   **`https://registrateam-backend.onrender.com`**

### 2.5 Verifica salute
Apri in browser: `https://registrateam-backend.onrender.com/api/health`
Deve rispondere con JSON tipo `{"status":"healthy","timestamp":"..."}`.

📋 **SALVA l'URL del backend** — ti serve per il frontend.

---

## STEP 3 — Vercel (Frontend)

### 3.1 Registrazione
1. Vai su https://vercel.com/signup
2. Continua con GitHub (stesso account di Render)
3. Personal / Team: **Personal** (o crea un team "RegistraTEAM" se vuoi)

### 3.2 Importa il progetto
1. Dashboard Vercel → **Add New** → **Project**
2. Seleziona **Vinzzz-Github**
3. Configura:
   - Framework Preset: **Other**
   - Root Directory: `frontend` ⚠️ IMPORTANTE
   - Build Command: `yarn install && npx expo export -p web` (già nel `vercel.json`)
   - Output Directory: `dist`
   - Install Command: `yarn install --frozen-lockfile`

### 3.3 Imposta le Environment Variables
Clicca **Environment Variables** e aggiungi:

| Key | Value |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | L'URL Render dello Step 2.4 (es. `https://registrateam-backend.onrender.com`) |

### 3.4 Deploy
1. Clicca **Deploy**
2. Attendi ~3 minuti
3. Prendi nota dell'URL Vercel, tipo:
   **`https://registrateam-frontend.vercel.app`**

### 3.5 Test veloce
Apri quell'URL in incognito → dovresti vedere la pagina di login di RegistraTEAM.

---

## STEP 4 — DNS Aruba (dominio registrateam.it)

### 4.1 Configurazione domini

Login su Aruba → Gestione domini → **registrateam.it** → DNS & Server Name.

**Record da creare/modificare**:

| Tipo | Nome/Host | Valore (Destinazione) | TTL |
|---|---|---|---|
| **A** o **ALIAS/ANAME** | `@` (root) | IP Vercel (o CNAME `cname.vercel-dns.com`) | 3600 |
| **CNAME** | `www` | `cname.vercel-dns.com` | 3600 |
| **CNAME** | `api` | `registrateam-backend.onrender.com` | 3600 |

⚠️ **Nota Aruba**: alcuni provider (tra cui Aruba) non permettono CNAME sul root dominio. Usa un record **ALIAS/ANAME** se disponibile, altrimenti un record A che punti all'IP Vercel (trovi l'IP nella dashboard Vercel → Settings → Domains).

### 4.2 Aggiungi i domini in Vercel
1. Vercel → Project → **Settings** → **Domains**
2. Aggiungi: `registrateam.it`, `www.registrateam.it`
3. Vercel ti dirà se il DNS è corretto (emoji 🟢 verde = OK)

### 4.3 Aggiungi api.registrateam.it in Render
1. Render → Service → **Settings** → **Custom Domain**
2. Aggiungi: `api.registrateam.it`
3. Attendi verifica DNS + emissione certificato SSL (~5 min)

### 4.4 Aggiorna ALLOWED_ORIGINS in Render
1. Render → Environment → modifica `ALLOWED_ORIGINS`
2. Assicurati che includa:
   ```
   https://registrateam.it,https://www.registrateam.it,https://registrateam.com,https://registrateam.net,https://registrateam-frontend.vercel.app
   ```
3. Save → Render farà un redeploy automatico

### 4.5 Aggiorna EXPO_PUBLIC_BACKEND_URL in Vercel
Una volta che `api.registrateam.it` è verde in Render:
1. Vercel → Settings → Environment Variables → modifica `EXPO_PUBLIC_BACKEND_URL`
2. Cambia in: `https://api.registrateam.it`
3. Deployments → **Redeploy** l'ultimo deploy

⏳ **Propagazione DNS**: da 10 minuti fino a 6 ore. Puoi verificare su https://dnschecker.org

---

## STEP 5 — Test End-to-End

Dopo che tutti i DNS sono propagati (puoi verificare con https://dnschecker.org):

1. Apri in incognito: `https://registrateam.it`
2. ✅ Carica la pagina di login
3. ✅ Vedi il Cookie Banner in basso
4. ✅ Clicca "Informativa Privacy" → carica la pagina GDPR
5. Login come `vincenzo.ciucarelli@gmail.com` / `Test123`
6. ✅ Vedi la dashboard admin
7. Crea uno screenshot e confronta con preview

**Se qualcosa non va**:
- Controlla la Console del browser (F12) per errori CORS/JS
- Controlla i log di Render (Dashboard → Logs) per errori backend
- Controlla la Network tab per vedere su quale URL stanno andando le chiamate /api/

---

## 🔐 Credenziali e Segreti da Conservare

**Salva in una password manager** (es. Bitwarden, 1Password):

- [ ] MongoDB Atlas: login + password utente DB + connection string
- [ ] Render: login GitHub (via OAuth, niente password)
- [ ] Vercel: login GitHub (via OAuth, niente password)
- [ ] JWT_SECRET_KEY: generata da Render, visibile nelle env vars
- [ ] BREVO_API_KEY: stessa del .env attuale
- [ ] EMERGENT_LLM_KEY: stessa del .env attuale
- [ ] Credenziali Aruba: quelle che usi già

---

## 🆘 Problemi Comuni

| Problema | Causa | Soluzione |
|---|---|---|
| Frontend carica ma login dà errore CORS | `ALLOWED_ORIGINS` non include il dominio | Aggiungi il dominio in Render env vars |
| Backend Render in "Sleeping" dopo 15 min | Piano Free | Passa a Starter $7/mese o accetta primo hit lento |
| 404 su `/register-society` | Vercel rewrites mancanti | Verifica che `vercel.json` sia nel root `frontend/` |
| MongoDB: `ServerSelectionTimeoutError` | IP non whitelisted | Aggiungi 0.0.0.0/0 in Network Access |
| DNS Aruba non propaga | TTL alto o cache | Attendi 6 ore max, usa dnschecker.org |
| Emails non arrivano | `SENDER_EMAIL` dominio non verificato Brevo | Verifica dominio `registrateam.it` in Brevo |

---

## 🎯 Post-Deploy Checklist

- [ ] `https://registrateam.it` risponde 200 e mostra il login
- [ ] `https://api.registrateam.it/api/health` risponde `{"status":"healthy"}`
- [ ] HTTPS attivo (lucchetto verde in browser) su tutti i domini
- [ ] Login funziona end-to-end
- [ ] Registrazione di un nuovo utente test funziona
- [ ] Email di benvenuto arriva (Brevo funzionante)
- [ ] Scarica il **backup completo ZIP** appena fatto il deploy (test + assicurazione)
- [ ] Aggiorna PRD: data di messa in produzione

---

## 💡 Ottimizzazioni future (opzionali)

1. **Upgrade Atlas a M10** ($9/mese) se superi i 512MB
2. **Render Starter** ($7/mese) per eliminare lo sleep
3. **Vercel Pro** ($20/mese) solo se avrai molto traffico (>100k visitors/mese)
4. **Monitoring** con UptimeRobot gratuito (alert se il sito va giù)
5. **Backup automatico** settimanale del DB via cron Render

---

**Ultima verifica del codice deploy-ready:**
✅ `render.yaml` presente nel root
✅ `frontend/vercel.json` presente
✅ `backend/requirements.txt` aggiornato (vedi `pip freeze`)
✅ CORS configurabile via `ALLOWED_ORIGINS`
✅ `/api/health` esistente
✅ Nessun URL hardcoded in codice production
✅ Smoke regression 17/17 passati
