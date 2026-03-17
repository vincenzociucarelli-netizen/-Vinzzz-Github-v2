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

## Session 3 Completions (March 15-16, 2026)
- Password reset Luna Nuova to Test1234
- Direct Password Reset button in admin athlete profile (no email needed)
- Unblocked invite-register for existing emails
- Calcola CF button in minor athlete profile (read-only + edit form, full-width)
- Country Picker for Stato di Nascita in parent athlete edit
- Gender (M/F) selector in parent athlete edit form
- All edit fields (gender, birth_place, birth_province, country_of_birth, second_parent_email) properly saved
- Backend fix: second_parent_email savable by parent role (was admin-only)
- Removed "Scadenze in arrivo" from parent dashboard
- Removed redundant "Pagamenti" button from parent dashboard
- Email 2° Genitore in parent's own profile page with save
- Second parent linking: manual per-child (no auto-linking at registration)
- Both parents see both children when properly linked
- Auto-format date input in invite-register form
- Unified email fields in invite-register (single email = username)

## Session 5 Completions (March 17, 2026)
- Riorganizzazione pagina "Dati Società": Certificato Medico spostato in cima, Logo Società spostato in fondo
- Fix Prima Nota Cassa CSV: corretto ordine colonne (Data Registrazione, Progressivo, Data Pagamento, Atleta, Squadra, Metodo, Descrizione, Importo)
- Fix Prima Nota Cassa CSV: rimossa colonna "Codice Fiscale"
- Fix Prima Nota Cassa CSV: corretto bug "Squadra" vuota (il lookup usava _id MongoDB invece del campo custom id dei team)
- Pulizia variabili inutilizzate in other.tsx (seasonStartMonth, seasonStartDay, blockExpiredCertificates rimossi)
- Aggiornata descrizione export Prima Nota Cassa in export-data.tsx

## Session 4 Completions (March 16, 2026)
- P0: Account card email now shows only athlete's email (removed parent email fallback)
- P0: Removed "Email 2° Genitore" from read-only view of minor athlete profile (kept in edit modal only)
- P0: Confirmed "Calcola CF" button is only in edit modal (not in read-only view)
- P1: Added mandatory "Responsabile del Trattamento Dati" (GDPR Data Processor) checkbox in admin terms acceptance form
- Attestato di Versamento: "Abbiamo ricevuto da:" → "Il presente documento attesta i versamenti effettuati da:"
- Attestato di Versamento: "la somma di:" → "per la somma di:"
- Attestato di Versamento: Nota legale aggiornata con art. 148 TUIR e art. 4 DPR 633/72
- Attestato di Versamento: "TOTALE VERSATO alla data del: GG/MM/AAAA" nella riga totale
- Attestato di Versamento: Footer "Documento generato dal sistema gestionale RegistraTEAM" con data
- Attestato di Versamento: Frase per il minore con riferimento a detrazioni fiscali
- Privacy Minorenne GDPR: Sostituito modal semplice con GDPRPrivacyModal completo (testo GDPR, anteprima PDF, firma digitale, metadati)
- Privacy di Lucia resettata per consentire il test del nuovo flusso

## Previous Session Completions
- Legal pages, Terms of Use, Privacy Policy
- Self-registration with email verification
- Onboarding Tutorial per role
- Password Dati in Parent Registration
- Foreign birth + CF calculation
- Email 2° Genitore field
- Fix Invita Persona modal
- Copy link fix (expo-clipboard)
- Data integrity fix (Lucia-Sauro association)

## Prioritized Backlog

### P0 (Critical)
- User-guided testing: full lifecycle for Minors, Teams, Excel Templates

### P1 (Important)
- "Data Processor" checkbox in admin creation form (GDPR) - DONE

### P2 (Nice to have)
- User Deletion Flow: clarify business logic
- UI improvements for contracted athletes

### P3 (Future)
- Backend refactoring: decompose server.py into modular routes
- Stripe integration for payments
- Database cleanup: migrate "viewer" role to "dirigente"
- Domain and App Store publication

## Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent (Sauro): sauro@test.com / Test1234
- Parent (Mara): mara2@test.com / Test1234
- Adult Athlete (Luna): luna@18piu.com / Test1234 (also luna2@test.com)

## Key Files
- backend/server.py
- frontend/app/parent/athlete/[id].tsx - Minor athlete profile (parent view)
- frontend/app/admin/athlete/[id].tsx - Athlete profile (admin view)
- frontend/app/parent/index.tsx - Parent dashboard
- frontend/app/parent/profile.tsx - Parent's own profile
- frontend/app/admin/athletes.tsx - Athletes list + invite modal
- frontend/app/invite-register.tsx - Invite registration form
- frontend/src/components/OnboardingTutorial.tsx
- frontend/src/constants/countries.ts

## Data Model: Second Parent Linking
- Each athlete has `second_parent_email` and `second_parent_id`
- Linking is MANUAL: parent must enter the 2nd parent's email in each child's profile
- Backend auto-resolves email→user_id when saving
- `/athletes/my` returns athletes where user is `parent_id` OR `second_parent_id`
- No automatic linking at registration (ex-spouse scenario)
