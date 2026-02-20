# RegistraTeam - Product Requirements Document

## Original Problem Statement
Sistema di gestione completo per società sportive italiane (pallavolo, basket) che include:
- Gestione atleti (minori e adulti)
- Gestione allenatori con compensi e quietanze
- Gestione dirigenti con compensi
- Modulo Prime Squadre per atleti professionisti
- Importazione partite da federazioni (FIPAV, FIP)
- Sistema di pagamento quote e fatturazione

## Implemented Features

### Core Modules
1. **User Authentication** - Login/Registration per admin, coach, parent, athlete
2. **Team Management** - CRUD squadre con prima squadra, rifinitura, sessioni allenamento
3. **Athlete Management** - Registrazione minori/adulti, tipi quota/retribuito
4. **Coach Compensation** - Gestione compensi, firma digitale quietanze, PDF
5. **Director (Dirigente) Compensation** - Replicato da coach module
6. **Prime Squadre Module** - Per atleti professionisti con soglie fiscali
7. **Federation Importer** - FIPAV (volleyball) e FIP (basketball)
8. **Monthly Reports** - PDF consolidato quietanze firmate

### Athlete Compensation Module (COMPLETED)
**Status**: ✅ IMPLEMENTED AND TESTED

Funzionalità complete:
- **Backend Endpoints**:
  - `POST /athletes/{id}/create-account` - Admin crea account per atleta retribuito
  - `GET /athletes/{id}/compensation/receipts` - Visualizza quietanze (admin + atleta)
  - `POST /athletes/{id}/compensation/receipt-sign` - Firma digitale quietanza (solo atleta)
  - `POST /athletes/{id}/transform-photo` - Upload foto atleta (atleta può caricare la propria)
  - `GET /prime-squadre/athletes/{id}/threshold-status/{year}` - Stato soglie fiscali

- **Frontend Pages**:
  - `/athlete` - Dashboard atleta con compensi annuali, griglia mesi
  - `/athlete/compensation` - Firma quietanze con signature pad
  - `/athlete/profile` - Dati personali atleta

- **Permessi**:
  - Admin: SOLO lettura quietanze, NON può firmare
  - Atleta: può firmare le proprie quietanze, caricare foto

## Bug Fixes (Session 2026-02-20)
1. ✅ **Formato date**: Corretto "01T00:00:00/12/2025" → "01/12/2025"
2. ✅ **Upload foto atleta**: Atleta può ora caricare la propria foto senza essere disconnesso
3. ✅ **Permessi admin quietanze**: Admin ora può solo visualizzare, non firmare

## Database Schema

### Collections
- `users`: role includes "athlete" with athlete_id field
- `athletes`: athlete_type can be "quota" or "compensated"
- `athlete_compensation_receipts`: store signed receipts with signature

## Test Credentials
- **Admin**: test.admin@test.com / Test1234
- **Test Athlete**: test.athlete@trial.com / Athlete123 (athlete_id: 6998cf2dd6878c84c10b35f5)

## Pending Issues (Backlog)
1. **P1**: Parent login not working (recurring issue)
2. **P2**: Paid installments appear as overdue on parent dashboard
3. **P3**: @expo/vector-icons rendering on web

## Upcoming Features
1. **P2**: Club sport image upload
2. **P3**: Season renewal workflow
3. **P3**: Refactor server.py into modular routes
4. **P3**: Stripe integration for premium plans

## Last Updated
2026-02-20: Fixed athlete photo upload, date format, admin read-only receipts
