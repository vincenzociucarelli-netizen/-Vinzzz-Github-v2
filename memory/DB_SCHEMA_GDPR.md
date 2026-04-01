# RegistraTEAM - Schema Database GDPR
## MongoDB Collections

---

## 1. `consents` - Registro Consensi (storico completo)

Ogni modifica di consenso genera un **nuovo record**. Non si aggiornano mai record esistenti.

```json
{
  "_id": "ObjectId",
  "id": "uuid-v4",

  // Chiavi di collegamento
  "user_id": "id_genitore_o_tutore",
  "child_id": "id_atleta_minore (null se consenso personale adulto)",

  // Tipo di consenso
  "consent_type": "privacy_viewed | data_processing_sports | images_internal | images_promo",

  // Stato
  "value": true,
  "action": "granted | revoked | initial_acceptance",

  // Riferimento documento
  "document_id": "id_del_documento_firmato (nullable)",
  "document_version": "2.0",
  "document_name": "privacy_minore_v2.0",
  "document_hash": "sha256_del_pdf_generato",

  // Metadati tracciabilita
  "ip_address": "87.20.53.38",
  "user_agent": "Mozilla/5.0...",
  "timestamp": "2026-04-01T09:00:00.000Z",

  // Contesto
  "society_id": "id_societa",
  "source": "registration | profile_update | signing_flow | admin_override",
  "previous_consent_id": "id_record_precedente (per tracciare la catena)",
  "notes": "Revoca volontaria dal profilo atleta"
}
```

### Indici consigliati
```javascript
db.consents.createIndex({ "user_id": 1, "child_id": 1, "consent_type": 1, "timestamp": -1 })
db.consents.createIndex({ "child_id": 1, "consent_type": 1 })
db.consents.createIndex({ "document_id": 1 })
db.consents.createIndex({ "society_id": 1, "timestamp": -1 })
```

### Query utili
```javascript
// Ultimo stato di un consenso per un minore
db.consents.findOne(
  { child_id: "id_minore", consent_type: "images_internal" },
  { sort: { timestamp: -1 } }
)

// Storico completo consensi di un minore
db.consents.find(
  { child_id: "id_minore" },
  { sort: { timestamp: -1 } }
)

// Tutti i consensi revocati (per audit)
db.consents.find({ action: "revoked", society_id: "id_societa" })
```

---

## 2. `documents` - Documenti Generati (con hash PDF)

Ogni documento firmato o preso in visione viene registrato con hash per integrità.

```json
{
  "_id": "ObjectId",
  "id": "uuid-v4",

  // Chiavi di collegamento
  "user_id": "id_genitore_firmatario",
  "child_id": "id_atleta_minore (null se documento personale)",
  "society_id": "id_societa",

  // Tipo e titolo
  "document_type": "privacy_consent | coach_contract | compensation_receipt",
  "document_title": "Presa Visione Privacy - RIGO PIA",
  "document_name": "privacy_minore_v2.0",
  "document_version": "2.0",

  // Contenuto
  "document_text": "Testo completo del documento al momento della firma",
  "document_hash": "sha256_del_contenuto_testuale",
  "pdf_hash": "sha256_del_file_pdf_generato",

  // Firma
  "signature_base64": "base64_della_firma_grafica",
  "signer_name": "LAURI SOFIA",
  "signer_email": "sofia@test.com",
  "signer_fiscal_code": "LRISFX80A01H501Z",

  // Dati del minore (snapshot al momento della firma)
  "minor_data_snapshot": {
    "full_name": "RIGO PIA",
    "fiscal_code": "RGOPAI12E29Z112X",
    "date_of_birth": "2012-05-29",
    "place_of_birth": "BERLINO"
  },

  // Consensi associati al documento
  "consents_snapshot": {
    "privacy_viewed": true,
    "data_processing_sports": true,
    "images_internal": false,
    "images_promo": false
  },

  // Metadati firma
  "ip_address": "87.20.53.38",
  "user_agent": "Mozilla/5.0...",
  "signed_at": "2026-04-01T09:00:00.000Z",
  "created_at": "2026-04-01T09:00:00.000Z",

  // Stato
  "status": "active | superseded | revoked",
  "superseded_by": "id_nuovo_documento (se rifirmato)",

  // Dati aggiuntivi
  "additional_data": {
    "Atleta": "RIGO PIA",
    "Genitore/Tutore": "LAURI SOFIA",
    "Tipo documento": "Presa Visione Privacy e Liberatoria"
  }
}
```

### Indici consigliati
```javascript
db.documents.createIndex({ "user_id": 1, "child_id": 1, "document_type": 1 })
db.documents.createIndex({ "child_id": 1, "status": 1 })
db.documents.createIndex({ "society_id": 1, "document_type": 1 })
db.documents.createIndex({ "document_hash": 1 })
db.documents.createIndex({ "pdf_hash": 1 })
```

---

## 3. `events` - Log Eventi (firma, modifica, audit)

Registro immutabile di ogni azione rilevante nel sistema.

