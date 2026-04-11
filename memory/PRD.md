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
- Sistema di registrazione unificato con flussi role-specific
- Generazione PDF GDPR dinamica multi-pagina (adulti vs minori)
- Sistema di consensi granulari (privacy obbligatoria + immagini facoltative)
- Workflow di approvazione multi-genitore
- Dashboard Admin con Staff in attesa (approvazione rapida)
- Scraper FIPAV per calendario partite
- Compensi e quietanze per staff
- Preview PDF con pdf.js viewer e pulsante chiusura (X)

## Stato Attuale (11/04/2026)

### Completato in questa sessione:
- Fix BUG CRITICO: checkbox "Utilizzo immagini per uso interno" era visibile SOLO per i minori, ora appare per tutti (coach, dirigenti, collaboratori, atleti 18+, e minori tramite genitori)
- Fix documenti duplicati: rimosso "documento virtuale" ridondante quando esiste il documento GDPR reale firmato
- Fix apertura documenti: IDs virtuali (`consent_*`) ora trovano il documento GDPR reale
- PDF Preview con pdf.js: rendering pagine come canvas con pulsante X di chiusura in alto a destra (funziona su Chrome Android)
- Rimosso wrapper HTML con iframe (non funzionava su Chrome Android)

### In Attesa di Test (utente testerà domani):
- Verifica checkbox immagini per Dirigenti
- Verifica checkbox immagini per Collaboratori  
- Verifica checkbox immagini per Atleti 18+
- Verifica checkbox immagini per Atleti 18- (firmati dai genitori)

## Task Futuri
- (P1) Re-importazione file Excel calendario per aggiornamento date partite
- (P1) UI per atleti con contratti formali
- (P2) Refactoring server.py monolitico in routers/models separati
- (P2) Re-implementazione Stripe per pagamenti
- (P2) Assistenza pubblicazione dominio e App Store
- (P3) Upload screenshot per richiesta rimozione foto

## Note Tecniche Critiche
- **EXPO TUNNEL NON FUNZIONA**: Usare sempre build statiche (`npx expo export -p web`)
- **Chrome Android PDF**: Non supporta iframe/blob/data URL per PDF. Usare pdf.js per rendering
- **LINGUA**: Rispondi sempre in Italiano
