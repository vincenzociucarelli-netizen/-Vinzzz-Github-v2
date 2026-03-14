# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Sports team management application for Italian amateur sports clubs. Must comply with Apple/iOS App Store and Google Play Store requirements, GDPR, and Italian privacy laws. Used by admins, coaches, athletes, parents, and staff.

## Core Architecture
- **Frontend**: React Native Expo (Web + Mobile)
- **Backend**: FastAPI (Python) with MongoDB
- **Email**: Brevo (Sendinblue) for transactional emails
- **CF Library**: python-codicefiscale

## Completed Features

### Legal & Compliance
- [x] Admin "Terms of Service" acceptance on first login
- [x] Universal legal acceptance screen (Apple-compliant) for all users on first login
- [x] Privacy Policy and Terms of Use dedicated pages
- [x] Legal checkbox requires opening BOTH documents before enabling (2026-03-14)

### User Registration
- [x] Admin-led email invitation for athletes
- [x] Public self-registration with email verification
- [x] Minor athlete registration (parent flow)

### Minor Athlete Form (Parent)
- [x] Sesso (M/F) gender field with toggle buttons (2026-03-14)
- [x] Codice Fiscale auto-calculation via API (2026-03-14)
- [x] Pre-fill Tel. Padre from parent's profile phone (2026-03-14)
- [x] Renamed "Fatturazione" to "Attestato di Versamento" (2026-03-14)
- [x] Password reset note (admin-only via WA/email) (2026-03-14)
- [x] Teams section removed from parent form (admin assigns) (2026-03-14)
- [x] Codice Fiscale field for minor athletes
- [x] Second parent email field

### Data Security
- [ ] Separate data passwords for each parent (IN PROGRESS)
  - [x] Backend model updated (second_parent_data_password_hash)
  - [x] Admin UI for managing parent data passwords
  - [ ] Parent registration form: data password field
  - [ ] Parent password reset flow after admin reset

### Email & Notifications
- [x] App Store/Play Store links in transactional emails
- [x] Compact notification cards UI

## In Progress (P0)
- Complete separate data passwords for parents
  - Add "Password Dati" field to parent registration form (register.tsx)
  - Frontend logic for password reset after admin reset

## Upcoming Tasks (P1)
- User-guided testing: Minors, Teams, Excel Templates
- Add "Data Processor" checkbox in admin creation form

## Future Tasks (P2-P3)
- User deletion flow (clarify business logic)
- UI for contracted athletes
- Backend refactoring (modular routes/models)
- Stripe integration
- Database cleanup (viewer → dirigente)
- Domain & App Store publication

## Key Credentials
- Admin: pallavoloperugia@gmail.com / password
- Test Parent: testparent@test.com / Test1234!
