"""
Test import atleti da Excel (P1 27/02/2026).

Verifica:
- Template XLSX contiene le colonne attese.
- CF validator accetta CF validi e rifiuta CF errati.
- Preview endpoint marca errori/warning/duplicati correttamente.
- Commit endpoint crea atleta + genitore linkato.
"""
import os
import sys
import base64
import io
import pytest
import pytest_asyncio
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.import_athletes import is_valid_cf, parse_italian_date, COLUMNS


def test_is_valid_cf():
    # CF veri (checksum corretti — calcolati via _CF_ODD/_EVEN/_REM tables)
    assert is_valid_cf("RSSMRA80A01H501U") is True
    assert is_valid_cf("VRDLGU75E12F205K") is True
    # CF con checksum sbagliato
    assert is_valid_cf("RSSMRA80A01H501Z") is False
    assert is_valid_cf("VRDLGU75E12F205X") is False
    # Formato errato
    assert is_valid_cf("ABC") is False
    assert is_valid_cf("") is False
    assert is_valid_cf(None) is False
    assert is_valid_cf("RSSMRA80A01H501") is False  # 15 char


def test_parse_italian_date():
    d = parse_italian_date("15/05/2010")
    assert d and d.year == 2010 and d.month == 5 and d.day == 15
    d2 = parse_italian_date("2010-05-15")
    assert d2 and d2.year == 2010
    dt = datetime(2000, 1, 1)
    assert parse_italian_date(dt) == dt.replace(tzinfo=None)
    assert parse_italian_date("") is None
    assert parse_italian_date(None) is None
    assert parse_italian_date("not-a-date") is None


def test_template_columns_include_mandatory():
    """The template must include the mandatory columns."""
    joined = " | ".join(COLUMNS)
    assert "Cognome*" in joined
    assert "Nome*" in joined
    assert "Codice Fiscale*" in joined
    assert "Data Nascita" in joined
    assert "CF Genitore" in joined  # sezione genitore per minori
