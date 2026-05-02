# RegistraTEAM - Product Requirements Document

## Problema Originale
Applicazione completa per la gestione di società sportive dilettantistiche italiane. Focus su GDPR, ruoli, collegamento genitori-atleti, documenti PDF dinamici e sincronizzazione calendario gare federali.

## Architettura
- **Frontend**: React/Expo (build statiche web `npx expo export -p web` + `serve -s dist -l 3000`)
- **Backend**: FastAPI (server.py monolitico >24k righe)
- **Database**: MongoDB
- **Integrazioni**: Brevo (email), ReportLab (PDF), BeautifulSoup (scraping federazioni)

## Asset Pubblicazione (acquisiti)
- **Domini**: registrateam.it (principale), registrateam.com, registrateam.net
- **Email**: 
  - info@registrateam.it (contatto commerciale)
  - assistenza@registrateam.it (supporto utenti)
  - registrateam@gmail.com (operativo interno: Brevo, Stripe, fornitori)

## File Bloccati
Vedi `/app/memory/LOCKED_FILES.md`

## Completato 02/05/2026 (notte) — Backup Completo Società (ZIP)
- ✅ **Backend `GET /api/admin/backup/export`**: endpoint admin-only che raccoglie tutte le collezioni rilevanti (users senza password_hash, athletes, teams, matches, attendance, audit_logs, notifications, seasons, compensations, consents, gdpr_documents, payments, parent_athlete_links, ecc.) e le impacchetta in ZIP con JSON per ogni collezione + README.json + society.json + society_profile.json
- ✅ **Scoped per society_id**: in single-tenant equivale a "tutto", in multi-tenant (futuro) sarà corretto
- ✅ **Esclusi file binari pesanti** (logo, foto atleti base64, certificati PDF) per tenere ZIP leggero (~36MB solo dati strutturati)
- ✅ **Frontend `/admin/settings/export-data`**: nuova card blu evidenziata "🗄️ Backup completo (ZIP)" in cima alle altre opzioni di export CSV; usa lo stesso meccanismo di download blob già esistente
- ✅ **Verificato via curl**: response 200 con Content-Type application/zip, ZIP valido contenente README + society + users + athletes + teams + matches + audit_logs + payments
- ✅ **Smoke regression** 17/17 passati

## Completato 02/05/2026 (notte) — Rollback SINGLE-TENANT
**Decisione**: dopo aver verificato che il supporto multi-società richiede un audit completo di molti endpoint (athletes/teams/stats/notifications/etc) e non solo primary-admin + settings/society, l'utente ha optato per restare SINGLE-TENANT per il Pilot.

- ✅ **Società di test "Sirio Perugia Volley ASD" cancellata** dal DB (users + society + settings + notifications)
- ✅ **Link "Sei una nuova società? Registrati qui →" nascosto** dalla pagina `/login`. La pagina `/register-society` resta accessibile via URL diretto per ripresa futura
- ✅ **Codice multi-tenant mantenuto** in `routes/primary_admin.py` e `routes/settings.py`: non rompe nulla in single-tenant ed è già pronto per quando ripartiremo con il multi-tenant
- ✅ **Backfill eseguito**: le settings legacy di PPG ora hanno il campo `society_id` popolato correttamente
- ✅ **Smoke regression** 17/17 passati
- 📋 **Multi-tenant roadmap** (quando pronto): audit di `/api/athletes`, `/api/teams`, `/api/users/*`, `/api/stats/*`, `/api/admin/notifications`, `/api/birthdays/today`, `/api/certificates/*`, filtro `society_id` dappertutto

## Completato 01/05/2026 (notte) — Multi-tenancy Scettro + Test E2E Promozione
**Bug critico scoperto**: tutte le query del primary admin in `routes/primary_admin.py` erano globali (single-tenant). Questo significava che in un ambiente con più società, l'admin di una società poteva apparire come Responsabile Admin di un'altra società.

