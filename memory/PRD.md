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

### 01/08/2026 (parte 5) - Link calendario federazione per atleta + rimozione duplicazione
- **Atleta nazionale (Serie A/B) — link calendario FIPAV**: gli atleti dei campionati nazionali non hanno gare importabili automaticamente, quindi la card "Calendario Gare" restava vuota. Ora la card mostra una sezione "📅 Calendario ufficiale FIPAV" con un pulsante "Calendario Federazione — <squadra>" che apre il `calendar_link` della squadra (lo stesso link che l'admin imposta sulla scheda squadra). Backend: `GET /athletes/{id}/matches` ora restituisce anche `teams: [{id, name, calendar_link}]`. Frontend: `AthleteMatchesCard` mostra i bottoni per i team con `calendar_link`.
- **Rimozione duplicazione "Calendario Gare"**: la card era presente sia in "Da fare" (`app/athlete/index.tsx`, aggiunta il 31/07) sia in "Presenze" (`app/athlete/presenze.tsx`). Rimossa da "Da fare"; resta solo in "Presenze" (sede naturale accanto a Orari Allenamenti e Statistiche). "Da fare" mantiene "Prossimi Impegni" e "Mappa Palestre".
- **VERIFICATO testing agent (iteration_89): 6/6 check PASS** — card assente in Da fare, presente 1 sola volta in Presenze, sezione FIPAV con bottone cliccabile, regressione 54 gare + Esporta .ics OK.
- **NOTA**: convertiti data-testid→testID in `AthleteMatchesCard`. Deploy: "Save to Github" → Vercel (frontend) + Render (backend, per la risposta `teams`).
- Nota tecnica: warning console pre-esistenti in `_layout.tsx` su route inesistenti (preseason, whatsapp-*) — solo noise, non bloccante.

### 01/08/2026 (parte 4) - Registro presenze da calendario reale + PDF Riepilogo FIPAV
- **Scelta gara dal calendario (`FipavAthleteRulesPanel.tsx`)**: nel form "Registro Presenze Gara" aggiunto un menu "Scegli dal calendario" che elenca le gare reali dell'atleta (da `GET /athletes/{id}/matches`, con nome squadra da `/teams`). Selezionando una gara si compilano automaticamente la **data** e il **campionato** (niente più digitazione manuale della data; resta comunque possibile inserire a mano). Il livello (Serie superiore/Categoria) è dedotto lato backend dal nome campionato.
- **PDF Riepilogo Presenze FIPAV (`src/utils/fipavPresencesReport.ts`)**: nuovo bottone "Stampa PDF" nel pannello. Genera un documento stampabile A4 con intestazione, dati atleta, card riepilogo (Serie superiore X/10, max gare/settimana N/3, ingressi totali), tabella datata degli ingressi (data + campionato + tipo), avvisi violazioni/blocco e le norme di riferimento. Pattern print identico a `medicalVisitRequest.ts` (window.open+print su web, expo-print su mobile). Disponibile anche in sola lettura (coach).
- **VERIFICATO end-to-end** (playwright/screenshot): selezione gara → data auto-compilata (18/05/2026, Under 14) → ingresso aggiunto con badge CATEGORIA e conteggi aggiornati (settimana 1/3, camp3 1); stampa → HTML report generato con titolo e nome atleta corretti.
- **NOTA DEPLOY**: "Save to Github" → Vercel (solo frontend, nessuna modifica backend).

### 01/08/2026 (parte 3) - Fix segnalati (foto 1/2/3) + etichette FIPAV
- **Foto 1 — Pregresso in sola lettura (admin)**: il campo "Compensi Pregressi Dichiarati (€)" nei profili admin di **coach, collaboratore e dirigente** non è più editabile dall'admin. Ora è un box in sola lettura con testo lucchetto "🔒 Dichiarato e firmato dal ... nel proprio profilo. L'admin può solo visualizzarlo, non inserirlo". Rimosso `other_annual_compensation` dai payload di salvataggio admin (il backend usa `if key in data`, quindi non azzera). Il pregresso resta gestito dalla dichiarazione firmata dell'interessato.
- **Foto 2/3 — Assegnazione squadre dal profilo non visibile nell'elenco**: root cause = `coaches.tsx` usava `useEffect([])` (caricamento solo al mount), quindi tornando dal profilo dopo "Salva Squadre" l'elenco restava stale; il menu 3-puntini invece ricaricava. Fix: `coaches.tsx` ora usa `useFocusEffect` → ricarica al focus. Entrambi i path (profilo `/users/{id}/assigned-teams` e 3-puntini `/users/{id}/teams`) scrivono lo stesso campo `assigned_teams`.
- **Etichette FIPAV**: rimosse le diciture tecniche "Feature A/B". Sezioni rinominate in "Regola Serie Superiore (Serie C / D / 1ª Div)" e "Regola Campionati di Categoria (fino a U17)" con descrizione della norma sotto ciascun titolo (soglie, fasce d'età, killswitch).
- **Testabilità**: convertiti i `data-testid` → `testID` sui componenti RN in coach/collaboratore/dirigente/coaches + FipavAthleteRulesPanel (RN-Web emette `data-testid` nel DOM solo via `testID`). Aggiunti testID per aprire la modalità modifica Compensi.
- **VERIFICATO dal testing agent (iteration_88): 5/5 flussi PASS**, incluso il flusso squadre esercitato end-to-end (assegna dal profilo → visibile nell'elenco al ritorno).
- **NOTA DEPLOY**: "Save to Github" → Vercel (frontend). Nessuna modifica backend in questa parte.

### 01/08/2026 (parte 2) - Registro Presenze Gara DATATO (FIPAV) — anti doppio conteggio
- **Requisito (Vincenzo)**: i contatori +/- delle presenze in Serie Superiore e gare/settimana non avevano riscontro con la data → due admin potevano contare due volte lo stesso ingresso. Serviva registrare data + squadra/campionato di ogni ingresso.
- **Regolamento verificato** sul PDF ufficiale "Indizione Campionati FIPAV Umbria 2026/2027" (caricato dall'utente): max 2 campionati categoria (U17), max 3 gare/settimana (rif. camp3), Serie superiore M2006+/F2008+ max 10 presenze → blocco 11ª, killswitch 28/03/2027. Sanzioni violazione: perdita gara (0-3), sospensione 7gg Presidente, multa €100.
- **Scelte utente**: registro UNICO datato che alimenta sia Serie superiore che gare settimanali (Aa); blocco totale max 1 gara/giorno (Ba); azzeramento contatori vecchi e ripartenza pulita (Cb); settimana Lunedì→Domenica (Da).
- **Backend (`server.py`)**: nuovo campo athlete `game_presences[]` (id, date, championship, level upper/category, added_by, created_at). Endpoint `POST /admin/athletes/{id}/fipav-presences` (blocca data duplicata) e `DELETE /admin/athletes/{id}/fipav-presences/{entry_id}`. `get_athlete_fipav_rules` ora DERIVA upper_league_presences, camp3 totali e il conteggio per settimana (con `weekly_summary.violation_weeks` per superamenti max 3). Blocco automatico all'11ª presenza + post-killswitch persistiti.
- **Frontend (`FipavAthleteRulesPanel.tsx`)**: rimossi i contatori +/-. Nuova sezione "Registro Presenze Gara (camp3)" con form (data mascherata GG/MM/AAAA + picker campionato: Serie C/D/1ªDiv + campionati categoria dell'atleta) e lista ingressi datati con badge SERIE SUP./CATEGORIA e cestino. Feature B mostra Serie Superiore X/10 derivato; Feature A mostra "Max in una settimana N/3" con avviso rosso sulle settimane in violazione. Banner sanzioni FIPAV aggiunto.
- **Verificato**: curl (add upper/category, blocco data duplicata 400, rilevamento violazione 4 gare/settimana, delete con ricalcolo) + screenshot UI. Rebuild frontend eseguito.
- **NOTA DEPLOY**: "Save to Github" → Vercel (frontend) + deploy Render (backend).

### 01/08/2026 - FIX calendario atleta "0 gare" + semplificazione import Nazionale
- **Bug (segnalato da Vincenzo)**: la card "Calendario Gare" mostrava 0 gare per l'intera stagione sia lato 18+ PRO che Under 18
  - **Root cause**: la data server è 08/2026 (stagione 2025/2026 conclusa, ultima gara 18/05/2026). La card chiedeva `only_upcoming=true` → 0 gare future in bassa stagione. Inoltre il filtro `society_id` escludeva le gare legacy importate senza `society_id`
  - **Fix Frontend (`src/components/AthleteMatchesCard.tsx`)**: rimosso `only_upcoming=true`. Se ci sono gare future le mostra; altrimenti mostra il calendario completo della stagione (più recenti prima) con sottotitolo "Calendario completo delle gare della stagione". Export .ics invariato (tutte le gare)
  - **Fix Backend (`server.py` `/athletes/{id}/matches`)**: il filtro society_id ora include anche gare con `society_id` nullo/mancante (legacy). Sicuro perché `team_id` è già scoped per società
  - **Verificato**: endpoint ritorna 54 gare (era 0 con only_upcoming), card mostra la lista completa + "Esporta .ics" + "Vedi tutte (54)"
- **Import Nazionale (Serie A/B) semplificato (`app/admin/import-calendar.tsx`)**: su decisione utente, rimosso il flusso società-testo-libero + girone + anteprima (che portava sempre a 0 partite). Ora lo Step 2 in modalità Nazionale mostra un pannello informativo chiaro ("Calendario Serie A/B non importabile automaticamente") + istruzioni per incollare il link del calendario federale sulla scheda squadra + bottone "Vai alle Squadre". Bottone "Anteprima" nascosto in modalità Nazionale
- **NOTA DEPLOY**: modifiche frontend richiedono "Save to Github" → Vercel; modifica backend richiede deploy su Render

### 31/07/2026 (parte 4) - Calendario Gare direttamente sulla Dashboard Atleta + hint Nazionale
- **Requisito**: l'atleta 18+/PRO segnalava di "non trovare da nessuna parte" il calendario. Era presente solo dentro la tab "Presenze" → poco visibile
- **Fix (`app/athlete/index.tsx`)**: aggiunto import + rendering di `<AthleteMatchesCard>` direttamente sulla dashboard principale, subito dopo la sezione "Prossimi Impegni". Ora l'atleta vede la card "Calendario Gare" con bottone "Esporta .ics" (o messaggio "Nessuna gara programmata") immediatamente all'apertura
- **Fix Step 3 wizard Nazionale (`app/admin/import-calendar.tsx`)**: quando l'admin è in modalità Nazionale e la preview trova 0 partite, ora mostriamo un banner giallo esplicativo (⚠️ Import automatico non disponibile per il Nazionale) con 3 alternative concrete (aggiunta manuale, link calendario federale sul team, consulta federvolley.it)
- Rebuild frontend eseguito. Nota: preview usa static build; la produzione (registrateam.it, Vercel) si aggiorna dopo push su GitHub

### 31/07/2026 (parte 3) - Calendario gare + export ICS anche per Minorenne (Lite login)
- **Requisito**: le atlete under 18 (login Lite `nome_lite` + PIN) non vedevano né potevano esportare il calendario delle proprie gare
- **Backend (`server.py` `/athletes/{id}/matches`)**: aggiunta autorizzazione per `role="minor"` quando `athlete_id` del token corrisponde all'atleta richiesto. Copre sia JSON che ICS
- **Frontend (`app/minor/index.tsx`)**: aggiunto `<AthleteMatchesCard>` sotto "Prossime Partite" — mostra lista completa gare future + bottone "Esporta calendario (.ics)"
- Test E2E via curl con token JWT minor: JSON 200 OK, ICS 200 OK con `content-type: text/calendar; charset=utf-8`
- Rebuild frontend eseguito

### 31/07/2026 (parte 2b) - Fix input date su Step 3 wizard import calendario
- **Bug**: i campi "Da:" e "A:" del filtro date erano preinizializzati a `__/__/____` e con `maxLength={10}` il campo era già pieno → impossibile digitare
- **Fix (`import-calendar.tsx`)**: `dateFrom`/`dateTo` ora partono da stringa vuota; il placeholder mostra la maschera. `handleDateMask` costruisce la maschera dinamicamente durante la digitazione. Il filtro applica solo se la data è completa (10 caratteri `gg/mm/aaaa`)

### 31/07/2026 (parte 2) - Import Calendario Federazione: Nazionale + Girone
- **Fix 1 (Backend `federation_scraper.py`)**: `_current_national_seasons()` ora ritorna 4 stagioni includendo la **prossima** (es. a Luglio 2026 → `Stagione 2026/2027`, 2025/2026, 2024/2025, 2023/2024). Serve all'admin per preparare l'import prima dell'inizio del campionato
- **Fix 2 (Frontend `import-calendar.tsx`)**: modalità Nazionale dedicata su Step 2:
  - **Società**: input testo libero (federvolley.it è una SPA non scrapabile) con hint esplicativo
  - **Girone**: picker con opzioni (Girone Unico / A / B / C / D / E / F / G / H) + hint "Serie A1/A2/A3: Girone Unico. Serie B / B Interregionale: lettera del girone"
  - Bottone "Anteprima" disabilitato finché società (testo libero) + girone sono entrambi valorizzati
- **Persistenza (`server.py` `/federation/preferences`)**: salva `national_society_name` + `girone` sui prefs della società. Al reload del wizard vengono ripristinati
- **Rebuild frontend**: eseguito `npx expo export --platform web` per aggiornare `/app/frontend/dist` (in preview i cambiamenti frontend richiedono rebuild static)
- Testato E2E via screenshot: Step 1 mostra 4 stagioni compresa 2026/2027, Step 2 mostra input libero + picker girone come richiesto

### 31/07/2026 (P2) - Auto-attivazione Atleti 18+ PRO alla validazione certificato medico
- **Requisito**: Gli atleti 18+ PRO (`athlete_type='compensated'`) sono già stati "scelti/acquistati" per la stagione → NO periodo di prova. Alla validazione del certificato medico da parte dell'admin, devono passare direttamente a `status='active'`
- **Fix Backend (`/app/backend/server.py`)**: dopo la logica esistente `check_and_activate_if_ready` per il flusso end-trial, aggiunta condizione: se `current_user.role == ADMIN` AND `verified == True` AND `athlete_type == 'compensated'` AND stato non è già `active/blocked` → aggiorna `status = 'active'`, `is_trial = False` + traccia `activated_at/activated_by/activated_by_name`. Restituito `athlete_activated: true` nel response
- **Fix Frontend (`/app/frontend/app/admin/athlete/[id].tsx`)**: `handleVerifyCertificate` e `handleSaveCertificate` ora leggono `response.data.athlete_activated` e mostrano un messaggio dedicato "Atleta 18+ PRO attivato automaticamente (nessun periodo di prova)"
- **Test end-to-end via curl**:
  - PRO (`athlete_type=compensated`, `status=pending`) → dopo validazione: `status=active`, `activated_by_name` popolato ✅
  - QUOTA (`athlete_type=quota`, `status=pending`) → dopo validazione: `status=pending` (invariato) ✅ (no auto-activation)

### 31/07/2026 (P0) - Fix accettazione compenso 0€ per Atleti 18+ PRO
- **Problema**: gli atleti 18+ PRO (`athlete_type='compensated'`) senza compenso attivo dalla società (monthly_compensation=0) non riuscivano a vedere il pulsante "Accetta Compenso" perché la card era nascosta dal guard `monthly_compensation > 0`. Di conseguenza non potevano dichiarare il pregresso (obbligo Riforma Sport)
- **Fix Frontend (`/app/frontend/src/components/compensation/CompensationSummaryCard.tsx`)**: aggiunta prop `allowZeroCompensation`. Quando true, la sezione "Compenso Accettato" (badge stato o pulsante di accettazione) è visibile anche con compenso 0€. Il pulsante mostra "Conferma e Dichiara Pregresso" con banner esplicativo dedicato invece di "Accetta Compenso €0,00"
- **Fix Frontend (`/app/frontend/app/athlete/compensation.tsx`)**: guard esteso a `(monthly_compensation > 0 || athlete_type === 'compensated' || is_compensated)`, così la card è visibile anche per PRO a 0€. Passa `allowZeroCompensation` automaticamente
- **Fix Frontend (`/app/frontend/app/admin/athlete/[id].tsx`)**: passa `allowZeroCompensation` in `CompensationSummaryCard` (già in `readOnly`), così l'admin vede lo stato "✓ Sì / ✗ No" anche per PRO a 0€
- **Backend**: nessuna modifica necessaria — `PATCH /auth/me` con `compensation_accepted: true` non richiede monthly_compensation > 0. La verifica pregresso resta gestita da `_require_prior_compensation_declared` prima di accettare
- Testing: curl PATCH `/auth/me` verificato (200 OK), lint pulito, smoke screenshot OK

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

## Changelog recente
- **27/07/2026** — Bacheca Note Admin: aggiunto flag "In corso" (stato intermedio tra "Presa in carico" e "Fatto"). Nuovo endpoint `POST /admin/notes/{id}/in-progress` (toggle). Fields nuovi su `admin_notes`: `in_progress`, `in_progress_by`, `in_progress_by_name`, `in_progress_at`. Checkbox arancione dedicato nel componente `AdminNotesBoard.tsx`. Al "Fatto" il flag viene resettato automaticamente.
- **27/07/2026** — Fix PDF/QR nome società mancante:
  - Aggiunto `society_id` + `signer_name` alle scritture `signed_documents` per Coach, Dirigente, Collaboratore, Threshold Declaration (coach) e signed document generico. Prima erano solo su Athlete Pro (fix 27/07) e GDPR/trial.
  - QR verify `/api/documents/verify/{id}`: widening projection a `dirigente_name`/`collaboratore_name`/`athlete_name` e fallback multi-id lookup (`signer_id → coach_id → dirigente_id → collaboratore_id → athlete_id`) su `users`/`athletes` per risalire alla società anche su documenti legacy senza `society_id`. Nessun fallback cross-tenant globale (evita leak Pallavolo Perugia).
  - Query settings ora legge anche il campo `name` (era solo `ragione_sociale`/`society_name`).


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
