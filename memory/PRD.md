# PRD - Pallavolo Perugia SSD - Sistema Gestionale

## Original Problem Statement
Sistema gestionale per società sportiva che include:
- Gestione ruoli multipli (Admin, Coach, Collaboratore, Dirigente, Atleta)
- Gestione compensi sportivi con soglie fiscali €5k/€15k
- Firma digitale quietanze mensili
- Gestione privacy GDPR
- Profili utente con dati anagrafici, fiscali e bancari

## Core Requirements
1. **Profili Utente Standardizzati**: Tutti i ruoli devono avere UI coerente
2. **Sezioni Collassabili**: Dati Anagrafici, Fiscali e Bancari collassabili per usabilità
3. **Compensi Sportivi**: Gestione con soglie €5k/€15k e relative dichiarazioni
4. **Firma Digitale**: Quietanze mensili firmabili digitalmente
5. **Privacy GDPR**: Consenso privacy obbligatorio per tutti gli utenti adulti

## User Personas
- **Admin**: Gestisce tutti gli utenti, compensi, documenti
- **Coach**: Allenatori con compensi sportivi
- **Collaboratore**: Staff tecnico con compensi
- **Dirigente**: Staff dirigenziale con compensi
- **Atleta**: Atleti maggiorenni e minorenni

## What's Been Implemented

### Session 12 March 2026
- **Flusso Atleta Minorenne Completo**: Implementato ciclo di vita completo per atleti minorenni:
  - Backend: `POST /api/athletes/minor` crea atleta con `is_minor=True` e link al genitore (crea account genitore se non esiste)
  - Backend: `POST /api/athletes/{id}/detach-parents` richiede email e password per creare account indipendente (solo 18+)
  - Admin UI: Pulsante "Minorenne" nella lista atleti apre modal con campi: Nome, Cognome, Data nascita, Sesso, Squadra, Telefono, Email genitore, Password dati
  - Admin UI: Pulsante "Sgancia Genitori" nella pagina dettaglio atleta ora apre modal con campi Email e Password (prima era semplice conferma)
  - Atleta UI: Modalità sola lettura per minorenni - badge "Minorenne", banner "Account in sola lettura", form certificato nascosto, sezione privacy nascosta, azioni trial nascoste
- **Fix bug teams.map()**: Corretto `teams.map()` → `Object.values(teams).map()` nel modal minorenne (teams è oggetto, non array)
- **Privacy Policy V2** (sessione precedente): Aggiornati testi privacy Staff e Minori con documenti forniti dall'utente
- **Fix PDF Privacy**: Allineato il testo PDF generato al testo dell'anteprima frontend (Art. 7: "FIRMA DIGITALE DEL DOCUMENTO"). Aggiornati sia PDF Staff che PDF Minori
- **Certificato Medico Dirigente**: Aggiunto form espandibile nella vista squadra del dirigente per inserire/modificare certificati medici
- **Fix Timezone Certificati**: Tutte le date certificato ora usano ore 12:00 per evitare shift di 1 giorno con conversione UTC
- **Fix Permessi Dirigente**: Aggiunto ruolo "viewer" tra i permessi per `POST /certificates/simple`. Check assegnazione squadra tramite `assigned_teams` su utente
- **Notifica Admin per Certificati**: Quando un non-admin aggiorna un certificato, viene creata una notifica admin con dettagli (chi, atleta, emissione, scadenza)
- **Privacy cliccabile per atleta**: La sezione "Privacy" nella pagina atleta è ora `TouchableOpacity` con `onPress` che apre il modale firma
- **Termini di Utilizzo**: Implementata schermata obbligatoria di accettazione T&C per admin:
  - Backend: `GET/POST /api/societies/terms-status` e `/accept-terms`
  - Frontend: Schermata con testo completo 9 articoli, checkbox dichiarazione, pulsante "Accetta e Continua"
  - Admin layout blocca accesso al dashboard finché i termini non sono accettati
  - Versione termini: 1.0 con Art. 7 aggiornato (150 utenti fino 30/06/2026, poi 30)

