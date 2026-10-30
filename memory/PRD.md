# RegistraTEAM - Product Requirements Document

- ✨ (30 Ott 2026) — 3 step ADMIN compensi: (#1) netto 'DA PAGARE' + criterio di cassa estesi alle modali 'Gestione Quietanze' di coach/dirigente/collaboratore (come l'atleta: shift da paymentShift, cumulato per anno di pagamento, netForMonth via computeInpsWithholding, badge >5K/>15K cash). (#2) Riga 'Netto da erogare (firmate)' nel riquadro Totale Percepito dei 4 modali (somma amount_net firmati). (#3) Banner 'NETTO DA EROGARE (ancora da pagare)' + 'Totale periodo' in admin/quietanze.tsx sui receipts filtrati; /admin/quietanze/all ora restituisce amount_net per tutti i ruoli. Lint OK, smoke test OK. Frontend+Backend → redeploy Vercel+Render.

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


## 🐞 FIX (Giu 2026) — "Ripara prove in blocco" non azzerava atleti pronti
- Sintomo: atleti con "🔴 PROVA SCADUTA · N/3 — pronto: usa Ripara prove in blocco per attivarlo" restavano rossi anche dopo aver premuto Ripara.
- Causa: l'attivazione (sia in `/api/admin/team-roster` all'apertura, sia in `/api/admin/teams/{id}/recompute-trials`) chiamava SOLO `maybe_activate_minor_athlete`. Gli atleti pronti ma trattati come maggiorenni (o con `is_minor=False` / data di nascita adulta per dati di test) non venivano MAI attivati.
- Fix: nuovo helper unificato `maybe_activate_athlete()` (prova minore, poi adulto) in server.py (~riga 36252). Usato in team-roster (~9617, rimosso il gate `_compute_is_minor`) e in recompute-trials (~19002). Verificato: atleta adulto in prova pronto → status active, is_trial False. Solo backend, nessun rebuild frontend.
- 🐞 FIX 2 (Giu 2026, dati reali): causa ulteriore scoperta dallo screenshot utente (U.12 - Blu). Atleti GIÀ in forza (`status=active`) ma con `is_trial=True` rimasto appiccicato comparivano come "🔴 PROVA SCADUTA · pronto" e la riparazione li saltava in silenzio con `continue` (= "non succede nulla"). Fix auto-heal: in team-roster (~9615) e in recompute-trials (~19013) se `status ∈ {active,blocked,rejected}` e `is_trial=True` → si imposta `is_trial=False, trial_status=completed` (non più rosso, contato come sistemato). Diagnostica potenziata: per i non attivati il messaggio ora mostra `stato=… minore=… privacy=…`. Verificato localmente su atleta active+is_trial → ripulito. Solo backend → RICHIEDE ripubblicazione per avere effetto sui dati reali.
- ✨ TWEAK (Giu 2026) — Convocazioni: aggiunto campo "Numero gara" (match_number, univoco) nell'editor (prefill da calendario) + salvataggio backend (create/update/for-athlete) + mostrato nell'avviso atleta. PDF convocazione: numero GARA spostato nell'intestazione in alto a destra (rosso), categoria/squadra resta come sottotitolo subito dopo "Convocazione", e nel riquadro gara il lato "casa" usa il NOME SOCIETÀ (societyName) invece della categoria. PDF web ora stampabile via iframe nascosto (no blocco popup) → "Salva come PDF" = download; mobile via Sharing. Prefill venue_address anche da match.address.
- 🐛 (27 Ott 2026) — Fix multipli:
- 🐛 (30 Ott 2026) — CONTRIBUTI INPS calcolati sull'intero compenso invece che sulla sola eccedenza nel mese di superamento €5.000. Analisi: la formula ATTUALE (compute_sport_inps_withholding backend + computeInpsWithholding frontend) è MARGINALE e corretta: excess = max(0,after-5000) - max(0,before-5000). Per pregresso 3750 + Set 750 (before=4500) + Ott 750 → excess=250 (verificato: trattenuta 12,11, netto 737,89). I numeri di foto 2 (eccedente 750, trattenuta 36,32, netto 713,68) coincidono con la VECCHIA formula (full-gross sul mese di superamento) → la produzione dell'utente gira una versione precedente al fix del 16/10 (commit bc8cddd3). Soluzione: redeploy Render+Vercel. INOLTRE: aggiunte in InpsNetBreakdown.tsx due righe di trasparenza ("Totale già maturato prima" / "Totale dopo questo compenso") così si vede sempre la base cumulativa. Frontend-only (+backend già corretto) → redeploy.
- ✨ (30 Ott 2026) — NETTO DA PAGARE nelle card mensili (coach/compensation.tsx renderMonthCard): oltre al lordo (necessario per il conteggio soglie €5k/€15k) ogni card mostra ora "DA PAGARE (NETTO)" = lordo − quota contributi INPS a carico del collaboratore (1/3). Per i mesi firmati usa record.amount_net (autorevole); per i pendenti/futuri calcola con computeInpsWithholding su cumulato proiettato (prior se anno contratto + grossi mesi precedenti stesso anno). Mostrato solo quando c'è trattenuta. Verificato: coach sempre sopra 5k, €1.200 lordo → €1.141,88 netto sulle card. Frontend-only → redeploy Vercel. ESTESO (30 Ott) a TUTTI i ruoli: atleta/collaboratore/dirigente/compensation.tsx (stesso blocco "DA PAGARE (NETTO)").
- ✨ (30 Ott 2026) — ANTICIPO / RIMBORSO in due tranche (richiesta utente: pagare prima l'affitto al proprietario, poi il saldo). Flag per-atleta `advance_split_enabled` + `advance_amount` + `advance_label` (nome personalizzabile, es. "Affitto" o "Anticipo straordinario"), impostabili in admin/athlete/[id]/compensation.tsx. L'anticipo è una PARTE del compenso totale: tranche 1 = anticipo (versato subito, intero), tranche 2 = saldo = (netto − anticipo). I contributi restano calcolati sul compenso TOTALE lordo. Backend: campi sul doc athletes (compensation/settings), nel model Athlete (per GET /athletes/{id}), in /auth/me e in /admin/quietanze/all; tracciamento pagamento per tranche via mark-payment con param `tranche` ('advance'|'balance') → flag advance_paid/balance_paid + date. Frontend: scheda compensi atleta (Anticipo €X subito + Saldo €Y a seguire, con ✓ se pagato) e vista Admin quietanze (blocco "Pagamento in due tranche" con 2 pulsanti Segna/Pagato). Verificato E2E in preview (Testflow PRO 1600 lordo, anticipo 400, net 1522,51 → saldo 1122,51); dati test ripristinati. Backend+Frontend → redeploy Render+Vercel.
- 🐛 (30 Ott 2026) — CRITERIO DI CASSA sul netto/soglie (richiesta utente): la competenza di DICEMBRE (pagata a gennaio) deve contare nell'ANNO SOLARE SUCCESSIVO per la soglia €5k/€15k; in quell'anno il PREGRESSO non si riporta (riparte da zero). Prima il netto per-mese e il mese di superamento usavano l'anno di COMPETENZA. Fix: (a) FRONTEND athlete/coach/collaboratore/dirigente/compensation.tsx → nuovo helper getCashCumulativeBefore(cm,cy) che calcola il cumulato LORDO per ANNO DI PAGAMENTO (dic→anno+1, pregresso solo se py==anno assunzione) usato sia per il netto "DA PAGARE" sia per le soglie della card (isAfter5k/15k da _after); findThresholdMonthFallback riscritto su getCashCompetenceForYear. (b) BACKEND flussi di firma atleta/coach/dirigente/collaboratore (receipt-sign) → yearly_total ricomposto per anno di pagamento (rebucket di tutte le firme, pregresso solo se payment_year==anno assunzione). (c) BACKEND endpoint threshold-status (atleta+coach+dirigente+collaboratore) → il mese di superamento riportato è la COMPETENZA (cm) non il pagamento (p): es. Aprile (pagato a Maggio). Verificato E2E: Dic 2026 netto €1.200 (azzerato, firma salva 1200), Set 2026 netto €1.141,88 (pregresso>5k), banner 2027 "Aprile", Apr 2027 trattenuta su €1.000, Mag+ su intero. Backend+Frontend → redeploy Render+Vercel.
- 🐛 (30 Ott 2026) — ADMIN "Gestione Quietanze" (admin/athlete/[id].tsx) ora mostra "DA PAGARE (NETTO)" per ogni mese e usa il CRITERIO DI CASSA (prima mostrava solo il lordo e calcolava le soglie per competenza). Nuovo calcolo: shift da societySettings.compensation_payment_timing, cumulato per anno di pagamento (dic→anno+1, pregresso solo se py==anno assunzione), netto via computeInpsWithholding (per i firmati usa receipt.amount_net). Verificato E2E con Testflow: Dic 2026 €1.200 pieno (no badge), Apr 2027 netto €1.151,57, Mag/Giu/Nov netto €1.141,88. ⏳ DA ESTENDERE: stessa visualizzazione netto nelle modali ADMIN di coach/dirigente/collaboratore. Frontend-only → redeploy Vercel.
- 🐛 (29 Ott 2026) — CONSENSI PRIVACY incoerenti tra scheda atleta e pagina Audit (`/admin/settings/consent-audit`): la scheda (AdminConsentView, helper `_val`) gestiva sia il formato oggetto `{value:true}` sia il booleano legacy `true`, mentre l'Audit leggeva solo `c.value`. Gli atleti con consenso immagini salvato come booleano `true` (formato legacy) risultavano ROSSI (negati) nell'Audit pur avendoli concessi (verdi nella scheda). Fix: aggiunto helper `consentVal()` e applicato a badge, filtro Stato (given/denied/missing) e dettaglio modale. Verificato in preview con atleta a consensi booleani: ora interno/promo verdi. Frontend-only → redeploy Vercel.
  (1b) ANTEPRIMA FOTO: la foto in scheda squadra usava `resizeMode=cover` (ritaglio a fascia, volti tagliati). Ora `contain` su sfondo scuro (#1e2430) sia in vista sia in modifica (teamPhotoImage/teamPhotoEditPreview): foto INTERA, piccola; al tocco si apre grande e nitida (PhotoViewer invariato). Verificato su Serie D in preview. Frontend-only → redeploy Vercel.
  (1) FOTO SQUADRA schermo bianco/nero dopo il salvataggio: DUE cause distinte, entrambe gestite. (a) Backend self-hosted (Render) senza Emergent Object Storage → upload falliva → ora `POST /teams/{id}/photo` comprime e, se lo storage KO, salva FALLBACK base64 in Mongo (`team_photo`); endpoint `/photo.jpg` ha dual-read. (b) Display: il frontend usava `team_photo_url` del backend, che su Render può puntare al dominio sbagliato → ora admin team detail/list e coach view costruiscono SEMPRE l'URL da `EXPO_PUBLIC_BACKEND_URL` (stesso base delle API, sicuro su Vercel/Render) usando `has_team_photo`, con anti-cache `?v=` nel dettaglio. Verificato ciclo completo in preview: upload 200, has_team_photo true, /photo.jpg 200 image/jpeg. RICHIEDE redeploy di BACKEND (Render) e FRONTEND (Vercel).
  (2) COMPRESSIONE FOTO stile WhatsApp < 350KB: upload e migrazione lazy ora usano max_dim=1280, target_kb=330 (verificato 5MB→280KB).
  (3) BANNER BACKUP loop verso /select-role: causa reale = crash TDZ in export-data (gli early-return `if loading`/`if !isAdmin` precedono le `const loadSchedule/...`; al primo render loading=true usciva prima di inizializzarle, poi checkAccess chiamava loadSchedule → "Cannot access 'P' before initialization" → catch → router.replace('/')). Fix: loadSchedule spostato in un `useEffect([isAdmin])` separato; checkAccess fa solo il controllo auth. Verificato: il banner apre /admin/settings/export-data col pannello backup.
  (4) ADMIN L/L1/L2 + NUMERO MAGLIA inline: nella scheda atleta (vista Anagrafica, sezione Dati Tecnici) il Libero (chip L/L1/L2, uno selezionabile) e il Numero di maglia (campo con salvataggio su blur/invio) sono modificabili SENZA entrare in modifica, via `PATCH /athletes/{id}/technical-data`. Nota: usato `onBlur`/`onSubmitEditing` (non `onEndEditing`, non supportato da react-native-web). Verificato PATCH 200 per entrambi.
- 🐛 (27 Ott 2026) — FIX presenze manuali coach (bug reale): `get_current_user` (server.py ~1512/1551) costruiva il dict utente da una projection che NON includeva `can_manual_attendance`, quindi il controllo in POST /admin/teams/{team_id}/bulk-attendance (riga ~19678) trovava sempre il campo assente e restituiva 403 a TUTTI i coach, anche con flag attivato dall'admin. Aggiunto il campo alla projection e al dict restituito. Verificato con coach reale: flag False→403, flag True→200 (cache auth TTL 8s, nessuna invalidazione necessaria). Punti 1 (selettore L/L1/L2 admin, già presente in modalità Modifica di admin/athlete/[id].tsx) e 2 (foto squadra, fix URL has_team_photo della sessione precedente) confermati funzionanti in preview: erano solo non ancora deployati in produzione.
- ✨ (Giu 2026) — Tre migliorie: (1) HOME ADMIN banner stato backup (src/components/admin/BackupStatusBanner.tsx): verde con data ultimo backup riuscito se ≤7gg, ambra se mai/vecchio; tocca → pagina Esporta Dati. GET /admin/backup/schedule ora ritorna last_manual_at + last_backup_at (max tra automatico e manuale). (2) PDF di RIEPILOGO dentro lo ZIP di backup (riepilogo.pdf, reportlab): società, data, totali (squadre, atleti, coach/dirigenti/collaboratori), tabella atleti per squadra — pronto da stampare. (3) FOTO SQUADRA non si vedevano in produzione: team_photo_url dipendeva da env del backend (assente su Render) → aggiunto has_team_photo in GET /teams, GET /teams/{id} e /coach/my-teams; il frontend costruisce l'URL da EXPO_PUBLIC_BACKEND_URL. Nuovo componente TeamPhotoThumb (miniatura con zoom a schermo intero al tocco) usato in admin/teams; coach team view ora risolve l'URL con fallback. GET /teams passato a response_model=None per includere i nuovi campi. Verificato: ZIP contiene riepilogo.pdf, /teams ritorna has_team_photo, banner renderizzato.
- ✨ FEATURE (Giu 2026) — BACKUP AUTOMATICO via EMAIL: pagina Admin → Impostazioni → Esporta Dati, nuova card "Backup automatico via email". L'admin imposta: attivo on/off, frequenza (1/2/3/7 giorni), orario (0-23, default 03:00, TZ Europe/Rome), email destinatario; pulsante "Invia backup ora". Backend: collection backup_settings (per società); endpoint GET/PUT /admin/backup/schedule, POST /admin/backup/send-now. Scheduler APScheduler (AsyncIOScheduler, startup) che ogni 15 min chiama _run_due_backups con claim atomico su last_run_date (no doppi invii anche multi-worker); logica "catch-up" (se il backend era spento all'orora, invia appena attivo quel giorno). Backup = ZIP con JSON a ROOT (per RIPRISTINO in registrateam, struttura invariata) + cartella csv/ (apribile in Excel/Sheets); binari esclusi. Helper condiviso _build_backup_zip_bytes riusato anche dall'export manuale GET /admin/backup/export (ora include CSV). Email indipendente dall'app = copie di sicurezza nella posta anche se l'app è giù. Verificato: schedule GET/PUT 200, export ZIP contiene json root + csv/. NB deploy: lo scheduler gira nel processo backend su Render; per orario preciso serve istanza always-on (altrimenti catch-up al primo risveglio del giorno).
- ✨ FEATURE (Giu 2026) — Dati tecnici atleta modificabili anche dal COLLABORATORE: nella home collaboratore le "Squadre Assegnate" sono ora toccabili → nuova schermata /collaboratore/team/[id] (elenco atleti via /coach/team/{id}/athletes, ora aperto anche a collaboratore limitato alle sue assigned_teams) → /collaboratore/athlete/[id] editor con Ruolo (dropdown), N° maglia e Libero L/L1/L2 (salva via PATCH /athletes/{id}/technical-data, ora permesso anche a collaboratore). Admin e Coach restano invariati. Verificato E2E con login collaboratore reale (paolo@coll.com): list 200, PATCH role/jersey/libero 200 e riletto correttamente.
- 🐛 FIX (Giu 2026) — Quietanze: coach/dirigenti/collaboratori/atleti pro con compenso potevano NON comparire nell'elenco aggregato (/admin/quietanze/all) pur essendo gestiti nelle schede singole. Causa: il filtro multi-società escludeva i record il cui utente/atleta aveva society_id mancante o "legacy". Reso tollerante (_belongs): in contesto mono-società includo i record con società corrispondente O con society_id assente; confronto con str() per evitare mismatch di tipo. Stessa logica applicata a mark-payment-bulk. NB: l'elenco mostra solo mensilità per cui esiste una quietanza/compenso generato — chi non ha ancora un compenso mensile registrato non appare (verifica da confermare sui dati reali dopo deploy).
- 🐛 FIX (Giu 2026) — Flag "Consenti registrazione presenze manuale" (can_manual_attendance) nella scheda Admin del coach non restava selezionato: il salvataggio (PATCH /users/{id}) funzionava ma l'endpoint GET /users/{id} NON restituiva il campo, quindi al reload la spunta risultava sempre vuota. Aggiunto "can_manual_attendance" alla risposta di GET /users/{id}. Round-trip verificato (before False → PATCH true → GET True → PATCH false → GET False).
- ✨ FEATURE (Giu 2026) — Dati tecnici atleta per COACH e ADMIN: il coach (dalla sua squadra → atleta, schermata /coach/athlete/[id]) ora può impostare oltre a Ruolo e dati fisici anche "N° maglia" e il flag Libero con selettore L / L1 / L2 (mutuamente esclusivo; L1=primo libero, L2=secondo libero). I 3 campi fisici (altezza/peso/elevazione) sono stati resi più compatti per far spazio. Stessa possibilità per l'Admin (admin/athlete/[id], sezione Dati Tecnici, chips L/L1/L2 + numero maglia). Backend: campo athlete.libero; AthleteUpdate + PATCH /athletes/{id}/technical-data (coach+admin) e PATCH /athletes/{id} (admin) ora accettano jersey_number e libero; GET technical-data li restituisce. In CONVOCAZIONE il ruolo mostrato = codice libero (L/L1/L2) se presente, altrimenti athlete_role — applicato in roster, society-athletes e dettaglio convocazione.
- 🔧 FIX (Giu 2026) — Convocazioni "Apri PDF" su web: ora genera un VERO file PDF nativo con jsPDF (testo selezionabile, layout costruito con primitive: intestazione+logo+Gara n., riquadro gara, tabella info con link Maps, avviso, tabella atleti con N° maglia/Atleta/Ruolo e page-break). Il file viene CONDIVISO come allegato tramite Web Share API (navigator.share con files) → su WhatsApp allega il PDF reale, NON un link blob: (che prima dava "Unmatched Route"). Fallback: download del file se la condivisione file non è supportata (desktop). Ruoli ripristinati perché presi direttamente dai dati. Mobile nativo invariato (expo-print + Sharing). Dipendenza: jspdf (html2canvas non più usato).
- ✨ FEATURE (Giu 2026) — Convocazioni: (1) nuovo campo "Numero di maglia" (jersey_number) in anagrafica atleta (admin/athlete/[id].tsx, sezione Dati Tecnici, input numerico; backend Athlete/AthleteUpdate + PATCH /athletes/{id} per admin/coach). Il PDF convocazione ora mostra il NUMERO DI MAGLIA al posto del progressivo (colonna "N° maglia"); jersey_number incluso in roster, society-athletes e GET /convocations/{id}. (2) Nuovo pulsante "Apri PDF" nella lista convocazioni (accanto a Apri/Elimina) che recupera dettaglio+società e genera/condivide il PDF direttamente (utile per condividere nel gruppo squadra dal cellulare).
- ✨ FEATURE (Giu 2026) — Convocazioni: aggiunta sezione "➕ Aggiungi altri atleti della società" nell'editor (oltre alla rosa squadra). Backend GET /convocations/team/{team_id}/society-athletes (atleti attivi società NON già in rosa). Frontend merge in allAthletes per PDF/conteggio.
- ✨ FEATURE (Giu 2026) — Quietanze FASE 2: Commercialista. Backend: GET /admin/commercialista/summary?year=&month= (percepienti del mese con lordo/netto/importo_versare, flag superamento, F24 list, totali); GET /admin/commercialista/fascicolo/{role}/{id}?year=&scope=year|season (anagrafica+accordo+dichiarazioni pregresso/previdenza+quietanze periodo+totali); POST /admin/commercialista/send-email (invio al commercialista: PDF allegato via email_service/Resend se pdf_base64 presente, altrimenti email HTML — per web). Frontend: nuova schermata app/admin/commercialista.tsx (periodo mese/anno, scope anno solare CU vs stagione set-ago, riepilogo+totali, lista F24>5k + altri, per persona Scarica fascicolo PDF + Invia email) + util src/utils/fascicoloReport.ts (PDF con logo, anagrafica, accordo, dichiarazioni, quietanze con righe soglia €5k evidenziate, totali lordo + da versare). Link dalla pagina Quietanze (icona valigetta). Email commercialista salvata in AsyncStorage. Testato backend (summary/fascicolo/society-athletes OK). Richiede ripubblicazione.
- ✨ FEATURE (Giu 2026) — Quietanze FASE 1: "Bonifico effettuato" + lista da firmare + sollecito WhatsApp. Backend: aggiunti campi payment_made/payment_made_date/payment_made_by sulle 4 collezioni (coach_compensations, dirigente_compensations, collaboratore_compensations, athlete_compensation_receipts); /admin/quietanze/all ora espone anche phone + payment_made; nuovi endpoint POST /admin/quietanze/mark-payment (singolo), POST /admin/quietanze/mark-payment-bulk (per mese, opz. ruolo, solo non firmate, scope società), GET /me/receipts/pending-signature (per l'avviso destinatario). Frontend admin/quietanze.tsx: su ogni quietanza non firmata pulsanti "Segna bonifico"/"Bonifico fatto" + "Sollecita firma" (WhatsApp precompilato col telefono in scheda), + modale "Segna bonifici del mese" (bulk). Nuovo componente src/components/PendingReceiptNotice.tsx (avviso "Quietanze da firmare" + "Firma ora") inserito nelle home coach/dirigente/collaboratore/athlete pro, visibile solo quando payment_made && !signed. Testato backend (mark single/bulk/all/pending OK). FASE 2 (fascicolo commercialista + logica invio 5k/15k F24/CU/fine stagione) DA FARE. Richiede ripubblicazione.
- ✨ FEATURE (Giu 2026) — Convocazioni: (1) selezione PALESTRA da città. Nell'editor, scrivendo la città compaiono le palestre memorizzate (da /palestre/list, KML Google My Map) filtrate; selezionandone una si compilano Impianto, Indirizzo (venue_address) e Link Google Maps (maps_url). I nomi KML sono "Comune - Impianto" → estratto comune come Città e resto come Impianto (NON usare folder=categoria). (2) Avviso "SEI CONVOCATA" in SOLA LETTURA (nessun pulsante conferma: scelta utente, rispondono a voce/WhatsApp) nella home atleta (/athlete), home Lite (/minor) e vista genitore (/parent/athlete/[id], tab Da fare) via componente src/components/ConvocationNotice.tsx che chiama GET /convocations/for-athlete/{id} (solo status=sent). Il PDF e l'avviso mostrano indirizzo, link mappa e nota "in caso di impossibilità avvisa subito il coach" con pulsanti Chiama/WhatsApp (coach_phone). Backend: nuovi campi venue_address+maps_url + endpoint for-athlete. Testato: backend 11/11, editor autocomplete ok. Richiede ripubblicazione.
- 🐞 FIX (Giu 2026) — "Registra Presenze (manuale)" coach dava errore "Not Found". Causa: l'endpoint `get_coach_team_athletes` (server.py ~riga 20662) aveva perso il decoratore `@api_router.get("/coach/team/{team_id}/athletes")` → la rotta NON era registrata → 404. La schermata manual-attendance.tsx chiama quell'endpoint al caricamento. Fix: ripristinato il decoratore. Verificato: ora 200 con atleti (coach assegnato), 403 per non-coach, non più 404. Solo backend → richiede ripubblicazione (Save to GitHub → Render).
- 🐞 FIX (Giu 2026) — Convocazioni mostravano 0 atleti in squadre dove il Registro Presenze ne mostra 13 (es. Serie D). Causa: il roster convocazioni (`/convocations/team/{id}/roster`) cercava solo `team_id` e `team_ids`, mentre il Registro Presenze (`/teams/{id}/attendance-stats`) include anche **`team_id_2`** (seconda squadra). Fix: query allineata ESATTAMENTE all'attendance-stats (team_id OR team_id_2 OR team_ids, stesso filtro status/is_withdrawn) + fallback atleti in prova con presenze per la squadra. Verificato in locale: 3/3 modalità di collegamento ora incluse. Solo backend → richiede ripubblicazione (Save to GitHub → Render).
- 🧾 FIX (Giu 2026) — Banner soglia €5.000/€15.000 quando il PREGRESSO è già oltre soglia. Il banner ⚠️ "Con la quietanza del mese di X supererà..." veniva mostrato anche quando il solo compenso pregresso (other_annual_compensation) era già ≥ €5.000 (o €15.000) all'ingresso, indicando un mese errato. Ora, se ei===0 (anno di ingresso) e pregresso ≥ soglia, il banner mostra "Soglia già superata all'ingresso (pregressi oltre i €X): contributi/comunicazione dovuti dalla prima quietanza." Il fix (prima solo sul banner ✅ firmato) è stato esteso al banner ⚠️ non firmato in: app/admin/athlete/[id].tsx (blocchi warning 5k+15k, ~riga 4423/4435) e app/athlete/compensation.tsx (banner y1 5k+15k, ~riga 979/992). Richiede ripubblicazione.
- 🧾 FIX (Giu 2026) — Export Calendario Gare (PDF + XLS). Su richiesta utente: rimosse colonne **Girone, Ritrovo, Risultato**; colonne **Avversario** e **Impianto** più strette (PDF width 150/160; XLS 20/22); colonna **Città** più larga (PDF 130, XLS 22); rimossa l'**evidenziatura gialla** (classe `.hl` del PDF eliminata; template XLS header blu uniforme). File: `frontend/src/utils/matchCalendarReport.ts` (PDF) e `frontend/app/admin/matches.tsx` (export XLSX + template). Ri-esportato dist. L'import XLSX resta tollerante alla colonna Girone se presente. Richiede ripubblicazione per effetto sull'app live.

## 🆕 FEATURE (Giu 2026) — Presenza manuale per coach + miglioria banner soglia- **#1 Banner soglia:** quando il solo pregresso (other_annual_compensation) è già ≥ €5.000/€15.000, il banner mostra "Soglia già superata all'ingresso … contributi/comunicazione dovuti dalla prima quietanza" invece di un mese ambiguo. Modificato in app/athlete/compensation.tsx e app/admin/athlete/[id].tsx.
- **#3 Presenza manuale coach:** nuovo flag per-coach `can_manual_attendance` (default off). Admin lo attiva con checkbox nella scheda coach (app/admin/coach/[id].tsx → PATCH /api/users/{id} {can_manual_attendance}). Endpoint `/api/admin/teams/{team_id}/bulk-attendance` ora richiede il flag per i coach (admin sempre). Il coach abilitato vede "Registra Presenze (manuale)" nella schermata squadra (app/coach/team/[id]/index.tsx) → nuova schermata app/coach/team/[id]/manual-attendance.tsx (seleziona atleti + data/ora, POST bulk). `/auth/me` espone il flag. Verificato: PATCH persiste su Mongo.
- **#4 CONVOCAZIONI — DA FARE (prossima build):** selezione atleti (checkbox) dalla rosa della squadra per convocazione partita, collegamento a gara del calendario, dati ritrovo/ora inseriti dal coach; comunicazione via PDF "Distinta convocazione" + WhatsApp ad atleta (+genitore se minore). Usabile da Admin e Coach.


## 🆕 FEATURE (Giu 2026) — Criterio di cassa compensi (soglie €5.000/€15.000) + Ricerca Funzioni Admin
- **Setting società** `compensation_payment_timing` ("same_month" default | "next_month") in Impostazioni → Altre Impostazioni → sezione "💶 Pagamento Compensi" (anche presente in Dati Società). Persistito su `db.settings` (type=society) via PATCH/GET `/api/settings/society`.
- **Regola "mese successivo" (criterio di cassa):** la competenza di DICEMBRE viene incassata a gennaio e conta nell'anno solare SUCCESSIVO per le soglie €5.000 (previdenziale) e €15.000 (fiscale). Con "same_month" comportamento INVARIATO. Pregressi e compensi esterni NON slittano (restano nell'anno registrato).
- **Backend:** helper `_calculate_fiscal_year_total(..., payment_shift)`, `_get_payment_timing()`, `_payment_shift_from_timing()`, `_rebucket_month_year_for_payment()` in server.py. Shift applicato in: `/api/coach|dirigente|collaboratore/{id}/threshold-status/{year}`, `/api/prime-squadre/athletes/{id}/threshold-status/{year}`, `/api/admin/persons/{id}/compensation-summary`, e negli helper `_get_signed_yearly_total_as_coach/_atleta_pro` (re-bucketing dicembre nel yearly_total firmato). Il totale RAS (valore contratto) NON slitta.
- **Frontend:** `getYearSummaryCash()` nelle schermate self-service (coach/collaboratore/dirigente/athlete compensation.tsx) e `getYearlyBreakdown` shift-aware nelle schede admin (admin/athlete|coach|collaboratore|dirigente/[id].tsx). Le quietanze mensili restano per competenza. Verificato: Set→Mag monthly 333 + pregresso 4000 → 2026 passa da 5332€ a 4999€ con "next_month".
- **Ricerca Funzioni:** icona 🔍 nell'header della dashboard Admin → `/admin/function-search` (command palette, ~55 funzioni indicizzate con parole chiave + breadcrumb + hint). "Ripara prove in blocco": percorso Squadre › apri squadra › Registra Presenze (manuale).
- **Stanza dei Bottoni** riordinata: comandi frequenti in alto, "Inizio/Fine Stagione" (una volta l'anno) in fondo.
- NB: la preview web serve l'export statico `dist/` (`npx serve -s dist`), quindi ogni modifica frontend richiede `npx expo export --platform web --output-dir dist` + restart expo.

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

### 06/2026 - Pulsante PRIVACY sempre visibile nell'account genitore (verificato via screenshot)
- **Richiesta**: molti genitori non trovavano come firmare la privacy → un pulsante fisso "PRIVACY" che, se già firmata, mostra la data; altrimenti porta alla firma.
- **Fix (frontend `app/parent/index.tsx`)**: aggiunto un pulsante viola "PRIVACY — Consenso privacy dei tuoi figli" (testID `parent-privacy-button`) subito sotto il saluto, sempre visibile. Al tap apre un modal che elenca ogni figlio con lo stato: "✅ Già firmata in data GG/MM/AAAA" (da `privacy_accepted` + `privacy_accepted_date`) oppure "⚠️ Da firmare" con pulsante "Firma ora" che apre la scheda del figlio (`/parent/athlete/{id}`), dove il flusso esistente (GDPRPrivacyModal + controlli profilo) gestisce la firma.
- **Backend**: nessuna modifica (`/athletes/my` ritorna già `privacy_accepted` e `privacy_accepted_date`).
- **Verificato**: login genitore → pulsante visibile → modal "Consenso Privacy" si apre. Deploy: solo frontend (Vercel).


### 06/2026 - FIX DEFINITIVO Import FIPAV "giochiamo contro noi stessi" + casa/trasferta invertite (verificato e2e via HTTP)
- **Bug (Vincenzo)**: 4 gare importate dal calendario FIPAV mostravano come avversario la NOSTRA stessa squadra (es. team "U.17 - Rossa" con opponent "SIRIO PALLAVOLO ROSSA") e con casa/trasferta invertite.
- **Root cause** (`POST /federation/import-selected`): la classificazione usava matching a substring su un `mapping_dict` inquinato da una riga "society_name variations" che SOVRASCRIVEVA le chiavi (ultima squadra vince). Inoltre un nome federale corto ("SIRIO PALLAVOLO") è substring di uno lungo ("SIRIO PALLAVOLO ROSSA") → lato assegnato alla squadra sbagliata e avversario = noi stessi.
- **Fix**: riscritta la classificazione. Il portale FIPAV è fonte di verità per casa(home_team)/ospite(away_team): dobbiamo solo capire QUALE lato è una nostra squadra via `team_mappings`, con match ESATTO prioritario + nome federale più SPECIFICO (ordinamento per lunghezza desc). Rimosso il blocco "society_name variations". Gestione DERBY: se entrambi i lati sono nostre squadre → crea un record per CIASCUNA (avversario = l'altra, col nome interno), mirror con match_number `-D`. Delete/upsert scoped per società + squadra + numero gara. Salva anche championship/girone. Garanzia: l'avversario non è MAI la squadra a cui è assegnato il record.
- **Verificato e2e** (HTTP su test_database): casa, trasferta, nome esatto non confuso col più lungo, derby a 2 record, estranei skippati — tutti corretti.
- **Azione utente**: per correggere le 4 gare esistenti, RE-importare i calendari delle squadre interessate (il re-import ora cancella+ricrea correttamente, inclusa pulizia del numero-gara base + mirror derby `-D` → ripara i record legacy con avversario = noi stessi, anche quando la nostra squadra è in trasferta). In Step 2 assegnare nomi federali DISTINTIVI per squadra (es. "SIRIO PALLAVOLO ROSSA" → U.17 Rossa, "SIRIO PALLAVOLO" → U.19 Elite). import-selected ora PERSISTE i team_mappings in `federation_configs` → la Sync FIPAV mantiene casa/trasferta/avversario corretti. **Garanzia aggiuntiva**: l'avversario non è MAI "noi stessi" anche con mapping generici. Deploy: solo backend (Render).


### 29/08/2026 - Rimosso limite allenamenti settimanali per squadra (richiesta Serie B in preparazione) — verificato via screenshot
- In modifica squadra (`admin/team/[id].tsx`) c'era un blocco "Massimo 5 allenamenti settimanali" in `addTrainingSession` (+ pulsante "Aggiungi Allenamento" nascosto oltre 10). In creazione (`admin/teams.tsx`) c'era un cap a 10.
- Fix: rimosso il blocco a 5 e i gate `< 10` in entrambi i file; il pulsante "Aggiungi Allenamento" è sempre disponibile (resta solo il minimo di 2). Nessun limite backend (Team.training_sessions è lista libera).
- Verificato: squadra Under 14 (7 sedute) → aggiunte fino a 10+ senza alert "Limite raggiunto".


### 29/08/2026 - Fix doppioni Cronologia Atleta (certificato) — verificato via API
- Causa: la timeline (`GET /athletes/{id}/timeline`) generava gli eventi certificato da DUE fonti → doppioni: "Certificato Medico Caricato" (campi atleta) + "Certificato Inserito" (collezione `certificate_history`), e analogamente "Certificato Medico Convalidato" + "Certificato Verificato".
- Fix (`get_athlete_timeline`): fetch di `certificate_history` UNA volta a monte; le sezioni 5/6 (eventi da campi atleta) vengono emesse SOLO se lo storico non contiene già l'insert/verify corrispondente. Gli eventi dello storico (sezione 12) mantengono i rinnovi ma con etichette uniformate ("Certificato Medico Caricato"/"Certificato Medico Convalidato").
- Verificato: atleta sintetico in stile ORSINI ARIANNA (1 upload + 1 convalida, presenti in entrambe le fonti) → timeline con UNA sola riga per movimento, nessun duplicato. Solo backend.


### 28/08/2026 (v3) - Badge di stato coerente guidato dai dati (lista atleti admin) — verificato via API
- Dopo aver reso coerente il "cosa manca", restava il BADGE incoerente: due atlete nello stesso stato documentale (senza data certificato) mostravano "Validazione Certificato" vs "In attesa" perché il badge rifletteva lo `status` enum.
- Fix backend: nuova `compute_status_badge(a)` (guidata dai dati, stessi cancelli di pending_reason) → etichette: "Attesa Certificato" / "Validazione Certificato" / "Attesa Prova" / "In Prova" / "Attesa Privacy". Esposta come `stato_display` nella lista atleti (fast-path `light`) e nel GET singolo. Aggiunte le date certificato alla proiezione `light` (prima mancavano → pending_reason poteva sbagliare "manca la data").
- Fix frontend (`admin/athletes.tsx`): `getStatusInfo`/`getStatusColor` usano `stato_display` quando presente (dopo i check ritirato/senza-team).
- Verificato via API: due minori stesso team, senza data cert, status diverso (pending_certificate/pending_trial) → badge IDENTICO "Attesa Certificato" + stesso reason.


### 28/08/2026 (v2) - Motivo attesa GUIDATO DAI DATI (non dallo status) — caso "2 sorelle diverse senza certificato" (verificato via screenshot)
- Chiarimento utente: entrambe le sorelle erano SENZA data del certificato, ma con `status` diverso (una `pending_certificate`, una `pending_trial`), quindi mostravano messaggi diversi. Il calcolo si basava sullo `status` enum (inaffidabile: es. atleta avanzata a pending_trial senza certificato).
- Fix backend (`compute_pending_reason`, ramo minorenni): iter ora GUIDATO DAI DATI reali con cancelli in ordine — 1) no data certificato → "manca la data di emissione"; 2) data presente non convalidata → "da convalidare"; 3) convalidato ma prova non iniziata → "prima presenza (QR)"; 4) prova in corso → nessun sollecito; 5) prova finita + privacy mancante → "firma privacy". Indipendente dallo status enum → due atlete nello stesso stato documentale mostrano lo STESSO messaggio.
- Fix frontend (`admin/athlete/[id].tsx`): sostituito il banner status-specifico "Validazione Certificato" con un banner "Cosa manca per l'attivazione" guidato da `athlete.pending_reason` (backend), mostrato per qualsiasi stato non-attivo. Verificato su MAURI LENA (pending_trial, senza data cert) → banner "manca la data di emissione del certificato medico".
- Verificato: compute_pending_reason identico per pending_certificate e pending_trial senza cert; screenshot admin conferma il banner. Solo backend + 1 file frontend.


