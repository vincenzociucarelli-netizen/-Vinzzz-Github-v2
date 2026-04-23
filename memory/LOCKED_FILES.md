# FILE BLOCCATI - NON MODIFICARE

Questi file sono stati completati e verificati dall'utente. 
NON devono essere modificati a meno che l'utente lo richieda esplicitamente.

## Coach - Completati e verificati (13/04/2026)
- `/app/frontend/app/coach/compensation.tsx` - Compensi sportivi, soglie 5k/15k, somma supplementare con mese
- `/app/frontend/app/coach/profile.tsx` - Profilo coach, dati anagrafici+fiscali unificati, consensi privacy nascosti se non firmata

## Admin Coach - Completati e verificati (13/04/2026)
- `/app/frontend/app/admin/coach/[id].tsx` - Vista admin coach, alert 5k+15k entrambi visibili, colori unificati, badge accettazione vicino a compenso, threshold warnings

## Atleta 18+ - Completati e verificati (14/04/2026)
- `/app/frontend/app/athlete/profile.tsx` - Profilo atleta, dati anagrafici+fiscali unificati, country_of_birth accettato come alternativa a place_of_birth
- `/app/frontend/app/athlete/index.tsx` - Dashboard atleta, check profilo completo con country_of_birth

## Pre-iscrizione - Completati e verificati (14/04/2026)
- `/app/frontend/app/preseason/[id].tsx` - Form pre-iscrizione: data nascita con calendar picker, logica condizionale (ha giocato sì/no), campi sport/campionati/ruolo
- `/app/frontend/app/admin/preseason.tsx` - Admin pre-iscrizione: filtri statistiche cliccabili, popup dettaglio con condivisione/stampa, sport praticato nel popup

## Atleta 18- e Genitori - Completati e verificati (16/04/2026)
- `/app/frontend/app/parent/athlete/[id].tsx` - Vista genitore dell'atleta minore, dati anagrafici+fiscali unificati, badge "Validazione Certificato", firma privacy con aggiornamento status automatico
- `/app/frontend/app/admin/athletes.tsx` - Lista atleti admin con status "Validazione Certificato" mappato correttamente

## Squadre - Completati e verificati (18/04/2026)
- `/app/frontend/app/admin/teams.tsx` - Lista squadre, creazione con rate, placeholder data GG/MM/AAAA, validazione formato
- `/app/frontend/app/admin/team/[id].tsx` - Dettaglio/modifica squadra, gestione rate con scadenze, placeholder data italiano

## Collaboratore - Completati e verificati (23/04/2026)
- `/app/frontend/app/collaboratore/profile.tsx` - Profilo collaboratore, dati anagrafici+fiscali unificati, codice fiscale estero, consensi privacy collassabili, documenti senza bullet, pulsante indietro funzionante
- `/app/frontend/app/collaboratore/compensation.tsx` - Compensi collaboratore, soglie 5k/15k, metadati verifica con somme pregresse per anno, mensilità speciale inclusa nel totale, timestamp ora italiana
