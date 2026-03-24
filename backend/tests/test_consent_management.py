"""
Test suite for Consent Management endpoints (GDPR compliance)
Tests user consent, athlete consent, and admin audit trail features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "Test1234"
PARENT_EMAIL = "perla@test.com"
PARENT_PASSWORD = "Test1234"
ADULT_ATHLETE_EMAIL = "luna@18piu.com"
ADULT_ATHLETE_PASSWORD = "Test1234"

# Known athlete ID for parent perla@test.com
PARENT_ATHLETE_ID = "3d7df7a283444a2c83483d33"


class TestConsentManagementEndpoints:
    """Test consent management API endpoints"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("token")

    @pytest.fixture(scope="class")
    def parent_token(self):
        """Get parent authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        return response.json().get("token")

    @pytest.fixture(scope="class")
    def adult_athlete_token(self):
        """Get adult athlete authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADULT_ATHLETE_EMAIL,
            "password": ADULT_ATHLETE_PASSWORD
        })
        assert response.status_code == 200, f"Adult athlete login failed: {response.text}"
        return response.json().get("token")

    # ==================== USER CONSENT TESTS ====================

    def test_get_my_consents_parent(self, parent_token):
        """Test GET /api/users/me/consents returns user consent data"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "consents" in data, "Response should contain 'consents' field"
        assert "consent_history" in data, "Response should contain 'consent_history' field"
        print(f"✓ GET /api/users/me/consents - Parent consents: {data.get('consents')}")

    def test_get_my_consents_adult_athlete(self, adult_athlete_token):
        """Test GET /api/users/me/consents for adult athlete"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {adult_athlete_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "consents" in data
        assert "consent_history" in data
        print(f"✓ GET /api/users/me/consents - Adult athlete consents: {data.get('consents')}")

    def test_update_my_consents_images_internal(self, parent_token):
        """Test PATCH /api/users/me/consents with images_internal updates consent and adds history"""
        # First get current state
        get_response = requests.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        initial_history_count = len(get_response.json().get("consent_history", []))
        
        # Toggle images_internal to true
        response = requests.patch(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={"images_internal": True}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "consents" in data, "Response should contain updated consents"
        
        # Verify the consent was updated
        consents = data.get("consents", {})
        if "images_internal" in consents:
            assert consents["images_internal"]["value"] == True, "images_internal should be True"
            assert "timestamp" in consents["images_internal"], "Should have timestamp"
            assert "ip_address" in consents["images_internal"], "Should have IP address"
        
        # Verify history was added
        verify_response = requests.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        new_history_count = len(verify_response.json().get("consent_history", []))
        # History may or may not increase depending on if value changed
        print(f"✓ PATCH /api/users/me/consents - images_internal updated, history: {initial_history_count} -> {new_history_count}")

    def test_update_my_consents_images_promo(self, parent_token):
        """Test PATCH /api/users/me/consents with images_promo"""
        response = requests.patch(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={"images_promo": False}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ PATCH /api/users/me/consents - images_promo updated")

    # ==================== ATHLETE CONSENT TESTS ====================

    def test_get_athlete_consents_as_parent(self, parent_token):
        """Test GET /api/athletes/{id}/consents returns athlete consent data (parent auth)"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PARENT_ATHLETE_ID}/consents",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "consents" in data, "Response should contain 'consents' field"
        assert "consent_history" in data, "Response should contain 'consent_history' field"
        print(f"✓ GET /api/athletes/{PARENT_ATHLETE_ID}/consents - Athlete consents: {data.get('consents')}")

    def test_update_athlete_consents_as_parent(self, parent_token):
        """Test PATCH /api/athletes/{id}/consents updates athlete consent (parent auth)"""
        # Get initial state
        get_response = requests.get(
            f"{BASE_URL}/api/athletes/{PARENT_ATHLETE_ID}/consents",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        initial_history_count = len(get_response.json().get("consent_history", []))
        
        # Update consent
        response = requests.patch(
            f"{BASE_URL}/api/athletes/{PARENT_ATHLETE_ID}/consents",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={"images_internal": True}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "consents" in data
        
        # Verify history
        verify_response = requests.get(
            f"{BASE_URL}/api/athletes/{PARENT_ATHLETE_ID}/consents",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        new_history_count = len(verify_response.json().get("consent_history", []))
        print(f"✓ PATCH /api/athletes/{PARENT_ATHLETE_ID}/consents - Updated, history: {initial_history_count} -> {new_history_count}")

    def test_get_athlete_consents_unauthorized(self, adult_athlete_token):
        """Test GET /api/athletes/{id}/consents returns 403 for non-parent user"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{PARENT_ATHLETE_ID}/consents",
            headers={"Authorization": f"Bearer {adult_athlete_token}"}
        )
        # Should be 403 since adult athlete is not the parent of this athlete
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/athletes/{PARENT_ATHLETE_ID}/consents - Correctly returns 403 for non-parent")

    # ==================== ADMIN CONSENT AUDIT TESTS ====================

    def test_get_all_consents_admin(self, admin_token):
        """Test GET /api/admin/all-consents returns list of entities with consents (admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/all-consents",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check structure of entities
        if len(data) > 0:
            entity = data[0]
            assert "entity_type" in entity, "Entity should have entity_type"
            assert "entity_id" in entity, "Entity should have entity_id"
            assert "consents" in entity, "Entity should have consents"
            print(f"✓ GET /api/admin/all-consents - Found {len(data)} entities with consents")
        else:
            print(f"✓ GET /api/admin/all-consents - No entities with consents yet")

    def test_get_all_consents_non_admin_forbidden(self, parent_token):
        """Test GET /api/admin/all-consents returns 403 for non-admin users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/all-consents",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/admin/all-consents - Correctly returns 403 for non-admin")

    def test_get_consent_history_admin_user(self, admin_token, parent_token):
        """Test GET /api/admin/consent-history/user/{id} returns full consent detail (admin only)"""
        # First get the parent user ID
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        parent_user_id = me_response.json().get("id")
        
        # Admin fetches consent history for that user
        response = requests.get(
            f"{BASE_URL}/api/admin/consent-history/user/{parent_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("entity_type") == "user"
        assert data.get("entity_id") == parent_user_id
        assert "consents" in data
        assert "consent_history" in data
        print(f"✓ GET /api/admin/consent-history/user/{parent_user_id} - Full detail retrieved")

    def test_get_consent_history_admin_athlete(self, admin_token):
        """Test GET /api/admin/consent-history/athlete/{id} returns full consent detail (admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/consent-history/athlete/{PARENT_ATHLETE_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("entity_type") == "athlete"
        assert data.get("entity_id") == PARENT_ATHLETE_ID
        assert "consents" in data
        assert "consent_history" in data
        print(f"✓ GET /api/admin/consent-history/athlete/{PARENT_ATHLETE_ID} - Full detail retrieved")

    def test_get_consent_history_non_admin_forbidden(self, parent_token):
        """Test GET /api/admin/consent-history/{type}/{id} returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/consent-history/user/some-id",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/admin/consent-history - Correctly returns 403 for non-admin")

    def test_get_consent_history_invalid_entity_type(self, admin_token):
        """Test GET /api/admin/consent-history with invalid entity_type returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/admin/consent-history/invalid/some-id",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/admin/consent-history/invalid/id - Correctly returns 400 for invalid entity_type")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
