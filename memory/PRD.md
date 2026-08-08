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

### 01/08/2026 (parte 8) - Menu campionati raggruppato + nascondi FIPAV per coach minivolley
- **Menu a tendina raggruppato (`FipavAthleteRulesPanel.tsx`)**: nel Registro Presenze il selettore campionato ora mostra due gruppi con intestazioni: "── Campionati di Serie ──" (Serie C, Serie D, 1^ Divisione, **2^ Divisione**) e "── Campionati di Categoria ──" (Under 12/13/14/15/17/19). Le intestazioni (value `__hdr_*`) non sono selezionabili. Eventuali campionati extra dal calendario compaiono sotto "── Altri (da calendario) ──". Classificazione invariata: solo Serie C/D/1^ Divisione contano come Serie Superiore; 2^ Divisione e Under → categoria (contano solo per le 3 gare settimanali).
- **Nascondi FIPAV per coach minivolley**: nella vista coach (`coach/athlete/[id].tsx`, readOnly) il pannello Regole FIPAV ora si nasconde del tutto se l'atleta non è soggetto ad alcuna regola (`!eligibleUpperLeague && !eligibleU17`) — così i coach del minivolley (bimbi troppo piccoli, sempre non soggetti) non vedono regole irrilevanti. In vista admin resta visibile (con "non soggetto") per supervisione.
- **VERIFICATO**: screenshot del menu raggruppato (13 voci corrette). Guard minivolley = conditional a basso rischio in readOnly.
- **DA FARE (in attesa conferma utente)**: regola "max 2 campionati di categoria" con blocco automatico quando un atleta più piccolo gioca in una categoria superiore (es. U13 che gioca U17 → U13+U17 diventano i suoi 2 campionati, bloccando U14/U15). Da definire comportamento (blocco vs avviso) prima di implementare.
- **NOTA DEPLOY**: "Save to Github" → Vercel (solo frontend).

### 01/08/2026 (parte 7 + REVERT) - Classificazione Serie Superiore: modifica ANNULLATA
- Avevo modificato la classificazione per far contare "Prima Divisione Femminile" come Serie Superiore. **ERRORE di dominio**: per Ametista Giulia la 1ª Divisione è il SUO campionato (categoria), non una serie superiore. Contarla come superiore era sbagliato.
- **REVERT**: ripristinata la classificazione originale a corrispondenza esatta (`championship in {"Serie C","Serie D","1^ Divisione"}`). Rimosse `classify_fipav_level` e `_recompute_levels` (0 riferimenti residui).
- **Comportamento corretto ripristinato** (verificato via curl): "Prima Divisione Femminile" → CATEGORIA (non incrementa Serie Superiore); "Serie D" → Serie Superiore. Solo le serie scelte esplicitamente dal menu (Serie C/D/1^ Divisione) contano come superiori.
- Rimosso il test file obsoleto `test_fipav_classify_level.py`. Nessuna modifica frontend.

### 01/08/2026 (parte 6) - Calendario Gare collassabile + filtro 3-vie
- **Richiesta**: la lista gare nella card "Calendario Gare" diventava troppo lunga e copriva le altre info (spingendo in basso il pannello Regole FIPAV, Squadra, Statistiche).
- **Fix (`AthleteMatchesCard.tsx`)**: la card è ora **collassabile** (collassata di default, header con pill del conteggio + chevron toggle, testID `athlete-matches-toggle`) e ha un **filtro a 3 vie**: "Da giocare" (gare future), "Giocate" (gare passate, più recenti prima), "Totale" (tutte). La sezione link "Calendario Federazione" resta sempre visibile anche a card collassata. Export .ics invariato. Vale per vista atleta (`/athlete/presenze`) e vista admin (tab Presenze).
- **Chiarimento posizione info FIPAV**: nella vista admin il pannello "Regole FIPAV" (con "Presenze in Serie Superiore X/10" e "Gare nella settimana max 3") è IN CIMA alla tab Presenze, sopra il Calendario Gare (verificato: index 70 vs 969). Le info non sono sparite; erano solo spinte in basso dalla lista gare lunga. Il pannello si nasconde (return null) solo se la feature `fipav_minor_rules` è disattivata per la società o se l'atleta non è caricato.
- **VERIFICATO testing agent (iteration_90): 5/5 PASS** su vista atleta e admin.
- **NOTA DEPLOY**: "Save to Github" → Vercel (solo frontend).

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


- **01/08/2026** — Fix UI da segnalazioni utente (3 foto), testato al 100% (iteration_92):
  - Rimosso testo segnaposto "In arrivo: riepilogo lavoro stagione (obiettivi, statistiche, ruolo)" dalle schede admin Coach/Collaboratore/Dirigente (`app/admin/coach/[id].tsx`, `collaboratore/[id].tsx`, `dirigente/[id].tsx`).
  - `AdminCoachCommitments.tsx`: aggiunto pulsante "Riprova" (testid `retry-commitments-btn`) + retry automatico (1 tentativo, gestisce cold start Render) per l'errore "Impossibile caricare gli impegni"; aggiunti badge ATL/COACH anche nella sezione "Successivi".
  - `CompensationSummaryCard.tsx`: box base "Pregresso dichiarato" (`pregresso-dichiarato-box`) ora nascosto in vista admin (`adminUserId` presente) — resta solo il pannello firmato `AdminPriorCompensationPanel` per evitare l'informazione doppia.

