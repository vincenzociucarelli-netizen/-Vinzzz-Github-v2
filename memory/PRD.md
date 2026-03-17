# RegistraTEAM - Product Requirements Document

## Problem Statement
Sports team management application for Italian sports societies, targeting iOS App Store and Google Play Store publication. Features role-based access (admin, coach, parent, athlete), athlete registration, legal compliance (GDPR), payment management, and team scheduling.

## Architecture
- **Frontend**: React Native Web (Expo Router) on port 3000
- **Backend**: FastAPI + MongoDB on port 8001
- **Database**: MongoDB (test_database)
- **Email**: Brevo (Sendinblue) for transactional emails
- **External**: python-codicefiscale for Italian fiscal codes

## Core Requirements
1. Society admin accepts Terms of Use before use - DONE
2. All users accept legal disclaimer (Privacy + Terms) on first login - DONE
3. Dedicated Privacy Policy and Terms of Use pages - DONE
4. Public self-registration for athletes/parents with email verification - DONE
5. Share Registration Link feature for admin invitations - DONE
6. Minor athlete forms with Codice Fiscale + second parent email - DONE
7. Separate "Password Dati" for each parent of minor athletes - DONE
8. Consistent profile layout between adult and minor athletes - DONE
9. Foreign birth support (country of birth + fiscal code calculation) - DONE
10. Onboarding tutorials per role - DONE
11. Direct password reset by admin (without email) - DONE
12. Invite-register allows already registered emails - DONE
13. Second parent linking (manual, per-child) - DONE
14. Payment section reordered (summary first, details last) - DONE
15. Gender field in edit form for minor athletes - DONE
16. Auto-format date of birth (dd/mm/yyyy) in invite-register - DONE
17. Unified email field in invite-register (email = username) - DONE
18. GDPR Privacy flow for minors (signature pad) - DONE
19. Payment certificate overhaul - DONE
20. Sequential receipt numbering per season - DONE
21. Prima Nota Cassa CSV export - DONE
22. Season start/end date config - DONE
23. Admin reset password for parents - DONE
24. Certificate date form for parents (no file upload) - DONE
25. Certificate color coding (green/orange/red) - DONE

## Session 5 Completions (March 17, 2026)
- Riorganizzazione pagina "Dati Società": Certificato Medico in cima, Logo in fondo
- Fix Prima Nota Cassa CSV: ordine colonne corretto, rimosso Codice Fiscale, fix Squadra vuota
- Fix "Not authenticated" apertura PDF documenti firmati GDPR (parent/documents.tsx)
- Cross-linking figli Pessi + second_parent_id in API /api/athletes
- Reset Password per genitori dal pannello admin
- Fix documenti firmati visibili a entrambi i genitori (query minor_id per children)
- Fix accesso PDF documenti per genitori non firmatari (is_parent_of_minor check)
- Auto-mark notifiche come lette all'apertura pagina admin
- Certificato Medico: form date (emissione + mesi validità + scadenza auto-calcolata)
- Certificato Medico: colori scadenza (verde/arancio 30gg/rosso)
- Banner viola "Inserisci dati certificato" SOLO se no certificato
- Fix critico: fallback in GET /certificates/{athlete_id} per atleti con dati solo nel doc atleta

## Session 4 Completions (March 16, 2026)
- Account card email shows only athlete's email
- Removed "Email 2° Genitore" from read-only view
- GDPR Data Processor checkbox in admin terms
- Attestato di Versamento: multiple text/layout changes
- Privacy Minorenne GDPR: full GDPRPrivacyModal with signature

## Session 3 Completions (March 15-16, 2026)
- Direct Password Reset, unblock invite-register for existing emails
- Calcola CF, Country Picker, Gender selector
- Second parent linking, auto-format dates, unified email

## Previous Session Completions
- Legal pages, Terms of Use, Privacy Policy
- Self-registration with email verification
- Onboarding Tutorial per role, Password Dati
- Foreign birth + CF, Email 2° Genitore, Copy link fix

## Prioritized Backlog

### P0 (Critical - Prossimi task)
- **Lite Dashboard per Atleti Minori**: Accesso telefono + PIN, dashboard solo lettura (dati organizzativi, QR, calendario, statistiche), QR con dati non personali, disattivazione da genitore
- **Test guidati**: ciclo completo Minori, Squadre, Template Excel

### P1 (Da testare / Verificare)
- Certificato medico: verificare che admin veda tutti i certificati (fix fallback applicato)
- Verifica cross-linking genitori (Sauro/Mara vedono entrambi i figli)
- Reset password genitori dall'admin
- Notifiche admin auto-read
- Form date certificato per genitore (auto-format, scadenza calcolata)

### P2 (Nice to have)
- User Deletion Flow: chiarire logica business
- UI improvements per atleti a contratto
- Ambiguous User Deletion Logic (ricorrente, 6 volte)

### P3 (Futuro)
- Backend refactoring: decomposizione server.py
- Stripe integration per pagamenti
- Database cleanup: migrare ruolo "viewer" → "dirigente"
- Domain e pubblicazione App Store / Play Store

### Bug noti non critici
- TypeError: can't compare offset-naive and offset-aware datetimes (in get_team_attendance_stats, riga ~8298 server.py)

## Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent (Sauro): sauro@test.com / Test1234
- Parent (Mara): mara2@test.com / Test1234
- Adult Athlete (Luna): luna@18piu.com / Test1234

## Key Files
- backend/server.py
- frontend/app/parent/athlete/[id].tsx - Minor athlete profile (parent view)
- frontend/app/admin/athlete/[id].tsx - Athlete profile (admin view)
- frontend/app/athlete/index.tsx - Athlete own profile
- frontend/app/admin/parents.tsx - Parents management (admin)
- frontend/app/admin/settings/society.tsx - Society settings
- frontend/app/admin/settings/export-data.tsx - CSV exports
- frontend/app/parent/documents.tsx - Parent documents view
- frontend/app/admin/notifications.tsx - Admin notifications

## Data Model Notes
- Athletes: `second_parent_email`, `second_parent_id` for cross-linking
- Certificates: collection `certificates` + fallback to athlete fields `medical_certificate_expiry/date`
- Teams: custom `id` field ≠ `_id` (importante per lookup!)
- Payments: `receipt_number` (per season), `registration_date`
