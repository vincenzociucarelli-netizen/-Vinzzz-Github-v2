# RegistraTEAM - Product Requirements Document

## Original Problem Statement
Applicazione per la gestione di club di pallavolo. Permette agli amministratori di gestire atleti, squadre, allenatori, dirigenti, pagamenti, presenze e certificati medici. I genitori possono visualizzare i dati dei propri figli.

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

## Pending/Backlog
- P1: Verificare periodo prova 7 giorni genitori
- P2: Limite team per società + upgrade message
- P2: Integrazione Stripe pagamenti online
- P2: Modulo atleti professionisti con compenso
- P3: Fix permanente icone (attualmente emoji workaround)
