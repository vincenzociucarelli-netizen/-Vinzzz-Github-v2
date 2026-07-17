# RegistraTEAM — PRD

## Original Problem Statement
Sports team management app per società di pallavolo italiane. GDPR-compliant, multi-tenant, con onboarding role-specific, gestione soglie Riforma Sport (5k/15k EUR), dual-role Zaino Coach/Genitore, sistema pagamenti Stripe multi-tenant.

## Personas
- **Admin/Dirigente**: Gestisce società, atleti, staff, pagamenti, GDPR.
- **Coordinatore**: Gestisce eventi/organizzativi con permessi specifici.
- **Coach/Collaboratore**: Vede solo il proprio zaino (compensi, allenamenti, atleti).
- **Genitore**: Iscrive figli, paga rate, firma GDPR, accede dati sensibili.
- **Atleta 18+ / Minore**: Login "lite" via nome+PIN o email+password.

## Core Requirements
- GDPR PDF dinamici (firma primaria/secondaria).
- Multi-tenancy: TUTTE le query filtrano `society_id`.
- Riforma Sport thresholds cumulativi 5k/15k EUR (dual-role coach+atleta compensato).
- Season rollover senza data loss (attivo `active_seasons`).
- Persistent `athlete_code` legato a CF.
- Pre-registrazione con approval admin.
- Stripe multi-tenant (webhook per società).
- Dual-role UI: Admin ↔ Coordinatore ↔ Dirigente ↔ Genitore.

## Implemented (last session)
- Fix filtri stagione per staff/atleti (`active_seasons`).
- Layout compatto "Eventi in programma".
- Badge "COORDINATORE" nell'header.
- Bidirectional role switch admin/coord/dirig.
- Stripe Checkout multi-tenant + webhook `/api/webhooks/stripe/{society_id}`.
- Dual-role Staff ↔ Genitore (endpoint + UI).
- Self-service change email (`/admin/settings/change-email`).
- Fix Coordinatore 403 su Eventi Preseason.
- Fix header icons su mobile.
- Security refactor "Sono io il genitore" (CF/created_by → approval request in caso di conflitto).

## Implemented (this session, Feb 2026)
- 🆕 **Verifica email match** in "Sono io il genitore" (`link-me-as-parent` accetta anche match su `second_parent_email`, `parent_email`, `mother_email`, `father_email`).
- 🆕 **Endpoint admin override** `POST /api/athletes/{id}/admin-link-parent` — admin può collegare qualsiasi utente esistente come genitore (bypassa verifica anti-frode).
- 🆕 **Pulsante "Collega manualmente un genitore"** nella scheda atleta admin (visibile quando "Nessun genitore collegato").
- 🆕 **Zaino Genitore per Staff** — nuova sezione `/staff/link-or-register-child` con 2 flussi:
  - A) Ho un figlio già iscritto → riusa `/parent/link-athlete` (endpoint `/parent-link/search` + `/parent-link/request` ora aperti a tutti gli staff)
  - B) Iscrivi un figlio nuovo → wizard completo `/staff/register-child` che crea l'atleta e lo linka come parent_id = current user
- 🆕 **CTA "Sei anche genitore?"** su dashboard dirigente + icona header admin (visibile quando `linkedAthletesCount === 0`).
- 🆕 **Nuovo endpoint** `POST /api/athletes/register-my-child` — staff self-service child registration.
- 🆕 **Scontrino stile Nexi** — nuovo endpoint `GET /api/payments/{id}/receipt` che genera HTML della ricevuta stile Nexi con logo società, transazione autorizzata, codice AUT, card mascherata (last4 recuperato da Stripe se disponibile).
- 🆕 Bottone **"Scarica scontrino"** su `/parent/payment/success` dopo pagamento riuscito.

## Prioritized Backlog

### 🔴 P0 (blockers/business-critical)
- Guidare l'utente al consolidamento email su Sirio (Produzione) usando i tool già costruiti: cambia email admin + Sono io il genitore.

### 🟠 P1 (rilevanti)
- Notifica email al genitore primario quando richiesta 2° genitore approvata.
- Pulsante "Scarica scontrino" anche sulla scheda atleta genitore (per pagamenti Stripe passati).

### 🟡 P2 (utility)
- Pagina Sponsor (`/admin/sponsor`): loghi vettoriali, contratti, scadenze pagamento, promemoria email, storico.
- Estendere card "I miei figli" anche a `coach` e `collaboratore` (attualmente solo dirigente/admin).

### 🟢 P3 (nice-to-have)
- Panel Admin "Igiene Dati": read-only lista atleti/utenti con anomalie (CF mancante, orfani, duplicati).
- Rimborso Stripe da admin (button "Rimborsa" nel pannello pagamenti).
- Storico pagamenti Stripe con filtri (data/stato/atleta) + export CSV.
- Ottimizzazioni RAM Render (blocked in attesa credits).

## Architecture
```
/app
├── backend/
│   ├── server.py                     # ~35k lines, refactoring pendente
│   ├── routes/
│   │   ├── stripe_payments.py        # Checkout + webhook + scontrino Nexi
│   │   ├── parents.py                # Parent link requests (aperto a staff)
│   │   ├── coordinator.py
│   ├── tests/                        # pytest regression
├── frontend/app/
│   ├── staff/                        # 🆕 Zaino Genitore per staff
│   │   ├── _layout.tsx
│   │   ├── link-or-register-child.tsx
│   │   └── register-child.tsx
│   ├── admin/settings/change-email.tsx
│   ├── admin/athlete/[id].tsx        # pulsante "Collega manualmente"
│   ├── parent/payment/success.tsx    # bottone Scarica scontrino
```

## Key API endpoints
- `POST /api/athletes/{id}/link-me-as-parent` (v3 — email match)
- `POST /api/athletes/{id}/admin-link-parent` (admin override) 🆕
- `POST /api/athletes/register-my-child` (staff self-service) 🆕
- `POST /api/parent-link/search` (aperto staff+parent) 🆕
- `POST /api/parent-link/request` (aperto staff+parent) 🆕
- `GET /api/payments/{id}/receipt` (HTML Nexi-style) 🆕
- `POST /api/payments/{id}/checkout`
- `POST /api/webhooks/stripe/{society_id}`

## 3rd party
- Brevo (email)
- Stripe (BYOK multi-tenant, keys per società in `db.settings`)

## Testing status
- Feature testate manualmente via curl + smoke screenshot.
- Lint OK.
- No regressioni note.
