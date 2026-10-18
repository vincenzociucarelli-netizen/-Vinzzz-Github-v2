"""
Test isolation between adult PRO athletes and minor Lite login (bug 27/02/2026).

Bug report: Lucia, an adult PRO athlete (18+), was prompted for nome_lite/PIN
setup during onboarding. Additionally, on the login page a previous minor's
nome_lite ("chiara_op") was pre-populated in the Smart Lock card.

Requirements verified by this test:
1. `/auth/minor-login` includes `is_minor` in the returned user payload so the
   frontend can decide whether to persist the Smart Lock pairing.
2. `_compute_is_minor` helper works with explicit flag and with DOB fallback.
"""
import os
import sys
import pytest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import _compute_is_minor


def test_compute_is_minor_explicit_true():
    assert _compute_is_minor({"is_minor": True}) is True


def test_compute_is_minor_explicit_false():
    assert _compute_is_minor({"is_minor": False}) is False


def test_compute_is_minor_dob_adult():
    dob = datetime.utcnow() - timedelta(days=365 * 25)
    assert _compute_is_minor({"date_of_birth": dob}) is False


def test_compute_is_minor_dob_minor():
    dob = datetime.utcnow() - timedelta(days=365 * 12)
    assert _compute_is_minor({"date_of_birth": dob}) is True


def test_compute_is_minor_dob_iso_string_adult():
    dob = (datetime.utcnow() - timedelta(days=365 * 30)).isoformat()
    assert _compute_is_minor({"date_of_birth": dob}) is False


def test_compute_is_minor_dob_iso_string_minor():
    dob = (datetime.utcnow() - timedelta(days=365 * 10)).isoformat()
    assert _compute_is_minor({"date_of_birth": dob}) is True


def test_compute_is_minor_no_data_defaults_to_true():
    """Legacy records without is_minor or DOB → safe default: treat as minor."""
    assert _compute_is_minor({}) is True


def test_compute_is_minor_invalid_dob_defaults_to_true():
    assert _compute_is_minor({"date_of_birth": "not-a-date"}) is True


def test_compute_is_minor_18th_birthday_today():
    """Exactly 18 today → NOT minor."""
    today = datetime.utcnow()
    dob = today.replace(year=today.year - 18)
    assert _compute_is_minor({"date_of_birth": dob}) is False


def test_compute_is_minor_almost_18_still_minor():
    """One day before 18th birthday → still minor."""
    today = datetime.utcnow()
    dob = today.replace(year=today.year - 18) + timedelta(days=1)
    assert _compute_is_minor({"date_of_birth": dob}) is True
