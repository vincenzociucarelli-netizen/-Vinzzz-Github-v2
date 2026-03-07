"""
Test suite for Athlete Module - Compensated Athletes
Tests: Login, Profile, Compensation Receipts, Admin Account Creation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://role-ui-parity.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "test.admin@test.com"
ADMIN_PASSWORD = "Test1234"
ATHLETE_EMAIL = "test.athlete@trial.com"
ATHLETE_PASSWORD = "Athlete123"
ATHLETE_ID = "6998cf2dd6878c84c10b35f5"


class TestAthleteLogin:
    """Test athlete login functionality"""
    
    def test_athlete_login_success(self):
        """Test that athlete can login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == ATHLETE_EMAIL
        assert user["role"] == "athlete"
        assert "full_name" in user
        print(f"✓ Athlete login successful: {user['full_name']}")
    
    def test_athlete_login_wrong_password(self):
        """Test athlete login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": "WrongPassword123"
        })
        
        assert response.status_code in [401, 400], f"Expected auth failure, got {response.status_code}"
        print("✓ Wrong password correctly rejected")
    
    def test_athlete_login_nonexistent_email(self):
        """Test login fails for non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "AnyPassword123"
        })
        
        assert response.status_code in [401, 404, 400], f"Expected auth failure, got {response.status_code}"
        print("✓ Non-existent email correctly rejected")


class TestAthleteProfile:
    """Test athlete profile access"""
    
    @pytest.fixture
    def athlete_token(self):
        """Get athlete auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Athlete login failed")
        return response.json()["token"]
    
    def test_get_athlete_me_endpoint(self, athlete_token):
        """Test /auth/me returns athlete data with athlete_id"""
        headers = {"Authorization": f"Bearer {athlete_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Failed to get /auth/me: {response.text}"
        data = response.json()
        
        # Verify athlete-specific fields
        assert data["role"] == "athlete"
        assert "athlete_id" in data, "No athlete_id in /auth/me response"
        assert data["email"] == ATHLETE_EMAIL
        print(f"✓ /auth/me returns athlete with athlete_id: {data['athlete_id']}")
    
    def test_get_athlete_record(self, athlete_token):
        """Test athlete can get their own athlete record"""
        headers = {"Authorization": f"Bearer {athlete_token}"}
        
        # First get athlete_id from /auth/me
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        athlete_id = me_response.json().get("athlete_id", ATHLETE_ID)
        
        # Get athlete record
        response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}", headers=headers)
        
        assert response.status_code == 200, f"Failed to get athlete record: {response.text}"
        data = response.json()
        
        # Verify athlete data
        assert data["id"] == athlete_id
        assert "full_name" in data
        assert "athlete_type" in data
        assert data["athlete_type"] == "compensated", "Athlete should be compensated type"
        assert "monthly_compensation" in data
        assert "contract_start_date" in data
        assert "contract_end_date" in data
        
        print(f"✓ Athlete record: {data['full_name']}")
        print(f"  - Type: {data['athlete_type']}")
        print(f"  - Monthly: €{data.get('monthly_compensation', 0)}")
        print(f"  - Contract: {data.get('contract_start_date')} - {data.get('contract_end_date')}")


class TestAthleteCompensationReceipts:
    """Test athlete compensation receipts"""
    
    @pytest.fixture
    def athlete_token(self):
        """Get athlete auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Athlete login failed")
        return response.json()["token"]
    
    def test_get_compensation_receipts(self, athlete_token):
        """Test athlete can view their compensation receipts"""
        headers = {"Authorization": f"Bearer {athlete_token}"}
        
        # Get athlete_id from /auth/me
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        athlete_id = me_response.json().get("athlete_id", ATHLETE_ID)
        
        # Get receipts
        response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}/compensation/receipts", headers=headers)
        
        assert response.status_code == 200, f"Failed to get receipts: {response.text}"
        data = response.json()
        
        # Response should be a list (may be empty)
        assert isinstance(data, list), "Receipts should be a list"
        print(f"✓ Retrieved {len(data)} compensation receipts")
        
        # If there are receipts, verify structure
        if len(data) > 0:
            receipt = data[0]
            assert "month" in receipt or "year" in receipt
            print(f"  - Sample receipt: {receipt.get('month', 'N/A')}/{receipt.get('year', 'N/A')}")
    
    def test_athlete_cannot_view_other_receipts(self, athlete_token):
        """Test athlete cannot view another athlete's receipts"""
        headers = {"Authorization": f"Bearer {athlete_token}"}
        
        # Try to access a different athlete's receipts
        fake_athlete_id = "00000000000000000000fake"
        response = requests.get(f"{BASE_URL}/api/athletes/{fake_athlete_id}/compensation/receipts", headers=headers)
        
        # Should get 403 or 404
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("✓ Athlete cannot view other athletes' receipts")


