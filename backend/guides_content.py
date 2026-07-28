"""
📖 10/07/2026 (v7.15-hotfix11) — Contenuti dei manuali/prontuari RegistraTEAM.

Modifiche dopo feedback utente 12/07:
- NESSUN utente riceve email di convalida account
- Admin autorizza l'accesso di: Dirigente / Coach / Collaboratore / Atleta 18+ PRO
- Genitori (atleti minorenni) e Atleti 18+ QUOTA: iscrizione libera + periodo di prova,
  admin poi assegna gruppo/squadra
- Genitore inserisce l'anagrafica del figlio; il secondo genitore cerca l'atleta
  già registrato e attende consenso del primo genitore
- Coach/Dirigente/Collaboratore: soglia RAS = promemoria (non generazione automatica)
- Rimosso "IBAN" dalla sezione primo accesso del genitore (paga, non riceve)

Struttura standard (5 sezioni):
  1. Registrazione
  2. Primo accesso
  3. Firma documenti GDPR
  4. Attività periodiche
  5. FAQ e contatti
"""

GUIDES_META = {
    "admin": {"role_label": "Amministratore", "accent_color": "#1976D2", "icon": "🛡️",
              "audience": "responsabili della società"},
    "coach": {"role_label": "Coach / Allenatore", "accent_color": "#E53935", "icon": "🏐",
              "audience": "allenatori delle squadre"},
    "dirigente": {"role_label": "Dirigente Sportivo", "accent_color": "#7B1FA2", "icon": "🎖️",
                  "audience": "dirigenti retribuiti"},
    "collaboratore": {"role_label": "Collaboratore", "accent_color": "#00838F", "icon": "🧰",
                      "audience": "collaboratori (custodi, segreteria, ecc.)"},
    "parent": {"role_label": "Genitore", "accent_color": "#43A047", "icon": "👨‍👩‍👧",
               "audience": "genitori di atleti minorenni"},
    "athlete": {"role_label": "Atleta 18+ (paganti)", "accent_color": "#00838F", "icon": "🏐",
                "audience": "atleti maggiorenni che pagano la quota associativa"},
    "athlete_pro": {"role_label": "Atleta 18+ PRO", "accent_color": "#F57C00", "icon": "🏆",
                    "audience": "atleti maggiorenni retribuiti (Riforma Sport)"},
    "coordinatore": {"role_label": "Coordinatore", "accent_color": "#00838F", "icon": "🗂️",
                     "audience": "coordinatori (ruolo intermedio Admin/Dirigente)"},
}

COMMON_FAQ = [
    ("Ho dimenticato la password. Come faccio?",
     "Nella pagina di login, clicca su 'Password dimenticata?'. Inserisci la tua email registrata. "
     "Riceverai un link per impostare una nuova password. Se non arriva l'email entro 5 minuti, "
     "controlla la cartella Spam."),
    ("Posso modificare i miei dati dopo la registrazione?",
     "Sì. Vai su Anagrafica dalla tua dashboard e modifica i campi consentiti. Per dati fiscali "
     "(codice fiscale, IBAN) potrebbe essere richiesta l'approvazione dell'amministratore."),
    ("Come contatto l'amministratore della società?",
     "Trovi i contatti in fondo a questo documento. Puoi anche scrivere via email a {society_email}."),
    ("L'app funziona su smartphone?",
     "Sì. RegistraTEAM è ottimizzato per smartphone e tablet oltre che per PC. Consigliamo Chrome "
     "o Safari aggiornati. Puoi aggiungere la web-app alla home del telefono per accesso rapido."),
    ("I miei dati sono al sicuro?",
     "Sì. Tutti i dati sono cifrati in transito (HTTPS) e conservati su server europei. "
     "Il trattamento è conforme al GDPR — trovi l'informativa completa firmando i documenti privacy."),
]


