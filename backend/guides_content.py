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
    "athlete": {"role_label": "Atleta maggiorenne (18+)", "accent_color": "#F57C00", "icon": "🏆",
                "audience": "atleti che hanno compiuto 18 anni"},
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
    "athlete": {
        "sections": [
            {
                "title": "1. Registrazione",
                "body": [
                    "Sei un atleta maggiorenne di {society_name}.",
                    "PASSI DA SEGUIRE:",
                    "• Vai su app.registrateam.it → 'Registrati' → 'Atleta'",
                    "• 🔑 Inserisci il CODICE SOCIETÀ: <b>{society_invite_code}</b>",
                    "• Compila: nome, cognome, codice fiscale, data di nascita, email, telefono, password",
                    "• Accetta i consensi obbligatori",
                    "SE SEI ATLETA QUOTA (paghi la quota di iscrizione):",
                    "• Registrazione LIBERA — l'account è attivo subito, senza email di convalida",
                    "• Farai un periodo di prova nella squadra assegnata dall'admin",
                    "SE SEI ATLETA PRO (retribuito Riforma Sport):",
                    "• L'account resterà in attesa di autorizzazione dell'admin della società",
                    "• L'admin ti abiliterà come 'compensated' — solo allora potrai accedere alle "
                    "sezioni compensi e firmare le quietanze",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Al primo login completa:",
                    "• DATI ANAGRAFICI: indirizzo, città, CAP, luogo di nascita",
                    "• DATI FISCALI: codice fiscale",
                    "• IBAN: SOLO se sei atleta PRO retribuito (per ricevere i compensi). "
                    "Se sei atleta quota che paga, NON serve.",
                    "• DATI SANITARI: carica il certificato di idoneità sportiva agonistica in PDF",
                    "SEZIONE COACH (se sei anche allenatore):",
                    "Se la società ti ha abilitato come atleta+coach (dual-role), vedrai il pulsante "
                    "arancione 'Passa a Modalità Coach' in alto — usalo per gestire l'altro ruolo "
                    "senza fare logout.",
                ],
            },
            {
                "title": "3. Firma documenti GDPR e Privacy",
                "body": [
                    "Dovrai firmare digitalmente:",
                    "• Informativa Privacy (obbligatoria)",
                    "• Consenso al trattamento dati sanitari",
                    "• Dichiarazione periodo di prova (se richiesto dalla società)",
                    "• Se sei retribuito: contratto di collaborazione sportiva Riforma Sport",
                    "COME FIRMARE:",
                    "• Dashboard → 'Documenti' → clicca sul documento in stato 'Da firmare'",
                    "• Leggi tutto, spunta le voci obbligatorie, firma nel riquadro",
                    "• Il PDF firmato è disponibile subito in 'Documenti firmati'",
                    "IMPORTANTE: da maggiorenne firmi TU direttamente, non il genitore.",
                ],
            },
            {
                "title": "4. Attività periodiche",
                "body": [
                    "SE SEI ATLETA QUOTA (non retribuito):",
                    "• Paghi la quota di iscrizione/mensilità: dashboard → 'Pagamenti'",
                    "• Aggiorni il certificato medico ogni anno (scadenza indicata)",
                    "• Leggi periodicamente 'Da fare' per richieste della società",
                    "SE SEI ATLETA PRO (retribuito):",
                    "• Ricevi mensilmente le quietanze di compenso (Riforma Sport)",
                    "• Vai su 'Compensi Sportivi' → clicca sul mese → 'Firma quietanza'",
                    "• Al superamento di €5.000/anno o €15.000/anno riceverai un promemoria per le "
                    "comunicazioni RAS (Registro Attività Sportive)",
                    "• Puoi scaricare in qualsiasi momento tutte le tue quietanze firmate in PDF",
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
}


def build_faq_for_role(role: str) -> list:
    """FAQ comune + eventuale FAQ specifica per ruolo."""
    return list(COMMON_FAQ)
