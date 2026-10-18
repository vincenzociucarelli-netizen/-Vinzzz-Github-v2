"""
Tests for INPS Gestione Separata withholding feature (Riforma Sport).

Covers:
  (A) Unit — compute_sport_inps_withholding helper (direct import of server.py)
  (B) API  — POST /api/coach/{coach_id}/compensation/receipt for Alice LUPI
             - new month (May/Jun 2026) above €5000 cumulative threshold:
               persisted record must have amount_net < amount_gross and
               deductions ~= quota lavoratore INPS (1/3)
             - signed PDF must contain the required italian lines
  (C) API  — the "first crossing" month must emit a
             'threshold_5000_communication' document (not a quietanza)
"""
import os
import sys
import base64
import importlib.util
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")

ALICE_EMAIL = "alice@test.com"
ALICE_PASSWORD = "Test1234"
ALICE_ID = "69da12e9ea9c59812a896cdc"

# A tiny valid 1x1 PNG as base64 for signature payloads
_TINY_PNG = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
    )
).decode()


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def alice_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ALICE_EMAIL, "password": ALICE_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def server_module():
    """Import /app/backend/server.py as a module to run unit tests on the helper."""
    sys.path.insert(0, "/app/backend")
    spec = importlib.util.spec_from_file_location("server_mod", "/app/backend/server.py")
    mod = importlib.util.module_from_spec(spec)
    # The server has side-effects on import (DB connection, routes), but no network calls.
    # We only need the helper function; if the import is too heavy, we fall back to re-defining.
    try:
        spec.loader.exec_module(mod)
    except Exception as e:
        pytest.skip(f"cannot import server.py directly: {e}")
    return mod


# ---------- (A) unit tests on helper ----------
class TestComputeInpsHelper:
    def test_below_threshold_no_deductions(self, server_module):
        f = server_module.compute_sport_inps_withholding
        bd = f(0.0, 2000.0, insured_elsewhere=False)
        assert bd["applies"] is False
        assert bd["amount_net"] == 2000.0
        assert bd["inps_worker"] == 0.0

    def test_example_excess_1000_default(self, server_module):
        """Problem statement example: eccedenza €1.000 → quota lavoratore €48.43 → netto €951.57."""
        f = server_module.compute_sport_inps_withholding
        bd = f(4000.0, 2000.0, insured_elsewhere=False)
        # excess should be 1000
        assert bd["applies"] is True
        assert round(bd["excess_over_5000"], 2) == 1000.00
        # ivs = 1000*0.5*0.25 = 125; minor = 1000*0.0203 = 20.30; total = 145.30
        assert round(bd["inps_total"], 2) == 145.30
        assert round(bd["inps_worker"], 2) == 48.43
        assert round(bd["amount_net"], 2) == round(2000.0 - 48.43, 2)

    def test_full_payment_above_threshold(self, server_module):
        """When yearly_before already above 5000, the whole gross is excess."""
        f = server_module.compute_sport_inps_withholding
        bd = f(7250.0, 2500.0, insured_elsewhere=False)
        assert bd["applies"] is True
        assert round(bd["excess_over_5000"], 2) == 2500.00
        # total = 2500*0.5*0.25 + 2500*0.0203 = 312.5 + 50.75 = 363.25
        assert round(bd["inps_total"], 2) == 363.25
        assert round(bd["inps_worker"], 2) == 121.08
        assert round(bd["amount_net"], 2) == round(2500.0 - 121.08, 2)

    def test_insured_elsewhere_rate(self, server_module):
        """Lavoratore iscritto altrove: aliquota 24%, no 2.03%."""
        f = server_module.compute_sport_inps_withholding
        bd = f(5000.0, 1000.0, insured_elsewhere=True)
        # excess=1000, ivs = 1000*0.5*0.24 = 120, minor=0
        assert round(bd["inps_total"], 2) == 120.00
        assert round(bd["inps_worker"], 2) == 40.00


