"""
🆕 24/02/2026 — Cartella router modulari per il refactoring graduale di server.py.

Strategia di estrazione: ogni nuova feature o riscrittura di una sezione viene
collocata qui invece che in server.py monolitico. Cartelle finali previste:

  routers/auth.py            — login, register, password reset
  routers/users.py           — admin user management
  routers/athletes.py        — atleti CRUD
  routers/parents.py         — genitori CRUD + linking
  routers/teams.py           — squadre, calendari
  routers/compensation.py    — compensi, soglie 5k/15k
  routers/documents.py       — PDF generation, GDPR, firme
  routers/payments.py        — pagamenti, rate
  routers/notifications.py   — Brevo email
  routers/admin.py           — endpoint admin-only

Convenzione: ogni router esporta una variabile `router` (APIRouter) che viene
montata in server.py con `api_router.include_router(routers.<modulo>.router)`.
"""