- ✅ **Refactor multi-tenant `routes/primary_admin.py`**: aggiunto parametro `society_id` a `_resolve_primary_admin_id()` e `is_society_institutional_email()`; tutte le query (admins/legal_rep/crownable/delegable/settings) ora filtrano per `society_id`
- ✅ **Settings doc multi-tenant**: il get_primary_admin_status legge le settings filtrando per society_id
- ✅ **Endpoint `declare`**: ora rifiuta solo se ESISTE già un LR NELLA STESSA SOCIETÀ (non globalmente)
- ✅ **Test E2E `tests/test_promotion_flow.sh`**: simula il flusso completo (register-society → declaration delegate → register dirigente → approve → promote ad admin → modal dichiarazione apparire al neo-admin → firma come LR → scettro trasferito al LR). VERIFICATO che funziona end-to-end
- ✅ **Verifica chiave**: dopo la promozione del Presidente ad admin, `should_show_declaration_popup=true` e `legal_representative_id=null` → il modal appare. Dopo la firma come LR, lo scettro passa correttamente al LR (Giuseppe), il vecchio admin (Mario) è declassato
- ✅ **Smoke regression** 17/17 passati

## Completato 01/05/2026 (tarda notte) — Onboarding Nuova Società
**Razionale**: con la sola lettura sull'account istituzionale, il flow di registrazione era contraddittorio (l'istituzionale non poteva accettare termini né creare la società). Implementato un flow corretto in cui il primo utente è SEMPRE persona fisica e l'account istituzionale viene creato automaticamente come "casella ombra".

- ✅ **Endpoint `POST /api/auth/register-society`** in `server.py`: crea atomicamente Società + admin persona fisica (Dirigente Incaricato) + admin istituzionale (read-only) con token reset password 7 giorni; manda email Brevo all'istituzionale con codice societario, link "imposta password", spiegazione del ruolo
- ✅ **Validazioni**: email istituzionale ≠ email personale (errore 400); termini + privacy + dichiarazione "autorizzato dalla società" obbligatori; nessuna delle email già usate
- ✅ **Helper `send_institutional_account_setup_email`**: email HTML brandizzata rossa con info-box "Modalità SOLA LETTURA", codice di reset, codice societario, durata 7 giorni
- ✅ **Verificato curl**: email uguali → 400, no terms → 400, OK → 200 + auto-login + utente in DB con `created_via: register-society-auto`. Email Brevo inviata effettivamente (Message ID confermato in log)
- ✅ **Frontend `/register-society`**: pagina pubblica con form 3-sezioni (Società / Dirigente / Legale), validazioni client-side, auto-login post-success → /admin
- ✅ **Login**: aggiunto link discreto "Sei una nuova società? Registrati qui →" sotto il bottone "Registrati" esistente
- ✅ **Smoke regression** 17/17 passati; build statica rigenerata

## Completato 01/05/2026 (tarda sera) — Account Istituzionale: SOLA LETTURA TOTALE
**Razionale**: L'account istituzionale (es. mailbox `pallavoloperugia@gmail.com`) è una casella email condivisa. Per garantire **accountability** delle operazioni nessuno deve poter operare in incognito da quella mailbox. Tutte le mutazioni sono bloccate; l'account può solo VEDERE.

