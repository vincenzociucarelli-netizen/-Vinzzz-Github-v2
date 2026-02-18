# RegistraTEAM - Product Requirements Document

## Problema Originale
Applicazione per la gestione di società sportive con funzionalità per gestire atleti, coach, dirigenti, pagamenti, presenze e calendari gare.

## Ultima Sessione: 18 Febbraio 2026

### Completato Oggi:

1. **✅ Importatore Calendari FIPAV** (COMPLETO)
   - Scraping da umbria.portalefipav.net
   - Selezione campionato + società + parametro btFiltro=CERCA
   - Nome squadra modificabile nel mapping
   - Filtro per data
   - Selezione singole partite da importare
   - Supporto 17 regioni italiane
   - Files: `/app/backend/federation_scraper.py`, `/app/frontend/app/admin/import-calendar.tsx`

2. **✅ Fix bug coach → Presenze** 
   - Creata pagina `/app/frontend/app/coach/team/[id]/attendances.tsx`
   - Corretto link da `/admin/...` a `/coach/...`

3. **✅ Fix modale Trial bloccante**
   - Aggiunto pulsante X per chiudere
   - Aggiunto link "Decidi dopo"

4. **✅ Fix firma privacy per web**
   - Sostituito react-native-signature-canvas con react-signature-canvas
   - Aggiunto ScrollView al modale
   - File: `/app/frontend/src/components/SignaturePad.tsx`

5. **✅ Fix pagamenti non visibili al genitore**
   - Aggiunta sezione "Pagamenti Effettuati" anche senza paymentSettings
   - Mostrati pagamenti manuali registrati dall'admin

6. **✅ Fix label "I Miei Atleti" → "I Miei Figli"**

### Issue Aperti (da fare):
- [ ] Rate scadute pagate mostrate in rosso (A - migliorare UI)
- [ ] Bug login parent (ricorrente)
- [ ] Icone @expo/vector-icons non renderizzano sul web

### Prossimi Task:
- Modulo PRO completo (domani)
- Refactoring server.py
- Integrazione Stripe

## Credenziali Test
- Admin: `test.admin@test.com` / `Admin123!`
- Genitore Rita: `gino@test.com` / `Test1234`

## Files Principali Modificati
- `/app/backend/federation_scraper.py` - Scraper FIPAV
- `/app/backend/server.py` - Endpoints federation/*
- `/app/frontend/app/admin/import-calendar.tsx` - UI importazione
- `/app/frontend/app/coach/team/[id]/attendances.tsx` - Presenze coach
- `/app/frontend/src/components/SignaturePad.tsx` - Firma web
- `/app/frontend/app/parent/index.tsx` - Fix label + trial modal
- `/app/frontend/app/parent/athlete/[id].tsx` - Pagamenti visibili
