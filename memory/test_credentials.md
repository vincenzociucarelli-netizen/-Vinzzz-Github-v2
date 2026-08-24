# Test Credentials

## Admin (persona fisica - può firmare come LR o autorizzato)
- Email: vincenzo.ciucarelli@gmail.com
- Password: Test1234 (resettata 19/07/2026 per test bacheca note admin)

## Genitore (ARMIDA RASCHI) - per test registrazione atleti
- Email: armida.raschi@gmail.com
- Password: Test1234 (resettata 03/08/2026 per test fix privacy minorenni in registrazione)
- Società: Pallavolo Perugia
- 🆕 18/08/2026: collegata come parent_id all'atleta minorenne "MAURI LENA" (id 6a5ec7347c201d9cb7eb70d2, nessun certificato, data_password rimossa) PER TEST FLUSSO CERTIFICATO GENITORE (bug "data certificato non memorizzata").

## Dirigente (LELLA MARZO)
- Email: lella@dir.com
- Password: Test1234 (impostata 27/02/2026 per test libricino istruzioni)
- Nota: role="viewer" nel DB (legacy alias per "dirigente")

## Coordinatore (COORD TEST) — per test dashboard coordinatore (10/08/2026)
- Email: coord.test@registrateam.it
- Password: Test1234
- role="coordinatore", coordinator_permissions=TUTTE, society_id = società con più atleti (preview)
- Usato per verificare che le sezioni (Squadre/Atleti/Allenamenti/Partite/Presenze/Comunicazioni/Eventi/Certificati/GDPR) aprano le pagine admin reali con dati (non 403/Unmatched/login)


- Password: Test1234

## Admin (account intestato alla SOCIETÀ - NON può firmare come LR)
- Email: pallavoloperugia@gmail.com
- Password: Test123
- Nota: il nome profilo è "PALLAVOLO PERUGIA SSD A RL", quindi la modal di dichiarazione disabilita l'opzione "Legale Rappresentante" (può solo firmare come "incaricato" se serve come account operativo)

## Coach (Alice LUPI)
- Email: alice@test.com
- Password: Test1234 (resettata 17/06/2026)
- Note: compenso mensile 2500€, compensi pregressi 4750€, contratto 01/08/2025 - 30/06/2026

## Coach (Vito)
- Email: vito@test.com
- Password: (verificare nel DB)

## Atleta 18+ (Fabia)
- Email: fabia@test.com
- Password: Test1234

## Atleta 18+ (Marco - TEST)
- Email: marcob@test.com
- Password: Test1234
- athlete_id: c0555a97927f4054ae84b1c9
- 🆕 23/08/2026: impostato per TEST FIRMA PRIVACY ATLETA 18+ → is_minor=false, gender=F, date_of_birth=2000-05-10, status=active, privacy_accepted=FALSE (sia user che athlete). Deve comparire il banner "Firma Informativa Privacy" nel profilo atleta.

## Atleta 18+ (Viola Rossi - TEST utente fittizio Pallavolo Perugia)
- Email: viola@test.com
- Password: Test1234
- Società: Pallavolo Perugia SSD
- Squadra: Serie C
- Stato: email_verified=true, is_approved=true (inserito manualmente il 17/05/2026 perché viola@test.com era un placeholder fittizio per test)

## Collaboratore (PAOLI PAOLO)
- Email: paolo@coll.com
- Password: PaoloTest123 (resettata 23/06/2026 per test)
- ID: 69ac95a48e1e15f961f9c86d
- Email: remo@coach.com
- Password: FaroTest123 (resettata 22/06/2026 per test enforcement cronologico)
- Note: compenso mensile 3000€, contratto 01/09/2025 - 30/06/2026, dual-role coach con quietanze firmate fino a Mar 2026.

## Coach (Sara)
- Email: sara@test.com
- Password: (verificare nel DB)

## Atleta COMPENSATO (per test threshold/compensi)
- Email: testalice1780817007@test.com
- Password: Test1234 (resettata 17/06/2026)
- athlete_type: compensated

## ⚠️ Note operative
- Le tabelle `login_rate_limits` bloccano gli account dopo 15 tentativi falliti. Per sbloccare: `db.login_rate_limits.delete_many({})`.
- Il campo password in `users` è `password_hash` (bcrypt), NON `password`. Reset: `bcrypt.hashpw(b'Test1234', bcrypt.gensalt()).decode()`.
