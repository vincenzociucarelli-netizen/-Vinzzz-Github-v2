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

## Backlog
- Modello Freemium
- Integrazione Stripe (luglio 2026)
- Refactoring server.py

## Ultima Modifica
- Data: 18 Febbraio 2026
- Modifica: Implementato pulsante "Sgancia/Ricollega Genitori" nella scheda atleta per tutti i maggiorenni
