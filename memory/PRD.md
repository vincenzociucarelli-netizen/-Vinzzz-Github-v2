# RegistraTEAM - Product Requirements Document

## Applicazione
Gestione società sportive dilettantistiche (pallavolo) con focus su compensi sportivi e quietanze digitali.

## Funzionalità Implementate (Febbraio 2025)

### Modulo Compensi Sportivi ✅
- **Quietanze Mensili**: Firma digitale con generazione PDF automatica
- **Calcolo Soglie €5.000 e €15.000**: Automatico con compensi pregressi inclusi
- **Comunicazioni di Superamento Soglia**:
  - PDF "COMUNICAZIONE DI SUPERAMENTO SOGLIA PREVIDENZIALE €5.000"
  - PDF "COMUNICAZIONE DI SUPERAMENTO SOGLIA FISCALE €15.000"
- **Badge visivi ">5K" e ">15K"**: Su card mesi e registro quietanze
- **Email automatiche**: Invio PDF firmati a coach e admin
- **Notifiche Admin**: Alert per superamento soglie

### PDF Generati
1. **Quietanza Mensile**: Solo compenso lordo (senza netto)
2. **Comunicazione €5.000**: Obblighi previdenziali
3. **Comunicazione €15.000**: Obblighi fiscali

### Firma Digitale ✅
- Firma su canvas web (react-signature-canvas)
- Conversione corretta trasparenza PNG → sfondo bianco
- Normalizzazione colori (firma sempre nera leggibile)

### Dashboard Coach ✅
- Periodo contratto visibile (DD/MM/YYYY - DD/MM/YYYY)
- Registro quietanze con badge superamento soglia
- Modale corretto in base al tipo di documento

### Dashboard Admin ✅
- Visualizzazione quietanze firmate per coach
- Badge ">5K" / ">15K" su mesi con superamento
- Notifiche superamento soglia

## Architettura Tecnica

### Backend (FastAPI + MongoDB)
- `/api/coach/{id}/compensation` - Lista compensi
- `/api/coach/{id}/compensation/receipt` - Firma quietanza/dichiarazione
- Generazione PDF con ReportLab e FPDF
- Email con Brevo

### Frontend (React Native/Expo)
- Pagine: coach/compensation.tsx, coach/profile.tsx
- Admin: admin/coach/[id].tsx
- Componenti: SignaturePadInline.tsx

## Test Completati
- **ROSSI LIA**: €4.000 pregresso → €5K superata a Ottobre 2025
- **COACH PIETRO**: €13.800 pregresso → €15K superata a Novembre 2025

## Prossimi Passi (Backlog)
- [ ] Freemium: Limite 30 membri piano FREE
- [ ] Stripe: Pagamenti online per società
- [ ] Modulo Atleti Professionisti con Compenso
- [ ] Fix login genitori
- [ ] Fix icone @expo/vector-icons su web
