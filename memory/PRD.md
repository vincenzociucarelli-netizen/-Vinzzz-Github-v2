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

## P1 - Media Priorità
- [x] **Squadre Assegnate Coach**: Sezione con link alle pagine delle squadre nella vista coach compensation
- [ ] Implementazione funzionalità Atleti +18 (somme pagate)
- [ ] Regression check completo su tutti i profili

## P2 - Bassa Priorità
- [ ] Admin dashboard - problema caricamento intermittente
- [ ] Controllo globale import @expo/vector-icons

## Future/Backlog
- Implementazione funzionalità per Minorenni
- Funzionalità compensi per Atleta a contratto
- Re-implementazione Stripe
- Refactoring server.py in struttura modulare

## Technical Notes
- **Collapsible Sections**: Usano useState con oggetto {anagrafici, fiscali, bancari}
- **Toggle Function**: toggleSection() per aprire/chiudere sezioni
- **Edit Button in Header**: Icona edit nella sezione collapsabile che apre la sezione e attiva editing
- **Styles Required**: collapsibleHeader (flexDirection row, space-between) e collapsibleContent (marginTop 16)

## Credentials
- Admin: pallavoloperugia@gmail.com / password
