# RegistraTEAM - Product Requirements Document

## Problema Originale
Applicazione completa per la gestione di società sportive di pallavolo italiane (RegistraTEAM). Focus su conformità GDPR, flussi di onboarding specifici per ruolo, workflow di collegamento genitori-atleti con approvazione manuale, generazione dinamica di documenti legali (PDF) e sincronizzazione automatica del calendario/partite con il sito regionale FIPAV.

## Architettura
- **Frontend**: React/Expo (build statiche web `npx expo export -p web` + `serve -s dist -l 3000`)
- **Backend**: FastAPI (server.py monolitico >24k righe)
- **Database**: MongoDB
- **Integrazioni**: Brevo (email transazionali), ReportLab (PDF), BeautifulSoup (scraping FIPAV)

## File Bloccati
Vedi `/app/memory/LOCKED_FILES.md`

## Completato 17/04/2026:
- Ridisegnato biglietto da visita JPG della società: design professionale con logo, ragione sociale, indirizzo+CAP+città, telefono, C.F., P.IVA, federazione e codice federale
- Aggiunto campo Partita IVA al modello dati della società (backend + frontend)
- Affiliazioni sportive incluse nel testo condivisione WhatsApp/Email

## Completato 16/04/2026:
- Fix status atleta dopo firma privacy: da "trial" a "pending_certificate" automaticamente
- Badge "Validazione Certificato" in lista atleti admin e vista genitore (sostituisce raw "pending_certificate")
- Blocco scansione QR per certificato non autenticato (rispetta override admin)
- Fix fuso orario presenze: usa ora italiana (CET+2) invece di UTC
- Notifiche registrazione per TUTTI i ruoli (genitori, atleti, staff)
- Pagina dedicata "Iscrizioni Atleti" con raggruppamento per data, pulsante espandi/chiudi tutti
- Campo Sesso aggiunto al form admin atleta per calcolo CF
- Pulsante "Calcola CF" fixato per web (div HTML nativo)

## Da Verificare/Completare
- **Dirigenti**: profilo, compensi, vista admin
- **Collaboratori**: profilo, compensi, vista admin
- **Squadre**: gestione squadre
- **Override certificati con popup 15 min/definitivo**: non funziona il click su mobile, da riprovare

## Task Futuri
- (P1) Re-importazione file Excel calendario per aggiornamento date partite
- (P1) UI per atleti con contratti formali
- (P2) Refactoring server.py monolitico (>24k righe)
- (P2) Re-implementazione Stripe
- (P2) Pubblicazione dominio e App Store
- (P3) Upload screenshot per rimozione foto

## Note Tecniche
- **EXPO TUNNEL NON FUNZIONA**: build statiche obbligatorie
- **Chrome Android PDF**: pdf.js per rendering
- **LINGUA**: Italiano
- **LOCKED FILES**: Controllare prima di modificare
- **FUSO ORARIO**: Presenze usano ora italiana (UTC+2)
