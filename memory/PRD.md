# RegistraTEAM - Product Requirements Document

## Original Problem Statement
App completa per la gestione di società sportive di pallavolo italiana. Focus su conformità GDPR, flussi di onboarding per genitori di minori, generazione documenti legali (PDF), e collegamento genitori-atleti in famiglie allargate.

## Core Requirements
- **GDPR Compliance**: Consensi privacy obbligatori alla registrazione con testo legale completo
- **Documenti Legali Dinamici**: PDF 2 pagine (testo legale + metadati accettazione)
- **Multi-Parent Linking**: Collegamento bidirezionale genitori-figli tramite `second_parent_email`
- **Completezza Dati**: Codice Fiscale catturato alla registrazione

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py` - monolitico >22K righe)
- **Frontend**: React/Expo (build statica via `npx expo export -p web`)
- **Database**: MongoDB (`test_database`)
- **Email**: Brevo (Sendinblue)
- **PDF**: ReportLab

## Key Files
- `frontend/app/register.tsx` - Registrazione con GDPR
- `frontend/app/invite-register.tsx` - Registrazione via invito con GDPR
- `frontend/app/reset-password.tsx` - Reset password con toggle visibilità
- `frontend/app/parent/documents.tsx` - Documenti personali
- `frontend/app/admin/notifications.tsx` - Notifiche raggruppate/collassabili
- `backend/server.py` - Monolite backend
- `backend/email_service.py` - Servizio email Brevo

## Key API Endpoints
- `GET /api/settings/society/logo.png` - Logo società come PNG (per email)
- `GET /api/documents/consent-pdf/{consent_type}` - PDF consensi personali
- `POST /api/auth/register` - Registrazione con fiscal_code e consents
- `POST /api/athletes/invite-register` - Registrazione via invito con GDPR
- `POST /api/auth/forgot-password` - Reset password
- `POST /api/auth/reset-password` - Conferma reset password

## IMPORTANT: Build Process
- Frontend: `npx expo export -p web` + `sudo supervisorctl restart expo`
- SEMPRE pulire cache: `rm -rf .metro-cache dist`
- SEMPRE settare: `EXPO_PUBLIC_BACKEND_URL=https://italian-sports-qa.preview.emergentagent.com`

## Completed Work

### Session 2026-03-29 (Fork 7 - Current)
- Fix codici atleta: ripristinati a formato alfanumerico 12 caratteri (qr_identifier) per privacy
- **NUOVO: Import pagamenti con Cognome+Nome** - eliminati i codici alfanumerici dal template
  - Template semplificato: Cognome, Nome, DataPagamento, Importo, TipoPagamento, DataRegistrazione, Causale
  - Matching automatico backend: normalizzazione nomi, gestione accenti, omonimi con squadra
  - Retrocompatibilità mantenuta per vecchi template con CodiceAtleta
- **NUOVO: Prima Nota Pagamenti** - Rinominata pagina e aggiunta struttura a 3 sezioni:
  - **Import**: Template scaricabile + importazione file Excel
  - **Registro Stagione**: Riepilogo pagamenti stagione con download Excel (Ric. Fiscale progressiva, Date, Importi)
  - **Solleciti**: Lista atleti morosi con download Excel per stampa unione + invio notifica in-app ai genitori + invio email sollecito via Brevo (toggle opzionale)
- **NUOVO: Risoluzione omonimi nell'import** - quando il matching trova più atleti con stesso Cognome+Nome, l'admin sceglie il corretto da una lista con radio button (mostra squadra per disambiguare). Nuovo endpoint POST /api/payments/import-resolve
- **Bug fix anteprima PDF privacy**: l'anteprima mostrava dati vuoti/sbagliati (stesso bug di get_current_user con campi limitati). Ora carica profilo completo da DB anche per l'anteprima
- **Bug fix notifiche admin**: le notifiche non si auto-cancellano più all'apertura della pagina. Restano non lette finché l'admin ci clicca sopra. Notifiche ora collassabili (solo titolo visibile, espandibili al click)
- Rimossa voce "Archivio Certificati Medici" dalla dashboard admin
- **NUOVO: Collegamento manuale genitore-atleta** con approvazione obbligatoria:
  - Ricerca atleta per Cognome+Nome con disambiguazione per data nascita e squadra
  - Richiesta di collegamento con notifica in-app al genitore principale
  - Accettazione/rifiuto con aggiornamento automatico di second_parent_id
  - Pagina dedicata /parent/link-athlete + pulsante "Collega un atleta esistente" nella dashboard
  - Test: 21/21 backend passed, 100% frontend UI (iteration_63.json)

### Session 2026-03-31 (Fork 9 - Current)
- **Bug fix: Banner richieste collegamento** - Sofia ora vede un banner blu nella dashboard quando ha richieste pendenti da altri genitori. Banner con data-testid='pending-link-requests-banner', mostra nome richiedente e atleta.
- **Bug fix: Anteprima PDF GDPR** - L'endpoint preview ora ignora TUTTI i dati del payload frontend (signer_name, minor_fiscal_code, minor_birth_place) e usa esclusivamente i dati dal DB. Risolto anche crash per variabile `minor_full_name` non definita.
- Test: iteration_64.json - 100% backend, 100% frontend

### Session 2026-03-28 (Fork 5-6)
- Bug fix telefono minori: opzionale nel flusso invite-register
- Reset password: fix URL API (cache stale), pulsante email, toggle visibilità, errori dettagliati
- Email template: logo da URL pubblica, header pulito
- GDPR invite-register: flusso completo con documenti + consensi formato corretto
- Notifiche admin: raggruppamento per data, collassabili, ricerca
- UI reset password: logo senza sfondo bianco
- Dashboard genitore: visibilità figli condivisi con altro genitore
- Date in formato italiano (DD/MM/YYYY) nella timeline
- FIPAV scraper: fix estrazione venue da tooltip HTML

### Session 2026-03-27 (Fork 4)
- Bug fix validazione telefono minori

### Session 2026-03-26 (Fork 3)
- Checkbox "Informativa privacy visionata" alla registrazione
- Cartella documenti personali per genitori
- Generatore PDF 2 pagine per consensi personali
- Input codice fiscale alla registrazione
- Banner completamento profilo (codice fiscale mancante)
- Campo "Email 2° Genitore" visibile nel profilo atleta

## Pending / Backlog
- (P2) Validazione telefono minori: rimuovere obbligo per atleti minorenni
- (P1) UI atleti con contratto formale (estate post-lancio)
- (P2) Refactoring server.py in router separati
- (P2) Re-implementazione Stripe
- (P2) Pubblicazione dominio e App Store

## Credentials
- Admin: `vincenzo.ciucarelli@gmail.com`
- Parent (Sofia): `sofia@test.com` / `Test1234`
- Parent (Mario): `mario@test.com` / `Test1234`

## Known Issues
- Expo Tunnel instabile (workaround: build statica)
- server.py >22K righe necessita refactoring
