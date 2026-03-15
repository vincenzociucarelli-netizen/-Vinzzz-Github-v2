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
12. Payment dashboard buttons per child for parent - DONE
13. Payment section reordered (summary first, details last) - DONE

## What's Been Implemented (Latest Session - March 15, 2026)
- **Password Reset Luna Nuova** - Reset to Test1234 for both luna@18piu.com and luna2@test.com
- **Direct Password Reset (Admin)** - New "Reimposta Password Manualmente" button in admin athlete profile with modal, backend endpoint updated to accept `new_password` param
- **Unblocked invite-register for existing emails** - Removed the block in `/athletes/invite-register` endpoint; existing users are now linked automatically
- **Minor Athlete Profile - Calcola CF + Country Picker** - Added calculator button and Picker-based country selector (matching admin profile) in parent/athlete/[id].tsx
- **Payment Section Reordered** - New order: Quota Annuale → Highlighted rata → Pagamenti Effettuati (collapsible) → Residuo Dovuto → Modalita Pagamento → Dettaglio Rate with colored status icons
- **Payment Buttons on Parent Dashboard** - Orange "Pagamenti NOME_FIGLIO" card per child, navigates to athlete profile with scroll to payments section

## Previous Session Completions
- P0: Minor Athlete Profile Restructure
- P1: Legal Pages Back Button Fix
- P0: Password Dati in Parent Registration
- Enhancement: Onboarding Tutorial per tutti i ruoli
- Stato di Nascita + Campi Nascita + CF calculation for foreign birth
- Email 2 Genitore field
- Fix Modale "Invita Persona"
- Copy link fix (expo-clipboard)
- Data integrity fix (Lucia Pessi association)

## Prioritized Backlog

### P0 (Critical)
- User-guided testing: full lifecycle for Minors, Teams, Excel Templates
- Complete Password Dati lifecycle testing

### P1 (Important)
- "Data Processor" checkbox in admin creation form (GDPR)

### P2 (Nice to have)
- User Deletion Flow: clarify business logic (recurring issue)
- UI improvements for contracted athletes (atleta a contratto)

### P3 (Future)
- Backend refactoring: decompose server.py into modular routes
- Stripe integration for payments
- Database cleanup: migrate "viewer" role to "dirigente"
- Domain and App Store publication assistance

## Credentials
- Admin: pallavoloperugia@gmail.com / password
- Test Parent: sauro@test.com / password
- Test Adult Athlete: luna@18piu.com / Test1234 (also luna2@test.com / Test1234)

## Key Files
- backend/server.py (17k+ lines)
- frontend/app/parent/athlete/[id].tsx - Minor athlete profile (parent view)
- frontend/app/admin/athlete/[id].tsx - Athlete profile (admin view)
- frontend/app/parent/index.tsx - Parent dashboard
- frontend/app/admin/athletes.tsx - Athletes list + invite modal
- frontend/app/register.tsx - Registration form
- frontend/src/components/OnboardingTutorial.tsx - Reusable tutorial
- frontend/src/constants/countries.ts - Country list for birth place
