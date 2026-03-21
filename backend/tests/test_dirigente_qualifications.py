"""
Test suite for Dirigente qualifications array feature (Doppio Incarico).
Tests:
1. GET /api/users/{user_id} returns 'qualifications' array
2. GET /api/users/dirigenti returns 'qualifications' array in list
3. PATCH /api/users/{user_id} with qualifications array saves correctly
4. Adding multiple qualifications via PATCH and reading back
5. Removing a qualification via PATCH (sending subset array)
6. GET /api/settings/society returns 'dirigente_qualifications' 
7. Login endpoint works with admin credentials
"""
import pytest
import requests
import os

# Get base URL from environment - DO NOT add default URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://athlete-trial-sys.preview.emergentagent.com').rstrip('/')

# Test credentials from the review request
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"
TEST_DIRIGENTE_ID = "697fdf1650268927c8157788"

class TestDirigenteQualifications:
    """Tests for Dirigente qualifications array feature (Doppio Incarico)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
    
    def get_auth_token(self):
        """Get admin authentication token"""
        if self.auth_token:
            return self.auth_token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.auth_token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
            return self.auth_token
        return None
    
    # =====================================================================
    # Test 1: Login endpoint works with admin credentials
    # =====================================================================
    def test_01_login_admin_credentials(self):
        """Test login with admin credentials pallavoloperugia@gmail.com / password"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed with status {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain 'token'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"]["email"] == ADMIN_EMAIL, f"User email should be {ADMIN_EMAIL}"
        assert data["user"]["role"] == "admin", "User role should be 'admin'"
        
        print(f"✓ Login successful for {ADMIN_EMAIL}")
        print(f"  User ID: {data['user']['id']}")
        print(f"  Role: {data['user']['role']}")
    
    # =====================================================================
    # Test 2: GET /api/settings/society returns 'dirigente_qualifications'
    # =====================================================================
    def test_02_settings_society_has_dirigente_qualifications(self):
        """Test that GET /api/settings/society returns 'dirigente_qualifications' field"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/settings/society")
        
        assert response.status_code == 200, f"Settings endpoint failed with status {response.status_code}"
        
        data = response.json()
        assert "dirigente_qualifications" in data, "Response should contain 'dirigente_qualifications' field"
        assert isinstance(data["dirigente_qualifications"], list), "'dirigente_qualifications' should be a list"
        
        print(f"✓ Settings society has 'dirigente_qualifications' field")
        print(f"  Available qualifications: {data['dirigente_qualifications']}")
    
    # =====================================================================
    # Test 3: GET /api/users/dirigenti returns 'qualifications' array in list
    # =====================================================================
    def test_03_get_dirigenti_returns_qualifications_array(self):
        """Test that GET /api/users/dirigenti returns 'qualifications' array for each dirigente"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/users/dirigenti")
        
        assert response.status_code == 200, f"Get dirigenti failed with status {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check that at least one dirigente has the qualifications field
        for dirigente in data:
            assert "id" in dirigente, "Each dirigente should have 'id'"
            assert "qualifications" in dirigente, f"Dirigente {dirigente.get('full_name', 'unknown')} should have 'qualifications' field"
            assert isinstance(dirigente["qualifications"], list), f"'qualifications' for {dirigente.get('full_name', 'unknown')} should be a list"
            
            # Also check for legacy field
            assert "qualification" in dirigente, f"Dirigente should also have legacy 'qualification' field"
        
        print(f"✓ GET /api/users/dirigenti returns {len(data)} dirigenti with 'qualifications' array")
        
        # Print qualifications for each dirigente
        for d in data:
            print(f"  - {d.get('full_name')}: qualifications={d.get('qualifications', [])}")
    
    # =====================================================================
    # Test 4: GET /api/users/{user_id} returns 'qualifications' array for dirigente
    # =====================================================================
    def test_04_get_user_detail_returns_qualifications(self):
        """Test that GET /api/users/{user_id} returns 'qualifications' array field for dirigenti"""
        self.get_auth_token()
        
        # First get list of dirigenti to find a valid ID
        response = self.session.get(f"{BASE_URL}/api/users/dirigenti")
        assert response.status_code == 200, f"Get dirigenti failed"
        
        dirigenti = response.json()
        if not dirigenti:
            pytest.skip("No dirigenti found to test")
        
        # Use the test dirigente ID provided or first available
        test_id = TEST_DIRIGENTE_ID
        
        # Check if test ID exists
        dirigente_ids = [d["id"] for d in dirigenti]
        if test_id not in dirigente_ids:
            test_id = dirigenti[0]["id"]
            print(f"  Note: Using fallback dirigente ID {test_id} (provided ID not found)")
        
        # Get user detail
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        
        assert response.status_code == 200, f"Get user detail failed with status {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "qualifications" in data, "Response should contain 'qualifications' field"
        assert isinstance(data["qualifications"], list), "'qualifications' should be a list"
        
        # Also check for legacy field
        assert "qualification" in data, "Response should contain legacy 'qualification' field"
        
        print(f"✓ GET /api/users/{test_id} returns 'qualifications' array")
        print(f"  User: {data.get('full_name')}")
        print(f"  qualifications: {data.get('qualifications', [])}")
        print(f"  qualification (legacy): {data.get('qualification')}")
    
    # =====================================================================
    # Test 5: PATCH /api/users/{user_id} with qualifications array saves correctly
    # =====================================================================
    def test_05_patch_user_qualifications_saves_correctly(self):
        """Test that PATCH /api/users/{user_id} with qualifications array saves and persists"""
        self.get_auth_token()
        
        # Get a dirigente to test with
        response = self.session.get(f"{BASE_URL}/api/users/dirigenti")
        assert response.status_code == 200
        
        dirigenti = response.json()
        if not dirigenti:
            pytest.skip("No dirigenti found to test")
        
        # Use test ID or first available
        test_id = TEST_DIRIGENTE_ID
        dirigente_ids = [d["id"] for d in dirigenti]
        if test_id not in dirigente_ids:
            test_id = dirigenti[0]["id"]
        
        # First get current state
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        assert response.status_code == 200
        original_qualifications = response.json().get("qualifications", [])
        
        # Add test qualifications
        test_qualifications = ["Segnapunti", "Arbitro"]
        
        response = self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": test_qualifications
        })
        
        assert response.status_code == 200, f"PATCH failed with status {response.status_code}: {response.text}"
        
        # GET to verify data was persisted
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        assert response.status_code == 200
        
        updated_data = response.json()
        assert "qualifications" in updated_data, "Updated user should have 'qualifications'"
        assert updated_data["qualifications"] == test_qualifications, \
            f"Qualifications should be {test_qualifications}, got {updated_data['qualifications']}"
        
        print(f"✓ PATCH /api/users/{test_id} with qualifications={test_qualifications} saved correctly")
        print(f"  Verified via GET: qualifications={updated_data['qualifications']}")
        
        # Restore original qualifications
        self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": original_qualifications
        })
    
    # =====================================================================
    # Test 6: Adding multiple qualifications via PATCH, then reading back
    # =====================================================================
    def test_06_add_multiple_qualifications_and_read_back(self):
        """Test adding multiple qualifications and verifying they persist"""
        self.get_auth_token()
        
        # Get a dirigente to test with
        response = self.session.get(f"{BASE_URL}/api/users/dirigenti")
        assert response.status_code == 200
        
        dirigenti = response.json()
        if not dirigenti:
            pytest.skip("No dirigenti found to test")
        
        # Use test ID or first available
        test_id = TEST_DIRIGENTE_ID
        dirigente_ids = [d["id"] for d in dirigenti]
        if test_id not in dirigente_ids:
            test_id = dirigenti[0]["id"]
        
        # Save original state
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        assert response.status_code == 200
        original_qualifications = response.json().get("qualifications", [])
        
        # Add multiple qualifications progressively
        test_qualifications = ["Segnapunti", "Arbitro", "Dirigente Responsabile", "Accompagnatore"]
        
        response = self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": test_qualifications
        })
        assert response.status_code == 200
        
        # GET to verify all qualifications persist
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["qualifications"] == test_qualifications, \
            f"Expected {test_qualifications}, got {data['qualifications']}"
        assert len(data["qualifications"]) == 4, "Should have 4 qualifications"
        
        print(f"✓ Added 4 qualifications: {test_qualifications}")
        print(f"  All 4 persist correctly")
        
        # Verify in dirigenti list too
        response = self.session.get(f"{BASE_URL}/api/users/dirigenti")
        assert response.status_code == 200
        
        dirigenti_list = response.json()
        test_dirigente = next((d for d in dirigenti_list if d["id"] == test_id), None)
        assert test_dirigente is not None, "Test dirigente should be in list"
        assert test_dirigente["qualifications"] == test_qualifications, \
            "Qualifications should match in dirigenti list endpoint"
        
        print(f"  Also verified in /api/users/dirigenti list")
        
        # Restore original qualifications
        self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": original_qualifications
        })
    
    # =====================================================================
    # Test 7: Removing a qualification via PATCH (sending subset array)
    # =====================================================================
    def test_07_remove_qualification_via_patch_subset(self):
        """Test removing a qualification by sending a subset array"""
        self.get_auth_token()
        
        # Get a dirigente to test with
        response = self.session.get(f"{BASE_URL}/api/users/dirigenti")
        assert response.status_code == 200
        
        dirigenti = response.json()
        if not dirigenti:
            pytest.skip("No dirigenti found to test")
        
        # Use test ID or first available
        test_id = TEST_DIRIGENTE_ID
        dirigente_ids = [d["id"] for d in dirigenti]
        if test_id not in dirigente_ids:
            test_id = dirigenti[0]["id"]
        
        # Save original state
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        assert response.status_code == 200
        original_qualifications = response.json().get("qualifications", [])
        
        # Set 3 qualifications
        initial_qualifications = ["Segnapunti", "Arbitro", "Dirigente Responsabile"]
        response = self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": initial_qualifications
        })
        assert response.status_code == 200
        
        # Remove one by sending subset array (only 2)
        reduced_qualifications = ["Segnapunti", "Dirigente Responsabile"]  # Removed "Arbitro"
        
        response = self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": reduced_qualifications
        })
        assert response.status_code == 200
        
        # GET to verify removal
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["qualifications"] == reduced_qualifications, \
            f"Expected {reduced_qualifications}, got {data['qualifications']}"
        assert "Arbitro" not in data["qualifications"], "'Arbitro' should have been removed"
        assert len(data["qualifications"]) == 2, "Should have 2 qualifications after removal"
        
        print(f"✓ Successfully removed 'Arbitro' by sending subset")
        print(f"  Before: {initial_qualifications}")
        print(f"  After: {data['qualifications']}")
        
        # Test removing all qualifications
        response = self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": []
        })
        assert response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/users/{test_id}")
        assert response.status_code == 200
        assert response.json()["qualifications"] == [], "Should be empty after removing all"
        
        print(f"  Also verified: Can set empty qualifications array")
        
        # Restore original qualifications
        self.session.patch(f"{BASE_URL}/api/users/{test_id}", json={
            "qualifications": original_qualifications
        })


class TestHealthAndBasicEndpoints:
    """Basic health and connectivity tests"""
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
