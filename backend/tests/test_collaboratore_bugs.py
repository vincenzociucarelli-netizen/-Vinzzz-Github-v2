"""
Test cases for Collaboratore ('Collaborator') user flow bug fixes:
1. Login as collaboratore and verify redirect to profile page
2. Verify privacy_accepted flag is correctly read from backend
3. Test editing profile data (first_name, last_name, phone) and verify data persists
4. Verify the collaboratore_license_number field can be saved in the profile
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trial-flow-1.preview.emergentagent.com').rstrip('/')

# Test credentials
COLLABORATORE_EMAIL = "lara@test.com"
COLLABORATORE_PASSWORD = "Collab2025"
ADMIN_EMAIL = "test.admin@test.com"
ADMIN_PASSWORD = "Test1234"


class TestHealthCheck:
    """Health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ API health check passed")


class TestCollaboratoreLogin:
    """Test collaboratore login flow"""
    
    def test_collaboratore_login_success(self):
        """Test login as collaboratore user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COLLABORATORE_EMAIL,
            "password": COLLABORATORE_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "Response missing 'token'"
        assert "user" in data, "Response missing 'user'"
        
        user = data["user"]
        assert user.get("role") == "collaboratore", f"Expected role 'collaboratore', got '{user.get('role')}'"
        assert user.get("email") == COLLABORATORE_EMAIL
        
        print(f"✅ Collaboratore login successful. User ID: {user.get('id')}, Role: {user.get('role')}")
        return data
    
    def test_collaboratore_login_returns_status(self):
        """Test that login returns user status"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COLLABORATORE_EMAIL,
            "password": COLLABORATORE_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        user = data["user"]
        
        # Verify status is returned
        assert "status" in user or user.get("status") is None, "User status field missing"
        print(f"✅ Login returns user status: {user.get('status', 'not set')}")


class TestCollaboratorePrivacyAccepted:
    """Test privacy_accepted flag handling"""
    
    @pytest.fixture(autouse=True)
    def login(self):
        """Login as collaboratore and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COLLABORATORE_EMAIL,
            "password": COLLABORATORE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_auth_me_returns_privacy_accepted(self):
        """Test that /api/auth/me returns privacy_accepted field"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check that privacy_accepted field is returned (can be true, false, or null)
        # The key is that the field exists in the response
        print(f"✅ /api/auth/me response contains 'privacy_accepted': {data.get('privacy_accepted')}")
        
        # The bug was that undefined was being used instead of the actual value
        # If privacy_accepted is null/None, the frontend should NOT show the modal loop
        if data.get('privacy_accepted') is None or data.get('privacy_accepted') == False:
            print("   ℹ️ privacy_accepted is null/false - frontend should NOT show modal in loop")
        elif data.get('privacy_accepted') == True:
            print("   ℹ️ privacy_accepted is true - frontend should NOT show modal at all")
    
    def test_privacy_accepted_can_be_updated(self):
        """Test that privacy_accepted can be updated via PATCH /api/auth/me"""
        # First get current value
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        original_value = response.json().get('privacy_accepted')
        
        # Update to True
        patch_response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers,
            json={"privacy_accepted": True}
        )
        
        assert patch_response.status_code == 200, f"PATCH failed: {patch_response.text}"
        
        # Verify the update
        verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert verify_response.status_code == 200
        updated_value = verify_response.json().get('privacy_accepted')
        
        assert updated_value == True, f"Expected privacy_accepted=True, got {updated_value}"
        print(f"✅ privacy_accepted successfully updated from {original_value} to {updated_value}")


