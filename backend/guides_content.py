"""
📖 10/07/2026 (v7.15) — Contenuti dei manuali/prontuari RegistraTEAM.

Un dict per ogni ruolo (admin, coach, dirigente, collaboratore, parent, athlete).
I placeholder `{society_name}`, `{society_email}`, `{society_phone}` vengono
sostituiti al momento della generazione con i dati della società attiva.

Struttura standard (5 sezioni):
  1. Registrazione
  2. Primo accesso
  3. Firma documenti GDPR
  4. Attività periodiche
  5. FAQ e contatti
"""

# Metadati per ogni guida (titolo, breve descrizione, colore accent)
GUIDES_META = {
    "admin": {
        "role_label": "Amministratore",
        "accent_color": "#1976D2",
        "icon": "🛡️",
        "audience": "responsabili della società",
    },
    "coach": {
        "role_label": "Coach / Allenatore",
        "accent_color": "#E53935",
        "icon": "🏐",
        "audience": "allenatori delle squadre",
    },
    "dirigente": {
        "role_label": "Dirigente Sportivo",
        "accent_color": "#7B1FA2",
        "icon": "🎖️",
        "audience": "dirigenti retribuiti",
    },
    "collaboratore": {
        "role_label": "Collaboratore",
        "accent_color": "#00838F",
        "icon": "🧰",
        "audience": "collaboratori (custodi, segreteria, ecc.)",
    },
    "parent": {
        "role_label": "Genitore",
        "accent_color": "#43A047",
        "icon": "👨‍👩‍👧",
        "audience": "genitori di atleti minorenni",
    },
    "athlete": {
        "role_label": "Atleta maggiorenne (18+)",
        "accent_color": "#F57C00",
        "icon": "🏆",
        "audience": "atleti che hanno compiuto 18 anni",
    },
}


