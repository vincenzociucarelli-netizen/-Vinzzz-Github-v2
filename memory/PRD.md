# RegistraTeam - Product Requirements Document

## Original Problem Statement
Sistema di gestione completo per società sportive italiane (pallavolo, basket) che include:
- Gestione atleti (minori e adulti)
- Gestione allenatori con compensi e quietanze
- Gestione dirigenti con compensi
- Modulo Prime Squadre per atleti professionisti
- Importazione partite da federazioni (FIPAV, FIP)
- Sistema di pagamento quote e fatturazione

## Implemented Features (Session 2026-02-20)

### Core Modules
1. **User Authentication** - Login/Registration per admin, coach, parent, athlete
2. **Team Management** - CRUD squadre con prima squadra, rifinitura, sessioni allenamento
3. **Athlete Management** - Registrazione minori/adulti, tipi quota/retribuito
4. **Coach Compensation** - Gestione compensi, firma digitale quietanze, PDF
5. **Director (Dirigente) Compensation** - Replicato da coach module
6. **Prime Squadre Module** - Per atleti professionisti con soglie fiscali
7. **Federation Importer** - FIPAV (volleyball) e FIP (basketball)
8. **Monthly Reports** - PDF consolidato quietanze firmate

### Athlete Compensation Module ✅
- Backend: create-account, receipts, receipt-sign, transform-photo
- Frontend: /athlete dashboard, /athlete/compensation, /athlete/profile
- Permessi: Admin solo lettura, Atleta può firmare

### Club Sport Image Upload ✅
- Nuovo campo `sport_image` in society settings
- UI in admin settings per upload/rimozione immagine
- API: GET/PATCH /settings/society con sport_image

## Bug Fixes (Session 2026-02-20)
1. ✅ **Formato date**: "01T00:00:00/12/2025" → "01/12/2025"
2. ✅ **Upload foto atleta**: Atleta può caricare propria foto
3. ✅ **Permessi admin quietanze**: Admin solo visualizzazione
4. ✅ **Login genitori**: Verificato funzionante
5. ✅ **Rate pagate in rosso**: Fix logica merge pagamenti

## Test Credentials
- **Admin**: test.admin@test.com / Test1234
- **Athlete**: test.athlete@trial.com / Athlete123
- **Parent**: test.parent@test.com / Parent123
- **Parent 2**: lidia@test.com / Test1234

## Pending Issues (Backlog)
1. **P3**: @expo/vector-icons rendering on web

## Upcoming Features
1. **P3**: Season renewal workflow
2. **P3**: Refactor server.py into modular routes
3. **P3**: Stripe integration for premium plans

## Last Updated
2026-02-20: Completed all planned features for this session
