"""
Test suite for Settings API - Testing sport_praticato field fix
Tests: GET /api/settings/society, PATCH /api/settings/society
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://compliance-signing.preview.emergentagent.com').rstrip('/')

# Test credentials from request
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "11092012"


class TestSocietySettings:
    """Tests for society settings endpoints - specifically sport_praticato field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self):
        """Login and get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_health_check(self):
        """Test basic health check endpoint"""
        response = self.session.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")
    
    def test_get_society_settings_public(self):
        """Test GET /api/settings/society - public endpoint (no auth needed)"""
        response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        
        data = response.json()
        # Verify sport_praticato field exists in response
        assert "sport_praticato" in data, "sport_praticato field missing from GET response"
        
        # Verify other expected fields
        expected_fields = ["name", "logo", "logo_size", "athlete_roles", 
                          "athlete_characteristics", "dirigente_qualifications",
                          "ragione_sociale", "address", "postal_code", "city",
                          "province", "fiscal_code", "phone", "phone2", 
                          "president_name", "stamp_signature"]
        
        for field in expected_fields:
            assert field in data, f"Field {field} missing from response"
        
        print(f"✓ GET /api/settings/society returns all expected fields including sport_praticato")
        print(f"  Current sport_praticato value: {data.get('sport_praticato')}")
        return data
    
    def test_login_admin(self):
        """Test admin login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Admin login successful - role: {data['user'].get('role')}")
        return data.get("token")
    
    def test_patch_society_settings_sport_praticato(self):
        """Test PATCH /api/settings/society with sport_praticato field"""
        token = self.get_auth_token()
        if not token:
            pytest.skip("Could not get auth token")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First, get current settings
        get_response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert get_response.status_code == 200
        original_data = get_response.json()
        original_sport = original_data.get("sport_praticato")
        
        # Update sport_praticato field with a test value
        test_sport_value = "Pallavolo Test"
        patch_response = self.session.patch(f"{BASE_URL}/api/settings/society", json={
            "sport_praticato": test_sport_value
        })
        
        assert patch_response.status_code == 200, f"PATCH failed: {patch_response.text}"
        print(f"✓ PATCH /api/settings/society accepted sport_praticato field")
        
        # Verify the change persisted by doing a GET
        verify_response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert verify_response.status_code == 200
        updated_data = verify_response.json()
        
        assert updated_data.get("sport_praticato") == test_sport_value, \
            f"sport_praticato not saved correctly. Expected: {test_sport_value}, Got: {updated_data.get('sport_praticato')}"
        
        print(f"✓ sport_praticato field persisted correctly: {updated_data.get('sport_praticato')}")
        
        # Restore original value if it was different
        if original_sport and original_sport != test_sport_value:
            self.session.patch(f"{BASE_URL}/api/settings/society", json={
                "sport_praticato": original_sport
            })
            print(f"✓ Restored original sport_praticato value: {original_sport}")
    
    def test_patch_society_settings_multiple_fields(self):
        """Test PATCH with multiple fields including sport_praticato"""
        token = self.get_auth_token()
        if not token:
            pytest.skip("Could not get auth token")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get original values
        get_response = self.session.get(f"{BASE_URL}/api/settings/society")
        original_data = get_response.json()
        
        # Update multiple fields
        test_data = {
            "sport_praticato": "Pallavolo",
            "ragione_sociale": "ASD Test Society",
            "city": "Test City"
        }
        
        patch_response = self.session.patch(f"{BASE_URL}/api/settings/society", json=test_data)
        assert patch_response.status_code == 200
        
        # Verify all fields saved
        verify_response = self.session.get(f"{BASE_URL}/api/settings/society")
        updated_data = verify_response.json()
        
        for field, value in test_data.items():
            assert updated_data.get(field) == value, \
                f"Field {field} not saved correctly. Expected: {value}, Got: {updated_data.get(field)}"
        
        print("✓ Multiple fields including sport_praticato saved correctly")
        
        # Restore original values
        restore_data = {
            "sport_praticato": original_data.get("sport_praticato") or "",
            "ragione_sociale": original_data.get("ragione_sociale") or "",
            "city": original_data.get("city") or ""
        }
        self.session.patch(f"{BASE_URL}/api/settings/society", json=restore_data)
        print("✓ Original values restored")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