# ─── SEZIONE COMUNE FAQ (riusata da tutti) ───
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
                    "Sei stato invitato dalla società {society_name} a registrarti come genitore/tutore "
                    "del/dei tuo/tuoi figlio/figli iscritti.",
                    "PASSI DA SEGUIRE:",
                    "• Apri il link ricevuto via email/WhatsApp dalla società oppure vai su app.registrateam.it",
                    "• Clicca su 'Registrati' → seleziona il ruolo 'Genitore'",
                    "• Inserisci: nome, cognome, codice fiscale, email, telefono, password",
                    "• Accetta i consensi di trattamento dati (obbligatorio)",
                    "• Conferma la registrazione — ti arriverà un'email di verifica",
                    "IMPORTANTE: usa un'email a cui accedi frequentemente. Riceverai lì tutte le comunicazioni "
                    "della società (approvazioni, quote, documenti da firmare).",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Al primo login ti verrà chiesto di:",
                    "• Confermare/completare i tuoi dati anagrafici (indirizzo, città, CAP)",
                    "• Inserire il tuo IBAN se prevedi pagamenti tramite bonifico",
                    "COLLEGARE IL/I FIGLIO/I:",
                    "• Dalla dashboard genitore, clicca su 'Collega Atleta'",
                    "• Cerca il/la figlio/a per nome e cognome o CF",
                    "• Se non lo trovi, significa che la società non l'ha ancora anagrafato — contatta "
                    "l'amministratore",
                    "• L'admin dovrà approvare il collegamento (riceverai email di conferma)",
                    "Se sei il SECONDO genitore, l'admin ti collegherà manualmente al figlio già registrato "
                    "dall'altro genitore.",
                ],
            },
            {
                "title": "3. Firma documenti GDPR e Privacy",
                "body": [
                    "Per ogni figlio minorenne collegato, dovrai firmare digitalmente:",
                    "• Informativa Privacy (obbligatoria)",
                    "• Consenso al trattamento dati sanitari",
                    "• Dichiarazione periodo di prova (se prevista dalla società)",
                    "• Autorizzazioni foto/video (opzionali)",
                    "COME FIRMARE:",
                    "• Vai su 'Documenti' dalla dashboard",
                    "• Clicca sul documento in stato 'Da firmare'",
                    "• Leggi il testo, spunta le voci obbligatorie, poi firma nel riquadro con dito o mouse",
                    "• Il PDF firmato viene generato automaticamente — lo trovi nella sezione 'Documenti firmati'",
                    "IMPORTANTE: la firma è vincolante come una firma cartacea. Se il figlio è già maggiorenne, "
                    "sarà lui/lei a firmare autonomamente (non tu).",
                ],
            },
            {
                "title": "4. Attività periodiche",
                "body": [
                    "COSA FARE OGNI TANTO (mensile o quando serve):",
                    "• PAGAMENTI: quando la società emette una quota (iscrizione, mensilità), riceverai una "
                    "notifica. Vai su 'Pagamenti' → clicca sull'importo → paga con bonifico o carta.",
                    "• CERTIFICATO MEDICO: quando quello di tuo figlio sta per scadere, riceverai un promemoria. "
                    "Carica il nuovo certificato in PDF da 'Documenti' → 'Carica certificato'.",
                    "• COMUNICAZIONI: leggi periodicamente la sezione 'Da fare' della dashboard — lì trovi tutte "
                    "le richieste in sospeso della società.",
                    "SE HAI PIÙ FIGLI: dalla dashboard puoi passare da un figlio all'altro con il selettore in "
                    "alto — così vedi separatamente pagamenti, documenti, allenamenti di ciascuno.",
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
                    "Sei stato invitato dalla società {society_name} a registrarti come atleta maggiorenne.",
                    "PASSI DA SEGUIRE:",
                    "• Vai su app.registrateam.it → clicca 'Registrati'",
                    "• Seleziona il ruolo 'Atleta'",
                    "• Compila: nome, cognome, codice fiscale, data di nascita, email, telefono, password",
                    "• Accetta i consensi (obbligatori)",
                    "• Conferma via email — riceverai un link di attivazione",
                    "Se sei un atleta PRO (retribuito), l'admin ti abiliterà come 'compensated' dopo la registrazione — "
                    "vedrai apparire la sezione 'Compensi Sportivi' nella dashboard.",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Al primo login completa:",
                    "• DATI ANAGRAFICI: indirizzo, città, CAP, luogo di nascita",
                    "• DATI FISCALI: codice fiscale (per Riforma Sport, se retribuito)",
                    "• IBAN: solo se sei retribuito (Atleta PRO). Serve per ricevere i compensi.",
                    "• DATI SANITARI: carica il certificato di idoneità sportiva agonistica in PDF",
                    "SEZIONE COACH (se sei anche allenatore):",
                    "Se la società ti ha abilitato come atleta+coach (dual-role), vedrai il pulsante arancione "
                    "'Passa a Modalità Coach' in alto — usalo per gestire l'altro ruolo senza fare logout.",
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
                    "• Apri il link di invito ricevuto via email",
                    "• Compila i dati: nome, cognome, CF, data e luogo di nascita, email, telefono, password",
                    "• Accetta i consensi obbligatori",
                    "• Conferma via email — l'admin approverà il tuo account e ti abiliterà",
                    "Una volta approvato, riceverai una seconda email con il link per il primo accesso.",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Completa i tuoi dati per essere operativo:",
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
                    "• Al superamento di €5.000/anno il sistema genera automaticamente la Comunicazione RAS",
                    "• Al superamento di €15.000/anno stessa cosa per la comunicazione superiore",
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
                    "Passi identici al coach: link di invito → compila anagrafica + CF + email + password → "
                    "conferma via email → attendi approvazione admin.",
                    "Come dirigente hai accesso a: visualizzazione di squadre, atleti, presenze, gare — MA "
                    "NON puoi modificare (solo lettura), tranne le tue quietanze personali.",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Completa i dati per ricevere il compenso:",
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
                    "• Verifica soglie €5.000/€15.000 → firma comunicazioni RAS quando appaiono",
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
                    "Passi: link email → anagrafica + CF + email + password → conferma → attesa approvazione admin.",
                ],
            },
            {
                "title": "2. Primo accesso",
                "body": [
                    "Completa i dati:",
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
                    "• Verifica eventuale superamento soglie RAS",
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
                    "• Ricevi email di conferma → attiva l'account",
                    "Dopo la conferma potrai personalizzare il logo, i colori, i template email, le impostazioni "
                    "GDPR e le date della stagione sportiva.",
                ],
            },
            {
                "title": "2. Primo accesso e configurazione",
                "body": [
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
                    "OGNI GIORNO/SETTIMANA:",
                    "• Approva nuove iscrizioni (dashboard → 'Atleti in attesa di approvazione')",
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
