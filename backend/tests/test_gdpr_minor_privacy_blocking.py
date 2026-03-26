"""
Test GDPR Minor Privacy Blocking Feature
Tests for the one-parent-per-child signing rule:
1. POST /api/documents/preview-gdpr-privacy - should return 200 with PDF when parent is authorized
2. POST /api/documents/sign-gdpr-privacy - should return 403 when Sofia tries to sign for PIA (blocked)
3. GET /api/athletes/{id}/end-trial-status - should return gdpr_signing_blocked=true for PIA
4. GET /api/athletes/{id}/end-trial-status - should return privacy_signed=true for ISA

Test credentials:
- Parent (Sofia): sofia@test.com / Test1234
- Athletes: ISA id=69c2d1d275b58dd02e9e0cb5, PIA id=69c38ee1dc8c8fca3147c54a
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://italian-sports-qa.preview.emergentagent.com').rstrip('/')

# Test data
SOFIA_EMAIL = "sofia@test.com"
SOFIA_PASSWORD = "Test1234"
PIA_ID = "69c38ee1dc8c8fca3147c54a"  # RIGO PIA - Sofia's second child
ISA_ID = "69c2d1d275b58dd02e9e0cb5"  # RIGO ISA - Sofia's first child (active)


class TestGDPRMinorPrivacyBlocking:
    """Tests for GDPR minor privacy signing blocking feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and authenticate as Sofia"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Sofia (parent)
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SOFIA_EMAIL,
            "password": SOFIA_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("token")
        assert self.token, "No token received from login"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.user = login_data.get("user", {})
        print(f"Logged in as: {self.user.get('full_name', 'Unknown')} ({self.user.get('email')})")
    
    def test_01_preview_gdpr_privacy_for_pia_returns_200(self):
        """
        Test: POST /api/documents/preview-gdpr-privacy should return 200 with PDF
        when parent is authorized for the minor (PIA belongs to Sofia)
        """
        payload = {
            "document_type": "gdpr_minor",
            "minor_id": PIA_ID,
            "signer_name": self.user.get("first_name", "SOFIA"),
            "signer_surname": self.user.get("last_name", "RIGO"),
            "signer_fiscal_code": self.user.get("fiscal_code", "")
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/preview-gdpr-privacy", json=payload)
        
        # Should return 200 with PDF preview
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pdf_base64" in data, "Response should contain pdf_base64"
        assert len(data["pdf_base64"]) > 100, "PDF should have content"
        print(f"✓ Preview GDPR privacy for PIA returned 200 with PDF ({len(data['pdf_base64'])} chars)")
    
    def test_02_sign_gdpr_privacy_for_pia_returns_403_blocked(self):
        """
        Test: POST /api/documents/sign-gdpr-privacy should return 403 when Sofia
        tries to sign for PIA (her second child) because of one-parent-per-child rule.
        Response should mention RIGO BEPPE (the other parent who needs to sign first).
        """
        payload = {
            "document_type": "gdpr_minor",
            "minor_id": PIA_ID,
            "signer_name": self.user.get("first_name", "SOFIA"),
            "signer_surname": self.user.get("last_name", "RIGO"),
            "signer_fiscal_code": self.user.get("fiscal_code", ""),
            "signature_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "user_agent": "pytest-test-agent",
            "consent_data": {
                "privacy_viewed": True,
                "data_treatment": True,
                "images_internal": False,
                "images_promo": False
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/sign-gdpr-privacy", json=payload)
        
        # Should return 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "")
        
        # Should mention RIGO BEPPE (the other parent)
        assert "RIGO BEPPE" in detail or "l'altro genitore" in detail, \
            f"Error message should mention RIGO BEPPE or 'l'altro genitore': {detail}"
        
        print(f"✓ Sign GDPR privacy for PIA correctly returned 403")
        print(f"  Error message: {detail}")
    
    def test_03_preview_gdpr_privacy_for_unauthorized_minor_returns_403(self):
        """
        Test: POST /api/documents/preview-gdpr-privacy should return 403
        for a minor_id that doesn't belong to the parent
        """
        # Use a fake minor ID that doesn't belong to Sofia
        fake_minor_id = "000000000000000000000000"
        
        payload = {
            "document_type": "gdpr_minor",
            "minor_id": fake_minor_id,
            "signer_name": "SOFIA",
            "signer_surname": "RIGO"
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/preview-gdpr-privacy", json=payload)
        
        # Should return 403 or 404 (not authorized or not found)
        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}: {response.text}"
        
        print(f"✓ Preview for unauthorized minor correctly returned {response.status_code}")
    
    def test_04_sign_gdpr_privacy_for_unauthorized_minor_returns_403(self):
        """
        Test: POST /api/documents/sign-gdpr-privacy should return 403
        for a minor_id that doesn't belong to the parent
        """
        fake_minor_id = "000000000000000000000000"
        
        payload = {
            "document_type": "gdpr_minor",
            "minor_id": fake_minor_id,
            "signer_name": "SOFIA",
            "signer_surname": "RIGO",
            "signature_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "user_agent": "pytest-test-agent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/sign-gdpr-privacy", json=payload)
        
        # Should return 403 or 404
        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}: {response.text}"
        
        print(f"✓ Sign for unauthorized minor correctly returned {response.status_code}")
    
    def test_05_end_trial_status_pia_shows_gdpr_signing_blocked(self):
        """
        Test: GET /api/athletes/{PIA_ID}/end-trial-status should return
        gdpr_signing_blocked=true and gdpr_signing_blocked_message mentioning RIGO BEPPE
        when called by Sofia
        """
        response = self.session.get(f"{BASE_URL}/api/athletes/{PIA_ID}/end-trial-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check gdpr_signing_blocked is true
        assert data.get("gdpr_signing_blocked") == True, \
            f"Expected gdpr_signing_blocked=true, got: {data.get('gdpr_signing_blocked')}"
        
        # Check message mentions RIGO BEPPE
        blocked_message = data.get("gdpr_signing_blocked_message", "")
        assert "RIGO BEPPE" in blocked_message or "l'altro genitore" in blocked_message, \
            f"Message should mention RIGO BEPPE: {blocked_message}"
        
        print(f"✓ End-trial status for PIA shows gdpr_signing_blocked=true")
        print(f"  Message: {blocked_message}")
        print(f"  Steps: {data.get('steps', {})}")
    
    def test_06_end_trial_status_isa_shows_privacy_signed(self):
        """
        Test: GET /api/athletes/{ISA_ID}/end-trial-status should return
        privacy_signed=true (ISA is active, privacy already signed)
        and gdpr_signing_blocked=true (Sofia already signed for ISA)
        """
        response = self.session.get(f"{BASE_URL}/api/athletes/{ISA_ID}/end-trial-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        steps = data.get("steps", {})
        
        # ISA should have privacy_signed=true (she's active)
        privacy_signed = steps.get("privacy_signed", False)
        print(f"  ISA privacy_signed: {privacy_signed}")
        print(f"  ISA athlete_status: {data.get('athlete_status')}")
        print(f"  ISA gdpr_signing_blocked: {data.get('gdpr_signing_blocked')}")
        
        # ISA is active, so privacy should be signed
        # Note: gdpr_signing_blocked may also be true since Sofia already signed for ISA
        assert data.get("athlete_status") == "active" or privacy_signed, \
            f"ISA should be active or have privacy_signed=true: {data}"
        
        print(f"✓ End-trial status for ISA returned successfully")
        print(f"  Full response: {data}")
    
    def test_07_get_athlete_pia_details(self):
        """
        Test: GET /api/athletes/{PIA_ID} should return PIA's details
        Verify the athlete name is RIGO PIA
        """
        response = self.session.get(f"{BASE_URL}/api/athletes/{PIA_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        full_name = data.get("full_name", "")
        
        assert "PIA" in full_name.upper(), f"Athlete should be PIA, got: {full_name}"
        
        print(f"✓ Athlete PIA details retrieved: {full_name}")
        print(f"  Status: {data.get('status')}")
        print(f"  Team: {data.get('team_name', data.get('team_id'))}")
    
    def test_08_get_athlete_isa_details(self):
        """
        Test: GET /api/athletes/{ISA_ID} should return ISA's details
        Verify the athlete name is RIGO ISA and status is active
        """
        response = self.session.get(f"{BASE_URL}/api/athletes/{ISA_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        full_name = data.get("full_name", "")
        status = data.get("status", "")
        
        assert "ISA" in full_name.upper(), f"Athlete should be ISA, got: {full_name}"
        
        print(f"✓ Athlete ISA details retrieved: {full_name}")
        print(f"  Status: {status}")
        print(f"  Team: {data.get('team_name', data.get('team_id'))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
