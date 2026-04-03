"""
Test GDPR Consent Flow for Minors
Tests:
1. POST /api/trial/accept-privacy/{athlete_id} - accepts JSON body with images_internal, images_promo
2. PATCH /api/athletes/{athlete_id}/consents - revoke flow with revoked_at and action:'revoked'
3. GET /api/athletes/{athlete_id}/consents - returns consents with child_id and consent_history
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://registrateam-vol.preview.emergentagent.com")

# Test credentials
PARENT_EMAIL = "sofia@test.com"
PARENT_PASSWORD = "Test1234"

# Athlete IDs
ISA_ID = "69c2d1d275b58dd02e9e0cb5"
PIA_ID = "69c38ee1dc8c8fca3147c54a"
PAOLA_ID = "69c53f9b1a1af30ec944f9d0"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for Sofia (parent)"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestAcceptPrivacyEndpoint:
    """Test POST /api/trial/accept-privacy/{athlete_id} with consent body"""
    
    def test_accept_privacy_with_both_consents_true(self, auth_headers):
        """Test accept-privacy with images_internal=true and images_promo=true"""
        # Use PAOLA who has privacy_accepted=false
        response = requests.post(
            f"{BASE_URL}/api/trial/accept-privacy/{PAOLA_ID}",
            headers=auth_headers,
            json={
                "images_internal": True,
                "images_promo": True,
                "document_version": "2.0.0-GDPR-TEST"
            }
        )
        assert response.status_code == 200, f"Accept privacy failed: {response.text}"
        data = response.json()
        
        # Verify response - endpoint returns message and status
        assert data.get("status") == "active" or data.get("message") is not None, f"Unexpected response: {data}"
        print(f"Accept privacy response: {data}")
    
    def test_verify_consents_saved_after_accept_privacy(self, auth_headers):
        """Verify consents were saved correctly after accept-privacy"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PAOLA_ID}/consents",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get consents failed: {response.text}"
        data = response.json()
        
        consents = data.get("consents", {})
        consent_history = data.get("consent_history", [])
        
        # Verify privacy_viewed consent has child_id
        privacy_viewed = consents.get("privacy_viewed", {})
        assert privacy_viewed.get("value") is True, "privacy_viewed should be True"
        assert privacy_viewed.get("child_id") == PAOLA_ID, f"privacy_viewed should have child_id={PAOLA_ID}"
        assert privacy_viewed.get("user_id") is not None, "privacy_viewed should have user_id"
        assert privacy_viewed.get("timestamp") is not None, "privacy_viewed should have timestamp"
        assert privacy_viewed.get("ip_address") is not None, "privacy_viewed should have ip_address"
        assert privacy_viewed.get("document_version") is not None, "privacy_viewed should have document_version"
        
        # Verify data_processing_sports consent has child_id
        data_processing = consents.get("data_processing_sports", {})
        assert data_processing.get("value") is True, "data_processing_sports should be True"
        assert data_processing.get("child_id") == PAOLA_ID, f"data_processing_sports should have child_id={PAOLA_ID}"
        
        # Verify images_internal consent has child_id
        images_internal = consents.get("images_internal", {})
        assert images_internal.get("value") is True, "images_internal should be True"
        assert images_internal.get("child_id") == PAOLA_ID, f"images_internal should have child_id={PAOLA_ID}"
        
        # Verify images_promo consent has child_id
        images_promo = consents.get("images_promo", {})
        assert images_promo.get("value") is True, "images_promo should be True"
        assert images_promo.get("child_id") == PAOLA_ID, f"images_promo should have child_id={PAOLA_ID}"
        
        # Verify consent_history has initial_acceptance entry with child_id
        initial_entry = None
        for entry in consent_history:
            if entry.get("action") == "initial_acceptance":
                initial_entry = entry
                break
        
        assert initial_entry is not None, "consent_history should have initial_acceptance entry"
        assert initial_entry.get("child_id") == PAOLA_ID, f"initial_acceptance should have child_id={PAOLA_ID}"
        assert initial_entry.get("user_id") is not None, "initial_acceptance should have user_id"
        assert initial_entry.get("ip_address") is not None, "initial_acceptance should have ip_address"
        
        consents_given = initial_entry.get("consents_given", {})
        assert consents_given.get("privacy_viewed") is True, "consents_given should have privacy_viewed=True"
        assert consents_given.get("data_processing_sports") is True, "consents_given should have data_processing_sports=True"
        assert consents_given.get("images_internal") is True, "consents_given should have images_internal=True"
        assert consents_given.get("images_promo") is True, "consents_given should have images_promo=True"
        
        print(f"Consents verified: {consents}")
        print(f"Consent history verified: {consent_history}")
    
    def test_verify_athlete_activated_after_accept_privacy(self, auth_headers):
        """Verify athlete status is 'active' after accept-privacy"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PAOLA_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get athlete failed: {response.text}"
        data = response.json()
        
        assert data.get("privacy_accepted") is True, "privacy_accepted should be True"
        assert data.get("status") == "active", f"status should be 'active', got: {data.get('status')}"
        print(f"Athlete status verified: privacy_accepted={data.get('privacy_accepted')}, status={data.get('status')}")


class TestRevokeConsentsEndpoint:
    """Test PATCH /api/athletes/{athlete_id}/consents - revoke flow"""
    
    def test_revoke_images_promo_consent(self, auth_headers):
        """Test revoking images_promo consent - should save revoked_at and action:'revoked'"""
        # First ensure images_promo is True (grant it)
        grant_response = requests.patch(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers,
            json={"images_promo": True}
        )
        assert grant_response.status_code == 200, f"Grant consent failed: {grant_response.text}"
        print(f"Granted images_promo=True: {grant_response.json()}")
        
        # Now revoke it
        revoke_response = requests.patch(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers,
            json={"images_promo": False}
        )
        assert revoke_response.status_code == 200, f"Revoke consent failed: {revoke_response.text}"
        revoke_data = revoke_response.json()
        
        # Verify revoked_at is set in the consent
        consents = revoke_data.get("consents", {})
        images_promo = consents.get("images_promo", {})
        assert images_promo.get("value") is False, "images_promo value should be False"
        assert images_promo.get("revoked_at") is not None, "images_promo should have revoked_at timestamp"
        assert images_promo.get("child_id") == PIA_ID, f"images_promo should have child_id={PIA_ID}"
        
        print(f"Revoked images_promo: {images_promo}")
    
    def test_verify_revoke_history_entry(self, auth_headers):
        """Verify consent_history has action:'revoked' entry with child_id"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get consents failed: {response.text}"
        data = response.json()
        
        consent_history = data.get("consent_history", [])
        
        # Find the most recent revoked entry for images_promo
        revoked_entries = [
            entry for entry in consent_history 
            if entry.get("type") == "images_promo" and entry.get("action") == "revoked"
        ]
        
        assert len(revoked_entries) > 0, "Should have at least one revoked entry for images_promo"
        
        latest_revoked = revoked_entries[-1]
        assert latest_revoked.get("action") == "revoked", "action should be 'revoked'"
        assert latest_revoked.get("child_id") == PIA_ID, f"revoked entry should have child_id={PIA_ID}"
        assert latest_revoked.get("old_value") is True, "old_value should be True"
        assert latest_revoked.get("new_value") is False, "new_value should be False"
        assert latest_revoked.get("user_id") is not None, "revoked entry should have user_id"
        assert latest_revoked.get("ip_address") is not None, "revoked entry should have ip_address"
        assert latest_revoked.get("timestamp") is not None, "revoked entry should have timestamp"
        
        print(f"Revoked history entry verified: {latest_revoked}")
    
    def test_revoke_images_internal_consent(self, auth_headers):
        """Test revoking images_internal consent"""
        # First ensure images_internal is True
        grant_response = requests.patch(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers,
            json={"images_internal": True}
        )
        assert grant_response.status_code == 200, f"Grant consent failed: {grant_response.text}"
        
        # Now revoke it
        revoke_response = requests.patch(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers,
            json={"images_internal": False}
        )
        assert revoke_response.status_code == 200, f"Revoke consent failed: {revoke_response.text}"
        revoke_data = revoke_response.json()
        
        consents = revoke_data.get("consents", {})
        images_internal = consents.get("images_internal", {})
        assert images_internal.get("value") is False, "images_internal value should be False"
        assert images_internal.get("revoked_at") is not None, "images_internal should have revoked_at timestamp"
        assert images_internal.get("child_id") == PIA_ID, f"images_internal should have child_id={PIA_ID}"
        
        print(f"Revoked images_internal: {images_internal}")
    
    def test_verify_images_internal_revoke_history(self, auth_headers):
        """Verify consent_history has action:'revoked' entry for images_internal"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        consent_history = data.get("consent_history", [])
        
        revoked_entries = [
            entry for entry in consent_history 
            if entry.get("type") == "images_internal" and entry.get("action") == "revoked"
        ]
        
        assert len(revoked_entries) > 0, "Should have at least one revoked entry for images_internal"
        
        latest_revoked = revoked_entries[-1]
        assert latest_revoked.get("action") == "revoked", "action should be 'revoked'"
        assert latest_revoked.get("child_id") == PIA_ID, f"revoked entry should have child_id={PIA_ID}"
        
        print(f"images_internal revoked history entry verified: {latest_revoked}")


class TestGetConsentsEndpoint:
    """Test GET /api/athletes/{athlete_id}/consents"""
    
    def test_get_consents_returns_child_id(self, auth_headers):
        """Verify GET consents returns child_id in each consent entry"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PAOLA_ID}/consents",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get consents failed: {response.text}"
        data = response.json()
        
        consents = data.get("consents", {})
        
        # Check each consent has child_id
        for consent_type, consent_data in consents.items():
            if isinstance(consent_data, dict):
                assert consent_data.get("child_id") == PAOLA_ID, \
                    f"{consent_type} should have child_id={PAOLA_ID}, got: {consent_data.get('child_id')}"
        
        print(f"All consents have child_id: {list(consents.keys())}")
    
    def test_get_consents_returns_consent_history_with_action(self, auth_headers):
        """Verify GET consents returns consent_history with action field"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get consents failed: {response.text}"
        data = response.json()
        
        consent_history = data.get("consent_history", [])
        assert len(consent_history) > 0, "consent_history should not be empty"
        
        # Check that recent entries have action field
        recent_entries = consent_history[-5:]  # Check last 5 entries
        for entry in recent_entries:
            if entry.get("type") in ["images_promo", "images_internal"]:
                # These should have action field from recent tests
                if entry.get("old_value") is True and entry.get("new_value") is False:
                    assert entry.get("action") == "revoked", \
                        f"Entry should have action='revoked': {entry}"
                elif entry.get("new_value") is True:
                    assert entry.get("action") in ["granted", None], \
                        f"Entry should have action='granted' or None: {entry}"
        
        print(f"Consent history entries verified: {len(consent_history)} entries")
    
    def test_get_consents_returns_consent_history_with_child_id(self, auth_headers):
        """Verify GET consents returns consent_history with child_id"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PIA_ID}/consents",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        consent_history = data.get("consent_history", [])
        
        # Check recent entries have child_id
        recent_entries = consent_history[-5:]
        for entry in recent_entries:
            if entry.get("action") in ["revoked", "granted"]:
                assert entry.get("child_id") == PIA_ID, \
                    f"History entry should have child_id={PIA_ID}: {entry}"
        
        print(f"Consent history child_id verified")


