# App Gestione Presenze Atleti

## 📱 Descrizione

Applicazione mobile per la gestione delle presenze degli atleti agli allenamenti, con sistema di controllo certificati medici e pagamenti rateali.

## 🎯 Funzionalità Principali

### 👔 Interfaccia Admin
- **Dashboard** con statistiche generali
- **Gestione Squadre**: crea e visualizza squadre
- **Visualizzazione Atleti**: lista completa con stato
- **Impostazioni Pagamenti**: configura importi e scadenze delle 3 rate
- **Storico Presenze**: visualizza tutte le presenze giornaliere

### 🏋️ Interfaccia Coach
- **Scanner QR Code**: scansiona i QR code degli atleti all'ingresso
- **Controlli Automatici**:
  - Certificato medico valido ✓
  - Rate pagate ✓
  - Privacy accettata (dopo periodo di prova) ✓
- **Motivo Blocco**: visualizza la ragione specifica se l'atleta è bloccato
- **Storico Presenze del Giorno**

### 👨‍👩‍👦 Interfaccia Genitore/Atleta
- **Registrazione Atleti**: registra un nuovo atleta scegliendo la squadra
- **QR Code Personale**: visualizza e mostra il QR per il check-in
- **Upload Certificato Medico**: carica PDF con data emissione e validità
- **Gestione Pagamenti**: 
  - Visualizza stato rate (pagate/non pagate)
  - Info per bonifico bancario e PayPal
- **Sistema Periodo di Prova**: 7 giorni dall'iscrizione
- **Conferma Privacy**: doppia conferma obbligatoria dopo periodo di prova
- **Account Genitore/Minore**: 
  - Genitore gestisce tutto con password
  - Minore può solo visualizzare (read-only)

## 🔐 Sistema di Sicurezza e Controlli

### Blocco Automatico Atleta
L'atleta viene bloccato all'ingresso se:
1. ❌ Certificato medico mancante
2. ❌ Certificato medico scaduto
3. ❌ Una o più rate non pagate e scadute
4. ❌ Periodo di prova terminato senza conferma privacy

### Sistema Rate di Pagamento
- **Rata 1**: scadenza dopo 7 giorni di prova (periodo di prova)
- **Rata 2**: data impostata dall'admin
- **Rata 3**: data impostata dall'admin

## 🚀 Come Iniziare

### 1. Primo Accesso (Admin)
1. Registrati come **Admin**
2. Crea le **squadre** (es: Under 15, Under 18, etc.)
3. Imposta le **rate di pagamento** con importi e scadenze
4. Configura i dati per **bonifico** e **PayPal**

### 2. Registrazione Genitore/Atleta
1. Registrati come **Genitore**
2. Registra un **atleta** scegliendo la squadra
3. **QR Code** generato automaticamente
4. Durante i 7 giorni di prova:
   - Carica il **certificato medico** (PDF + dati)
   - L'atleta può partecipare agli allenamenti
5. Dopo 7 giorni:
   - Conferma **privacy** con doppia accettazione
   - Paga la **prima rata**

### 3. Coach - Scansione Presenze
1. Accedi come **Coach**
2. Clicca su "Scansiona QR Code"
3. Inquadra il QR dell'atleta
4. Il sistema controlla automaticamente:
   - Certificato valido?
   - Rate pagate?
   - Privacy confermata?
5. Risultato:
   - ✅ **Verde**: Accesso consentito
   - ❌ **Rosso**: Accesso negato con motivo

## 📋 Account di Test

### Admin
- Email: `admin@test.com`
- Password: `admin123`

### Coach
- Email: `coach@test.com`
- Password: `coach123`

### Genitore
- Email: `parent@test.com`
- Password: `parent123`

## 🛠️ Tecnologie Utilizzate

### Backend
- **FastAPI** (Python)
- **MongoDB** (Database)
- **JWT** (Autenticazione)
- **QR Code Generation** (libreria qrcode)

### Frontend
- **React Native** (Expo)
- **Expo Router** (Navigazione)
- **Expo Barcode Scanner** (Scansione QR)
- **Expo Document Picker** (Upload PDF)
- **Zustand** (State Management)
- **Axios** (API calls)

## 📱 Permessi Richiesti

### Android
- `CAMERA` - Per scansionare QR code
- `READ_EXTERNAL_STORAGE` - Per caricare certificati PDF

### iOS
- Camera - Per scansionare QR code
- Photo Library - Per caricare certificati

## 🔄 Flusso Completo

```
1. Admin crea squadra "Under 15"
   ↓
2. Genitore registra atleta "Marco Rossi" → Squadra "Under 15"
   ↓
3. Sistema genera QR Code univoco
   ↓
4. PERIODO DI PROVA (7 giorni):
   - Genitore carica certificato medico
   - Atleta può allenarsi liberamente
   ↓
5. Dopo 7 giorni:
   - Genitore conferma privacy (doppia conferma)
   - Genitore paga rata 1
   ↓
6. Coach scansiona QR all'ingresso:
   - ✅ Certificato valido? SI
   - ✅ Rate pagate? SI
   - ✅ Privacy OK? SI
   → ACCESSO CONSENTITO
```

## 📊 Dashboard Admin - Statistiche

- **Atleti Totali**: Numero totale di atleti registrati
- **Atleti Attivi**: Atleti con stato "active"
- **Squadre**: Numero di squadre create
- **Presenze Oggi**: Check-in del giorno corrente

## 💳 Modalità di Pagamento

Per ora supporta solo **informazioni** per:
- **Bonifico Bancario**: IBAN e dettagli banca
- **PayPal**: Email PayPal della società

I genitori vedono queste info e pagano manualmente (l'admin deve poi confermare il pagamento nell'app).

## ⚠️ Note Importanti

1. **Certificato Medico**: Deve essere caricato in formato PDF
2. **Data di Nascita**: Formato YYYY-MM-DD (es: 2010-05-15)
3. **Privacy**: Richiede doppia conferma per evitare errori
4. **QR Code**: Può essere stampato per bambini senza smartphone
5. **Periodo di Prova**: 7 giorni dall'iscrizione, poi obbligatorio privacy + pagamento

## 🎨 Design

- **Colori**: 
  - Primario: Blu (#007AFF)
  - Successo: Verde (#34C759)
  - Pericolo: Rosso (#FF3B30)
  - Warning: Arancione (#FF9500)
- **Icone**: Ionicons
- **Layout**: Mobile-first, responsive

## 📞 Supporto

Per problemi o domande contatta l'amministratore dell'app.

---

**Made with ❤️ for Sports Clubs**
