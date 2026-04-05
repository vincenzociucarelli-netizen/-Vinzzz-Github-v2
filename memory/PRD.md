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
1. Fix "Collega un atleta": error handling robusto, controllo society_id, ricerca parziale
2. Codice Invito Società - Step obbligatorio con validazione (`POST /auth/validate-invite-code`)
3. Migrazione email ROSI Giulio: giulia@test.com → giulio@test.com
4. Admin può modificare profili utenti via PATCH /users/{id}
5. Avatar Accesso Lite: emoji carine per minori
6. Dimensione icone laterali: 64x64px
7. Rimosso consenso "immagini interne" per genitori (invite-register + parent/index)
8. Checkbox "immagini promozionali" in arancio
9. Step "Figlio già registrato?" nel flusso registrazione genitore
10. Step "Figlio già registrato?" anche su invite-register
11. Fix URL backend in build statica

### Sessione 05/04/2026
12. Build frontend per rendere visibili: icona occhio password, submit bloccato senza apertura documenti privacy nella registrazione via invito
13. Uniformato flusso registrazione su tutti i canali: aggiunta lettura `?code=` da URL in `register.tsx`, auto-validazione codice invito dal link condiviso dall'admin
14. Fix bug "Collega" 400 Bad Request: se atleta senza parent_id, assegnazione diretta. Errori inline su mobile. Redirect automatico al profilo dopo collegamento
15. Fix layout ricerca figlio su mobile: campi Cognome/Nome in colonna, bottone Collega non sovrapposto. Applicato a register.tsx, invite-register.tsx E link-athlete.tsx
16. Fix backend parent-link/request: se atleta senza parent_id, assegnazione diretta come genitore principale senza approvazione
17. Fix errore `[object Object]` in invite-register: aggiunto `full_name` al payload + error handling robusto per errori Pydantic (array)
18. Login automatico se email già registrata nel flusso invite-register (fallback da 422 → login)
19. FLUSSO REGISTRAZIONE UNIFICATO: invite-register.tsx ora è un redirect a register.tsx?code=XXX. Un solo flusso per tutti i canali (email, WhatsApp, login). Privacy+Consensi integrati nel form (Fig. 3). Codice invito precaricato da URL.

## Backlog Prioritizzato

### P0 (Critici)
- Attendere feedback test utente sulle modifiche

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