- **01/08/2026** — Storico Pagamenti Admin (contabilità), testato al 100% (iteration_93):
  - Nuovo router `routes/payments_history.py` → `GET /api/admin/payments/history` con filtri `date_from`/`date_to`/`status`/`method` e totali (movimenti, incassato, rimborsato). Stato derivato: paid/partial/pending/unpaid/refunded. Isolamento multi-tenant per `society_id` + atleti della società.
  - Nuova pagina `app/admin/payments-history.tsx`: filtri stato/metodo (chip), preset periodo (Tutto/Anno/Questo mese), date manuali, ricerca atleta client-side, riepilogo e **export CSV** (separatore `;`, BOM per Excel IT) dei movimenti filtrati.
  - Card di navigazione "Storico Pagamenti" nella dashboard admin (`app/admin/index.tsx`).
  - NB: il preview è servito come **build statico** (`npx serve -s dist`) → dopo modifiche frontend serve `npx expo export -p web --clear` + `sudo supervisorctl restart expo`.

- **01/08/2026 (b)** — Fix visibilità pannello Regole FIPAV (`FipavAthleteRulesPanel.tsx`):
  - Prima il pannello si nascondeva solo in vista coach (`readOnly`) per atleti non soggetti a regole FIPAV; l'admin lo vedeva comunque. Ora la condizione `if (!eligibleUpperLeague && !eligibleU17) return null;` vale in TUTTE le viste. Così l'admin non vede più il regolamento per atleti non soggetti (es. GUARINO GIADA nata 2000 atleta B1 + coach Minivolley; bimbi minivolley). Gli atleti idonei (minori nelle fasce M≥2006/F≥2008 o U17 nati≥2010) continuano a vedere il pannello.

- **01/08/2026 (c)** — Soglie FIPAV rese RELATIVE ALLA STAGIONE (non più hardcoded):
  - Backend `GET /api/admin/athletes/{id}/fipav-rules` ora calcola e ritorna `season` + oggetto `eligibility` con `upper_league_min_year_male` (=anno2 stagione −21), `upper_league_min_year_female` (−19), `u17_min_year` (−17) e i flag `is_eligible_upper_league`/`is_eligible_u17`. Per 2026/2027 → M≥2006, F≥2008, U17≥2010; scalano automaticamente ogni stagione (fonte stagione: `get_current_season_for_society`). Verificato via curl.
  - `FipavAthleteRulesPanel.tsx` ora usa questi valori/flag dal backend (con fallback ai valori 2026/2027) sia per l'eleggibilità sia per i testi descrittivi (anni e stagione dinamici). Il pannello resta nascosto per atleti non soggetti in tutte le viste.
  - Nota: `killswitch_date` (28/03/2027) resta un valore backend specifico della norma di questa stagione; il testo UI ora lo legge da `state.killswitch_date`.

- **01/08/2026 (d)** — Report Rimborsi Stripe (admin), backend verificato via curl:
  - `GET /api/admin/payments/refunds` (in `routes/payments_history.py`): appiattisce `refunds_log` di tutti i pagamenti della società in righe {data, atleta, squadra, descrizione, importo, motivo, admin}. Fallback legacy da `last_refund_*`. Filtro `date_from`/`date_to`. Totali (conteggio + totale rimborsato).
  - Nuova pagina `app/admin/refunds-report.tsx`: preset periodo, ricerca atleta client-side, riepilogo ed **export CSV**. Card di navigazione "Report Rimborsi" in dashboard admin.

