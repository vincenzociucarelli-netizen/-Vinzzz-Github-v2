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

### Session 2026-03-28 (Fork 5 - Current)
- Bug fix telefono minori: opzionale nel flusso invite-register
- Reset password: fix URL API (cache stale), pulsante email, toggle visibilità, errori dettagliati
- Email template: logo da URL pubblica, header pulito
- GDPR invite-register: flusso completo con documenti + consensi formato corretto
- Notifiche admin: raggruppamento per data, collassabili, ricerca
- UI reset password: logo senza sfondo bianco

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
- (P0) Test manuale utente: 3 genitori + 3 figli condivisi
- (P2) Collegamento manuale genitore-atleta (ricerca per CF/nome)
- (P1) UI atleti con contratto formale (estate post-lancio)
- (P2) Refactoring server.py in router separati
- (P2) Re-implementazione Stripe
- (P2) Pubblicazione dominio e App Store

## Credentials
- Admin: `pallavoloperugia@gmail.com` / `Test1234`
- Parent (Sofia): `sofia@test.com` / `Test1234`
- Parent (Mario): `mario@test.com` / `Test1234`

## Known Issues
- Expo Tunnel instabile (workaround: build statica)
- server.py >22K righe necessita refactoring
