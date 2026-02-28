# RegistraTEAM - Riepilogo Completo del Progetto

**Data creazione documento**: 28 Febbraio 2026  
**Periodo sviluppo**: ~15 giorni  
**Stato**: Pronto per test finale e pubblicazione

---

## 1. PANORAMICA DELL'APPLICAZIONE

**RegistraTEAM** è un'applicazione completa per la gestione di associazioni sportive dilettantistiche (ASD), con focus iniziale sulla pallavolo ma adattabile a qualsiasi sport.

### Piattaforme Supportate
- 📱 **iOS** - App nativa
- 📱 **Android** - App nativa  
- 💻 **Web** - Versione browser completa

### Stack Tecnologico
| Componente | Tecnologia |
|------------|------------|
| Frontend | React Native + Expo Router |
| Backend | FastAPI (Python) |
| Database | MongoDB |
| Autenticazione | JWT Token |
| Email | Brevo/Sendinblue |
| PDF | ReportLab |

---

## 2. RUOLI UTENTE IMPLEMENTATI

### 👑 Amministratore (Admin)
- Gestione completa società (logo, dati, impostazioni)
- Approvazione/rifiuto richieste iscrizione
- Gestione squadre e assegnazione atleti
- Gestione allenatori e dirigenti
- Importazione calendario gare da FIPAV
- Registrazione pagamenti atleti
- Archivio certificati medici (5 anni per compliance ASD)
- Statistiche e report
- Notifiche push e badge

### 👔 Dirigente
- Visualizzazione squadre e atleti
- Accesso statistiche presenze
- Profilo personale con compensi sportivi
- Contatto diretto WhatsApp con genitori/coach

### 🏋️ Allenatore (Coach)
- Scanner QR Code per presenze
- Calendario allenamenti e gare (prossimi 3 giorni)
- Gestione squadre assegnate
- Storico presenze registrate
- Profilo personale con dati bancari
- Contatto WhatsApp con dirigenti

### 👨‍👩‍👧 Genitore
- Registrazione figli (atleti minorenni)
- Calendario impegni figli
- Upload certificato medico
- Visualizzazione QR Code atleta
- Firma privacy e consensi GDPR
- Visualizzazione pagamenti e ricevute

### 🏃 Atleta Maggiorenne
- Dashboard personale completa
- Calendario allenamenti e gare
- Gestione certificato medico
- QR Code per presenze
- Storico presenze e statistiche
- Pagamenti e ricevute scaricabili
- Profilo con documenti personali

### 👶 Atleta Minorenne
- Gestito interamente dal genitore
- QR Code per presenze
- Certificato medico caricato dal genitore

---

## 3. FUNZIONALITÀ IMPLEMENTATE

### 🔐 Autenticazione e Sicurezza
- [x] Registrazione con codice invito società
- [x] Login con email/password
- [x] Recupero password via email
- [x] Token JWT per sessioni sicure
- [x] Sistema doppia password (genitore + dati atleta)
- [x] Reset password da admin
- [x] Logout sicuro

### 👥 Gestione Utenti
- [x] Flusso approvazione richieste
- [x] Sospensione/riattivazione account
- [x] Eliminazione account con conferma
- [x] Badge notifica richieste in attesa
- [x] Contatto WhatsApp diretto

### 🏃 Gestione Atleti
- [x] Anagrafica completa con codice fiscale
- [x] Calcolo automatico codice fiscale
- [x] QR Code personale univoco
- [x] Assegnazione a squadre
- [x] Gestione ruoli (palleggiatore, centrale, ecc.)
- [x] Stato atleta (attivo, prova, bloccato)
- [x] Ricerca avanzata atleti

### 📋 Certificati Medici
- [x] Upload certificato con data scadenza
- [x] Calcolo automatico scadenza (data rilascio + mesi validità - 1 giorno)
- [x] Alert scadenze in arrivo (7 giorni prima)
- [x] Visualizzazione, stampa e condivisione
- [x] **Archivio storico 5 anni** (compliance ASD)
- [x] Semaforo visivo (verde/giallo/rosso)

### 📅 Calendario e Gare
- [x] Import calendario da FIPAV
- [x] Import manuale da Excel con template
- [x] Sistema anti-duplicati intelligente
- [x] Vista prossimi 3 giorni con espansione
- [x] Dettagli: data, ora, avversario, luogo
- [x] Indicatore casa/trasferta con colori
- [x] Orario ritrovo per trasferte
- [x] Allenamenti nascosti nei giorni di gara

### 📱 Sistema Presenze QR
- [x] Scanner QR Code (camera mobile)
- [x] Inserimento manuale codice
- [x] Feedback immediato colorato:
  - ✅ Verde = Autorizzato
  - ⚠️ Giallo = Ammesso con avviso
  - 🚫 Rosso = Accesso negato
- [x] Storico presenze per atleta
- [x] Statistiche mensili