GUIDES = {
    # ─────────────────────────────────────────────────────────────────────────
    "parent": {
        "sections": [
            {
                "title": "1. Registrazione",
                "body": [
                    "Sei il genitore/tutore di un atleta minorenne di {society_name}.",
                    "PASSI DA SEGUIRE:",
                    "• Vai su app.registrateam.it → clicca 'Registrati' → seleziona 'Genitore'",
                    "• 🔑 Inserisci il CODICE SOCIETÀ: <b>{society_invite_code}</b>",
                    "• Inserisci: nome, cognome, codice fiscale, email, telefono, password",
                    "• Accetta i consensi di trattamento dati (obbligatorio)",
                    "• Conferma → l'account è ATTIVO SUBITO, senza email di convalida",
                    "IMPORTANTE: la registrazione del genitore è LIBERA — non serve autorizzazione admin. "
                    "Sarà l'admin ad assegnare successivamente il gruppo/squadra dove tuo figlio farà "
                    "il periodo di prova.",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Al primo login ti verrà chiesto di:",
                    "• Confermare/completare i tuoi dati anagrafici (indirizzo, città, CAP)",
                    "REGISTRARE IL/I FIGLIO/I:",
                    "• Dalla dashboard genitore, clicca su 'Registra Atleta'",
                    "• Inserisci i dati anagrafici del figlio: nome, cognome, CF, data di nascita, ecc.",
                    "• Carica il certificato medico di idoneità sportiva",
                    "• Firma i documenti GDPR per conto del minore",
                    "• Il figlio è ora iscritto in periodo di prova — l'admin lo assegnerà a un gruppo/squadra",
                    "SECONDO GENITORE:",
                    "Se sei il SECONDO genitore (l'altro genitore ha già registrato tuo figlio):",
                    "• Registrati normalmente come genitore",
                    "• Dalla dashboard clicca 'Cerca Atleta' → inserisci nome/cognome del figlio",
                    "• Invia richiesta di collegamento — il PRIMO genitore riceve una notifica",
                    "• Il primo genitore approva la tua richiesta → potrai vedere tutti i dati del figlio",
                    "Nota: se non trovi tuo figlio nella ricerca significa che nessun genitore l'ha "
                    "ancora registrato — sarai TU il primo a inserirlo con la procedura sopra.",
                ],
            },
            {
                "title": "3. Firma documenti GDPR e Privacy",
                "body": [
                    "Per ogni figlio minorenne collegato, dovrai firmare digitalmente:",
                    "• Informativa Privacy (obbligatoria)",
                    "• Consenso al trattamento dati sanitari",
                    "• Dichiarazione periodo di prova (all'inizio del percorso)",
                    "• Autorizzazioni foto/video (opzionali)",
                    "COME FIRMARE:",
                    "• Vai su 'Documenti' dalla dashboard",
                    "• Clicca sul documento in stato 'Da firmare'",
                    "• Leggi il testo, spunta le voci obbligatorie, poi firma nel riquadro con dito o mouse",
                    "• Il PDF firmato viene generato automaticamente — lo trovi in 'Documenti firmati'",
                    "IMPORTANTE: la firma è vincolante come una firma cartacea. Se il figlio compie 18 anni "
                    "durante la stagione, dal rinnovo successivo firmerà lui/lei direttamente.",
                ],
            },
            {
                "title": "4. Attività periodiche",
                "body": [
                    "COSA FARE OGNI TANTO (mensile o quando serve):",
                    "• PAGAMENTI: quando la società emette una quota, riceverai una notifica. Vai su "
                    "'Pagamenti' → clicca sull'importo → paga con bonifico o carta (in base a quanto "
                    "impostato dalla società).",
                    "• CERTIFICATO MEDICO: quando quello di tuo figlio sta per scadere, ricevi un "
                    "promemoria. Carica il nuovo certificato in PDF da 'Documenti'.",
                    "• COMUNICAZIONI: leggi periodicamente 'Da fare' della dashboard — lì trovi tutte "
                    "le richieste in sospeso della società.",
                    "SE HAI PIÙ FIGLI: dalla dashboard puoi passare da un figlio all'altro con il "
                    "selettore in alto — così vedi separatamente pagamenti, documenti, allenamenti "
                    "di ciascuno.",
                ],
            },
        ],
    },

    # ─────────────────────────────────────────────────────────────────────────
    # 🐛 27/07/2026 — Contenuti separati: l'atleta 18+ pagante NON vede più i
    # riferimenti alla parte compensi/PRO, e viceversa. La scelta lato server è
    # basata sul campo `athlete_type` dell'utente (compensated → athlete_pro).
    "athlete": {
        "sections": [
            {
                "title": "1. Registrazione",
                "body": [
                    "Sei un atleta maggiorenne di {society_name} che partecipa versando la quota associativa.",
                    "PASSI DA SEGUIRE:",
                    "• Vai su app.registrateam.it → 'Registrati' → 'Atleta 18+'",
                    "• 🔑 Inserisci il CODICE SOCIETÀ: <b>{society_invite_code}</b>",
                    "• Compila: nome, cognome, CF, data e luogo di nascita, email, telefono, password",
                    "• Accetta i consensi obbligatori",
                    "• REGISTRAZIONE LIBERA: l'account è ATTIVO SUBITO — nessuna email di convalida",
                    "• Farai un breve periodo di prova nella squadra assegnata dall'admin",
                ],
            },
            {
                "title": "2. Primo accesso e Anagrafica",
                "body": [
                    "Al primo login completa il profilo — tienilo sempre aggiornato:",
                    "• DATI ANAGRAFICI: indirizzo, città, CAP, provincia, luogo di nascita",
                    "• DATI FISCALI: codice fiscale",
                    "• CONTATTI: email + telefono cellulare",
                    "• DOCUMENTO d'identità (se richiesto dalla società)",
                    "• FOTO profilo (opzionale)",
                    "IBAN: NON serve — come atleta pagante non ricevi denaro dalla società.",
                ],
            },
            {
                "title": "3. Certificato medico (iter corretto)",
                "body": [
                    "Il certificato di idoneità agonistica è OBBLIGATORIO per allenarsi/gareggiare.",
                    "PROCEDURA:",
                    "• 1) Fai la visita medico-sportiva presso ASL o centro accreditato",
                    "• 2) Vai in Anagrafica → Certificato medico → INSERISCI PRIMA LA DATA DI EMISSIONE",
                    "     stampata sul certificato (la scadenza è calcolata automaticamente)",
                    "• 3) Carica la copia scannerizzata (PDF/foto)",
                    "• 4) CONSEGNA IL CARTACEO alla Società al più presto: la Società autentica la data",
                    "     di emissione e conserva la copia cartacea negli archivi",
                    "ATTENZIONE: senza certificato validato dalla Società il tuo QR può essere",
                    "bloccato all'ingresso in palestra. Fai la visita in anticipo.",
                ],
            },
            {
                "title": "4. Firma dei documenti GDPR",
                "body": [
                    "Dovrai firmare digitalmente:",
                    "• Informativa Privacy (obbligatoria)",
                    "• Consenso trattamento dati sanitari",
                    "• Dichiarazione periodo di prova (se richiesto dalla società)",
                    "COME FIRMARE: Dashboard → 'Documenti' → apri il documento → leggi → spunta i",
                    "consensi → firma nel riquadro → conferma. Il PDF firmato è subito disponibile.",
                    "Da maggiorenne firmi TU direttamente, non un genitore.",
                ],
            },
            {
                "title": "5. Pagamento della quota associativa",
                "body": [
                    "La Società definisce importo e modalità (annuale o rate).",
                    "COME PAGARE: dashboard → 'Pagamenti':",
                    "• Vedi elenco rate, importi, scadenze, stato (pagato / in sospeso / scaduto)",
                    "• Se la Società ha attivato Stripe → paghi con carta direttamente in app",
                    "• Altrimenti riceverai indicazioni per bonifico o pagamento in sede",
                    "• Ogni pagamento genera una RICEVUTA PDF, disponibile in Documenti",
                    "SOLLECITI: rate in scadenza → notifica via email + app. Puoi pagare in un clic",
                    "dalla notifica stessa.",
                ],
            },
            {
                "title": "6. Presenze, QR code e Ingresso Lite",
                "body": [
                    "AD OGNI ALLENAMENTO devi mostrare il tuo QR personale al coach per la",
                    "registrazione presenze.",
                    "• Tocca 'Il mio QR' sulla dashboard: mostralo al coach che lo scansiona",
                    "• Vedi conferma immediata 'Presenza registrata'",
                    "INGRESSO LITE (uso quotidiano): Profilo → Ingresso Lite → imposti un PIN a 4",
                    "cifre. Da lì potrai aprire l'app e mostrare il QR con il solo PIN, senza",
                    "email/password. Funziona solo sul dispositivo che lo ha attivato.",
                ],
            },
            {
                "title": "7. Da fare, Documenti firmati e Statistiche",
                "body": [
                    "PAGINA 'Da fare': il tuo diario operativo — allenamenti, gare, convocazioni,",
                    "annullamenti, firme in scadenza, certificato in scadenza, rate in scadenza.",
                    "Aprila ogni giorno: sai subito cosa fare e dove essere.",
                    "DOCUMENTI FIRMATI: in fondo all'Anagrafica trovi la sezione 'Documenti' con",
                    "tutti i tuoi PDF firmati (privacy, prova, ricevute pagamento). Ogni PDF ha",
                    "un QR di verifica pubblica per attestarne l'autenticità.",
                    "STATISTICHE (sezione Presenze): storico allenamenti/gare, contatore mensile,",
                    "% presenza sul totale squadra, filtri per periodo.",
                ],
            },
        ],
    },

    "athlete_pro": {
        "sections": [
            {
                "title": "1. Registrazione",
                "body": [
                    "Sei un atleta maggiorenne di {society_name} RETRIBUITO ai sensi della",
                    "Riforma dello Sport (D.Lgs. 36/2021).",
                    "PASSI DA SEGUIRE:",
                    "• Vai su app.registrateam.it → 'Registrati' → 'Atleta 18+'",
                    "• 🔑 Inserisci il CODICE SOCIETÀ: <b>{society_invite_code}</b>",
                    "• Compila: nome, cognome, CF, data e luogo di nascita, email, telefono, password",
                    "• Accetta i consensi obbligatori",
                    "ATTENZIONE: l'account resta IN ATTESA DI AUTORIZZAZIONE dell'admin che ti",
                    "abiliterà come 'compensated'. Solo dopo potrai accedere ai Compensi e firmare",
                    "le quietanze.",
                ],
            },
            {
                "title": "2. Primo accesso e Anagrafica completa",
                "body": [
                    "Al primo login completa il profilo — tienilo sempre aggiornato:",
                    "• DATI ANAGRAFICI: indirizzo, città, CAP, provincia, luogo di nascita",
                    "• DATI FISCALI: codice fiscale",
                    "• IBAN: OBBLIGATORIO — è dove ricevi i compensi mensili. Se cambi banca,",
                    "  aggiornalo PRIMA della quietanza successiva",
                    "• CONTATTI: email + telefono cellulare",
                    "• DOCUMENTO d'identità (se richiesto)",
                    "PERCHÉ È CRITICO: ogni quietanza copia i tuoi dati anagrafici in un PDF",
                    "ufficiale. Dati incompleti = documento con campi vuoti non valido ai fini fiscali.",
                ],
            },
            {
                "title": "3. Certificato medico (iter corretto)",
                "body": [
                    "Il certificato di idoneità agonistica è OBBLIGATORIO per allenarsi/gareggiare.",
                    "PROCEDURA:",
                    "• 1) Fai la visita medico-sportiva presso ASL o centro accreditato",
                    "• 2) Vai in Anagrafica → Certificato medico → INSERISCI PRIMA LA DATA DI EMISSIONE",
                    "     stampata sul certificato (la scadenza è calcolata automaticamente)",
                    "• 3) Carica la copia scannerizzata (PDF/foto)",
                    "• 4) CONSEGNA IL CARTACEO alla Società al più presto: la Società autentica",
                    "     la data di emissione e conserva la copia cartacea negli archivi",
                    "Senza certificato validato dalla Società, il tuo QR può essere bloccato",
                    "all'ingresso in palestra.",
                ],
            },
            {
                "title": "4. Firma documenti GDPR e contratto Riforma Sport",
                "body": [
                    "Firma digitale obbligatoria per:",
                    "• Informativa Privacy GDPR",
                    "• Consenso trattamento dati sanitari",
                    "• Contratto di collaborazione sportiva (Riforma Sport) — VERIFICA date",
                    "  inizio/fine e importo mensile PRIMA di firmare",
                    "• Dichiarazione compensi pregressi (vedi punto 5)",
                    "COME FIRMARE: Dashboard → 'Documenti' → apri il documento → leggi → spunta →",
                    "firma nel riquadro → conferma.",
                ],
            },
            {
                "title": "5. Accettazione compenso + Dichiarazione pregressi",
                "body": [
                    "Prima di poter firmare le quietanze mensili devi:",
                    "• 1) ACCETTARE FORMALMENTE il compenso pattuito — Compensi → 'Accetta compenso'",
                    "• 2) FIRMARE la DICHIARAZIONE COMPENSI PREGRESSI: se nel corso dell'anno",
                    "     solare hai già percepito compensi sportivi da ALTRE società, dichiara qui",
                    "     l'importo totale. Se non hai percepito nulla altrove seleziona 'Nessun",
                    "     pregresso' e firma comunque. È OBBLIGATORIA.",
                    "PERCHÉ è cruciale: le soglie previdenziali €5.000 / €15.000 si calcolano sul",
                    "totale annuo cumulato ricevuto da tutti gli enti sportivi. Senza dichiarazione",
                    "pregressi il sistema non può calcolare correttamente il superamento delle soglie.",
                ],
            },
            {
                "title": "6. Ogni mese: firma quietanza + compensi esterni",
                "body": [
                    "Ogni mese la Società ti propone la QUIETANZA del compenso — è la ricevuta",
                    "con cui attesti di aver percepito il compenso.",
                    "PROCEDURA:",
                    "• 1) Ricevi notifica via email + campanella",
                    "• 2) Compensi → seleziona il mese (ORDINE CRONOLOGICO: prima i mesi precedenti)",
                    "• 3) Verifica LORDO + eventuali trattenute INPS + NETTO",
                    "• 4) DICHIARA I COMPENSI ESTERNI DEL MESE: prima della firma il sistema ti chiede",
                    "     se in QUELLO STESSO MESE hai ricevuto compensi da altre società. Rispondi",
                    "     onestamente (0 se nulla, altrimenti l'importo esatto). È il dato che permette",
                    "     il calcolo corretto delle soglie €5.000 / €15.000 a livello personale.",
                    "• 5) Firma nel riquadro e conferma. Il PDF arriva via email + Documenti firmati.",
                ],
            },
            {
                "title": "7. Soglie previdenziali €5.000 / €15.000",
                "body": [
                    "SOGLIA €5.000/anno: sotto → esente INPS. Sopra → iscrizione INPS Gestione",
                    "Separata (contributi sull'eccedenza).",
                    "SOGLIA €15.000/anno: sotto → nessuna tassazione IRPEF sui compensi sportivi.",
                    "Sopra → tassazione IRPEF sull'eccedenza.",
                    "QUANDO SUPERI UNA SOGLIA: il sistema propone automaticamente la COMUNICAZIONE",
                    "DI SUPERAMENTO da firmare digitalmente. È il documento ufficiale per gli",
                    "adempimenti RAS (Registro Attività Sportive). Il PDF firmato resta in",
                    "Documenti firmati + copia via email.",
                ],
            },
            {
                "title": "8. Da fare, QR presenze, Ingresso Lite",
                "body": [
                    "PAGINA 'Da fare' — il tuo diario operativo: programma allenamenti, calendario",
                    "gare, convocazioni, annullamenti, documenti/firme/certificato in scadenza.",
                    "Aprila ogni giorno.",
                    "PRESENZE QR: ad ogni allenamento mostri il tuo QR personale al coach che lo",
                    "scansiona → presenza registrata con data/ora/palestra.",
                    "INGRESSO LITE (uso quotidiano): Profilo → Ingresso Lite → PIN a 4 cifre → apri",
                    "l'app e mostri il QR con il solo PIN, senza email/password. Funziona solo sul",
                    "tuo dispositivo.",
                ],
            },
            {
                "title": "9. Documenti firmati e Statistiche presenze",
                "body": [
                    "DOCUMENTI FIRMATI: in fondo all'Anagrafica trovi la sezione 'Documenti'.",
                    "Ci sono tutti i tuoi PDF firmati: privacy, contratto Riforma Sport,",
                    "dichiarazione pregressi, tutte le quietanze mensili, eventuali comunicazioni",
                    "di superamento soglia. Ogni PDF ha un QR di verifica pubblica.",
                    "STATISTICHE PRESENZE (sezione Presenze): storico completo allenamenti/gare,",
                    "contatore mensile, % presenza sul totale squadra, filtri per periodo.",
                    "Molti coach usano la % presenza come indicatore per convocazioni e minuti in",
                    "campo — sono i tuoi numeri, monitorali.",
                ],
            },
        ],
    },

    # ─────────────────────────────────────────────────────────────────────────
    "coach": {
        "sections": [
            {
                "title": "1. Registrazione",
                "body": [
                    "Sei stato invitato dalla società {society_name} a registrarti come coach.",
                    "PASSI DA SEGUIRE:",
                    "• Apri il link di invito ricevuto dalla società (via email o WhatsApp)",
                    "• 🔑 Inserisci il CODICE SOCIETÀ: <b>{society_invite_code}</b>",
                    "• Compila i dati: nome, cognome, CF, data e luogo di nascita, email, telefono, password",
                    "• Accetta i consensi obbligatori",
                    "IMPORTANTE: l'account NON verrà attivato automaticamente. Sarà l'admin della società "
                    "ad autorizzare il tuo accesso dopo aver verificato i tuoi dati. Riceverai una "
                    "notifica quando sarai abilitato.",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Dopo l'autorizzazione dell'admin, completa i tuoi dati:",
                    "• RESIDENZA: indirizzo, città, CAP",
                    "• DATI FISCALI: CF (richiesto per Riforma Sport)",
                    "• IBAN: obbligatorio se retribuito — è dove ricevi i compensi mensili",
                    "• DATI SANITARI: certificato di idoneità (se richiesto dalla società)",
                    "• CONTRATTO: verifica date inizio/fine e compenso mensile — se qualcosa non torna "
                    "contatta l'admin PRIMA di accettarlo",
                    "ACCETTAZIONE COMPENSO:",
                    "Dalla dashboard vai su 'Compensi' → 'Accetta Compenso € XXX' → conferma. "
                    "Da quel momento potrai firmare le quietanze mensili.",
                ],
            },
            {
                "title": "3. Firma documenti GDPR e contratto",
                "body": [
                    "Firma digitale obbligatoria per:",
                    "• Informativa Privacy",
                    "• Contratto di collaborazione sportiva (Riforma Sport)",
                    "• Consenso trattamento dati (obbligatorio prima delle quietanze)",
                    "• Autorizzazioni foto/video (opzionali)",
                    "COME FIRMARE:",
                    "• Dashboard → 'Da fare' oppure 'Documenti'",
                    "• Clicca sul documento in stato 'Da firmare' → leggi → firma nel riquadro",
                    "• Il PDF è disponibile subito nella sezione 'Documenti firmati'",
                ],
            },
            {
                "title": "4. Attività periodiche",
                "body": [
                    "OGNI ALLENAMENTO/GARA:",
                    "• Segna le presenze degli atleti via QR code o manualmente dalla scheda squadra",
                    "• Segnala allenamenti annullati/rifinitura dalla sezione 'Da fare'",
                    "OGNI MESE (per compenso):",
                    "• Attendi la generazione della quietanza da parte dell'admin",
                    "• Ricevi notifica: dashboard → 'Compensi' → mese corrente → 'Firma quietanza'",
                    "• Firma nel riquadro → il PDF firmato ti arriva anche via email",
                    "SOGLIE Riforma Sport:",
                    "• Al superamento di €5.000/anno o €15.000/anno riceverai un promemoria per le "
                    "comunicazioni RAS (Registro Attività Sportive)",
                    "• Firma queste comunicazioni non appena appaiono in 'Documenti da firmare'",
                    "DUAL-ROLE (se sei anche atleta):",
                    "Usa il pulsante 'Passa a Modalità Atleta' in alto per passare da un ruolo all'altro "
                    "senza logout.",
                ],
            },
        ],
    },

    # ─────────────────────────────────────────────────────────────────────────
    "dirigente": {
        "sections": [
            {
                "title": "1. Registrazione",
                "body": [
                    "Sei stato invitato come dirigente sportivo di {society_name}.",
                    "PASSI DA SEGUIRE:",
                    "• Apri il link di invito ricevuto dalla società",
                    "• 🔑 Inserisci il CODICE SOCIETÀ: <b>{society_invite_code}</b>",
                    "• Compila anagrafica + CF + email + password",
                    "• Attendi l'autorizzazione admin (NON riceverai email di convalida automatica)",
                    "Come dirigente hai accesso in SOLA LETTURA a: squadre, atleti, presenze, gare. "
                    "Solo le tue quietanze personali sono modificabili.",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Dopo l'abilitazione dell'admin, completa i dati per ricevere il compenso:",
                    "• Residenza (indirizzo, città, CAP)",
                    "• CF, luogo/data di nascita",
                    "• IBAN (obbligatorio se retribuito)",
                    "• Verifica contratto: date inizio/fine e compenso mensile",
                    "ACCETTAZIONE COMPENSO:",
                    "Dashboard → 'Compensi' → 'Accetta Compenso € XXX' → conferma per iniziare a firmare "
                    "quietanze.",
                ],
            },
            {
                "title": "3. Firma documenti GDPR e contratto",
                "body": [
                    "Firma digitale per:",
                    "• Informativa Privacy",
                    "• Contratto collaborazione sportiva Riforma Sport",
                    "• Consenso trattamento dati",
                    "Procedura identica al coach: 'Documenti da firmare' → leggi → firma → PDF disponibile subito.",
                ],
            },
            {
                "title": "4. Attività periodiche",
                "body": [
                    "OGNI MESE:",
                    "• Firma la quietanza mensile del compenso (Compensi → mese → Firma)",
                    "• Al superamento di €5.000/anno o €15.000/anno riceverai un promemoria per le "
                    "comunicazioni RAS (Registro Attività Sportive)",
                    "OGNI TANTO:",
                    "• Consulta la dashboard 'Squadre/Atleti/Gare' per rimanere aggiornato sull'attività "
                    "della società (solo lettura)",
                    "• Se noti errori o incongruenze, segnalali all'admin",
                ],
            },
        ],
    },

    # ─────────────────────────────────────────────────────────────────────────
    "collaboratore": {
        "sections": [
            {
                "title": "1. Registrazione",
                "body": [
                    "Sei stato invitato come collaboratore di {society_name} — questa figura può essere "
                    "custode/manutentore palestra, segretario, addetto marketing, ecc.",
                    "PASSI DA SEGUIRE:",
                    "• Apri il link di invito ricevuto dalla società",
                    "• 🔑 Inserisci il CODICE SOCIETÀ: <b>{society_invite_code}</b>",
                    "• Compila anagrafica + CF + email + password",
                    "• Attendi l'autorizzazione admin (NON riceverai email di convalida automatica)",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Dopo l'abilitazione dell'admin, completa i dati:",
                    "• Residenza, CF, data/luogo di nascita",
                    "• IBAN (se retribuito)",
                    "• Attività: descrivi brevemente il tipo di collaborazione (custode palestra X, ecc.)",
                    "• Verifica contratto: date e compenso",
                    "ACCETTAZIONE COMPENSO:",
                    "Dashboard → 'Compensi' → 'Accetta Compenso' → conferma.",
                ],
            },
            {
                "title": "3. Firma documenti GDPR e contratto",
                "body": [
                    "Firma digitale per:",
                    "• Informativa Privacy",
                    "• Contratto (Riforma Sport se retribuito, incarico volontario se non retribuito)",
                    "• Consenso trattamento dati",
                    "Procedura: Dashboard → 'Documenti da firmare' → firma → PDF disponibile.",
                ],
            },
            {
                "title": "4. Attività periodiche",
                "body": [
                    "OGNI MESE:",
                    "• Firma quietanza mensile del compenso",
                    "• Al superamento di €5.000/anno o €15.000/anno riceverai un promemoria per le "
                    "comunicazioni RAS (Registro Attività Sportive)",
                    "OGNI TANTO:",
                    "• Comunica all'admin variazioni di orari, disponibilità, o problemi operativi",
                    "• Consulta la dashboard per verificare che i dati siano corretti",
                ],
            },
        ],
    },

    # ─────────────────────────────────────────────────────────────────────────
    "admin": {
        "sections": [
            {
                "title": "1. Registrazione società",
                "body": [
                    "Come amministratore fondatore, sei tu che registri la società {society_name} su RegistraTEAM.",
                    "PASSI:",
                    "• Vai su app.registrateam.it → 'Registra Società'",
                    "• Compila: ragione sociale, CF/P.IVA, sede, PEC, IBAN società, email istituzionale",
                    "• Crea il tuo account admin (email + password personali)",
                    "• L'account è attivo subito, senza email di convalida",
                    "Dopo il primo login potrai personalizzare logo, colori, template email, impostazioni "
                    "GDPR e date della stagione sportiva.",
                ],
            },
            {
                "title": "2. Primo accesso e configurazione",
                "body": [
                    "🔑 IL TUO CODICE SOCIETÀ è <b>{society_invite_code}</b>. "
                    "Distribuiscilo a genitori, atleti, coach, dirigenti e collaboratori — sarà loro "
                    "richiesto al momento della registrazione. Se serve, dalla dashboard puoi rigenerarlo "
                    "in qualsiasi momento (Impostazioni → Rigenera codice invito).",
                    "COMPILA le IMPOSTAZIONI SOCIETÀ (dashboard admin → Impostazioni):",
                    "• Nome, indirizzo, contatti, logo società",
                    "• Date stagione (inizio/fine) — cruciali per il rollover annuale",
                    "• Ruoli attivi (coach, dirigenti, collaboratori) e loro compensi standard",
                    "• Categorie squadre (U12, U15, Serie D, ecc.)",
                    "• Palestre/campi con indirizzo e orari",
                    "• Configurazione GDPR: template privacy, consensi obbligatori, età minori",
                    "CREA LE PRIME SQUADRE:",
                    "• Dashboard → 'Squadre' → 'Aggiungi squadra' → nome, categoria, coach responsabile",
                    "• Assegna gli allenamenti settimanali (giorni, ore, palestra)",
                    "APRI LA STAGIONE:",
                    "• Vai su 'Nuova Stagione' → 'Passaggio Atomico' — apre la stagione e permette "
                    "l'iscrizione di nuovi atleti",
                ],
            },
            {
                "title": "3. Firma documenti GDPR",
                "body": [
                    "Come admin devi firmare (una tantum, per legge):",
                    "• Nomina Responsabile Trattamento Dati (se non nominato esternamente)",
                    "• Delega al sub-responsabile (RegistraTEAM stessa)",
                    "• Registro trattamenti (fornito precompilato dalla piattaforma)",
                    "Trovi tutto in: Impostazioni → GDPR → Documenti Società.",
                    "Assicurati che ogni utente (atleta, genitore, coach, ecc.) abbia firmato TUTTI i documenti "
                    "obbligatori prima di poter operare — la dashboard te lo segnala automaticamente.",
                ],
            },
            {
                "title": "4. Attività periodiche (amministratore)",
                "body": [
                    "AUTORIZZARE NUOVI UTENTI:",
                    "L'admin autorizza personalmente l'accesso di:",
                    "• Coach, Dirigenti, Collaboratori: dopo la registrazione restano in attesa fino a tua approvazione",
                    "• Atleti 18+ PRO (retribuiti): idem",
                    "Invece i seguenti si registrano LIBERAMENTE e iniziano subito il periodo di prova:",
                    "• Genitori di atleti minorenni",
                    "• Atleti 18+ QUOTA (che pagano la quota)",
                    "Per questi ultimi, sarà l'admin a indicare successivamente il gruppo/squadra su cui "
                    "faranno la prova.",
                    "OGNI GIORNO/SETTIMANA:",
                    "• Autorizza nuove iscrizioni Coach/Dirigenti/Collaboratori/Atleti PRO",
                    "• Assegna gruppo/squadra a nuovi atleti in prova (minori o adulti quota)",
                    "• Verifica pagamenti quote in arrivo (bonifici, carte)",
                    "• Rispondi a richieste utenti (link genitore-figlio, reset password, ecc.)",
                    "OGNI MESE:",
                    "• Genera quietanze compensi per coach/dirigenti/collaboratori/atleti PRO",
                    "• Verifica soglie RAS €5.000/€15.000 di ciascun retribuito",
                    "• Scarica report contabile mensile per commercialista",
                    "OGNI ANNO (giugno-settembre):",
                    "• Apri nuova stagione: 'Nuova Stagione' → 'Passaggio Atomico'",
                    "• Importa manualmente ogni atleta/coach/dirigente confermato",
                    "• Verifica i dati anagrafici aggiornati (CF, indirizzo, IBAN)",
                    "• Genera i nuovi contratti stagionali",
                    "MANUTENZIONE:",
                    "• Usa i bottoni 'Diagnostica' (Genitori, Atleti PRO, Quietanze) per identificare "
                    "anomalie e ripararle in un click",
                ],
            },
        ],
    },
    "coordinatore": {
        "welcome": "Ciao! Sei stato/a designato/a **Coordinatore** dalla tua società. "
                   "Questo è un ruolo intermedio tra Admin e Dirigente: gestisci le attività "
                   "organizzative (squadre, atleti, presenze, eventi, comunicazioni) che ti sono state "
                   "abilitate dal Main Admin, ma **non hai accesso alle sezioni amministrative** "
                   "(pagamenti, compensi, IBAN, fatture, sponsor, bilanci).",
        "sections": [
            {
                "title": "COSA VEDI NELLA TUA DASHBOARD",
                "items": [
                    "• La tua dashboard mostra SOLO le sezioni che il Main Admin ha attivato per te",
                    "• Se una sezione non compare, chiedi al Main Admin di abilitarla via 'Impostazioni → Coordinatori'",
                    "• Se non vedi ancora nessuna sezione: il Main Admin non ha ancora completato la tua configurazione",
                ],
            },
            {
                "title": "SEZIONI POSSIBILI",
                "items": [
                    "• **Squadre e roster**: elenco squadre e atleti assegnati",
                    "• **Atleti (anagrafica)**: gestione anagrafica atleti",
                    "• **Allenamenti**: calendario settimanale",
                    "• **Convocazioni e partite**: gestione gare",
                    "• **Presenze e QR**: scanner QR e storico presenze",
                    "• **Comunicazioni**: broadcast a genitori/atleti/coach",
                    "• **Eventi in programma**: campagne di pre-iscrizione e Open Day",
                    "• **Certificati medici**: monitoraggio scadenze",
                    "• **GDPR (lettura)**: consultazione documenti firmati",
                ],
            },
            {
                "title": "LIMITI DI RUOLO",
                "items": [
                    "• NON puoi vedere: compensi, ricevute, IBAN, soglie Riforma Sport",
                    "• NON puoi vedere: sponsor, contratti, fatture",
                    "• NON puoi gestire: password amministratore, primary admin, backup",
                    "• Per queste operazioni contatta il Main Admin",
                ],
            },
        ],
    },
}


def build_faq_for_role(role: str) -> list:
    """FAQ comune + eventuale FAQ specifica per ruolo."""
    return list(COMMON_FAQ)
