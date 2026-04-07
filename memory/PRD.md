# RegistraTEAM - Product Requirements Document

## Problem Statement
Comprehensive sports team management application for Italian volleyball societies with strict GDPR compliance, role-specific onboarding flows, manual parent-athlete linking workflows, dynamic legal document generation (PDFs), and automated calendar/match syncing with the official FIPAV regional website.

## Core Features

### Authentication & Registration
- Multi-role registration (Admin, Parent, Coach, Collaborator, Dirigente, Athlete)
- Unified registration flow via register.tsx
- Society invite code required for all roles
- Email invites with token-based auto-fill

### GDPR & Privacy
- Dynamic multi-page PDF generation for adults vs minors
- Live preview of GDPR documents with current consent data
- Explicit consent checkmarks ([X] ACCONSENTO / [ ] NON ACCONSENTO)
- Image usage consent (promotional only for parents, internal+promotional for minors)
- "Riprese di contesto" clause in privacy text
- Image removal request button for parents

### Parent-Athlete Management
- Multi-parent linking with approval workflow
- Data protection password system with shared fallback
- Profile completeness validation before GDPR signing

### Calendar & Matches
- FIPAV web scraper for automatic match synchronization
- Persistent FIPAV preferences (federation, region, season)
- Tab filters (upcoming, played, all)
- UTC timezone handling for match times

### Payments & Receipts
- Fiscal receipt (Attestato di Versamento) generation
- Foreign-born athlete support: shows "Stato di nascita" instead of "Comune di nascita"
- Season-based receipt numbering (RIC-24/25-0001)

### Excel Export
- Athlete data export includes "Stato Nascita" column

## Completed Features (Latest)
- [2026-04-07] Fix Ricevuta Fiscale lato Atleta: il backend ora restituisce il nome breve della società ("Pallavolo Perugia SSD a RL") invece della ragione sociale completa nell'endpoint `/payments/{id}/fiscal-receipt`.
- [2026-04-07] Allineamento tracciabilità consensi atleta adulto: formato strutturato {value, timestamp, user_id, document_version} con storico (insert, non update). Migrati dati Eva/Lena. Fix logica update per atleti adulti (chiave diretta, non per-genitore).
- [2026-04-07] Rimosso campo "Codice Fiscale" dalla registrazione atleta maggiorenne (verrà compilato nel profilo). Fix visualizzazione consensi per atleti adulti (gestione formato booleano legacy).
- [2026-04-07] Fix bug 403 profilo atleta adulto: gli atleti adulti (ruolo "athlete") ora possono accedere ai propri consensi senza essere reindirizzati al login. Corretta anche gestione dei consensi salvati come booleani (vs dict).
- [2026-04-06] Trial Period flow per atleti 18+, consensi immagini interni+promo per tutti i ruoli adulti, fix doc PDF on-the-fly, fix registrazione atleta adulto.
- [2026-04-05] Foreign-born athlete logic: Receipt shows "Stato di nascita" for non-Italian athletes, hides "Comune di nascita" and province. Backend API returns country_of_birth. Validation skips birth_place for foreign athletes. GDPR PDFs fall back to country_of_birth when birth_place is empty.

## Tech Stack
- Frontend: React Native / Expo (web static builds)
- Backend: FastAPI (Python)
- Database: MongoDB
- PDF: ReportLab
- Email: Brevo
- Scraping: BeautifulSoup

## Architecture
- Frontend served as static build: `npx expo export -p web` + `serve -s dist -l 3000`
- Backend: Monolithic server.py (>23k lines - needs refactoring)
- MongoDB collections: users, athletes, teams, payments, settings, matches, etc.

## Upcoming Tasks (Priority Order)
1. (P1) Re-import Excel calendar for match date updates (differential update)
2. (P1) UI for athletes with formal contracts
3. (P2) Refactoring server.py into separate routers/models
4. (P2) Stripe payment re-implementation
5. (P2) Domain/App Store publishing assistance
6. (P3) Screenshot upload for photo removal requests
