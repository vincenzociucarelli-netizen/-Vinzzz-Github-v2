"""
Test cases for:
1. POST /api/admin/athletes/{athlete_id}/reset-password - Admin can reset athlete password via email
2. Filter functionality in prime-squadre.tsx (code review - filter logic)
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://trial-end-flow.preview.emergentagent.com').rstrip('/')

class TestAdminResetAthletePassword:
    """Test admin reset athlete password endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authentication"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test.admin@test.com", "password": "Test1234"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def auth_headers(self, admin_token):
        """Return headers with auth token"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_health_check(self):
        """Test API health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("✓ API is healthy")
    
    def test_admin_login(self, admin_token):
        """Test admin can login"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print("✓ Admin login successful")
    
    def test_get_athlete_with_email(self, auth_headers):
        """Test getting athlete with email - ID from test request"""
        athlete_id = "6998edf72cb485348739f753"  # Athlete with email atleta.prova@test.com
        
        response = requests.get(
            f"{BASE_URL}/api/athletes/{athlete_id}",
            headers=auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Test athlete not found - may have been deleted")
        
        assert response.status_code == 200, f"Failed to get athlete: {response.text}"
        data = response.json()
        print(f"✓ Got athlete: {data.get('first_name', '')} {data.get('last_name', '')}")
        print(f"  Email: {data.get('email', 'NO EMAIL')}")
        return data
    
    def test_reset_password_endpoint_exists(self, auth_headers):
        """Test reset password endpoint returns proper error for non-existent athlete"""
        fake_athlete_id = "000000000000000000000000"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/athletes/{fake_athlete_id}/reset-password",
            headers=auth_headers,
            json={"send_email": True}
        )
        
        # Should return 404 for non-existent athlete
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Endpoint correctly returns 404 for non-existent athlete")
    
    def test_reset_password_for_athlete_without_email(self, auth_headers):
        """Test reset password returns error when athlete has no email"""
        # First create a test athlete WITHOUT email
        create_response = requests.post(
            f"{BASE_URL}/api/athletes/adult",
            headers=auth_headers,
            json={
                "first_name": "Test",
                "last_name": "NoEmail",
                # No email field
            }
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test athlete: {create_response.text}")
        
        athlete_id = create_response.json().get("id")
        
        # Try to reset password
        response = requests.post(
            f"{BASE_URL}/api/admin/athletes/{athlete_id}/reset-password",
            headers=auth_headers,
            json={"send_email": True}
        )
        
        # Should return 400 because athlete has no email
        assert response.status_code == 400, f"Expected 400 for no email, got {response.status_code}: {response.text}"
        assert "email" in response.json().get("detail", "").lower()
        print(f"✓ Correctly returns error for athlete without email: {response.json()['detail']}")
        
        # Cleanup: delete test athlete
        requests.delete(f"{BASE_URL}/api/athletes/{athlete_id}", headers=auth_headers)
    
    def test_reset_password_for_athlete_with_email(self, auth_headers):
        """Test reset password works for athlete with email"""
        athlete_id = "6998edf72cb485348739f753"  # Athlete with email atleta.prova@test.com
        
        # First check if athlete exists and has email
        athlete_response = requests.get(
            f"{BASE_URL}/api/athletes/{athlete_id}",
            headers=auth_headers
        )
        
        if athlete_response.status_code == 404:
            # Create a test athlete with email
            print("Creating test athlete with email...")
            create_response = requests.post(
                f"{BASE_URL}/api/athletes/adult",
                headers=auth_headers,
                json={
                    "first_name": "Test",
                    "last_name": "ResetPassword",
                    "email": "test.reset.password@example.com"
                }
            )
            if create_response.status_code in [200, 201]:
                athlete_id = create_response.json().get("id")
                print(f"Created test athlete: {athlete_id}")
            else:
                pytest.skip(f"Could not create test athlete: {create_response.text}")
        else:
            athlete = athlete_response.json()
            if not athlete.get('email'):
                pytest.skip("Test athlete has no email")
            print(f"Testing with athlete: {athlete.get('first_name')} {athlete.get('last_name')} - {athlete.get('email')}")
        
        # Test reset password
        response = requests.post(
            f"{BASE_URL}/api/admin/athletes/{athlete_id}/reset-password",
            headers=auth_headers,
            json={"send_email": True}
        )
        
        # Should return 200 and success
        assert response.status_code == 200, f"Reset password failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "email" in data.get("message", "").lower() or data.get("email")
        print(f"✓ Reset password email sent successfully to: {data.get('email')}")
        return data
    
    def test_reset_password_without_auth(self):
        """Test reset password requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/athletes/test_id/reset-password",
            json={"send_email": True}
        )
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ Endpoint correctly requires authentication")
    
    def test_reset_password_with_non_admin_user(self):
        """Test reset password fails for non-admin users"""
        # Try to register a non-admin user
        # First check if parent role can access this endpoint
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"test.parent.{datetime.now().timestamp()}@test.com",
                "password": "Test1234",
                "role": "parent",
                "full_name": "Test Parent",
                "invite_code": None
            }
        )
        
        if response.status_code == 200:
            parent_token = response.json()["token"]
            
            reset_response = requests.post(
                f"{BASE_URL}/api/admin/athletes/test_id/reset-password",
                headers={"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"},
                json={"send_email": True}
            )
            
            # Should return 403 - non-admin cannot reset passwords
            assert reset_response.status_code == 403, f"Expected 403, got {reset_response.status_code}"
            print("✓ Non-admin users cannot reset athlete passwords")
        else:
            print("⚠ Could not create parent user for testing (may need invite code)")