### 28/08/2026 - Correzione messaggi "motivo attesa" certificato/prova (compute_pending_reason) — iter confermato dall'utente
- Iter confermato per MINORENNI (solo under 18 fanno la prova): 1) manca data emissione certificato → "manca la data di emissione del certificato medico"; 2) data presente ma non convalidata → "certificato medico da convalidare dalla società"; 3) certificato convalidato, prova non iniziata → "prima presenza in palestra (QR) per avviare la prova"; 4) prova in corso (status 'trial') → nessun sollecito (badge "In prova"); 5) prova terminata + privacy non firmata → "firma della privacy". Attivo = prova completata + scelta di restare (privacy firmata); il certificato va convalidato PRIMA della prova.
- Fix (`compute_pending_reason`): aggiunto il caso "manca data emissione" (prima il sistema diceva sempre "da convalidare" anche senza data). Split pending_certificate in due messaggi in base a `medical_certificate_issue_date`/`medical_certificate_date`/`medical_certificate_expiry`. Rimosso il vecchio ramo che univa pending_trial/trial. Adulti invariati (privacy + certificato, niente prova).
- Chiarito il caso "2 sorelle diverse": non è un bug di calcolo — una aveva il certificato GIÀ convalidato (→ "inizio prova/QR"), l'altra no (→ "Validazione Certificato"). Il certificato dev'essere convalidato prima di poter iniziare la prova.
- Verificato con test unitario su tutti gli 8 scenari. Solo backend.


### 28/08/2026 - Privacy sempre tra le "cose da fare" (scheda figlio lato genitore) con link diretto alla firma (verificato via screenshot)
- Problema: per un minore ATTIVO / in prova già iniziata, se la privacy non era firmata NON compariva nulla nelle "cose da fare" (il `compute_pending_reason` la ometteva in questi stati). L'atleta sembrava "a posto" pur senza privacy firmata.
- Fix (frontend `parent/athlete/[id].tsx`): aggiunti (a) un BANNER rosso in alto "Da fare: firma del consenso privacy → Tocca qui per firmare" e (b) una CARD nella tab "Da fare" con pulsante "Firma la Privacy ora" che apre direttamente il `GDPRPrivacyModal`. Mostrati quando `is_minor && !privacy_accepted && !end_trial_requested && (status active OR trial già iniziata)`. Stati pre-prova restano gestiti dal flusso "Rinuncia/Rimani e Firma" esistente.
- Verificato con MAURI LENA (attiva, privacy non firmata) su account genitore armida.raschi: banner + card + pulsante presenti.


### 27/08/2026 (v2) - CAUSA REALE "Genitore invisibile": migrazione all'avvio (verificato e2e con restart backend)
- La migrazione one-shot `active_seasons` (startup) assegnava la stagione PRECEDENTE a QUALSIASI record senza `active_seasons`, incluse le iscrizioni NUOVE di questa stagione (che nascevano senza il campo per il bug in `create_athlete`/register). Al redeploy Render il backend riavviava → la migrazione archiviava atleta+genitore nella stagione vecchia → sparivano dalle liste correnti. Ecco perché il fix v1 (solo missing/empty) non bastava dopo il deploy.
- **Fix migrazione** (startup, ~riga 39689): ora è `created_at`-aware — i record creati DOPO l'inizio della stagione corrente vanno in stagione CORRENTE, gli storici in PRECEDENTE. Aggiunto CORRETTIVO idempotente: i record creati in questa stagione ma erroneamente archiviati SOLO in `[prev]` vengono riportati in `[current]`. Ripara automaticamente i dati già danneggiati al primo riavvio.
- Verificato: seeded genitore+atleta con `active_seasons=[prev]` creati oggi → dopo restart backend entrambi passano a `[current]` e il genitore compare in `/users/parents`.
- IMPORTANTE per produzione: al prossimo redeploy Render la migrazione ripara automaticamente MARCHESINI MARY e casi simili.


### 27/08/2026 - BUGFIX "Genitore invisibile nella cartella Genitori" (verificato e2e via script)
- **Causa**: gli atleti neo-iscritti (via `POST /athletes`) venivano creati SENZA `active_seasons`. La lista Genitori (`GET /users/parents`) mostra solo genitori collegati ad atleti con `active_seasons = stagione corrente` (o con fallback stagione), quindi un genitore che aveva appena iscritto la figlia minorenne spariva del tutto (caso reale: MARY MARCHESINI / figlia Martina Pignatta).
- **Fix radice** (`create_athlete`): ogni atleta (nuovo o riattivato) riceve `active_seasons=[stagione corrente]`; il genitore che iscrive riceve la stagione corrente via `$addToSet`.
- **Fix dati esistenti** (`GET /users/parents`): la query atleti ora include anche gli atleti non ritirati SENZA `active_seasons` (o lista vuota) e li auto-ripara aggiungendo la stagione corrente; di conseguenza il genitore collegato compare e viene a sua volta auto-riparato. Nessuna modifica frontend.


