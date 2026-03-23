# PRD - Sport Society Management App (RegistraTEAM)

## Original Problem Statement
Build a comprehensive sports team management application with:
- Pre-Season Registration (campaigns, public form, admin dashboard)
- End of Trial Period Flow (Confirm/Waive paths)
- Conditional Data Deletion (admin-approved, obligation checks)
- Notification System (email reminders, certificate expiry)
- Audit Logging
- "Versione Lite" (Minor's simplified view)
- "Cronologia Atleta" (Athlete Timeline)
- Versione Lite for Adults

## User Personas
- **Admin**: Society administrators managing athletes, parents, coaches
- **Parent**: Parents managing minor athletes
- **Athlete (18+)**: Adult athletes managing their own profiles
- **Minor (Lite)**: Simplified read-only dashboard for young athletes

## Tech Stack
- **Backend**: FastAPI + MongoDB (Motor)
- **Frontend**: React Native / Expo (Web + Mobile)
- **Email**: Brevo (Sendinblue)
- **Scheduler**: Custom asyncio background tasks

## What's Implemented (Complete)
1. Pre-Season Registration (campaigns, public form with dynamic sport name, admin dashboard, CSV export, auto-reminders)
2. End of Trial Period Flow (Confirm 3-step, Waive with deletion request)
3. Conditional Data Deletion (admin-approved, obligation checks)
4. Email Notifications (Brevo integration, certificate expiry scheduler)
5. Audit Logging (including deletion_check_viewed, deletion_request_cancelled)
6. Versione Lite - Minor's View (PIN login, avatar selection, read-only dashboard)
7. Cronologia Atleta (Timeline for Admin, Parent, Athlete views)
8. Versione Lite for Adults (self-configurable by adult athletes)
9. Automated Pre-Season Reminders (P0 - background scheduler with configurable frequency)

## Latest Changes (March 23, 2026)
- **Pre-season form**: Society logo display (with base64 handling), dynamic sport name from settings, "Hai già giocato a [sport]?" conditional question flow
- **Admin settings**: Added "Nome sport" field in "Immagine e Nome Sport" section
- **Admin timeline header**: Fixed to match standard style (chevron in white circle, inverted title/subtitle)
- **Auto-reminders**: Background scheduler runs every 12h, sends email reminders to parents who haven't responded. Admin toggle + frequency selector (3/5/7/14 days) in campaign card
- **CSV export**: Updated with new volleyball experience columns
- **Backend fixes**: Society settings query fallback for logo/name

## Prioritized Backlog
### P1
- UI per atleti con contratto (deferred to summer)

### P2
- Refactor `server.py` into modules
- Stripe integration (prepared but not activated by client)
- DB Cleanup: viewer → dirigente role migration
- Publication assistance (domain, App Store)
- Refactor `parent/athlete/[id].tsx`

## Key Credentials
- Admin: pallavoloperugia@gmail.com / Test1234
- Parent: perla@test.com / Test1234
- Adult Athlete: luna@18piu.com / Test1234
- Minor Login: MartinaG / PIN (not set)

## Key API Endpoints
- GET /api/preseason/public/{id} - Public campaign info (with sport_name, society_logo)
- POST /api/preseason/public/{id}/respond - Submit response (with volleyball experience fields)
- PATCH /api/preseason/campaigns/{id} - Update campaign (auto_reminders_enabled, reminder_frequency_days)
- GET /api/athletes/{id}/timeline - Athlete timeline