### Session 11 March 2026
- **Reset account test**: Luna Nuova resettata a stato PROVA, creato utente adulto "Paolo Rinuncia"
- **Placeholder certificato**: Cambiato da data reale a "gg/mm/aaaa" su tutte le pagine (atleta, admin, genitore)
- **Unificazione sezioni profilo atleta**: Dati Anagrafici e Dati Fiscali nella stessa card con unico salvataggio
- **Cambio password atleta semplificato**: Rimosso "Password Attuale", aggiunto toggle mostra/nascondi password
- **Fix icona certificato medico**: Icona coerente con stato verifica (⏱ arancione = non verificato, ✅ verde = verificato, ❌ rosso = scaduto) su tutti i file
- **Fix PDF privacy firmato**: Il PDF firmato ora è visualizzabile dall'atleta (corretto `related_entity_id` e `privacy_pdf_url`)
- **Fix collegamento coach-atleta**: Endpoint `/teams/{team_id}/coach` ora usa `assigned_teams` (non più `coach_ids` obsoleto), mostra TUTTI i coach della squadra
- **Form certificato collassabile**: Form inserimento certificato nascosto sotto "Nuovo certificato" per pagina più compatta
- **Fix validazione QR scansione**: Aggiunto controllo squadra nell'endpoint `/attendance/check` - impedisce registrazione in squadra sbagliata, messaggi coerenti (stessa squadra = "GIÀ REGISTRATA", squadra diversa = "FORZA REGISTRAZIONE")
- **Nascita estero su TUTTI i profili**: Campi "Luogo/Provincia di Nascita" nascosti quando paese estero, calcolo CF corretto, pulizia automatica campi. Applicato a: atleta, coach, dirigente, collaboratore, admin/athlete, admin/athletes
- **Salvataggio `country_of_birth`**: Campo aggiunto a backend (modelli + endpoint PATCH/GET) con sync tra collections users/athletes
- **Test rinuncia Paolo**: Flusso di eliminazione atleta testato con successo (record athlete eliminato)

### Session 10 March 2026 (Previous Fork)
- **Codice Atleta Permanente**: `athlete_code` = `qr_identifier` (12 char), univoco a vita per codice fiscale
- **Certificati Medici V2**: Rimossi upload file, solo data emissione con calcolo scadenza automatico, metadata tracciamento
- **Rimozione Documento Identità**: Rimossa sezione dal profilo atleta
- **Unificazione salvataggio profilo**: Anagrafica e dati fiscali con unico pulsante
- **Fix codice fiscale estero**: Calcolo corretto per atleti nati all'estero
- **Rimozione campi compenso da checklist approvazione**: Coach e Collaboratore
- **Fix bug PATCH atleta (500)**: Rimosso `athlete_photo` dal modello

### Session 9 March 2026
- **Standardizzazione UI Compensi per tutti i ruoli**: Layout lineare con bullet points (• Compenso base, • Pregressi, • Totale Anno) e importi in grassetto applicato a:
  - Coach (user e admin view)
  - Dirigente (user e admin view)
  - Collaboratore (user e admin view)
- **Box RAS Lineare**: Tutti i box "TOTALE PER RAS" ora usano layout lineare con bullet points
- **Squadre Assegnate Coach**: Aggiunta sezione "Squadre Assegnate" nella vista coach profile (sotto "Compenso Mensile") con link alle pagine delle squadre
- **Sincronizzazione `getYearSummary`**: La funzione calcola correttamente `yearlyFromContractBase` e `supplementaryTotal` in tutte le viste
- **Compensi Pregressi Verificati**: Confermato che dirigenti e collaboratori hanno il campo "COMPENSI PREGRESSI (NELL'ANNO)" editabile identico al coach

### Session 7 December 2025
- **Sezioni Collapsabili Dirigente**: Implementate sezioni collapsabili per Dati Anagrafici, Fiscali e Bancari
- **Sezioni Collapsabili Atleta**: Implementate sezioni collapsabili per Dati Anagrafici, Fiscali e Documento/Dati Bancari
- **Account Banner Compatto**: Banner account compatto per Dirigente e Atleta
- **Fix Bug Admin Dirigente**: Corretto errore JSX in admin/dirigente/[id].tsx

