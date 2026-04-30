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

## Completato 30/04/2026:
- **Override certificato athlete-specific via POPUP real-time Admin** (P0)
  - QR scan con cert. scaduto: Coach blocca l'ingresso e invia notifica all'Admin
  - **Popup modale** su qualsiasi schermata admin (polling 10s): appare automaticamente quando il Coach scansiona un atleta con certificato scaduto
  - Mostra: nome atleta, squadra, coach, motivo blocco + banner "valido solo per UN ingresso, riservato a [Nome Atleta]"
  - Pulsanti: **NEGA INGRESSO** (rosso) / **ATTIVA OVERRIDE** (verde, abilitato con motivo ≥5 caratteri)
  - Link "Decido più tardi" per posticipare senza chiudere la richiesta
  - Override **single-use, athlete-specific, no time limit** (consumato al primo ingresso valido)
  - Endpoint: `POST /api/admin/notifications/{id}/authorize-override`, `POST /api/admin/notifications/{id}/deny-override`
  - Audit log completo (user, IP, timestamp, source=admin_notification)
  - Coach popup post-override: "Accesso consentito SOLO per questa volta in attesa del nuovo certificato" (no IN PROVA)
  - Notifiche anche fruibili su `/admin/notifications` con pulsanti inline (flusso asincrono)
  - Rimossa modale override sul Coach (l'override passa SEMPRE dall'Admin)
  - Nuovo componente `CertificateOverridePopup.tsx` montato in `app/admin/_layout.tsx`
  - +3 smoke regression tests (totale 17/17 passing)

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