- **01/08/2026 (e)** — Vista tecnica coach (`app/coach/athlete/[id].tsx`): aggiunta **data di nascita** sotto il nome (🎂 gg/mm/aaaa · N anni) e nuova card **📊 Statistiche Presenze** (totali/mese/settimana con %, + gare giocate). Backend `GET /athletes/{id}/technical-data` ora ritorna `date_of_birth` (già c'era) e un oggetto `stats` (presenze da `attendances` + `game_presences`), riusando la logica di `my-stats`. Verificato via curl.

- **02/08/2026** — Fix email documento GDPR firmato (`send_document_email` in `server.py`):
  - Bug: la copia di notifica all'admin mostrava come nome destinatario il FIRMATARIO (es. "GUARINO GIADA ANGELA") pur andando all'email dell'admin, perché `to_name` era sempre = `signer_name`.
  - Fix: aggiunti parametri `to_name` e `is_admin_copy`. La copia admin ora usa il nome dell'admin come destinatario e il testo "È stato firmato un nuovo documento da <firmatario>". La copia al firmatario resta invariata (al suo indirizzo, con il suo nome). Verificato: syntax OK + backend reload pulito.

- **03/08/2026** — Tre aggiustamenti richiesti dall'utente (backend verificati via curl):
  1. **Email GDPR firmate → email società anagrafica**: nel flusso post-firma (`server.py`), la copia istituzionale ora va a `settings.email` (email società in anagrafica, es. siriovolley@gmail.com) invece che alle email personali degli admin. La copia al firmatario resta al proprio indirizzo. Fallback: `settings.society_email` → `societies.email`.
  2. **Consensi immagine → anche staff**: `GET /admin/athletes/image-consents` ora aggiunge gruppi "Staff · Coach / Dirigenti / Collaboratori" (consensi da `users.consents`), oltre agli atleti. Frontend `image-consents.tsx`: navigazione corretta per staff (`/admin/coach|dirigente|collaboratore/{id}`) e pulsante "notifica coach" nascosto per gruppi staff.
  3. **Collaboratori nelle squadre**: nuovo `GET /users/collaboratori`, `POST /teams/{id}/assign-collaboratori`, `collaboratori_info` in team detail. Frontend `team/[id].tsx`: sezione selezione (edit) e visualizzazione (view) collaboratori, in aggiunta a coach e dirigenti.
  - Rimosso endpoint "resend-email" abbandonato (feature scartata dall'utente).

- **03/08/2026 (bugfix)** — Fix registrazione atleti: privacy MAI accettata alla registrazione per i MINORENNI (verrà firmata a fine prova); maggiorenni invariati. Testato al 100% (iteration_94, backend 2/2 + frontend).
  - Backend `create_athlete` (POST /api/athletes): branch `is_minor` forza `privacy_accepted=False`, `consent_privacy_viewed=False`, consensi immagine `None`, status `pending_trial`. Maggiorenni: valori dal client (comportamento originale).
  - Frontend `register-athlete.tsx`: rendering condizionale su `isMinorAthlete` (da data nascita GG/MM/AAAA) — minore→box "periodo di prova" senza checkbox privacy; maggiorenne→sezione consensi con "presa visione" obbligatoria.
  - Backlog confermato (opzione B, rimandata): macchina a 6 stati completa (IN ATTESA → IN ATTESA D'INIZIO PROVA solo dopo validazione certificato admin + gate QR → IN PROVA → ATTIVO dopo firma privacy).

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


## Changelog — 08/08/2026 (fork continuazione)
### 1) Certificati in scadenza (dashboard) — mostra i NOMI
- `admin/index.tsx`: il task "Certificati in scadenza" (Da fare oggi) ora apre un popup con i nomi atleti + giorni alla scadenza (prima apriva solo la lista atleti).

### 2) Sezione "Da controllare" (admin/athletes) — pulsante "✓ Controllato" + logica onboarding
- Nuova logica `needsReview`: un atleta resta in "Da controllare" per tutto l'onboarding (senza squadra / pending* / trial non ancora avviato); esce solo quando è pienamente ATTIVO o Ritirato.
- Risolto: atleta 18+ accettato (status trial senza squadra) prima finiva nell'elenco alfabetico e "spariva"; ora è correttamente in "Da controllare".
- Pulsante "✓ Controllato" per squadra corrente: `PATCH /api/athletes/{id}/dismiss-review` (+ `restore-review`). Campo `review_dismissed_season`.

### 3) CERTIFICATO MEDICO — blocco onboarding (Riforma/FIPAV)
Scelte utente: domanda "già tesserato" SOLO per minorenni; adulti = certificato SEMPRE obbligatorio; blocco VERO; tipo per squadra.
- **Squadra**: nuovo campo `certificate_type_required` ∈ {`none`,`buona_salute`,`agonistico`} (default agonistico). Modelli in `backend/models/team_models.py` (Team/TeamCreate/TeamUpdate) — NB: i router usano QUESTI modelli, non i duplicati in server.py. UI selettore in `admin/teams.tsx` (creazione) e `admin/team/[id].tsx` (modifica).
- **Registrazione minore** (`parent/register-athlete.tsx` → `POST /api/athletes`): domanda obbligatoria "Ha già giocato a livello agonistico o è già tesserato/a?" → campo `already_registered`.
- **Helper** (`server.py` ~riga 834): `cert_type_for_team`, `has_valid_verified_cert`, `cert_required_for_trial`, `cert_required_for_active`.
- **Gate 1 (inizio prova)**: alla registrazione minore / approvazione adulto, se serve il cert e non è convalidato → status `pending_certificate` (ATTESA). QR scan blocca finché non è `pending_trial`.
- **Avanzamento**: `POST /api/certificates/simple` con verified=true su `pending_certificate` (expiry futura) → `pending_trial`.
- **Gate 2 (tesseramento)**: `POST /api/trial/accept-privacy/{id}` blocca con HTTP 400 se manca cert valido convalidato e la squadra lo richiede.
- Verificato: 10/10 pytest `backend/tests/test_certificate_gate_onboarding.py`.

### Note tecniche
- RN Web propaga solo `testID` (non `data-testid` grezzo) su TouchableOpacity/View/Text.
- Preview = build statico Expo: dopo modifiche frontend `cd /app/frontend && rm -rf dist && npx expo export -p web && sudo supervisorctl restart expo`.