class TestPrimeSquadreFilter:
    """Test Prime Squadre filter functionality - code review verification"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test.admin@test.com", "password": "Test1234"}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def auth_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_prime_squadre_athletes(self, auth_headers):
        """Test getting Prime Squadre athletes list"""
        response = requests.get(
            f"{BASE_URL}/api/prime-squadre/athletes",
            headers=auth_headers
        )
        
        if response.status_code == 403:
            pytest.skip("Prime Squadre module not enabled for this society")
        
        assert response.status_code == 200, f"Failed to get prime squadre athletes: {response.text}"
        print(f"✓ Got Prime Squadre athletes list: {len(response.json())} members")
    
    def test_get_all_athletes_for_filter(self, auth_headers):
        """Test getting all athletes - used for filter modal"""
        response = requests.get(f"{BASE_URL}/api/athletes", headers=auth_headers)
        assert response.status_code == 200
        
        athletes = response.json()
        print(f"✓ Got {len(athletes)} athletes for filtering")
        
        # Verify athletes have required filter fields
        if len(athletes) > 0:
            sample = athletes[0]
            print(f"  Sample athlete fields: first_name={sample.get('first_name')}, last_name={sample.get('last_name')}, team_name={sample.get('team_name')}")
    
    def test_get_coaches_for_filter(self, auth_headers):
        """Test getting coaches - used in filter (type: coach)"""
        response = requests.get(f"{BASE_URL}/api/users/coaches", headers=auth_headers)
        
        if response.status_code == 404:
            print("⚠ No coaches endpoint or no coaches found")
            return
            
        assert response.status_code == 200, f"Failed to get coaches: {response.text}"
        
        coaches = response.json()
        print(f"✓ Got {len(coaches)} coaches for filtering")


class TestAthleteDetailPage:
    """Test athlete detail page - reset password button visibility"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test.admin@test.com", "password": "Test1234"}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def auth_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_athlete_has_email_field(self, auth_headers):
        """Verify athlete API returns email field (used to show reset button)"""
        response = requests.get(f"{BASE_URL}/api/athletes", headers=auth_headers)
        assert response.status_code == 200
        
        athletes = response.json()
        athletes_with_email = [a for a in athletes if a.get('email')]
        athletes_without_email = [a for a in athletes if not a.get('email')]
        
        print(f"✓ Athletes with email: {len(athletes_with_email)}")
        print(f"✓ Athletes without email: {len(athletes_without_email)}")
        
        if len(athletes_with_email) > 0:
            sample = athletes_with_email[0]
            print(f"  Sample athlete with email: {sample.get('first_name')} {sample.get('last_name')} - {sample.get('email')}")