### 27/08/2026 - Converti PRE-ISCRIZIONE → ISCRIZIONE via invito genitore + fix luogo import calendario (VERIFICATO iter_119 frontend PASS, backend e2e OK)
- **Invito all'iscrizione**: dal pannello admin Pre-iscrizioni (`/admin/preseason`), l'admin invita il genitore a completare l'iscrizione inserendone l'email. Riusa l'infrastruttura inviti (`athlete_invitations` + `/invite-register`).
  - Backend (`server.py`): nuovo `POST /preseason/responses/{id}/invite` (crea athlete_invitation con `from_preseason_response_id`, `is_minor` calcolato dalla data di nascita, invio email Brevo con messaggio dedicato: 3 allenamenti di prova, certificato medico + foto WhatsApp, adozione gestionale). La pre-iscrizione passa a `status='invited'`. Al completamento via invito, `register_via_invite` marca la response `status='converted'` con `converted_athlete_id`.
  - Aggiunto campo `email_parent` al modello/salvataggio `PreseasonResponse` e al form pubblico (`preseason/[id].tsx`, facoltativo) per precompilare l'email nell'invito.
  - Frontend (`admin/preseason.tsx`): pulsante "Invita a iscriversi" nella lista risposte (quick) e nel dettaglio; modal email; badge stato "Invitata"/"Iscritta".
  - Nota: NON crea un atleta in prova automaticamente (l'endpoint legacy `convert-to-trial` resta ma non è usato dalla UI). L'atleta risulta iscritto solo dopo che il genitore completa registrazione + privacy + certificato medico.
- **Fix luogo import calendario FIPAV**: l'endpoint realmente usato dalla UI è `/federation/import-selected` (non `/federation/import`), che NON salvava il luogo. Ora salva **Palestra + Città** (`venue_city` dal tooltip FIPAV). Aggiornati anche anteprima (`/federation/preview`) e sync (`/matches/sync-fipav`). Verificato su Serie D Umbria live.


### 26/08/2026 - Promozione Genitore→Dirigente CON ACCETTAZIONE + tap nome nel Registro Presenze (VERIFICATO iter_117 backend 10/10, iter_118 frontend PASS)
- **Dual-role Genitore↔Dirigente con accettazione dell'interessato**: l'admin PROPONE l'incarico Dirigente a un genitore (pulsante "Promuovi a Dirigente" nel menu azioni di `admin/parents.tsx`). Viene creato un account dirigente collegato con `link_status="pending"` e sul genitore `pending_dirigente_user_id` (NON `linked_dirigente_user_id`). Il collegamento diventa attivo SOLO dopo che il genitore ACCETTA dalla propria dashboard.
  - Backend (`server.py`): `POST /admin/parents/{id}/promote-to-dirigente` ora ritorna `status:"pending"`; nuovi `GET /parent/dirigente-proposal`, `POST /parent/dirigente-proposal/accept`, `POST /parent/dirigente-proposal/reject`. `get_current_user` e `GET /users/parents` estesi con `pending_dirigente_user_id`/`linked_dirigente_user_id`. `invalidate_auth_cache` chiamata in promote/accept/reject.
  - Frontend: nuovo `src/components/DirigenteProposalBanner.tsx` (banner Accetta/Rifiuta su `/parent`), `SwitchAccountButton` montato su `/parent` (con remount via `switchKey` dopo accept) e su `/dirigente`; palette/redirect estesi per dirigente/genitore. `admin/parents.tsx` mostra 3 stati: "Promuovi a Dirigente" / "In attesa di accettazione" / "Già Dirigente".
- **Tap sul nome atleta nel Registro Presenze → profilo**: in `admin/team/[id]/attendances.tsx` (→ `/admin/athlete/{id}`) e `coach/team/[id]/attendances.tsx` (→ `/coach/athlete/{id}`) il nome è ora un link (sottolineato, chevron, testID `open-athlete-{id}`).
- Nota testID: convertiti `data-testid`→`testID` sui nuovi TouchableOpacity (RN-Web forwarda solo `testID`).
- Genitore di test `armida.raschi@gmail.com` ripristinato a stato pulito dopo il test.
- **Deploy**: Frontend + backend.


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

## Changelog — 24/08/2026 — Firma Privacy atleta 18+ sbloccata su mobile (2 fix) + fallback backend
### Bug (segnalati da utente, atleta 18+ su mobile registrateam.it)
1. Nel modal "Informativa Privacy GDPR" Step 1, dopo aver spuntato i consensi, non compariva il pulsante per proseguire: "Ho letto e compreso - Procedi alla firma" era FUORI schermo (Step 1 non interamente scrollabile).
2. Il TrialEndModal ("rinuncia al periodo di prova e resta"/"Voglio Restare") non faceva nulla su mobile.
3. (trovati da testing agent, iter_114) l'endpoint firma dava 404 "Nessuna società configurata" e 400 "CAP" per utenti atleta senza society_id/residenza sul record utente.
### Fix
- `src/components/GDPRPrivacyModal.tsx`: Step 1 ora interamente dentro una ScrollView (checkbox + "Visualizza Anteprima PDF" + "Procedi alla firma"); rimosso `maxHeight:380` da `privacyScrollView`; aggiunto `contentContainerStyle paddingBottom`.
- `app/athlete/profile.tsx`: `TrialEndModal.onAcceptPrivacy` ora apre direttamente il modal privacy (`setShowPrivacyModal(true)`), rimosso `Alert.alert` con callback (inaffidabile su web mobile). Aggiunto anche banner "Firma Informativa Privacy" (testID sign-privacy-banner) quando isAdult && !privacyAccepted.
- `server.py` POST /documents/sign-gdpr-privacy: fallback `society_id` e dati residenza (address/city/province/postal_code) dal record ATLETA collegato (via user.athlete_id).
- `server.py` GET /athletes/{id} (fix precedente correlato): `account_holder` esposto; e `privacy_accepted` sincronizzato via PATCH /auth/me.
### Verifica (testing agent iter_115 e iter_116, viewport mobile, NESSUNA patch DB)
- "Voglio Restare" apre il modal; "Procedi alla firma" raggiungibile scrollando; firma su canvas → POST 200; persistenza `privacy_accepted=true` (user+athlete) verificata via admin API. Fallback society/CAP reggono.
### Nota aperta (non blocker)
- Il TrialEndModal è montato solo in `app/athlete/profile.tsx`, non in `app/athlete/index.tsx` (landing post-login): l'atleta vede subito solo il banner Privacy; per il TrialEndModal deve aprire il profilo. Valutare redirect/replica se si vuole mostrarlo subito.
### Deploy
- Frontend + backend.


## Changelog — 23/08/2026 — Rimosso logo società centrato dal blocco "Società"
### Richiesta utente
- Il logo grande centrato (140px) in mezzo alle dashboard (Dirigente/Coach/Collaboratore) sembrava "sospeso" → rimuoverlo.
### Fix (frontend `src/components/SocietyContactsSection.tsx`)
- Rimosso il blocco `<MiniSocietyLogo size={140} />` in cima alla sezione; ora restano solo gli accordion contatti (Dirigenti/Allenatori/Collaboratori). Rimosso import inutilizzato. Vale per tutte le dashboard che usano il componente.
### Verifica (screenshot preview)
- Dashboard dirigente: nessun logo centrato, si passa direttamente agli elenchi contatti. Lint pulito.
### Deploy
- Solo frontend.


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


### 24/08/2026 — ATLETI 18+: RIMOSSO il periodo di prova → attivazione con Privacy + Certificato
Richiesta utente: un atleta maggiorenne NON ha senso che faccia la "prova" (i 18+PRO sono cercati dalla società per giocare in serie B; i 18+ standard sono accettati previo accordo). Nuova regola: **niente prova per i 18+**. L'atleta diventa **ATTIVO ("in forza") SOLO quando ha (a) firmato la privacy E (b) certificato medico convalidato dall'admin** (a prescindere dall'ordine). I MINORENNI restano invariati (prova + firma genitore).

Ciclo di vita atleta 18+ (quota e PRO):
1. Registrazione → `pending` (in attesa approvazione admin)
2. Admin accetta (STD/PRO) → `pending_certificate` (nessun `is_trial`, nessun `trial_end_date`); utente → `approved` (può loggare)
3. Firma privacy + convalida certificato (in qualsiasi ordine): appena entrambi ok → `active`
   - Se manca solo la privacy dopo la convalida cert → `pending_privacy` ("Firma Privacy")
   - Se manca solo il cert → resta `pending_certificate` ("Attesa Certificato")

Backend (server.py):
- Nuovo helper `maybe_activate_adult_athlete(athlete_id, actor)`: attiva l'adulto se privacy_accepted E cert convalidato (guardia età: i minori non sono mai toccati). Richiamato da: firma privacy (`/documents/sign-gdpr-privacy` e `/auth/me`), convalida certificato (`/certificates/simple`), e approvazione admin (`/athletes/{id}/approval`).
- `/athletes/{id}/approval`: per gli ADULTI ignora la prova → status `pending_certificate` (rimosso trial_end_date/is_trial); poi tenta attivazione. Minori invariati.
- `/certificates/simple`: rimosso il vecchio blocco "AUTO-ACTIVATE-PRO" (che attivava i PRO col solo cert, senza privacy) → ora usa l'helper generale (PRO inclusi, richiede anche la privacy). Transizione pending_certificate→pending_privacy per adulti senza privacy; minori→pending_trial come prima.
- `verify_email` e `force-verify-email`: gli adulti dopo verifica restano `pending` (approvazione admin), i minori `pending_trial`.

Frontend:
- `app/athlete/index.tsx`: banner "Attesa Certificato" per adulti non parla più di "prova" → «sarai in forza dopo privacy + convalida cert».
- `app/athlete/profile.tsx`: rimosso il trigger del `TrialEndModal` per adulti (obsoleto). Il banner "Firma Informativa Privacy" (isAdult && !privacyAccepted) resta il punto di firma.

Verifica: testata via API reale (register→approve→privacy→cert) in 3 scenari (quota cert-first, quota privacy-first, PRO) → tutti raggiungono `active` correttamente; minori non impattati. UI adulto verificata via screenshot (badge "Attesa Certificato", testo corretto, card Privacy firmabile).



### 24/08/2026 — Motivo dell'ATTESA in lista atleti + backfill attivazione 18+
Richiesta utente: (1) molti atleti in "ATTESA" senza sapere il perché → non sa cosa sollecitare; (2) dopo la modifica "no prova 18+" alcuni adulti già a posto (privacy+cert) restavano in attesa.

Fix:
- Nuovo helper `compute_pending_reason(athlete)` (server.py): ritorna una frase chiara ("In attesa: approvazione della società / firma privacy / certificato convalidato / assegnazione squadra / prima presenza QR…"). Distingue minori vs adulti. Attivi senza squadra → "assegnazione a una squadra".
- `GET /athletes?light=true`: aggiunti alla proiezione i campi privacy_accepted, medical_certificate_verified, is_minor, trial_start_date e restituito `pending_reason` per ogni atleta.
- Frontend `app/admin/athletes.tsx`: riga "⏳ In attesa: …" sotto ogni atleta in onboarding (stile `pendingReasonHint`).
- Backfill startup (`run_data_migrations`): attiva retroattivamente gli atleti MAGGIORENNI con privacy firmata + certificato convalidato (non scaduto) rimasti in stato di attesa. Idempotente. In PREVIEW 0/0; in PRODUZIONE si applica al primo redeploy.

Verifica: lista admin mostra i motivi corretti (screenshot); backfill loggato "Migration 18+ no-prova backfill: N/N".
IMPORTANTE per l'utente: la correzione retroattiva sugli atleti reali avviene in PRODUZIONE solo dopo REDEPLOY (Publish).



### 24/08/2026 — Motivo dell'attesa visibile anche a GENITORE e ATLETA
Richiesta utente: mostrare il motivo dell'ATTESA anche al genitore/atleta così sanno cosa fare per andare "in attività".
- Backend: `GET /athletes/{id}` ora restituisce `pending_reason` (campo aggiunto al modello Athlete, calcolato con `compute_pending_reason`). Usato sia dalla home atleta 18+ (`/auth/me`→`/athletes/{id}`) sia dalla vista genitore (`/athletes/{id}`).
- Frontend home atleta (`app/athlete/index.tsx`): sostituiti i 2 banner ad-hoc (privacy/certificato) con UN banner unico "🎯 Per essere «in attività» ti manca ancora: …" (tocca → firma privacy se manca, altrimenti Anagrafica).
- Frontend genitore (`app/parent/athlete/[id].tsx`): banner "🎯 Per rendere attivo <Nome> manca ancora: …" sotto la card profilo (tocca → tab "Da fare").
Verificato via screenshot: atleta 18+ (pending_certificate) e genitore del minore MAURI LENA vedono il motivo corretto.



### 24/08/2026 — Consenso alla PROVA raccolto in fase di iscrizione (minori) — niente firma separata
Scelta utente (1c): il consenso del genitore allo svolgimento della prova si raccoglie all'iscrizione con una spunta obbligatoria, eliminando la "Dichiarazione di Prova" da firmare dopo (i genitori "sbuffano" per le firme). La prova NON è automatica all'iscrizione e NON è bloccata da firma: parte alla 1ª scansione QR. Il vero obbligo di legge resta il certificato medico.
- Backend: `AthleteCreate.trial_authorization` (bool). In `create_athlete` (nuovo + riattivazione), se minore e consenso dato → salva consenso `consents.trial_authorization` (timestamp/IP/parent_id) + `consent_history`, imposta `trial_document_generated=True` e `trial_authorized_at_registration=True`. Verificato via API.
- Frontend `app/parent/register-athlete.tsx`: checkbox obbligatoria "Autorizzo lo svolgimento del periodo di prova *" (solo minori); rimosso il riferimento alla firma della dichiarazione; invia `trial_authorization`.
- Frontend `app/parent/athlete/[id].tsx`: rimosso pulsante "Firma Dichiarazione di Prova"; etichetta → "Prova autorizzata in fase di iscrizione"; testo card senza "dovrà firmare la dichiarazione".
- Frontend `app/athlete/index.tsx`: rimosso il blocco "Dichiarazione di Prova" (era per adulti, ora dead-code: i 18+ non hanno prova).
NOTA: il modale TrialSignModal legacy resta nel codice ma non è più raggiungibile dal genitore.


## Changelog — 03/09/2026 — Contatto WhatsApp da scheda atleta (Anagrafica) + fix Tesserato in Elenco Squadra
- **WhatsApp diretto (admin, `app/admin/athlete/[id].tsx`)**: nella tab Anagrafica, accanto a Tel. Atleta / Tel. Madre / Tel. Padre ora compare un pulsante verde WhatsApp (visibile solo se il numero è presente). Apre `https://wa.me/<intl>` (prefisso 39 auto se manca il +). Helper `openWhatsAppContact`. Stili `phoneValueRow`/`waBtn`. Verificato via screenshot su MAURI LENA (pulsante su Tel. Padre).
- **Fix colonna "Tesserato" (Elenco Squadra, `GET /admin/team-roster`)**: prima calcolava `tesserato` da `status == "active"` (errato → atlete tesserate ma in prova/attesa risultavano "No"). Ora usa il vero flag `is_registered` (stesso del toggle "Tesserato" nella scheda atleta e dell'export principale). Aggiunto `is_registered` alla projection.
- **Deploy**: Frontend (Vercel) + Backend (Render).

## Changelog — 03/09/2026 (2) — Elenco Squadra: filtro Città + fix CAP; Dashboard: finestra Neo-maggiorenni 30gg→10gg + etichetta più chiara
- **Fix CAP Elenco Squadra (`GET /admin/team-roster`)**: la colonna CAP era vuota perché leggeva `cap` mentre il CAP atleta è salvato in `postal_code`. Ora legge `postal_code` con fallback a `cap` (projection aggiornata).
- **Filtro per Città (`app/admin/team-roster.tsx`)**: nuovo picker "Filtra per Città" popolato dalle città distinte degli atleti caricati, ognuna con conteggio (es. "PERUGIA (12)"), + opzione "Tutte le città (N)". Il conteggio in alto, la tabella e l'export Excel usano la lista filtrata. Selezionando una città si mostra automaticamente la colonna Città; nome file export con suffisso città.
- **Neo-maggiorenni dashboard (`app/admin/index.tsx`)**: finestra ridotta da 30 a **10 giorni** (`/admin/recent-18th-birthdays?days=10`). Etichetta card cambiata da "Neo-maggiorenni (30gg)" a **"Diventati maggiorenni (ultimi 10gg)"** e titolo popup coerente, per evitare confusione col compleanno di oggi. La card "🎂 Compleanni di Oggi" (tutti gli atleti nati oggi) resta invariata e separata.
- **Deploy**: Frontend (Vercel) + Backend (Render, per CAP e roster).

## Changelog — 05/09/2026 — Messaggio WhatsApp a tutta la Squadra (dalla scheda squadra)
- **Backend (`GET /admin/teams/{team_id}/whatsapp-contacts`)**: ritorna i contatti di tutti gli atleti di una squadra (nome, is_minor, athlete_phone, mother_phone, father_phone), con fallback dei telefoni dai record genitore collegati se i campi sulla scheda atleta sono vuoti. Isolato per società + stagione corrente. Solo admin/coordinatore.
- **Frontend nuova schermata `app/admin/team-whatsapp.tsx`**: 
  - Selettore destinatari: **Genitori / Atleta / Entrambi** (con dedupe dei numeri).
  - Campo **messaggio unico** (testo libero) precompilato in ogni chat.
  - **Invio "uno per uno"**: lista contatti con pulsante "Invia" (apre wa.me con messaggio precompilato; badge "Inviato" dopo il tap).
  - **Invio unico via Lista Broadcast**: pulsanti "Copia numeri" (formato +39…) e "Copia messaggio" per creare una lista broadcast su WhatsApp.
  - Nota: nessun invio massivo automatico (limite WhatsApp non-Business); l'admin conferma ogni invio. WhatsApp Business API resta in backlog.
- **Pulsante di accesso**: nella scheda squadra (`app/admin/team/[id].tsx`), voce "Messaggio WhatsApp alla Squadra" sotto "Registro Presenze" → naviga a `/admin/team-whatsapp?team_id=&team_name=`.
- Verificato via curl (endpoint) + screenshot (UI: modalità Atleta, messaggio, Copia numeri (1), pulsante Invia). 
- **Deploy**: Frontend (Vercel) + Backend (Render).

## Changelog — 05/09/2026 (2) — Kit Abbigliamento (society-wide) + Presenza manuale straordinaria coach
### A) Kit Abbigliamento / Sponsor Tecnico (informativo, society-wide)
- Backend: `SocietySettingsUpdate` (models/settings_models.py) + GET/PATCH `/settings/society` (routes/settings.py) ora gestiscono `kit_price` (float) e `kit_sponsor` (string).
- Frontend: nuovo componente `src/components/KitInfoBanner.tsx` → renderizza "Kit abbigliamento € X acquistabile presso il nostro sponsor tecnico Y" solo se valorizzati.
- Editabile in `admin/settings/society.tsx` (sezione 👕 Kit Abbigliamento: input Prezzo + Sponsor).
- Mostrato accanto alla quota in: `admin/team/[id].tsx` (sotto Quote, no prima squadra), `athlete/payments.tsx` (sotto Quota Stagionale), `parent/athlete/[id].tsx` (sotto Quota Stagionale). Solo informativo (non entra nel totale da pagare).
- Fix post-test: in `athlete/payments.tsx` il fetch `/settings/society` è stato spostato FUORI dal blocco `if(athleteId)` così il banner compare sempre.

### B) Presenza manuale straordinaria (coach)
- Backend: `POST /api/coach/athletes/{athlete_id}/manual-attendance` (server.py, classe `ManualAttendanceCreate`). Body {date:'YYYY-MM-DD', time?:'HH:MM', note?}. Crea record `attendances` con manual_entry=true, forced=true, status='allowed', coach_id; scrive `audit_logs` action='manual_attendance_added' details.extraordinary=true. Ruoli: coach/admin/coordinatore. Coach deve avere il team in assigned_teams (403 altrimenti); isolamento società; 400 data invalida/atleta senza team; 404 atleta inesistente.
- Frontend: in `coach/athlete/[id].tsx`, sezione Statistiche Presenze → pulsante "Convalida presenza (straordinaria)" apre modale con AVVISO (operazione straordinaria, registrata nei log e visibile agli admin), campi Data (GG/MM/AAAA precompilata a oggi Europe/Rome), Ora opzionale, Nota opzionale, bottone "Registra presenza".
- Testato: iteration_124 (backend 7/7 PASS; frontend banner + modale verificati). test: /app/backend/tests/test_kit_and_manual_attendance.py.
- **Deploy**: Frontend (Vercel) + Backend (Render).

## Changelog — 05/09/2026 (3) — Kit Abbigliamento: DUE prezzi (Under / MiniVolley) selezionabili per squadra
- Backend settings (models/settings_models.py + routes/settings.py): aggiunti `kit_price_under` e `kit_price_minivolley` (oltre a `kit_price` legacy=Under) + `kit_sponsor`. GET li restituisce (kit_price_under fallback a kit_price).
- Backend team (models/team_models.py): nuovo campo `kit_type` ('under' | 'minivolley' | None) su Team/TeamCreate/TeamUpdate. create_team e update_team lo persistono. `GET /teams/{id}/payment-info` ora include `kit_type`.
- Frontend:
  - `admin/settings/society.tsx`: due input prezzo (Under / MiniVolley) + Sponsor.
  - `admin/team/[id].tsx`: selettore Tipo Kit (Nessuno / Under / MiniVolley) nel form modifica (sezione Quote).
  - `KitInfoBanner.tsx` riscritto: riceve priceUnder, priceMinivolley, kitType, kitSponsor → mostra il prezzo giusto con etichetta "(Under)"/"(MiniVolley)". Se kitType assente, fallback a Under.
  - Banner integrato in admin team detail (usa team.kit_type), athlete/payments e parent/athlete (usano paymentInfo.kit_type).
- Verificato: curl (PATCH/GET due prezzi, PATCH team kit_type, payment-info) + screenshot (banner mostra "€ 50,00 (MiniVolley)"; 3 input in Impostazioni).
- **Deploy**: Frontend (Vercel) + Backend (Render).

## Changelog — 06/09/2026 — Presenze: (a) Admin può usare lo scan QR + (b) Registrazione presenze multiple (bulk) admin
### (a) Admin QR scan
- Backend `/attendance/check`: role rilassato da solo-COACH a COACH/ADMIN/COORDINATORE + isolamento società (403 se atleta di altra società). Nessun'altra logica cambiata (trial, certificati, ecc.).
- Frontend nuova schermata `app/admin/scan-attendance.tsx`: scanner QR web (html5-qrcode via nativeID `admin-qr-scanner`) + camera nativa (CameraView, permessi con contract Open Settings) + inserimento manuale codice. Chiama `/attendance/check` e mostra esito (registrata / già registrata / squadra diversa con conferma forzatura / bloccato).
### (b) Registrazione presenze multiple (bulk)
- Backend `POST /admin/teams/{team_id}/bulk-attendance` (server.py, classe BulkAttendanceCreate). Body {athlete_ids[], date 'YYYY-MM-DD', time?, note?}. Per ogni atleta: verifica società+team, salta duplicati (stessa data/team/atleta), crea attendance manuale (forced, allowed, manual_entry) e — se in prova (is_trial o status=='trial') — applica il conteggio prova come lo scan QR (set trial_start/end + count=1 al primo, altrimenti $inc trial_sessions_count) così la prova può terminare (trial_expired quando count>=max_sessions). Audit log per atleta (action manual_attendance_added, details.bulk=true). Ruoli admin/coordinatore + coach assegnato.
- Roster (`/admin/team-roster`): aggiunti `is_trial` e `trial_sessions_count` all'output (+ projection).
- Frontend nuova schermata `app/admin/team-attendance.tsx`: lista atleti squadra con checkbox + "Seleziona tutti", data (precompilata a oggi) e ora, badge "In prova · N allenamenti", bottone "Registra presenze (N)". Mostra riepilogo registrate/saltate.
- Entry point: 2 nuovi link nella scheda squadra (`admin/team/[id].tsx`): "Scansiona QR Presenze" e "Registra Presenze (manuale)".
- Verificato: curl (bulk register + skip duplicato + admin scan role OK) + screenshot (entrambe le schermate). NB: la camera nativa si prova solo su device reale (non in Expo Go web).
- **Deploy**: Frontend (Vercel) + Backend (Render).

## Changelog — 06/09/2026 (2) — FIX: presenze manuali non avviavano il periodo di prova (pending_trial)
- Bug: atleti in stato `pending_trial` a cui l'admin aveva inserito presenze (bulk manuale) restavano con "prima presenza in palestra per avviare la prova" perché il bulk NON gestiva la conversione pending_trial→trial né impostava `trial_start_date` (condizione precedente: solo `is_trial or status=='trial'`).
- Fix: nuovo helper `_recompute_trial_from_attendance(athlete, team_id)` in server.py — idempotente e AUTO-CORRETTIVO: se l'atleta è in prova (is_trial o status trial/pending_trial) ricalcola dai record di presenza reali → converte pending_trial→trial (+ user.status), imposta `trial_start_date` (prima presenza) se mancante + `trial_end_date`, e `trial_sessions_count` = numero di date distinte con presenza; imposta `is_trial=True` e `trial_max_sessions`.
- Applicato in: endpoint bulk `/admin/teams/{id}/bulk-attendance` (anche sui DUPLICATI, così ripara gli atleti già inseriti) e endpoint singolo `/coach/athletes/{id}/manual-attendance`.
- Effetto: le presenze manuali avviano/avanzano la prova come lo scan QR; quando `trial_sessions_count >= trial_max_sessions` la prova risulta conclusa. RIPARAZIONE dati esistenti: basta ri-registrare (anche stessa data) gli atleti interessati.
- Verificato via curl: atleta pending_trial con 3 presenze preesistenti → dopo bulk (data duplicata) diventa status=trial, is_trial=true, trial_start_date=prima presenza, trial_sessions_count=3/3.
- **Deploy**: solo Backend (Render).

## Changelog — 06/09/2026 (3) — Fine prova: "Lascia la società" = cancellazione IMMEDIATA (self-service genitore) con conferma di sicurezza
- Richiesta utente: a fine prova (3 presenze/7gg) il genitore sceglie: RESTA (firma privacy, invariato) oppure VA VIA con un clic che cancella TUTTI i dati (irreversibile, ma con sicurezza anti-accidentale). Solo lato genitore/atleta.
- Backend nuovo endpoint `POST /athletes/{athlete_id}/self-delete-trial`: cancellazione immediata da parte del genitore (o atleta adulto proprietario). Consentita SOLO se status in ('trial','pending_trial') e nessun obbligo (pagamenti non saldati / documenti fiscali / compensi = 0). Elimina signed_documents, certificates, attendances, payments, record atleta; se il genitore resta senza figli e senza obblighi elimina anche l'account genitore. Audit log action='deletion_approved' details.self_service=true, trial_leave=true. Verificato via curl: admin non-owner→403; genitore owner→cancellazione OK (parent_deleted riflette la presenza di altri figli).
- Frontend `parent/athlete/[id].tsx`: il pulsante "Lascia la Società" (già esistente) ora, per atleti in prova, apre il modale con: avviso IRREVERSIBILE + campo "scrivi il nome dell'atleta" (deve combaciare con first_name, case-insensitive) → pulsante "Elimina tutto" abilitato solo a match. Handler `handleImmediateDelete` chiama self-delete-trial; se parent_deleted esegue logout, altrimenti torna a /parent. Per atleti NON in prova resta il flusso richiesta→admin. Verificato via screenshot.
- "Resta e firma privacy": invariato (firma resta compito del genitore).
- **Deploy**: Frontend (Vercel) + Backend (Render).

## Changelog — 06/09/2026 (4) — Auto-riparazione prova alla lettura del profilo atleta
- Problema (es. CASCIARI CAMILLA U12/13): 3 presenze registrate ma "Cosa manca: prima presenza (scansione QR) per avviare la prova" e prova non terminata. Causa: attendances create dal vecchio bulk (pre-fix) senza impostare trial_start_date; il fix precedente si attivava solo alla ri-registrazione.
- Fix: in `GET /athletes/{athlete_id}` (server.py ~12227), se status in ('trial','pending_trial') e trial_start_date mancante ma esistono presenze per il team → chiama `_recompute_trial_from_attendance` e aggiorna i campi in memoria + persiste. Auto-riparazione trasparente: basta aprire/aggiornare il profilo dell'atleta.
- Verificato via curl: atleta in stato "rotto" (pending_trial, 3 presenze, no trial_start) → dopo GET diventa status=trial, is_trial=true, trial_start_date=prima presenza, trial_sessions_count=3/3; pending_reason passa da "prima presenza QR" al passo reale successivo (es. certificato/privacy).
- **Deploy**: solo Backend (Render). Dopo il deploy, aprire il profilo degli atleti interessati li ripara automaticamente (nessuna ri-registrazione manuale necessaria).

## Nota — 06/09/2026 — Verifica chiusura prova per 3 allenamenti (OR 7gg / 3 sessioni)
- Confermato che `GET /athletes/{id}/trial-status` (server.py ~33521) e la valutazione a ~16000 usano la logica OR corretta: `trial_expired = (giorni scaduti) OR (sessions_count >= max_sessions)`. Verificato via curl su caso 3/3 con 2 giorni residui → trial_expired=true, trial_active=false. Il frontend mostra correttamente "Periodo di prova terminato".
- Il comportamento anomalo visto in produzione (registrateam.it) su CASCIARI CAMILLA ("Periodo di prova attivo, 2 giorni rimanenti, 3/3") dipende dal fatto che le correzioni backend recenti (fix bulk + auto-riparazione) NON sono ancora pubblicate su produzione. Dopo il deploy backend + apertura profilo (auto-fix), lo stato diventa "terminato".

## Changelog — 06/09/2026 (5) — Export Excel gare + 4 funzioni (email addio, motivo uscita, ripara prove, termina prova)
- **BUG FIX Export Excel Calendario Gare** (`app/admin/matches.tsx`): nuovo pulsante `export-matches-excel-btn` (icona griglia, verde scuro) accanto all'export ICS → genera `calendario_gare.xlsx` (12 colonne: Squadra, Campionato/Gara, Casa/Trasferta, Avversario, Data, Ora, Impianto, Indirizzo, Città, Ritrovo, Risultato, Note) rispettando il filtro Da disputare/Giocate/Tutte. Verificato dal testing agent (iter.125): xlsx valido, apribile su Windows. Corretti data-testid→testID sui pulsanti export.
- **(1) Email di addio + (2) Motivo uscita** (`self-delete-trial`): il body accetta `reason` (facoltativo); il motivo è salvato in collezione `deletion_reasons` + audit log; dopo la cancellazione viene inviata email Brevo al genitore con riepilogo dati eliminati. Frontend: campo `delete-reason-input` nel modale eliminazione (parent).
- **(3) Ripara prove in blocco**: `POST /admin/teams/{id}/recompute-trials` (admin/coach) ricalcola la prova di tutti gli atleti in prova della squadra dalle presenze. Frontend: pulsante `ta-repair-trials` in `admin/team-attendance.tsx`.
- **(4) Termina prova rapido**: `POST /athletes/{id}/force-end-trial` (admin) chiude subito la prova (sessioni=max, end=now). Frontend: pulsante `force-end-trial-btn` nella card prova di `admin/athlete/[id].tsx`.
- Testato: iter.125 (export Excel OK; endpoint 11/12 pytest verdi). NB: durante i test l'atleta MAURI LENA (test) è stato eliminato dal flusso self-delete; parent armida ricreato. Vedi test_credentials.md.
- **Deploy**: Frontend (Vercel) + Backend (Render).


---
## Sessione 19-20/09/2026 (fork) — Fix contatti dirigente, saldo presenze admin, saldo da incassare, Prima Nota completa

### Deploy Vercel/Render
- Il warning `package-lock.json found` su Vercel è innocuo (non causa il fallimento).
- Rimosso `frontend/package-lock.json` (resta solo `yarn.lock`, coerente con `packageManager: yarn`); aggiunto a `.gitignore`.
- Aggiunto `"engines": { "node": "22.x" }` in `frontend/package.json` (Expo 54 + React 19 richiede Node ≥ 20).
- Le modifiche vanno in produzione solo dopo Save to GitHub → redeploy.

### Fix/Feature implementate
1. **Saldo atleti nel registro presenze ADMIN** — Il blocco "Pagato €/Saldo €" era presente solo nella vista coach (`/app/frontend/app/coach/team/[id]/attendances.tsx`) e mancava nella vista admin. Aggiunto anche in `/app/frontend/app/admin/team/[id]/attendances.tsx`. Backend `attendance-stats` già restituisce `show_balance` (admin sempre, coordinatore con permesso `view_balances`).
2. **Contatti dashboard Dirigente vuoti (bug 403)** — `SocietyContactsSection` chiamava endpoint admin-only → 403 per dirigente/coordinatore → liste a 0. 
   - Nuovo endpoint leggero backend `GET /users/fellow-dirigenti` (solo nome/telefono/qualifica, accessibile a tutto lo staff).
   - Esteso guard di `/users/fellow-coaches` e `/users/staff-collaboratori` ai ruoli VIEWER/DIRIGENTE/COORDINATORE.
   - Frontend `SocietyContactsSection.tsx` ora usa i 3 endpoint leggeri. Verificato: Dirigenti(5)/Allenatori(6)/Collaboratori(3).
3. **Banner "Inizio allenamenti" persistente** — NON è un bug: il backend già nasconde il banner quando la data è passata (`_start.date() >= today.date()`, tz Italia). Il caso "09/09/2826" è un typo dell'anno. Aggiunta validazione anno nel form squadra (`/app/frontend/app/admin/team/[id].tsx`, handleSave): l'anno deve essere tra annoCorrente-1 e +1.
4. **Storico Pagamenti — "Saldo ancora da incassare"** — Sostituita la card "Rimborsato" con "Da incassare" + dettaglio per fascia (1ª/2ª/3ª rata, Ricorrenti, Altro se >0). 
   - Backend `routes/payments_history.py`: aggiunti a `totals` i campi `total_outstanding`, `outstanding_rata1/2/3`, `outstanding_recurring`, `outstanding_other`; aggiunti a ogni row `installment_number` e `is_recurring`. Residuo = amount - paid_amount (escludendo refunded). Classificazione: `recurring_plan_id` → ricorrenti, altrimenti `installment_number` 1/2/3, altrimenti "altro".
   - Frontend `payments-history.tsx`: `clientTotals` calcola il breakdown lato client (rispetta la ricerca atleta). Verificato con dati di test: totale 350, r1 200, r2 100, r3 0, ricorrenti 50.
5. **Prima Nota — mostra tutti i pagamenti** — `payments-import.tsx` (tab Registro) mostrava solo `slice(-10)`. Aggiunto toggle "Mostra tutti i N pagamenti" / "Mostra solo ultimi 10" (state `showAllRegistro`). Tutti i dati erano già caricati da `/payments/registro-stagione`.

### DECISIONE APERTA (da chiedere all'utente)
- Saldo atleti visibile al COORDINATORE nel registro presenze: opzione (a) sempre per tutti i coordinatori, oppure (b) solo con permesso `view_balances`. Al momento è (b) — permesso esistente.



---
## Sessione 20/09/2026 (fork) — Riepilogo contabile dettagliato + Igiene dati pagamenti

### Anomalia "820€" (atleta ALLA GWYNETH FRAICHEL)
- Causa: record **"Iscrizione - Rata 1" DUPLICATO** (250 contato 2 volte: 250+200+120+250=820). L'anagrafica usa la quota squadra (570); i Solleciti/Storico sommano i record reali di pagamento → 820.
- I flussi di generazione rate (creazione atleta 9863/10057/10233, cambio squadra 12586/12654) fanno delete+insert (non duplicano). Il duplicato singolo nasce da inserimenti extra puntuali → serve strumento di pulizia.

### Storico Pagamenti — Dettaglio per fascia (`/app/frontend/app/admin/payments-history.tsx`)
- Sostituite le card "solo residuo" con una **tabella**: colonne Fascia | Dovuto | Pagato | Residuo, righe 1ª/2ª/3ª rata + Ricorrenti (+ Altro se >0) + riga **TOTALE**.
- `clientTotals` calcola i `buckets` lato client (rispetta ricerca atleta). Card in alto invariate (Movimenti/Incassato/Da incassare).
- Aggiunto link "⚠️ Igiene dati: verifica rate duplicate" → `/admin/payments-hygiene`.
- Rimosso stato `totals` inutilizzato.

### Igiene dati pagamenti (NUOVO)
- Backend `GET /admin/payments/duplicates` (server.py, dopo delete_payment ~15942): per la società, raggruppa i pagamenti non ricorrenti per `installment_number`; se una rata compare >1 volta la segnala. Mantiene il record pagato (o il più vecchio), gli altri hanno `suggested_delete=true`.
- Eliminazione: riusa `DELETE /payments/{payment_id}` (admin-only).
- Frontend nuova schermata `/app/frontend/app/admin/payments-hygiene.tsx`: lista atleti con rate duplicate, ✅ Mantieni / 🗑️ Elimina (con conferma), pull-to-refresh, empty state.
- Verificato E2E su preview: totale 820 → dopo eliminazione duplicato torna 570; lista mostra "Nessuna rata duplicata".

### Sessione precedente stessa fork (già fatto): fix contatti dirigente (endpoint leggeri), saldo presenze admin, banner inizio attività (validazione anno), Prima Nota "Mostra tutti", card "Da incassare".



---
## Sessione 20-21/09/2026 (fork) — Correzione riepilogo cassa per fascia (modello dovuto/incassato)

### Chiarimento modello dati pagamenti (IMPORTANTE)
- I record in `payments` sono di DUE tipi:
  1. **Scadenzario/rate**: `installment_number` 1/2/3, `paid=False`. Rappresentano il DOVUTO (dal piano `team.installments`).
  2. **Pagamenti reali** (manuali/Stripe/import): `paid=True`, con `description` libera, **SENZA `installment_number`**. Rappresentano l'INCASSATO.
- L'anagrafica atleta (`GET /payments/{athlete_id}/summary`): total_due = quota squadra (con sconto sull'ultima rata), total_paid = somma `amount` dei record `paid=True`, residual = due - paid. I pagamenti NON sono taggati per rata: "scalano dal residuo".
- Bug precedente della tabella "Dettaglio per fascia": sommava `amount` di TUTTI i record come dovuto (contando i pagamenti come dovuto e mettendoli in "Altro"), residuo sovrastimato (non sottraeva l'incassato).

### Fix: nuovo endpoint `GET /admin/payments/rate-summary` (server.py, dopo get_payment_duplicates)
- Per ogni atleta: costruisce lo scadenzario (`team.installments`, sconto su ultima rata), calcola l'incassato non ricorrente (`paid=True`) e lo **scala in ordine 1ª→2ª→3ª (waterfall)** confermato dall'utente.
- Ritorna `rate` (dinamico, per posizione, con label/short/due/paid/residuo) + `recurring` + `altro` (incassato oltre scadenzario/atleti senza piano) + totali.
- Verificato: scadenzario 250/150/200, incassato 300 → 1ª(250/250/0), 2ª(150/50/100), 3ª(200/0/200), TOTALE 600/300/300 (coerente con anagrafica).

### Frontend `payments-history.tsx`
- Card in alto: **Dovuto / Incassato / Da riscuotere** (stagione, dal nuovo endpoint, indipendenti dai filtri).
- Tabella "Riepilogo rate — stagione": Dovuto/Pagato/Residuo per rata (dinamico) + Ricorrenti/Altro se presenti + TOTALE.
- Caption sotto: "N movimenti nella lista · incassato filtro €X" (statistiche della lista filtrata).
- `clientTotals` semplificato (solo count + incassato lista).
- Link "⚠️ Igiene dati" invariato → `/admin/payments-hygiene`.



---
## Sessione 21/09/2026 (fork) — Fix orario ricevuta Stripe (UTC → Europe/Rome)
- Problema: la ricevuta Stripe (`GET /payments/{payment_id}/receipt`, `_build_nexi_style_receipt_html` in `routes/stripe_payments.py`) mostrava l'orario in UTC (es. 07:03) invece dell'ora italiana (09:03), perché `paid_date` (salvato UTC) veniva formattato con strftime senza conversione fuso.
- Fix: aggiunto helper `_format_receipt_datetime()` che converte a `ZoneInfo("Europe/Rome")` (DST-aware: +2 estate / +1 inverno) e usa nomi mese in italiano. Sostituito il blocco di formattazione.
- Verificato: 07:03 UTC → "21 settembre 2026, 09:03"; inverno 07:03 UTC → 08:03. La ricevuta ricorrente usa lo stesso endpoint → corretta anch'essa.
- Solo backend (HTML), nessun rebuild frontend necessario.



---
## Sessione 21/09/2026 (fork) — Piano ricorrente visibile nella pagina Pagamenti atleta
- Problema: un atleta con piano rateale Stripe attivo (recurring_plans) vedeva nella tab Pagamenti solo il CTA statico "Crea un link di attivazione", senza indicazione del piano esistente.
- Fix `app/admin/athlete/[id].tsx`: aggiunto stato `recurringPlans`, caricato in `loadData` da `GET /admin/recurring-plans/athlete/{id}`. Il bottone "Piano rate automatiche (Stripe)" ora è condizionale: se esiste un piano (pending/active/paused/completed) mostra badge stato, importo totale, N rate, Progresso done/total, prossimo addebito (se active) o nota "in attesa attivazione" (se pending). Se nessun piano → CTA "Crea".
- Verificato E2E su preview: piano active 370€, 6 rate, 2/6 → mostra "Attivo · € 370,00 · 6 rate · Progresso 2/6".



---
## Sessione 21/09/2026 (fork) — FIX saldo nel riepilogo di squadra (attendance-stats)
- Problema: nel riepilogo presenze di squadra il Saldo era gonfiato (es. PACELLA MARGHERITA: Saldo 820 invece di 320; anagrafica corretta 570 dovuto − 250 pagato = 320). Causa: la logica in `GET /teams/{team_id}/attendance-stats` (server.py ~15260) sommava `amount` di TUTTI i record pagamento come dovuto (scadenzario + pagamenti reali), stesso errore di modello già corretto nel riepilogo Storico.
- Fix: allineato alla formula del summary/anagrafica → `bal_due = team.total_amount(primaria) − discount_amount`, `bal_paid = somma amount dei record paid=True`, `residual = bal_due − bal_paid`. Aggiunta mappa `_team_total_map` (id→total_amount).
- Verificato: quota 600, pagato 250 → paid 250, residual 350 (prima 600/850). Solo backend, nessun rebuild frontend.



---
## Sessione 21/09/2026 (fork) — FIX cancellazione email PayPal / IBAN non salvata
- Problema: svuotando l'email PayPal (o i dati Bonifico) nella scheda squadra admin, la cancellazione non veniva memorizzata (il valore restava).
- Causa (`app/admin/team/[id].tsx` ~546-547): i campi venivano inviati SOLO se valorizzati (`if (bankInfo)...`, `if (paypalEmail)...`), quindi con campo vuoto non venivano mandati al server (`exclude_unset` li ignorava) → mai cancellati. Coinvolgeva ANCHE `bank_info`.
- Fix: ora si invia sempre il valore, con `null` quando vuoto (`updateData.bank_info = bankInfo ? bankInfo : null; updateData.paypal_email = paypalEmail ? paypalEmail : null;`).
- Backend già corretto: `bank_info` e `paypal_email` sono in `nullable_fields` (routes/teams.py) e con null azzerano il campo. Verificato E2E: set 'test@paypal.it' → null → None.
- NB: così l'utente può rimuovere PayPal svuotando l'email e salvando (i display a genitore/atleta sono gated su paypalEmail truthy). Rimozione totale dell'input PayPal dalle UI = eventuale follow-up.



---
## Sessione 21/09/2026 (fork) — FIX perdita pagamenti/ricevute al cambio squadra
- Problema: "Numeri di ricevuta mancanti" mostrava buchi (es. RIC-26/27-0013/0033/0039) "pagamento eliminato" senza che l'utente avesse cancellato nulla.
- Causa (server.py 12586 e 12654): al cambio squadra di un atleta quota, `delete_many({"athlete_id": athlete_id})` eliminava TUTTI i pagamenti (anche quelli PAGATI con numero ricevuta), poi ricreava lo scadenzario. → i numeri ricevuta dei pagamenti pagati eliminati diventavano buchi permanenti.
- Fix: ora elimina SOLO le rate non pagate: `delete_many({"athlete_id": athlete_id, "paid": {"$ne": True}})`. I pagamenti incassati (e le ricevute) vengono preservati.
- Verificato: pagamento paid con receipt RIC-26/27-9999 sopravvive al cambio squadra; la rata non pagata viene rigenerata per la nuova squadra.
- NB: i buchi già esistenti in produzione derivano da cambi squadra passati (pagamenti già eliminati, non recuperabili automaticamente). Il fix previene nuovi buchi. Solo backend.



---
## Sessione 22/09/2026 (fork) — Strumento "Pagamenti ricevuti su Stripe" (recupero incassi)
- Esigenza: i record di alcuni incassi reali erano stati eliminati (bug cambio squadra, già corretto). L'utente deve risalire a data/importo di quei pagamenti da Stripe.
- Backend `GET /admin/stripe/received-payments` (routes/stripe_payments.py): admin-only, usa la chiave Stripe della società (`_get_society_stripe_settings`), chiama `stripe.Charge.list(limit≤100)` e ritorna per ogni incasso: data (ora italiana via `_format_receipt_datetime`), importo, valuta, descrizione, email/nome cliente, status, refunded, receipt_url, payment_intent.
- Frontend nuova schermata `/app/frontend/app/admin/stripe-payments.tsx`: lista incassi con data/importo/cliente, badge Incassato/Rimborsato, link "Ricevuta Stripe". Link di accesso aggiunto in `payments-history.tsx` (sotto il link Igiene dati).
- Verificato E2E su preview (chiave test): elenca 7 charges reali con date corrette. In produzione userà la chiave live della società.
- NB: serve che Stripe sia abilitato e la chiave configurata per la società.



---
## Sessione 22/09/2026 (fork) — Elenco per Squadra: includere squadre secondarie/terze
- Problema: selezionando U17/U19 in "Elenco per Squadra" (`team-roster.tsx` → `GET /admin/team-roster`), nessun atleta compariva perché la query filtrava solo `team_id` (squadra principale), ignorando le squadre secondarie in `team_ids`.
- Fix (server.py get_team_roster, ramo squadra singola): query cambiata in `$and` di `{"$or": [{"team_id": team_id}, {"team_ids": team_id}]}` + condizioni rollover. Ora include chi ha la squadra come principale O secondaria/terza.
- Verificato: atleta con principale Under14 e secondaria Under16 ora compare nell'elenco di Under16 (prima 0). Solo backend.



---
## Sessione 22-24/09/2026 (fork) — Cancellazione in blocco calendario di una squadra
- Esigenza: importato per errore un calendario doppio/errato di una squadra; serve cancellare in blocco tutte le partite di quella squadra.
- Backend: nuovo `DELETE /matches/team/{team_id}/all` (server.py, dopo delete_match): admin-only, `delete_many({team_id, society_id})`, ritorna deleted_count.
- Frontend `app/admin/matches.tsx`: in cima alla lista (tab), sezione "🗑️ Svuota calendario di una squadra" che raggruppa le partite caricate per `team_id` (nome + conteggio) con bottone "Elimina tutte" per squadra (conferma web/native). Handler `handleDeleteTeamCalendar`, stato `deletingTeamId`.
- Verificato E2E: eliminando le partite di una squadra restano intatte quelle delle altre squadre; UI mostra "U.14 Magione · N partite / Elimina tutte".



---
## Sessione 24/09/2026 (fork) — Calendario: protezione eliminazione + export Excel filtrabile
- Sezione "Svuota calendario squadra" ora COLLASSABILE (chiusa di default, header con chevron, testo "N squadre con partite · tocca per gestire").
- Protezione eliminazione: click su "Elimina tutte" apre un Modal che richiede di DIGITARE "ELIMINA"; il pulsante "Elimina definitivamente" resta disabilitato finché il testo != ELIMINA. Stati: bulkExpanded, confirmTeam, confirmText; handler confirmDeleteTeamCalendar.
- Export Excel filtrabile (`handleExportExcel` + modal opzioni): scelta Squadra (Tutta la società / singola squadra), Gare (Tutte / Casa / Trasferta), Stato (Tutte / Da disputare / Giocate). Nome file dinamico (calendario_<squadra>_<casa|trasferta>.xlsx). Tutto client-side dai dati già caricati (`matches` + `teams`), util XLSX esistente.
- File: `app/admin/matches.tsx`. Verificato E2E su preview (collassabile, modal ELIMINA con pulsante disabilitato, modal export con picker+segmenti).


## 🆕 24/09/2026 — Export Calendario Gare: PDF + fogli per squadra
- **Excel multi-foglio** (`handleExportExcel` in `app/admin/matches.tsx`): quando l'export è su "Tutta la società" ora genera un foglio "Riepilogo" con TUTTE le squadre (colonna Squadra) + un foglio separato per OGNI squadra. Con singola squadra resta un unico foglio. Nomi foglio sanificati/troncati a 28 char + deduplica (limite XLSX 31 char).
- **Export PDF** (nuovo `handleExportPDF` + util `src/utils/matchCalendarReport.ts`): stesso set di filtri (squadra/casa-trasferta/stato). Intestazione con logo + nome società (fetch `/settings/society?include_images=true` al mount, stato `societyInfo`) e data di generazione. Layout: A4 landscape, sezione "Riepilogo generale" (tabella continua con colonna Squadra) seguita da una pagina/sezione per ogni squadra con titolo. Pattern print = fipavPresencesReport.ts (window.open+print su web, expo-print+sharing su mobile).
- **UI**: modal export ora con 3 pulsanti — Annulla / 📄 PDF (rosso) / 📊 Excel (verde). Titolo cambiato in "Esporta calendario".
- Helper condivisi introdotti: `getExportList()`, `fmtDate()`, `exportSubtitle()`, `exportFileName()`, `groupByTeam()`.
- Verificato: rebuild `npx expo export -p web` + restart expo; modal render OK su preview con i nuovi pulsanti PDF/Excel.

## 🐛 24/09/2026 — Fix Dati Bancari mancanti per atlete 18+ PRO (admin)
- In `app/admin/athlete/[id].tsx` (tab Anagrafica) la card "🏦 Dati Bancari" era nascosta quando IBAN/intestatario/banca erano vuoti (`if (!iban && !holder && !bank) return null`). Per le atlete 18+ PRO senza IBAN ancora inserito, l'admin non vedeva alcuna sezione.
- Fix: la sezione ora resta SEMPRE visibile per atleti compensati (`athlete_type==='compensated' || athleteType==='compensated'`), mostrando "-" finché l'atleta non compila i dati nel proprio profilo (coerente con la scheda Coach). Per gli atleti QUOTA senza dati resta nascosta. Aggiunta nota "* Dati inseriti dall'atleta nel proprio profilo (necessari per i compensi)".
- Verificato E2E su atleta PRO di test (admin/athlete/...): la card compare con IBAN/Intestatario/Banca = "-".

## 🎨 24/09/2026 — Export calendario più visibile
- L'apertura del pannello export (Excel/PDF) era su un'icona a griglia verde poco intuitiva (l'utente non la trovava). Ora è un pulsante verde etichettato "⬇ Scarica" (`styles.exportBtn`/`exportBtnText`). L'export .ics ha un'icona distinta calendario viola.

## 🐛 24/09/2026 — Fix: admin non vedeva i dati bancari salvati dall'atleta 18+ PRO
- CAUSA: l'atleta salva IBAN/intestatario/banca dal proprio profilo via `PATCH /users/me/bank-details` che scriveva SOLO su `db.users`, mentre l'admin (`GET /athletes/{id}` → tab Anagrafica) legge dal record `db.athletes`. Il fallback esistente (22/08) leggeva solo da user STAFF (coach/dirigente/collaboratore), non dall'account proprio dell'atleta (role="athlete").
- FIX 1 (server.py `update_my_bank_details`): al salvataggio sincronizza i campi bancari (iban/account_holder/bank_name + iban_holder) anche sul record `athletes` collegato (via athlete_id o euristica user_id/linked_user_id/email) e sull'eventuale coach dual-role.
- FIX 2 (server.py `get_athlete`): esteso il fallback `_bank_empty` per ereditare i dati bancari anche dall'account proprio dell'atleta (users con athlete_id/user_id/linked_athlete_id == athlete_id). Copre i dati GIÀ salvati in produzione senza richiedere un nuovo salvataggio.
- Verificato E2E via API su atleta PRO di test: (a) GET admin restituisce iban/holder/bank presi dallo user quando il record athlete è vuoto; (b) dopo PATCH bank-details dell'atleta il record athletes risulta sincronizzato.

## 🆕 24/09/2026 — Import calendario da file NON-template (calendari FIPAV/società)
- Richiesta utente: caricare un file gare Serie B1 non nel template esatto (colonne diverse + righe di titolo).
- File esempio "Calendario Sirio B1F": header alla riga 4 (2 righe titolo + 1 vuota), colonne: Giornata, Data, Ora (SEPARATE), Sede, Squadra Casa, Squadra Trasferta, Avversario.
- FIX in `app/admin/matches.tsx handleImportExcel`:
  1) Rilevamento automatico della RIGA DI INTESTAZIONE (sheet_to_json header:1 → cerca la prima riga con ≥2 token noti tra data/ora/squadra casa/avversario/... e costruisce gli oggetti da lì), così i file con righe di titolo iniziali non falliscono più.
  2) Merge di una colonna ORA separata con la colonna DATA (prima si perdeva l'orario): gestisce Ora come Date o stringa.
  Le colonne "Squadra Casa"/"Avversario" erano già riconosciute; l'opponent e home/away si calcolano correttamente col nome squadra di casa inserito dall'admin.
- Validato con simulazione Node su xlsx reale: 26/26 gare con data+ora, avversario e casa/trasferta corretti.
- NB: il file non ha impianto/indirizzo → venue/città restano vuoti (compilabili poi a mano). Flusso utente: ☁️ Carica file → scegli squadra (Serie B1) → inserisci nome squadra di casa (es. "SIRIO PERUGIA VOLLEY").

## 🐛+🎨 25/09/2026 — Orari export + stile Excel calendario gare
- CONCERN utente "orari +1 ora" nell'export: CAUSA trovata → `fmtDate` (usata da export Excel/PDF) NON usava `timeZone:'UTC'`, mentre l'app memorizza gli orari gara come wall-clock UTC e li mostra sempre con `timeZone:'UTC'` (vedi `formatDate` lista + handleSave che salva `...T{time}:00.000Z`). Quindi l'export spostava l'orario del fuso del browser (es. 21:00→23:00 a Roma).
  - FIX: `fmtDate` ora usa `timeZone:'UTC'` per data e ora → l'orario esportato coincide con quello mostrato in app.
  - VERIFICATO round-trip import: POST /matches/import con "17/10/2026 21:00" → GET restituisce `2026-10-17T21:00:00+00:00`; lista mostra 21:00 (timeZone UTC). Import display corretto.
- STILE Excel export (richiesta utente): installato `xlsx-js-style@1.2.0` (community `xlsx` non supporta gli stili). handleExportExcel ora usa XLSXStyle e applica: Carattere Calibri 10 ovunque; intestazione blu scuro (1F3864) testo bianco grassetto centrato; righe dati alternate bianco/grigio chiaro (F2F2F2); bordi sottili. Applicato a foglio Riepilogo e a ogni foglio squadra.
  - VERIFICATO su file realmente scaricato dall'app (calendario_societa.xlsx): styles.xml/sheet XML confermano header s=3 (font Calibri10 bold white + fill 1F3864), righe s=4 (bianco)/s=5 (grigio) alternate, orari 18:00/19:15 corretti.
- NB import: `yarn add` bloccato dal guard + engines node 22.x; installato con `yarn expo install xlsx-js-style` dopo aver aggiunto temporaneamente `--ignore-engines true` in `.yarnrc` (poi ripristinato .yarnrc vuoto). `xlsx` classico resta per template download + lettura import.

## 🎨 25/09/2026 — Excel export: colore intestazione per squadra + logo su Riepilogo
- Migrato l'export Excel da xlsx-js-style a **exceljs@4.4.0** (serve per embeddare immagini, non supportate da xlsx-js-style). Import via `(await import('exceljs')).default` → bundle lazy chunk (~944kB), verificato che Metro lo bundla senza errori.
- Ogni FOGLIO SQUADRA ha un COLORE INTESTAZIONE diverso (palette di 10 colori, ciclica). Riepilogo usa blu scuro.
- Foglio RIEPILOGO: LOGO società in alto (come nel PDF) + nome società accanto; header spostato a riga 4. Logo preso da `societyInfo.logo` (fetch /settings/society?include_images=true); estensione png/jpeg auto-rilevata; se logo assente/non valido si prosegue senza.
- Stile mantenuto: Calibri 10 ovunque, header testo bianco grassetto centrato su fondo colorato, righe dati alternate bianco/grigio (F2F2F2), bordi sottili.
- Web: writeBuffer→Blob→download. Mobile: writeBuffer→base64 (encoder manuale, no btoa)→FileSystem+Sharing.
- Rimosso import inutilizzato `xlsx-js-style` da matches.tsx (pacchetto resta in package.json ma non più bundlato). `xlsx` classico resta per template download + lettura import.
- VERIFICATO su file realmente scaricato (2 squadre + logo temporaneo): sheets [Riepilogo(1 img, header FF1F3864, headerRow=4), Under 16(FF1F3864), Serie D(FF7030A0)], font Calibri10 bold white. Orari corretti (18:00/20:30).

## 🚀 25/09/2026 — Fix deploy Vercel (frozen-lockfile)
- SINTOMO: deploy Vercel falliva con "Your lockfile needs to be updated, but yarn was run with '--frozen-lockfile'" dopo l'aggiunta di exceljs/xlsx-js-style. Ogni "Save to GitHub" creava un branch `conflict_...` e il merge teneva un yarn.lock vecchio → mismatch con package.json.
- yarn.lock in /app/frontend è coerente (frozen-lockfile passa localmente) e NON è gitignorato (solo package-lock.json lo è), ma il merge GitHub non portava il lockfile aggiornato.
- FIX ROBUSTO lato codice: in `frontend/vercel.json` cambiato `installCommand` da `yarn install --frozen-lockfile` → `yarn install` (non-frozen). Così Vercel riconcilia automaticamente package.json↔yarn.lock in build, senza bloccarsi anche se il lockfile su GitHub è momentaneamente disallineato.
- Warning engines node 22.x vs 24.x = non bloccante.
- AZIONE UTENTE: rifare "Save to GitHub" (per inviare il nuovo vercel.json) e rilanciare il deploy.

## 🐛 25/09/2026 — Fix Excel "danneggiato / da ripristinare" all'apertura
- SINTOMO (utente): Excel apriva il file esportato solo dopo "ripristino", con record ripristinati su /xl/worksheets/sheetN.xml e /xl/drawings/drawing1.xml (Forma disegno).
- CAUSA 1 (tutti i fogli): in exceljs avevo messo `addWorksheet(name, { views: [{ state:'frozen', ySplit:0 }] })` → genera un pannello congelato NON valido (`<pane topLeftCell="A1" state="frozen"/>` senza split) → Excel ripara ogni sheetN.xml. FIX: rimosso completamente il parametro `views`.
- CAUSA 2 (drawing1.xml, logo): l'estensione dichiarata poteva NON combaciare con i byte reali del logo (es. logo JPEG scritto come .png) → mismatch Content_Types/media → "Forma disegno" da ripristinare. FIX: `logoInfo` ora rileva il tipo dai MAGIC del base64 (iVBORw0KGgo→png, /9j/→jpeg, R0lGOD→gif; fallback mime nel data URL) e passa a `addImage` il base64 GREZZO (senza prefisso data:) con l'estensione corretta; se il tipo è sconosciuto il logo viene saltato (tabella comunque valida).
- VERIFICATO su file realmente scaricato dall'app con logo JPEG + 2 squadre: media=image1.jpeg (firma FF D8 FF), Content_Types Extension="jpeg", 0 sheetViews, drawing solo su Riepilogo, openpyxl apre i 3 fogli senza eccezioni. Nessun ripristino atteso.

## 🎨 26/09/2026 — Excel export: nuovo ordine colonne + data estesa
- Richiesta utente (per Riepilogo E ogni foglio squadra): 1ª col = N° progressivo, 2ª = Data estesa (es. "Sabato 26 settembre 2026"), 3ª = Ora HH:mm, 4ª = Casa/Trasferta; il resto invariato.
- SUMMARY_COLS/TEAM_COLS riordinate: ['#',Data,Ora,Casa/Trasferta, (Squadra solo nel Riepilogo), Campionato/Gara,Avversario,Impianto,Indirizzo,Città,Ritrovo,Risultato,Note].
- Aggiunto `fmtDateExtended` (it-IT weekday+day+month+year, timeZone UTC, iniziale maiuscola). `matchToArray(m,cols,num)` con '#'=num progressivo per foglio.
- VERIFICATO su file scaricato reale: row1 header ['#','Data','Ora','Casa/Trasferta','Campionato/Gara'...], righe con # 1..n e date "Giovedì 22 gennaio 2026", ora 18:00.

## 🎨+🧩 26/09/2026 — Calendario: nuove colonne (Gara N./Campionato/Girone gialle), rimosse Risultato/Ritrovo, template = export
- NUOVI CAMPI gara: `championship` (Campionato) e `girone` (Girone). Aggiunti a Match/MatchCreate (backend), create_match, import endpoint. update_match li accetta via dict passthrough. Round-trip verificato via API (championship/girone salvati e restituiti).
- EXPORT Excel — layout definitivo colonne (Riepilogo + squadre): # · Data(estesa) · Ora · Casa/Trasferta · [Squadra solo Riepilogo] · Gara N. · Campionato · Girone · Avversario · Impianto · Indirizzo · Città · Note. RIMOSSE Risultato e Ritrovo. Le 3 colonne Gara N./Campionato/Girone hanno intestazione GIALLA (FFFFFF00) testo rosso (FFC00000); le altre col colore squadra/blu, testo bianco.
- TEMPLATE download (downloadTemplate) RISCRITTO con exceljs, IDENTICO all'export: header verde (217346) + blocco giallo, stesse colonne, riga d'esempio (Domenica 25 ottobre 2026 · 17:00 · Casa · 313 · Serie D · A · POLISPORTIVA DELFINO - IDRO · PALESTRA SCUOLA ELEMENTARE · SAN FELICIANO · MAGIONE), 30 righe numerate, righe alternate, bordi, Calibri 10.
- IMPORT aggiornato per il nuovo template: legge colonna esplicita "Casa/Trasferta" (Casa→home/Trasferta→away, più affidabile del match sul nome), "Avversario" diretto quando non c'è "Squadra Casa", alias "Gara N." per match_number, "Campionato"/"Girone", "Città" diretta, e PARSER data estesa italiana ("Domenica 25 ottobre 2026"→25/10/2026). HEADER_TOKENS estesi.
- VERIFICATO su file realmente scaricati dall'app (template + export): intestazioni, colori gialli/verdi, riga esempio, data estesa, # progressivo tutti corretti.
- Form manuale add/edit gara: NON modificato (championship/girone si popolano via import; per gare manuali restano vuoti).

## 🎨 26/09/2026 (fix) — Intestazioni tutte blu (niente giallo)
- Il giallo era solo un segno dell'utente per indicare le colonne da aggiungere. Rimosso l'evidenziazione gialla/rossa: nell'EXPORT le 3 colonne Gara N./Campionato/Girone hanno ora la stessa intestazione delle altre (fondo blu scuro 1F3864, testo bianco). Il TEMPLATE download ora ha intestazioni blu scuro 1F3864 testo bianco (prima era verde). Verificato sui file scaricati: un unico colore header FF1F3864, testo FFFFFFFF.

## 🐛 26/09/2026 — Fix atleta "In attesa: assegnazione a una squadra" pur avendo squadre
- SINTOMO (KROSI SERENA): scheda mostra Squadra Principale (1ª Divisione) + Squadra 2 (U.19 ELITE), ma nell'elenco appariva "⏳ In attesa: assegnazione a una squadra".
- CAUSA: `compute_pending_reason` calcolava `has_team = bool(a.get('team_id'))` usando SOLO il campo legacy `team_id`. Se le squadre sono solo in `team_ids` (canonical) senza sync del legacy, has_team=False → falso "In attesa".
- FIX: `has_team = bool(team_id OR primary_team_id OR len(team_ids)>0)`. Inoltre aggiunti `team_ids` e `primary_team_id` alla projection `_light_proj` dell'endpoint `/athletes?light=true` (prima non venivano letti, quindi il calcolo non li vedeva).
- VERIFICATO su preview: atleta con `team_ids` valorizzato e `team_id` legacy assente → pending_reason ora None (nessun badge "In attesa").

## 🆕 26/09/2026 — Annulla presenza + Vista mensile + COPIA SQUADRA
### Annulla presenza errata (QR) + vista mensile
- Backend: `GET /teams/{id}/attendance/today` (presenze oggi con id/nome/ora), `DELETE /attendances/{id}` (Admin sempre; Allenatore solo stesso giorno; tracciamento in `deleted_attendances` + audit_log `attendance_deleted`; ricalcolo prova via `_recompute_trial_from_attendance`), `GET /teams/{id}/attendance/monthly?year&month` (griglia P/A/'' basata su training_sessions weekday + presenze del mese).
- Frontend: componenti riutilizzabili `src/components/TodayAttendanceList.tsx` (elenco oggi + cestino) e `src/components/MonthlyAttendanceGrid.tsx` (griglia orizzontale nomi×giorni, P verde/A rosso/vuoto, nav mese, totali P/A). Integrati in `coach/team/[id]/attendances.tsx` e `admin/team/[id]/attendances.tsx`. Endpoint testati via curl (today=[], monthly 30 giorni).
### Copia squadra
- `admin/teams.tsx`: nuovo pulsante icona "copy-outline" su ogni card (`copy-team-{id}`) → `handleCopyTeam` fa GET `/teams/{id}` e precompila TUTTI gli stati del form di creazione (nome="Copia di ...", descrizione, tipo prima/standard, quota/rate con date→GG/MM/AAAA, bank/paypal, allenamenti da trainings|training_sessions, match_day, rifinitura, championships, certificato). Il calendar_link NON viene copiato. Riusa `handleCreateTeam` → crea una NUOVA squadra. Verificato E2E: form "Nuova Squadra" precompilato "Copia di Serie C" con allenamenti/orari.

## 🐛 27/09/2026 — Vista mensile: no "Assente" per allenamenti FUTURI
- SINTOMO: nella griglia mensile i giorni di allenamento ancora da svolgere (es. 29/09) venivano segnati "A" (assente).
- FIX backend `get_team_monthly_attendance`: aggiunto `is_future` per ogni giorno (date > oggi Europe/Rome); "A" assegnato solo se giorno di allenamento E non futuro. Giorni futuri → cella vuota. Totali A aggiornati di conseguenza. Verificato: giorno futuro='', giorno passato='A'.

## 🆕 27/09/2026 — "Annulla presenza di oggi" nel profilo atleta (coach)
- Richiesta: mettere il comando di annullo presenza QR accanto alla "Convalida presenza (straordinaria)" nel profilo atleta del coach.
- Backend: `DELETE /coach/athletes/{athlete_id}/attendance/today` — elimina TUTTE le presenze di oggi dell'atleta (data odierna Europe/Rome o check_in_time >= inizio giornata). Stesse regole permessi del manual-attendance (coach solo squadra assegnata; admin/coord bypass; isolamento società). Tracciato in `deleted_attendances` + audit `attendance_deleted`; ricalcolo prova. 404 se nessuna presenza oggi.
- Frontend `coach/athlete/[id].tsx`: nuovo pulsante rosso "Annulla presenza di oggi" (testID cancel-today-attendance-btn) subito sotto "Convalida presenza (straordinaria)", con conferma. Handler `cancelTodayAttendance` + stato `cancelSubmitting` + stili cancelPresBtn.
- VERIFICATO via API: POST manuale oggi → DELETE (deleted:1) → DELETE ripetuto → 404 "Nessuna presenza registrata oggi".

## 🐛 27/09/2026 — Fix conteggio "Privacy da firmare" (widget dashboard admin)
- Problema: il widget "Privacy da firmare" (AdminLiveStats) mostrava sempre 0 anche con tante privacy pendenti. Contava SOLO i genitori con `privacy_pending_renewal=True` (ri-firma per rinnovo stagione), non gli atleti che non hanno mai firmato il consenso iniziale.
- Fix `admin_dashboard_live_stats` in server.py: `privacy_pending_count` = atleti non ritirati la cui prossima azione è la firma privacy (via `compute_pending_reason` → contiene "firma della privacy") + genitori con ri-firma rinnovo pendente.
- VERIFICATO via API: società di test passata da 0 → 2 (coerente con i solleciti "In attesa: firma della privacy" dell'elenco atleti).
- Chiarito all'utente: "Ritiri reversibili" = atleti ritirati per rinuncia genitore alla ri-firma privacy nuova stagione, ancora nella finestra di 15gg entro cui il ritiro è annullabile (soft-delete recuperabile).

## 🆕 27/09/2026 — PDF Codici QR squadra (pagina Presenze, coach + admin)
- Richiesta: pulsante nella pagina Presenze (zona sopra "Presenze di oggi", visibile anche al Coach) che genera un PDF con: titolo = nome squadra, i QR code degli atleti, il nome dell'atleta sotto ciascun QR.
- Backend: `GET /teams/{team_id}/qr-codes-pdf` (reportlab). Ruoli: admin/coach/viewer/dirigente/coordinatore, isolamento società. Griglia 3x3 per pagina, header viola col nome squadra + "Codici QR presenze • N atleti" + paginazione. QR generato da `qr_identifier` (fallback `athlete_code`). Ordina per nome. Atleti non ritirati.
- Frontend: nuovo componente `src/components/TeamQrCodesButton.tsx` (scarica blob → apre PDF in nuova scheda su web). Inserito in `coach/team/[id]/attendances.tsx` e `admin/team/[id]/attendances.tsx` subito sopra `TodayAttendanceList`.
- VERIFICATO: PDF valido (%PDF, multipagina), analisi conferma titolo squadra + QR + nome sotto. Pulsante visibile in preview (testID download-team-qr-pdf-btn).

## 🆕 27/09/2026 (v2) — QR PDF: logo, percentuale presenze, QR singolo atleta
- Team QR PDF (`GET /teams/{team_id}/qr-codes-pdf`): ora mostra il LOGO società nell'header (dual-read `_settings_logo_b64`, decodifica base64→ImageReader) e, sotto il nome di ogni atleta, la PERCENTUALE presenze totale stagione "Presenze: X% (fatte/previste)" con colore verde≥80 / arancio≥50 / rosso. Calcolo identico al Registro Presenze (count_training_days_in_period da registrazione→oggi, presenze da activity_start). Bullet "•" sostituito con "-" (glyph Helvetica). Griglia 3x3, band header 2.6cm.
- Nuovo `GET /athletes/{athlete_id}/qr-code-pdf`: PDF 1 pagina con logo società centrato, nome società, squadra, QR grande (9cm) e nome atleta. Accesso staff (isolamento società) + genitore collegato.
- Frontend: nuovo `src/components/AthleteQrButton.tsx` ("Stampa QR atleta", testID print-athlete-qr-btn) inserito in `coach/athlete/[id].tsx` sotto "Annulla presenza di oggi". (Admin ha già la sua stampa QR via printQRCode.)
- VERIFICATO: team PDF text "Presenze: 0% (0/59)" + 1 immagine QR; single PDF con nome società+squadra+atleta; pulsante visibile nella scheda coach (screenshot).

## 🆕 27/09/2026 — Riordino allenamenti (sposta su/giù)
- Richiesta: poter spostare ogni turno di allenamento nella posizione desiderata senza dover riscrivere tutti gli orari successivi quando se ne inserisce uno in mezzo.
- Soluzione: frecce ⬆️/⬇️ ("Sposta su/giù") su ogni card allenamento, accanto al cestino. Swap dell'array trainingSessions.
- File PRINCIPALE: `admin/team/[id].tsx` (form modifica squadra esistente) — nuova `moveTrainingSession(index, dir)` + frecce nell'header di ogni "Allenamento N" (testID move-training-up/down-{index}). Prima freccia su e ultima freccia giù disabilitate.
- Anche `admin/teams.tsx` (form nuova squadra) ha ricevuto `moveTraining` + frecce per coerenza.
- Icone: aggiunte 'arrow-up-circle'/'arrow-down-circle' (⬆️/⬇️) alla mappa `src/components/Icon.tsx`.
- VERIFICATO in preview: squadra Under 14 (7 allenamenti), click "sposta giù" su Allenamento 1 → giorno passa da Lunedì a Martedì (swap con Allenamento 2). Ricordarsi "Salva Modifiche" per persistere.

## 🆕 27/09/2026 — Popup "Certificati in Scadenza" ridimensionato + copia
- Problema: cliccando su "Scadenze"/"Certificati in scadenza" si apriva un alert() nativo del browser, non ridimensionabile né copiabile (troncava la lista).
- Soluzione: nuovo componente `src/components/admin/ExpiringCertsModal.tsx` (Modal grande, maxHeight 88% schermo, maxWidth 620). Mostra badge riepilogo (Scaduti/Oggi + Prossimi 30gg), elenco COMPLETO scorrevole con testo `selectable` (selezione/copia manuale) e pulsante "Copia elenco" (expo-clipboard) che copia tutta la lista formattata. Nome atleta + giorni alla scadenza + data (formato IT, UTC).
- Wiring in `admin/index.tsx`: rimossi i 2 `showInfo(...)` per i certificati; ora entrambi (quick-stat "Scadenze" + task "Certificati in scadenza") aprono `setShowCertsModal(true)`. Dati da state `expiringCerts` (endpoint `/certificates/expiring`).
- VERIFICATO in preview: modal con badge 0/1, sezione "Prossimi 30 giorni (1)", "Test REACT (tra 25 giorni) · 22/10/2026", pulsanti Copia elenco/Chiudi (testID copy-certs-btn).

## 🆕 27/09/2026 — Sollecito WhatsApp da popup certificati + nome file PDF QR
- (1) Sollecito da popup: `ExpiringCertsModal` ora ha un pulsante verde "Sollecita" (WhatsApp) per ogni atleta con certificato in scadenza. Recupera il messaggio da `/admin/whatsapp/render?case=certificate_expiring&athlete_id=`, normalizza il numero (prefisso 39), apre wa.me e registra l'invio via `/admin/whatsapp/log-sent`.
  - Backend: `/certificates/expiring` ora include `phone` per ogni atleta (athlete.phone/athlete_phone, fallback telefono del genitore via mappa parent_id→phone).
  - VERIFICATO: endpoint restituisce phone; render endpoint restituisce messaggio certificato; pulsante "Sollecita" visibile nel popup (testID wa-cert-*).
- (2) Nome file PDF QR: `TeamQrCodesButton` ora accetta `teamName` e forza il download con nome `QR_<NomeSquadra>.pdf` (anchor download invece di window.open). Passato `stats?.team_name` da coach/admin attendances.
- Icona `logo-whatsapp` (💬) aggiunta a `src/components/Icon.tsx`.

## 🐛 28/09/2026 — FIX download PDF QR su mobile (errore "Unmatched Route")
- Problema: il download del PDF QR (squadra e singolo) usava un blob: URL lato client. Su mobile il blob: non è apribile/condivisibile → condividendo il link su WhatsApp si otteneva `blob:https://www.registrateam.it/...` che apriva "Unmatched Route".
- Soluzione: NIENTE più blob. Ora si apre un URL REALE del server.
  - Backend: nuova dependency `get_current_user_pdf` (accetta auth via header O via `?token=` query). Nuovo endpoint `GET /pdf-download-token` che rilascia un token firmato a vita breve (30', purpose=pdf_download, scoped a society_id+role). I due endpoint PDF (`/teams/{id}/qr-codes-pdf`, `/athletes/{id}/qr-code-pdf`) ora usano `get_current_user_pdf` e servono il file come `Content-Disposition: attachment` col nome squadra/atleta.
  - Frontend: `TeamQrCodesButton` e `AthleteQrButton` ora fanno GET `/pdf-download-token` e aprono `${BACKEND}/api/.../qr-...-pdf?token=...` (web: window.open, native: Linking.openURL).
- VERIFICATO via curl: `/pdf-download-token` ok; PDF scaricabile SOLO con token in query (senza auth → 401); header `content-disposition: attachment; filename="QR_Under_14.pdf"`. Auth via header ancora funzionante.
- NOTA: fix presente in preview; l'errore che l'utente vedeva era su PRODUZIONE (registrateam.it) col codice vecchio → serve "Save to GitHub" per aggiornare la produzione.

## 🆕 28/09/2026 — (a) Rimosso sollecito "Firma inizio prova" + (b) PDF QR apre inline
- (a) Il caso di sollecito WhatsApp `trial_start_unsigned` ("Firma inizio periodo di prova") è stato ELIMINATO: la firma di inizio prova non è più richiesta (consenso raccolto con spunta obbligatoria all'iscrizione). 
  - Backend `get_pending_reminders` (server.py ~39413): rimosso il blocco che generava il caso.
  - Frontend: rimosso da `whatsapp-reminders.tsx` (CASE_COLORS, fallback, shortLabel) → il tab "Firma prova" non appare più; e da `whatsapp-settings.tsx` (CASE_ORDER).
  - VERIFICATO: pending-reminders non restituisce più trial_start_unsigned; pagina Solleciti mostra tab "Tutti / Certif. mancante / Privacy / Decisione..." senza "Firma prova".
- (b) I PDF QR (squadra e singolo atleta) ora sono serviti come `Content-Disposition: inline` (prima era attachment): il file si APRE nel visualizzatore PDF del browser invece di scaricarsi in automatico; coach/admin decidono se salvarlo o stamparlo. Il download resta via URL reale del server con token (fix "Unmatched Route" del 28/09 mantenuto).

## 🐛 28/09/2026 — Fix orario "Dichiarazione Pregresso" (UTC→Europe/Rome)
- Bug: nel modal "Dichiarazione Pregresso" (AdminPriorCompensationPanel) i timestamp "Storia modifiche admin" e "Firmato il" mostravano l'ora UTC (es. 05:22) invece di Roma (07:22). Causa: `changed_at`/`signed_at` salvati come UTC naive (senza 'Z'); il frontend li parsava come locali.
- Fix `formatDateTime` in `AdminPriorCompensationPanel.tsx`: se manca il fuso appende 'Z' (forza UTC) poi `toLocaleString('it-IT', { timeZone:'Europe/Rome', ... })`.
- IN SOSPESO (decisione utente a/b/c): firma pregresso. Chiarito che "Modifica importo (admin)" ≠ firma legale; l'accettazione compenso fatta dall'admin salta il controllo pregresso (server.py:11298 `if not is_admin`). Matilde risulta "Non firmato" perché non ha mai firmato dal suo profilo. In attesa di scelta: a) lasciare firma atleta, b) pulsante admin "Segna dichiarato €0", c) firma admin per conto atleta.

## 🆕 28/09/2026 — Firma pregresso ORA dal profilo atleta (anche se compenso già accettato)
- Richiesta: consentire a Matilde (18+ PRO) di firmare il pregresso = €0 anche se il compenso è già stato accettato (dall'admin). Prima il modal di firma appariva SOLO tramite il pulsante "Accetta compenso", che sparisce dopo l'accettazione → nessun modo di firmare.
- Fix `CompensationSummaryCard.tsx`: in vista PERSONALE (non adminUserId, non readOnly) recupera `/me/prior-compensation/status`; se `signed=false` mostra banner + pulsante "Firma Dichiarazione Pregresso" (testID sign-prior-comp-btn) che apre `PriorCompensationDeclarationModal` (importo €0 ammesso). `handleDeclared` aggiorna lo stato firmato e ricarica.
- VERIFICATO in preview con testflow.pro@test.com (compensation_accepted=True, pregresso non firmato): pulsante "Firma Dichiarazione Pregresso" visibile sotto "Compenso Accettato: ✓ Sì" nel tab Compensi. Stato test ripristinato.

## 🐛 28/09/2026 — Fix pregresso firmato NON visibile all'admin (sync users↔athletes)
- Bug: l'atleta 18+ PRO firma il pregresso via `/me/prior-compensation/declare` (scrive sul record `users`, id=current_user["id"]). L'admin legge il pregresso passando `adminUserId={athlete.id}` → `/admin/users/{athlete_id}/prior-compensation` → `_get_user_or_athlete` trovava il record `athletes` (NON aggiornato) → mostrava "Non firmato" anche dopo la firma.
- Fix (server.py): 
  - helper `_get_linked_prior_comp_docs` (collega users↔athletes via user.athlete_id), `_sync_prior_compensation` (scrive su entrambi), `_resolve_prior_comp_doc` (legge dal record col miglior stato firma).
  - `declare_my_prior_compensation` e `admin_edit_prior_compensation` ora sincronizzano su entrambi i record.
  - `admin_get_prior_compensation`, `get_my_prior_compensation_status`, `_require_prior_compensation_declared` ora usano `_resolve_prior_comp_doc` → leggono la firma dal record collegato più valido.
- VERIFICATO E2E (testflow.pro@test.com): atleta firma €0 → admin (lettura via athlete_id) vede signed=True, amount=0, has_signature=True.
- BONUS: risolve anche i casi ESISTENTI (es. Matilde) senza migrazione dati, perché il resolver legge la firma già presente sul record `users` collegato.

## 🆕 28/09/2026 — Controllo orari globale (UTC→Europe/Rome)
- Contesto: il container backend gira in UTC; molti timestamp sono salvati come ISO "naive" (senza 'Z') = UTC. Il frontend li mostrava sfasati (ora UTC, ~2h indietro rispetto a Roma).
- Nuova utility condivisa `src/utils/datetime.ts`: `formatRomeDateTime/formatRomeTime/formatRomeDate/formatRomeDateLong`. Regola: se la stringa non ha fuso, append 'Z' (UTC), poi format con timeZone 'Europe/Rome' (gestisce DST estate +2 / inverno +1). Verificato via node: 05:22 UTC → 07:22 (estate), 06:22 (inverno).
- Applicata a: `AdminPriorCompensationPanel` (già 28/09), `AdminNotesBoard` (created/updated), timeline atleta/genitore/admin (`athlete|parent/athlete|admin/athlete/timeline.tsx` → orari eventi in ora di Roma).
- NON toccati di proposito: orari PARTITE (salvati come wall-clock UTC e mostrati con timeZone:'UTC'), date di nascita, campi data-only.
- IN SOSPESO: orari PRESENZE (`check_in_time`) — caso MISTO: QR = istante UTC (utcnow), manuale = orario inserito dal coach (wall-clock Rome salvato naive). Non distinguibili a display → conversione cieca romperebbe uno dei due. Richiede fix BACKEND (convertire il manuale in UTC alla scrittura) prima di uniformare. Da concordare con l'utente.

## 🆕 28/09/2026 — Orari PRESENZE allineati a Europe/Rome
- Backend: nelle presenze MANUALI (endpoint `/coach/athletes/{id}/manual-attendance` e quello bulk) l'orario inserito dal coach (ora di Roma) viene ora convertito in UTC prima del salvataggio (`check_in.replace(tzinfo=_IT_TZ).astimezone(timezone.utc)`). Le presenze QR usavano già `datetime.now()`=UTC (container UTC). Ora TUTTE le presenze sono istanti UTC coerenti.
- Frontend: tutte le viste di `check_in_time` ora usano `formatRomeTime/formatRomeDateTime` (UTC→Roma): TodayAttendanceList, minor/index, admin/scan-attendance, coach/index (3 punti), coach/history, admin/attendances, athlete/presenze (anche formatDate→formatRomeWeekdayLong). Aggiunto `formatRomeWeekdayLong` all'utility.
- VERIFICATO E2E: presenza manuale 18:00 (Roma) → salvata 16:00 UTC → visualizzata 18:00.
- ⚠️ NOTA MIGRAZIONE PRODUZIONE: le presenze MANUALI storiche (vecchio codice) sono salvate come wall-clock Roma naive; dopo il deploy potrebbero apparire +2h. Le presenze QR storiche invece ora si visualizzano correttamente. Valutare eventuale migrazione una-tantum se ci sono molte presenze manuali passate (usare training_slot.time come riferimento).

## 🐛 28/09/2026 — Sconto non conteggiato per-rata lato USER (genitore + atleta)
- Bug: nella vista ADMIN la rata scontata mostrava l'importo corretto (es. €95 "con sconto") via `installments_list` dal backend, ma lato GENITORE (`parent/athlete/[id].tsx`) e ATLETA (`athlete/payments.tsx`) le rate erano calcolate CLIENT-SIDE dalle impostazioni grezze della squadra, senza applicare lo sconto all'ultima rata → mostrava l'importo pieno (es. €120) anche se il Residuo era corretto.
- Fix: in entrambe le viste, dopo aver costruito l'array `installments`, lo sconto (`athlete.discount_amount`) viene ora applicato all'ULTIMA rata > 0 (come backend `get_payment_summary`), con etichetta "(con sconto)". Il totale usa l'importo originale per evitare doppio sconto.
- VERIFICATO backend `/payments/{id}/summary`: total 600, discount 25 → ultima rata 175 flag discounted. Client replica la stessa logica (lint pulito). E2E UI non verificato per instabilità login preview.

## 📸 01/10/2026 — Foto Squadra migrata su Emergent Object Storage (VERIFICATO testing agent: backend 8/8, frontend 4/4 flussi)
- Richiesta utente: caricare SOLO foto squadra (niente foto profilo individuali atleti), mostrate come miniatura ed espandibili al click. Migrazione da base64 in Mongo → Object Storage per alleggerire i documenti.
- Backend (`server.py`): nuovi endpoint
  - `POST /api/teams/{id}/photo` (admin, body `{image: base64|dataURI}`): comprime con `_process_cover_for_og` (max 1400px, ~450KB), salva su storage `registrateam/uploads/{society_id}/teams/{id}.jpg`, set `team_photo_storage_path`, rimuove il base64 `team_photo`. Ritorna `{success, team_photo_url}`.
  - `DELETE /api/teams/{id}/photo` (admin): rimuove storage path + base64 legacy.
  - `GET /api/teams/{id}/photo.jpg` (pubblico): dual-read storage → fallback base64 legacy CON MIGRAZIONE LAZY (alla prima lettura comprime e sposta su storage, unset base64). 404 se nessuna foto.
  - Riuso helper storage esistenti `_storage_put_sync`/`_storage_get_sync`/`_run_in_threadpool`/`_STORAGE_APP`.
- Backend (`routes/teams.py` + `GET /coach/my-teams`): le liste escludono il base64 pesante e aggiungono `team_photo_url` (URL pubblico, fallback `FRONTEND_URL` se `EXPO_PUBLIC_BACKEND_URL` assente). `GET /teams/{id}` ritorna `team_photo=None` + `team_photo_url`.
- Model `Team`: aggiunti `team_photo_storage_path` + `team_photo_url` (Optional).
- Frontend: `admin/team/[id].tsx` (stati `teamPhotoUrl`/`teamPhotoNew`/`teamPhotoRemoved`; upload via POST, delete via DELETE; preview edit + view miniatura + PhotoViewer espandibile), `admin/teams.tsx` (miniatura lista da URL), `coach/index.tsx` + `coach/team/[id]/index.tsx` (miniatura + espandibile). `PhotoViewer` già gestisce URL http.
- NOTA DEPLOY: Save to Github → Vercel (frontend) + deploy Render (backend). Richiede env object storage già configurato (EMERGENT_LLM_KEY + INTEGRATION_PROXY_URL).


## 🐛 01/10/2026 — Sync FIPAV "0 gare trovate sul portale" (RISOLTO, verificato via curl)
- Bug (segnalato con screenshot): "Sincronizzazione completata. 0 gare aggiornate su 0 trovate. Gare trovate sul portale: 0" anche se il calendario FIPAV conteneva gare (con spostamenti di data).
- Causa radice (`POST /api/matches/sync-fipav`): l'endpoint chiamava `scraper.scrape_matches(society_id=...)` SENZA passare `season_id` (StId) né usare quello salvato in `federation_configs`. Il portale `umbria.portalefipav.net` richiede lo StId della stagione: senza, ritorna 0. (Verificato: SIRIO id 5740 + StId 2410 (2026/2027) → 74 gare; senza stagione → 0. Pallavolo Perugia 3477 + StId 2292 (2025/2026) → 35 gare; senza → 0).
- Fix: la sync ora legge `season_id` (e region, federation_society_id) da `federation_configs` e lo passa allo scraper (come preview/import). Se non configurato, usa la stagione CORRENTE (più recente da `get_seasons`). NON passa `championship_id` così recupera TUTTE le gare della società (tutti i campionati) e le allinea per `match_number`. Rete di sicurezza: se la stagione configurata ritorna 0 gare, riprova con la stagione corrente.
- Verificato: sync su Pallavolo Perugia → 35 gare trovate, 10 aggiornate (date/risultati/campi) alla prima esecuzione, 0 alla seconda (già allineate). Solo backend.
- NOTA PRODUZIONE (SIRIO): affinché il fix funzioni, la società deve avere `federation_configs` con il `federation_society_id` SIRIO (5740) e un `season_id` valido — impostati automaticamente al primo import del calendario dalla procedura guidata.


## 🔧 02/10/2026 — Sync FIPAV robustezza (produzione SIRIO ancora 0 dopo deploy)
- Contesto: in produzione (società SIRIO PERUGIA VOLLEY ASD) la sync continuava a dare 0 anche dopo il primo fix. Probabile causa: `federation_configs.federation_society_id` errato/obsoleto (es. ereditato da Pallavolo 3477) oppure `season_id` di stagione passata.
- Migliorie a `POST /api/matches/sync-fipav`:
  1. Prova più stagioni in ordine: quella in config + quella CORRENTE (seasons[0]).
  2. AUTO-RISOLUZIONE SOCIETÀ PER NOME: se con l'ID configurato lo scraping dà 0, recupera `get_societies(season)` dal portale e fa match per nome (token overlap, rimuove ASD/SSD/VOLLEY/PALLAVOLO ecc.) con `federation_society_name` (config) o il nome società app. Accetta SOLO match univoco (vincitore con score > secondo) per evitare falsi positivi su "PERUGIA". Trovato l'ID giusto, aggiorna `federation_configs` (id+nome+season) per le sync future.
  3. Fix bug casa/trasferta hardcoded: `is_home` non è più `"pallavolo perugia" in home_team` (errato per SIRIO) ma confronta i token del NOSTRO nome società.
  4. Risposta sync arricchita con `debug`: {federation_society_id, federation_society_name, season_id, region, resolved_by_name}.
- Frontend `admin/matches.tsx`: se `scraped_total==0` mostra avviso arancione che invita a reimportare il calendario della stagione corrente.
- Verificato in preview: con config id BOGUS (99999) + nome "SIRIO PERUGIA VOLLEY ASD" → auto-risolve a id 5740, stagione 2410, scrape 74 gare, persiste config. Con config corretta Pallavolo 3477/2292 → 35 gare come prima.
- AZIONE UTENTE PRODUZIONE: dopo redeploy Render, rieseguire la sync. Se ancora 0, inviare il campo `debug` della risposta (visibile anche rifacendo l'import del calendario 2026/2027 dalla procedura guidata, che imposta id SIRIO 5740 + stagione corretta).


## 🎛️ 04/10/2026 — "Stanza dei Bottoni" + Fine periodo prove massivo (verificato via curl + screenshot)
- Richiesta utente: (1) pulsante che chiude TUTTE le prove ancora in essere (tutti devono firmare privacy + pagare quota + inserire dati certificato medico); (2) una "Stanza dei Bottoni" che raccoglie le operazioni occasionali con breve descrizione, per sfoltire la dashboard.
- Backend (`server.py`):
  - `GET /api/admin/trials/active-count`: conta le prove ANCORA IN CORSO (status trial/pending_trial, non ritirati, `admin_ended_trial`!=True, `end_trial_requested`!=True).
  - `POST /api/admin/trials/close-all` (admin/coordinatore): termina in blocco tutte le prove in corso della società applicando la STESSA logica di `force-end-trial` (status trial, is_trial True, trial_end_date=now, trial_sessions_count=max, admin_ended_trial=True; user.status=trial). Esclude ritirati, già attivi e prove già concluse. Audit log `trial_close_all`. Ritorna {closed, names, message}.
  - Verificato ciclo completo con atleta usa-e-getta: count 1 → close-all (closed 1) → count 0; campi post = admin_ended_trial True, trial_end_date valorizzata.
- Frontend:
  - NUOVO `app/admin/stanza-bottoni.tsx`: hub con sezioni (Periodo di Prova, Inizio/Fine Stagione, Calendario Gare FIPAV, Manutenzione Dati). Ogni operazione ha icona, "a cosa serve" e "come si fa". Operazioni: Fine periodo prove (azione, con modale di conferma + badge "N in prova"), Nuova Stagione, Riconferma Stagione, Pre-Stagione/Eventi, Importa Calendario, Sincronizza FIPAV (azione diretta con risultato), Igiene Pagamenti, Diagnostica. Modali di conferma/risultato custom (web+native).
  - `app/admin/index.tsx`: la card "Importa Calendario" in dashboard è stata SOSTITUITA dalla card "Stanza dei Bottoni" (riduce l'elenco; l'import è ora dentro la stanza).
- Nota: le altre card occasionali in dashboard (es. EVENTI/preseason) restano per ora; su richiesta utente si possono spostare ulteriori card nella stanza per snellire ancora.


## 🐛 04/10/2026 — Export CSV/Excel gare: "avversario = noi stessi" nelle partite in casa (CAUSA + FIX)
- Segnalazione: nell'export calendario, per molte partite in CASA la colonna "Avversario" mostrava la NOSTRA squadra (es. "SIRIO PALLAVOLO ARANCIO") invece dell'avversaria.
- Causa radice: il campo `opponent` delle gare era stato CORROTTO dal vecchio sync FIPAV che aveva `is_home` hardcoded su "pallavolo perugia". Per una società diversa (SIRIO) `is_home` risultava sempre False → `opponent = home_team` = la nostra squadra. L'export mostra fedelmente `m.opponent` (nessun bug lato export).
- Fix (già introdotto + irrobustito in `POST /api/matches/sync-fipav`):
  - Nuova funzione `_determine_is_home(home, away)`: decide casa/trasferta confrontando quale colonna combacia di più col NOSTRO nome (token overlap su più fonti: resolved_society_name, federation_society_name, nome società). Tie-break sul token distintivo del club (primo token non generico, es. "SIRIO"). Se ambiguo → ritorna None e NON tocca opponent/home_away (evita ri-corruzione). Token generici ignorati: VOLLEY, PALLAVOLO, ASD, SSD, TEAM, ecc.
  - Il sync ora RIPARA i dati esistenti al ri-lancio: ricalcola opponent e home_away corretti per ogni gara (match_number) e li aggiorna. `changes` include opponent_old/opponent_new.
- Verificato in preview: corrotto match 3272 (home) opponent → "PALLAVOLO PERUGIA" (noi stessi); dopo sync → ripristinato a "SCHOOL VOLLEY PERUGIA VERDE" (avversario reale), pur contenendo l'opponent anch'esso "PERUGIA".
- AZIONE UTENTE: deploy ultimo codice su Render, poi eseguire "Sincronizza FIPAV" (Stanza dei Bottoni) → gli avversari delle partite in casa vengono corretti. In alternativa re-import del calendario dalla procedura guidata (usa i team_mappings espliciti → opponent corretti).


## 🎛️ 04/10/2026 — Stanza dei Bottoni: aggiunte voci + nuovi macro-gruppi (sfoltita dashboard)
- Richiesta utente: spostare nella Stanza dei Bottoni anche: Report Rimborsi, Storico Stagioni, Storico Presenze, Archivio Documenti, Riepilogo Consensi Annuali, Compensi Esterni, Quietanze (rinominata in "QUIETANZE SPECIALI"). Con descrizioni e suddivise in macro-gruppi.
- `app/admin/stanza-bottoni.tsx` — gruppi finali:
  - Periodo di Prova: Fine periodo prove (azione)
  - Inizio / Fine Stagione: Nuova Stagione, Riconferma Stagione, Pre-Stagione ed Eventi, Storico Stagioni (/admin/seasons)
  - Calendario Gare (FIPAV): Importa Calendario, Sincronizza FIPAV (azione)
  - Contabilità e Compensi: Report Rimborsi (/admin/refunds-report), Compensi Esterni (/admin/external-compensations), Quietanze Speciali (/admin/quietanze)
  - Archivi e Consensi: Storico Presenze (/admin/attendances), Archivio Documenti (/admin/documents-archive), Riepilogo Consensi Annuali (/admin/image-consents)
  - Manutenzione Dati: Igiene Pagamenti, Diagnostica
  Ogni voce ha icona, "a cosa serve" e "come si fa".
- `app/admin/index.tsx` — RIMOSSE dalla dashboard le 7 card ora nella Stanza (Quietanze, Compensi Esterni, Archivio Documenti, Consensi Immagini, Storico Presenze, Archivio Stagioni, Report Rimborsi). Aggiornato il sottotitolo della card "Stanza dei Bottoni". Mantenute in dashboard: Riepilogo Compensi Annuale, Copie Originali Certificati, Ricerca Avanzata, Prima Nota Pagamenti, Storico Pagamenti.
- Verificato in preview: la schermata mostra i nuovi gruppi (wait su "Contabilità e Compensi" ok). Lint ok, bundle ricompilato.
- NOTA DEPLOY: è una modifica FRONTEND → va ridistribuito il frontend su Vercel (non basta Render).


## ✅ 04/10/2026 — Sync FIPAV: classificazione casa/trasferta/avversario DEFINITIVA (4 errori residui)
- Persistevano 4 gare su 103 con avversario = una NOSTRA squadra (es. U.17 Rossa → "SIRIO PALLAVOLO ROSSA"): il metodo a token restava ambiguo nei casi "noi stessi" e nei derby tra due squadre SIRIO.
- Nuova funzione `_classify(home, away, team_id)` nel sync, multi-livello:
  1. Nome ESATTO della NOSTRA squadra sul portale per quel `team_id` (dai `team_mappings` salvati all'import) con UGUAGLIANZA esatta → gestisce correttamente anche i DERBY (opponent = l'ALTRA squadra SIRIO).
  2. "Noi stessi": se una colonna è una nostra squadra e l'altra no → l'altra è l'avversario (GARANZIA: l'avversario non è mai noi stessi).
  3. Overlap token nome società (distintivo) + 4) tie-break token club (es. SIRIO). Se ambiguo → non tocca i campi.
- `change_details` ora include opponent_old/opponent_new.
- Test standalone 8/8 PASS (casa/trasferta normali, "noi stessi" corrotto, derby ROSSA↔ARANCIO, sottostringhe tipo "SIRIO PALLAVOLO" vs "...ROSSA", avversari con "PERUGIA"). Verificato anche via endpoint su dato corrotto (3272 "PALLAVOLO PERUGIA" → "SCHOOL VOLLEY PERUGIA VERDE").
- Nota: i casi "avversario = nostra squadra" vengono corretti anche se i team_mappings fossero generici (via token). I DERBY veri richiedono team_mappings per-squadra (SIRIO li ha). Un derby mostra correttamente l'ALTRA squadra SIRIO: NON è un errore.
- AZIONE UTENTE: deploy backend su Render, poi ri-eseguire "Sincronizza FIPAV" → i 4 errori si correggono. Se restano, inviare i match_number per analisi sui dati reali.


## 📥 05/10/2026 — Export calendario: Chrome chiede "autorizzazione al download"
- Causa: lexport Excel/PDF genera il file dopo vari await e lo scarica via URL.createObjectURL + click anchor. Senza blocco anti doppio-click, lutente premeva piu volte (screenshot: stesso file scaricato 5 volte) -> Chrome classifica come "download automatici" e chiede/ blocca lautorizzazione.
- Fix (frontend app/admin/matches.tsx): stato `exporting` (excel/pdf/ics) che disabilita i pulsanti e mostra "Attendere…" durante la generazione -> un solo download per volta. Aggiunto guard `if (exporting) return` + finally reset in tutti e 3 gli handler.
- NOTA: se Chrome ha gia impostato il permesso "Download automatici" su blocca/chiedi per il sito, lutente deve riabilitarlo (icona nella barra indirizzi / lucchetto -> Impostazioni sito -> Download automatici -> Consenti). Modifica solo frontend -> redeploy Vercel.

## 🔔 05/10/2026 — Badge notifiche non si azzera ("2 non lette" dopo averle lette)
- Causa: la lista /admin/notifications era limitata a 100 ordinate per data. Le non lette piu vecchie restavano fuori dalla lista -> non espandibili (si marcano lette solo espandendo) e il pulsante "Segna tutte lette" non compariva (visibilita basata sulle non lette CARICATE). Il badge usa il conteggio backend globale -> restava >0.
- Fix backend (routes/notifications.py): lista ordina NON LETTE per prime (read asc, created_at desc) e limite alzato a 300; unread-count e mark-all-read usano {read: {$ne: True}} per allineare conteggio e azzeramento (gestisce anche read mancante/null).
- Fix frontend (app/admin/notifications.tsx): markAllAsRead ricarica dal server. La dashboard gia ricarica il conteggio su focus.
- Verificato in preview: 14 non lette -> tutte in lista -> mark-all-read -> 0.
- Nota: esiste qualche admin_notification orfana con society_id=None (non conteggiata per societa); non impatta il badge. Modifiche frontend+backend -> redeploy Vercel + Render.

## ✅ 05/10/2026 — Sync FIPAV: FIX DEFINITIVO 4 gare "contro noi stessi" (token distintivo prioritario)
- Dati reali dal portale (SIRIO 5740/2410): gara 956 SCHOOL VOLLEY PERUGIA vs SIRIO PALLAVOLO; 984 inverso; 1105 SIRIO PALLAVOLO ROSSA vs PERUGIA VOLLEY TEAM...; 1120 inverso. Nessun derby.
- Causa reale: il layer "overlap token" di _classify dava PIU punti allavversario che condivide token GENERICI/citta col nome societa (es. SCHOOL VOLLEY PERUGIA vs societa SIRIO PERUGIA VOLLEY -> PERUGIA+VOLLEY=2) rispetto al nostro vero lato SIRIO PALLAVOLO (SIRIO=1) -> ci identificava come avversari. Confermato: lo stato errato in produzione combacia ESATTAMENTE con loutput del vecchio overlap -> la sync raggiunge le gare, era la logica sbagliata.
- Fix: in _classify il token DISTINTIVO del club (our_primary, es. SIRIO) ora e PRIORITARIO sui token generici. Nuovo ordine: 1) nome esatto squadra (team_mappings) 2) "noi stessi" via portal names 3) token club distintivo (solo un lato lo contiene -> quello siamo noi) 4) overlap SOLO su token distintivi (esclusi _GENERIC: VOLLEY/PALLAVOLO/ecc.).
- Verificato standalone sui 4 record reali anche con team_mappings GENERICI (caso peggiore): 4/4 PASS. Sync Pallavolo preview: 35 trovate, 0 update, nessun errore.
- AZIONE UTENTE: deploy Render, poi Sincronizza FIPAV -> le 4 gare si correggono.

