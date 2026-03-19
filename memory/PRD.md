# RegistraTEAM - Product Requirements Document

## Problem Statement
Sports team management application for Pallavolo Perugia SSD. Manages athletes, parents, coaches, dirigenti, payments, documents, trial periods, medical certificates, compensation, and more.

## Core Features Implemented
- User authentication and role-based access (admin, parent, coach, dirigente, collaboratore)
- Athlete management with parent linking
- Team management with training schedules
- Payment tracking and installment plans
- QR code attendance system
- Medical certificate management with auto-block toggle
- Dynamic trial period system (admin-configurable days/sessions)
- Trial PDF document generation (dynamic, professional)
- Compensation management for coaches/dirigenti/collaboratori
- GDPR privacy document signing
- Parent/Coach dashboards with notifications
- Profile completeness validation before document generation

## Latest Changes (March 2026)
- Moved "Certificato Medico" toggle from "Altre Impostazioni" to "Periodo di Prova" settings page
- Renamed page to "Certificato Medico e Periodo di Prova" with descriptive subtitles
- Implemented mandatory profile completeness check before document generation:
  - Parent required fields: full_name, fiscal_code, phone
  - Athlete required fields: full_name, date_of_birth, fiscal_code, place_of_birth
  - Backend validation blocks document generation with 400 error and detailed message
  - Frontend shows "Anagrafica incompleta" banner with missing fields and quick-links to complete profiles
  - New API endpoint: GET /api/athletes/{athlete_id}/profile-check
- Fixed NoneType error in validation functions for null field values

## Architecture
- Frontend: React Native Web (Expo) on port 3000
- Backend: FastAPI (Python) on port 8001
- Database: MongoDB
- All routes prefixed with /api

## Prioritized Backlog
### P0 (Critical)
- User-guided testing of trial period lifecycle
- Digital signature flow for trial declaration (capture signature, embed metadata)

### P1 (Important)
- Automatic parent cross-linking when second_parent_email matches existing user

### P2 (Nice to have)
- Refine UI for contracted athletes
- Clarify user deletion logic

### P3 (Future)
- Refactor server.py into modular structure
- Re-implement Stripe for payments
- Database cleanup: migrate "viewer" role to "dirigente"
- App Store / domain publication
- Centralize compensation calculation logic (currently duplicated in 6 files)
