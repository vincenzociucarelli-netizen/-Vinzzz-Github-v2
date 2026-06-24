# Refactoring Plan — server.py

> Documento creato il 24/02/2026 — RegistraTEAM

## Obiettivo
Spezzare `server.py` (~32.000 righe) in moduli per dominio, **in modo graduale**, senza un big-bang.

## Stato attuale
- ✅ Struttura cartelle creata: `routers/`, `services/`, `core/`
- ⏳ Migrazione moduli: 0% (nessun endpoint estratto ancora)
- 📦 `server.py` resta il punto di ingresso (FastAPI app, scheduler, lifespan)

## Strategia: Estrazione "opportunistica"
Ogni volta che si lavora su una sezione (bug fix o nuova feature), ne approfittiamo per estrarla nel router/service appropriato. Nessuna estrazione "a freddo".

### Esempio pratico
- Vuoi aggiungere **Sgancio Genitori in-season**?
  1. Crea `routers/parents.py` ed esegui il task in quel file (non in server.py)
  2. In `server.py` aggiungi `from .routers import parents` e `api_router.include_router(parents.router)`
  3. Sposta gli endpoint genitori già esistenti in `parents.py` se le righe modificate sono ≤ 200
  4. Lascia in server.py gli endpoint genitori non toccati

### Quando NON estrarre
- Se la modifica è < 50 righe e l'endpoint è isolato in server.py → editi sul posto. Non perdiamo tempo.

## Roadmap (in 5 fasi opzionali)

| Fase | Dominio | Crediti stimati | Priorità |
|------|---------|-----------------|----------|
| R1 ✅ | Setup cartelle base | ~50 crediti | Fatta |
| R2 | `auth.py` + `users.py` | 300-400 | P1 (se cambi auth) |
| R3 | `athletes.py` + `parents.py` + `teams.py` | 400-500 | P2 |
| R4 | `compensation.py` + `documents.py` + `thresholds.py` | 400-500 | P3 |
| R5 | `payments.py` + `notifications.py` + `admin.py` | 300-400 | P4 |

**Totale se completato**: ~1500-2000 crediti distribuiti su 4-5 sessioni separate.

## Anti-patterns da evitare
- ❌ Spostare 8k righe di codice "non toccato" in un router
- ❌ Refactoring puro (rename, ristrutturazione) senza nuova feature/bugfix
- ❌ Cambiare la firma degli endpoint durante l'estrazione
- ❌ Toccare la business logic mentre la sposti

## Convenzioni di import
```python
# server.py (bootstrap)
from .routers import auth, athletes, compensation
api_router.include_router(auth.router)
api_router.include_router(athletes.router)

# routers/athletes.py
from fastapi import APIRouter, Depends
from ..core.dependencies import get_current_user
from ..services.multitenancy import filter_by_society

router = APIRouter(prefix="/athletes", tags=["athletes"])
```

## Cosa NON cambia
- `MONGO_URL`, `DB_NAME` continuano a leggersi da `.env`
- Tutti gli endpoint mantengono il prefisso `/api`
- Auth, JWT, CORS rimangono invariati
- Frontend NON va aggiornato (gli endpoint URL non cambiano)
