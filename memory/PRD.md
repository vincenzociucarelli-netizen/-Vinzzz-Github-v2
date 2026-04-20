# RegistraTEAM - Product Requirements Document

## Problema Originale
Applicazione completa per la gestione di societa sportive dilettantistiche italiane. Focus su GDPR, ruoli, collegamento genitori-atleti, documenti PDF dinamici e sincronizzazione calendario gare federali.

## Architettura
- **Frontend**: React/Expo (build statiche web)
- **Backend**: FastAPI (server.py monolitico >24k righe)
- **Database**: MongoDB
- **Integrazioni**: Brevo (email), ReportLab (PDF), BeautifulSoup (scraping federazioni)

## Completato 19/04/2026:
- Presentazione dettagliata HTML (4 pagine) con logo e brand RegistraTEAM
- 7 Manuali d'uso per ruolo: Admin, Coach, Dirigente, Collaboratore, Genitore, Atleta 18-, Atleta 18+
- Flyer promozionale A4 con loghi, multi-sport, CTA con info@registrateam.it e accesso gratuito fino 30/06/2027
- Campanella notifiche nella dashboard genitore (solleciti pagamento, avvisi)
- Endpoint notifiche utente: GET/PATCH /user/notifications
- Fix solleciti: atleti che hanno pagato >= quota non compaiono, supporto atleti adulti senza genitore
- Fix paid:None vs paid:False nell'invio notifiche + DuplicateKey secondo genitore
- Download Registro CSV (sostituisce Excel che crashava su Expo web)
- Fix creazione squadra: parsing date YY-MM-DD, validazione GG/MM/AAAA
- Biglietto da visita: aggiunto P.IVA, telefono spostato a destra, design professionale

## Completato 17/04/2026:
- Biglietto da visita JPG ridisegnato
- Campo Partita IVA aggiunto

## File Bloccati
Vedi `/app/memory/LOCKED_FILES.md`

## Da Verificare/Completare
- Dirigenti e Collaboratori: test flussi completi
- Override certificati: toggle mobile web non funziona

## Task Futuri
- (P1) Re-importazione Excel calendario per aggiornamento date partite
- (P1) UI per atleti con contratti formali
- (P2) Refactoring server.py monolitico
- (P2) Re-implementazione Stripe
- (P2) Pubblicazione dominio/App Store
- (P3) Upload screenshot per rimozione foto
