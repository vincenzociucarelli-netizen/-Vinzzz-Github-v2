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
- **Digital signature flow for trial declaration** (signature pad + embedded in PDF + metadata)
- **Email with signed PDF** sent automatically to the signing parent
- **Document archive** for parents, grouped by child, accessible by both parents
- Compensation management for coaches/dirigenti/collaboratori
- GDPR privacy document signing
- Parent/Coach dashboards with notifications
- Profile completeness validation before document generation
- Society info cards as JPG images (fiscal + bank)

## Latest Changes (March 20, 2026)
- Implemented digital signature flow for trial declaration:
  - New POST /api/athletes/{id}/sign-trial-document endpoint with Request for metadata
  - Signature pad modal in frontend (SignaturePadInline component)
  - Signature image embedded in PDF document
  - Metadata box "METADATI DI VERIFICA" in uniform style with other documents
  - GET trial-document endpoint does NOT mark document as signed (preview only)
  - trial_document_generated field added to Athlete model and TypeScript interface
- **Bug fix**: Document now uses signing user's data (current_user), not parent_id
- **Feature**: Signed trial documents saved to signed_documents collection for archive
- **Feature**: Email with signed PDF sent to signing parent via Brevo
- **Fix**: Document download on Chrome Android (blob URL → direct download)
- Society cards converted from PDF to JPG (Pillow-based image generation)
- Frontend card download handlers updated for image/jpeg content type
- Updated trial status text per user's exact wording

## Architecture
- Frontend: React Native Web (Expo) on port 3000
- Backend: FastAPI (Python) on port 8001
- Database: MongoDB
- All routes prefixed with /api

## Prioritized Backlog
### P0 (Critical)
- Test inizio periodo di prova (QR scan by coach triggers trial start)

### P1 (Important)  
- Automatic parent cross-linking when second_parent_email matches existing user

### P2 (Nice to have)
- Refine UI for contracted athletes
- Clarify user deletion logic (recurring issue x11)

### P3 (Future)
- Refactor server.py into modular structure
- Re-implement Stripe for payments
- Database cleanup: migrate "viewer" role to "dirigente"
- App Store / domain publication
- Centralize compensation calculation logic (currently duplicated in 6 files)