### Previous Sessions
- Standardizzazione pagine compensi (Coach, Collaboratore, Dirigente)
- Logica backend corretta per soglie €5k/€15k
- Sezioni collassabili per Coach e Collaboratore
- Sostituzione globale "ASD" → "ASD/SSD"
- Multi-year threshold support

## Architecture
```
/app
├── backend/
│   └── server.py             # FastAPI backend con MongoDB
└── frontend/
    ├── app/
    │   ├── admin/            # Dashboard e gestione utenti admin
    │   ├── athlete/          # Profilo e compensi atleta
    │   ├── coach/            # Profilo e compensi coach
    │   ├── collaboratore/    # Profilo e compensi collaboratore
    │   └── dirigente/        # Profilo e compensi dirigente
    └── src/
        ├── components/       # Componenti riutilizzabili
        └── services/         # API services
```

## P0 - Priorità Alta (Completed)
- [x] Sezioni collassabili per Dirigente
- [x] Sezioni collassabili per Atleta
- [x] Fix bug JSX admin/dirigente/[id].tsx
- [x] Banner "Documenti Firmati" per Collaboratore, Dirigente, Coach (stile Checklist Onboarding)
- [x] Modal documenti firmati (ordinati dal più recente)
- [x] Colori corretti soglie: Verde ≤€5K, Arancione €5K-€15K, Viola >€15K
- [x] Logica calcolo soglie dinamico basato su cumulativo (non solo flag DB)
- [x] **Sincronizzazione UI Admin-Coach**: Layout lineare identico con bullet points e importi in grassetto
- [x] **Gestione Quietanze Centralizzata**: Pagina /admin/quietanze per gestire tutte le quietanze custom
- [x] **Fix Compensi Custom**: Importo custom admin correttamente visualizzato e usato nelle soglie
- [x] **Banner Dichiarazioni 2026 Blu**: Tutti i banner firmati del secondo anno contrattuale (2026) ora blu (#E3F2FD) per distinguerli dal primo anno (verde) - applicato a Dirigente, Coach, Collaboratore
- [x] **Doppio Incarico (Multi-Ruolo)**: Refactoring da campi fissi a array `qualifications` con UI tag-based per Dirigenti. Bug fix: API GET ora restituisce l'array `qualifications`.
- [x] **Fix Intestatario Conto**: Campo iban_holder correttamente salvato e mostrato
- [x] **Rimozione Conferma Firma**: Pulsante ridondante rimosso da SignaturePadInline
- [x] **Rimozione campi compenso da checklist approvazione**: Rimossi "Compenso Mensile Proposto" e "Compensi Pregressi Dichiarati" dal modal di approvazione Coach e Collaboratore
- [x] **Fix bug PATCH atleta (500)**: Rimosso riferimento a `athlete_photo` non più presente nel modello AthleteUpdate
- [x] **Codice Atleta Permanente**: `athlete_code` = `qr_identifier` (12 char), univoco a vita per codice fiscale
- [x] **Certificati Medici V2**: Rimossi upload file, solo data emissione con calcolo scadenza automatico, metadata tracciamento
- [x] **Rimozione Documento Identità**: Rimossa sezione "Documento di Identità" dal profilo atleta
- [x] **Unificazione salvataggio profilo**: Anagrafica e dati fiscali salvati con unico pulsante
- [x] **Fix codice fiscale estero**: Calcolo corretto per atleti nati all'estero
- [x] **Preparazione account test** (11 Mar 2026): Reset "Luna Nuova" a stato PROVA + creazione utente adulto "Paolo Rinuncia"
- [x] **Placeholder certificato**: Cambiato da data reale a "gg/mm/aaaa" in tutti i file (atleta, admin, genitore)
- [x] **Unificazione sezioni profilo**: Dati Anagrafici e Dati Fiscali nella stessa card con unico salvataggio
- [x] **Cambio password atleta**: Rimosso "Password Attuale", aggiunto toggle mostra/nascondi password
- [x] **Pagamenti Atleta V2** (11 Mar 2026): Logica cumulativa per rate dinamiche - somma pagamenti applicata sequenzialmente alle rate (pagata/parziale/non pagata). UI compatta con piano espandibile, descrizioni reali dal DB, sezione duplicata rimossa
- [x] **Vista Quote Admin Dinamica** (11 Mar 2026): Sezione Quote nella pagina admin/team/[id] ora mostra tutte le rate dinamiche (fino a 12) con nomi e scadenze, con fallback al vecchio sistema 3 rate
- [x] **Ristrutturazione Homepage Atleta** (11 Mar 2026): Layout compatto - header con nome/squadra/email/badge stato. Ordine sezioni: QR → Pagamenti → Coach → Orari → Presenze → Certificato → Dati Personali → Documenti → Privacy
- [x] **Quote Admin Collassabili** (11 Mar 2026): Sezione Quote nelle pagine admin/team è collassabile - mostra totale e numero rate
- [x] **Pagamenti Genitore V2** (11 Mar 2026): Vista pagamenti in parent/athlete/[id] aggiornata con rate dinamiche, logica cumulativa, tutti i coach, pagamenti effettuati collassabili
- [x] **Certificato Medico: Validità Variabile** (12 Mar 2026): Aggiunto campo "Validità (mesi)" al form certificato medico in tutti i punti dell'app (atleta, admin, genitore). Scadenza calcolata: data emissione + N mesi - 1 giorno. Default 12 mesi.

## P1 - Media Priorità
- [x] **Squadre Assegnate Coach**: Sezione con link alle pagine delle squadre nella vista coach compensation
- [x] **Flusso Atleta Minorenne**: Creazione minorenne da admin, link genitore, sgancio genitori, vista read-only
- [ ] Test flusso completo pagamenti per atleta adulto (18+)
- [ ] Test flusso firma privacy con account preparati
- [ ] Test scansione QR code, upload pagamenti/partite, import automatico partite
- [ ] Regression test: impostazioni squadra, importazione calendario, template partite/pagamenti

## P2 - Bassa Priorità
- [ ] Notifiche push per scadenze pagamenti/certificati (rinviate a settembre)
- [ ] Verifica flusso cancellazione utente (record `users` rimane dopo delete atleta)
- [ ] UI compensi per atleta a contratto
- [ ] Separazione ruoli Admin/Dirigente
- [ ] Refactoring codice duplicato in admin/coach/[id].tsx
- [ ] Admin dashboard - problema caricamento intermittente

## Future/Backlog
- Funzionalità compensi per Atleta a contratto (giugno/luglio 2026)
- Refactoring server.py in struttura modulare
- Re-implementazione Stripe
- Ritestare: Scansione QR atleti, carico manuale/template pagamenti e gare, import automatico gare federazioni

## Technical Notes
- **Collapsible Sections**: Usano useState con oggetto {anagrafici, fiscali, bancari}
- **Toggle Function**: toggleSection() per aprire/chiudere sezioni
- **Edit Button in Header**: Icona edit nella sezione collapsabile che apre la sezione e attiva editing
- **Styles Required**: collapsibleHeader (flexDirection row, space-between) e collapsibleContent (marginTop 16)
- **Athlete Code**: `athlete_code` = `qr_identifier`, 12 caratteri alfanumerici. Univoco per `codice_fiscale` (riattivazione se CF esistente)
- **Certificate Metadata**: `certificate_issue_date`, `certificate_expiry_date`, `certificate_verified`, `certificate_inserted_by_*`, `certificate_verified_by_*`

## Credentials
- Admin: pallavoloperugia@gmail.com / password
- Luna Nuova: luna@18piu.com / password (stato: PROVA)
- Paolo Rinuncia: test.rinuncia@test.com / password123 (stato: PROVA)
- Genitore test: genitore.test@example.com / genitore.test2026 (genitore di MARCO VERDI)
- Atleta minorenne test: MARCO VERDI (id: 69b26bc51b2bbcb74f0e3c4f, is_minor: true)
