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

## Funzionalità Implementate

### Completato 13/04/2026:
- **Fix bug "Elimina" quietanza personalizzata**: Usava `Alert.alert` che non funziona su web, ora usa `window.confirm`
- **Spostato badge "Accettato dal coach"**: Ora subito sotto il compenso mensile concordato
- **Indicatore accettazione quietanze**: "In attesa di firma" (arancione) / "Firmata dal coach" (verde)
- **Rinominato "Somme suppl." in "Somma supplementare [mese]"**: Con indicazione del mese specifico (es. "Apr '26")
- **Colori soglie uniformati ovunque**: 5k=arancione, 15k=viola — fix seconda sezione calcolo admin/coach
- **Nascosta sezione "Consensi Privacy"** se privacy non firmata (dirigente, coach, collaboratore)
- **Fix errore GitHub SECRETS_DETECTED**: Rimossi file test/cache dal tracking git
- **File LOCKED_FILES.md creato**: Per proteggere file completati da modifiche involontarie

### Completato 12/04/2026:
- Fix checkbox consensi immagini (critico): ora visibile per tutte le figure
- Rimossa privacy dalla registrazione
- Unificata sezione profilo "Dati Anagrafici + Fiscali"
- Admin vede stesse info compensi del coach
- Colori unificati soglie
- Fix nome "undefined" nella card Staff in Attesa

### Completato 11/04/2026:
- PDF Preview con pdf.js viewer e pulsante X di chiusura
- Fix caching PDF Chrome Android

## File Bloccati (verificati dall'utente)
Vedi `/app/memory/LOCKED_FILES.md`

## In Attesa di Test
- Atleti 18+ e 18- (utente verificherà prossimamente)

## Task Futuri
- (P1) Re-importazione file Excel calendario per aggiornamento date partite
- (P1) UI per atleti con contratti formali
- (P2) Refactoring server.py monolitico in routers/models separati
- (P2) Re-implementazione Stripe per pagamenti
- (P2) Assistenza pubblicazione dominio e App Store
- (P3) Upload screenshot per richiesta rimozione foto

## Note Tecniche Critiche
- **EXPO TUNNEL NON FUNZIONA**: Usare sempre build statiche (`npx expo export -p web`)
- **Chrome Android PDF**: Usare pdf.js per rendering (non iframe/blob/data URL)
- **LINGUA**: Rispondi sempre in Italiano
- **LOCKED FILES**: Controllare `/app/memory/LOCKED_FILES.md` prima di modificare qualsiasi file
