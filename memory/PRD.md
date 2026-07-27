# RegistraTEAM - Product Requirements Document

## Original Problem Statement
RegistraTEAM è un'applicazione full-stack per la gestione delle società sportive di pallavolo italiane. Focus:
- Compliance GDPR rigorosa (documenti dinamici, consenso, minori)
- Multi-tenancy con isolamento dati per società
- Gestione soglie Riforma Sport per ruoli duali (Zaino Coach)
- Sistema Pre-iscrizioni + Import graduale utenti tra stagioni
- Smart Login "Lite" per minorenni (nome_lite + PIN)
- Athlete Code persistente legato al Codice Fiscale
- Pagamenti Stripe multi-tenant + Rate + Parziali
- Bacheca Note Admin con notifiche urgenti
- Auto-generazione Richieste Visita ASL Umbria 1 (PDF A4)
- Email transazionali via Brevo con dominio verificato centralizzato

## Language / Communication
- **Comunicazione utente: SEMPRE in ITALIANO**
- Utente principale: Vincenzo Ciucarelli

## Architecture

### Stack
- **Frontend**: React/Expo Web (in /app/frontend)
- **Backend**: FastAPI (in /app/backend/server.py + /app/backend/routes/*.py)
- **Database**: MongoDB
- **Email**: Brevo (transazionali)
- **Payments**: Stripe (Checkout Sessions, Refunds, Webhooks)
- **Scheduler**: APScheduler (background jobs)
- **PDF**: HTML-to-PDF via browser print engine + `@media print` CSS
- **Deploy**: Render (backend) + Vercel (frontend registrateam.it)

### Key DB Collections
- `societies` (id, name, email, owner_id, ...)
- `users` (id, society_id, email, role, ...)
- `athletes`, `parents`, `settings`
- `admin_notes` (id, society_id, title, content, priority, expiry_date, status, taken_by, ...)
- `payments`, `recurring_payments`, `stripe_refunds`

## Email System (aggiornato 23/07/2026)

### Architettura centralizzata
- **Mittente fisico:** `info@registrateam.it` (dominio autenticato su Brevo)
- **From Name:** dinamico = `society.name` (es. "Sirio Volley Perugia", "Pallavolo Perugia SSD")
- **Reply-To:** dinamico = `society.email` (o admin owner email come fallback)
- **Vantaggio:** logo RegistraTEAM in Gmail + separazione SaaS/società

### Helper disponibili in `/app/backend/email_service.py`
- `send_transactional_email(to_email, subject, html_content, reply_to_email=, sender_name=, ...)` — invio email semplice
- `send_email_with_pdf(...)` — invio email con allegato PDF
- `send_society_email(society_dict, to_email, ...)` — auto-applica branding società
- `send_society_email_with_pdf(society_dict, ...)` — invio con PDF + branding

### Env vars (backend + Render)
```
BREVO_API_KEY=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
SENDER_EMAIL=info@registrateam.it
SENDER_NAME=RegistraTEAM
```

## Status - Completed

### 27/07/2026 (parte 5) - Fix DEFINITIVO anteprima WhatsApp: rimosso meta refresh + canonical
- Diagnosi da Facebook Sharing Debugger: og:url canonico era `https://www.registrateam.it/` (homepage) invece che l'URL specifico dell'evento
- Root cause: la share page del backend aveva `<meta http-equiv="refresh">` + `<link rel="canonical">` che puntavano a Vercel. Il crawler Facebook/WhatsApp seguiva il redirect, arrivava sulla SPA Vercel (che non ha og:image specifico per evento), e finiva usando gli og tag della homepage generica RegistraTEAM
- Fix in `server.py:33091-33093`: rimosso il meta refresh + il canonical verso Vercel. Il redirect all'utente umano avviene ora SOLO via JavaScript (`window.location.replace()`). I crawler non eseguono JS quindi restano sulla pagina backend con og:image corretti
- Effetto: WhatsApp/Facebook/Telegram ora leggono og:image (locandina evento), og:title (titolo evento), og:description (descrizione evento) invece dei tag generici della homepage
- Verificato: dopo il fix, l'HTML della share page contiene solo gli og:tag corretti dell'evento specifico, senza istruzioni di redirect che confondano i crawler

### 27/07/2026 (parte 4) - Correzione fix precedente: rollback padding WhatsApp + Fix crop pagina evento
- Vincenzo ha correttamente notato che il padding 1200×1200 aveva PEGGIORATO il preview WhatsApp (locandina piccola con enorme cornice bianca quadrata invece del preview piccolo con locandina intera)
- Rollback endpoint `/preseason/public/{id}/cover.jpg`: rimosso il padding, torna a servire l'immagine originale come prima. OG meta tag ripristinati a dimensioni reali dinamiche
- Fix SEPARATO sulla pagina evento (`/app/frontend/app/preseason/[id].tsx`):
  - Prima: `aspectRatio: 1200/630 + resizeMode="cover"` → tagliava locandine verticali Canva
  - Ora: aspect ratio letto dinamicamente via `Image.getSize()` + `resizeMode="contain"` → locandina mostrata INTERA senza crop laterali né verticali
  - Nuovo stato `coverAspect` inizializzato a 1200/630, aggiornato al caricamento della cover con dimensioni reali
- Lezione appresa: preview piccolo WhatsApp = feature, non bug. Il vero problema era il crop sulla pagina evento

### 27/07/2026 (parte 3) - Fix definitivo anteprima WhatsApp/Facebook LARGE
- Vincenzo ha notato che alcuni eventi mostravano preview PICCOLO orizzontale su WhatsApp (locandina Canva 1080×1350) mentre altri (senza cover, con fallback logo società) mostravano preview GRANDE quadrato
- Causa: WhatsApp mostra preview grande solo per immagini quadrate 1:1 o 1.91:1
- Fix: endpoint `/api/preseason/public/{id}/cover.jpg` ora restituisce SEMPRE un'immagine 1200×1200 con padding bianco (locandina centrata scalata dentro il canvas). Aggiunto parametro `?raw=1` per ottenere l'immagine originale se necessario
- OG meta tag dichiarano ora `og:image:width=1200` + `og:image:height=1200` + `og:image:type=image/jpeg` (fisso invece che dinamico)
- Nota deploy: WhatsApp cachea le anteprime → prima condivisione dopo il deploy va aggiunto `?v=2` all'URL per bypassare il cache

### 27/07/2026 (parte 2) - Multi-sport Architecture + Regole FIPAV Minorenni IMPLEMENTATE

**Architettura Multi-Sport (Fase 1):**
- Nuovi campi su Society: `sport`, `federation`, `region` (con default "pallavolo"/"FIPAV")
- 12 sport di squadra supportati: pallavolo, basket, calcio, calcio_a_5, pallamano, rugby, pallanuoto, hockey, baseball, softball, football_americano, altro
- Federazioni auto-associate: FIPAV, FIP, FIGC, FIGH, FIR, FIN, FIH, FIBS, FIDAF
- Helper `is_feature_enabled(society, feature_name)` in server.py con dict `FEATURE_PRECONDITIONS`
- Migration eseguita: società esistenti → pallavolo/FIPAV
- Endpoint: `GET /societies/sports/available`, `PATCH /societies/my/sport-config`, `GET /me/feature-flags`
- Frontend: `SportConfigCard.tsx` integrato in `/admin/settings/society.tsx`

**Regole FIPAV Minorenni (Fase 2):**
- Nuovi campi su Athlete:
  - Feature A (U17): `category_championships: List[str]` (max 2), `camp3_presences_count`, `weekly_games_count`
  - Feature B (M≥2006/F≥2008): `upper_league_name`, `upper_league_presences`, `blocked_from_lower_league`
- Killswitch hardcoded `FIPAV_KILLSWITCH_DATE = "2027-03-28"` — verifica automatica lato server
- Validazioni:
  - Max 2 campionati categoria → HTTPException 400 con messaggio FIPAV
  - `upper_league_presences >= 11` → auto-blocco `blocked_from_lower_league = True`
  - Post-killswitch + ≥1 presenza → auto-blocco automatico
- Endpoint: `GET /admin/athletes/{id}/fipav-rules`, `PATCH /admin/athletes/{id}/fipav-rules`
- Protezione: entrambi tornano 400 se society non ha `sport="pallavolo" + federation="FIPAV"`
- Frontend: `FipavAthleteRulesPanel.tsx` integrato in `/admin/athlete/[id].tsx`
  - Nascosto se feature flag OFF (basket/calcio/etc → pannello scompare)
  - Filtro età visualizzato per non-eligibili (es. "atleta non soggetto a questa regola")
  - Contatori manuali +/- per presenze serie superiore, camp3, gare settimanali
  - Banner "killswitch attivo" post-28/03/2027
- Test backend end-to-end 8/8 OK (feature flags, cambio sport, blocco 2 campionati, auto-blocco 11 presenze)

### 27/07/2026 - Dichiarazione Pregresso con Firma + Fix icone + Fix crop social

#### Feature: Prior Compensation Declaration (Riforma Sport)
- **Concetto:** L'utente (atleta/coach/dirigente/collaboratore) deve dichiarare l'importo percepito da altre ASD/SSD nell'anno fiscale corrente PRIMA di accettare qualunque compenso. Firma digitale + metadati (IP/UA/timestamp). Solo admin può modificare successivamente (con storia)
- **Opzione Y:** una dichiarazione per stagione (reset al season rollover)
- Backend - 4 nuovi endpoint in `server.py`:
  - `GET /api/me/prior-compensation/status` → status dichiarazione utente
  - `POST /api/me/prior-compensation/declare` → firma dell'utente
  - `GET /api/admin/users/{user_id}/prior-compensation` → admin visualizza firma + history
  - `PATCH /api/admin/users/{user_id}/prior-compensation` → admin modifica con log storico
- Backend - Blocco 403 `PRIOR_COMPENSATION_REQUIRED` sui 3 accept-compensation endpoint (athletes, coach, dirigente)
- Backend - Helper `_require_prior_compensation_declared()` + `_get_user_or_athlete()` + `_prior_compensation_status_from_doc()`
- Backend - Reset campi firma al season rollover in `routes/seasons.py`
- Frontend - Nuovo `/app/frontend/src/components/PriorCompensationDeclarationModal.tsx` con SignaturePad + input importo + testo legale + checkbox conferma
- Frontend - Nuovo `/app/frontend/src/components/AdminPriorCompensationPanel.tsx` per admin: mostra status, firma-image, metadati IP/UA, storia modifiche + form edit con nota
- Frontend - Integrati entrambi in `CompensationSummaryCard` (prop `adminUserId` opzionale)
- Frontend - 4 pagine admin aggiornate (coach/collaboratore/dirigente/athlete)
- Nuovi campi utente: `other_annual_compensation_signed`, `_signature`, `_signed_at`, `_signed_year`, `_ip`, `_user_agent`, `_admin_history[]`
- Test backend end-to-end: 6/6 OK (status pre/post firma, 403 senza firma, declare, blocco rifirma, accept post-firma, admin edit + history)

#### Fix icone header dashboard admin
- `marginBottom: -32` → `marginBottom: 4` sulla row icone → ora interamente sopra bordo blu (non più a cavallo)

#### Fix crop immagine social preseason (WhatsApp/Facebook/Telegram)
- Problema: `og:image:width/height` hardcoded a 512×512 → crawler social croppavano male locandine rettangolari (Canva verticali)
- Fix in `server.py:32744-32775` (funzione `get_preseason_share_page`): lettura dinamica dimensioni reali con PIL, aggiunto `og:image:alt`

### 25/07/2026 - Fix Password Reset branding + Endpoint Test Email + Sensibilità Icone
- Aggiornato `send_password_reset_email` (server.py:4423) per accettare `society_id` opzionale
  - Ora usa `society.name` come From Name (invece del default "RegistraTEAM")
  - Reply-To dinamico: `society.email` OR admin owner email come fallback
- Chiamante `forgot_password` (server.py:4576) ora passa `user.society_id`
- Nuovo endpoint `POST /api/admin/test-email` (auth admin required) per verificare config Brevo con branding completo
  - Ritorna: success/provider/message_id + sender_email_configured + sender_name_used + reply_to_used
- Fix sensibilità pulsanti icone header Admin Dashboard (`/app/frontend/app/admin/index.tsx`):
  - Aggiunto `position:relative` + `zIndex:5` a `styles.header`
  - Aumentato zIndex da 10 a 20 su `styles.headerBottomIconsRow`
  - Aggiunto `cursor:pointer` su Web nel `styles.headerIconBtn`
  - Aggiunto `hitSlop={{top:10,bottom:10,left:6,right:6}}` + `activeOpacity={0.6}` alle 6 TouchableOpacity delle icone header
- DA DEPLOYARE: Save & Deploy su Render + Save su Vercel

### 23/07/2026 - Migrazione Brevo centralizzato
- Nuovo account Brevo dedicato RegistraTEAM
- Dominio `registrateam.it` autenticato su Aruba DNS: em CNAME, brevo1/brevo2._domainkey CNAME, img.em CNAME, r.em CNAME, TXT brevo-code, TXT _dmarc
- Sottodominio di tracking custom: `em` (invece del default `mail` che confliggeva con la webmail Aruba)
- Mittente `info@registrateam.it` verificato
- Backend `email_service.py` esteso con `reply_to_email`, `reply_to_name`, `sender_name` (override)
- Nuovo helper `apply_society_branding()` + `send_society_email()`
- Env vars aggiornate su Render (BREVO_API_KEY + SENDER_EMAIL)
- Test invio in locale: OK ✅ (multi-tenant separation verificato per 2 società)

### Precedente (fork)
- Fix Render 403 deploy error
- Fix Stripe test-mode label
- Season dinamica su Nexi receipts
- Bacheca Note Admin (isolata + urgent animation + priority + expiry)
- Fix rendering duplicato genitori
- ASL Umbria 1 PDF (Richiesta Visita Medico-Sportiva, A4 print)
- Riorganizzato header Admin Dashboard
- Filtro "current season" su scheduler certificati

## Backlog (in ordine di priorità)

### P1 - Regolamenti FIPAV Minorenni (RICHIESTO 25/07/2026 da Vincenzo)

#### 🆕 27/07/2026 - Necessità architettura multi-sport
Vincenzo ha giustamente notato che le regole FIPAV sono specifiche pallavolo (e forse regionali Umbria). Per un SaaS multi-sport serve un'architettura "Sport-aware":
- Nuovo campo `Society.sport` (default "pallavolo") + `Society.federation` (default "FIPAV") + `Society.region` (opzionale)
- Ogni feature specifica dichiara precondizioni sport/federation/region
- Helper `is_feature_enabled(society, feature_name)` centralizzato
- Migration: società esistenti → `sport="pallavolo"` di default
- UI settings società: dropdown Sport + Federazione + Regione (opzionale)

#### Feature A - Max 2 campionati di categoria (fino a U17)
**Norme Generali FIPAV:**
> "Nelle fasce d'età fino alla categoria Under 17 compresa, ogni atleta può giocare al massimo in 2 campionati di categoria e ogni atleta può giocare complessivamente al massimo 3 gare nell'arco della settimana (comprensive della gara del campionato di serie). Il riferimento per definire il numero di gare quotidiane o settimanali giocate è la presenza nel camp3."

**Definizione U17:** stagione 2026/2027 → 2027-17 = **nati 2010+**. Formula: `secondo anno stagione - 17`.

**Implementazione:**
- Solo atleti nati dopo (secondo_anno_stagione - 17)
- Selezione multipla campionati di categoria (max 2) — blocco al 3° tentativo
- Contatore camp3_presences_count (aggiornabile manualmente dall'admin)
- Contatore weekly_games_count max 3 (opzionale)

#### Feature B - Max 10 presenze in campionati superiori (Serie C/D/1^Div)
**Estensione Normativa 2026/2027:**
> Maschi nati 2006+: max 10 presenze in Serie C, dopo l'11ª non possono più giocare in Serie inferiore.
> Femmine nate 2008+: max 10 presenze in Serie C/D/1^Div, dopo l'11ª non possono più giocare in Serie inferiore.
> Estensione valida fino a domenica 28/03/2027 → dopo questa data l'ingresso nel campionato superiore inibisce automaticamente quello inferiore, indipendentemente dagli ingressi.

**Implementazione:**
- Campi su atleta: `upper_league_name` (Serie C/D/1^Div F), `upper_league_presences` (0-11, contatore manuale admin), `blocked_from_lower_league: bool` (True se >=11 O post-killswitch con 1+ presenza)
- Contatore manuale +1/-1 dall'admin sul profilo atleta
- Badge visivo (arancione a 10, rosso a 11)
- Cron/check killswitch 28/03/2027: marca `blocked_from_lower_league=true` per tutti gli atleti con ≥1 presenza in Serie superiore
- Reset dei contatori al season rollover (30/06)
- Banner globale post-28/03/2027 con warning killswitch

#### Piano d'implementazione a fasi (deciso 27/07/2026)
- **Fase 1** – Multi-sport base: Sport/Federation/Region su Society + UI settings + helper is_feature_enabled
- **Fase 2** – Regole FIPAV: nuovi campi atleta + pannello UI + cron killswitch
- **Fase 3** – Futuro: regole basket (FIP), regole regionali (Umbria vs altre)

### P2
- **Pagina Sponsor** `/admin/sponsor` protetta da password admin (loghi vettoriali, contratti, fatture, promemoria)
- **GitHub Branch Cleanup**: eliminare ~255 branch `conflict_*` stale

### P3
- **Stripe Payments History**: pannello admin con filtri (data/status/atleta) + CSV export
- **Report Rimborsi**: pannello dedicato con motivo + admin che ha effettuato rimborso
- **Admin "Igiene Dati"**: pannello read-only per anomalie (CF mancanti, orfani, CF duplicati)
- **Render Cold Starts & RAM**: cursor pagination, projections, lazy imports in `server.py`
- **DKIM Brandizzato**: verificare che dopo 24h Brevo passi da "Predefinito" a `registrateam.it`

### Refactoring
- Spezzare `/app/backend/server.py` (~35k righe) in `routes/`

## Known Issues / Recurring
- Multi-tenancy query leakage: verificare `society_id` in ogni query
- Season Rollover: hardcoded season checks che nascondono utenti/atleti in transizione
- Render RAM 502 Bad Gateway: cold start + memoria limitata

## Testing Credentials
Vedi `/app/memory/test_credentials.md`

## Files of Reference
- `/app/backend/email_service.py` (aggiornato 23/07/2026)
- `/app/backend/routes/admin_notes.py`
- `/app/backend/routes/stripe_payments.py`
- `/app/backend/routes/recurring_payments.py`
- `/app/backend/routes/parents.py`
- `/app/backend/server.py`
- `/app/frontend/app/admin/notes.tsx`
- `/app/frontend/src/components/AdminNotesButton.tsx`
- `/app/frontend/src/utils/medicalVisitRequest.ts`
- `/app/frontend/src/utils/fiscalReceipt.ts`
