# RegistraTeam - Product Requirements Document

## Original Problem Statement
Sistema di gestione completo per società sportive italiane (pallavolo, basket) che include:
- Gestione atleti (minori e adulti)
- Gestione allenatori con compensi e quietanze
- Gestione dirigenti con compensi
- Modulo Prime Squadre per atleti professionisti
- Importazione partite da federazioni (FIPAV, FIP)
- Sistema di pagamento quote e fatturazione

## Implemented Features (Session 2026-02-20 - 2026-02-21)

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
- **NEW**: Calcoli annuali dettagliati con soglie €5K e €15K

### Club Sport Image Upload ✅
- Nuovo campo `sport_image` in society settings
- UI in admin settings per upload/rimozione immagine
- API: GET/PATCH /settings/society con sport_image

### UI/UX Improvements (Session 2026-02-21) ✅
1. **Badge PRO**: Atleti retribuiti mostrano badge "PRO" dorato invece di '€'
2. **Formato Date Italiano**: Tutti i campi data mostrano formato `GG/MM/AAAA`
3. **Form Semplificato**: Registrazione atleta adulto con solo 3 campi (Nome, Cognome, Email)

## Bug Fixes
### Session 2026-02-20
1. ✅ **Formato date**: "01T00:00:00/12/2025" → "01/12/2025"
2. ✅ **Upload foto atleta**: Atleta può caricare propria foto
3. ✅ **Permessi admin quietanze**: Admin solo visualizzazione
4. ✅ **Login genitori**: Verificato funzionante
5. ✅ **Rate pagate in rosso**: Fix logica merge pagamenti

### Session 2026-02-21
6. ✅ **getContractMonths()**: Convertire date da formato italiano prima di creare Date objects
7. ✅ **isEditing→editing**: Corretto nome variabile nelle condizioni di rendering
8. ✅ **Backend team null check**: Evitato errore 500 quando team non assegnato
9. ✅ **Athlete model Optional fields**: date_of_birth, is_minor, team_id ora opzionali

## Test Credentials
- **Admin**: test.admin@test.com / Test1234
- **Athlete (PRO)**: atleta.prova@test.com / TestAthlete123
- **Parent**: lidia@test.com / Test1234

## Test Reports
- `/app/test_reports/iteration_11.json` - Test badge PRO, formato date, form semplificato (100% PASS)

## Pending Issues (Backlog)
1. **P3**: @expo/vector-icons rendering on web (workaround con emoji in place)

## Upcoming Features
1. **P2**: Season renewal workflow
2. **P3**: Refactor server.py into modular routes (/routes, /models)
3. **P3**: Consolidare codice duplicato coach/atleta
4. **P3**: Stripe integration for premium plans

## Architecture
```
/app
├── backend/
│   ├── server.py         # Monolithic FastAPI server
│   ├── email_service.py  # SendGrid/Brevo integration
│   └── federation_scraper.py  # FIPAV/FIP importer
└── frontend/
    └── app/
        ├── admin/        # Admin dashboard
        ├── athlete/      # Athlete dashboard (PRO)
        ├── coach/        # Coach dashboard
        ├── dirigente/    # Director dashboard
        └── parent/       # Parent dashboard
```

## Last Updated
2026-02-21: Completate 3 modifiche UI/UX (badge PRO, formato date, form semplificato) con 4 bug fix correlati