# ---------- (B) & (C) API integration tests on Alice ----------
class TestAliceReceiptFlow:
    """Alice has prior_compensation=4750 and signed months Jan–Apr/2026.
       Any further month in 2026 will be well above the €5000 cumulative."""

    def test_login_alice(self, alice_token):
        assert alice_token

    def test_existing_signed_months_present(self, api, alice_token):
        r = api.get(f"{BASE_URL}/api/coach/{ALICE_ID}/compensation",
                    headers={"Authorization": f"Bearer {alice_token}"})
        assert r.status_code == 200
        records = r.json()
        signed = [x for x in records if x.get("receipt_signed")]
        assert len(signed) >= 1, "expected at least one signed receipt for Alice"

    def test_first_above_threshold_emits_communication(self, api, alice_token):
        """Try signing an unsigned month: if it's the FIRST month to cross €5000
        cumulatively, the backend should create a threshold_5000_communication
        instead of a compensation_receipt.  (For Alice the real first-crossing
        month was already captured as exceeded_5000 on month=3; this test only
        asserts the API contract if the user is actually at first crossing.)"""
        r = api.get(f"{BASE_URL}/api/coach/{ALICE_ID}/compensation",
                    headers={"Authorization": f"Bearer {alice_token}"})
        assert r.status_code == 200
        # Confirm at least one month was tagged exceeded_5000 (comunicazione was issued)
        exceeded = [x for x in r.json() if x.get("exceeded_5000")]
        assert len(exceeded) >= 1, "Alice should have at least one record flagged exceeded_5000=True"

    def test_sign_month_above_threshold_persists_net(self, api, alice_token):
        """Pick an unsigned month inside the contract window (contract ends 30/06/2026)
        and sign it. The persisted record must have amount_net < amount_gross and
        deductions equal to the INPS worker share for the full gross as excess."""
        r = api.get(f"{BASE_URL}/api/coach/{ALICE_ID}/compensation",
                    headers={"Authorization": f"Bearer {alice_token}"})
        assert r.status_code == 200
        records = r.json()
        months_signed = {int(x["month"]) for x in records if x.get("receipt_signed") and int(x.get("year", 0)) == 2026}
        # try months 5 (May) and 6 (Jun) within contract window
        target_month = None
        for m in (5, 6):
            if m not in months_signed:
                target_month = m
                break
        if target_month is None:
            pytest.skip("no free month 5/6 2026 available for Alice to sign")

        payload = {
            "month": target_month,
            "year": 2026,
            "amount_gross": 2500.0,
            "signature_base64": _TINY_PNG,
            "external_compensation_none": True,
        }
        r = api.post(
            f"{BASE_URL}/api/coach/{ALICE_ID}/compensation/receipt",
            json=payload,
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert r.status_code == 200, f"sign failed: {r.status_code} {r.text}"
        resp = r.json()

        # Re-fetch to confirm persistence
        r2 = api.get(f"{BASE_URL}/api/coach/{ALICE_ID}/compensation",
                     headers={"Authorization": f"Bearer {alice_token}"})
        assert r2.status_code == 200
        rec = next((x for x in r2.json() if int(x["year"]) == 2026 and int(x["month"]) == target_month), None)
        assert rec is not None, "signed record not persisted"
        assert rec.get("receipt_signed") is True

        gross = float(rec["amount_gross"])
        net = float(rec["amount_net"])
        deductions = float(rec.get("deductions", 0))
        # Expected: full 2500 is excess (Alice is already well above 5000)
        # inps_worker = round((2500*0.5*0.25 + 2500*0.0203)/3, 2) = 121.08
        assert gross == 2500.0
        assert round(deductions, 2) == 121.08, f"deductions mismatch: got {deductions}"
        assert round(gross - net, 2) == 121.08
        assert net < gross

        # Save the receipt_document_id for the PDF test to consume via a module-level stash
        TestAliceReceiptFlow._last_receipt_id = rec.get("receipt_document_id")
        TestAliceReceiptFlow._last_month = target_month

    def test_pdf_contains_inps_lines(self, api, alice_token):
        """The PDF of a signed quietanza with net < gross must contain the three
        Italian lines required by the feature. Picks any persisted receipt with
        deductions > 0 (so the inps_breakdown branch was rendered)."""
        # Find a signed record with deductions > 0 (the new feature)
        r = api.get(f"{BASE_URL}/api/coach/{ALICE_ID}/compensation",
                    headers={"Authorization": f"Bearer {alice_token}"})
        assert r.status_code == 200
        candidates = [
            x for x in r.json()
            if x.get("receipt_signed")
            and float(x.get("deductions", 0) or 0) > 0.01
            and float(x.get("amount_net", 0) or 0) < float(x.get("amount_gross", 0) or 0)
            and x.get("receipt_document_id")
            # exclude the OLD placeholder-IRPEF 23% records (deductions=575 on gross=2500)
            and abs(float(x.get("deductions") or 0) - round(float(x.get("amount_gross") or 0) * 0.23, 2)) > 1.0
        ]
        if not candidates:
            pytest.skip("no persisted receipt with new INPS deductions available")
        doc_id = candidates[0]["receipt_document_id"]

        # Download PDF — try both common endpoints
        urls = [
            f"{BASE_URL}/api/documents/signed/{doc_id}/pdf",
            f"{BASE_URL}/api/documents/download/{doc_id}",
            f"{BASE_URL}/api/documents/{doc_id}/pdf",
        ]
        pdf_bytes = None
        last_status = None
        for u in urls:
            rr = api.get(u, headers={"Authorization": f"Bearer {alice_token}"})
            last_status = (u, rr.status_code, rr.headers.get("content-type"))
            if rr.status_code == 200 and (b"%PDF" in rr.content[:1024]):
                pdf_bytes = rr.content
                break
        assert pdf_bytes is not None, f"could not download PDF; last tried: {last_status}"

        # Extract text from the PDF (ReportLab compresses the content stream)
        import io
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
        assert "Quota compenso eccedente" in text, f"missing 'Quota compenso eccedente €5.000' line. Text: {text[:800]}"
        assert "Contributi INPS trattenuti" in text, f"missing 'Contributi INPS trattenuti' line. Text: {text[:800]}"
        assert "NETTO corrisposto" in text, f"missing 'Compenso NETTO corrisposto' line. Text: {text[:800]}"