class TestAcceptPrivacyWithFalseConsents:
    """Test accept-privacy with optional consents set to false"""
    
    def test_accept_privacy_with_consents_false(self, auth_headers):
        """Test accept-privacy with images_internal=false and images_promo=false"""
        # Reset PAOLA's privacy_accepted to false first (via direct DB or skip if not possible)
        # For this test, we'll use ISA who already has privacy_accepted=true
        # We'll verify the endpoint accepts the body correctly
        
        # Test with ISA - even though already accepted, endpoint should still work
        response = requests.post(
            f"{BASE_URL}/api/trial/accept-privacy/{ISA_ID}",
            headers=auth_headers,
            json={
                "images_internal": False,
                "images_promo": False,
                "document_version": "2.0.0-GDPR-TEST-FALSE"
            }
        )
        # This should succeed (re-accepting privacy)
        assert response.status_code == 200, f"Accept privacy failed: {response.text}"
        print(f"Accept privacy with false consents: {response.json()}")
    
    def test_verify_false_consents_saved(self, auth_headers):
        """Verify false consents were saved correctly"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{ISA_ID}/consents",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        consents = data.get("consents", {})
        
        # Verify images_internal is False
        images_internal = consents.get("images_internal", {})
        assert images_internal.get("value") is False, "images_internal should be False"
        assert images_internal.get("child_id") == ISA_ID, f"images_internal should have child_id={ISA_ID}"
        
        # Verify images_promo is False
        images_promo = consents.get("images_promo", {})
        assert images_promo.get("value") is False, "images_promo should be False"
        assert images_promo.get("child_id") == ISA_ID, f"images_promo should have child_id={ISA_ID}"
        
        print(f"False consents verified for ISA")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