### 💰 Gestione Pagamenti
- [x] Quote squadra con rate personalizzabili
- [x] Sconti per rata specifica
- [x] Calcolo residuo dovuto automatico
- [x] Registrazione pagamenti (POS, Bonifico, Contanti)
- [x] Generazione ricevuta pagamento
- [x] Ricevuta scaricabile/stampabile formato A4
- [x] Condivisione ricevuta (Web Share API)
- [x] Attestato di versamento per minorenni (formale)
- [x] Ricevuta semplice per maggiorenni

### 📄 Documenti e Firme
- [x] Privacy policy con firma digitale
- [x] Consensi GDPR
- [x] Firma su canvas touch
- [x] Documenti identità
- [x] Storico documenti firmati

### 🔔 Notifiche
- [x] Badge contatore notifiche non lette
- [x] Alert scadenza certificati (7 giorni)
- [x] Alert scadenza pagamenti
- [x] Compleanni del giorno

### ⚙️ Impostazioni Società
- [x] Logo e nome società
- [x] Immagine sport personalizzata
- [x] Dati fiscali e legali
- [x] Codice invito generabile
- [x] Ruoli atleti personalizzabili
- [x] Orari allenamento per squadra

---

## 4. ARCHITETTURA TECNICA

### Struttura Directory
```
/app
├── backend/
│   ├── server.py          # API principale FastAPI
│   ├── requirements.txt   # Dipendenze Python
│   └── .env              # Variabili ambiente
├── frontend/
│   ├── app/              # Pagine (Expo Router)
│   │   ├── admin/        # Area amministratore
│   │   ├── athlete/      # Area atleta maggiorenne
│   │   ├── coach/        # Area allenatore
│   │   ├── collaboratore/# Area collaboratore
│   │   ├── dirigente/    # Area dirigente
│   │   └── parent/       # Area genitore
│   ├── src/
│   │   ├── components/   # Componenti riutilizzabili
│   │   ├── services/     # API client
│   │   ├── store/        # State management
│   │   └── utils/        # Utility functions
│   └── .env              # Variabili ambiente frontend
├── docs/                 # Documentazione
└── memory/               # PRD e note progetto
```

### API Endpoints Principali
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login utente |
| POST | `/api/auth/register` | Registrazione |
| GET | `/api/stats/overview` | Statistiche admin |
| GET | `/api/teams` | Lista squadre |
| GET | `/api/athletes` | Lista atleti |
| POST | `/api/attendance/check` | Check-in QR |
| GET | `/api/certificates/expiring` | Certificati in scadenza |
| POST | `/api/payments` | Registra pagamento |
| GET | `/api/matches` | Calendario gare |

### Integrazioni Esterne
| Servizio | Utilizzo |
|----------|----------|
| Brevo/Sendinblue | Invio email (benvenuto, recupero password) |
| FIPAV API | Import calendario gare pallavolo |
| Web Share API | Condivisione ricevute su mobile |

---

## 5. CREDENZIALI DI TEST

| Ruolo | Email | Password |
|-------|-------|----------|
| Admin | test.admin@test.com | Test1234 |
| Atleta Adulto (Lisa) | lisa@test.com | Test1234 |
| Atleta Adulto (Genny) | genny@test.com | Test1234 |
| Coach | coach@test.com | Test1234 |
| Genitore Test | genitore.test@test.com | Test1234 |

---

## 6. MODELLO DI BUSINESS

### Piano Freemium
- **GRATIS**: Fino a 30 tesserati
- **PRO**: Oltre 30 tesserati (pricing da definire)

### Vantaggi per le Società
- ⏱️ Risparmio tempo (presenze in 2 secondi con QR)
- 📋 Organizzazione centralizzata
- 🔒 Conformità GDPR e normativa ASD
- 💰 Zero costi hardware aggiuntivi

---

## 7. NOTE PER LA PUBBLICAZIONE

### Pre-requisiti App Store
- [ ] Privacy Policy pubblica
- [ ] Terms of Service
- [ ] Screenshot per store
- [ ] Icona app (1024x1024)
- [ ] Descrizione app
- [ ] Categoria: Sport / Utility

### Checklist Tecnica
- [x] Tutte le API funzionanti
- [x] Gestione errori robusta
- [x] Loading states implementati
- [x] Responsive design
- [ ] Test su dispositivi reali
- [ ] Performance optimization

### Issues Noti (Bassa Priorità)
- `@expo/vector-icons` rendering web (P3)
- Dashboard admin caricamento intermittente (P2)

---

## 8. CRONOLOGIA SVILUPPO

### Settimana 1
- Setup progetto iniziale
- Implementazione autenticazione
- Struttura multi-ruolo
- Dashboard base

### Settimana 2
- Sistema presenze QR
- Gestione certificati medici
- Calendario allenamenti/gare
- Import FIPAV

### Settimana 3 (Ultima)
- Sistema pagamenti completo
- Ricevute e attestati
- Archivio certificati 5 anni
- UI/UX refinements
- Documentazione completa
- Bug fixes finali

---

## 9. CONTATTI E SUPPORTO

**App**: RegistraTEAM  
**Versione**: 1.0.0  
**Sviluppato con**: Emergent AI Platform

---

*Documento generato automaticamente il 28/02/2026*
*RegistraTEAM - Semplifica la gestione, concentrati sullo sport!*
