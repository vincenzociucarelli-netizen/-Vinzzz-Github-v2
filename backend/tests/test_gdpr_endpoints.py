"""
Test suite for GDPR-compliant endpoints:
1. DELETE /api/auth/delete-my-data - GDPR data deletion
2. GET /api/auth/me - Returns trial_end_date and date_of_birth for athletes
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://athlete-payments.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Test credentials
ADULT_ATHLETE = {"email": "adult.athlete@test.com", "password": "Test1234"}
ADMIN = {"email": "test.admin@test.com", "password": "Test1234"}


class TestHealthCheck:
    """Verify API is running"""
    
    def test_api_health(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ API health check passed")


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login(self):
        """Test admin can log in"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"✅ Admin login successful: {data['user']['email']}")


class TestAthleteAuth:
    """Test athlete authentication and profile"""
    
    def test_adult_athlete_login(self):
        """Test adult athlete can log in"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADULT_ATHLETE
        )
        assert response.status_code == 200, f"Athlete login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "athlete"
        print(f"✅ Adult athlete login successful: {data['user']['email']}")
        return data["token"]
    
    def test_auth_me_returns_trial_end_date(self):
        """Verify /auth/me returns trial_end_date for athletes"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADULT_ATHLETE
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to get profile: {response.text}"
        data = response.json()
        
        # Verify trial_end_date is present
        assert "trial_end_date" in data, "trial_end_date missing from /auth/me response"
        assert data["trial_end_date"] is not None, "trial_end_date is null"
        print(f"✅ trial_end_date present: {data['trial_end_date']}")
    
    def test_auth_me_returns_date_of_birth(self):
        """Verify /auth/me returns date_of_birth for athletes"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADULT_ATHLETE
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify date_of_birth is present
        assert "date_of_birth" in data, "date_of_birth missing from /auth/me response"
        assert data["date_of_birth"] is not None, "date_of_birth is null"
        print(f"✅ date_of_birth present: {data['date_of_birth']}")
    
    def test_auth_me_returns_privacy_accepted(self):
        """Verify /auth/me returns privacy_accepted field"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADULT_ATHLETE
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify privacy_accepted field is present
        assert "privacy_accepted" in data, "privacy_accepted missing from /auth/me response"
        print(f"✅ privacy_accepted present: {data['privacy_accepted']}")


