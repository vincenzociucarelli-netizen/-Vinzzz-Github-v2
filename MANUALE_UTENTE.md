# 🏐 PALLAVOLO PERUGIA SSD
## Manuale Utente Completo

---

# 📑 INDICE

1. [INTRODUZIONE](#introduzione)
2. [ACCESSO ALL'APP](#accesso-allapp)
3. [AREA DIRIGENTE / ADMIN](#area-dirigente--admin)
4. [AREA COACH / ALLENATORE](#area-coach--allenatore)
5. [AREA GENITORE](#area-genitore)

---

# INTRODUZIONE

L'app **Pallavolo Perugia SSD** è una piattaforma completa per la gestione di una società sportiva di pallavolo. Permette di gestire atleti, squadre, pagamenti, presenze, certificati medici e calendario gare.

### Figure Utente
- **Dirigente/Admin**: Gestione completa della società
- **Coach/Allenatore**: Gestione presenze e visualizzazione squadre
- **Genitore**: Gestione figli atleti, pagamenti e calendario

---

# ACCESSO ALL'APP

## Schermata di Login

All'apertura dell'app viene mostrata la schermata di login con:
- **Logo della società** (personalizzabile dall'admin)
- **Nome della società**
- **Campo Email**: inserire l'email di registrazione
- **Campo Password**: inserire la password
- **Pulsante "Accedi"**: per effettuare il login
- **Link "Password dimenticata?"**: per recuperare la password
- **Link "Non hai un account? Registrati"**: per nuove registrazioni

## Registrazione Nuovo Utente

### Passaggio 1: Dati Account
- **Email**: indirizzo email valido
- **Password**: minimo 6 caratteri
- **Conferma Password**: ripetere la password

### Passaggio 2: Selezione Ruolo
- **Genitore**: per i genitori degli atleti
- **Coach**: per gli allenatori (richiede approvazione admin)

### Passaggio 3: Dati Personali
- **Nome e Cognome**
- **Telefono**
- **Codice Invito**: codice fornito dalla società per la registrazione

### Nota
Le registrazioni dei Coach richiedono l'approvazione da parte dell'Admin prima di poter accedere all'app.

## Recupero Password

1. Cliccare su "Password dimenticata?"
2. Inserire l'email di registrazione
3. Riceverai un'email con il link per reimpostare la password
4. Cliccare sul link e inserire la nuova password

---

# AREA DIRIGENTE / ADMIN

## 🏠 Dashboard Principale

La dashboard dell'Admin presenta una panoramica completa della società:

### Sezione Statistiche
- **Atleti Attivi**: numero totale di atleti con status "attivo"
- **Atleti in Prova**: numero di atleti con status "in prova"
- **Atleti Ritirati**: numero di atleti con status "ritirato"
- **Totale Squadre**: numero di squadre create

### Sezione Notifiche e Avvisi

#### 🔔 Richieste Pendenti
- Nuovi utenti in attesa di approvazione
- Richieste di registrazione atleti
- Richieste di eliminazione atleti
- Cliccare per visualizzare i dettagli e approvare/rifiutare

#### 🎂 Compleanni del Giorno
- Lista degli atleti che compiono gli anni oggi
- Nome, cognome e età

#### ⚠️ Certificati in Scadenza
- Lista dei certificati medici in scadenza nei prossimi 30 giorni
- Nome atleta, data scadenza, giorni rimanenti
- Codice colore: giallo (in scadenza), rosso (scaduto)

### Menu Navigazione
Dalla dashboard è possibile accedere a tutte le sezioni tramite il menu inferiore o le card di accesso rapido:
- 👥 Atleti
- 🏃 Squadre
- 👨‍🏫 Coach
- 👔 Dirigenti
- 👨‍👩‍👧 Genitori
- 🏐 Calendario Gare
- 📊 Presenze
- ⚙️ Impostazioni

---

## 👥 GESTIONE ATLETI

### Lista Atleti

#### Visualizzazione
- Lista completa di tutti gli atleti registrati
- Ogni card atleta mostra:
  - Foto profilo (se presente)
  - Nome e Cognome
  - Squadra di appartenenza
  - Status (attivo/in prova/ritirato)
  - Indicatore certificato medico

#### Ricerca e Filtri
- **Barra di ricerca**: cerca per nome, cognome o squadra
- **Filtro per squadra**: visualizza solo atleti di una squadra specifica
- **Filtro per status**: attivi, in prova, ritirati

#### Azioni
- **Tap sulla card**: apre il dettaglio atleta
- **Pulsante esporta**: esporta lista in formato Excel/CSV

### Dettaglio Atleta

#### Tab "Dati Anagrafici"

##### Informazioni Personali
- **Foto**: visualizzazione/modifica foto atleta
- **Nome e Cognome**
- **Data di Nascita**
- **Luogo di Nascita**
- **Codice Fiscale**
- **Indirizzo di Residenza**
- **Telefono**
- **Email**

##### Informazioni Sportive
- **Squadra**: squadra di appartenenza (modificabile)
- **Ruolo**: ruolo in campo (palleggiatore, schiacciatore, ecc.)
- **Numero Maglia**
- **Status**: attivo / in prova / ritirato
- **Data Iscrizione**
- **Note**: campo libero per annotazioni

##### Dati Genitore Pagante
- **Nome e Cognome Genitore**
- **Codice Fiscale Genitore**
- **Relazione**: padre/madre/tutore

##### Azioni
- **Pulsante Modifica** (icona matita): abilita la modifica dei campi
- **Pulsante Salva**: salva le modifiche
- **Pulsante Ritira Atleta**: apre il modal per il ritiro
- **Pulsante Riattiva** (solo per atleti ritirati): riattiva l'atleta

#### Tab "Pagamenti"

##### Riepilogo Pagamenti
- **Quota Stagionale**: importo totale dovuto per la stagione
- **Sconto Applicato**: eventuale sconto (es. fratelli)
- **Totale Pagato**: somma dei pagamenti effettuati
- **Residuo Dovuto**: importo ancora da pagare

##### Lista Rate
Per ogni rata viene mostrato:
- **Descrizione**: Rata Iscrizione, 1ª Rata, 2ª Rata, ecc.
- **Importo**: cifra della rata
- **Scadenza**: data entro cui effettuare il pagamento
- **Status**:
  - ✅ Pagata (verde): pagamento registrato
  - 🔴 Scaduta (rosso): scadenza superata, non pagata
  - ⏳ Da pagare (grigio): non ancora scaduta

##### Aggiungere un Pagamento
1. Cliccare sul pulsante "+" o "Aggiungi Pagamento"
2. Compilare il form:
   - **Importo**: cifra pagata
   - **Data Pagamento**: quando è stato effettuato
   - **Metodo**: contanti, bonifico, carta
   - **Descrizione**: nota opzionale
3. Cliccare "Salva"

##### Modificare/Eliminare un Pagamento
- **Tap sulla rata**: apre il modal di modifica
- **Pulsante cestino**: elimina il pagamento (con conferma)

#### Tab "Presenze"

##### Statistiche
- **Percentuale Presenze Mensile**: % di presenze nell'ultimo mese
- **Percentuale Presenze Stagionale**: % di presenze totali
- **Totale Allenamenti**: numero di sessioni registrate
- **Presenze**: numero di volte presente
- **Assenze**: numero di volte assente

##### Grafico
- Grafico a barre che mostra l'andamento delle presenze nel tempo

##### Storico
- Lista cronologica di tutte le sessioni con indicazione presenza/assenza

### Certificato Medico

#### Visualizzazione
- **Status**: Valido / In Scadenza / Scaduto
- **Data Scadenza**: data di scadenza del certificato
- **Giorni Rimanenti**: countdown alla scadenza
- **Anteprima**: miniatura del documento caricato

#### Caricare un Certificato
1. Cliccare su "Carica Certificato" o sull'area di upload
2. Selezionare il file (PDF o immagine)
3. Inserire la data di scadenza
4. Cliccare "Salva"

#### Azioni sul Certificato
- **Visualizza**: apre il documento a schermo intero
- **Scarica**: scarica il file sul dispositivo
- **Sostituisci**: carica un nuovo certificato
- **Elimina**: rimuove il certificato (con conferma)

---

## 🏃 GESTIONE SQUADRE

### Lista Squadre

#### Visualizzazione
Ogni card squadra mostra:
- **Nome Squadra**: es. "Under 14 Maschile"
- **Categoria**: categoria di appartenenza
- **Numero Atleti**: conteggio atleti assegnati
- **Coach Assegnati**: nomi dei coach

#### Azioni
- **Pulsante "+"**: crea nuova squadra
- **Tap sulla card**: apre il dettaglio squadra

### Creazione Nuova Squadra

#### Passaggio 1: Informazioni Base
- **Nome Squadra**: nome identificativo (obbligatorio)
- **Categoria**: Under 12, Under 14, Under 16, Under 18, Serie, ecc.
- **Descrizione**: nota opzionale

#### Passaggio 2: Assegnazione Staff
- **Coach**: seleziona uno o più allenatori
- **Dirigente**: seleziona il dirigente responsabile

#### Passaggio 3: Orari Allenamento
Per ogni giorno di allenamento:
- **Giorno**: Lunedì, Martedì, ecc.
- **Ora Inizio**: orario inizio allenamento
- **Ora Fine**: orario fine allenamento
- **Palestra**: nome della struttura
- **Indirizzo**: indirizzo completo

Cliccare "Aggiungi Giorno" per aggiungere più giorni di allenamento.

#### Passaggio 4: Gare in Casa
- **Giorno Gara**: giorno tipico delle gare casalinghe
- **Ora**: orario tipico di inizio gara
- **Palestra**: struttura per le gare in casa
- **Indirizzo**: indirizzo della palestra

#### Passaggio 5: Impostazioni Pagamenti
- **Quota Stagionale**: importo totale per la stagione
- **Numero Rate**: in quante rate suddividere (es. 3)
- **Date Scadenza Rate**: configurare le date di scadenza per ogni rata
- **Sconto Fratelli**: percentuale di sconto per fratelli/sorelle

### Dettaglio Squadra

#### Sezione Informazioni
- Tutti i dati inseriti in fase di creazione (modificabili)

#### Sezione Atleti
- Lista degli atleti assegnati alla squadra
- Possibilità di aggiungere/rimuovere atleti

#### Sezione Presenze Squadra
- Accesso rapido al registro presenze della squadra
- Statistiche di partecipazione del gruppo

---

## 👨‍🏫 GESTIONE COACH

### Lista Coach

#### Visualizzazione
Ogni card coach mostra:
- **Foto Profilo**
- **Nome e Cognome**
- **Email**
- **Telefono**
- **Squadre Assegnate**: elenco squadre

#### Azioni
- **Tap sulla card**: apre il dettaglio coach

### Dettaglio Coach

#### Informazioni Personali
- **Foto Profilo**: visualizzazione/modifica
- **Nome e Cognome**
- **Email**
- **Telefono**
- **Data Registrazione**

#### Squadre Assegnate
- Lista delle squadre di cui è allenatore
- Possibilità di aggiungere/rimuovere squadre

#### Azioni
- **Modifica**: abilita la modifica dei dati
- **Rimuovi Coach**: disattiva l'account (con conferma)

---

## 👔 GESTIONE DIRIGENTI

### Lista Dirigenti

#### Visualizzazione
- Lista dei dirigenti della società
- Nome, email, telefono
- Squadre di competenza

#### Azioni
- **Aggiungi Dirigente**: crea nuovo account dirigente
- **Tap sulla card**: dettaglio dirigente

### Dettaglio Dirigente

#### Informazioni
- Dati anagrafici completi
- Squadre assegnate
- Ruolo nella società

#### Azioni
- **Modifica dati**
- **Assegna/rimuovi squadre**
- **Disattiva account**

---

## 👨‍👩‍👧 GESTIONE GENITORI

### Lista Genitori

#### Visualizzazione
Per ogni genitore:
- **Nome e Cognome**
- **Email**
- **Telefono**
- **Figli**: lista degli atleti collegati

#### Ricerca
- Cerca per nome genitore o nome figlio

#### Azioni
- **Tap sulla card**: visualizza dettaglio e figli
- **Chiama**: avvia chiamata telefonica
- **Messaggio**: apri app messaggi

---

## 🏐 CALENDARIO GARE

### Visualizzazione Calendario

#### Organizzazione
- Le gare sono raggruppate per **mese**
- Ogni mese mostra l'elenco delle partite in ordine cronologico

#### Card Gara
Ogni gara mostra:
- **Badge Casa/Trasferta**: 🏠 Casa (azzurro) o ✈️ Trasferta (arancione)
- **Nome Squadra**: la tua squadra
- **Avversario**: "vs [Nome Avversario]"
- **Data e Ora**: in **rosso e grassetto** per evidenziare
- **Luogo**: nome della palestra
- **Indirizzo**: indirizzo completo (se disponibile)
- **Orario Ritrovo**: se impostato
- **Note**: eventuali annotazioni

#### Azioni sulle Gare
- **Tap sulla card**: apre il modal di modifica
- **Icona cestino 🗑️**: elimina la gara (con conferma)

### Aggiungere una Gara Manualmente

1. Cliccare sul pulsante **"+"** in alto a destra
2. Compilare il form:
   - **Squadra**: selezionare dal menu a tendina (obbligatorio)
   - **Data**: formato gg/mm/aaaa (obbligatorio)
   - **Ora**: formato HH:mm
   - **Avversario**: nome squadra avversaria (obbligatorio)
   - **Luogo**: nome palestra/campo
   - **Indirizzo**: indirizzo completo
   - **Città**: città della gara
   - **Casa/Trasferta**: selezionare 🏠 Casa o ✈️ Trasferta
   - **Orario Ritrovo**: es. "1 ora prima"
   - **Note**: campo libero
3. Cliccare **"Aggiungi Gara"**

### Importare Gare da Excel

#### Formato File Richiesto
Il file Excel deve contenere le seguenti colonne (nomi esatti):
- **CampionatoNome**: nome del campionato/categoria
- **GaraDataOra**: data e ora della gara
- **SquadraCasaNome**: nome della squadra di casa
- **SquadraOspiteNome**: nome della squadra ospite
- **Impianto**: nome della palestra
- **ImpiantoIndirizzo**: indirizzo completo

#### Procedura di Import

1. Cliccare sull'icona **cloud/upload** in alto a destra
2. Selezionare il file Excel (.xlsx o .xls)
3. **Modal "Identifica Gare in Casa"**:
   - Inserire il nome (o parte del nome) della propria squadra
   - Esempio: "Pallavolo Perugia" o "Perugia"
   - Questo serve per identificare automaticamente quali gare sono in casa e quali in trasferta
4. Cliccare **"Importa Gare"**
5. Attendere il completamento
6. Verrà mostrato un riepilogo:
   - Numero gare importate
   - Quante in casa 🏠
   - Quante in trasferta ✈️
   - Eventuali errori

#### Note sull'Import
- Le squadre nel file Excel devono corrispondere (anche parzialmente) ai nomi delle squadre create nel sistema
- Se una squadra non viene trovata, la gara non verrà importata
- L'avversario viene determinato automaticamente in base a casa/trasferta

### Modificare una Gara

1. Tap sulla card della gara
2. Modificare i campi desiderati
3. Cliccare **"Salva Modifiche"**

### Eliminare una Gara

1. Tap sull'icona **cestino 🗑️** nella card della gara
2. Confermare l'eliminazione nel popup

---

## 📊 GESTIONE PRESENZE

### Panoramica Presenze

#### Visualizzazione per Squadra
- Selezionare la squadra dal menu
- Visualizzare le sessioni di allenamento
- Statistiche di partecipazione del gruppo

#### Sessioni di Allenamento
Per ogni sessione:
- **Data e Ora**
- **Numero Presenti**: X/Y atleti
- **Status**: aperta/chiusa
- **Coach**: chi ha registrato le presenze

### Aprire una Sessione

L'apertura sessione viene tipicamente fatta dal Coach (vedi sezione Coach).

### Visualizzare Dettaglio Sessione

1. Tap sulla sessione
2. Visualizzare:
   - Lista completa atleti
   - Chi era presente ✅
   - Chi era assente ❌
   - Orario di registrazione

---

## ⚙️ IMPOSTAZIONI SOCIETÀ

### Informazioni Società

#### Logo
- **Visualizza**: logo attuale della società
- **Modifica**: tap per caricare nuovo logo
- Formati supportati: PNG, JPG
- Il logo appare nella schermata di login

#### Nome Società
- Nome visualizzato in tutta l'app
- Modificabile in qualsiasi momento

### Codice Invito

#### Cos'è
Il codice invito è un codice univoco che i nuovi utenti devono inserire durante la registrazione per potersi iscrivere alla società.

#### Gestione
- **Visualizza Codice**: mostra il codice attuale
- **Copia**: copia negli appunti per condividerlo
- **Rigenera**: crea un nuovo codice (invalida il precedente)

#### Uso
Condividere il codice con:
- Genitori dei nuovi atleti
- Nuovi coach
- Staff della società

### Gestione Stagioni

#### Stagione Corrente
- Visualizzazione stagione attiva (es. "2024/2025")
- Data inizio e fine stagione

#### Archivio Stagioni
- Lista stagioni precedenti
- Possibilità di consultare dati storici

#### Nuova Stagione
1. Cliccare "Nuova Stagione"
2. Inserire:
   - Nome stagione (es. "2025/2026")
   - Data inizio
   - Data fine
3. Opzioni:
   - Archivia atleti della stagione precedente
   - Mantieni squadre e configurazioni

---

## 🔔 NOTIFICHE

### Centro Notifiche

Accessibile tramite l'icona campanella nella dashboard.

#### Tipi di Notifiche
- **Nuove Registrazioni**: utenti in attesa di approvazione
- **Richieste Atleti**: nuovi atleti da approvare
- **Certificati**: avvisi scadenza certificati medici
- **Pagamenti**: rate in scadenza o scadute
- **Sistema**: comunicazioni tecniche

#### Azioni
- **Tap sulla notifica**: apri dettaglio
- **Approva/Rifiuta**: per richieste pendenti
- **Segna come letta**: archivia la notifica
- **Elimina**: rimuovi la notifica

---

## 👤 PROFILO ADMIN

### Visualizzazione
- **Foto Profilo**
- **Nome e Cognome**
- **Email**
- **Ruolo**: Amministratore

### Azioni
- **Modifica Profilo**: cambia foto e dati
- **Cambia Password**: aggiorna la password
- **Logout**: esci dall'account

---
---

# AREA COACH / ALLENATORE

## 🏠 Dashboard Coach

### Panoramica

La dashboard del Coach mostra:

#### Le Mie Squadre
- Card per ogni squadra assegnata
- Nome squadra e categoria
- Numero atleti
- Tap per accedere ai dettagli

#### Prossimi Impegni
Lista dei prossimi eventi (allenamenti e gare):
- **Icona evento**: 🏋️ allenamento o 🏐 gara
- **Data e Ora**
- **Squadra**
- **Luogo**
- Per le gare: indicazione Casa/Trasferta

### Menu Navigazione
- 🏠 Dashboard
- 📋 Presenze
- 📅 Storico
- 👤 Profilo

---

## 📋 GESTIONE PRESENZE

### Aprire una Sessione di Allenamento

#### Passaggio 1: Selezione Squadra
1. Dalla dashboard, tap su "Registra Presenze" o sulla squadra
2. Se hai più squadre, seleziona quella desiderata

#### Passaggio 2: Apertura Sessione
1. Tap su **"Apri Sessione"** o **"Nuovo Allenamento"**
2. Viene generato automaticamente:
   - Data e ora corrente
   - QR Code per la registrazione (se abilitato)

#### Passaggio 3: Registrazione Presenze

##### Metodo Manuale
1. Viene mostrata la lista di tutti gli atleti della squadra
2. Per ogni atleta:
   - **Tap sul nome**: alterna presente/assente
   - **✅ Verde**: presente
   - **❌ Rosso**: assente
3. Di default tutti sono segnati come assenti

##### Metodo QR Code (se abilitato)
1. Mostrare il QR Code agli atleti
2. Gli atleti scansionano con il loro telefono
3. La presenza viene registrata automaticamente

#### Passaggio 4: Chiusura Sessione
1. Verificare che tutte le presenze siano corrette
2. Tap su **"Chiudi Sessione"**
3. Confermare nel popup
4. La sessione viene salvata e non più modificabile

### Visualizzare Storico Presenze

#### Accesso
- Menu → Storico
- Oppure dalla dashboard → "Storico Presenze"

#### Filtri
- **Per Squadra**: seleziona la squadra
- **Per Periodo**: ultimo mese, ultimi 3 mesi, stagione completa
- **Per Data**: seleziona intervallo specifico

#### Informazioni Mostrate
Per ogni sessione:
- Data e ora
- Squadra
- Numero presenti/totale
- Tap per vedere dettaglio

---

## 👥 VISUALIZZAZIONE SQUADRA

### Lista Atleti

Per ogni atleta della squadra:
- **Foto** (se presente)
- **Nome e Cognome**
- **Numero Maglia**
- **Ruolo**
- **Statistiche Presenze**: % partecipazione

### Dettaglio Atleta

Tap su un atleta per vedere:
- **Dati Anagrafici** (solo visualizzazione)
- **Contatti Genitori**: per comunicazioni urgenti
- **Statistiche Presenze Dettagliate**
- **Certificato Medico**: status e scadenza

### Contattare i Genitori

1. Tap sull'atleta
2. Nella sezione contatti:
   - **Icona telefono**: avvia chiamata
   - **Icona messaggio**: apri SMS/WhatsApp

---

## 📅 CALENDARIO IMPEGNI

### Visualizzazione

Il calendario mostra tutti gli impegni delle squadre assegnate:

#### Allenamenti
- **Icona**: 🏋️
- **Giorno e Ora**
- **Palestra**
- Indicazione se è il giorno corrente

#### Gare
- **Icona**: 🏐
- **Data e Ora** (in evidenza)
- **Avversario**
- **🏠 Casa** o **✈️ Trasferta**
- **Luogo e Indirizzo**

### Filtri
- **Tutte le squadre**: visualizza tutto
- **Squadra specifica**: solo eventi di quella squadra
- **Solo gare**: nascondi allenamenti
- **Solo allenamenti**: nascondi gare

---

## 👤 PROFILO COACH

### Visualizzazione Profilo

- **Foto Profilo**: tap per ingrandire o modificare
- **Nome e Cognome**
- **Email**
- **Telefono**
- **Squadre Assegnate**: elenco completo

### Modifica Profilo

1. Tap su **"Modifica"** o icona matita
2. Campi modificabili:
   - Foto profilo
   - Telefono
3. Tap su **"Salva"**

### Cambio Password

1. Tap su **"Cambia Password"**
2. Inserire:
   - Password attuale
   - Nuova password
   - Conferma nuova password
3. Tap su **"Conferma"**

### Logout

1. Tap su **"Esci"** o **"Logout"**
2. Confermare nel popup
3. Verrai riportato alla schermata di login

---
---

# AREA GENITORE

## 🏠 Dashboard Genitore

### Panoramica

La dashboard del genitore mostra:

#### I Miei Figli (Card Atleti)

Per ogni figlio registrato viene mostrata una card con:
- **Foto Atleta** (se presente)
- **Nome e Cognome**
- **Squadra**: nome della squadra di appartenenza
- **Status** con colore:
  - 🟢 **Verde**: Atleta Attivo
  - 🟠 **Arancione**: Atleta in Prova
- **Tap sulla card**: apre il profilo completo dell'atleta

#### Prossimi Impegni

Lista degli eventi futuri per tutti i figli:
- **Nome Figlio**: evidenziato in **grassetto** con colore distintivo
- **Tipo Evento**: 🏋️ Allenamento o 🏐 Gara
- **Data e Ora**
- **Luogo**
- Per le gare:
  - 🏠 **Casa** o ✈️ **Trasferta**
  - Nome avversario
  - Indirizzo completo

Se hai più figli, ogni evento mostra chiaramente a quale figlio si riferisce con un colore diverso per ciascuno.

---

## 👦 PROFILO ATLETA (Figlio)

Tap sulla card del figlio per accedere al profilo completo.

### Tab "Dati Personali"

#### Informazioni Atleta
- **Foto**: visualizzazione foto atleta
- **Nome e Cognome**
- **Data di Nascita**
- **Luogo di Nascita**
- **Codice Fiscale**
- **Indirizzo**
- **Squadra**: nome squadra (in **rosso**)

#### Dati Genitore Pagante
Sezione per i dati fiscali del genitore che effettua i pagamenti:
- **Nome**: nome del genitore pagante
- **Cognome**: cognome del genitore pagante
- **Codice Fiscale**: CF del genitore

**Per modificare:**
1. Tap su **"Modifica"** o icona matita
2. Aggiornare i campi desiderati
3. Tap su **"Salva"**

### Tab "Pagamenti" 💰

#### Riepilogo Economico

Nella parte superiore viene mostrato:

##### Quota Stagionale
- Importo totale dovuto per la stagione sportiva
- Es. "€ 350,00"

##### Sconto Applicato (se presente)
- Motivo dello sconto: "Sconto applicato per: Fratello/Sorella"
- Importo dello sconto

##### Residuo Dovuto
- Importo ancora da pagare
- Calcolato: Quota - Sconti - Pagamenti effettuati

#### Dettaglio Rate

Lista di tutte le rate previste:

##### Rata Iscrizione
- **Importo**: quota di iscrizione
- **Scadenza**: immediata (all'iscrizione)
- **Status**:
  - ✅ **Pagata** (verde): con data pagamento
  - 🔴 **SCADUTA** (rosso): se non pagata

##### Rate Successive (1ª Rata, 2ª Rata, ecc.)
Per ogni rata:
- **Descrizione**: es. "1ª Rata"
- **Importo**: cifra della rata
- **Scadenza**: data entro cui pagare
- **Status**:
  - ✅ **Pagata** (verde): pagamento registrato, mostra data
  - 🔴 **SCADUTA** (rosso): data superata, non pagata
  - ⏳ **Da pagare** (grigio): non ancora scaduta

#### Note
- I pagamenti vengono registrati dall'Admin
- Il genitore può solo visualizzare lo stato
- Per segnalare un pagamento effettuato, contattare la segreteria

### Tab "Calendario Squadra" 📅

#### Allenamenti Settimanali

Per ogni giorno di allenamento:
- **Giorno**: es. "Lunedì"
- **Orario**: es. "17:00 - 18:30"
- **Palestra**: nome della struttura
- **Indirizzo**: indirizzo completo

#### Gare in Casa

- **Giorno Tipico**: es. "Sabato"
- **Orario**: es. "15:00"
- **Palestra**: struttura per le gare casalinghe
- **Indirizzo**: indirizzo completo

### Certificato Medico 📋

#### Visualizzazione Status

- **✅ Valido** (verde): certificato in regola
  - Mostra data scadenza
  - Giorni rimanenti

- **⚠️ In Scadenza** (giallo): scade entro 30 giorni
  - Mostra data scadenza
  - Avviso di rinnovo

- **❌ Scaduto** (rosso): certificato non più valido
  - Data scadenza superata
  - Necessario nuovo certificato

#### Azioni sul Certificato

##### Visualizzare
1. Tap su **"Visualizza"** o sull'anteprima
2. Il certificato si apre a schermo intero
3. Possibilità di zoom

##### Condividere
1. Tap su **"Condividi"** o icona condivisione
2. Selezionare l'app di destinazione:
   - WhatsApp
   - Email
   - Telegram
   - Altro...
3. Il file viene allegato automaticamente

##### Scaricare
1. Tap su **"Scarica"** o icona download
2. Il file viene salvato sul dispositivo
3. Disponibile nella cartella Download

#### Caricare Nuovo Certificato

Il caricamento del certificato medico è gestito dall'Admin. Per aggiornare il certificato:
1. Consegnare il nuovo certificato alla segreteria
2. Oppure inviarlo via email all'indirizzo della società
3. L'Admin provvederà al caricamento nel sistema

---

## 📅 PROSSIMI IMPEGNI (Dettaglio)

### Visualizzazione Eventi

La sezione "Prossimi Impegni" nella dashboard mostra tutti gli eventi futuri:

#### Per ogni Allenamento
- **Nome Figlio**: in grassetto con colore distintivo
- **Icona**: 🏋️
- **Giorno e Data**: es. "Lunedì 10/02"
- **Orario**: es. "17:00 - 18:30"
- **Palestra**: nome struttura
- **Indirizzo**: con possibilità di aprire in Maps

#### Per ogni Gara
- **Nome Figlio**: in grassetto con colore distintivo
- **Icona**: 🏐
- **Tipo**: 🏠 Casa o ✈️ Trasferta
- **Data e Ora**: in **rosso grassetto**
- **Avversario**: "vs [Nome Squadra]"
- **Luogo**: nome palestra
- **Indirizzo**: completo, tap per navigazione
- **Orario Ritrovo**: se specificato (in arancione)

### Navigazione verso il Luogo

1. Tap sull'indirizzo di un evento
2. Si apre automaticamente l'app di navigazione (Google Maps, Waze, ecc.)
3. Segui le indicazioni per raggiungere la destinazione

### Filtri (se disponibili)

- **Tutti i figli**: mostra eventi di tutti
- **Figlio specifico**: solo eventi di un figlio
- **Solo gare**: nascondi allenamenti
- **Prossima settimana**: eventi dei prossimi 7 giorni

---

## ➕ REGISTRAZIONE NUOVO ATLETA

### Quando Usare

Usa questa funzione per iscrivere un nuovo figlio alla società sportiva.

### Procedura

#### Passaggio 1: Accesso
1. Dalla dashboard, tap su **"Aggiungi Atleta"** o **"+"**
2. Oppure dal menu: "Registra nuovo atleta"

#### Passaggio 2: Dati Anagrafici
Compilare tutti i campi obbligatori:
- **Nome** *
- **Cognome** *
- **Data di Nascita** *
- **Luogo di Nascita** *
- **Codice Fiscale** *
- **Indirizzo di Residenza**
- **Città**
- **CAP**

#### Passaggio 3: Selezione Squadra
- Selezionare la squadra desiderata dal menu a tendina
- Vengono mostrate solo le squadre con posti disponibili

#### Passaggio 4: Dati Genitore Pagante
- **Nome Genitore** *
- **Cognome Genitore** *
- **Codice Fiscale Genitore** *
- **Relazione**: Padre / Madre / Tutore

#### Passaggio 5: Conferma
1. Verificare tutti i dati inseriti
2. Accettare i termini e condizioni
3. Tap su **"Invia Richiesta"**

#### Dopo l'Invio
- La richiesta viene inviata all'Admin
- Riceverai una notifica quando verrà approvata
- L'atleta apparirà nella tua dashboard solo dopo l'approvazione

---

## 👤 PROFILO GENITORE

### Visualizzazione

- **Nome e Cognome**
- **Email**
- **Telefono**
- **Figli Registrati**: elenco atleti collegati

### Modifica Dati

1. Tap su **"Modifica Profilo"**
2. Campi modificabili:
   - Telefono
   - Indirizzo
3. Tap su **"Salva"**

### Cambio Password

1. Tap su **"Cambia Password"**
2. Inserire:
   - Password attuale
   - Nuova password (minimo 6 caratteri)
   - Conferma nuova password
3. Tap su **"Conferma"**

### Notifiche

Gestione delle preferenze di notifica:
- **Email**: ricevi aggiornamenti via email
- **Push**: notifiche sul dispositivo
- Tipi di notifiche:
  - Nuovi eventi in calendario
  - Scadenze pagamenti
  - Scadenza certificato medico
  - Comunicazioni dalla società

### Logout

1. Tap su **"Esci"**
2. Confermare
3. Verrai riportato alla schermata di login

---
---

# APPENDICE

## Codici Colore

| Colore | Significato |
|--------|-------------|
| 🟢 Verde | Attivo, Pagato, Valido, Presente |
| 🟠 Arancione | In prova, In scadenza, Ritrovo |
| 🔴 Rosso | Scaduto, Non pagato, Assente, Data importante |
| 🔵 Blu | Link, Azioni, Elementi interattivi |
| ⚪ Grigio | Da pagare, In attesa, Disabilitato |

## Icone Comuni

| Icona | Significato |
|-------|-------------|
| 🏠 | Gara in casa |
| ✈️ | Gara in trasferta |
| 🏋️ | Allenamento |
| 🏐 | Gara/Partita |
| 📋 | Presenze/Lista |
| 💰 | Pagamenti |
| 📅 | Calendario |
| ⚙️ | Impostazioni |
| 🔔 | Notifiche |
| ✏️ | Modifica |
| 🗑️ | Elimina |
| ✅ | Confermato/Presente |
| ❌ | Non confermato/Assente |

## Contatti Supporto

Per assistenza tecnica o segnalazione problemi:
- **Email**: [email società]
- **Telefono**: [telefono società]

---

*Manuale aggiornato a Febbraio 2026*
*Versione App: 1.0*
