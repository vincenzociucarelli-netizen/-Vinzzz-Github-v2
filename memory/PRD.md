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

### Completato 12/04/2026:
- **Fix checkbox consensi immagini**: "Utilizzo immagini per uso interno" ora visibile per tutte le figure (coach, dirigenti, collaboratori, atleti 18+, minori tramite genitori) — era visibile solo per i minori
- **Fix documenti duplicati**: Rimosso documento virtuale ridondante quando esiste il GDPR reale firmato
- **Fix apertura documenti**: IDs virtuali (`consent_*`) ora trovano il documento GDPR reale + generazione PDF on-the-fly per utenti registrati col vecchio sistema
- **Rimosso "Termini di Utilizzo"** dalla lista documenti (non è un PDF scaricabile)
- **Rimossa privacy dalla registrazione**: Le liberatorie non vengono più chieste all'iscrizione — troppo invasivo e mancano i dati anagrafici. La privacy GDPR viene richiesta dopo aver completato il profilo
- **Unificata sezione profilo**: "Dati Anagrafici" e "Dati Fiscali" ora in un'unica card per Coach, Dirigente, Collaboratore
- **Fix Staff in Attesa**: Nome utente ora mostrato correttamente (`full_name` al posto di `last_name`/`first_name` undefined)
- **Admin vede stesse info compensi del coach**: Alert SUPERAMENTO €5k e €15k entrambi visibili, "Pregressi" nel secondo anno, banner "Prossima soglia" e "Dichiarazione richiesta"
- **Colori unificati soglie compensi**: €5.000 = arancione, €15.000 = viola — applicato a tutte le viste (admin + profili propri) per Coach, Dirigente, Collaboratore

### Completato 11/04/2026:
- PDF Preview con pdf.js viewer e pulsante X di chiusura (funziona su Chrome Android)
- Fix caching PDF Chrome Android (endpoint HTTP dedicato)

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
