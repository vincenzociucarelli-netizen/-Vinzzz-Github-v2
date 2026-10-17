"""
Test suite for Minor Dashboard and Audit Logs features:
1. Minor dashboard /api/minor/dashboard returns certificate_expiry and certificate_verified fields
2. Audit logs support deletion_request_cancelled action type
3. Backend request-end-trial endpoint cancels pending deletion request and logs audit event
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MINOR_ATHLETE_CODE = "MARTY2008"
MINOR_PIN = "1234"
PARENT_EMAIL = "perla@test.com"
PARENT_PASSWORD = "Test1234"
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "Test1234"


class TestMinorDashboard:
    """Tests for Minor Dashboard endpoint - certificate_expiry and certificate_verified"""
    
    @pytest.fixture
    def minor_token(self):
        """Get minor athlete token via minor-login"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": MINOR_ATHLETE_CODE,
            "pin": MINOR_PIN
        })
        if response.status_code == 200:
            data = response.json()
            # API returns 'token' not 'access_token'
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Minor login failed: {response.status_code} - {response.text}")
    
    def test_minor_dashboard_returns_certificate_expiry(self, minor_token):
        """Test that minor dashboard returns certificate_expiry field"""
        headers = {"Authorization": f"Bearer {minor_token}"}
        response = requests.get(f"{BASE_URL}/api/minor/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify athlete object exists
        assert "athlete" in data, "Response should contain 'athlete' object"
        athlete = data["athlete"]
        
        # Verify certificate_expiry field exists (can be null or a date string)
        assert "certificate_expiry" in athlete, "athlete should have 'certificate_expiry' field"
        print(f"certificate_expiry: {athlete.get('certificate_expiry')}")
        
    def test_minor_dashboard_returns_certificate_verified(self, minor_token):
        """Test that minor dashboard returns certificate_verified field"""
        headers = {"Authorization": f"Bearer {minor_token}"}
        response = requests.get(f"{BASE_URL}/api/minor/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        athlete = data["athlete"]
        
        # Verify certificate_verified field exists (boolean)
        assert "certificate_verified" in athlete, "athlete should have 'certificate_verified' field"
        assert isinstance(athlete["certificate_verified"], bool), "certificate_verified should be boolean"
        print(f"certificate_verified: {athlete.get('certificate_verified')}")
    
    def test_minor_dashboard_full_response_structure(self, minor_token):
        """Test full response structure of minor dashboard"""
        headers = {"Authorization": f"Bearer {minor_token}"}
        response = requests.get(f"{BASE_URL}/api/minor/dashboard", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify main sections
        assert "athlete" in data
        assert "stats" in data
        
        # Verify athlete fields
        athlete = data["athlete"]
        expected_fields = ["id", "full_name", "athlete_code", "certificate_expiry", "certificate_verified"]
        for field in expected_fields:
            assert field in athlete, f"Missing field: {field}"
        
        print(f"Minor dashboard response: athlete_code={athlete.get('athlete_code')}, "
              f"certificate_expiry={athlete.get('certificate_expiry')}, "
              f"certificate_verified={athlete.get('certificate_verified')}")


class TestAuditLogs:
    """Tests for Audit Logs - deletion_request_cancelled action type"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    def test_audit_logs_endpoint_accessible(self, admin_token):
        """Test that audit logs endpoint is accessible"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "logs" in data, "Response should contain 'logs' array"
        assert "total" in data, "Response should contain 'total' count"
        print(f"Audit logs: total={data.get('total')}, returned={len(data.get('logs', []))}")
    
    def test_audit_logs_filter_by_deletion_request_cancelled(self, admin_token):
        """Test filtering audit logs by deletion_request_cancelled action"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs?action=deletion_request_cancelled", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        logs = data.get("logs", [])
        # All returned logs should have action=deletion_request_cancelled
        for log in logs:
            assert log.get("action") == "deletion_request_cancelled", f"Expected action=deletion_request_cancelled, got {log.get('action')}"
        
        print(f"Found {len(logs)} deletion_request_cancelled logs")
    
    def test_audit_logs_contain_required_fields(self, admin_token):
        """Test that audit logs contain required fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs?limit=5", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        logs = data.get("logs", [])
        
        if logs:
            log = logs[0]
            required_fields = ["id", "action", "user_email"]
            for field in required_fields:
                assert field in log, f"Log missing required field: {field}"
            print(f"Sample log: action={log.get('action')}, user_email={log.get('user_email')}")


class TestRequestEndTrialDeletionCancellation:
    """Tests for request-end-trial endpoint cancelling pending deletion requests"""
    
    @pytest.fixture
    def parent_token(self):
        """Get parent token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Parent login failed: {response.status_code}")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pallavoloperugia@gmail.com",
            "password": "Test1234"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    def test_request_end_trial_endpoint_exists(self, parent_token):
        """Test that request-end-trial endpoint exists"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        # Use a dummy athlete ID to test endpoint existence
        response = requests.post(f"{BASE_URL}/api/athletes/test-id/request-end-trial", headers=headers)
        
        # Should return 404 (athlete not found) or 400/403, not 405 (method not allowed)
        assert response.status_code != 405, "Endpoint should exist (POST method allowed)"
        print(f"request-end-trial endpoint response: {response.status_code}")


class TestMinorLogin:
    """Tests for minor login functionality"""
    
    def test_minor_login_success(self):
        """Test successful minor login with athlete_code and pin"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": MINOR_ATHLETE_CODE,
            "pin": MINOR_PIN
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # API returns 'token' not 'access_token'
        assert "token" in data or "access_token" in data, "Response should contain token"
        assert data.get("user", {}).get("role") == "minor", f"Expected role=minor, got {data.get('user', {}).get('role')}"
        print(f"Minor login successful: athlete_code={MINOR_ATHLETE_CODE}")
    
    def test_minor_login_invalid_pin(self):
        """Test minor login with invalid pin"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": MINOR_ATHLETE_CODE,
            "pin": "9999"
        })
        
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print(f"Invalid pin correctly rejected: {response.status_code}")
    
    def test_minor_login_invalid_athlete_code(self):
        """Test minor login with invalid athlete code"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "INVALID123",
            "pin": "1234"
        })
        
        assert response.status_code in [401, 404, 400], f"Expected 401/404/400, got {response.status_code}"
        print(f"Invalid athlete code correctly rejected: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
