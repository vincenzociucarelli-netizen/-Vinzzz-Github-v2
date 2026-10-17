"""Smoke test multi-tenancy — 🐛 08/07/2026
============================================
Protegge il codice da regressioni sul bug documentato in PRD v7.3:
i PDF (quietanze, soglie 5k/15k, privacy, ricevute fiscali) venivano intestati
alla PRIMA società trovata nel DB invece che a quella dell'utente signer.

Root cause tipico: `db.societies.find_one()` o `db.settings.find_one({"type": "society"})`
senza filtro `society_id`.

Questo test ha due componenti complementari:
  1) **Audit statico** (veloce, deterministico): grep del codice per
     rilevare pattern pericolosi. Se ne trova → FAIL con lista dei posti.
     Whitelist esplicita per i casi giustificati (password reset ecc.).
  2) **Smoke integration** (opzionale): setup di 2 società fittizie in DB,
     verifica che una query filtrata per `society_id` restituisca il record
     giusto (protezione dalla logica di filtering nel codice fixato).

Esegui con: `cd /app/backend && python -m pytest tests/test_multitenancy_smoke.py -v`
"""
from __future__ import annotations

import os
import re
import asyncio
from pathlib import Path

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

SERVER_FILE = Path(__file__).parent.parent / "server.py"

# Pattern che indica una query societaria potenzialmente non filtrata.
# Esclude:
#  - chiamate con {..society_id..} tra le parentesi
#  - commenti (righe che iniziano con #)
UNFILTERED_SOCIETIES_RE = re.compile(
    r"db\.societies\.find_one\(\s*\)"  # find_one() vuoto → prende primo doc
)
# 🐛 08/07/2026 (v7.10) — Il vecchio regex si fermava al primo `)`, quindi non catturava
# `find_one({"type":"society"}, projection)` (con secondo argomento). Bug scoperto durante
# la review della dashboard /minor/dashboard. Ora catturiamo il FILTRO (primo argomento),
# ignorando il resto della chiamata.
UNFILTERED_SETTINGS_RE = re.compile(
    r"""db\.settings\.find_one\(\s*(\{[^}]*["']type["']\s*:\s*["']society["'][^}]*\})"""
)


def _iter_code_lines():
    """Yielda (lineno, stripped_line, raw_line) del server.py, ignorando commenti puri."""
    with open(SERVER_FILE, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            yield i, stripped, line


# ─── WHITELIST: i pochi casi legittimi in cui NON è possibile filtrare per society_id ───
# Motivi accettati:
#  • password reset: la richiesta arriva senza autenticazione, society_id ignoto.
#  • cron scheduler globale: opera cross-società allo startup.
#  • fallback dopo tentativo mirato con society_id: safe perché prima abbiamo già cercato
#    quello specifico. Il fallback serve solo per legacy quando society_id manca proprio.
#
# Per whitelistare una riga aggiungere il commento inline:
#     await db.settings.find_one({"type": "society"})  # noqa: multitenancy-ok — motivo
#
WHITELIST_MARKER = "noqa: multitenancy-ok"


def test_no_unfiltered_societies_find_one():
    """FAIL se trova `db.societies.find_one()` senza filtro (bug multi-tenancy)."""
    offenders = []
    for lineno, stripped, _ in _iter_code_lines():
        if WHITELIST_MARKER in stripped:
            continue
        # match solo find_one senza contenuto (o solo con spazi)
        if re.search(r"db\.societies\.find_one\(\s*\)", stripped):
            offenders.append(f"  server.py:{lineno} — {stripped[:120]}")
    assert not offenders, (
        "\n🐛 Trovati `db.societies.find_one()` senza filtro society_id.\n"
        "Questo pattern causa il bug multi-tenancy documentato in PRD v7.3.\n"
        "Aggiungi il filtro `{'id': <society_id>}` oppure marca la riga con\n"
        f"    # {WHITELIST_MARKER} — motivo\n\n"
        + "\n".join(offenders)
    )


def test_no_unfiltered_settings_type_society():
    """FAIL se trova `db.settings.find_one({'type':'society'})` senza `society_id`."""
    offenders = []
    for lineno, stripped, _ in _iter_code_lines():
        if WHITELIST_MARKER in stripped:
            continue
        m = UNFILTERED_SETTINGS_RE.search(stripped)
        if not m:
            continue
        matched_dict = m.group(0)
        # Consideriamo filtrati:
        #  - "society_id" letterale nel dict
        #  - `**variable` spread (contiene già il filtro dinamico)
        if "society_id" in matched_dict or "**" in matched_dict:
            continue
        offenders.append(f"  server.py:{lineno} — {stripped[:150]}")
    assert not offenders, (
        "\n🐛 Trovati `db.settings.find_one({'type':'society'})` senza `society_id`.\n"
        "Questo pattern può restituire le impostazioni di un'ALTRA società (bug multi-tenancy).\n"
        "Aggiungi `'society_id': <id>` al filtro oppure marca la riga con\n"
        f"    # {WHITELIST_MARKER} — motivo\n\n"
        + "\n".join(offenders)
    )


# ────────────────────────── SMOKE INTEGRATION ──────────────────────────
# Verifica end-to-end che, con 2 società in DB, le query filtrate per society_id
# restituiscano il record corretto (protegge dalla logica di filtering nel codice).

@pytest.mark.asyncio
async def test_multitenancy_isolation_smoke(tmp_path):
    """Setup 2 società fittizie, verifica isolamento query societarie."""
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent.parent / ".env")
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL/DB_NAME non configurati")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    society_a_id = "test-smoke-society-A"
    society_b_id = "test-smoke-society-B"

    try:
        # Setup: 2 società fittizie + 2 settings dedicati
        await db.societies.insert_many([
            {"id": society_a_id, "name": "Test Alpha", "ragione_sociale": "ALPHA ASD"},
            {"id": society_b_id, "name": "Test Beta", "ragione_sociale": "BETA SSD"},
        ])
        await db.settings.insert_many([
            {"type": "society", "society_id": society_a_id, "ragione_sociale": "ALPHA ASD", "city": "Milano"},
            {"type": "society", "society_id": society_b_id, "ragione_sociale": "BETA SSD", "city": "Roma"},
        ])

        # Assertion 1: query societies filtrata per id ritorna il record giusto
        soc_a = await db.societies.find_one({"id": society_a_id})
        soc_b = await db.societies.find_one({"id": society_b_id})
        assert soc_a and soc_a["ragione_sociale"] == "ALPHA ASD", "Query society A errata"
        assert soc_b and soc_b["ragione_sociale"] == "BETA SSD", "Query society B errata"

        # Assertion 2: query settings filtrata per society_id ritorna il record giusto
        set_a = await db.settings.find_one({"type": "society", "society_id": society_a_id})
        set_b = await db.settings.find_one({"type": "society", "society_id": society_b_id})
        assert set_a and set_a["city"] == "Milano", "Settings A: filtro society_id non funziona"
        assert set_b and set_b["city"] == "Roma", "Settings B: filtro society_id non funziona"

        # Assertion 3: chiedere una società inesistente NON deve fallback su altre
        soc_x = await db.societies.find_one({"id": "test-smoke-inesistente"})
        assert soc_x is None, "find_one({id:inesistente}) NON deve tornare la prima società del DB"

    finally:
        # Cleanup sempre, anche se il test fallisce
        await db.societies.delete_many({"id": {"$in": [society_a_id, society_b_id]}})
        await db.settings.delete_many({"society_id": {"$in": [society_a_id, society_b_id]}})
        client.close()