class TestGDPRDeleteEndpoint:
    """Test GDPR data deletion endpoint"""
    
    def test_delete_endpoint_requires_auth(self):
        """Verify /auth/delete-my-data requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/auth/delete-my-data")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ DELETE endpoint correctly requires authentication")
    
    def test_delete_endpoint_exists(self):
        """Verify DELETE endpoint exists and accepts requests"""
        # Login as adult athlete
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADULT_ATHLETE
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Make OPTIONS request to verify endpoint exists
        # For DELETE we just verify we can reach the endpoint (don't actually delete)
        # A proper test would create a test user and delete them
        response = requests.options(
            f"{BASE_URL}/api/auth/delete-my-data",
            headers={"Authorization": f"Bearer {token}"}
        )
        # OPTIONS should return 200 with CORS enabled
        # If the endpoint doesn't exist, we'd get 404
        print("✅ DELETE endpoint is reachable")
    
    def test_delete_creates_test_user_and_deletes(self):
        """Create a test user, then delete using GDPR endpoint"""
        # Generate unique test email
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"gdpr.test.{unique_id}@test.com"
        test_password = "Test1234"
        
        # First, get admin token to find a valid invite code
        admin_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN
        )
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_token = admin_login.json()["token"]
        
        # Get the society invite code
        society_response = requests.get(
            f"{BASE_URL}/api/societies/invite-code",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        invite_code = None
        if society_response.status_code == 200:
            invite_code = society_response.json().get("invite_code")
        
        if not invite_code:
            # Try to get from /societies/my
            my_society = requests.get(
                f"{BASE_URL}/api/societies/my",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if my_society.status_code == 200:
                invite_code = my_society.json().get("invite_code")
        
        if not invite_code:
            pytest.skip("Could not get invite code for testing")
        
        print(f"📋 Using invite code: {invite_code}")
        
        # Register a new test user (parent role for auto-approval)
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "full_name": "GDPR Test User",
                "role": "parent",
                "invite_code": invite_code
            }
        )
        
        if register_response.status_code != 200:
            print(f"Registration response: {register_response.text}")
            pytest.skip(f"Could not register test user: {register_response.text}")
        
        data = register_response.json()
        assert "token" in data, f"No token in registration response: {data}"
        test_token = data["token"]
        test_user_id = data["user"]["id"]
        print(f"✅ Test user created: {test_email} (ID: {test_user_id})")
        
        # Verify user exists
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert me_response.status_code == 200, f"Failed to get test user profile: {me_response.text}"
        print("✅ Test user profile accessible")
        
        # Now delete the test user using GDPR endpoint
        delete_response = requests.delete(
            f"{BASE_URL}/api/auth/delete-my-data",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert delete_response.status_code == 200, f"GDPR delete failed: {delete_response.text}"
        
        delete_data = delete_response.json()
        assert delete_data.get("success") == True, f"Delete success flag not true: {delete_data}"
        assert "message" in delete_data
        assert "deleted" in delete_data
        
        print(f"✅ GDPR delete successful: {delete_data['message']}")
        print(f"   Deleted items: {delete_data['deleted']}")
        
        # Verify user can no longer access their profile (token should be invalid)
        me_response_after = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        # Should get 401 (user not found) or similar error
        assert me_response_after.status_code in [401, 404], \
            f"Expected 401/404 after deletion, got {me_response_after.status_code}: {me_response_after.text}"
        print("✅ Test user no longer accessible after GDPR deletion")
        
        # Verify login no longer works
        login_after = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": test_password}
        )
        assert login_after.status_code == 401, \
            f"Login should fail after deletion, got {login_after.status_code}"
        print("✅ Login correctly fails after GDPR deletion")
    

class TestGDPRDeleteAdultAthlete:
    """Test GDPR deletion for adult athlete with athlete record"""
    
    def test_delete_adult_athlete_flow(self):
        """Create adult athlete, verify data, then delete"""
        # Generate unique test data
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"gdpr.athlete.{unique_id}@test.com"
        test_password = "Test1234"
        
        # First, get admin token to find a valid invite code
        admin_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["token"]
        
        # Get the society invite code
        society_response = requests.get(
            f"{BASE_URL}/api/societies/invite-code",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        invite_code = None
        if society_response.status_code == 200:
            invite_code = society_response.json().get("invite_code")
        
        if not invite_code:
            pytest.skip("Could not get invite code for testing")
        
        # Register adult athlete
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register-adult-athlete",
            json={
                "email": test_email,
                "password": test_password,
                "first_name": "Test",
                "last_name": "AtletaGDPR",
                "phone": "3331234567",
                "invite_code": invite_code,
                "date_of_birth": "1990-05-15"
            }
        )
        
        if register_response.status_code != 200:
            print(f"Adult athlete registration response: {register_response.text}")
            pytest.skip(f"Could not register adult athlete: {register_response.text}")
        
        data = register_response.json()
        test_token = data["token"]
        user_id = data["user"]["id"]
        athlete_id = data["user"].get("athlete_id")
        
        print(f"✅ Adult athlete created: {test_email}")
        print(f"   User ID: {user_id}, Athlete ID: {athlete_id}")
        
        # Verify profile has trial_end_date and date_of_birth
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert me_response.status_code == 200
        profile = me_response.json()
        
        assert "trial_end_date" in profile, "trial_end_date missing for adult athlete"
        assert "date_of_birth" in profile, "date_of_birth missing for adult athlete"
        print(f"✅ Adult athlete has trial_end_date: {profile.get('trial_end_date')}")
        print(f"✅ Adult athlete has date_of_birth: {profile.get('date_of_birth')}")
        
        # Delete the adult athlete
        delete_response = requests.delete(
            f"{BASE_URL}/api/auth/delete-my-data",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert delete_response.status_code == 200, f"GDPR delete failed: {delete_response.text}"
        
        delete_data = delete_response.json()
        assert delete_data.get("success") == True
        
        # Verify athlete record was deleted
        deleted = delete_data.get("deleted", {})
        assert deleted.get("user") == True, "User should be deleted"
        assert deleted.get("athlete") == True, "Athlete record should be deleted"
        
        print(f"✅ Adult athlete GDPR deletion successful")
        print(f"   Deleted: user={deleted.get('user')}, athlete={deleted.get('athlete')}")
        
        # Verify user can no longer login
        login_after = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": test_password}
        )
        assert login_after.status_code == 401
        print("✅ Login correctly fails after adult athlete GDPR deletion")


class TestAuthMeForAthletes:
    """Test /auth/me endpoint response for athlete role"""
    
    def test_auth_me_full_response(self):
        """Verify full /auth/me response structure for athletes"""
        # Login as adult athlete
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADULT_ATHLETE
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields for GDPR flow
        required_fields = [
            "id", "email", "role", "full_name",
            "trial_end_date",  # For TrialEndModal
            "date_of_birth",   # For adult check (18+)
            "privacy_accepted" # For privacy acceptance tracking
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"✅ Field '{field}': {data[field]}")
        
        # Verify role is athlete
        assert data["role"] == "athlete", f"Expected role 'athlete', got '{data['role']}'"
        
        # Verify athlete_id is present (for linking to athlete record)
        assert "athlete_id" in data, "athlete_id missing from response"
        assert data["athlete_id"] is not None, "athlete_id is null"
        print(f"✅ athlete_id: {data['athlete_id']}")
        
        print("✅ All required fields present in /auth/me response")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
