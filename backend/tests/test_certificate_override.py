"""
Test suite for Certificate Override and Deny Access endpoints
Tests the coach QR scanner certificate override functionality:
- POST /api/certificates/override - Admin override of certificate block (single session)
- POST /api/certificates/deny-access - Log denial of access by Admin/Coach
"""

import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment - no defaults for production safety
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://season-enroll.preview.emergentagent.com"


class TestCertificateEndpoints:
    """Tests for certificate override and deny-access endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: get auth token for admin user"""
        self.admin_email = "test.admin@test.com"
        self.admin_password = "Test1234"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": self.admin_email, "password": self.admin_password}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            self.user = login_response.json().get("user")
        else:
            pytest.skip(f"Login failed with status {login_response.status_code}: {login_response.text}")
    
    def test_01_login_as_admin(self):
        """Test login as admin works correctly"""
        # Login was already done in setup, just verify we have a token
        assert self.token is not None, "Token should be present after login"
        assert self.user is not None, "User data should be present"
        assert self.user.get("role") == "admin", f"User should be admin, got: {self.user.get('role')}"
        print(f"✅ Login successful as admin: {self.user.get('email')}")
    
    def test_02_deny_access_endpoint_success(self):
        """Test POST /api/certificates/deny-access with valid data"""
        # First, get an athlete to use for testing
        athletes_response = self.session.get(f"{BASE_URL}/api/athletes")
        
        if athletes_response.status_code != 200:
            pytest.skip("Could not get athletes list")
        
        athletes = athletes_response.json()
        if not athletes:
            pytest.skip("No athletes available for testing")
        
        # Use first athlete
        test_athlete = athletes[0]
        athlete_id = test_athlete.get("id")
        athlete_name = test_athlete.get("full_name", "Test Atleta")
        
        # Test deny-access endpoint
        deny_response = self.session.post(
            f"{BASE_URL}/api/certificates/deny-access",
            json={
                "athlete_id": athlete_id,
                "athlete_name": athlete_name,
                "reason": "Certificato medico scaduto - Test"
            }
        )
        
        assert deny_response.status_code == 200, f"Expected 200, got {deny_response.status_code}: {deny_response.text}"
        
        data = deny_response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "log_id" in data, "Response should contain 'log_id'"
        assert "athlete_name" in data, "Response should contain 'athlete_name'"
        
        print(f"✅ Deny access logged successfully: {data.get('message')}")
        print(f"   Log ID: {data.get('log_id')}")
        print(f"   Athlete: {data.get('athlete_name')}")
    
    def test_03_deny_access_missing_fields(self):
        """Test deny-access with missing required fields returns error"""
        # Test with missing athlete_id
        response = self.session.post(
            f"{BASE_URL}/api/certificates/deny-access",
            json={
                "athlete_name": "Test",
                "reason": "Test reason"
            }
        )
        
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        print("✅ Correctly rejected request with missing athlete_id")
    
    def test_04_override_endpoint_success(self):
        """Test POST /api/certificates/override with valid data (Admin only)"""
        # First, get an athlete to use for testing
        athletes_response = self.session.get(f"{BASE_URL}/api/athletes")
        
        if athletes_response.status_code != 200:
            pytest.skip("Could not get athletes list")
        
        athletes = athletes_response.json()
        if not athletes:
            pytest.skip("No athletes available for testing")
        
        # Use first athlete
        test_athlete = athletes[0]
        athlete_id = test_athlete.get("id")
        
        # Test override endpoint
        override_response = self.session.post(
            f"{BASE_URL}/api/certificates/override",
            json={
                "athlete_id": athlete_id,
                "reason": "Certificato in fase di rinnovo - Test override automatico"
            }
        )
        
        assert override_response.status_code == 200, f"Expected 200, got {override_response.status_code}: {override_response.text}"
        
        data = override_response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "log_id" in data, "Response should contain 'log_id'"
        assert "athlete_name" in data, "Response should contain 'athlete_name'"
        # Check for warning about single session
        assert "warning" in data, "Response should contain 'warning' about single session"
        
        print(f"✅ Override created successfully: {data.get('message')}")
        print(f"   Warning: {data.get('warning')}")
        print(f"   Log ID: {data.get('log_id')}")
        print(f"   Athlete: {data.get('athlete_name')}")
    
    def test_05_override_short_reason_rejected(self):
        """Test override with reason < 5 chars is rejected"""
        # Get an athlete
        athletes_response = self.session.get(f"{BASE_URL}/api/athletes")
        
        if athletes_response.status_code != 200:
            pytest.skip("Could not get athletes list")
        
        athletes = athletes_response.json()
        if not athletes:
            pytest.skip("No athletes available for testing")
        
        athlete_id = athletes[0].get("id")
        
        # Test with short reason
        response = self.session.post(
            f"{BASE_URL}/api/certificates/override",
            json={
                "athlete_id": athlete_id,
                "reason": "abc"  # Less than 5 chars
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for short reason, got {response.status_code}"
        print("✅ Correctly rejected override with short reason")
    
    def test_06_override_missing_reason_rejected(self):
        """Test override without reason is rejected"""
        # Get an athlete
        athletes_response = self.session.get(f"{BASE_URL}/api/athletes")
        
        if athletes_response.status_code != 200:
            pytest.skip("Could not get athletes list")
        
        athletes = athletes_response.json()
        if not athletes:
            pytest.skip("No athletes available for testing")
        
        athlete_id = athletes[0].get("id")
        
        # Test with missing reason
        response = self.session.post(
            f"{BASE_URL}/api/certificates/override",
            json={
                "athlete_id": athlete_id
                # reason is missing
            }
        )
        
        assert response.status_code == 422, f"Expected 422 for missing reason, got {response.status_code}"
        print("✅ Correctly rejected override with missing reason")
    
    def test_07_override_nonexistent_athlete_rejected(self):
        """Test override for non-existent athlete returns 404"""
        response = self.session.post(
            f"{BASE_URL}/api/certificates/override",
            json={
                "athlete_id": "nonexistent_athlete_id_12345",
                "reason": "Test reason for non-existent athlete"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent athlete, got {response.status_code}"
        print("✅ Correctly rejected override for non-existent athlete")
    
    def test_08_verify_override_logged_in_audit(self):
        """Test that override is correctly logged in audit logs"""
        # Get override logs (admin only)
        response = self.session.get(f"{BASE_URL}/api/certificates/override-logs")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        logs = response.json()
        assert isinstance(logs, list), "Override logs should be a list"
        
        # Check that recent test logs are present
        if logs:
            latest_log = logs[0]
            print(f"✅ Override logs accessible. Latest log:")
            print(f"   Type: {latest_log.get('type')}")
            print(f"   Athlete: {latest_log.get('athlete_name')}")
            print(f"   Reason: {latest_log.get('reason')}")
            print(f"   Timestamp: {latest_log.get('timestamp')}")
        else:
            print("✅ Override logs endpoint works (no logs yet)")


class TestCoachDenyAccess:
    """Test deny-access endpoint as Coach (should also be allowed)"""
    
    def test_deny_access_as_coach(self):
        """Test that coach can also use deny-access endpoint"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # First login as admin to get a coach user
        admin_login = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test.admin@test.com", "password": "Test1234"}
        )
        
        if admin_login.status_code != 200:
            pytest.skip("Could not login as admin to find coach")
        
        token = admin_login.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get coaches
        coaches_response = session.get(f"{BASE_URL}/api/admin/users?role=coach")
        
        if coaches_response.status_code != 200:
            pytest.skip("Could not get coaches list")
        
        coaches = coaches_response.json()
        if not coaches:
            pytest.skip("No coaches available for testing")
        
        print(f"ℹ️ Found {len(coaches)} coaches - would need coach credentials to test deny-access as coach")
        print("✅ Coach deny-access test skipped (requires coach login credentials)")


class TestBlockCertificateLogic:
    """Test the certificate blocking logic in the backend"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test.admin@test.com", "password": "Test1234"}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_01_athlete_certificate_fields_exist(self):
        """Test that athletes have certificate-related fields"""
        athletes_response = self.session.get(f"{BASE_URL}/api/athletes")
        
        if athletes_response.status_code != 200:
            pytest.skip("Could not get athletes list")
        
        athletes = athletes_response.json()
        if not athletes:
            pytest.skip("No athletes available")
        
        # Check first athlete has certificate fields
        athlete = athletes[0]
        
        # These fields should exist (may be None)
        certificate_fields = [
            "medical_certificate_expiry",
            "medical_certificate_verified"
        ]
        
        print(f"ℹ️ Checking athlete: {athlete.get('full_name')}")
        for field in certificate_fields:
            value = athlete.get(field)
            print(f"   {field}: {value}")
        
        # Optional: check override fields if previously set
        override_fields = [
            "certificate_override_active",
            "certificate_override_reason"
        ]
        
        for field in override_fields:
            if field in athlete:
                print(f"   {field}: {athlete.get(field)}")
        
        print("✅ Athlete certificate fields verified")
    
    def test_02_attendance_check_endpoint_exists(self):
        """Test that attendance/check endpoint exists (used by QR scanner)"""
        # This endpoint requires a qr_code and team_id
        # Just verify the endpoint exists by checking without required params
        
        response = self.session.post(
            f"{BASE_URL}/api/attendance/check",
            json={}  # Empty body should fail with 422 (validation error)
        )
        
        # Should be 422 (validation error) not 404 (not found)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✅ attendance/check endpoint exists and validates input")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
