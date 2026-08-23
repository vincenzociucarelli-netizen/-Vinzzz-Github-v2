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

## Changelog — 22/08/2026 (5) — Pulsante WhatsApp genitori mancante su alcuni (fallback telefono da scheda atleta)
### Bug (segnalato)
- Nel dettaglio Genitore il pulsante WhatsApp compariva solo per alcuni, pur avendo il numero.
### Root cause
- `GET /users/parents` restituiva solo `user.phone`. Alcuni genitori hanno il numero salvato solo sulla scheda ATLETA (`phone_father`/`phone_mother`), non sul record utente → `phone` vuoto → pulsante nascosto (condizionato a `selectedParent.phone`).
### Fix (server.py)
- Esteso il fetch degli atleti attivi con `phone_father/phone_mother/phone/phone_athlete` e costruita mappa `parent_id → telefono famiglia`. Nel risultato: `phone = user.phone (se presente) altrimenti telefono dal record atleta collegato` (padre→parent_id, madre→second_parent_id, con fallback incrociato). Nessuna modifica frontend.
### Verifica (curl)
- Genitore RASCI ARMANDA (user.phone=None, atleta MAURI LENA phone_father) → API ora restituisce 3393216547. Su 24 genitori in stagione: 0 senza telefono (prima 8 vuoti). Migliora anche la ricerca per telefono.
### Deploy
- Solo backend.


## Changelog — 22/08/2026 (4) — FIPAV Fase 1: categorie ammesse per età (femminile) + validazione 2 campionati
### Richiesta utente
- Regola FIPAV "2 campionati di categoria": prima fase → mostrare le categorie ammesse per età e validare che i 2 campionati scelti siano ammessi. Solo SETTORE FEMMINILE (l'utente usa solo il femminile).
### Implementazione (server.py)
- Tabella `FIPAV_FEMALE_CATEGORY_AGE_OFFSETS` (U12..U19) con offset relativi al 2° anno di stagione (fasce NON derogabili, scalano +1 ogni stagione). Es. 2026/2027: U12=2015-16, U13=2014-16, U14=2013-15, U15=2012-15, U17=2010-13, U19=2008-11.
- Helper `_fipav_eligible_categories(birth_year, gender, season_year2)` (solo femminile in Fase 1) e `_fipav_category_from_label`.
- `GET /admin/athletes/{id}/fipav-rules`: nuovo campo `eligible_categories`.
- `PATCH .../fipav-rules`: oltre a max 2, valida che ogni campionato di categoria scelto (pattern "Under NN") sia tra le categorie ammesse per età → 400 con messaggio chiaro se non lo è.
### Frontend (`src/components/FipavAthleteRulesPanel.tsx`)
- Box blu "Categorie ammesse per età" (es. "Under 15 · Under 17").
- Validazione client in `addCategoryChampionship` (blocca categorie non ammesse prima del salvataggio).
### Verifica (curl + screenshot)
- 2012 F, stagione 2026/2027 → eligible = Under 15, Under 17 (coincide col caso reale). PATCH "Under 14" → 400; "Under 15/17" → 200; 3 categorie → 400. Box visibile nel tab Presenze. Dati di test ripristinati.
### Note
- Fase 2 (lock automatico via distinte/camp3) e settore MASCHILE rimandati (upgrade futuro), come concordato.
### Deploy
- Frontend + backend.


## Changelog — 22/08/2026 (3) — Dati bancari dual-role (atleta 18+ PRO ↔ coach)
### Richiesta utente
- Applicare ai dati bancari lo stesso collegamento tra profili Atleta e Coach usato per i consensi.
### Contesto
- Esisteva già il verso coach→atleta (il GET utente coach eredita i dati bancari dall'atleta collegato). Mancava il verso opposto per la nuova card "Dati Bancari" nella scheda Atleta.
### Fix (server.py, GET /athletes/{id})
- Se i campi bancari dell'atleta (iban/bank_name/account_holder/iban_holder) sono vuoti e l'atleta ha `linked_coach_user_id` (o esiste uno staff con `linked_athlete_id` = atleta), eredita iban/bank_name/intestatario dal record utente collegato. Intestatario ricomposto da `iban_holder || account_holder || (cognome+nome)`.
- Nessuna modifica frontend (la card legge già i campi dalla risposta del GET).
### Verifica (curl)
- Coach con IBAN/banca/intestatario + atleta collegato con campi vuoti → il GET atleta restituisce iban/account_holder/bank_name ereditati dal coach. Dati di test ripristinati.
### Deploy
- Solo backend.


## Changelog — 22/08/2026 (2) — Fix messaggio/attivazione "18+ PRO" errata su minore
### Bug (segnalato)
- Validando il certificato di una MINORE (nata 2012) l'app mostrava "Atleta 18+ PRO attivato automaticamente (nessun periodo di prova)".
### Root cause
- Frontend (`admin/athlete/[id].tsx`): il messaggio "18+ PRO" veniva mostrato ogni volta che `athlete_activated=true`, anche quando l'attivazione derivava dal flusso fine-prova di un minore.
- Backend (`create_certificate_simple`): la branch di auto-attivazione PRO controllava solo `athlete_type=='compensated'` senza verificare l'età → un minore con athlete_type erroneamente 'compensated' poteva essere attivato come PRO.
### Fix
- Backend: aggiunta guardia `not _compute_is_minor(athlete)` alla branch PRO (un minore non può essere 18+ PRO). Aggiunto flag di risposta `activated_as_pro`.
- Frontend: messaggio "18+ PRO (nessun periodo di prova)" mostrato SOLO se `activated_as_pro=true`; altrimenti messaggio generico "Atleta attivato".
### Verifica (curl)
- A) minore 2012 compensato + verified=true → `activated_as_pro=false`, nessuna attivazione PRO (status→pending_trial, flusso normale). B) adulto 2000 compensato → `activated_as_pro=true`, status→active. Dati di test ripristinati.
### Deploy
- Frontend + backend.


