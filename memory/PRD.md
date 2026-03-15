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
7. Separate "Password Dati" for each parent of minor athletes - IN PROGRESS (frontend form done, needs full lifecycle test)
8. Consistent profile layout between adult and minor athletes - DONE

## What's Been Implemented (Latest Session - March 2026)
- **P0: Minor Athlete Profile Restructure** - Reordered components in `parent/athlete/[id].tsx` to match adult profile: Account > QR > Dati Anagrafici (collapsible) > Dati Fiscali Genitore (collapsible) > Coach > Status > Certificate > Schedule > Payments
- **P1: Legal Pages Back Button Fix** - Enlarged back button with "Indietro" label, added BackHandler for hardware back press, increased touch target to 44px minimum
- **P0: Password Dati in Parent Registration** - Added Password Dati + Confirm Password Dati fields to register.tsx for parent role, with validation and API integration
- **Enhancement: Onboarding Tutorial per tutti i ruoli** - Tutorial 3 step per ogni ruolo (Genitore, Atleta 18+, Coach, Collaboratore, Dirigente) con contenuti personalizzati. Si mostra le prime 3 volte con "Non mostrare più". Componente riutilizzabile `OnboardingTutorial`.

## Prioritized Backlog

### P0 (Critical)
- User-guided testing: full lifecycle for Minors, Teams, Excel Templates
- Complete Password Dati lifecycle: prompt to create after admin reset

### P1 (Important)
- Simplified "Invite Person" modal (admin: Name, Surname, Email only)
- "Data Processor" checkbox in admin creation form (GDPR)

### P2 (Nice to have)
- User Deletion Flow: clarify business logic
- UI improvements for contracted athletes (atleta a contratto)

### P3 (Future)
- Backend refactoring: decompose server.py into modular routes
- Stripe integration for payments
- Database cleanup: migrate "viewer" role to "dirigente"
- Domain & App Store publication assistance

## Test Credentials
- Admin: pallavoloperugia@gmail.com / password
- Parent: testparent@test.com / Test1234!
- Adult Athlete: luna@18piu.com / Luna2024!
- Minor Athlete ID (linked to test parent): 69b5e0beefab8e9f13304720

## Key Files
- backend/server.py
- frontend/app/admin/athletes.tsx
- frontend/app/parent/athlete/[id].tsx (restructured)
- frontend/app/athlete/profile.tsx (reference template)
- frontend/app/privacy-policy.tsx (back button fixed)
- frontend/app/terms-of-use.tsx (back button fixed)
- frontend/app/register.tsx (Password Dati added)
- frontend/src/components/OnboardingTutorial.tsx (NEW - generic, all roles)
- frontend/app/parent/index.tsx (tutorial integrated)
- frontend/app/athlete/index.tsx (tutorial integrated)
- frontend/app/coach/index.tsx (tutorial integrated)
- frontend/app/dirigente/index.tsx (tutorial integrated)
- frontend/app/collaboratore/profile.tsx (tutorial integrated)
