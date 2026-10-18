"""
Bug 03/08/2026 — Registrazione atleta MINORENNE da area genitore:
- MINORENNE: privacy NON accettata, consent_images_internal=None, status=pending_trial
- MAGGIORENNE: comportamento originale (privacy_accepted=True, consent_images_internal=True)

Parent credentials: armida.raschi@gmail.com / Test1234
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
PARENT_EMAIL = "armida.raschi@gmail.com"
PARENT_PASSWORD = "Test1234"


@pytest.fixture(scope="module")
def parent_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(parent_token):
    return {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}


def _payload(fiscal_code: str, dob_iso: str, first: str, last: str):
    return {
        "full_name": f"{first} {last}",
        "first_name": first,
        "last_name": last,
        "date_of_birth": dob_iso,
        "birth_place": "Perugia",
        "birth_province": "PG",
        "country_of_birth": "Italia",
        "gender": "M",
        "fiscal_code": fiscal_code,
        "address": "Via Roma 1",
        "postal_code": "06100",
        "city": "Perugia",
        "province": "PG",
        "privacy_accepted": True,
        "consent_privacy_viewed": True,
        "consent_images_internal": True,
        "consent_images_promo": True,
    }


def test_minor_registration_privacy_not_accepted(auth_headers):
    fc = "ZZTESTMIN12X001Y"  # 16 chars, starts with ZZTEST
    payload = _payload(fc, "2012-05-10", "MinorTest", "ZZTEST")
    r = requests.post(f"{BASE_URL}/api/athletes", json=payload, headers=auth_headers)
    assert r.status_code in (200, 201), f"Create minor failed: {r.status_code} {r.text}"
    data = r.json()
    print(f"MINOR response: privacy_accepted={data.get('privacy_accepted')}, "
          f"consent_images_internal={data.get('consent_images_internal')}, "
          f"status={data.get('status')}, is_minor={data.get('is_minor')}, "
          f"consent_privacy_viewed(consents)={data.get('consents',{}).get('privacy_viewed',{}).get('value')}")
    assert data.get("is_minor") is True
    assert data.get("privacy_accepted") is False, "MINORE deve avere privacy_accepted=False"
    assert data.get("consent_images_internal") is None, "MINORE deve avere consent_images_internal=None"
    assert data.get("status") != "active", "MINORE non deve essere 'active' alla registrazione"
    assert data.get("status") == "pending_trial", f"MINORE status atteso 'pending_trial', ottenuto {data.get('status')}"
    # consent nested
    consents = data.get("consents") or {}
    assert consents.get("privacy_viewed", {}).get("value") is False
    assert consents.get("images_internal", {}).get("value") is None


def test_adult_registration_privacy_accepted(auth_headers):
    fc = "ZZTESTADT00X002Y"
    payload = _payload(fc, "2000-05-10", "AdultTest", "ZZTEST")
    r = requests.post(f"{BASE_URL}/api/athletes", json=payload, headers=auth_headers)
    assert r.status_code in (200, 201), f"Create adult failed: {r.status_code} {r.text}"
    data = r.json()
    print(f"ADULT response: privacy_accepted={data.get('privacy_accepted')}, "
          f"consent_images_internal={data.get('consent_images_internal')}, "
          f"status={data.get('status')}, is_minor={data.get('is_minor')}")
    assert data.get("is_minor") is False
    assert data.get("privacy_accepted") is True, "MAGGIORENNE deve mantenere privacy_accepted=True"
    assert data.get("consent_images_internal") is True, "MAGGIORENNE deve mantenere consent_images_internal=True"
    # For adults status stays PENDING (not active either, needs approval)
    assert data.get("status") in ("pending", "active"), f"ADULT status unexpected: {data.get('status')}"
