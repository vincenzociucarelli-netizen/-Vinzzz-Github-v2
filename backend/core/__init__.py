"""
🆕 24/02/2026 — Cartella core con infrastructure code.

Contiene tutto ciò che NON è business logic ma serve a tutta l'app:

  core/config.py        — variabili env, settings runtime
  core/database.py      — connessione MongoDB + indici
  core/security.py      — JWT, password hashing (bcrypt), token validation
  core/dependencies.py  — get_current_user, role guards (richiesti da tutti i router)
  core/scheduler.py     — APScheduler (certificate expiry, pre-season reminders)
  core/exceptions.py    — custom HTTPException standardizzate
"""