```json
{
  "_id": "ObjectId",
  "id": "uuid-v4",

  // Chi
  "user_id": "id_utente_che_ha_eseguito_azione",
  "user_email": "sofia@test.com",
  "user_role": "parent | admin | athlete | coach",

  // Su chi
  "target_user_id": "id_soggetto_interessato (atleta/coach)",
  "child_id": "id_minore (null se non applicabile)",

  // Cosa
  "event_type": "document_signed | consent_granted | consent_revoked | profile_updated | document_generated | document_downloaded | login | privacy_viewed",
  "event_category": "gdpr | auth | admin | document",

  // Dettagli
  "details": {
    "document_id": "id_documento_collegato",
    "document_type": "privacy_consent",
    "consent_type": "images_promo",
    "old_value": true,
    "new_value": false,
    "description": "Revoca consenso immagini promozionali per RIGO PIA"
  },

  // Contesto tecnico
  "ip_address": "87.20.53.38",
  "user_agent": "Mozilla/5.0...",
  "society_id": "id_societa",
  "timestamp": "2026-04-01T09:00:00.000Z",

  // Integrità
  "event_hash": "sha256(event_type + user_id + child_id + timestamp + details)"
}
```

### Indici consigliati
```javascript
db.events.createIndex({ "user_id": 1, "timestamp": -1 })
db.events.createIndex({ "child_id": 1, "event_type": 1, "timestamp": -1 })
db.events.createIndex({ "society_id": 1, "event_category": 1, "timestamp": -1 })
db.events.createIndex({ "event_type": 1, "timestamp": -1 })
db.events.createIndex({ "document_id": 1 })  // Per trovare tutti gli eventi di un documento
```

### Query utili
```javascript
// Timeline completa di un minore
db.events.find(
  { child_id: "id_minore" },
  { sort: { timestamp: -1 } }
)

// Tutti gli eventi GDPR di una societa
db.events.find(
  { society_id: "id_societa", event_category: "gdpr" },
  { sort: { timestamp: -1 } }
)

// Chi ha scaricato un documento
db.events.find(
  { event_type: "document_downloaded", "details.document_id": "id_doc" }
)
```

---

## 4. Relazioni tra Collections

```
users (genitore/tutore)
  |
  |-- user_id ──────────────────┐
  |                             |
  ├── consents ─────────────────┤  (user_id + child_id)
  |     ogni modifica = nuovo   |
  |     record con timestamp    |
  |                             |
  ├── documents ────────────────┤  (user_id + child_id)
  |     hash PDF per integrità  |
  |     snapshot dati al momento|
  |     della firma             |
  |                             |
  └── events ───────────────────┘  (user_id + child_id)
        log immutabile di ogni
        azione (firma, revoca,
        download, login)

athletes (minore)
  |
  └── child_id ── collegato a consents, documents, events
```

---

## 5. Flusso Tipo: Firma Privacy Minore

```
1. Genitore apre modal consensi
   → Nessun record creato

2. Genitore seleziona toggle (es. images_internal = SI)
   → Nessun record creato (solo stato locale UI)

3. Genitore firma con SignaturePad
   → INSERT in documents (con pdf_hash, consents_snapshot, signature)
   → INSERT in consents (action: "initial_acceptance", consent_type: "privacy_viewed")
   → INSERT in consents (action: "initial_acceptance", consent_type: "data_processing_sports")
   → INSERT in consents (action: "granted", consent_type: "images_internal")
   → INSERT in events  (event_type: "document_signed")
   → INSERT in events  (event_type: "consent_granted", x ogni consenso)

4. Genitore revoca images_promo dal profilo
   → INSERT in consents (action: "revoked", consent_type: "images_promo")
   → INSERT in events  (event_type: "consent_revoked")
   → Nota: "La revoca dei consensi relativi alle immagini ha effetto solo per utilizzi futuri"

5. Genitore scarica PDF da "Miei Documenti"
   → INSERT in events  (event_type: "document_downloaded")
   → PDF rigenerato al volo con dati attuali dal DB
```

---

## 6. Regole di Integrità

| Regola | Descrizione |
|--------|-------------|
| **Immutabilità** | I record in `consents` e `events` non vengono MAI modificati o cancellati |
| **Nuovo record** | Ogni modifica di consenso = nuovo record con `timestamp` e `previous_consent_id` |
| **Hash PDF** | Ogni documento firmato ha `pdf_hash` per verificare integrità |
| **Snapshot** | I dati anagrafici vengono "fotografati" nel documento al momento della firma |
| **child_id** | Ogni consenso è associato al **singolo minore**, mai generico |
| **Revoca** | Solo i consensi facoltativi (images_*) possono essere revocati |
| **Obbligatori** | `privacy_viewed` e `data_processing_sports` sono sempre `true` e non revocabili |

---

## 7. Consent Types Reference

| consent_type | Obbligatorio | Revocabile | Default |
|-------------|:---:|:---:|:---:|
| `privacy_viewed` | SI | NO | true |
| `data_processing_sports` | SI | NO | true |
| `images_internal` | NO | SI | false |
| `images_promo` | NO | SI | false |

---

## 8. Event Types Reference

| event_type | event_category | Descrizione |
|-----------|:---:|-------------|
| `document_signed` | gdpr | Documento firmato con SignaturePad |
| `document_generated` | document | PDF generato (anteprima o finale) |
| `document_downloaded` | document | PDF scaricato da "Miei Documenti" |
| `consent_granted` | gdpr | Consenso facoltativo concesso |
| `consent_revoked` | gdpr | Consenso facoltativo revocato |
| `privacy_viewed` | gdpr | Informativa presa in visione |
| `profile_updated` | admin | Dati anagrafici modificati |
| `login` | auth | Accesso al sistema |