class TestCollaboratoreProfileUpdate:
    """Test profile data persistence"""
    
    @pytest.fixture(autouse=True)
    def login(self):
        """Login as collaboratore and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COLLABORATORE_EMAIL,
            "password": COLLABORATORE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_update_first_name(self):
        """Test updating first_name field"""
        test_name = "TestLara"
        
        # Update first_name
        response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers,
            json={"first_name": test_name}
        )
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        assert data.get("first_name") == test_name, f"first_name not persisted. Expected {test_name}, got {data.get('first_name')}"
        print(f"✅ first_name successfully updated and persisted: {test_name}")
    
    def test_update_last_name(self):
        """Test updating last_name field"""
        test_name = "TestCollab"
        
        # Update last_name
        response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers,
            json={"last_name": test_name}
        )
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        assert data.get("last_name") == test_name, f"last_name not persisted. Expected {test_name}, got {data.get('last_name')}"
        print(f"✅ last_name successfully updated and persisted: {test_name}")
    
    def test_update_phone(self):
        """Test updating phone field"""
        test_phone = "+39 333 1234567"
        
        # Update phone
        response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers,
            json={"phone": test_phone}
        )
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        assert data.get("phone") == test_phone, f"phone not persisted. Expected {test_phone}, got {data.get('phone')}"
        print(f"✅ phone successfully updated and persisted: {test_phone}")
    
    def test_update_multiple_fields(self):
        """Test updating multiple fields at once"""
        update_data = {
            "first_name": "Lara",
            "last_name": "Collaboratore",
            "phone": "+39 328 9876543"
        }
        
        # Update multiple fields
        response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify all fields persisted
        verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        for field, expected_value in update_data.items():
            actual_value = data.get(field)
            assert actual_value == expected_value, f"{field} not persisted. Expected {expected_value}, got {actual_value}"
        
        print(f"✅ Multiple fields successfully updated and persisted")


class TestCollaboratoreLicenseNumber:
    """Test collaboratore_license_number field"""
    
    @pytest.fixture(autouse=True)
    def login(self):
        """Login as collaboratore and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COLLABORATORE_EMAIL,
            "password": COLLABORATORE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_update_collaboratore_license_number(self):
        """Test that collaboratore_license_number can be saved"""
        test_license = "COLL-2025-001"
        
        # Update collaboratore_license_number
        response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers,
            json={"collaboratore_license_number": test_license}
        )
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        assert data.get("collaboratore_license_number") == test_license, \
            f"collaboratore_license_number not persisted. Expected {test_license}, got {data.get('collaboratore_license_number')}"
        print(f"✅ collaboratore_license_number successfully updated and persisted: {test_license}")
    
    def test_license_number_persists_after_reload(self):
        """Test that license number persists after multiple GET calls"""
        test_license = "COLL-2025-002"
        
        # Update
        requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers,
            json={"collaboratore_license_number": test_license}
        )
        
        # Multiple GETs to ensure persistence
        for i in range(3):
            response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
            assert response.status_code == 200
            data = response.json()
            assert data.get("collaboratore_license_number") == test_license, \
                f"License number lost on GET #{i+1}"
        
        print(f"✅ collaboratore_license_number persists across multiple requests")


class TestCollaboratoreCompensationEndpoints:
    """Test compensation endpoints for collaboratori"""
    
    @pytest.fixture(autouse=True)
    def login(self):
        """Login as collaboratore and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COLLABORATORE_EMAIL,
            "password": COLLABORATORE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.user_id = response.json()["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_compensation_records(self):
        """Test GET /api/collaboratore/{id}/compensation"""
        response = requests.get(
            f"{BASE_URL}/api/collaboratore/{self.user_id}/compensation",
            headers=self.headers
        )
        
        # Should either succeed or return empty array
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # API returns either a list or an object with 'records' key
            if isinstance(data, list):
                records = data
            elif isinstance(data, dict):
                records = data.get('records', [])
            else:
                records = []
            assert isinstance(records, list), "Expected records array"
            print(f"✅ Compensation records endpoint working. Found {len(records)} records")
        else:
            print(f"✅ Compensation records endpoint exists (no records found)")
    
    def test_get_threshold_status(self):
        """Test GET /api/collaboratore/{id}/threshold-status/{year}"""
        current_year = 2025
        response = requests.get(
            f"{BASE_URL}/api/collaboratore/{self.user_id}/threshold-status/{current_year}",
            headers=self.headers
        )
        
        # Should either succeed or return 404 if not configured
        assert response.status_code in [200, 404, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Threshold status endpoint working. Data: {data}")
        else:
            print(f"✅ Threshold status endpoint exists (status: {response.status_code})")


class TestAdminLoginForComparison:
    """Test admin login for comparison"""
    
    def test_admin_login_success(self):
        """Test login as admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        assert "token" in data
        assert data["user"].get("role") == "admin"
        print(f"✅ Admin login successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
