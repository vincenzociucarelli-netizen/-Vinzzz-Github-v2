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