- ✅ **Backend middleware `InstitutionalReadOnlyMiddleware`** (in `server.py`): intercetta tutte le request a `/api/*`, blocca POST/PUT/PATCH/DELETE da admin con `looks_like_society_name() == True` o `is_society_institutional_email() == True`. Whitelist: `/api/auth/login`, `/api/auth/logout`, `/api/auth/change-password`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/request-password-reset`. Risponde con `{detail, code: "institutional_read_only"}` HTTP 403
- ✅ **Verificato via curl**: PPG GET → 200, PPG PATCH → 403 read-only, PPG POST change-password → 422 (whitelist passa, errore solo body), Vincenzo PATCH → 200 (utente fisico non bloccato)
- ✅ **Axios interceptor** in `services/api.ts`: cattura 403 `institutional_read_only` e mostra alert nativo "Modalità SOLA LETTURA — questo account è intestato alla Società..." (throttled a 3.5s)
- ✅ **`GlobalReadOnlyBanner.tsx`**: banner fisso position:fixed in cima ad ogni route web, sempre visibile per istituzionali. Inserito in root `_layout.tsx`
- ✅ **`InstitutionalBanner` aggiornato**: ora usa "🔒 MODALITÀ SOLA LETTURA — ACCOUNT ISTITUZIONALE" con messaggio chiaro su accountability
- ✅ **`select-role.tsx`**: per istituzionali fa redirect automatico a `/admin` (no più scelta)
- ✅ **Cambio password rimane consentito** (whitelist), logout funziona, GET di tutto resta consentito
- ✅ **Smoke regression** 17/17 passati

## Completato 01/05/2026 (sera) — Account Istituzionale: badge + banner + filtri
- ✅ **Backend `/api/auth/me`**: aggiunto campo `is_institutional_account`
- ✅ **Backend `/api/users/dirigenti`**: filtra fuori gli account istituzionali
- ✅ **Componenti `InstitutionalBanner.tsx` + `InstitutionalBadge.tsx`**
- ✅ **Banner in 8 pagine settings** + **Badge in select-role/dashboard/profile**
- ✅ **`select-role.tsx`**: tile "Dirigente" nascosta per istituzionali
- ✅ **`authStore.loadAuth`**: ora chiama `refreshUser()` fire-and-forget per aggiornare flag dopo login da cache

## Completato 01/05/2026 — Fix popup Dichiarazione Responsabile Admin
- ✅ Fix bug "Detentore Attuale" istituzionale (esclude society dal fallback primary admin)
- ✅ Riscritto testo del popup con box informativi dinamici per LR/Dirigente autorizzato

## Completato 29/04/2026 (refactoring server.py - prima ondata):
- ✅ **Creato `utils.py`**: MONTH_NAMES, to_rome_time, format_rome_timestamp, clean_mongo_doc, clean_mongo_docs, get_current_season
- ✅ **Creato `models/enums.py`**: UserRole + UserStatus
- ✅ **Creato `models/settings_models.py`**: SocietySettingsUpdate + StripeSettingsUpdate
- ✅ **Creato `models/season_models.py`**: SeasonArchive
- ✅ **Creato `models/team_models.py`**: TrainingSession, MatchDay, Team, TeamCreate, TeamUpdate, AssignmentRequest
- ✅ **Estratto `routes/notifications.py`** (10 endpoint admin/user/photo-removal)
- ✅ **Estratto `routes/settings.py`** (6 endpoint society + stripe)
- ✅ **Estratto `routes/seasons.py`** (4 endpoint archivi stagioni)
- ✅ **Estratto `routes/parents.py`** (5 endpoint commitments + parent-link/*)
- ✅ **Estratto `routes/teams.py`** (12 endpoint principali; restano in server.py: attendance-stats e championships)
- ✅ **server.py ridotto** da 25.037 a **23.651 righe (-1.386 righe = -5.5%)**
- ✅ **37 endpoint** ora in 5 file modulari, modifiche future molto più rapide
- ✅ **Test smoke 14/14 passati** + verifica manuale teams (GET, payment-info, athletes-count) → tutto OK
- 📌 **Pattern proof-of-concept** consolidato e replicabile

## Completato 28/04/2026 (lavoro notturno):
- ✅ **Aggiornati tutti i 7 manuali HTML** (`/app/backend/docs/`) aggiungendo sezione "Supporto" con email reali (info@registrateam.it, assistenza@registrateam.it) e dominio www.registrateam.it
- ✅ **Redirect domini configurati**: registrateam.com e registrateam.net → registrateam.it (301 permanente, già attivi su Aruba)
- ✅ **Preparazione refactoring backend/server.py** (25.037 righe → moduli):
  - Creata struttura cartelle `/app/backend/routes/`, `/app/backend/models/`, `/app/backend/services/` (vuote, pronte)
  - Creato `/app/backend/database.py` (singleton MongoDB)
  - Creato `/app/backend/auth_utils.py` (JWT + get_current_user + password hashing)
  - Documento dettagliato in `/app/memory/REFACTORING_PLAN.md` con mappa completa di endpoint per dominio (304 endpoint, 92 modelli Pydantic)
- ✅ **Suite test smoke regressione**: `/app/backend/tests/test_smoke_regression.py` (14 test, eseguono in 5 secondi, verificano endpoint critici: auth, /me, settings, users, teams, athletes, notifications, export, threshold)
- ✅ **Documentazione architettura**: `/app/memory/ARCHITECTURE.md` (stack, modelli DB, flussi auth, comandi utili, deploy plan)
- ⚠️ **Refactoring vero (spostamento codice da server.py)**: NON eseguito nella notte per sicurezza. Da fare insieme all'utente in sessione attiva (~1-2 ore). Tutto è preparato e pronto.

## Completato 25/04/2026:
- Banner soglie 5k/15k unificati (Dirigente/Coach/Collaboratore + viste Admin):
  - Stile bordato/centrato unico, mese superamento in **grassetto**
  - Colori coerenti tra anno 1 e anno 2 (arancio per 5k, viola per 15k)
  - Banner "Dichiarazione firmata" con stile bordato verde (anno 1) / azzurro (anno 2)
  - Rimossi badge SUPERAMENTO inline ridondanti dentro al riepilogo annuo
- Backend: aggiunto `threshold_month` nel response API `/threshold-status` per dirigente/coach/collaboratore (logica di proiezione su tutti i mesi del contratto)

## ⏰ DA RICORDARE ALL'UTENTE (richiesto 25/04/2026):
- **L'utente vuole controllare ancora il ruolo Dirigente**: testare flussi/pagine non ancora verificati. Quando torna, chiedere: "Hai detto che volevi controllare se il dirigente ha altre cose da testare. Vuoi farlo ora?" ✅ COMPLETATO 27/04/2026 (Dirigente bloccato)

## 🚀 PIANO PUBBLICAZIONE (da iniziare quando l'utente è pronto):
L'utente ha richiesto guida passo-passo perché non riesce a fare da solo. Procedere:
1. Acquisto/configurazione DNS dominio registrateam.it (record A/CNAME verso server produzione)
2. Deploy backend produzione (separato da preview Emergent)
3. Setup HTTPS/SSL (Let's Encrypt)
4. Configurazione Brevo: SPF + DKIM per assistenza@registrateam.it (sender autenticato)
5. Backup automatici MongoDB
6. Error tracking (Sentry free tier)
7. Privacy Policy pubblica + Cookie banner GDPR
8. Aggiornamento flyer/manuali HTML con email reali (info@registrateam.it, assistenza@registrateam.it)
9. Stripe modalità live (post-pilota)
10. PWA installabile (Add to Home Screen)

NOTA: Dare istruzioni dettagliate e sequenziali. L'utente farà solo azioni dirette (login pannelli provider). Codice/config tecnico fatto da agente.

## Completato 23/04/2026:
- Fix calcolo "Somma supplementare" viste Admin (coach, dirigente, collaboratore)
- Fix pagina bianca admin/collaboratore e admin/dirigente
- Calcolo mese superamento soglia basato su cumulativo reale
- Testo "Con la quietanza del mese di [Mese]..." su tutte le figure
- Timestamp PDF ora italiana su tutte le figure
- Consensi Privacy collassabili per tutte le figure
- Campanella notifiche dashboard genitore
- Email invito generica "Gentile Utente"
- Dirigenti in lista "Staff in Attesa di Approvazione"
- Dashboard dirigente: solo squadre assegnate
- Fix calcolo CF per nati all'estero
- Fix salvataggio profilo dirigente/coach prima di firma privacy
- Presentazione dettagliata HTML + 7 Manuali d'uso per ruolo
- Flyer promozionale A4 con accesso gratuito fino 30/06/2027

## Completato 19/04/2026:
- Download Registro CSV funzionante
- Fix solleciti pagamento
- Fix creazione squadra (date)
- Biglietto da visita con P.IVA

- **Account istituzionali NON firmano NESSUNA dichiarazione** (P0 — 30/04/2026, refinement)
  - Regola consolidata: se il nome account contiene pattern societari (SSD/SRL/SPA/ASD/...) OPPURE l'email coincide con email/PEC istituzionale della Società → l'account NON può firmare né `legal_representative` né `authorized_delegate`
  - Guard backend globale nel `/primary-admin/declare`: entrambe le dichiarazioni ritornano 400 con messaggio chiaro
  - Frontend modal: vista dedicata "Account istituzionale" con icona 🏢 e testo che spiega: "è riservato alle comunicazioni societarie" + CTA "HO CAPITO, CHIUDI"
  - Rationale: l'email della società è solo operativa (ricevute, comunicazioni) — per operare come Responsabile Admin bisogna usare un account personale

- **Email automatiche al Legale Rappresentante** (P1 — 30/04/2026)
  - Nuovo helper `_notify_legal_rep_scepter_event()` in `routes/primary_admin.py` (usa `email_service.send_transactional_email` con Brevo)
  - Eventi che triggerano email al LR:
    - 🔄 **Delega** effettuata dal LR ad un Dirigente
    - ↩️ **Rimessa incarico** da parte del Dirigente autorizzato
    - 🚫 **Revoca delega** dal LR (auto-conferma della propria azione)
    - 👑 **Incoronazione** di un nuovo LR (benvenuto)
    - ✍️ **Firma dichiarazione LR** (welcome con istruzioni)
  - Email HTML responsive con marchio Società, mittente, timestamp UTC, IP
  - Best-effort: errori silenti (l'email non blocca l'azione)

- **Guard Email Istituzionale su dichiarazione LR** (P0 — 30/04/2026)
  - Oltre al rilevamento del nome società, ora si confronta anche l'email del profilo utente con l'email (o PEC) registrata nel profilo Società
  - Se l'email utente coincide con `settings.email` o `settings.pec` → blocco dichiarazione LR (errore 400) + opzione disabilitata nel modal frontend
  - Campo `account_looks_like_society` in `/primary-admin/status` ora è OR logico: nome-società OR email-istituzionale
  - Messaggio frontend aggiornato: "Non disponibile: questo account è riservato alla società (nome o email istituzionale/PEC)"
  - Nessun nuovo campo nel profilo Società (l'email sociale era già presente in Impostazioni → Dati Società)

- **Popup dichiarazione per TUTTI gli admin finché manca il Legale Rappresentante** (P0 — 30/04/2026, finale)
  - Nuovo campo risposta status: `should_show_declaration_popup` — true se nessun LR nel sistema + utente corrente non ha ancora firmato
  - Endpoint `POST /primary-admin/declare` ora accessibile a QUALSIASI admin (non solo primary):
    - `legal_representative`: valido solo se nessun altro LR esiste. Demote automatica di eventuale orphan primary. Chi firma diventa primary + LR.
    - `authorized_delegate`: salva solo la dichiarazione. Diventa primary SOLO se non esiste già un altro primary (bootstrap case: primo admin orfano)
  - Frontend: `PrimaryAdminDeclarationModal` ora mostra il popup a tutti gli admin senza dichiarazione finché non c'è LR. Una volta che qualcuno firma come LR, il popup sparisce per tutti i nuovi admin.
  - I popup secondari (override atleta / override globale) restano soppressi finché il popup dichiarazione è attivo (UX single-action)
  - Pulsante 👑 INCORONA resta come **backup** nello stato orfano (casi edge in cui un admin promosso non ha mai fatto login per firmare)
  - E2E test backend: bootstrap primo admin → popup visto → firma delegate → orfano; secondo admin senza LR → popup visto → firma LR → diventa primary + LR, primo admin resta orfano normale.

- **Incoronazione Legale Rappresentante** (P0 — 30/04/2026)
  - Caso reale: il dirigente tecnico scarica l'app → dichiara "Sono un incaricato" → stato orfano (nessun Legale Rappresentante). Invita il presidente a registrarsi come admin. Dalla pagina "Responsabile Admin" vede lista "Incorona" con pulsante 👑 accanto a ogni admin.
  - Nuovo endpoint `POST /api/admin/primary-admin/crown` — solo orphan authorized_delegate primary può incoronare
  - Dopo incoronazione: Legale Rappresentante = nuovo primary + legal_rep. Incaricato resta admin normale con declaration `authorized_delegate` (può ricevere delega dal Legale Rappresentante)
  - Reset automatico flag `override_keep_disabled` (il nuovo scettro deve ri-decidere)
  - Audit log: `primary_admin_crowned` (👑 nello storico)
  - E2E test: stato orfano → crown → nuovo Legale Rappresentante ✓. Smoke 17/17.

- **Gerarchia Responsabile Admin con Delega/Rimessa/Revoca** (P0 — 30/04/2026, sessione finale)
  - **Legale Rappresentante**: unica identità persistente (non si "perde" con la delega). Può: delegare ad un Admin di fiducia, revocare la delega in corso.
  - **Dirigente autorizzato** (delegate): NON può delegare ulteriormente (errore 403). Può SOLO rimettere l'incarico al Legale Rappresentante.
  - Quando il Legale Rappresentante delega → target diventa automaticamente `authorized_delegate` + `is_primary_admin=True`. Legale Rappresentante mantiene `primary_admin_declaration='legal_representative'` come "identità" anche senza scettro.
  - **Rimessa incarico**: il delegato restituisce lo scettro al Legale Rappresentante. Endpoint `POST /api/admin/primary-admin/resign`.
  - **Revoca delega**: il Legale Rappresentante (non più primary dopo la delega) riprende lo scettro. Endpoint `POST /api/admin/primary-admin/revoke`.
  - Blocco "Non puoi esistere 2 Legali Rappresentanti": il declare di tipo `legal_representative` è bloccato se un altro admin già lo detiene.
  - Delega reset automatico del flag `override_keep_disabled` sul blocco certificati (il nuovo holder deve ri-decidere).
  - UI aggiornata: 4 card contestuali (Delega/Rimetti/Revoca/Orfano) mostrate solo se il backend conferma il permesso (`can_delegate`, `can_resign`, `can_revoke`, `orphan_delegate`).
  - Storico: `primary_admin_declaration_signed`, `primary_admin_delegated`, `primary_admin_resigned`, `primary_admin_delegation_revoked` — tutti tracciati con user, IP, timestamp e dettagli.
  - E2E test backend: Vincenzo come delegate → **403 delega bloccata**, resign → scettro a pallavolo (legal_rep). Smoke test **17/17 passing**.

- **Pagina UI "Responsabile Admin"** in Impostazioni (30/04/2026)
  - Card "scettro" con avatar del detentore attuale (nome + email + badge "Sei tu")
  - Stato dichiarazione (verde/arancione) con tipo e data di firma
  - Sezione **Delega** (solo per il Responsabile): lista altri Admin + pulsante "DELEGA" + modale di conferma con warning
  - **Storico cronologico** completo di firme e deleghe con user, timestamp, IP
  - Nuovo endpoint: `GET /api/admin/primary-admin/history`
  - Card in dashboard impostazioni con icona shield blu

- **Responsabile Admin con dichiarazione obbligatoria** (P0 — 30/04/2026)
  - Concetto introdotto: "Responsabile Admin" = primo admin registrato (trasferibile via delega)
  - Modale bloccante al primo accesso: il Responsabile DEVE dichiarare se è il **Legale Rappresentante** o un **Dirigente autorizzato**
  - Solo il Responsabile con dichiarazione firmata può attivare il flag "Mantieni disattivato oltre la mezzanotte"
  - Checkbox disabilitata con icona 🔒 e info-box per Admin non-Responsabile
  - Endpoint: `GET /api/admin/primary-admin/status`, `POST /declare`, `POST /delegate`
  - Audit log: dichiarazione + delega tracciati con user, IP, timestamp
  - Delega: invalida la dichiarazione (il nuovo Responsabile deve rifirmare)
  - Guard backend 403 sul PATCH `/settings/society` con `override_keep_disabled=true` se non-Responsabile o senza dichiarazione
  - Nuovo router `routes/primary_admin.py` + componente `PrimaryAdminDeclarationModal.tsx`

## Completato 30/04/2026:
- **Override certificato athlete-specific via POPUP real-time Admin** (P0)
  - QR scan con cert. scaduto/non autenticato/mancante: Coach blocca e invia notifica all'Admin
  - **Popup modale + ping sonoro** su qualsiasi schermata admin (polling 10s)
  - Nome atleta evidenziato, squadra, coach, motivo blocco + banner "UN solo ingresso, riservato a [Nome Atleta]"
  - Pulsanti: **NEGA INGRESSO** / **ATTIVA OVERRIDE** (motivo obbligatorio ≥5 caratteri) + "Decido più tardi"
  - Override single-use, no time limit (consumato al primo ingresso valido)
  - Fix critico: override bypassa TUTTI i motivi di blocco (scaduto/non autenticato/mancante), non solo expired
  - Coach popup post-override: "Accesso consentito SOLO per questa volta in attesa del nuovo certificato"
  - Endpoint: `POST /api/admin/notifications/{id}/authorize-override`, `/deny-override`

- **Switch Override Globale certificati con auto-reattivazione mezzanotte + promemoria Admin** (P0)
  - Default: **ATTIVO** (blocco sempre sull'atleta)
  - Disattivazione richiede: motivo obbligatorio (≥5 caratteri) + checkbox esplicito "Mantieni disattivato oltre la mezzanotte"
  - Senza flag keep_disabled: **auto-riattivazione alle 00:00 ora italiana** via scheduler (check ogni 10 min)
  - Con flag keep_disabled: resta off a tempo indeterminato
  - **Popup "Promemoria Sicurezza"** al primo login Admin del giorno (ping sonoro + stato + "HO CAPITO"/"RIATTIVA ORA")
  - **Banner arancione permanente** sulla dashboard finché override è ON (link rapido a impostazioni)
  - Audit log completo su disable/enable/auto-reactivate (user, IP, motivo, flag, timestamp)
  - Endpoint: `GET/POST /api/settings/certificate-override-status[/mark-seen]`
  - Nuovi componenti: `CertificateOverridePopup.tsx`, `GlobalOverrideStatusPopup.tsx`
  - +3 smoke tests (totale 17/17)

## IN SOSPESO (prossima sessione):
- Privacy Livia: cancellare e rifirmare, verificare dati nel PDF
- Mese soglia: il banner mostra mese sbagliato, investigare build
- Banner previsione €15k dove manca

## Task Futuri:
- (P0) Deploy Produzione (MongoDB Atlas, Render/Railway, Vercel, DNS Aruba, HTTPS Let's Encrypt)
- (P1) GDPR/Legal pubblico per Pilot (Privacy Policy, Cookie banner, Termini di servizio)
- (P1) Re-importazione Excel calendario per aggiornamento date partite
- (P1) UI per atleti con contratti formali
- (P2) Refactoring server.py monolitico (37/N endpoint estratti, ~23.6k linee residue)
- (P2) Re-implementazione Stripe (Live mode)
- (P2) Pubblicazione dominio/App Store
- (P3) Upload screenshot per genitori che richiedono rimozione foto
