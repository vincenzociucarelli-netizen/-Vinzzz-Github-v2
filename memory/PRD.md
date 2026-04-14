# RegistraTEAM - Product Requirements Document

## Problema Originale
Applicazione completa per la gestione di società sportive di pallavolo italiane (RegistraTEAM). Focus su conformità GDPR, flussi di onboarding specifici per ruolo, workflow di collegamento genitori-atleti con approvazione manuale, generazione dinamica di documenti legali (PDF) e sincronizzazione automatica del calendario/partite con il sito regionale FIPAV.

## Architettura
- **Frontend**: React/Expo (build statiche web `npx expo export -p web` + `serve -s dist -l 3000`)
- **Backend**: FastAPI (server.py monolitico >24k righe)
- **Database**: MongoDB
- **Integrazioni**: Brevo (email transazionali), ReportLab (PDF), BeautifulSoup (scraping FIPAV)

## Ruoli Utente
- Admin, Coach, Dirigente, Collaboratore, Atleta (18+/18-), Genitore

## Completato 14/04/2026:
- Unificata sezione "Dati Anagrafici + Fiscali" per Atleta 18+ e Atleta 18- (vista genitore)
- Fix `country_of_birth` accettato come alternativa a `place_of_birth` nel check profilo completo
- Fix cancellazione automatica dati GDPR per atleta 18+ in prova (`withdraw-trial-leave`): bug `_id` vs `id`
- Cancellazione completa dati per atleta 18-/genitore (`request-data-deletion`): aggiunta cancellazione documenti firmati + utente
- Nuovo endpoint `/staff/leave-society` per Coach/Dirigente/Collaboratore: auto-delete senza obblighi fiscali, richiesta admin con obblighi
- Pre-iscrizione: data nascita con calendar picker, logica condizionale (ha giocato/no), filtri statistiche cliccabili, popup dettaglio con sport praticato
- Ordinamento documenti dal più recente per dirigente, collaboratore, admin dirigente, admin collaboratore
- Fix "Elimina" quietanza personalizzata (window.confirm per web)
- Nascosta sezione "Consensi Privacy" se privacy non firmata (dirigente, collaboratore)

## File Bloccati (verificati dall'utente)
Vedi `/app/memory/LOCKED_FILES.md`

## Da Verificare/Completare
- **Dirigenti**: profilo, compensi, vista admin — da verificare e bloccare
- **Collaboratori**: profilo, compensi, vista admin — da verificare e bloccare
- **Atleti 18-**: profilo (vista genitore) — da verificare e bloccare
- **Genitori**: flusso completo — da verificare e bloccare

## Task Futuri
- (P1) Re-importazione file Excel calendario per aggiornamento date partite
- (P1) UI per atleti con contratti formali
- (P2) Refactoring server.py monolitico in routers/models separati
- (P2) Re-implementazione Stripe per pagamenti
- (P2) Assistenza pubblicazione dominio e App Store
- (P3) Upload screenshot per richiesta rimozione foto

## Note Tecniche Critiche
- **EXPO TUNNEL NON FUNZIONA**: Usare sempre build statiche (`npx expo export -p web`)
- **Chrome Android PDF**: Usare pdf.js per rendering
- **LINGUA**: Rispondi sempre in Italiano
- **LOCKED FILES**: Controllare `/app/memory/LOCKED_FILES.md` prima di modificare qualsiasi file