## Changelog — 22/08/2026 — Fix Certificato Medico: errore convalida + scadenza -1 giorno
### Issue 1 — Errore salvataggio quando l'admin mette la CONVALIDA (P1)
- Sintomo: admin corregge la data scadenza e mette il flag "Certificato verificato dall'admin" → "Errore nel salvataggio"; senza convalida salva.
- Root cause (server.py `create_certificate_simple`): con `verified=true` e stato `pending_certificate` la riga confrontava `expiry_dt` (timezone-AWARE, da `fromisoformat('+00:00')`) con `datetime.utcnow()` (NAIVE) → `TypeError` → 500. Con convalida OFF il branch non partiva → salvava.
- Fix: `datetime.utcnow()` → `datetime.now(timezone.utc)` nel confronto; inoltre `expiry_dt` reso sempre tz-aware dopo il parsing.
- Verifica curl: atleta in `pending_certificate` + `verified=true` → HTTP 200 e stato → `pending_trial` (prima 500).
### Issue 2 — Scadenza "2 giorni prima" quando inserisce il GENITORE (P2)
- Regola corretta: scadenza = emissione + validità − 1 giorno (un anno dopo, il giorno prima dell'emissione).
- Root cause (frontend `app/parent/athlete/[id].tsx`): le date erano create a MEZZANOTTE locale (`new Date(y,m,d)`); `toISOString()` in fuso Italia (UTC+1/+2) slittava al giorno precedente in UTC → scadenza salvata un giorno prima (apparendo "2 giorni prima" sommato al −1). Admin/dirigente/atleta usavano già le 12:00.
- Fix: costruttori data del form genitore portati a `12,0,0` (mezzogiorno) come le altre viste (righe ~85, ~100, ~102). Nessun altro ruolo era affetto.
### Deploy
- Frontend + backend.


## Changelog — 21/08/2026 (3) — Pulsante WhatsApp nel dettaglio pre-iscrizione evento
### Richiesta utente
- Poter avvertire via WhatsApp le famiglie iscritte a un evento, dal modale che si apre cliccando sul nome dell'iscritto.
### Fix (frontend)
- `app/admin/preseason.tsx`: nel modale `selectedResponse` aggiunto pulsante verde "WhatsApp Genitore" (o "WhatsApp Atleta" se manca il telefono genitore), sopra i pulsanti Condividi/Stampa. Apre `https://wa.me/39<numero>` con `Linking.openURL`. Visibile solo se c'è un telefono. Numero normalizzato (solo cifre) con prefisso 39.
### Verifica (screenshot preview)
- Modale di una risposta con telefono genitore: pulsante "WhatsApp Genitore" presente e correttamente posizionato. Lint: solo warning pre-esistenti.
### Deploy
- Solo frontend.


## Changelog — 21/08/2026 (2) — Dati Bancari (sola lettura) nella scheda Atleta (Anagrafica)
### Richiesta utente
- Non si vedevano i dati bancari di un atleta 18+ Pro nella scheda Atleta (erano visibili solo lato Coach per il doppio incarico). La scheda Atleta non aveva alcuna sezione bancaria.
### Fix
- `app/admin/athlete/[id].tsx`: aggiunta card "🏦 Dati Bancari" (sola lettura) nel tab **Anagrafica**, subito dopo la card Anagrafica. Mostra IBAN, Intestatario, Banca. Card visibile solo se almeno un campo è presente. Intestatario con fallback `iban_holder || account_holder || (cognome+nome legacy)`.
- `server.py`: aggiunto `account_holder` al modello `Athlete` (il GET usa `response_model=Athlete` e prima non esponeva il campo salvato dal profilo atleta).
### Verifica (screenshot preview)
- Atleta Test REACT con IBAN/Intestatario/Banca di test: la card compare in Anagrafica con i valori corretti. Dati di test rimossi. Lint pulito.
### Deploy
- Frontend + backend (nuovo campo nel modello).


## Changelog — 21/08/2026 — Fix consensi doppio incarico (atleta 18+ Pro + staff)
### Bug (segnalato)
- Persona con doppio incarico (es. GUARINO GIADA: atleta 18+ Pro + Coach): firma privacy e consensi immagine come ATLETA (salvati sul record atleta), ma nel riepilogo "Consensi Immagini" compariva sotto Staff·Coach come "In attesa di firma privacy / senza consenso" (letto solo dal record utente).
### Root cause
- `GET /admin/athletes/image-consents` (sezione staff) e `GET /admin/consent-history/user/{id}` leggevano SOLO `users.consents`, ignorando il record atleta collegato (`users.linked_athlete_id`).
### Fix (server.py, backend-only)
- `admin_list_image_consents`: per gli staff con `linked_athlete_id`, se il consenso/privacy non è espresso sul record utente, fallback sul record ATLETA collegato (consenso diretto adulto + `privacy_accepted`).
- `get_consent_history_admin` (entity user): unisce nelle chiavi mancanti (`privacy_viewed`, `images_internal`, `images_promo`) i valori dal record atleta collegato; `privacy_accepted` atleta ⇒ presa visione. Così anche il pannello "Consensi Privacy" nella scheda Coach/Dirigente/Collaboratore mostra correttamente.
### Verifica (curl, scenario di test poi ripristinato)
- Coach senza consensi propri, collegato a un atleta con consensi True: `consent-history/user` → privacy/internal/promo = True; `image-consents?only_denied=true` → il coach NON compare più tra i "senza consenso"; `only_denied=false` → "Staff · Coach" consent_given=True, privacy_signed=True.


## Changelog — 20/08/2026 (4) — Fix consensi immagini atleta MAGGIORENNE non visibili all'Admin
### Bug (segnalato da utente)
- Un'atleta 18+ concede i consensi immagini dal proprio profilo (salvati su `athletes.consents`, endpoint `/athletes/{id}/consents`), ma nella scheda Admin (`AdminConsentView`) risultavano "Non ancora espresso".
### Root cause (frontend `src/components/AdminConsentView.tsx`)
- `renderImageRow` calcolava `hasExpressed` solo dalla presenza di `final_consents[type].per_parent`. Per un maggiorenne NON ci sono genitori → `per_parent` vuoto → il codice forzava `finalValue = null` ("Non ancora espresso"), ignorando `final_value`/il consenso diretto.
### Fix
- Se `per_parent` ha voci (minore con genitori) → usa `final_value` + `denied_by` come prima. Altrimenti (maggiorenne/senza genitori) legge il consenso diretto da `consents[type]`: presente → Dato/Negato, assente → Non ancora espresso.
### Verifica (screenshot preview)
- Atleta adulto Test REACT con consensi diretti a `true`: Admin mostra "Dato" per uso interno e promozionale (prima "Non ancora espresso"). Dati di test ripristinati. Lint pulito.
### Deploy
- Solo frontend.


## Changelog — 20/08/2026 (3) — Fix "doppia banda bianca" durante il caricamento schede
### Root cause
- Cambiando `styles.header` da `row` a `column`, gli header degli stati "Caricamento..." / "Errore" (che avevano ancora i due pulsanti back/home fuori da `headerTopRow`) stiravano i `TouchableOpacity` a tutta larghezza (alignItems stretch di default) → i due bottoni bianchi apparivano come due bande bianche piene, poi sparivano al termine del load.
### Fix (frontend)
- `coach/[id].tsx`, `dirigente/[id].tsx`, `athlete/[id].tsx`: negli stati loading ed errore i pulsanti back/home sono ora dentro `headerTopRow` (riga) e il titolo ("Caricamento..."/"Errore") usa `headerName` sotto. Convertiti anche i residui `data-testid`→`testID` in athlete.
- Collaboratore: nessun problema (lo stato loading non renderizza l'header).
### Verifica
- Stato "Errore" (id inesistente) mostra i due pulsantini tondi in alto + testo sotto, senza bande bianche. Lint pulito.


## Changelog — 20/08/2026 (2) — Rifinitura intestazioni: squadra sotto il nome + collaboratore compatto
### Richieste utente
- Dirigente e Collaboratore mostrano GIÀ squadre e palestre nella card "Stagione" → NON duplicare nel corpo.
- Collaboratore: WhatsApp ridotto e messo in riga con "ATTIVO", in fondo a destra.
- Atleti / atleti pro / coach: non avevano l'indicazione della squadra → aggiungerla SUBITO SOTTO IL NOME nel banner (max ~3 squadre).
### Fix (frontend)
- `collaboratore/[id].tsx`: rimossa la riga squadre dal corpo (annullato il punto D precedente); ora `statusRow` con badge "ATTIVO/IN ATTESA" a sinistra e pulsante WhatsApp compatto (size 16, padding ridotti) a destra (`justifyContent: space-between`).
- `coach/[id].tsx` e `athlete/[id].tsx`: aggiunto `headerTeams` sotto `headerName` nel banner con l'elenco squadre (join " · ", `numberOfLines={2}`, testo bianco translucido). Coach: da `assigned_teams` + lista `teams`. Atleta: da `team_ids` (fallback `team_id`/`team_id_2`/`team_name`) + `allTeams`.
- Dirigente: nessuna modifica al corpo (già ha Stagione), nessuna squadra nel banner.
### Verifica (screenshot preview)
- Coach RICA FEDE: banner "RICA FEDE" + "Under 16 · Under 18 · Serie D · Under 17 · Serie C". Atleta Test REACT: "Under 14" sotto il nome. Collaboratore PAOLI PAOLO: ATTIVO + WhatsApp compatto sulla stessa riga, nessuna squadra nel corpo. Lint pulito.
### Deploy
- Solo frontend.


## Changelog — 20/08/2026 — Intestazione schede utente: nome leggibile (no troncamento)
### Richiesta utente
- Nelle schede di dettaglio (atleta, coach, dirigente, collaboratore) il nome nel banner d'intestazione veniva troncato ("STENTELLA FRANCE...", "GUARINO GIAD...", "CARROZZA GI...").
### Fix (frontend — 4 file)
- Header ricostruito a COLONNA: prima riga con i pulsanti (indietro/home + eventuali azioni a destra: QR atleta, chiave collaboratore, matita atleta), poi il NOME su riga propria, allineato a sinistra, `numberOfLines={2}` (fontSize 22) → banner più alto e nome sempre leggibile.
- `athlete/[id].tsx`, `coach/[id].tsx`, `dirigente/[id].tsx`: nuovo `headerTopRow` + `headerName`; header da `row` a `column`; convertiti `data-testid`→`testID` (QR + home) in athlete.
- `collaboratore/[id].tsx` (Foto 3):
  - (C) prima l'header mostrava "Dettaglio Collaboratore"; ora mostra il NOME come gli altri utenti (chiave reset password spostata in alto a destra).
  - (D) al posto del nome nel corpo, ora l'elenco delle SQUADRE assegnate su più righe, carattere piccolo (fallback "Nessuna squadra assegnata").
### Verifica (screenshot preview, login admin)
- Collaboratore PAOLI PAOLO: header "PAOLI PAOLO" + corpo con 6 squadre multi-riga (Under 14/16/MiniVolley/Starter Group/Under 18/Serie D). Coach RICA FEDE e atleta Test REACT: nome su riga propria, banner più alto, QR atleta preservato. Lint pulito.
### Deploy
- Solo frontend → Save to Github/Vercel (nessuna modifica backend).


## Changelog — 19/08/2026 — Fix "iscrizione fantasma" su email non valida (P1)
### Root cause
- `POST /auth/register-adult-athlete` e `POST /athletes/adult` (admin) NON validavano il formato email prima di scrivere su DB. Un'email malformata (es. `mario@18+.com`) creava record atleta/utente e poi un passaggio successivo falliva → iscrizione "fantasma" + errore generico.
### Fix (server.py)
- `register_adult_athlete`: aggiunta `is_valid_email(data.email)` come PRIMISSIMO controllo → 400 "Indirizzo email non valido. Controlla e riprova." prima di qualunque insert.
- `create_adult_athlete` (admin): se `data.email` fornita e non valida → stesso 400 prima di qualunque insert.
- Il helper `is_valid_email` esisteva già (definito 03/08/2026) ma non era mai chiamato.
### Verifica (curl + ispezione DB)
- `mario@18+.com` → 400; `notanemail` → 400; email valida + invito errato → 400 su invito (validazione email passa prima). Nessun record fantasma creato (users=0, athletes=0 per tutte le email di test).
### Deploy
- Solo backend → Render.


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


## Changelog — 18/08/2026 (g) — Scadenze rate nel "Riepilogo Quote" (vista Admin atleta)
### Bug
- Nella scheda ATLETA lato Admin, "💰 Riepilogo Quote" mostrava nome+importo ma NON le date di scadenza delle rate (presenti invece nella scheda Squadra e lato Genitore).
### Fix (frontend admin/athlete/[id].tsx, installments_list.map ~riga 3497)
- Aggiunta la riga "Scad. GG/MM/AAAA" sotto il nome di ogni rata quando `inst.due_date` è presente (il backend lo forniva già). Stile identico alla scheda Squadra. La 1ª rata (Iscrizione, senza scadenza) resta senza data.
### Verifica (testing agent, iteration_109) — frontend
- Test REACT (Under 14): Rata 2 Scad. 03/11/2025 (150€), Rata 3 Scad. 23/12/2025 (200€), Iscrizione senza data. Nessuna regressione sulla scheda Squadra.
### Note
- Vista Genitore (parent/athlete) mostrava già le scadenze. Vista Atleta 18+ (athlete/payments) mostra "Scadenza: ..." per le rate NON pagate (status-aware) — lasciata invariata.


## Diagnosi DEFINITIVA lentezza — 18/08/2026 (dopo deploy utente)
### Misure oggettive
- Chrome Timing su richiesta lenta: 99% del tempo su "Waiting for server response" (TTFB ~9s); Stalled/Queueing pochi ms. ~93 richieste per apertura pagina.
- Test diretto backend PROD (registrateam-backend.onrender.com): singola richiesta unauth 3ms, pagina pubblica con query DB 12ms. Server+DB VELOCI in isolamento.
- render.yaml: `plan: free` + `uvicorn server:app` (1 worker). 
### Conclusione
- Il ritardo NON è codice né singola query: è CODA lato server/DB sotto il FLUSSO di ~90 richieste concorrenti generate dalla dashboard (liste + molti popup in polling), su infra GRATUITA (Render free 1 worker + Atlas M0 condiviso che throttla le operazioni concorrenti). Pagine con poche richieste (Squadre/Società) sono veloci; pagine con burst grande vanno in coda.
### Mitigazioni CODE fatte (riducono le operazioni per burst)
- Auth: cache utente (TTL 8s) + IN-FLIGHT dedup (burst condivide 1 sola lettura) + throttle last_active_at (1/60s).
- Frontend dedup (sharedGet): /athletes, /users/parents, /users/coaches, /seasons/current-name(30s), /admin/notes(button), /admin/notifications(popup 20s).
### Soluzione DEFINITIVA (infra, NON crediti Emergent)
- Render: free → starter ($7/mese: no sleep + più CPU; opz. `--workers 2`).
- MongoDB Atlas: M0 (shared, throttled) → tier dedicato (es. M10): elimina la coda delle operazioni concorrenti. Questo è il vero collo di bottiglia.
### Nota produzione storage
- render.yaml NON contiene INTEGRATION_PROXY_URL; EMERGENT_LLM_KEY è sync:false. Verificare che siano impostati su Render, altrimenti l'upload cover→storage in PROD userà il fallback base64 (funziona ma non alleggerisce). Da confermare col deploy Emergent.


## Nota diagnostica — 18/08/2026 — PROVA che i 7s sono costo auth (non immagini)
- Screenshot utente (PRIMA del deploy dell'auth-cache): `/seasons/current-name` (0.3kB) impiega 7,3s ed è chiamata 3 volte; `dirigenti` 1.6kB 7.7s; `coaches` 1.4kB 7.5s; `stats` 0.4kB 7.3s. Endpoint minuscoli a 7s ⇒ collo di bottiglia = costo per-richiesta CONDIVISO (lettura utente in get_current_user su Atlas M0), NON payload/immagini.
- Conclusione: l'auth-cache (già in codice, TTL 8s) è LA fix; va deployato per vederne l'effetto. `society?include_images=true` (519kB, 2x) è l'unico payload pesante → beneficerà della migrazione logo (Fase B resto).
- Dedup estesa (sharedGet) a: /athletes, /users/parents, /users/coaches, /seasons/current-name (TTL 30s) su athletes/coaches/collaboratori/dirigenti — riduce le richieste duplicate viste in Network. Smoke test OK (cartelle caricano).


## Changelog — 18/08/2026 (f) — Fase B trial: copertine eventi → Emergent Object Storage
### Bug utente
- "Ho messo nuove copertine sugli eventi ma non si salvano, appare solo il logo": (a) il frontend RIFIUTAVA immagini >3MB; (b) il base64 pesante non veniva salvato/appesantiva Mongo.
### Fix
- Frontend (preseason.tsx handlePickCoverImage web): rimosso il blocco 3MB; ora COMPRIME sempre via canvas (max 1200px, JPEG 0.82) → payload ~200-400KB, upload affidabile.
- Backend: nuovi helper Emergent Object Storage (_storage_init/put/get_sync via INTEGRATION_PROXY_URL + EMERGENT_LLM_KEY, run_in_threadpool). `_store_cover_from_datauri` comprime (JPEG) e carica su storage.
- create/update campagna: se arriva cover_image data URI → carica su storage, salva `cover_storage_path`, `cover_image` resta VUOTO in Mongo (doc leggero). Fallback: se upload fallisce, tiene il base64.
- cover.jpg: DUAL-READ (storage se cover_storage_path, altrimenti base64 legacy). Lista has_cover = storage OR base64. Share og:image aggiornato.
- Script migrazione: `/app/backend/migrate_covers_to_storage.py` (idempotente) per spostare i base64 esistenti → storage.
### Verifica (testing agent, iteration_108) — backend 10/10 + UI
- CREATE→storage_path valorizzato, cover_image vuoto, cover.jpg 200 dallo storage. EDIT senza toccare cover→intatta. EDIT cambio→nuovo path. EDIT rimozione→404. Fallback base64 legacy (6f3b4944) OK. Thumbnail lista da cover.jpg.
### NOTE
- Emergent Object Storage NON ha URL pubblici: le immagini si servono via backend (cover.jpg è già pubblico per gli OG WhatsApp → nessun token necessario).
- Produzione: verificare che INTEGRATION_PROXY_URL/EMERGENT_LLM_KEY siano iniettati su Render (default hardcoded https://integrations.emergentagent.com come fallback).
- DA FARE (Fase B resto): migrare profile_photo (users/athletes) e logo (settings) — sono le collezioni CALDE che pesano sulla performance M0; lavoro più grande e rischioso, da fare dopo aver misurato l'effetto dell'auth-cache in produzione.


## Changelog — 18/08/2026 (e) — PERF Fase A: deduplica richieste GET duplicate
### Problema
- Nella tab Network: `/athletes` partiva 4 volte in parallelo (chiamata da athletes.tsx, parents.tsx, athlete-search.tsx, prime-squadre.tsx al mount), saturando connessioni browser + worker Render.
### Fix
- Nuovo `src/services/sharedGet.ts`: dedup delle richieste GET concorrenti + cache TTL 2.5s (collassa il burst di apertura pagina). Ritorna `{data}` (drop-in di `api.get`).
- Applicato a tutte le chiamate `/athletes` (4 schermate) + `/users/parents`.
### Verifica
- Smoke test UI: /admin/athletes carica correttamente (3 atleti), nessuna regressione.
### Fase B (DA FARE) — migrazione immagini base64 → Emergent Object Storage
- Playbook ottenuto (integration_expert): storage gestito via backend con EMERGENT_LLM_KEY, handshake /init→storage_key→X-Storage-Key, put/get via /objects/{path}, `requests` sync → run_in_threadpool, no URL pubblici (serve endpoint /media con token per web). Path: `{app}/uploads/{user_id}/{uuid}.{ext}`.
- Piano: helper storage + init startup + endpoint media; migrazione incrementale con dual-read (storage_path else base64 fallback) partendo da preseason_campaigns.cover_image, poi settings.logo, poi profile_photo (users/athletes). Serve script di migrazione dati + test dedicato. NON ancora implementato (task grande, da fare in pass dedicato).


## Changelog — 18/08/2026 (d) — REGRESSIONE FIX: copertine eventi cancellate (anteprime WhatsApp senza immagine)
### Sintomo
- I link di condivisione campagne (/api/preseason/share/{id}) non mostravano più l'immagine evento su WhatsApp: solo logo società o nessuna immagine.
### Root cause (regressione introdotta dall'ottimizzazione performance Eventi del 15/08)
- Il frontend, in MODIFICA campagna, inviava SEMPRE `cover_image` nel PATCH (anche stringa vuota). Dopo aver escluso `cover_image` dalla lista (performance), se il base64 non era ricaricato (o mismatch deploy FE/BE) il salvataggio azzerava la copertina → dato perso.
### Fix (frontend admin/preseason.tsx)
- Nuovo flag `coverChanged`: `cover_image` incluso nel payload SOLO in creazione, oppure in modifica se l'utente ha davvero cambiato/rimosso l'immagine (pick/remove). Modifiche a data/descrizione NON toccano più la copertina (PATCH exclude_unset la lascia intatta). Difesa in profondità: se il precarico del base64 in modifica fallisce, `coverChanged` resta false → nessuna sovrascrittura.
- Reset stato copertina anche su FAB "Nuova Campagna".
### Verifica (testing agent, iteration_107) — backend 10/10 + frontend Playwright
- Modifica descrizione senza toccare cover → cover_len 6134 identico prima/dopo, cover.jpg 200. PATCH senza cover=intatta; PATCH cover=""=azzerata; create con cover=salvata; share og:image punta a cover.jpg.
### ⚠️ Dato perso in produzione
- Le copertine già azzerate in PROD NON sono recuperabili (nessun backup): l'utente deve RI-CARICARE la copertina sulle campagne interessate (una volta sola). Da ora la modifica non le cancella più. Richiede redeploy Vercel del frontend.


## Changelog — 18/08/2026 (c) — PERF: latenza uniforme 7-9s in PRODUZIONE (Render+Atlas M0)
### Sintomo
- In produzione quasi tutte le cartelle admin caricano in 7-9s, ANCHE endpoint banali (es. /seasons/current-name, 0.3kB). Risposte piccole (projection OK) ma latenza alta e uniforme → costo per-richiesta CONDIVISO amplificato dal burst di ~10-15 richieste simultanee del dashboard su Atlas M0 (shared, throughput/CPU limitati).
### Analisi
- Collo di bottiglia = `get_current_user` eseguito su OGNI richiesta: 1 lettura utente + 1 scrittura fire-and-forget (last_active_at). Con 10-15 richieste in parallelo → ~20-30 operazioni Mongo per ogni caricamento pagina su M0 che throttla.
- Indici su `users.id`/`athletes.id` presenti (no collection scan). In PREVIEW i tempi sono 3-28ms (misurati). I 7-9s sono infra di produzione (Atlas M0 shared + eventuale Render free tier), NON riproducibili in preview.
### Fix (server.py, get_current_user)
- Cache in-process del documento utente per `user_id` (TTL 8s): deduplica il burst → 1 lettura invece di 10-15 per caricamento pagina. Chiave = user_id dal JWT (nessun leak inter-utente; role preso dal JWT non dalla cache). `invalidate_auth_cache(user_id)` disponibile.
- Throttle scrittura `last_active_at`: max 1 volta/60s per utente (prima: ad ogni richiesta).
- Liste mutabili (`assigned_teams`, `coordinator_permissions`) copiate nel dict restituito per non corrompere la cache.
### Verifica (testing agent, iteration_106) — 16/16 PASS
- Auth per tutti i ruoli OK, isolamento multi-tenant intatto, header X-Response-Time-ms presente, nessun leak inter-utente sotto 20+ richieste concorrenti interleaved, flusso certificato genitore OK.
### Raccomandazioni per l'utente (infra)
- Dopo il redeploy su Render, controllare l'header di risposta `X-Response-Time-ms` nella tab Network: se ~7000ms → collo di bottiglia lato server/DB (Atlas M0); se piccolo (<200ms) ma "Time" alto → rete/coda/tier Render.
- Causa più probabile: **MongoDB Atlas M0 (shared)**. Upgrade a un tier dedicato (M10) elimina il throttling. Anche Render free tier introduce throttling CPU.
### Backlog frontend (non fatto)
- Deduplicare le richieste identiche in parallelo (nello screenshot /athletes chiamata 4x contemporaneamente): shared in-flight promise / cache lato client per ridurre il numero di richieste per caricamento.


## Changelog — 18/08/2026 (b) — BUGFIX 403 "Non hai i permessi per aggiornare certificati" (genitore)
### Root cause
- `POST /api/certificates/simple` rifiutava l'utente sulla WHITELIST DI RUOLO (`["admin","dirigente","viewer","athlete","parent"]`) PRIMA di controllare la relazione. Genitori reali collegati come `parent_id`/`second_parent_id` ma con ruolo diverso da "parent" (es. coach/coordinatore/dual-role) ricevevano 403.
### Fix (server.py, guardia autorizzazione ~13081)
- Autorizzazione ora RELAZIONE-BASED: consentito se admin, coordinatore stessa società, genitore collegato (parent_id/second_parent_id, qualsiasi ruolo), l'atleta stesso (incl. login Lite minorenne), o dirigente/viewer/coach incaricato della squadra. La sicurezza è data dalla relazione + società, non dalla stringa di ruolo.
### Verifica (testing agent, iteration_105) — 6/6 PASS
- parent linked→200; coach linked come parent_id→200 (prima 403); non collegato→403; admin→200; viewer assegnato→200; round-trip GET + sync campi atleta OK. DB ripristinato.
- Backlog tecnico (non bloccante): estrarre la guardia in helper `user_can_edit_athlete_certificate(user, athlete)` da riusare in upload/delete cert.


## Changelog — 18/08/2026 — BUGFIX certificato medico "non memorizzato" (lato genitore)
### Root cause (verificata dal testing agent, backend + UI)
- La ScrollView della pagina genitore `/parent/athlete/[id].tsx` NON aveva `keyboardShouldPersistTaps="handled"`: su mobile il primo tap su "Salva" con tastiera numerica aperta chiudeva solo la tastiera senza attivare il pulsante → il salvataggio non partiva.
### Fix applicati
- `keyboardShouldPersistTaps="handled"` sulla ScrollView principale del genitore.
- `CertificateDateForm`: nuovo `useEffect` che ri-sincronizza `issueDate`/`validityMonths` quando il certificato viene caricato in modo asincrono (prima "Mesi di Validità" restava vuoto → Salva disabilitato); deriva la validità da emissione↔scadenza se assente.
- Backend `POST /certificates/upload-base64`: ora sincronizza i campi `medical_certificate_*` sul documento atleta (prima scriveva solo la collezione `certificates`).
- Backend `GET /certificates/{athlete_id}` fallback: corretto nome campo (`medical_certificate_issue_date`) + aggiunto `validity_months` derivato.
- 5 prop `data-testid` → `testID` in CertificateDateForm (RN-Web mappa solo testID).
### Verifica
- Testing agent: 4/4 test backend green + flusso UI genitore (armida.raschi@gmail.com su atleta MAURI LENA) OK, persistenza confermata dopo reload, form modifica pre-compilato.
### Test data
- Atleta minorenne MAURI LENA (id 6a5ec7347c201d9cb7eb70d2) collegata a genitore ARMIDA (parent_id), data_password rimossa — vedi test_credentials.md.


## Changelog — 18/08/2026 (fork continuazione) — PERF cartella EVENTI (~30s → ~10ms)
### Root cause
- `GET /preseason/campaigns` restituiva l'intero documento campagna INCLUSO `cover_image` (locandina base64 multi-MB). Con più campagne la lista scaricava decine di MB → ~30s di caricamento della cartella "Eventi in programma".
### Fix backend (`server.py`, get_preseason_campaigns)
- Sostituito il `find` con aggregation pipeline: `$addFields has_cover` (booleano, via `$strLenCP`) + `$project {cover_image: 0}`. Il base64 NON viene più trasferito nella lista. Verificato: risposta 669B in ~10ms (prima multi-MB).
### Fix frontend (`app/admin/preseason.tsx`)
- Nuovo helper `campaignCoverUri(c)` = `${EXPO_PUBLIC_BACKEND_URL}/api/preseason/public/{id}/cover.jpg` (JPEG compresso ~280KB, `Cache-Control 300s`), usato SOLO se `has_cover=true`.
- Thumbnail lista + anteprima WhatsApp/Facebook ora usano l'URL `/cover.jpg` invece del base64 inline (fallback al logo società se assente).
- `handleOpenEdit` reso `async`: se `has_cover`, recupera il base64 completo da `GET /preseason/campaigns/{id}` così il salvataggio in modifica NON cancella la copertina.
- Interfaccia `Campaign`: aggiunto `has_cover?: boolean`.
### Nota ambiente (fork)
- Rebuild statico richiede `babel-preset-expo` al top-level di `node_modules` (era annidato solo sotto `expo/node_modules`, non hoistato). Creato symlink `node_modules/babel-preset-expo -> expo/node_modules/babel-preset-expo` per sbloccare `npx expo export -p web`.
### Atleti/Genitori ancora lenti (7-8s) in PRODUZIONE
- Le projection base64-exclude su `/athletes` e `/users/parents` sono GIÀ nel codice (verificate veloci: <50ms in preview). Il 7-8s dipende dal fatto che NON sono ancora deployate su Render. Serve un deploy backend.
- **NOTA DEPLOY**: frontend → Save to Github/Vercel; backend → Render.


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

### Già implementato (NON riproporre nel backlog)
- Promemoria automatico via email al genitore/atleta 30 e 15 giorni prima della scadenza del certificato medico (scheduler "Certificate expiry notification" attivo all'avvio backend). Confermato dall'utente 08/08/2026.

### Bugfix 08/08/2026 — Registro Presenze mostrava troppi pochi atleti
- `GET /api/teams/{id}/attendance-stats` (server.py ~13474): il filtro era `status ∈ ["active","trial"]` e nascondeva gli atleti in onboarding (pending/pending_trial/pending_certificate/pending_privacy). Ora mostra TUTTI gli atleti assegnati (team_id/team_id_2) tranne rejected/withdrawn/removed/deleted.
- Frontend `admin/team/[id]/attendances.tsx`: aggiunto badge di stato accanto al nome (In prova / Attesa certificato / Attesa inizio prova / Attesa firma privacy / In attesa).

### Deployment
- L'utente pubblica in produzione (registrateam.it) tramite il deploy della piattaforma (opzione A). Le modifiche di sessione sono in anteprima finché non viene fatto il deploy.

### Bugfix 08/08/2026 (parte 2) — Vista atleta + lista Atleti admin
- **Tab bar atleta a quota mancante**: `athlete/index.tsx` — la `<AthleteTabBar />` era solo nel ramo "compensati". Aggiunta anche nel ramo "quota" (bug preesistente da 90+ commit): senza di essa l'atleta non raggiungeva Anagrafica/Pagamenti/Presenze né i "Consensi Privacy". Aggiunti anche badge/banner per stato `pending_certificate`.
- **AthleteTabBar testID**: `src/components/athlete/AthleteTabBar.tsx` ora usa `testID` (RN Web) invece di `data-testid`.
- **Lista Atleti admin caricava solo ~10 elementi**: `admin/athletes.tsx` — la `SectionList` su RN Web mostrava solo il primo blocco al mount (serviva reload). Fix: `initialNumToRender=1000`, `maxToRenderPerBatch=1000`, `windowSize=999`, `removeClippedSubviews=false`.
- Verificato: testing_agent iteration_97 → 100% PASS (lista completa al primo mount, tab bar OK).

### Bugfix 08/08/2026 (parte 3) — Sezione "Consensi Privacy" mancante in più ruoli
- **Minore (vista genitore)** `parent/athlete/[id].tsx`: aggiunta sezione collassabile "Consensi Privacy" (mancava del tutto) con `<ConsentManager entityType="athlete" perParentId={user.id} privacySignedOverride={athlete.privacy_accepted} />`.
- **ConsentManager** `src/components/ConsentManager.tsx`: nuovi prop `perParentId` (legge chiave per-genitore `type__{parentId}` con fallback alla chiave diretta) e `privacySignedOverride` (sblocca i toggle per i minori con privacy firmata dal genitore). `entityType` ora include 'staff'.
- **Staff (coach/dirigente/collaboratore)**: la sezione "Consensi Privacy" era avvolta in `{privacyAccepted && (...)}` e restava NASCOSTA finché non si firmava la privacy. Rimosso il gate → sempre visibile (coerente con il profilo atleta adulto). Il backend continua a bloccare la MODIFICA prima della firma (comportamento voluto).
- Verificato: testing_agent iteration_98 → 4/4 profili mostrano la sezione. Vista minore verificata via codice + coerenza backend (endpoint `/athletes/{id}/consents` scrive/legge chiave per-genitore).

### Bugfix 09/08/2026 — Consensi immagini MINORI non modificabili (toggle attivi ma bloccati)
- **Causa radice (backend)**: `PATCH /api/athletes/{id}/consents` bloccava con 403 se `athlete.privacy_accepted` era False. Per i MINORI questo flag resta False (la privacy è per-genitore, salvata come `consents.privacy_viewed[__parentId]`), quindi genitori e minori non potevano MAI modificare i consensi. Fix (server.py ~34592): ora considera la privacy firmata anche se il genitore che agisce ha dato la presa visione (`privacy_viewed` diretta o `privacy_viewed__{parentId}`).
- **Frontend `ConsentManager.tsx`**: `privacySigned` ora considera anche `privacy_viewed__{perParentId}`; la lettura del valore usa la chiave per-genitore `type__{parentId}` con fallback alla chiave diretta (risolve il mismatch "toggle mostrato ON ma cronologia = No").
- **Vista genitore** `parent/athlete/[id].tsx`: passa `perParentId={user.id}` al ConsentManager.
- **Staff** (`/users/me/consents`): nessun gate backend → possono sempre modificare i propri consensi (sezione ora sempre visibile dal fix parte 3).
- Verificato via curl: genitore con presa visione ora fa PATCH consenso minore → 200, scritta chiave per-genitore `images_promo__{parentId}`, `final_consents` coerente (prima 403).

### Bugfix + Feature 09/08/2026 (parte 2) — Falso "Negato" consensi minori + pannello consensi admin read-only
- **Causa radice**: alla registrazione di un minore `create_athlete` (server.py ~8380) salvava `consents.privacy_viewed={value:false}` e immagini `{value:null}` con timestamp. Effetti: (a) vista genitore/atleta mostrava la privacy come "Negato" (X rossa) invece di "in attesa"; (b) admin "Consensi Immagini" mostrava i minori come "Negato da: <genitore>" perché il valore `null` veniva contato come negazione.
- **Fix 1 (backend `create_athlete`)**: per i MINORENNI ora `consents={}` e `consent_history=[]` (nessun consenso "espresso" alla registrazione; verrà firmato a fine prova). Maggiorenni invariati.
- **Fix 2 (backend `GET /admin/athletes/image-consents`)**: `_extract` ora ritorna True/False/**None** (non più False per i non-espressi). I valori `None` NON contano come "negato". Nuovo campo `privacy_signed` per atleta/staff. Corretto anche `_is_minor` che leggeva `birth_date` invece di `date_of_birth`.
- **Fix 3 (frontend `ConsentManager.tsx`)**: la "Presa visione Privacy" mostra "In attesa di firma (a fine prova)" invece di "Negato" quando il valore non è `true`. Nascosto il timestamp per i valori non espressi.
- **Fix 4 (frontend `image-consents.tsx`)**: icona neutra (clessidra arancione) + testo "In attesa di firma privacy" per chi non ha ancora firmato; "Negato da" resta SOLO per negazioni reali. Occhietti → deep-link `?section=consents`.
- **Feature B (`AdminConsentView.tsx` nuovo)**: pannello collassabile "Consensi Privacy (sola lettura)" per l'admin su scheda atleta (tab Anagrafica, apre da deep-link `?section=consents`) e su schede staff coach/dirigente/collaboratore (tab Compensi). Mostra stato firma privacy, consensi immagine (con denied_by per-genitore sui minori) e cronologia.
- **VERIFICATO** (preview): image-consents non mostra più falsi "Negato"; pannello read-only presente e corretto su atleta (MAURI LENA) e coach (FARO REMO); deep-link apre il tab giusto.
- **NOTA DEPLOY**: frontend → Save to Github/Vercel; backend → Render. In produzione anche i toggle "bloccati" della mamma di Ludovica dipendono dal fix per-genitore 09/08 non ancora online.

### Chiarimento 09/08/2026 (parte 3) — Staff firma privacy a fine anagrafica (no periodo di prova)
- Coach/dirigenti/collaboratori NON hanno periodo di prova: firmano la privacy al termine della compilazione dell'anagrafica. Il flusso esisteva già (`profile.tsx` → su Salva, se privacy non accettata, salva anagrafica e apre `GDPRPrivacyModal`; `POST /documents/sign-gdpr-privacy` con `gdpr_adult` imposta `users.privacy_accepted=True` + `consents.privacy_viewed=True`).
- Corrette solo le DICITURE che dicevano erroneamente "a fine prova" per lo staff: ora "a fine compilazione anagrafica" in `image-consents.tsx` (righe staff), `ConsentManager.tsx` (stato privacy + hint) e `AdminConsentView.tsx` (hint), condizionate a `entity_type/entityType` (athlete→prova, staff/user→anagrafica). Verificato in preview.

### Feature 09/08/2026 (parte 4) — Coach-mark "Guida rapida" al primo accesso
- Nuovo componente `src/components/FirstLoginGuideHint.tsx`: al primo ingresso di ogni utente evidenzia il libretto Guida (icona book-outline in alto a destra) con un callout + freccia, mostrato UNA sola volta per utente (flag AsyncStorage `guide_hint_seen_v1_{userId}`), saltabile ("Ho capito"/tap fuori).
- Integrato nelle dashboard: admin, coach, collaboratore, dirigente, parent, athlete (entrambi i rami quota/PRO), coordinatore. Testo personalizzato per ruolo.
- VERIFICATO in preview (dashboard admin). B (email fantasma) scartato su richiesta utente; C (FIPAV 2 categorie) in attesa di info.

### Feature 09/08/2026 (parte 5) — Cambio ruolo staff (Coach ⇄ Dirigente ⇄ Collaboratore)
- Flusso: l'ADMIN propone, la PERSONA accetta. Il ruolo cambia solo all'accettazione. Dati anagrafici e privacy invariati. Lasciando "coach" le squadre assegnate vengono scollegate (`users.assigned_teams=[]`).
- Backend (server.py, dopo reject_deletion_request): collezione `role_change_requests`.
  - `POST /admin/staff/{user_id}/propose-role-change` {to_role} (admin, stessa società; sostituisce proposte pendenti).
  - `GET/DELETE /admin/staff/{user_id}/role-change-request` (admin: legge/annulla proposta pendente).
  - `GET /role-change/pending` (persona: proposta in sospeso).
  - `POST /role-change/{id}/accept` (persona: applica ruolo + unlink squadre se esce da coach).
  - `POST /role-change/{id}/reject` (persona).
- Frontend: `AdminRoleChange.tsx` (nelle schede admin coach/dirigente/collaboratore, tab Compensi, con pulsante "Proponi cambio ruolo") + `RoleChangePrompt.tsx` (banner Accetta/Rifiuta nelle dashboard coach/dirigente/collaboratore; su accept fa `refreshUser()` e redirect alla nuova dashboard).
- VERIFICATO e2e via curl: propose→pending→accept ⇒ role=collaboratore, assigned_teams=[] (FARO ripristinato a coach dopo il test). UI admin verificata in preview.
- NB testID: aggiunto `testID` oltre a `data-testid` sui componenti nuovi (RN-Web).
- 🐛 10/08/2026 — Fix "Ruolo non compatibile: viewer": `propose_role_change` ora accetta come ruolo di PARTENZA anche "viewer" (alias legacy di dirigente) tramite `SOURCE_STAFF_ROLES`; blocca viewer→dirigente ("ha già questo ruolo"); label `viewer`→"Dirigente". Solo backend → richiede redeploy Render.

### Feature/Fix 10/08/2026 (parte 6) — Attestato: N. Prog. per pagamenti Stripe + Note = metodo
- **Bug**: gli incassi Stripe (one-shot + ricorrenti) non ricevevano il N. Prog. (numero ricevuta) né una Nota → nell'Attestato di Versamento comparivano "-" "-". La numerazione veniva assegnata solo ai pagamenti manuali.
- **Fix numerazione**: nuova `get_next_receipt_number(db, society_id)` in `utils.py` (formato `RIC-YY/YY-NNNN`, progressivo per stagione). Assegnata ora anche: webhook Stripe (`checkout.session.completed`), conferma-al-ritorno (`/payments/{id}/checkout/status`), e charge ricorrenti (`routes/recurring_payments.py`). Backfill lazy in `GET /payments/{athlete_id}/fiscal-receipt` per i pagamenti pagati senza ricevuta (in ordine cronologico paid_date) → auto-sana anche il pagamento di test da 10€ già effettuato.
- **Note = metodo**: la colonna Note dell'attestato mostra l'etichetta del metodo: Contanti / Bonifico / POS / Online con Stripe / Online con Stripe (ricorrente). Helper `_method_label` in server.py.
- **Layout**: rimossa la colonna ridondante "Metodo" da `fiscalReceipt.ts` (ora: N. Prog. | Note | Data | Importo; total-row colspan 4→3).
- VERIFICATO con dati sintetici: RIC-26/27-0001..0004 in ordine cronologico + etichette corrette.
- NB: richiede redeploy Render (backend) + Vercel (frontend). Dopo il deploy di Render, il pagamento di test da 10€ prenderà il N. Prog. alla prima apertura/stampa dell'attestato.

### Fix 10/08/2026 (parte 7) — Dashboard Coordinatore: link rotti / liste vuote / login / Unmatched
- **Sintomi**: le card del coordinatore aprivano pagine vuote (0 atleti/squadre/gare), rimandavano al LOGIN, o "Unmatched Route" (pagina nera).
- **Causa 1 (route errate)** in `app/coordinatore/index.tsx`: teams→`/admin/athletes`, trainings→`/admin/settings/other`, attendance→`/admin/attendance`, communications→`/admin/broadcast`, certificates→`/admin/certificates`, gdpr→`/admin/gdpr` (pagine inesistenti). Corrette: teams→`/admin/teams`, trainings→`/admin/teams` (interim, vedi nota), attendance→`/admin/attendances`, communications→`/admin/notifications`, certificates→`/admin/medical-certificates-archive`, gdpr→`/admin/documents-archive`. events→`/admin/preseason` (già ok).
- **Causa 2 (endpoint admin-only → 403)**: aperti al ruolo `coordinatore` (scope società): `/athletes`, `/matches` (server.py), `/teams/athletes-count/all` (routes/teams.py, usa stringa "coordinatore" perché models.enums.UserRole non ha COORDINATORE), `/attendance/today`, `/admin/medical-certificates-archive` (x3), `/documents/archive` (server.py), `/admin/notifications` (routes/notifications.py, scope per società per il coordinatore).
- **Causa 3 (whitelist layout)**: aggiunti `/admin/documents-archive` e `/admin/medical-certificates-archive` a `app/admin/_layout.tsx`.
- **VERIFICATO** (testing_agent, iteration_99): 16/16 backend + 9/9 card frontend OK sulla preview. Account test: coord.test@registrateam.it / Test1234.
- **Nota "Allenamenti"**: non esiste una pagina globale allenamenti (sono per-squadra) → per ora punta a `/admin/teams`. Da definire con l'utente cosa mostrare.
- **NB**: richiede redeploy Render (backend) + Vercel (frontend). Le sezioni Comunicazioni/Certificati/GDPR usano pagine admin reali (notifications/medical-certificates-archive/documents-archive).

### Fix + Feature 13/08/2026 — 3° dirigente non salvato + Staff FIPAV (segnapunti/accompagnatori/arbitri)
- **Bug 3° dirigente (P0)**: `/users/dirigenti` restituisce ruoli admin/viewer/dirigente/coordinatore, ma `assign-dirigenti` e `get_team` filtravano solo admin/viewer → i dirigenti con ruolo "dirigente" (nuovo) non venivano salvati/mostrati. Corretto: ruoli estesi a `["admin","viewer","dirigente","coordinatore"]` in `routes/teams.py` (get_team query + pull/addToSet). Aggiunto `COORDINATORE` a `models/enums.py`. Verificato: 3 dirigenti (role dirigente) salvati e mostrati.
- **Feature Staff FIPAV**: nuovi tesseramenti su staff (dirigenti/collaboratori): `is_scorekeeper`, `is_referee`, `is_accompanying_manager` (settabili via `PATCH /users/{id}`; UI card "🎽 Tesseramenti FIPAV" con 3 toggle in `admin/dirigente/[id].tsx`).
  - Assegnazione per squadra (id su documento team: `scorekeeper_ids`/`accompanying_ids`/`referee_ids`): endpoint `POST /teams/{id}/assign-scorekeepers|assign-accompanying|assign-referees`; pool filtrato `GET /staff/qualified?qualification=scorekeeper|referee|accompanying`.
  - `get_team` restituisce `scorekeepers_info`/`accompanying_info`/`referees_info`.
  - UI `admin/team/[id].tsx`: 3 sezioni di assegnazione (multi-select, stesso stile coach/dirigenti) + card in visualizzazione. **Arbitri associati** mostrati solo per squadre Under 12/13/14/15 (rilevate dal nome via regex `isUnderYouth`).
  - Verificato E2E: flag→pool filtrato→assegnazione→get_team; smoke UI OK (Under 14 mostra tutte e 3 le sezioni). NB deploy Render+Vercel.

### Feature 12/08/2026 — Data inizio attività squadra + allenamenti provvisori + creazione flessibile
- **Modello Team** (`models/team_models.py` + `server.py`): nuovi campi `activity_start_date` (ISO string, opzionale) e `trainings_provisional` (bool). `create_team`/`update_team` (routes/teams.py) li propagano; `activity_start_date` è nullable in update.
- **Da Fare / commitments** (`/coach/commitments` in server.py e `_build_commitments_payload` in routes/parents.py): gli allenamenti compaiono SOLO se la squadra ha `activity_start_date` impostata e solo per date >= inizio. Ogni allenamento porta `provisional`. Aggiunto `activity_banners` (banner "inizio allenamenti il GG/MM/AAAA", visibile fino al giorno dell'inizio, scompare il giorno dopo). Vale per atleti/genitori E staff (B).
- **Statistiche presenze** (`/teams/{id}/attendance-stats`): week/month/total e conteggio presenze partono da `activity_start_date` (clamp). Prima di quella data nulla viene conteggiato.
- **Frontend**:
  - `admin/team/[id].tsx` (modifica): nuova sezione "📅 Inizio attività" con input data (GG/MM/AAAA, vuoto ammesso) + toggle "Allenamenti provvisori".
  - `AdminCoachCommitments.tsx`: mostra i banner inizio attività + badge "PROVVISORIO" sugli allenamenti.
  - `admin/teams.tsx` (creazione): allenamenti e pagamenti NON più obbligatori; selettore giorni con opzione "— Nessun giorno —".
  - `admin/athlete/[id].tsx`: pulsante "RINUNCIA ALLA PROVA" nascosto quando la prova è già usata/scaduta (trial_end_date passato o days/sessions esauriti).
- **Verificato via API**: senza data → 0 allenamenti/0 banner; con data (+3gg) → allenamenti solo dalla data, banner corretto, provisional=True. Smoke UI edit squadra OK. NB deploy Render+Vercel.

### Privacy 12/08/2026 — Consensi immagini sempre registrati (fix "Non ancora espresso") + nota GDPR
- **Problema (utente)**: atleta con privacy firmata (es. ZECCA GIORGIA) mostrava i consensi immagini come "Non ancora espresso".
- **Causa**: in `sign-gdpr-privacy` i consensi immagine venivano scritti solo se avevano un valore esplicito (`is not None`); nei percorsi in cui non arrivavano, la chiave non veniva salvata → il pannello (`AdminConsentView` via `/athletes/{id}/consents`) mostrava null = "Non ancora espresso".
- **Fix backend**: alla firma i consensi immagini vengono ora **sempre** registrati con valore esplicito (Sì/No, default No se non spuntato) e salvati anche **per-genitore** (`images_internal__{pid}`, `images_promo__{pid}`) → aggregazione multi-genitore corretta. Verificato via `/consents`: per_parent popolato, final_value coerente (No→"Negato", Sì→"Dato").
- **Compliance**: NON è stato pre-selezionato "Sì" (GDPR Considerando 32 vieta le caselle pre-spuntate: il consenso deve essere scelta attiva). Le caselle restano da spuntare.
- **Nota GDPR** aggiunta nel `GDPRPrivacyModal` sotto i consensi immagini: "I consensi all'utilizzo delle immagini sono facoltativi e possono essere revocati in qualsiasi momento contattando la società (art. 7 Reg. UE 2016/679). La revoca non pregiudica la liceità del trattamento effettuato in precedenza. In assenza di consenso o in caso di revoca, il minore/l'interessato non potrà comparire nelle fotografie e nei video delle attività sportive pubblicati o diffusi dalla società."
- **Bug latente risolto**: `handleClose` del modal richiamava `setConsentDataTreatment` (setter inesistente) → potenziale errore alla chiusura; rimosso.
- **Storico**: invariato (opzione A): i record firmati in passato restano come sono; la nuova regola vale dalle firme successive. NB: richiede redeploy Render+Vercel.

### UI 12/08/2026 (parte 2) — "RINUNCIA ALLA PROVA" come pulsante compatto + schermata a 2 scelte
- Su richiesta utente: la card grande introdotta prima era troppo ingombrante. Ripristinata la UX originale.
- Ora è un **pulsante compatto "RINUNCIA ALLA PROVA"** (verde) che apre un **modal con 2 scelte**:
  A. "Rinuncia alla prova, firma la privacy e resta in [Società]" → nota "Ricordati di inserire la data di emissione del certificato medico e consegnare l'originale in società" → `waive-trial`.
  B. "Rinuncia alla prova e lascia [Società], confermando la cancellazione di tutti i dati inseriti" → apre il flusso di cancellazione (admin: modal Elimina con conferma "ELIMINA"; genitore: `deletion-check` → richiesta cancellazione).
- Implementato in `admin/athlete/[id].tsx` (tab Da fare) e `parent/athlete/[id].tsx`. Nome società da `societyData`/`societyName`. Verificato via screenshot (società "Pallavolo Perugia SSD a RL").

- Su richiesta utente: era ancora percepito ingombrante. Nella scheda admin (`admin/athlete/[id].tsx`) il pulsante era già spostato in fondo (sopra Elimina) ma con sfondo/bordo pieno; ora è un **link compatto** (testo grigio #8E8E93, 12px, sottolineato, icona 13px, allineato a sinistra, senza sfondo). Stessa cosa per lo stato "Sei collegato come genitore · Rimuovi".
- NB: su registrateam.it (produzione) la modifica compare solo dopo redeploy Vercel.

### Feature 12/08/2026 — Ripristino "Rinuncia alla prova" per minore già in forza
- **Contesto**: fino al 03/08/2026 un minore già tesserato poteva saltare il periodo di prova (genitore firma privacy → subito in forza). I cambi onboarding del 03/08 e 08/08 hanno reso la prova obbligatoria per tutti i minori (privacy solo a fine prova), rimuovendo di fatto quella scorciatoia.
- **Backend**: nuovo endpoint `POST /api/athletes/{id}/waive-trial` (genitore dell'atleta o admin/staff). Registra la firma privacy per-genitore (consenso + IP, come `/trial/accept-privacy`), imposta `end_trial_requested=True` + `trial_waived=True`. GATE certificato:
  - se certificato già convalidato → `status=active` (in forza) subito;
  - altrimenti → `status=pending_certificate` (non può entrare in palestra); alla convalida del certificato da parte dell'admin (`/certificates/simple` verified=true) l'atleta si attiva automaticamente (riusa `check_and_activate_if_ready` via `end_trial_requested`). Guard: solo minorenni, non se già active/blocked.
- **Frontend**:
  - Genitore (`parent/athlete/[id].tsx`): card verde "Già tesserato/a con noi?" + pulsante `waive-trial-button` (mostrato per minori in pending_trial/pending_certificate/trial non ancora avviato). Apre `GDPRPrivacyModal`; alla firma chiama `waive-trial`.
  - Admin (`admin/athlete/[id].tsx`, tab Da fare): card + pulsante `admin-waive-trial-btn` per minori non attivi.
- **Verificato via API**: cert valido→active; cert assente→pending_certificate poi active alla convalida; adulto→400. Smoke UI admin OK (pulsante visibile su MAURI LENA).
- **NB deploy**: backend Render + frontend Vercel.

### Performance 12/08/2026 (parte 2) — Compressione automatica foto squadra (stile WhatsApp)
- **Problema**: le foto squadra (uniche immagini caricate dall'utente) erano salvate come base64 grezzo fino a ~10.8MB per documento, appesantendo DB, RAM Render e le pagine di dettaglio.
- **Fix**: nuovo helper `compress_base64_image()` in `utils.py` (Pillow): rispetta EXIF, ridimensiona il lato lungo a 1280px, ricodifica JPEG q72; salta le immagini già < 350KB; in caso di errore lascia l'originale (mai perdita foto).
  - Applicato al salvataggio in `PATCH /teams/{id}` (`routes/teams.py`) su `team_photo`/`team_logo` → nuove foto compresse subito.
  - Backfill lazy in `GET /teams/{id}`: se la foto salvata è > 500KB viene compressa e ri-salvata alla prima apertura della squadra → il DB si alleggerisce nel tempo senza migrazioni pesanti allo startup.
- **Verificato**: foto Serie D 10.8MB → 239KB (−97%); foto Under 16 1.9MB → 202KB (−89%); seconda GET della stessa squadra ~16ms.
- **NB deploy**: richiede redeploy Render. Le nuove foto sono compresse all'upload; le foto esistenti si comprimono man mano che si aprono le rispettive squadre.

### Performance 12/08/2026 — Indici mancanti sulla collezione `attendances` (causa rallentamento stagionale)
- **Diagnosi**: il codice usa `db.attendances` (PLURALE, 28 occorrenze) ma la funzione `_create_indexes()` creava indici solo su `db.attendance` (SINGOLARE). Quindi la collezione calda delle presenze non aveva indici (solo `_id_`) → ogni query presenze (attendance-stats fa più `count_documents` per atleta su `athlete_id`/`check_in_time`/`team_id`) faceva scansioni complete. Con l'accumulo di presenze durante la stagione il rallentamento peggiora "ultimamente" (coerente con la segnalazione).
- **Fix (server.py `_create_indexes`)**: aggiunti indici su `attendances`: `athlete_id`, `team_id`, `[athlete_id, check_in_time]`, `[team_id, check_in_time]`. Aggiunti anche su `signed_documents` (contiene `pdf_base64` pesante): `id`, `society_id`, `related_entity_id`, `athlete_id`, `signer_id`. Idempotente, creato allo startup. Verificato: indici presenti dopo restart.
- **NB deploy**: gli indici vengono creati allo startup del backend → in produzione servono dopo un **redeploy su Render**.
- **Fattori secondari (non ancora ottimizzati)**: documenti base64 enormi — `teams.team_photo` (fino a ~10MB), `users` doc/profile images (fino a ~3MB), `medical_certificates_archive.certificate_data`. Le liste `/teams` e `/users/*` andrebbero verificate per escludere sempre i campi base64 (la lista `/teams` già esclude `team_photo`/`team_logo`); i dettagli singoli (`/teams/{id}`) restano pesanti perché servono la foto.

### Fix + Feature 09/08/2026 (parte 8) — Coordinatore Presenze / Banner genitore / Elimina protetto / Scadenzario certificati
- **Registro Presenze Coordinatore (P0)**: `GET /teams/{id}/attendance-stats` (server.py ~13476) accettava solo ADMIN/COACH → il Coordinatore riceveva 403 e la pagina mostrava "Errore". Ora abilitati anche VIEWER/DIRIGENTE/COORDINATORE con isolamento multi-tenant (la squadra deve appartenere alla società dell'utente). Verificato via curl: coord.test → HTTP 200.
- **Banner "Sono io il genitore" (P0)**: era un box viola invasivo dentro la scheda Anagrafica di ogni atleta (per admin/dirigente/coordinatore). Spostato in un **pulsante discreto in fondo** alla scheda (prima del pulsante Elimina), con testID `link-me-as-parent-btn` / `unlink-me-as-parent-btn`. Stessa logica `POST /athletes/{id}/link-me-as-parent`.
- **Protezione Elimina Atleta**: il modal di conferma ora richiede di digitare `ELIMINA` per abilitare il pulsante rosso (testID `delete-confirm-input` + `confirm-delete-athlete-btn`). Il pulsante apre comunque un modal (nessuna cancellazione al primo tocco).
- **Scadenzario Certificati Medici**: l'Archivio era vuoto perché per privacy NON si caricano le immagini dei certificati. Nuovo endpoint `GET /admin/certificates-expiry-list` (admin/viewer/dirigente/coordinatore) → elenco atleti con data scadenza certificato, ordinato per scadenza crescente, con nome + squadra + stato (scaduto/in scadenza/valido/mancante) + flag "Da verificare". La pagina `admin/medical-certificates-archive.tsx` è stata riproposta come "Scadenze Certificati" (card conteggi + lista tap→scheda atleta). Verificato via curl + screenshot.

### Note tecniche
- RN Web propaga solo `testID` (non `data-testid` grezzo) su TouchableOpacity/View/Text.
- Preview = build statico Expo: dopo modifiche frontend `cd /app/frontend && rm -rf dist && npx expo export -p web && sudo supervisorctl restart expo`.

---
## Changelog 13/08/2026 (fork)
- **Notifica registrazione**: solo i GENITORI sono auto-approvati (msg "si è registrato/a come Genitore."). Atleti (18+/PRO) e ruoli staff mostrano "...e attende approvazione" (server.py ~2525). Lo stato di approvazione atleti adulti era già corretto (register_adult_athlete → pending).
- **Banner "Inizio allenamenti" esteso a coach/atleta/genitore**: creato componente riutilizzabile `frontend/src/components/ActivityStartBanners.tsx` (dedup per team_id). Cablato in coach/index.tsx, athlete/index.tsx, parent/index.tsx leggendo `activity_banners` da /coach|/athlete|/parent/commitments. Prima i banner comparivano solo nelle viste admin (AdminCoachCommitments). Multi-squadra già supportato dal backend (_build_commitments_payload).

## Changelog 14/08/2026 (fork) — banner allenamenti esteso + fix vari
- **3° dirigente**: CONFERMATO che il codice attuale salva 3+ dirigenti (ruoli admin/viewer/dirigente/coordinatore) via POST /teams/{id}/assign-dirigenti (verificato API + pytest). Il problema del "3° non salvato" è dovuto al vecchio codice NON ancora deployato in produzione (accettava solo admin/viewer). Serve Deploy.
- **Data inizio attività**: campo in admin/team/[id].tsx ora usa formatDateInput (auto-slash gg/mm/aaaa), placeholder 'gg/mm/aaaa', keyboardType number-pad, maxLength 10.
- **Banner "Inizio allenamenti" esteso a ACCESSO LITE minore**: minor/index.tsx ora rende <ActivityStartBanners banners={data.commitments.activity_banners}/>. Backend /minor/dashboard ora costruisce team_athletes_map con team_id + team_id_2 + team_id_secondary + team_ids[] (multi-squadra). Verificato a video con login lite.
- **testID aggiunti**: team-edit-toggle-btn (matita) e team-save-btn (Salva Modifiche) in admin/team/[id].tsx per automazione test.
- Banner già presenti (sessione precedente) in coach/athlete/parent (component riutilizzabile ActivityStartBanners con dedup per team_id).
- Test: /app/backend/tests/test_activity_banners_and_dirigenti.py (4/4 pass), iteration_101.json.

## Changelog 14/08/2026 (fork) — fix scheda staff admin
- **Foto 1 - Checkbox FIPAV non memorizzate**: GET /users/{user_id} NON restituiva is_scorekeeper/is_referee/is_accompanying_manager → al reload le checkbox si azzeravano (il PATCH salvava correttamente in DB). Aggiunti i 3 flag alla risposta GET (server.py ~6757). Verificato: toggle persiste dopo reload.
- **Foto 3 - Data/luogo di nascita non visibili**: GET /users/{user_id} ora fa fallback su birth_date/birth_place e, se ancora vuoti, DECODIFICA data e luogo dal codice fiscale via libreria `codicefiscale.decode()` (helper _cf_birth_fallback, server.py ~6718). Verificato: dob e place mostrati anche quando i campi anagrafici sono vuoti.
- Modifiche SOLO backend (nessun rebuild frontend). Serve Deploy per produzione.

## Changelog 14/08/2026 (fork) — fix anteprima WhatsApp (og:image locandina)
- **Problema**: incollando il link della campagna pre-iscrizione su WhatsApp l'immagine (locandina) non compariva. Causa: la cover_image veniva salvata/servita in dimensione originale (anche >6MB) → WhatsApp non mostra og:image troppo pesanti (~limite 300KB).
- **Fix (server.py)**: nuovo helper `_process_cover_for_og()` che ridimensiona a max 1200px e comprime JPEG < ~280KB. Usato in GET /preseason/public/{id}/cover.jpg (ora serve sempre JPEG ottimizzato) e nella pagina /preseason/share/{id} per dichiarare og:image:type=image/jpeg + width/height reali post-resize. Testato: 6.5MB → 276KB.
- Solo backend → serve Deploy. NB: WhatsApp mette in cache l'anteprima; dopo il deploy testare con link "nuovo" (o aggiungere ?v=2) per forzare il re-scrape.

## Changelog 16/08/2026 (fork) — ricerca genitori per telefono + documenti in scheda atleta
- **Ricerca Genitori per telefono** (admin/parents.tsx): il filtro ora matcha anche il numero di telefono (confronto solo cifre, min 3). Placeholder aggiornato a "Cerca per nome, telefono o atleta...". Verificato: "3535632" trova ROSSI PAOLA.
- **Documenti firmati in Anagrafica atleta** (admin/athlete/[id].tsx): nuova card "Documenti Firmati" nel tab Anagrafica (collassabile). Carica GET /documents/signed?related_entity_id={athlete_id}; ogni voce apre il PDF via GET /documents/download/{id} (web: window.open blob; mobile: expo-file-system + Sharing). Verificato a video (Test REACT → "Informativa Privacy GDPR - Staff").
- Solo frontend (endpoint backend già esistenti) → serve Deploy per produzione.

## Changelog 16/08/2026 (fork) — Residenza obbligatoria per firma GDPR
- **Richiesta utente**: RICCI SARA (minore) aveva firmato il GDPR con "Residente in ____" vuoto. Reso obbligatorio inserire la residenza prima della firma.
- **Backend (server.py)**: nuovo helper `_missing_residence()` (Indirizzo, Città, Provincia, CAP). Integrato in `validate_athlete_profile` e `validate_parent_profile` (→ blocca firma GDPR minore via check_profiles_for_document su /documents/sign e /documents/sign-gdpr-privacy). Aggiunta validazione residenza anche nel ramo self-sign adulto/staff (`gdpr_adult`) leggendo request.signer_* + full_user.
- Ambito: atleti + genitori + staff/adulti (come richiesto "Tutti"). Documenti GIÀ firmati NON toccati (solo firme future).
- Campi residenza già editabili in anagrafica atleta/genitore. Errore 400 mostrato nel modale GDPR (alert con detail).
- Solo backend → serve Deploy. Verificato con unit test dei validator (atleta/genitore senza residenza → 4 campi mancanti; con residenza → 0).
- NB (da confermare con utente): richiedere la residenza ANCHE al genitore blocca la firma finché ogni genitore non completa la propria residenza (non appare sul documento del minore). Valutare se rilassare.

## Changelog 16/08/2026 (fork) — residenza solo atleta + squadre multi-slot
- **Residenza GDPR ora obbligatoria SOLO per l'atleta** (rimossa da validate_parent_profile; nel ramo self-sign gdpr_adult il check residenza si applica solo se role=='athlete', non per staff).
- **Conteggio squadre per QUALSIASI slot** (fix "U.19 = 0 ma dentro 3 atleti"):
  - `/teams/athletes-count/all`: aggregazione su $setUnion di team_ids + team_id + team_id_2 → ogni atleta conta in ogni squadra in cui gioca.
  - `/teams/{id}/athletes-count`, `/teams/{id}/athletes`, DELETE team check: query $or su team_id/team_id_2/team_ids.
  - `/teams/{id}/attendance-stats`: roster include anche team_ids; ogni atleta ora ha `is_primary_team`, `primary_team_id`, `primary_team_name`.
- **Etichetta Principale/Aggregata** nel Registro Presenze (attendances.tsx): "🏠 Principale" (paga qui) vs "➕ Aggregata · paga in [Squadra]". Risolve la visibilità "chi non paga doppia quota". Verificato a video (Test REACT → Aggregata · paga in Under 16).
- Modello: quota addebitata SOLO sulla squadra principale (team_ids[0]); squadre aggiuntive NON creano quota doppia (già così). Consiglio all'utente: impostare come 1ª squadra quella "casa" dove l'atleta paga/gioca di più.
- Assegnazione multi-squadra (1ª/2ª/3ª) già supportata nell'edit atleta admin (team_ids dinamico).
- Backend + frontend → serve Deploy.

## Changelog 16/08/2026 (fork) — lentezza pagine (immagini pesanti)
- Sintomo: profilo società ~25s, biglietto da visita ~15s, anagrafica atleta ~15s.
- Causa: NON foto atleta/squadra (non caricate), ma le immagini caricate sul doc settings/società (LOGO, sport_image, timbro/firma stamp_signature) servite NON compresse. La pagina anagrafica atleta chiama GET /settings/society?include_images=true (routes/settings.py) → caricava tutto pesante.
- Fix compressione on-read (max 1280px, JPEG q72, >500KB) con persistenza, aggiunta a: GET /societies/my (logo), GET /athletes/{id} (athlete_photo/artistic), GET /auth/me?include_images (server.py HEAVY_IMAGE_FIELDS), e soprattutto GET /settings/society?include_images (routes/settings.py: logo/sport_image/stamp_signature) che era l'endpoint realmente usato dalle pagine.
- Bug preesistente corretto: get_society_settings NON restituiva has_logo/has_sport_image/has_stamp_signature (persi nel rebuild del dict) → il frontend poteva ricaricare sempre le versioni pesanti. Ora inclusi.
- Verificato: pytest tests/test_settings_society_image_compression.py 9/9, iteration_102/103.json. Backend-only → serve Deploy.
- NB: se dopo il deploy nessuna immagine è grande e la lentezza persiste, la causa residua è probabilmente l'hosting (Render cold start/RAM) o latenza DB — da investigare sui log del backend deployato.

### Performance 18/08/2026 — Vera causa lentezza produzione: troppe richieste + PIL bloccante
- **Diagnosi (dai DevTools Network dell'utente su /admin/society-profile)**: l'endpoint `certificate-override-status` (0,4 kB) impiegava ~7,3s x4 e `/admin/notifications` veniva chiamato 15+ volte. NON è la dimensione delle immagini: è il **numero di richieste** dei poller globali che satura le ~6 connessioni del browser + il singolo worker Render → richieste in coda per secondi.
- **Fix 1 — Riduzione traffico poller (frontend)**: nuovo modulo `src/services/pollGate.ts` con:
  - `getPrimaryAdminStatusCached()` → una sola chiamata a `/admin/primary-admin/status` ogni 60s condivisa dai 3 componenti che la usavano (CertificateOverridePopup 10s, GlobalOverrideStatusPopup 30s, PrimaryAdminDeclarationModal 60s) + dedup delle chiamate in volo.
  - `isTabActive()` → i poller saltano le richieste quando la scheda del browser non è in primo piano.
  - `CertificateOverridePopup`: intervallo 10s → 30s.
  - Applicato pausa-scheda anche ad `AdminLiveStats` (30s) e `AdminNotesButton` (60s).
  - Bug preesistente corretto in GlobalOverrideStatusPopup: `setVisible` inesistente → `setPopupVisible`.
- **Fix 2 — Compressione PIL fuori dall'event loop (backend)**: `compress_base64_image` su path GET caldi (get_athlete, get_team, get_society_settings?include_images, GET /auth/me?include_images) ora gira in thread separato via `asyncio.to_thread`. Prima, comprimere un'immagine grande bloccava l'intero worker Render, congelando tutte le richieste in coda (spiega gli stalli da 7s su endpoint minuscoli).
- **Diagnostica aggiunta**: middleware `RequestTimingMiddleware` in server.py → logga `⏱️ SLOW GET /api/... in Xms` (>1s) e aggiunge header `X-Response-Time-ms` a ogni risposta. Utile per confermare sui log Render quale endpoint è lento.
- **Conteggio squadre multi-team**: verificato che `/teams/athletes-count/all` usa già UNA sola aggregazione (efficiente) e `/teams` esclude le immagini pesanti → non è la causa della lentezza squadre; la causa è il traffico poller comune a tutte le pagine admin.
- **NB DEPLOY**: frontend → Vercel; backend → Render. Le migliorie hanno effetto solo dopo il deploy.


### Performance 18/08/2026 (bis) — CAUSA REALE trovata via log Render (X-Response-Time)
Il middleware di timing ha rivelato che il **server stesso** impiegava ~7,3s (non coda browser).
Tutti gli endpoint lenti condividevano una causa: **scaricavano immagini base64 multi-MB inutilmente**.
- **FIX 1** `GET /settings/certificate-override-status` (routes/settings.py ~549): faceva `find_one(_q)` SENZA projection → scaricava logo+sport_image+timbro (MB) solo per leggere un booleano, ogni 30s. Aggiunta projection `{logo:0, sport_image:0, stamp_signature:0}`.
- **FIX 2** `GET /settings/society` (include_images=false): l'`existence_probe` faceva `find_one` con `{logo:1,sport_image:1,stamp_signature:1}` scaricando le 3 immagini pesanti solo per calcolare i booleani has_logo/has_sport_image/has_stamp_signature. Sostituito con **aggregazione `$strLenBytes`** che calcola i booleani lato DB SENZA trasferire i base64. `/settings/society` è chiamato da quasi ogni pagina → questo risolve i "7-10s su tutte le cartelle".
- **FIX 3** `GET /certificates/expiring` (server.py ~13439): faceva `db.athletes.find({society_id}).to_list(1000)` scaricando TUTTI gli atleti con le loro foto base64 solo per leggere data scadenza+nome. Aggiunta projection `{id,full_name,medical_certificate_expiry}`.
- Verifica locale: i 3 endpoint ora rispondono in ~3-7ms (prima 7,3s / 1,5s in prod). Da confermare in produzione dopo DEPLOY su Render.
- NB: `whatsapp/pending-count` (1,8s) è già mitigato da cache in-memory 60s → lasciato così.
- Lezione: le immagini base64 dentro i documenti Mongo rendono lento OGNI `find` senza projection. Fix definitivo futuro: spostare le immagini su Object Storage.

### Performance 18/08/2026 (ter) — Liste che scaricavano base64 (le "altre cartelle" 7-8s)
Dopo il fix su settings, Squadre e Profilo Società andavano bene ma le altre cartelle restavano a 7-8s.
Causa: le liste scaricavano documenti completi con foto/immagini base64. Aggiunte projection:
- `GET /athletes` (server.py ~8320): escludeva già le foto nella risposta ma le SCARICAVA (fino a 5000 atleti con base64). Projection di ESCLUSIONE campi pesanti (athlete_photo, *_artistic, doc_*, id_*, document_*, privacy_signature, receipt_signature_base64, privacy_pdf_snapshot). → cartella "Atleti".
- `GET /users/parents` (server.py ~6301): projection INCLUSIVA soli campi usati (no profile_photo). → cartella "Genitori".
- `GET /payments/registro-stagione` (~14082) e `GET /payments/solleciti` (~14127): projection esclusione base64 su athletes (fino a 10000). Anche settings.find_one del registro con projection immagini.
- `GET /certificates/expiring` (~13439): projection {id, full_name, medical_certificate_expiry}.
- `GET /documents/signed`: già OK (projection {pdf_base64:0}).
- Staff (dirigenti/coaches/collaboratori): la risposta INCLUDE profile_photo (card con foto) → NON toccati per non rompere la UI (liste piccole).
- Verifica locale: tutti gli endpoint ora 3-28ms.
- TODO futuro: spostare le foto su Object Storage per eliminare il problema alla radice; risolvere N+1 in /payments/solleciti (una find payments per atleta).

### Bug 18/08/2026 — Solleciti "Fine prova" falsi (prova non ancora iniziata)
Segnalazione utente: nei Solleciti WhatsApp comparivano atlete con "Fine prova" (es. 15/08, 17/08)
anche se gli allenamenti non erano iniziati; e alcune erano senza certificato → non avrebbero potuto
fare la prova.
Causa: in `get_pending_reminders` (server.py ~35914) i casi "trial ended" (b: no certificato,
c: no privacy, d: no decisione) scattavano SOLO in base a `trial_end_date <= oggi`, senza verificare
se la prova fosse davvero iniziata. Alcuni flussi di registrazione impostano `trial_end_date`
(= registrazione + 7gg) SUBITO alla creazione, lasciando `trial_start_date = None`. `trial_start_date`
invece viene valorizzata SOLO al primo scan QR (primo allenamento).
Fix: la guardia ora è `if ts and te and te <= today:` → "Fine prova" scatta solo se la prova è
realmente iniziata (trial_start_date valorizzata). Aggiunta anche projection base64 su athletes in
questa funzione (alimenta il badge solleciti in polling).
Da confermare in produzione dopo DEPLOY.


### 06/2026 — Migrazione LOGO società → Emergent Object Storage
Obiettivo: togliere i base64 multi-MB dei loghi dai documenti Mongo (alleggerisce M0 e payload).
Implementazione:
- Nuovo modulo condiviso `/app/backend/storage_util.py` (init/put/get + compressione JPEG PIL + helper path).
- `routes/settings.py`:
  - PATCH `/settings/society`: se arriva `logo` (data URI O base64 grezzo, len>100, non http) → comprime a JPEG (max 800px, ~180KB) e carica su object storage; nel doc resta solo `logo_storage_path`, `logo=""`. Fallback: se upload fallisce tiene il valore originale.
  - GET `/settings/society/logo.png`: dual-read (storage → fallback base64 legacy).
  - GET `/settings/society?include_images=true`: se `logo_storage_path` e `logo` vuoto → idrata il base64 dallo storage (per anteprima edit + generazione PDF). `has_logo` considera anche `logo_storage_path`.
- `server.py`: helper `_settings_logo_b64(society)` (dual-read) applicato ai consumer server-side che leggono `settings.logo` come base64: card fiscale (`/society/card-fiscale`), card bancaria, ricevuta fiscale, login minore (`minor_login`), dashboard minore, share preseason JSON+HTML (`has_logo`).
- Frontend: `admin/settings/society.tsx` e `admin/society-profile.tsx` — upload logo ora wrappato come data URI; rendering logo reso robusto (`startsWith('data:')` evita il doppio prefisso `data:...data:...`).
- Script migrazione una-tantum: `/app/backend/migrate_logos_to_storage.py` (idempotente). In preview c'è 1 sola società.
- NOTA: `societies.logo` (business card `/societies/my`) NON migrato (collezione separata, invariato).
- Test: pytest `tests/test_logo_storage_and_cert_original.py` 9/9 PASS + verifica curl (raw base64 → migra; include_images ritorna singolo prefisso data URI).

### 06/2026 — Flag "Copia originale certificato ricevuta" (requisito FIPAV)
Esigenza utente: i genitori anticipano il certificato via foto (convalida rapida per far entrare in palestra),
ma la FIPAV richiede il possesso della COPIA ORIGINALE cartacea. Serve un flag indipendente dalla convalida.
Implementazione:
- Modello `Athlete`: campi `medical_certificate_original_received` (+ `_by`, `_by_name`, `_at`).
- Endpoint `PATCH /admin/athletes/{id}/certificate-original` body `{original_received: bool}` (solo admin/coordinatore con perm certificates, stessa società). Con true set flag+metadati; con false azzera.
- Frontend `admin/athlete/[id].tsx`: pulsante testID `cert-original-toggle` nella card Certificato Medico (visibile solo se esiste un certificato) con handler `handleToggleOriginal`, mostra "Registrata da X il Y".
- Test: incluso nel pytest sopra + verifica frontend testing agent OK.

### 06/2026 — Elenco "Copie Originali Certificati" (Dashboard Admin)
- Nuova card dashboard `certificate-originals-menu-card` (dopo "Consensi Immagini") → pagina `/admin/certificate-originals`.
- Backend: `GET /admin/athletes/certificate-originals` (admin/coord) → tutti gli atleti società con stato copia originale + squadra.
- Pagina `app/admin/certificate-originals.tsx`: 2 tab (Da consegnare / Già consegnato) con contatori, ordinamento Nome/Squadra, toggle per riga (`cert-orig-toggle-{id}`) che marca la consegna e sposta l'atleta tra i tab. Riusa PATCH `/admin/athletes/{id}/certificate-original`.
- Test: pytest `tests/test_certificate_originals_list.py` 4/4 + frontend OK (iteration 111).

### 06/2026 — Ricerca Atleti: filtro Squadra + Export con campi selezionabili (XLS/CSV)
- `app/admin/athlete-search.tsx`:
  - Nuovo filtro Picker "Squadra" (`team-filter-picker`, squadre derivate dagli atleti caricati) integrato in applyFilters/clearFilters.
  - Sostituito il vecchio "Condividi XLS" (campi fissi) con pulsante "Esporta" (`open-export-modal-btn`) che apre un modal: toggle formato Excel(.xlsx)/CSV(.csv) (`format-xlsx`/`format-csv`), checkbox campi raggruppati (`field-{key}`) con "Seleziona/Deseleziona tutti" (`toggle-all-fields`), download (`download-export-btn`). CSV con BOM UTF-8 per accenti. Esporta gli atleti attualmente filtrati con solo i campi scelti, in ordine di catalogo.
- Backend: `GET /admin/athletes/export-data` (admin/coord) → `{fields:[{key,label,group}] (27 campi, 6 gruppi), rows:[{id, team_id, values}]}` con valori formattati (date dd/mm/yyyy, booleani Sì/No). Catalogo `EXPORT_FIELD_CATALOG` + helper `_fmt_export_date`.
- Campi export disponibili: Cognome, Nome, Data nascita, Sesso, Luogo/Prov. nascita, Codice Fiscale, Email, Tel atleta/padre/madre, Indirizzo, CAP, Città, Provincia, Squadra, Ruolo, Altezza, Peso, Elevazione, Stato, Tesserato, Codice atleta, Data iscrizione, Scad. certificato, Cert. verificato, Copia originale.
- Test: pytest 4/4 + frontend OK (iteration 112), download reale .xlsx/.csv catturato.


### 06/2026 — FIX anteprima WhatsApp (titolo + locandina non visibili)
Sintomo: condividendo il link `/api/preseason/share/{id}` WhatsApp mostrava solo il dominio, senza titolo né locandina.
Causa: l'endpoint `get_preseason_share_page` era LENTO (~12s in prod, misurato): (a) `find_one` senza proiezione caricava l'intero doc campagna col `cover_image` base64 multi-MB; (b) rifaceva `_process_cover_for_og` (PIL decode/resize) a OGNI richiesta; (c) caricava anche il logo società base64 (~519KB). I crawler social scadono dopo pochi secondi → nessuna preview.
Fix (server.py, endpoint /preseason/share/{id}):
- Campagna letta con aggregazione leggera (solo title/season/description/event_info/society_*, cover_storage_path, cover_width/height + booleano `has_cover_b64` via $strLenBytes) — NON trasferisce il base64.
- Società letta con aggregazione leggera (name, society_id, logo_storage_path + `has_logo_b64`) — NON carica il logo base64.
- Rimosso il PIL dal path della richiesta: dimensioni OG = cover_width/height salvate o default 1200×630 (l'immagine reale è servita da cover.jpg).
- Risultato preview: ~7ms (verificato) con og:title + og:image corretti.
IMPORTANTE: fix nel codice → richiede REDEPLOY per attivarsi in produzione. WhatsApp inoltre cache-a le preview per URL (ri-condividere/attendere; opz. Facebook Sharing Debugger). Cold start Render free tier resta un fattore per la primissima apertura dopo inattività.

### 06/2026 — Indici MongoDB aggiuntivi (performance apertura cartelle)
Segnalazione utente: app lenta nel caricare le cartelle. Analisi: molte collezioni CALDE erano SENZA indici → collection scan.
Aggiunti in `ensure_mongodb_indexes` (helper `_safe_idx`, idempotente, non bloccante):
- `societies` (id, society_id, invite_code) — 61 query, prima full-scan (impatto alto)
- `preseason_campaigns` (id, society_id), `preseason_responses` (id, campaign_id, society_id)
- `certificates` (id, athlete_id, society_id), `medical_certificates_archive` (id, athlete_id, society_id)
- compensi: coach/collaboratore/dirigente/atleta_pro/athlete/external_compensations + athlete_compensation_receipts + threshold_declarations (person_id + society_id)
- role_change_requests, deletion_requests, athlete_invitations (token), audit_logs
- payments (id, athlete_id single), login_attempts/login_rate_limits (email)
Verificato: creati correttamente, log "MongoDB indexes ensured.". NB: in produzione servono dopo REDEPLOY (gli indici si creano allo startup del backend).

NOTA button "Copia originale" mancante in produzione = feature non ancora deployata (in preview presente). Richiede redeploy.

### 06/2026 — Perf cartelle ATLETI / ATLETI PRO + robustezza pulsante Copia originale
Segnalazione utente: ATLETI e ATLETI PRO lente; pulsante "Copia originale" mancante su alcuni atleti.
Fix ATLETI PRO (GET /prime-squadre/athletes):
- Eliminato N+1: prima 1 query atleta_pro_compensations PER atleta → ora UNA query con $in + raggruppamento in memoria.
- Projection: esclusi campi base64 pesanti (foto/documenti) da athletes/users; teams solo id+name.
Fix ATLETI (GET /athletes): già projection base64 esclusa; aggiunto indice payments [athlete_id, paid].
Indici nuovi: atleta_pro_compensations [atleta_id, year]; athletes [society_id, is_compensated]; payments [athlete_id, paid].
Pulsante Copia originale (admin/athlete/[id].tsx): condizione resa robusta → mostra il pulsante se il certificato esiste da QUALSIASI fonte (documento `certificate` OPPURE `athlete.medical_certificate_expiry`), così non manca mai quando è presente "Certificato verificato". Verificato visivamente su atleta Test REACT.
NB: tutte le modifiche (indici + query + pulsante) si attivano in produzione dopo REDEPLOY.

### 06/2026 — 🔒 FIX multi-tenant: notifiche admin visibili tra società diverse (GDPR)
Segnalazione utente: in Sirio comparivano notifiche di "Richiesta cancellazione dati" fatte su Pallavolo Perugia.
Causa (routes/notifications.py): `GET /admin/notifications` per role ADMIN usava query `{}` → restituiva le admin_notifications di TUTTE le società. Stesso problema (mancava filtro society_id) su: unread-count, mark read, mark-all-read, delete, authorize/deny override.
Fix: TUTTE le query/mutazioni su admin_notifications ora filtrate per `society_id = current_user.society_id`.
Inoltre server.py request-deletion: la notifica ora è indirizzata alla società DELL'ATLETA (`athlete.society_id`) e non a quella del richiedente (che poteva essersi spostato in altra società).
Verificato in preview: /admin/notifications e unread-count restituiscono solo la società dell'utente. NB: attivo in produzione dopo REDEPLOY. Nessuna pulizia dati necessaria: le notifiche hanno già il society_id corretto, prima venivano solo mostrate a tutti.

### 06/2026 — Lista atleti lenta: modalità LIGHT (dati minimi)
Richiesta utente: la lista atleti carichi solo dati minimi (nome/cognome/squadra), i dettagli pesanti solo aprendo l'atleta; niente join inutili.
Analisi GET /athletes (default): oltre alla find, faceva (a) self-heal update_many a OGNI load, (b) "join" pagamenti `payments.find({athlete_id:$in, paid:True}).to_list(10000)` + calcolo residuo per atleta, (c) proiezione negativa (restituiva TUTTI i campi non-base64).
Fix: nuovo parametro `GET /athletes?light=true`:
- proiezione POSITIVA minima (id, full_name/first/last, team_id, status, athlete_type, is_compensated, is_withdrawn, is_trial, athlete_code, date_of_birth, review_dismissed_season, privacy_pending_renewal) + enrich team_name;
- SALTA il join pagamenti e il calcolo residuo (payment_residual/has_overpayment non inclusi);
- SALTA la scrittura self-heal.
Frontend admin/athletes.tsx: usa `sharedGet('/athletes?light=true')`. Il badge "sovrapagamento" (payment-derived) semplicemente non compare in lista (dettaglio pagamenti resta nella scheda atleta). Nessun filtro/ordinamento dipende dai campi pagamento → nessuna regressione.
La modalità piena resta default per gli altri consumer (athlete-search usa i campi anagrafici estesi). Payload lista ~3× più leggero; verificato lista renderizza (nomi/squadra/stato/sezioni). NB: attivo in produzione dopo REDEPLOY.

### 06/2026 — NOTA IMPORTANTE utente (correzione roadmap immagini)
- ⚠️ Su RegistraTEAM NON esistono foto profilo ATLETI. L'unica immagine "atleta-correlata" è la FOTO SQUADRA (team_photo).
- Requisito per il futuro: la foto squadra va mostrata come MINIATURA (thumbnail) e, al click, si espande a schermo intero. Da migrare su Object Storage con questo pattern (thumbnail + full).
- Piano concordato performance: 1) attendere il DEPLOY su Render e verificare la cartella ATLETI con la modalità light; 2) se ok, ESTENDERE la modalità light (dati minimi in lista, dettagli pesanti solo su click) a TUTTE le cartelle (Genitori, Staff/Coach, Dirigenti, ecc.).

### 06/2026 — Modalità LIGHT estesa a tutte le cartelle staff/utenti
Richiesta utente: alleggerire ATLETI 18+ PRO, GENITORI, DIRIGENTI, COACH, COLLABORATORI (come fatto per ATLETI).
Backend:
- Costante `_USER_LIST_EXCL` (esclude base64: profile_photo, profile_photo_artistic, signature, scansioni doc, privacy_pdf_snapshot, contract_pdf_base64) applicata ai find di: /users/coaches, /users/collaboratori, /users/collaboratorees, /users/dirigenti. Le liste usano avatar EMOJI (non la foto) e le PATCH inviano solo campi specifici → nessun rischio di wipe foto.
- /users/dirigenti: anche il find teams ora proiettato a {id,name} (niente team_photo base64).
- /users/parents: era già light (projection 18/08).
- GET /athletes?light=true: aggiunti parent_id/second_parent_id alla projection/response (servono a parents.tsx per mappare i figli).
Frontend: prime-squadre.tsx (loadAllAthletes) e parents.tsx ora usano `/athletes?light=true`.
Verificato via curl: coaches/dirigenti/collaboratorees/parents veloci, profile_photo=null (base64 escluso). Smoke test frontend: le 4 cartelle renderizzano senza errori.
NB: attivo in produzione dopo REDEPLOY. Piano: dopo il deploy, l'utente verifica la velocità reale su Render.
Roadmap: foto SQUADRA (unica immagine) → thumbnail + espandi al click su Object Storage (da fare).

### 06/2026 — VERA causa lentezza cartelle: settings+logo caricato ad OGNI richiesta
Contesto: utente segnala 6s in PRODUZIONE anche con ?light=true. Verificato che gli indici richiesti (users: id, society_id, role, [society_id,role]; athletes: id, society_id, ...; teams: id, society_id; settings: [type,society_id]) ESISTONO GIÀ → non erano loro il problema.
Root cause: `utils.get_current_season_for_society(db, society_id)` è chiamata a OGNI endpoint di lista e faceva `db.settings.find_one({type,society_id})` SENZA projection → trascinava il LOGO base64 (fino a ~519KB, in produzione non ancora migrato) ad ogni apertura cartella. La modalità light NON lo evitava (chiamava comunque questa funzione) → ecco perché in prod non era bastata.
Fix (utils.py): (1) projection {season_start_month, season_start_day} → niente logo; (2) cache in-process `_SEASON_CFG_CACHE` per società, TTL 600s → azzera le query ripetute durante i burst. Verificato: stagione corretta (2026-2027), prima call ~3ms, cached ~0.01ms.
Nota: il log ripetuto "Pre-season reminder scheduler started" è un artefatto del reloader uvicorn in PREVIEW (--reload), NON un loop di produzione (in prod parte una sola volta).
`get_current_user` è già proiettato+cache (non carica logo). NB: attivo in produzione dopo REDEPLOY.

### 06/2026 — Ottimizzazione stats Atleti PRO + apertura singolo atleta (VERIFICATO iter 113)
Segnalazione: GET /prime-squadre/stats lentissima (5.8s) rallentava la cartella Atleti PRO; apertura singolo atleta ancora lenta.
Fix stats (server.py get_prime_squadre_stats):
- projection su settings (niente logo base64); count atleti compensati SCOPED per società (usa indice [society_id,is_compensated]) → prima count_documents({is_compensated:True}) NON scoped (scan + leak multi-tenant);
- somma compensi via AGGREGAZIONE $group scoped agli atleti della società (niente pull di documenti);
- CACHE TTL 600s: nuova cache generica `_TTL_RESULT_CACHE` + `_ttl_cache_get/set/invalidate_ttl_cache`.
- Risultato: 5.8s → ~0.2s (verificato ~27x).
Fix apertura singolo atleta (admin/athlete/[id].tsx): il fetch `/settings/society?include_images=true` (logo ~519KB) NON blocca più l'apertura: si caricano prima le settings LEGGERE (ruoli/caratteristiche/stagione + campi testo), poi logo/timbro in BACKGROUND (servono solo ai PDF ricevuta/tessera). `/users` è chiamato solo su azione "collega genitore", non all'apertura.
Collegamento PRO↔normali: i PRO sono atleti is_compensated=True; dopo il fix N+1 (prime-squadre/athletes, una query $in) e stats (una aggregazione) NON ci sono loop pesanti sul DB.
Verificato testing agent iter 113 (7/7 backend + frontend, nessuna regressione su athletes/coaches/dirigenti/parents). NB: attivo in produzione dopo REDEPLOY.