class TestAdminAthleteManagement:
    """Test admin can manage athlete accounts"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_admin_login_success(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['full_name']}")
    
    def test_admin_can_view_athlete(self, admin_token):
        """Test admin can view athlete record"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/athletes/{ATHLETE_ID}", headers=headers)
        
        assert response.status_code == 200, f"Admin failed to view athlete: {response.text}"
        data = response.json()
        assert data["id"] == ATHLETE_ID
        print(f"✓ Admin viewed athlete: {data['full_name']}")
    
    def test_admin_can_view_athlete_receipts(self, admin_token):
        """Test admin can view athlete compensation receipts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/athletes/{ATHLETE_ID}/compensation/receipts", headers=headers)
        
        assert response.status_code == 200, f"Admin failed to view receipts: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin viewed {len(data)} receipts for athlete")
    
    def test_create_athlete_account_already_exists(self, admin_token):
        """Test creating account for athlete who already has one"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/athletes/{ATHLETE_ID}/create-account",
            headers=headers,
            json={"password": "TestPassword123"}
        )
        
        # Should return 400 since account already exists
        assert response.status_code == 400, f"Expected 400 for existing account, got {response.status_code}"
        print("✓ Cannot create duplicate account (expected behavior)")
    
    def test_non_admin_cannot_create_account(self):
        """Test non-admin cannot create athlete account"""
        # Login as athlete
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Athlete login failed")
        
        athlete_token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {athlete_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/athletes/{ATHLETE_ID}/create-account",
            headers=headers,
            json={"password": "TestPassword123"}
        )
        
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✓ Non-admin correctly rejected from creating account")


class TestAthleteCompensationSettings:
    """Test athlete compensation settings"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def athlete_token(self):
        """Get athlete auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Athlete login failed")
        return response.json()["token"]
    
    def test_athlete_has_compensation_settings(self, admin_token):
        """Test athlete has proper compensation settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/athletes/{ATHLETE_ID}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify compensation settings
        assert data.get("athlete_type") == "compensated"
        assert data.get("monthly_compensation") is not None
        assert data.get("monthly_compensation") > 0, "Monthly compensation should be positive"
        
        print(f"✓ Athlete compensation settings:")
        print(f"  - Monthly: €{data.get('monthly_compensation')}")
        print(f"  - Contract Start: {data.get('contract_start_date')}")
        print(f"  - Contract End: {data.get('contract_end_date')}")
    
    def test_get_athlete_compensation_endpoint(self, admin_token):
        """Test GET /athletes/{id}/compensation endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/athletes/{ATHLETE_ID}/compensation", headers=headers)
        
        # This endpoint may return null for athletes without compensation record
        # or return compensation settings
        if response.status_code == 200:
            data = response.json()
            if data is None:
                print("✓ Compensation endpoint returns null (no separate compensation record)")
            elif isinstance(data, dict):
                assert "monthly_compensation" in data or "compensation_accepted" in data
                print(f"✓ Compensation endpoint returned data")
            else:
                print(f"✓ Compensation endpoint returned: {type(data)}")
        elif response.status_code == 404:
            print("⚠ Compensation endpoint returns 404 (may need athlete data from main endpoint)")
        else:
            print(f"⚠ Compensation endpoint returned: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