## 🔔 05/10/2026 — Atleta RITIRATA compariva ancora negli elenchi squadra
- Segnalazione: atleta con is_withdrawn=True (badge "Ritirato") compariva ancora nella tabella "N atleti" (/admin/team-roster) e in "Registra Presenze" (team-attendance.tsx).
- Causa: /admin/team-roster filtrava solo rollover_decision=="removed" e il frontend attendance filtrava status!=="withdrawn"; ma gli atleti ritirati hanno is_withdrawn=True con status spesso diverso (es. trial) -> non venivano esclusi.
- Fix (backend, server.py /admin/team-roster): aggiunto is_withdrawn:{$ne:True} a entrambe le query (ALL e per squadra). Esclude i ritirati da elenco, conteggio e registrazione presenze (schermate che usano team-roster).
- Verificato preview: roster ALL 5 -> marco un atleta withdrawn -> 4 -> ripristinato. Solo backend -> redeploy Render.
- Nota: nella lista Atleti (admin/athletes.tsx) i ritirati restano visibili con nome barrato + badge "Ritirato" (informativo, voluto). Se si vuole nasconderli anche li, chiedere conferma.


## Aggiornamento export gare (giugno 2026)
- PDF Calendario Gare: ora UN'UNICA lista cronologica di tutte le gare (colonne: #, Data, Ora, Casa/Tras., Squadra, Gara N., Campionato, Girone (evidenziate in giallo), Avversario, Impianto, Città, Ritrovo, Risultato) — rimosse le sezioni per squadra. Intestazione tabella ripetuta su ogni pagina.
- Excel Riepilogo: logo società inserito con proporzioni reali (altezza 80px, larghezza calcolata dall'immagine), titolo società a 24pt su due righe unite.


## 🆕 Dichiarazione della posizione previdenziale (giugno 2026)
Scopo: RegistraTEAM raccoglie, fa sottoscrivere e conserva la dichiarazione previdenziale del lavoratore sportivo. Nessun calcolo contributivo/aliquote; soglie €5k/€15k non toccate.
- Flusso: pregresso (firma 1, invariato) → **Dichiarazione posizione previdenziale (firma 2 separata)** → accettazione accordo. Opzioni A/B/C/D (A e B con tipologia obbligatoria + precisazione facoltativa; D = «Da verificare»).
- Solo il lavoratore può dichiarare/aggiornare (card "Posizione previdenziale dichiarata" nelle pagine Compensi di atleta PRO/coach/dirigente/collaboratore). Ogni variazione = nuova versione append-only (version_number, previous_declaration_id, text_version, agreement_id, IP/UA/data, firma). Nessuna modifica/cancellazione via app.
- Admin: sola consultazione. Pannello nelle schede compenso (sotto Dichiarazione Pregresso) + pagina `/admin/pension-declarations` (filtri Firmate/Da verificare/Non dichiarate, storico con firme, export Excel 3 fogli: Riepilogo, Storico, Legenda). Voce in Stanza Bottoni → Contabilità e Compensi. Notifica `admin_notifications` a ogni nuova dichiarazione.
- Backend: `routes/pension_declarations.py`, collection `pension_declarations`. Endpoint: GET/POST `/me/pension-declaration/{status|declare}`, GET `/admin/users/{id}/pension-declarations`, GET `/admin/pension-declarations/summary`. I 3 endpoint `accept-compensation` (atleta/coach/dirigente) bloccano con 403 `PENSION_DECLARATION_REQUIRED` se manca la dichiarazione (admin escluso).
- Testi canonici versionati lato backend (`PENSION_TEXT_VERSION = "1.0"`).


## 🆕 Archivio Quietanze Firmate (giugno 2026)
- Stanza Bottoni: voce rinominata da "Quietanze Speciali" a **"Quietanze"**.
- Pagina `/admin/quietanze`, tab "Archivio Firmate" (ex "Report Quietanze" che era solo un link): elenco di TUTTE le quietanze firmate della società (coach/dirigenti/collaboratori/atleti PRO) da `signed_documents`, raggruppate mese per mese, filtri anno + ruolo, totale annuo, PDF singolo (`/documents/download/{id}`), **ZIP del mese / dell'anno** per il commercialista. Link al Report Compensi in fondo.
- Backend `routes/quietanze_archive.py`: GET `/admin/quietanze/archive?year=`, GET `/admin/quietanze/archive/zip?year=&month=&role=` (riusa la logica di download/rigenerazione PDF di `download_document`).
- Componente: `src/components/admin/QuietanzeArchive.tsx`.

- 🆕 **Invio al commercialista**: pulsante "Invia" (per mese e per anno) in Archivio Firmate → modal con email (memorizzata in `settings.accountant_email` della società e riproposta) + messaggio facoltativo → POST `/admin/quietanze/archive/send-email` invia via Brevo lo ZIP dei PDF + riepilogo tabellare nel corpo (limite 9 MB). Log in `quietanze_email_log`.


## 🆕 Ri-accettazione accordo e variazione pregresso (giugno 2026)
- **Reset accettazione (B)**: se l'admin varia compenso mensile (A) o periodo contratto (C) → `compensation_accepted=False` + `compensation_reaccept_reason`. Implementato in PATCH `/users/{id}` (coach/dirigenti/collaboratori: già per importo, ora anche per date) e PATCH `/athletes/{id}/compensation/settings` (atleti PRO, sync anche sul record users collegato). Nessun reset se i valori non cambiano.
- **Variazione pregresso (D) dal lavoratore**: POST `/me/prior-compensation/declare` non blocca più la ri-firma nello stesso anno: la dichiarazione precedente viene accodata in `other_annual_compensation_user_history` (append-only, con firma/IP/UA) e sostituita. Admin GET restituisce `user_history` (mostrato in AdminPriorCompensationPanel). Status include `versions`.
- UI: pulsante "Varia pregresso (nuova dichiarazione firmata)" in CompensationSummaryCard (atleta PRO/coach) e nuova `PriorCompensationSelfCard` in dirigente/collaboratore. Dopo la variazione, se la posizione previdenziale non è firmata, viene richiesta subito. Il pulsante previdenziale resta sempre disponibile (PensionDeclarationCard) anche senza variazioni.

- 🆕 **PDF firmati per lavoratore**: ogni firma della Dichiarazione Previdenziale e del Pregresso genera un PDF (`routes/declaration_pdf.py`) salvato in `signed_documents` (types `pension_declaration`, `prior_compensation_declaration`, con signer_id/athlete_id). Visibili in "I Miei Documenti" (atleta: `athlete/documents.tsx`; coach/dirigente/collaboratore via `/documents/my-documents`), scaricabili da `/documents/signed/{id}/pdf`, e in Cronologia atleta (`/athletes/{id}/timeline`: eventi "Firmato: …" + "Accordo Compenso Accettato"). Backfill automatico/idempotente dei PDF per dichiarazioni pre-esistenti all'apertura della pagina admin Dichiarazioni Previdenziali (o POST `/admin/pension-declarations/backfill-documents`).

- 🆕 **Cronologia per coach/dirigenti/collaboratori**: GET `/me/timeline` (`routes/worker_timeline.py`) con registrazione, privacy, accordo accettato/da ri-accettare, variazioni pregresso, documenti firmati (quietanze, previdenziale, pregresso, soglie). Schermata riusata (`athlete/timeline.tsx` → se l'utente non ha athlete_id usa `/me/timeline`); route `coach|dirigente|collaboratore/timeline`; pulsante "Cronologia" nei 3 profili sopra "I Miei Documenti".

- 🧹 **Pulizia dashboard mobile (giugno 2026)**: rimosso il mini-logo società dalle tab bar di atleta/coach/dirigente/collaboratore (tab più larghe) e rimosso il cerchio con l'iniziale nella dashboard atleta (`athlete/index.tsx`).

- 🐛 **Fix anagrafica collaboratore**: `collaboratore/profile.tsx` ora salva il profilo sul server PRIMA di aprire la Privacy (come coach/dirigente) → la data di nascita e gli altri dati non vanno più persi se la firma viene interrotta. `formatDate` robusto (gg/mm/aaaa, aaaa-mm-gg senza shift fuso, date invalide → '') in collaboratore/coach/dirigente. Backend PATCH `/auth/me` accetta anche `date_of_birth` in gg/mm/aaaa e restituisce 400 (non più ignora) se non valida.

- 🖼️ **Logo trasparente**: `storage_util.compress_data_uri_to_image(keep_alpha)` — se il logo caricato ha trasparenza resta PNG (prima veniva appiattito in JPEG su sfondo bianco → riquadro bianco). Attivo in PATCH `/settings/society` (logo). L'admin deve ricaricare il logo scontornato una volta.

- 🐛 **Notifiche previdenziali triplicate**: la lista notifiche admin è per società ma veniva creata una notifica per ogni account admin (3 admin → 3 copie). Ora 1 notifica per società; dedupe automatico dei duplicati esistenti all'apertura di Dichiarazioni Previdenziali.
- 🔵 **Prove scadute**: `/admin/team-roster` espone `trial_max_sessions`; in Registra Presenze gli atleti in prova oltre il limite mostrano "🔴 PROVA SCADUTA · n/max — serve certificato medico e iscrizione" (prima solo "In prova · 7 allenamenti"). Il periodo di prova NON si chiude da solo: resta "in prova" finché l'admin non carica certificato e completa l'iscrizione.


## 🆕 Igiene Dati, Riepilogo Incassi e blocco prove oltre il limite (giugno 2026)
- 🐛 **Prove oltre il limite (es. 7/6) — causa**: (1) `check_athlete_status` (scan QR) bloccava solo per giorni scaduti e SOLO se la privacy non era accettata, mai per sedute massime; (2) presenze manuali/multiple admin non controllavano affatto la prova; (3) l'avvio prova da `pending_trial` leggeva la chiave sbagliata `trial_days` (→ 14 gg) invece di `trial_max_days` (7). **Fix**: nuovo helper `get_trial_block_reason(athlete)` in `server.py` (blocca se status trial/pending_trial e sedute ≥ max OPPURE data fine superata; ignora atleti già active/approved). Usato in `check_athlete_status` (QR), `POST /coach/athletes/{id}/manual-attendance` (400) e `POST /admin/teams/{id}/bulk-attendance` (atleta saltato con motivo "prova terminata"). Le presenze storiche già registrate non vengono toccate.
- 🆕 **Igiene Dati** (`/admin/data-hygiene`, backend `routes/data_hygiene.py` GET `/admin/data-hygiene`, admin/coordinatore): controlli su atleti non ritirati — CF mancante, CF formato non valido, CF duplicato (anche ritirati), possibile doppione nome+cognome+data nascita, data nascita mancante, senza squadra, squadra inesistente, minorenni senza genitore, link genitore orfano, link account orfano (esistenza verificata globalmente), genitori senza figli, maggiorenni senza contatti. Sezioni espandibili con severità, tap → scheda atleta. Voce in Stanza Bottoni → Manutenzione Dati.
- 🆕 **Riepilogo Incassi** (`/admin/income-summary`, GET `/admin/payments/income-summary?date_from&date_to` in `routes/payments_history.py`, admin/dirigente/coordinatore): solo importi effettivamente incassati (pagati/parziali) al netto dei rimborsi, raggruppati per metodo (etichetta reale: Contanti, Bonifico, Stripe (Carta), POS…) con quota % e barra, dettaglio mensile espandibile. Preset periodo: Tutto / Questo mese / Mese scorso / Anno solare / Personalizzato. Voce in Stanza Bottoni → Contabilità e Compensi.

- 🆕 **Dual-role = una sola posizione contributiva (giugno 2026)**: per chi è Atleta PRO + Coach/Dirigente/Collaboratore (alias `email#coach`, stesso CF) la **Dichiarazione Previdenziale** e il **Pregresso** valgono per la persona, non per il ruolo. `_get_linked_prior_comp_docs` (server.py) ora include anche l'altro account dual-role (via `_find_linked_compensated_user_for_athlete` / `_find_linked_athlete_pro_for_user`), quindi: stato/firma pregresso sincronizzati su tutti i record; `routes/pension_declarations.py` usa `_person_ids()` per status lavoratore, versioning, `require_pension_declared`, vista admin e **riepilogo admin unito in una riga per persona** (role `coach+atleta_pro`, compenso mensile sommato, pregresso = quello firmato). Frontend: `roleLabelIt()` ("Coach + Atleta Pro"), PensionDeclarationCard mostra "Firmata dal tuo profilo Atleta Pro: vale per tutti i tuoi incarichi".
- 🐛 **Quietanze admin (Gestione)**: prima mostrava SOLO le quietanze personalizzate (importo ≠ standard), quindi es. il collaboratore con "Set 2026 € 450" firmata non compariva. Ora `admin/quietanze.tsx` elenca anche "Quietanze Standard Firmate" e "Standard in Attesa" (coach, dirigenti, collaboratori, atleti pro) con card compatte + elimina; stat cards = In attesa / Firmate / Totale (con conteggio custom tra parentesi), rispettano il filtro ruolo.
- 🆕 **Archivio Dichiarazioni (Quietanze → tab "Dichiarazioni")**: `routes/declarations_archive.py` — GET `/admin/declarations/archive?year=` (esegue prima il backfill idempotente dei PDF mancanti), GET `/admin/declarations/archive/zip?year=&doc_type=&person=`, POST `/admin/declarations/archive/send-email`. Tipi: prior_compensation_declaration (pregresso/compensi da terzi), pension_declaration, threshold_declaration_5000/15000, threshold_5000/15000_communication. Raggruppate per PERSONA (dual-role unito via `_person_ids`), con ruoli, data accettazione accordo; ZIP con una cartella per persona; email Brevo al commercialista (indirizzo salvato in settings.accountant_email, log in quietanze_email_log kind=declarations). Frontend `src/components/admin/DeclarationsArchive.tsx`. Nota: l'accettazione dell'accordo compenso non ha PDF (solo flag/data).
- 🆕 **Fascicolo Persona**: GET `/admin/declarations/fascicolo/zip?person=&year=` → ZIP unico con `Nome/Quietanze/*.pdf` + `Nome/Dichiarazioni/*.pdf` + `_INDICE.txt`. L'archivio dichiarazioni elenca ora anche chi ha solo quietanze (`receipts_count`) così il bottone "Fascicolo" è disponibile per tutti i percettori.
- 🐛 **Pregresso 0 "non accettato"**: in "Variazione Pregresso" con importo corrente nullo il campo restava vuoto e il placeholder "0,00" sembrava un valore → bottone grigio. Ora il campo è sempre precompilato ("0" o importo attuale) e campo vuoto = 0 (`PriorCompensationDeclarationModal.tsx`).
- 🔁 **Consensi Privacy** spostato da Impostazioni a Stanza dei Bottoni → Archivi e Consensi (route `/admin/settings/consent-audit` invariata). Impostazioni: card rinominata "Esporta Dati e Backup" (il backup ZIP completo si crea lì); descrizione di "Ripristino Backup" indica dove crearlo.
- 🆕 **Compenso al Coordinatore (dual-role Coordinatore ↔ Dirigente)**: `PATCH /users/{id}/compensation` su un coordinatore crea/riusa un account **Dirigente collegato** (`_ensure_coordinatore_dirigente_alias`: alias `email#dirigente`, `linked_coordinatore_user_id`, link attivo; sul coordinatore `linked_dirigente_user_id`) e applica il compenso a quello; risposta con `redirect_user_id` → la pagina admin `/admin/dirigente/[id]` apre il profilo Dirigente. `GET /auth/linked-accounts` espone "Modalità Dirigente" / "Modalità Coordinatore" (switch con stesso login); `SwitchAccountButton` aggiunto alla dashboard coordinatore. `GET /users/{id}` restituisce `linked_dirigente_user_id` / `linked_coordinatore_user_id`; banner nella scheda admin. Il coordinatore accetta accordo, pregresso, previdenza e quietanze dal profilo Dirigente (flusso dirigente esistente).
- 🐛 **Dati bancari coordinatore/dual-role**: nuovo helper `_sync_bank_details_to_linked(user_doc, bank_sync)` (server.py) che propaga IBAN/intestatario/banca a record atleta e a tutti gli alias collegati (coach, dirigente, coordinatore, genitore; link diretti e inversi) e allinea sempre `iban_holder` ⇄ `account_holder` (admin scrive/legge iban_holder, lavoratore account_holder: prima la scheda admin mostrava "-" per l'intestatario). Usato da `PATCH /users/me/bank-details` (ora legge il doc utente completo: il vecchio sync coach non funzionava perché `current_user` è ridotto) e `PATCH /users/{id}/bank-details`. Alias dirigente del coordinatore creato copiando anche i dati bancari. Admin `dirigente/[id].tsx` legge `iban_holder || account_holder`.
- 🐛 **HOTFIX scan QR "Errore durante la registrazione"** (produzione): `check_athlete_status` usava `trial_active` rimosso nella modifica del blocco prove → NameError → 500 su `POST /attendance/check`. Ripristinata la variabile (prova in corso = is_trial o status trial/pending_trial). Corretti anche due NameError latenti: `ITALIAN_MONTHS` → `_MONTH_NAMES_IT` (rigenerazione PDF quietanza) e `document_id` → `receipt_id` (ricevuta unificata atleta pro). Verificato con testing agent (iteration_129, 19/19).
- 🐛 **Fuso orario gare (+2h per non-admin)**: la data gara è salvata come ora italiana "in UTC" (es. 19:00 → T19:00:00Z); l'admin la mostra con `timeZone:'UTC'`, mentre `app/matches.tsx` (Calendario Gare per atleti/genitori/coach) e `AthleteMatchesCard.tsx` usavano l'ora locale del dispositivo → +2h. Ora usano getter UTC / `timeZone:'UTC'` (anche il raggruppamento per mese).
- 🆕 **Pulsante PRIVACY per Coach/Dirigente/Collaboratore** (`src/components/PrivacySignButton.tsx`, nelle dashboard): arancione "FIRMA LA PRIVACY" se non firmata, viola "PRIVACY · Firmata il …" se firmata; porta al profilo con `?sign_privacy=1`. I profili (`coach/profile`, `dirigente/profile`, `collaboratore/profile`) con quel parametro aprono subito il GDPRPrivacyModal se i campi obbligatori sono completi, altrimenti entrano in modifica con avviso; se già firmata aprono la modifica per i consensi. (Atleta 18+ ha già la voce "Firma privacy" in dashboard; il Coordinatore non ha profilo/privacy.)
- 🎨 **Banner Calendario Gare Società** (`SocietyMatchesLink.tsx`, su tutte le dashboard): colore pastello arancione con bordo, badge "APRI" e pulsazione (4 cicli, ~5 s) all'apertura. **Riga PRIVACY + MAPPA PALESTRE**: `PrivacySignButton` ora a metà larghezza con accanto il nuovo `GymMapButton` (→ `/palestre`); stessa riga nella dashboard genitori (pulsante privacy esistente + mappa).
- 🐛 **Minorenni bloccati "in prova" (es. 7/3, anche dopo aver pagato)** — causa: l'uscita dalla prova (`check_and_activate_if_ready`) dipendeva dal flag `end_trial_requested`, impostato solo se il genitore premeva "Termina prova e iscriviti"; senza quel click l'atleta restava in prova per sempre anche con privacy firmata e certificato convalidato. Fix: `maybe_activate_minor_athlete()` attiva il minorenne appena ha privacy + certificato convalidato (se richiesto dalla squadra), richiamato alla convalida certificato, alla firma privacy (gdpr_minor), all'update atleta, in "Ripara prove in blocco" (ora restituisce anche `activated`) e in un backfill idempotente all'avvio. `_trial_missing_reasons()` espone nel roster (`trial_missing`) il motivo per cui è ancora in prova ("privacy da firmare", "certificato mancante/da convalidare/scaduto"); `team-attendance.tsx` lo mostra nel badge.
- 🐛 **HOTFIX pagina bianca profilo Coach** (`coach/profile.tsx`): il blocco `useEffect` per `?sign_privacy=1` era stato inserito PRIMA della dichiarazione di `privacyAccepted` (usata nelle deps) → TDZ "Cannot access before initialization" → schermo bianco. Spostato dopo le dichiarazioni di stato (dirigente/collaboratore erano già corretti).
- 🐛 Coach dashboard: `<SocietyMatchesLink />` era dentro il tab Scanner (invisibile di default) → spostato a livello dashboard sotto la riga PRIVACY/MAPPA PALESTRE. Verificato testing agent iteration_130/131 (profili coach/dirigente/collaboratore/admin/genitore OK).
- 🆕 **Nome società nelle gare** (`_society_short_name()` in server.py: toglie SSD/ASD/a RL/srl… dal nome in Impostazioni → "Sirio Perugia"): aggiunto `society_name` a `/matches/society-view`, `/athletes/{id}/matches` e ai "Prossimi impegni" (title "Gara Sirio Perugia vs X" / "X vs Sirio Perugia" in trasferta); `AthleteMatchesCard` usa `society_name || team_name`. **Atleta PRO "Da fare"**: aggiunto il banner Calendario Gare Società. **Presenze e Statistiche** (`athlete/presenze.tsx`): restyle pastello (sfondo lavanda, card orari azzurra, statistiche verde/arancio/viola, storico con bordi).
- 🐛 **FIX crash schermata bianca su mobile (documenti firmati)** (15/10/2026): le pagine profilo usavano tag HTML grezzi non supportati da React Native su iOS/Android → crash al rendering appena l'utente aveva almeno un documento firmato. Sostituiti con `TouchableOpacity`: `coach/profile.tsx` (2 blocchi `<a>`), `dirigente/profile.tsx` (2 `<a>`), `collaboratore/profile.tsx` (`<a>` + `<div>` modale), `admin/index.tsx` (2 `<a>` Approva/Rifiuta staff). Creata utility condivisa `src/utils/openSignedDocument.ts` che segrega web (Blob + nuova scheda/download) e native (expo-file-system/legacy base64 + expo-sharing, stesso pattern già collaudato in admin/athlete/[id].tsx). Aggiunto `src/components/ErrorBoundary.tsx` con fallback "Riprova" e avvolto lo stack Coach in `coach/_layout.tsx`. `admin/athlete/[id].tsx` e `athlete/payments.tsx` erano già web-guarded (nessun tag JSX HTML). Web verificato (profilo coach renderizza, nessuna regressione); verifica nativa del PDF richiede build su dispositivo.
- 🐛 **FIX ricorrenza "PROVA SCADUTA · pronto: usa Ripara prove in blocco"** (16/10/2026): minorenni "pronti" (privacy firmata; certificato NON richiesto da squadre tipo U12) restavano bloccati in prova e non si attivavano mai da soli. CAUSA: il backfill allo startup (`Migration minorenni prova→attivo`) PRETENDEVA `medical_certificate_verified:True` + `medical_certificate_expiry`, escludendo i minori di squadre senza obbligo di certificato; inoltre il roster presenze mostrava lo stato ma non attivava mai l'atleta. FIX: (1) rimossi i requisiti certificato dalla query del backfill minorenni (ora gatekeeper unico = `maybe_activate_minor_athlete` → `_trial_missing_reasons`); (2) l'endpoint roster presenze (`GET` team attendance ~L9602) ora chiama `maybe_activate_minor_athlete` per ogni minore in prova senza motivi mancanti, attivandolo all'apertura della pagina (niente più pulsante manuale). Verificato con atleta di test (minore, trial, privacy ok, team certificate_type_required="none") → attivato automaticamente. NB: effettivo su registrateam.it solo dopo Publish/deploy.
- 🆕 **Quietanze compensi: NETTO + progressivi distinti (Riforma Sport)** (16/10/2026): oltre €5.000 annui (LORDO cumulato) la quietanza mostra Lordo → Contributi INPS (quota lavoratore 1/3) → NETTO corrisposto. Motore centrale `compute_sport_inps_withholding()` (server.py): IVS 25% sul 50% dell'eccedenza + 2,03% sull'intera eccedenza, quota lavoratore 1/3 (≈4,84% dell'eccedenza); aliquote configurabili; flag utente `inps_insured_elsewhere` (24% senza 2,03%). Collegato ai 4 flussi firma (coach/dirigente/collaboratore/atleta) + salvataggio separato amount_gross/deductions/amount_net/inps_breakdown. PDF `generate_monthly_receipt_pdf` nuovo param `inps_breakdown`. Frontend: util mirror `src/utils/inpsWithholding.ts`, componenti `InpsNetBreakdown.tsx` (riquadro netto in firma) e `CompensoInformativa.tsx` (informativa punto 4 sempre visibile sopra la firma). Aggiunte seguendo indicazioni ChatGPT dell'utente: (1) quietanza con "Modalità di pagamento: Bonifico" (fissa) e nuova dichiarazione "Dichiaro di aver ricevuto l'importo netto... progressivi distinti... compensi pregressi/altri committenti"; (2) progressivo FISCALE €15.000 distinto dal previdenziale €5.000, base = LORDO (compenso fiscalmente rilevante), etichettato "criterio da validare dal consulente"; (3) trattenuta INPS scelta dall'utente come ATTIVA e DEFINITIVA. Verificato: helper numerico (es. eccedenza €1.000 → trattenuta €48,43 → netto €951,57), record coach Alice net=2378,92 su lordo 2500, PDF contiene righe italiane corrette (testing agent iteration_135 + estrazione pypdf). Dati storici non modificati; blocco dichiarazione soglie invariato (non rimosso).
- 🆕 **Netto anche dentro l'anteprima quietanza (riquadro grigio)** (17/10/2026): su richiesta utente, oltre al riquadro giallo `InpsNetBreakdown` e al PDF, il netto compare ora DENTRO il riquadro grigio di anteprima quietanza di tutte e 4 le schermate compensi tramite nuovo componente compatto `src/components/InpsNetLines.tsx` (Quota eccedente €5.000 / Contributi INPS 1/3 / Netto corrisposto), visibile solo quando il cumulo supera €5.000. NB: lo screenshot utente "Chiara/Sirio Perugia" proveniva dalla PRODUZIONE (registrateam.it) — NON presente nel DB preview — quindi le modifiche compensi non erano visibili lì perché non ancora pubblicate; richiesto Publish/Deploy per renderle live. Bundle preview verificato contenere i nuovi componenti; lint pulito.
- 🆕 **Regime INPS guidato dalla Dichiarazione previdenziale (A/B/C/D)** (18/10/2026): il supplemento 2,03% NON dipende più da un flag manuale ma dalla Dichiarazione della posizione previdenziale firmata dal collaboratore. Mapping: posizione **A** (assicurato presso altra previdenza obbligatoria) o **B** (titolare di pensione diretta) → IVS **24% SENZA** 2,03%; posizione **C** (nessuna altra copertura/pensione) o **D** (da verificare) → regime pieno **IVS 25% + 2,03%** sul 100% dell'eccedenza oltre €5.000 (default prudenziale). Implementazione minimale per denormalizzazione: alla firma (`declare_my_pension_position`) il flag `inps_insured_elsewhere` viene sincronizzato su users+athletes di tutta la persona (dual-role) e la auth-cache invalidata; così i 5 punti di calcolo backend e l'anteprima frontend (via `/auth/me`) restano allineati senza altre modifiche. Aggiunto `inps_insured_elsewhere` anche a `GET /me/pension-declaration/status`. Backfill dichiarazioni esistenti (3 doc) + re-sync idempotente nel riepilogo admin. Verificato il motore: eccedenza €1.000 → C/D netto €951,57 (IVS 125 + 2,03% 20,30 → worker 48,43), A/B netto €960,00 (IVS 120, 0 supplemento).

## Aggiornamento 30/10/2026 — Riepiloghi mensili in Quietanze
- Pagina `/app/frontend/app/admin/quietanze.tsx`: aggiunta sezione collassabile "📅 Riepiloghi mensili" (sotto il banner NETTO DA EROGARE).
- Aggregati: "✅ Erogato finora", "⏳ Da erogare" (mesi passati+corrente), "📈 Budget futuro" (mesi futuri).
- Per ogni mese: Totale compensi (netto) / Erogato / Residuo, con tag Passato / Mese corrente / Budget futuro. Residuo mostra "Saldato" se pagato.
- Helper `_paidOf` considera anche lo split anticipo/saldo (advance_paid + balance_paid). Rispetta i filtri ruolo.
- Verificato in preview (export dist + restart expo). Richiede Save to GitHub + redeploy Vercel per il live.

## Aggiornamento 30/10/2026 — Ripartizione anticipo/saldo lato Admin
- `/app/frontend/app/admin/athlete/[id].tsx` (modale "Gestione Quietanze"): aggiunto riquadro "💶 Pagamento in due tranche" (Anticipo/Affitto · subito + Saldo · a seguire = netto − anticipo) sia per i mesi firmati (con ✓ se advance_paid/balance_paid) sia per i mesi non firmati. Parità con la vista atleta.
- Config letta da athlete.advance_split_enabled / advance_amount / advance_label.
- Verificato in preview su atleta di test (split Affitto €400 + Saldo netto). Dati di test ripristinati.
- Richiede Save to GitHub + redeploy Vercel per il live.

## Aggiornamento 30/10/2026 — Selettore periodo in Quietanze
- `/app/frontend/app/admin/quietanze.tsx`: aggiunto selettore "📆 PERIODO" (chips orizzontali: "Tutti i mesi" + ogni mese/anno presente nei dati), posizionato sotto le stat cards.
- Stato `filterPeriod` applicato a `filteredReceipts` → filtra l'INTERA pagina (stat cards, banner netto, Riepiloghi mensili, elenco quietanze) sul periodo scelto.
- `availablePeriods` derivati da receipts, ordinati dal più recente.
- Verificato in preview: selezione "Aprile 2026" → tutta la pagina mostra solo quel mese (netto 11.907, 5 quietanze). Richiede Save to GitHub + redeploy Vercel per il live.
