# Sports Club Management - PRD

## Problema Originale
Piattaforma di gestione per club sportivi con gestione di atleti, coach, collaboratori, dirigenti, compensi sportivi e conformità normativa (soglie €5k/€15k).

## Architettura
- **Frontend**: React Native/Expo Web
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Email**: Brevo/SendGrid

## Ruoli Utente
- Admin (gestione completa)
- Dirigente (viewer + dirigente role)
- Coach
- Collaboratore
- Genitore
- Atleta

---

## SESSIONE 06/03/2026 - Completato

### Fix Critici Implementati

#### 1. Ruolo Dirigente nel Sistema ✅
- Aggiunto `UserRole.DIRIGENTE` alla classe UserRole
- Aggiornato endpoint `/api/users/dirigenti` per includere admin, viewer E dirigente
- Corretto routing login per ruolo "dirigente"
- Aggiornato `_layout.tsx` per autorizzare ruolo "dirigente"

#### 2. Test Soglia €5000 con Metadati PDF ✅
- Verificato funzionamento completo del flusso
- PDF generato con metadati di verifica (timestamp, totali, hash firma)
- Reset corretto al cambio anno solare
- Badge ">5K" visibile sulle quietanze post-soglia

#### 3. Fix Dati Bancari - Perdita Dati ✅
- Sezione "Dati Bancari" nascosta durante modifica anagrafica
- Applicato a: Dirigente, Coach, Collaboratore

#### 4. PDF Viewer con Pulsante CHIUDI ✅
- Modificato `GDPRPrivacyModal.tsx` per aprire PDF in modal invece di nuova tab
- Aggiunto pulsante "CHIUDI" ben visibile

#### 5. Documenti Cliccabili ✅
- Aggiunto `pdf_filename` ai documenti GDPR nel backend
- Aggiornati 7 documenti esistenti nel database

#### 6. Ragione Sociale nei Documenti ✅
- Tutti i documenti ufficiali usano `ragione_sociale` invece di `name`
- Priorità: ragione_sociale (settings) → ragione_sociale (societies) → name (fallback)
- Aggiornata collection `societies` con ragione_sociale

#### 7. Timestamp Notifiche ✅
- Corretto `clean_mongo_doc()` per includere data E ora
- Formato: `2026-03-06T15:58:44+00:00` (ISO con timezone)
- Le notifiche ora mostrano l'ora corretta

---

## DA VERIFICARE (Prossima Sessione)

### P0 - Verifiche Post-Privacy
1. **Atleti 18+** - Verificare flusso privacy e documenti
2. **Coach** - Verificare flusso privacy, compensi, documenti
3. **Collaboratori** - Verificare flusso privacy, compensi, documenti

### P1 - Minorenni
- Flusso completo privacy minori
- Firma genitore/tutore
- Documenti generati

### P2 - Issue Pending
- Admin dashboard intermittent loading failure (retry implementato, non testato)
- Global check per `@expo/vector-icons` direct imports

---

## BACKLOG

### Futuri
- Re-implementazione Stripe per pagamenti club
- Refactoring `server.py` in struttura modulare (routes, models, services)

---

## Credenziali Test
- **Admin**: `pallavoloperugia@gmail.com` / `password`
- **Dirigente Test**: `ivo@test.com` (creato dall'utente)
- **Coach**: `milano.lino@email.it` / `password`

## File Chiave Modificati (06/03/2026)
- `/app/backend/server.py` - Ruoli, ragione_sociale, timestamp, PDF metadata
- `/app/frontend/app/login.tsx` - Routing dirigente
- `/app/frontend/app/dirigente/_layout.tsx` - Auth dirigente
- `/app/frontend/app/dirigente/profile.tsx` - Dati bancari fix
- `/app/frontend/app/coach/profile.tsx` - Dati bancari fix
- `/app/frontend/app/collaboratore/profile.tsx` - Dati bancari fix
- `/app/frontend/src/components/GDPRPrivacyModal.tsx` - PDF viewer modal

## Integrazioni 3rd Party
- Brevo/Sendinblue (email)
- reportlab (PDF generation)
- react-signature-canvas
- python-codicefiscale
