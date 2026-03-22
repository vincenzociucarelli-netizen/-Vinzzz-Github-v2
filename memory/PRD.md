# PRD - Sport Society Management Platform (RegistraTeam)

## Problema Originale
Piattaforma gestionale per societa sportive con gestione atleti, genitori, coach, presenze, pagamenti e documenti.

## Utenti
- Admin (societa sportiva)
- Genitori (gestiscono i propri figli atleti)
- Coach
- Dirigenti
- Atleti minori (accesso lite)

## Architettura
- Backend: FastAPI + MongoDB (server.py ~20.000 righe)
- Frontend: Expo/React Native Web (app/parent/athlete/[id].tsx ~4.800 righe)
- Email: Brevo (ex Sendinblue)
- Auth: JWT

## Feature Implementate

### Fine Periodo di Prova (Completato)
- 2 bottoni "Rimani e Firma Privacy" (blu) + "Non Rimanere" (rosso) nella sezione stato
- "Non Rimanere" visibile in fondo pagina per atleti trial E attivi
- Flusso "Rimani": request-end-trial → firma privacy → auto-attivazione
- Flusso "Non Rimanere": deletion-check obblighi → modale conferma → richiesta admin
- Cancellazione condizionale: check obblighi fiscali, altri figli, pagamenti
- Admin approva/rifiuta cancellazioni (supporto admin + dirigente)
- Audit log dettagliato con nomi atleta/genitore
- Profile-check controlla il genitore che firma (current_user, non parent_id)
- Certificato verificato persistente dopo reload

### Pre-iscrizioni Stagionali (Completato)
- CRUD campagne pre-iscrizioni
- Form pubblico con link condivisibile
- Dashboard admin gestione campagne
- Export risposte in CSV
- Notifiche email manuali ai genitori non rispondenti (Brevo)

### Cross-Linking Genitori (Completato)
- Collegamento automatico secondo genitore via email
- Attivo alla creazione atleta, aggiornamento email, registrazione genitore
- Endpoint /athletes/my restituisce atleti dove user e parent_id O second_parent_id

### Audit Log Migliorato (Completato)
- Titoli cliccabili con dettagli espandibili
- Label + icona per parent_account_deleted
- Info complete: nome atleta, nome genitore, email, motivo
- Supporto per tutte le azioni di cancellazione

## Bug Risolti (22 Mar 2026)
- Profile-check usava parent_id dell'atleta invece del current_user
- certVerified non sincronizzato con DB al reload
- PDF privacy non si apriva su mobile (ora scarica direttamente)
- Codice Fiscale mancante nel modale admin "Dettaglio Genitore"
- "Certificati" rimosso da descrizioni cancellazione (non esistono nell'app)
- Dirigente abilitato per approvazione cancellazioni

## Task Futuri (Backlog)
- (P1) Promemoria automatici pre-iscrizioni (ogni 5-7 giorni)
- (P2) UI atleti contrattualizzati (dopo pubblicazione)
- (P3) Refactoring server.py in moduli
- (P3) Re-implementazione Stripe
- (P3) Pulizia DB: ruolo "viewer" → "dirigente"
- (P3) Pubblicazione dominio / App Store
- (P3) Refactoring athlete/[id].tsx
