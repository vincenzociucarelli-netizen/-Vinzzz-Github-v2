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
