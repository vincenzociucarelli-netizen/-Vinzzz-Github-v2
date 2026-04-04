# RegistraTEAM - PRD (Product Requirements Document)

## Problema Originale
App per la gestione di società sportive italiane di pallavolo (RegistraTEAM). Focus su: conformità GDPR, flussi di onboarding per ruolo, collegamento manuale genitori-atleti con approvazione, generazione PDF documenti legali, sincronizzazione calendario gare FIPAV.

## Architettura
- **Frontend**: React/Expo (static web build via `npx expo export -p web` + `serve -s dist -l 3000`)
- **Backend**: FastAPI (Python) su porta 8001
- **Database**: MongoDB (via `MONGO_URL` e `DB_NAME` da .env)
- **Email**: Brevo (transactional)
- **PDF**: ReportLab
- **Scraping**: BeautifulSoup (FIPAV)

## IMPORTANTE: Build Frontend
Qualsiasi modifica frontend richiede:
```bash
export EXPO_PUBLIC_BACKEND_URL="https://registrateam-vol.preview.emergentagent.com"
rm -rf dist .expo
npx expo export -p web --clear
```

## Funzionalità Completate

### Sessioni Precedenti
- Dashboard admin con gestione atleti, genitori, coach, dirigenti, collaboratori
- Generazione PDF GDPR (adulti vs minori)
- Sistema multi-parent con approvazione (Collega un atleta)
- Sincronizzazione calendario FIPAV con scraper + UI
- Filtri Tab calendario (Da disputare, Giocate, Tutte)
- Persistenza preferenze FIPAV nel DB
- Fix timezone partite (forzato UTC nel frontend)
- Solo "Codice Fiscale" (rimosso P.IVA)
- Fix password secondo genitore
- Clausola "Riprese di contesto" in informativa GDPR
- Codice Invito obbligatorio per tutti i ruoli
- Tasto "Richiesta rimozione foto" nel profilo genitore

### Sessione 04/04/2026
1. **Fix "Collega un atleta"**:
   - Backend: error handling robusto, accesso sicuro campi, controllo society_id, ricerca parziale
   - Frontend: layout input width 48% per mobile
2. **Codice Invito Società - Step obbligatorio con validazione**:
   - Nuovo endpoint `POST /auth/validate-invite-code`
   - Step dedicato nel flusso registrazione (role → welcome → **invite** → form)
   - Validazione backend PRIMA di mostrare il form
   - Rimosso fallback 404 che saltava la validazione
3. **Migrazione email ROSI Giulio**: giulia@test.com → giulio@test.com
4. **Admin può modificare profili utenti**: society_id, nome, cognome, email, telefono via PATCH /users/{id}
5. **Avatar Accesso Lite**: Sostituiti sport icons con emoji carine (farfalla, unicorno, gattina, ecc.)
6. **Dimensione icone laterali**: Uniformate a 64x64px
7. **Rimosso consenso "immagini interne" per genitori** da:
   - invite-register.tsx (checkbox + payload)
   - parent/index.tsx (checkbox + PDF + consent_data)
8. **Checkbox "immagini promozionali" in arancio** (bordo 2px, sfondo giallo, testo bold)
9. **Step "Figlio già registrato?" nel flusso registrazione genitore**:
   - Dopo registrazione parent: scelta SI/NO
   - SI → ricerca figlio inline + richiesta collegamento
   - NO → vai a registra atleta
   - "Lo farò più tardi" → dashboard
10. **Step "Figlio già registrato?" anche su invite-register**:
    - Per atleti minori: scelta SI/NO prima del form
    - SI → form solo dati genitore + Privacy + ricerca figlio
    - NO → form completo come prima
11. **Fix URL backend in build statica**: Pulita cache Expo, rimosso URL vecchio (italian-sports-qa)

## Backlog Prioritizzato

### P0 (Critici)
- Attendere feedback test utente sulle modifiche della sessione corrente

### P1 (Alta priorità)
- Re-importazione file Excel calendario (aggiornamento differenziale)
- UI per atleti con contratti formali (post-lancio)

### P2 (Media priorità)
- **Refactoring server.py** (>23.000 righe → routers/models separati) - DEBITO TECNICO CRITICO
- Re-implementazione Stripe per pagamenti
- Assistenza pubblicazione dominio e App Store

### P3 (Bassa priorità)
- Upload screenshot nella richiesta rimozione foto

## Credenziali Test
Vedi `/app/memory/test_credentials.md`

## Note Tecniche Critiche
- **Date/Timezone**: Match FIPAV salvati come "locali" ma taggati UTC. Frontend usa `timeZone: 'UTC'` per visualizzare
- **GDPR**: Genitori hanno solo checkbox "immagini promozionali" (no "interne"). Minori hanno entrambi
- **Password fallback**: Backend controlla `second_parent_data_password_hash` E `data_password_hash`
- **Expo Tunnel**: NON funziona. OBBLIGATORIO usare build statica
- **Build URL**: Esportare SEMPRE `EXPO_PUBLIC_BACKEND_URL` prima della build
