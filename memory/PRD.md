# RegistraTEAM - Product Requirements Document

## Problema Originale
Applicazione completa per la gestione di società sportive dilettantistiche italiane. Focus su GDPR, ruoli, collegamento genitori-atleti, documenti PDF dinamici e sincronizzazione calendario gare federali.

## Architettura
- **Frontend**: React/Expo (build statiche web `npx expo export -p web` + `serve -s dist -l 3000`)
- **Backend**: FastAPI (server.py monolitico >24k righe)
- **Database**: MongoDB
- **Integrazioni**: Brevo (email), ReportLab (PDF), BeautifulSoup (scraping federazioni)

## Asset Pubblicazione (acquisiti)
- **Domini**: registrateam.it (principale), registrateam.com, registrateam.net
- **Email**: 
  - info@registrateam.it (contatto commerciale)
  - assistenza@registrateam.it (supporto utenti)
  - registrateam@gmail.com (operativo interno: Brevo, Stripe, fornitori)

## File Bloccati
Vedi `/app/memory/LOCKED_FILES.md`

## Completato 25/04/2026:
- Banner soglie 5k/15k unificati (Dirigente/Coach/Collaboratore + viste Admin):
  - Stile bordato/centrato unico, mese superamento in **grassetto**
  - Colori coerenti tra anno 1 e anno 2 (arancio per 5k, viola per 15k)
  - Banner "Dichiarazione firmata" con stile bordato verde (anno 1) / azzurro (anno 2)
  - Rimossi badge SUPERAMENTO inline ridondanti dentro al riepilogo annuo
- Backend: aggiunto `threshold_month` nel response API `/threshold-status` per dirigente/coach/collaboratore (logica di proiezione su tutti i mesi del contratto)

## ⏰ DA RICORDARE ALL'UTENTE (richiesto 25/04/2026):
- **L'utente vuole controllare ancora il ruolo Dirigente**: testare flussi/pagine non ancora verificati. Quando torna, chiedere: "Hai detto che volevi controllare se il dirigente ha altre cose da testare. Vuoi farlo ora?"

## Completato 23/04/2026:
- Fix calcolo "Somma supplementare" viste Admin (coach, dirigente, collaboratore)
- Fix pagina bianca admin/collaboratore e admin/dirigente
- Calcolo mese superamento soglia basato su cumulativo reale
- Testo "Con la quietanza del mese di [Mese]..." su tutte le figure
- Timestamp PDF ora italiana su tutte le figure
- Consensi Privacy collassabili per tutte le figure
- Campanella notifiche dashboard genitore
- Email invito generica "Gentile Utente"
- Dirigenti in lista "Staff in Attesa di Approvazione"
- Dashboard dirigente: solo squadre assegnate
- Fix calcolo CF per nati all'estero
- Fix salvataggio profilo dirigente/coach prima di firma privacy
- Presentazione dettagliata HTML + 7 Manuali d'uso per ruolo
- Flyer promozionale A4 con accesso gratuito fino 30/06/2027

## Completato 19/04/2026:
- Download Registro CSV funzionante
- Fix solleciti pagamento
- Fix creazione squadra (date)
- Biglietto da visita con P.IVA

## IN SOSPESO (prossima sessione):
- Privacy Livia: cancellare e rifirmare, verificare dati nel PDF
- Mese soglia: il banner mostra mese sbagliato, investigare build
- Banner previsione €15k dove manca

## Task Futuri:
- (P1) Fix toggle override certificato (mobile web)
- (P1) Re-importazione Excel calendario per aggiornamento date partite
- (P1) UI per atleti con contratti formali
- (P2) Refactoring server.py monolitico
- (P2) Re-implementazione Stripe
- (P2) Pubblicazione dominio/App Store
- (P3) Upload screenshot per rimozione foto
