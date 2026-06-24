"""
🆕 24/02/2026 — Cartella service per la business logic riusabile.

I services contengono logica condivisa fra router, NON endpoint HTTP.
Esempi pianificati:

  services/threshold_service.py    — calcolo soglie 5k/15k Riforma Sport
  services/pdf_service.py          — generazione PDF GDPR, quietanze, soglie
  services/email_service.py        — wrapper Brevo (transactional)
  services/multitenancy.py         — helper per filtrare per society_id
                                     (centralizza il fix multi-tenancy applicato
                                      a 5 endpoint GDPR il 24/02/2026)

Convenzione: funzioni pure async, prendono `db` come parametro o usano dependency
injection FastAPI. NO accesso diretto a global state.
"""
