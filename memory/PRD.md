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
4. **Periodo di Prova 7 Giorni** (NUOVO):
   - Backend: Nuovi endpoint `/api/trial/check-pending`, `/api/trial/accept-privacy/{id}`, `/api/trial/request-deletion/{id}`, `/api/trial/status/{id}`
   - Frontend: Modal bloccante nella dashboard genitore al termine dei 7 giorni
   - Opzione A: Accetta privacy e conferma iscrizione → status diventa "active"
   - Opzione B: Non resta, cancella tutti i dati → elimina atleta, pagamenti, certificati, presenze + notifica admin

## Session Changes (15/02/2026)
1. **Svuotamento collezione pagamenti**: Come richiesto dall'utente, la collezione `payments` è stata svuotata completamente
2. **Fix Bug Critici Trial Period**: Corretti 3 endpoint che usavano erroneamente `parent_email` invece di `parent_id`:
   - `/api/trial/check-pending`: ora cerca atleti tramite `parent_id` e `second_parent_id`
   - `/api/trial/accept-privacy/{id}`: verifica genitore tramite `parent_id` e `second_parent_id`
   - `/api/trial/request-deletion/{id}`: verifica genitore tramite `parent_id` e `second_parent_id`
3. **Cancellazione Dati Completa**: L'endpoint `request-deletion` ora elimina correttamente:
   - Tutti i pagamenti dell'atleta (`db.payments.delete_many`)
   - Tutti i certificati (`db.certificates.delete_many`)
   - Tutte le presenze (`db.attendances.delete_many`)
   - L'atleta stesso (`db.athletes.delete_one`)
   - Crea notifica per l'admin

## Testing Status
- Backend: 8/8 test passati (trial endpoints)
- Test file: `/app/backend/tests/test_trial_endpoints.py`

## Session Changes (16/02/2026)
1. **Fix Sistema Icone**: Sostituito tutte le emoji con icone Ionicons da `@expo/vector-icons`
   - Aggiornati 25+ file con import uniformato
   - Menu dashboard admin: tutte le voci ora usano icone vettoriali
   - Header admin: icone per settings, logout, briefcase
   - Frecce indietro: tutte convertite da `←` a `arrow-back` di Ionicons
   - Banner beta: rimosso emoji `🎉`, usata icona `gift`
   - Pagine atleti: icone per export e ricerca
   - Rimosso il file workaround `src/components/Icon.tsx` dall'import principale

2. **Email Mittente Aggiornata**: 
   - Modificato SENDER_EMAIL da `info@pallavoloperugia.it` a `pallavoloperugia@gmail.com`

3. **Confermato Banner 30 Tesserati**: Il banner già mostrava "30 tesserati" (era stato corretto nella sessione precedente)

4. **Discussione Sistema Compensi Sportivi**: 
   - Definito il flusso per ricevute mensili coach/atleti
   - Proposta soluzione firma documentale: firma grafica + PDF + email automatica
   - Stesso sistema riutilizzabile per privacy genitori
   - NOTA: Da implementare nelle prossime sessioni

5. **NOTA PER PUBBLICAZIONE APP**: Registrare dominio `registrateam.it` per email centralizzate (noreply@registrateam.it)

## Pending/Backlog
- P1: **Sistema Firma Documentale** - Firma grafica + PDF + email automatica
- P1: **Applicare firma alla Privacy Genitori** - Sostituire flag con firma documentale
- P1: **Modulo Compensi Sportivi (Coach)** - Anagrafica collaboratori, ricevute mensili, dichiarazioni
- P1: Implementare logica freemium (limite 30 tesserati gratuiti)
- P2: Limite team per società + upgrade message
- P2: **Integrazione Stripe pagamenti online** (vedi dettagli sotto)
- P2: Modulo atleti professionisti con compenso (PRO)
- P3: Integrazione Stripe per RegistraTEAM (vendita pack membri)

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

