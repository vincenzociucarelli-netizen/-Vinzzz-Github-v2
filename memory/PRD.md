# RegistraTEAM - Product Requirements Document

## Descrizione Progetto
Applicazione per la gestione di club di pallavolo che permette a genitori, allenatori e amministratori di gestire atleti, presenze, pagamenti e certificati medici.

## Architettura
- **Frontend**: React Native + Expo Web
- **Backend**: FastAPI + MongoDB
- **Autenticazione**: JWT
- **Integrazioni**: SendGrid (email), OpenAI (trasformazione foto)

## Ruoli Utente
1. **Admin**: Gestione completa società, squadre, atleti, pagamenti
2. **Coach**: Scansione QR code presenze, visualizzazione squadre
3. **Parent**: Visualizzazione figli, upload certificati, pagamenti, QR code

## Funzionalità Implementate

### Gestione Atleti
- ✅ Registrazione atleti con QR code unico
- ✅ Doppio genitore (parent_id + second_parent_id)
- ✅ Codice atleta manuale modificabile
- ✅ Upload certificato medico
- ✅ Trasformazione foto con AI

### Gestione Presenze
- ✅ Scansione QR code per registrare presenze
- ✅ Statistiche presenze per squadra

### Gestione Pagamenti
- ✅ Pagamenti manuali con ricevuta fiscale
- ✅ Riepilogo pagamenti con sconti
- ✅ Storico pagamenti per atleta
- ✅ Metodo di pagamento (Bonifico, POS, Contanti) nella ricevuta

### Ricevuta Fiscale (Dicembre 2025)
- ✅ Dati anagrafici società completi (Ragione Sociale, Indirizzo, CAP/Città/Prov, CF)
- ✅ Logo società nell'header
- ✅ Timbro e firma presidente
- ✅ Nome presidente
- ✅ Telefoni di contatto

### Stampa e Condivisione
- ✅ Stampa QR code (web + mobile)
- ✅ Condivisione QR code (download su web)
- ✅ Download ricevuta fiscale (parent + admin)

## Bug Risolti (Dicembre 2025)

### 10/12/2025
- ✅ Fix critico build frontend (rimosso jspdf, usato expo-print)
- ✅ Fix icone mancanti (workaround con emoji component)
- ✅ Fix secondo genitore non vedeva figlia nella dashboard
- ✅ Fix admin non vedeva figli secondo genitore

### 11/12/2025
- ✅ **CRITICO**: Fix 12 endpoint backend per autorizzazione second_parent_id
- ✅ Fix stampa QR code su web (ora mostra QR code + codice atleta)
- ✅ Fix condivisione QR code su web (fallback a download)
- ✅ Nuovi campi anagrafica società per ricevuta fiscale
- ✅ Metodo di pagamento visibile nella ricevuta
- ✅ Attestato di Versamento: rimosso numero ricevuta dall'header, aggiunto "alla data del:"
- ✅ QR code atleta visibile per admin nella sezione statistiche

## Backlog

### P1 - Alta Priorità
- [x] Pulsante "Scarica Ricevuta Fiscale" nella vista admin atleta (implicitamente incluso)

### P2 - Media Priorità  
- [ ] Periodo di prova 7 giorni per nuovi genitori
- [ ] Limite squadre per società + messaggio upgrade
- [ ] Integrazione Stripe per pagamenti online
- [ ] Modulo "Atleti Professionisti con Compenso"

### P3 - Bassa Priorità
- [ ] Fix permanente icone (font loading Expo Web)

## Credenziali Test
- Admin: `pallavoloperugia@gmail.com` / `11092012`
- Parent 1: `armida.raschi@gmail.com` / `test1234`
- Parent 2: `genitore2@test.com` / `test1234`

## Note Tecniche

### Workaround Icone
Le icone `@expo/vector-icons` non funzionano su Expo Web. È stato creato un componente `Icon.tsx` che mappa i nomi delle icone a emoji Unicode.

### Autorizzazione Second Parent
Tutti gli endpoint che controllano `parent_id` ora controllano anche `second_parent_id`:
```python
if current_user["role"] == UserRole.PARENT:
    is_primary = athlete.get("parent_id") == current_user["id"]
    is_second = athlete.get("second_parent_id") == current_user["id"]
    if not is_primary and not is_second:
        raise HTTPException(status_code=403, detail="Accesso negato")
```

### Campi Society Settings
Nuovi campi aggiunti al modello `SocietySettingsUpdate`:
- `ragione_sociale` - Nome legale
- `address`, `postal_code`, `city`, `province` - Indirizzo completo
- `fiscal_code` - Codice Fiscale
- `phone`, `phone2` - Telefoni
- `president_name` - Nome presidente
- `stamp_signature` - Base64 immagine timbro e firma
