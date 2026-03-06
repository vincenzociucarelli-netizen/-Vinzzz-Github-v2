# RegistraTEAM - Sports Club Management Platform

## Problema Originale
Piattaforma di gestione per società sportive dilettantistiche, con focus su gestione compensi, soglie fiscali/previdenziali, e compliance documentale per Collaboratori, Coach, Dirigenti e Atleti.

## Requisiti Principali
1. Gestione compensi mensili con quietanze firmate digitalmente
2. Monitoraggio soglie €5.000 (previdenziale) e €15.000 (fiscale)
3. Generazione automatica PDF di comunicazione superamento soglie con metadati verificabili
4. Invio email automatico a collaboratore e admin al superamento soglie
5. Gestione multi-anno con reset annuale dei conteggi
6. Supporto compensi pregressi (other_annual_compensation) per il primo anno di contratto

## Architettura
- **Backend**: FastAPI (Python) - `/app/backend/server.py`
- **Frontend**: React Native/Expo - `/app/frontend/`
- **Database**: MongoDB
- **Email**: Brevo/Sendinblue

## Implementazioni Completate

### 6 Marzo 2026
- ✅ Corretto logica soglie: superamento da €5.001 e €15.001 (non €5.000 e €15.000)
- ✅ Uniformato comportamento per Collaboratori, Coach, Dirigenti
- ✅ PDF comunicazione €15k con metadati di verifica (come €5k)
- ✅ Fallback admin_email per tutti i ruoli
- ✅ Fix modal preview per quietanze (più compatto)
- ✅ Fix banner "Dichiarazione richiesta" dopo firma
- ✅ Endpoint DELETE per cancellare ricevute (admin only)

### Sessioni Precedenti
- ✅ Gestione ruolo `dirigente` con login e routing
- ✅ Standardizzazione `ragione_sociale` su tutti i documenti
- ✅ Fix timestamp notifiche
- ✅ Fix data loss su profili
- ✅ Visualizzazione assegnazioni collaboratori
- ✅ Rimozione item obsoleti da checklist admin

## Ruoli Supportati
- **Admin**: Gestione completa
- **Coach**: Profilo, compensi, squadre
- **Collaboratore**: Profilo, compensi, assegnazioni
- **Dirigente**: Profilo, compensi
- **Atleta 18+**: Profilo, documenti

## Soglie Fiscali (Logica Corretta)
```
€0 - €5.000: Esente
€5.001 - €15.000: Contributi INPS (ritenuta ~23%)
€15.001+: IRPEF + INPS (ritenuta ~33%)
```

## File Chiave
- `/app/backend/server.py` - API principale
- `/app/frontend/app/collaboratore/compensation.tsx` - Compensi collaboratore
- `/app/frontend/app/coach/compensation.tsx` - Compensi coach
- `/app/frontend/app/dirigente/compensation.tsx` - Compensi dirigente

## Backlog (P1)
- [ ] Test completo flusso coach superamento €15k
- [ ] Regressione completa Atleti 18+, Coach, Collaboratori
- [ ] Implementazione flussi Minorenni

## Backlog (P2-P3)
- [ ] Fix admin dashboard caricamento intermittente
- [ ] Controllo globale @expo/vector-icons imports
- [ ] Re-integrazione Stripe per prossima stagione
- [ ] Refactoring server.py in moduli

## Credenziali Test
- Admin: `pallavoloperugia@gmail.com` / `password`
- Collaboratore (Dina Lampa): `dina@test.com`
