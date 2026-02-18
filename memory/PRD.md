# RegistraTEAM - Product Requirements Document

## Descrizione Prodotto
Applicazione per la gestione di club di pallavolo con funzionalità di gestione atleti, coach, compensi e documenti.

## Architettura Tecnica
- **Frontend**: React Native / Expo Router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Email**: Brevo
- **PDF**: fpdf2 / Pillow

## Funzionalità Implementate

### Modulo Compensi Coach (COMPLETO)
- Generazione PDF quietanze mensili
- Gestione soglie fiscali €5K e €15K
- Firma digitale con canvas
- Invio email automatico

### Modulo Compensi Dirigenti (COMPLETO)
- Stessa funzionalità dei Coach

### Modulo Prime Squadre (IN PROGRESS)

**Backend COMPLETO:**
- `athlete_type`: "quota" (paga quote) | "compensated" (percepisce compenso)
- `parents_detached`: flag per sganciare genitori da atleta maggiorenne
- Campi economici (IBAN, banca, intestatario)
- Campi documenti (tipo, numero, scadenza, fronte/retro)
- Endpoint `POST /athletes/{id}/detach-parents`
- Endpoint `POST /athletes/{id}/reattach-parents`
- Endpoint `PATCH /athletes/{id}/type-config`

**Frontend PARZIALE:**
- ✅ Pulsante "Sgancia Genitori" nella scheda atleta maggiorenne
- ✅ Badge "Genitori sganciati" + pulsante "Ricollega"
- ✅ Pagina gestione Prime Squadre
- ✅ Pagina dettaglio compensi atleta
- [ ] Form registrazione atleta con scelta tipo A/B
- [ ] Sezione dati economici per atleti tipo "compensated"

### Protezione Auth (COMPLETO)
- Layout protetti per tutti i ruoli
- Redirect automatico a /login

## Prossimi Task
1. ✅ Pulsante "Sgancia Genitori" - COMPLETATO
2. [ ] Modificare form registrazione atleta con scelta tipo (A/B)
3. [ ] Se tipo B + maggiorenne → mostrare dati economici (IBAN, documento)
4. [ ] Se tipo B + minorenne → mostrare sezione genitori

### Importatore Calendari Federazioni (COMPLETO - 18/02/2026)

**Backend COMPLETO:**
- `/app/backend/federation_scraper.py`: Classi FIPAVScraper e FIPScraper
- Endpoint `GET /api/federation/regions` - Lista regioni disponibili
- Endpoint `GET /api/federation/seasons` - Stagioni sportive
- Endpoint `GET /api/federation/championships` - Campionati per stagione
- Endpoint `GET /api/federation/societies` - Società iscritte alla federazione
- Endpoint `POST /api/federation/preview` - Anteprima partite (richiede auth admin)
- Endpoint `POST /api/federation/import` - Importazione partite (richiede auth admin)
- Endpoint `GET /api/federation/config` - Configurazione salvata
- Supporto FIPAV con 17 regioni (Umbria, Lazio, Toscana, ecc.)
- Scraping reale verso portalefipav.net

**Frontend COMPLETO:**
- `/app/frontend/app/admin/import-calendar.tsx`: Wizard 4 step
  1. Selezione Federazione + Regione + Stagione
  2. Selezione Società + Campionati + Mapping squadre locali
  3. Anteprima partite da importare
  4. Conferma importazione

**Testing:**
- 13/13 test backend passati
- Tutti i flussi frontend verificati
- Report: `/app/test_reports/iteration_8.json`

## Backlog
- Modello Freemium
- Integrazione Stripe (luglio 2026)
- Refactoring server.py

## Ultima Modifica
- Data: 18 Febbraio 2026
- Modifica: Implementato Importatore Calendari Federazioni (FIPAV Umbria)
