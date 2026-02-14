# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Applicazione per la gestione di club di pallavolo. Permette agli amministratori di gestire atleti, squadre, allenatori, dirigenti, pagamenti, presenze e certificati medici. I genitori possono visualizzare i dati dei propri figli.

## Business Model
### Fase Beta (fino al 30/06/2026)
- Accesso completo e gratuito per società amiche/tester
- Tutte le funzionalità disponibili senza limitazioni

### Dal 01/07/2026 - Modello a Tesserati
I tesserati includono: atleti, dirigenti e coach.

| Piano | Tesserati | Prezzo |
|-------|-----------|--------|
| **FREE** | 50 | Gratuito |
| **Pack +50** | +50 (tot 100) | € X (da definire) |
| **Pack +100** | +100 (tot 200) | € XY (da definire) |

*I pack sono cumulabili per raggiungere il numero desiderato*

## User Personas
- **Admin/Dirigente**: Gestisce la società sportiva, atleti, squadre, pagamenti
- **Coach/Allenatore**: Registra presenze agli allenamenti tramite QR code
- **Genitore**: Visualizza dati dei figli, pagamenti, presenze

## Core Features Implemented
- Autenticazione JWT con ruoli (admin, coach, parent)
- Gestione atleti con QR code per presenze
- Gestione squadre e assegnazione atleti
- Gestione pagamenti con attestato di versamento
- Gestione certificati medici con scadenze
- Calendario gare con import Excel
- Dashboard admin con statistiche
- Notifiche e comunicazioni

## Tech Stack
- **Frontend**: React Native/Expo (web + mobile)
- **Backend**: FastAPI + MongoDB
- **Integrations**: SendGrid (email), OpenAI (foto artistiche)

## Last Session Changes (14/02/2026)
1. Attestato di Versamento: layout compatto A4, download HTML diretto, spazi scrivibili per dati mancanti
2. Fix "Ionicons is not defined" in Calendario Gare
3. QR code nell'header della scheda atleta con modal stampa/condividi

## Current Session Changes (14/02/2026)
1. **Bug Fix "Sport Praticato"**: Aggiunto campo al modello backend `SocietySettingsUpdate`, endpoint GET e PATCH
2. **Pulsante Salva Floating**: Implementato pulsante fisso in basso nella pagina Impostazioni per migliore UX
3. **CRITICO - Fix Pagamenti Errati**: 
   - Eliminati pagamenti erroneamente associati a PEDANA LUIGIA, CERCHI TIZIANA, CERCHI SARA, REPAS CLAUDIA
   - Aggiunto **banner di conferma atleta** nel modal pagamento (mostra nome e squadra)
   - Aggiunta **conferma obbligatoria** prima di salvare ogni pagamento
   - Messaggi di successo ora includono nome atleta e importo
   - Aggiunta nota esplicativa nello Storico Pagamenti: "Ogni pagamento registrato scala automaticamente dal residuo. Puoi registrare più pagamenti parziali."

## Pending/Backlog
- P1: Implementare logica freemium (limite 50 tesserati gratuiti)
- P1: Verificare periodo prova 7 giorni genitori
- P2: Limite team per società + upgrade message
- P2: **Integrazione Stripe pagamenti online** (vedi dettagli sotto)
- P2: Modulo atleti professionisti con compenso
- P3: Fix permanente icone (attualmente emoji workaround)

## Dettagli Integrazione Stripe (P2)
**Modello di business:** La società sportiva cliente configura il proprio account Stripe.

**Da implementare:**
1. Nuovi campi in Impostazioni Società: `stripe_publishable_key`, `stripe_secret_key`
2. Pulsante "Paga Online" nella sezione pagamenti lato genitore
3. Integrazione Stripe Checkout/Payment Intent
4. Webhook per conferma pagamento e aggiornamento automatico stato pagamento

**Flusso:**
- Admin società → Crea account su stripe.com → Inserisce chiavi API nelle Impostazioni
- Genitore → Vede rata da pagare → Clicca "Paga Online" → Stripe Checkout → Pagamento confermato
- I soldi vanno direttamente sul conto Stripe della società sportiva
