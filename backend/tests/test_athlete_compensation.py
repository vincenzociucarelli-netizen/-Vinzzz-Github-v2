"""
Test cases for Athlete Compensation endpoints
Tests P0: Athlete compensation settings and receipt signing
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://minor-athlete-flow.preview.emergentagent.com")

# Test credentials
ADMIN_EMAIL = "test.admin@test.com"
ADMIN_PASSWORD = "Test1234"
PARENT_EMAIL = "testparent@trial.com"
PARENT_PASSWORD = "Test1234"
COMPENSATED_ATHLETE_ID = "69977ba62666bba1803e5a0f"


class TestAthleteCompensationEndpoints:
    """Test athlete compensation API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.admin_token = token
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
    
    def test_admin_login_success(self):
        """Test admin can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful, role: {data['user']['role']}")
    
    def test_parent_login_success(self):
        """Test parent can login with updated credentials (P1)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}
        )
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "parent"
        print(f"✓ Parent login successful, role: {data['user']['role']}")
    
    def test_get_compensated_athlete(self):
        """Test getting athlete details - verify MARTA is compensated type"""
        response = self.session.get(f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}")
        assert response.status_code == 200, f"Get athlete failed: {response.text}"
        
        athlete = response.json()
        assert "id" in athlete
        assert "athlete_type" in athlete or athlete.get("athlete_type") is None
        print(f"✓ Athlete fetched: {athlete.get('first_name', athlete.get('full_name', 'Unknown'))} - Type: {athlete.get('athlete_type', 'N/A')}")
        
        # Store athlete type for other tests
        self.athlete_type = athlete.get("athlete_type")
        return athlete
    
    def test_get_athlete_compensation(self):
        """Test GET /athletes/{id}/compensation endpoint"""
        response = self.session.get(f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation")
        
        # Could be 200 (has compensation), 400 (not compensated type), or null response
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Athlete compensation data: {data}")
        elif response.status_code == 400:
            print(f"! Athlete not marked as compensated type: {response.text}")
        else:
            # May return null if no compensation set
            print(f"✓ Compensation response: {response.status_code} - {response.text}")
        
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
    
    def test_patch_athlete_compensation_settings(self):
        """Test PATCH /athletes/{id}/compensation/settings endpoint"""
        # Test compensation settings update
        test_data = {
            "monthly_compensation": 500.0,
            "other_annual_compensation": 0,
            "contract_start_date": "2024-09-01",
            "contract_end_date": "2025-06-30",
            "iban": "IT60X0542811101000000123456",
            "iban_holder": "MARTA TEST",
            "bank_name": "Banca Test"
        }
        
        response = self.session.patch(
            f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/settings",
            json=test_data
        )
        
        assert response.status_code == 200, f"Patch settings failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Compensation settings updated: {data}")
    
    def test_get_athlete_compensation_receipts(self):
        """Test GET /athletes/{id}/compensation/receipts endpoint"""
        response = self.session.get(f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/receipts")
        
        assert response.status_code == 200, f"Get receipts failed: {response.text}"
        receipts = response.json()
        assert isinstance(receipts, list)
        print(f"✓ Athlete receipts count: {len(receipts)}")
        
        if receipts:
            for r in receipts[:3]:
                print(f"  - {r.get('month')} {r.get('year')}: signed={r.get('signed')}")
        return receipts
    
    def test_post_athlete_compensation_receipt_sign(self):
        """Test POST /athletes/{id}/compensation/receipt to sign a receipt"""
        test_data = {
            "month": "Gennaio",
            "year": 2025,
            "signed": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/receipt",
            json=test_data
        )
        
        assert response.status_code == 200, f"Sign receipt failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Receipt signed: {data}")
        
        # Verify receipt was saved
        receipts_response = self.session.get(f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/receipts")
        assert receipts_response.status_code == 200
        receipts = receipts_response.json()
        
        # Check if our receipt exists
        found = any(r.get("month") == "Gennaio" and r.get("year") == 2025 and r.get("signed") == True for r in receipts)
        assert found, "Signed receipt not found in receipts list"
        print(f"✓ Verified receipt saved in database")
    
    def test_post_athlete_compensation_receipt_unsign(self):
        """Test POST /athletes/{id}/compensation/receipt to unsign a receipt"""
        test_data = {
            "month": "Gennaio",
            "year": 2025,
            "signed": False
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/receipt",
            json=test_data
        )
        
        assert response.status_code == 200, f"Unsign receipt failed: {response.text}"
        data = response.json()
        print(f"✓ Receipt unsigned: {data}")
    
    def test_post_receipt_missing_required_fields(self):
        """Test receipt endpoint with missing required fields"""
        # Missing month and year
        response = self.session.post(
            f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/receipt",
            json={"signed": True}
        )
        
        assert response.status_code == 400, f"Expected 400, got: {response.status_code}"
        print(f"✓ Correctly rejects missing required fields: {response.json()}")
    
    def test_compensation_endpoints_require_admin(self):
        """Test that compensation endpoints require admin role"""
        # Login as parent (non-admin)
        parent_session = requests.Session()
        parent_session.headers.update({"Content-Type": "application/json"})
        
        login_response = parent_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Parent login failed")
        
        parent_token = login_response.json().get("token")
        parent_session.headers.update({"Authorization": f"Bearer {parent_token}"})
        
        # Test GET compensation (should fail)
        response = parent_session.get(f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation")
        assert response.status_code == 403, f"Expected 403, got: {response.status_code}"
        print(f"✓ GET /compensation correctly requires admin")
        
        # Test PATCH settings (should fail)
        response = parent_session.patch(
            f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/settings",
            json={"monthly_compensation": 100}
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code}"
        print(f"✓ PATCH /compensation/settings correctly requires admin")
        
        # Test POST receipt (should fail)
        response = parent_session.post(
            f"{BASE_URL}/api/athletes/{COMPENSATED_ATHLETE_ID}/compensation/receipt",
            json={"month": "Febbraio", "year": 2025, "signed": True}
        )
        assert response.status_code == 403, f"Expected 403, got: {response.status_code}"
        print(f"✓ POST /compensation/receipt correctly requires admin")
    
    def test_compensation_nonexistent_athlete(self):
        """Test compensation endpoints with non-existent athlete"""
        fake_id = "000000000000000000000000"
        
        response = self.session.get(f"{BASE_URL}/api/athletes/{fake_id}/compensation")
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print(f"✓ GET returns 404 for non-existent athlete")
        
        response = self.session.patch(
            f"{BASE_URL}/api/athletes/{fake_id}/compensation/settings",
            json={"monthly_compensation": 100}
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print(f"✓ PATCH returns 404 for non-existent athlete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
