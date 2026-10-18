"""
Test unitari per la Regola dei Quartili Settimanali (Fase 2 Riepilogo Compensi Unificato).
Verifica il calcolo proporzionale del compenso in mesi parziali di contratto.
PRD reference: /app/memory/PRD.md sezione "13/06/2026 — Pianificazione Riepilogo Compensi Unificato".
"""
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import (
    _calculate_proportional_amount_quartile,
    _calculate_ras_total,
    _calculate_fiscal_year_total,
    _parse_contract_date,
)


# ─────────── QUARTILE BASE ───────────

def test_full_month_returns_100_percent():
    """Mese pieno di contratto → quartile 4 → 100% del compenso."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 1, 1), date(2026, 12, 31), 300.0, 2026, 6
    )
    assert q == 4
    assert amount == 300.0


def test_partial_october_24_days_returns_75_percent():
    """PRD: contratto 08/10→31/10 (24 giorni di 31) → quartile 3 → 75% (€225 su €300)."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 10, 8), date(2026, 12, 31), 300.0, 2026, 10
    )
    assert q == 3
    assert amount == 225.0


def test_partial_october_6_days_returns_25_percent():
    """PRD: contratto 26/10→31/10 (6 giorni di 31) → quartile 1 → 25% (€75 su €300)."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 10, 26), date(2026, 12, 31), 300.0, 2026, 10
    )
    assert q == 1
    assert amount == 75.0


def test_half_month_returns_50_percent():
    """Esempio: contratto inizia il 16/06 (15gg di 30) → 50% (€150 su €300)."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 6, 16), date(2026, 12, 31), 300.0, 2026, 6
    )
    assert q == 2
    assert amount == 150.0


def test_month_outside_contract_returns_zero():
    """Mese prima dell'inizio contratto → 0."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 6, 1), date(2026, 12, 31), 300.0, 2026, 3
    )
    assert q == 0
    assert amount == 0.0


def test_month_after_contract_end_returns_zero():
    """Mese dopo la fine contratto → 0."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 1, 1), date(2026, 6, 30), 300.0, 2026, 9
    )
    assert q == 0
    assert amount == 0.0


def test_zero_monthly_amount_returns_zero():
    """Compenso 0 → 0 anche se contratto valido."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 1, 1), date(2026, 12, 31), 0.0, 2026, 6
    )
    assert q == 0
    assert amount == 0.0


def test_no_contract_start_returns_zero():
    """Nessuna data inizio contratto → 0."""
    amount, q = _calculate_proportional_amount_quartile(
        None, date(2026, 12, 31), 300.0, 2026, 6
    )
    assert q == 0
    assert amount == 0.0


def test_open_ended_contract_no_end_date():
    """Contratto senza data fine → assume aperto, mese pieno calcolato."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 1, 1), None, 300.0, 2026, 6
    )
    assert q == 4
    assert amount == 300.0


def test_february_28_days_full_month():
    """Febbraio 28gg pieno → quartile 4 → 100%."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 1, 1), date(2026, 12, 31), 280.0, 2026, 2
    )
    assert q == 4
    assert amount == 280.0


def test_february_15_days_returns_around_50():
    """Febbraio dal 14/02 (15gg di 28) → quartile 2 → 50%."""
    amount, q = _calculate_proportional_amount_quartile(
        date(2026, 2, 14), date(2026, 12, 31), 280.0, 2026, 2
    )
    assert q == 2
    assert amount == 140.0


# ─────────── RAS TOTAL ───────────

def test_ras_total_full_year_contract():
    """Contratto 01/09/2026 → 30/06/2027 con €300/mese.
    10 mesi pieni (Set+Ott+Nov+Dic+Gen+Feb+Mar+Apr+Mag+Giu) = €3000.
    """
    result = _calculate_ras_total(date(2026, 9, 1), date(2027, 6, 30), 300.0)
    assert result["total"] == 3000.0
    assert len(result["breakdown"]) == 10


def test_ras_total_with_partial_months():
    """Contratto 08/10/2026 → 25/05/2027 con €300/mese.
    Ott: 24gg → 75% = €225
    Nov-Apr: 6 mesi pieni → 6×€300 = €1800
    Mag: 25gg di 31 → 25/7.75≈3.23 → 3 → 75% = €225
    Tot: 225 + 1800 + 225 = €2250
    """
    result = _calculate_ras_total(date(2026, 10, 8), date(2027, 5, 25), 300.0)
    assert result["total"] == 2250.0


def test_ras_total_no_end_date_returns_zero():
    """Senza data fine → RAS non calcolabile → 0."""
    assert _calculate_ras_total(date(2026, 1, 1), None, 300.0)["total"] == 0.0


# ─────────── FISCAL YEAR TOTAL ───────────

def test_fiscal_year_total_full_year():
    """Contratto attivo tutto l'anno 2026 → 12 mesi × 300 = 3600."""
    result = _calculate_fiscal_year_total(
        date(2026, 1, 1), date(2026, 12, 31), 300.0, 2026
    )
    assert result["total"] == 3600.0
    assert len(result["breakdown"]) == 12
    assert all(b["quartile"] == 4 for b in result["breakdown"])


def test_fiscal_year_total_contract_starts_mid_year():
    """Contratto 08/10/2026 → 30/06/2027, anno fiscale 2026:
    Gen-Set: 0 (fuori contratto)
    Ott: 75% (€225)
    Nov: 100% (€300)
    Dic: 100% (€300)
    Tot 2026: €825
    """
    result = _calculate_fiscal_year_total(
        date(2026, 10, 8), date(2027, 6, 30), 300.0, 2026
    )
    assert result["total"] == 825.0


def test_fiscal_year_next_year_split():
    """Contratto 08/10/2026 → 30/06/2027, anno fiscale 2027:
    Gen-Mag: 5 × 300 = 1500
    Giu: 100% (30gg pieni) = 300
    Lug-Dic: 0
    Tot 2027: €1800
    """
    result = _calculate_fiscal_year_total(
        date(2026, 10, 8), date(2027, 6, 30), 300.0, 2027
    )
    assert result["total"] == 1800.0


# ─────────── DATE PARSING ───────────

def test_parse_contract_date_iso_string():
    assert _parse_contract_date("2026-10-08") == date(2026, 10, 8)


def test_parse_contract_date_with_time():
    assert _parse_contract_date("2026-10-08T12:00:00") == date(2026, 10, 8)


def test_parse_contract_date_none():
    assert _parse_contract_date(None) is None
    assert _parse_contract_date("") is None


def test_parse_contract_date_invalid():
    assert _parse_contract_date("not-a-date") is None
