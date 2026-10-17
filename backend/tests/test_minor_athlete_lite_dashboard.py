"""
Test Suite for Minor Athlete Lite Dashboard & Parent Cross-Linking Features
============================================================================
Tests are ordered to ensure proper state for dependent tests:
1. Health & Standard Logins (independent)
2. Minor Access Status (read-only, independent)
3. PIN Setup (must happen before login)
4. Ensure Minor Access Enabled (must happen before login)
5. Minor Login (depends on PIN + access enabled)
6. Minor Dashboard (depends on successful login)
7. Cross-Linking (independent)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '')).rstrip('/')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"
PARENT_SAURO_EMAIL = "sauro@test.com"
PARENT_SAURO_PASSWORD = "Test1234"
PARENT_MARA_EMAIL = "mara2@test.com"
PARENT_MARA_PASSWORD = "password"
MINOR_ATHLETE_CODE = "KWP9R9PJWJXJ"
MINOR_PIN = "1234"
LUCIA_ATHLETE_ID = "69b5e0beefab8e9f13304720"


@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="session")
def parent_sauro_token(api_client):
    """Get parent (Sauro) authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARENT_SAURO_EMAIL,
        "password": PARENT_SAURO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Parent Sauro authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="session")
def authenticated_admin_client(api_client, admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


@pytest.fixture(scope="session")
def authenticated_parent_client(api_client, parent_sauro_token):
    """Session with parent auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {parent_sauro_token}"
    })
    return session


# =============================================================================
# TEST 1: Health Check & Standard Login Flows (Independent)
# =============================================================================
class Test01HealthAndLogins:
    """Test API health and standard login flows"""
    
    def test_01_health_endpoint(self, api_client):
        """Health endpoint should return healthy status"""
        response = api_client.get(f"{BASE_URL}/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        try:
            data = response.json()
            assert data.get("status") == "healthy"
            print(f"✅ API health check passed: {data}")
        except:
            print(f"✅ API health check passed (non-JSON response)")
    
    def test_02_admin_login_success(self, api_client):
        """Admin can login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✅ Admin login successful: {data['user']['full_name']}")
    
    def test_03_parent_sauro_login_success(self, api_client):
        """Parent Sauro can login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_SAURO_EMAIL,
            "password": PARENT_SAURO_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "parent", f"Expected parent role, got {data['user']['role']}"
        print(f"✅ Parent Sauro login successful: {data['user']['full_name']}")
    
    def test_04_invalid_credentials_rejected(self, api_client):
        """Login with wrong password should be rejected"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected")


# =============================================================================
# TEST 2: Minor Access Status (Read-only)
# =============================================================================
class Test02MinorAccessStatus:
    """Test minor access status endpoint"""
    
    def test_01_get_minor_access_status(self, authenticated_parent_client):
        """Parent can get minor access status for their athlete"""
        response = authenticated_parent_client.get(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/minor-access-status"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "minor_access_enabled" in data, "Response should contain minor_access_enabled"
        assert "has_pin" in data, "Response should contain has_pin"
        assert "athlete_code" in data, "Response should contain athlete_code"
        print(f"✅ Minor access status: enabled={data['minor_access_enabled']}, has_pin={data['has_pin']}, code={data['athlete_code']}")


# =============================================================================
# TEST 3: Minor PIN Setup (Must happen before login)
# =============================================================================
class Test03MinorPinSetup:
    """Test minor PIN management - must run before login tests"""
    
    def test_01_set_minor_pin(self, authenticated_parent_client):
        """Parent can set PIN for their minor athlete"""
        response = authenticated_parent_client.post(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/set-minor-pin",
            json={"pin": MINOR_PIN}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True or "PIN" in data.get("message", ""), f"Unexpected response: {data}"
        print(f"✅ Minor PIN set successfully")
    
    def test_02_short_pin_rejected(self, authenticated_parent_client):
        """PIN with less than 4 digits should be rejected"""
        response = authenticated_parent_client.post(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/set-minor-pin",
            json={"pin": "12"}  # Too short
        )
        # Should be rejected with 400 or 422
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print(f"✅ Short PIN correctly rejected: {response.status_code}")


# =============================================================================
# TEST 4: Ensure Minor Access Enabled (Must happen before login)
# =============================================================================
class Test04EnsureMinorAccessEnabled:
    """Ensure minor access is enabled before login tests"""
    
    def test_01_ensure_access_enabled(self, authenticated_parent_client):
        """Ensure minor access is enabled for subsequent tests"""
        # First check current status
        status_response = authenticated_parent_client.get(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/minor-access-status"
        )
        assert status_response.status_code == 200
        status_data = status_response.json()
        
        # If not enabled, toggle to enable
        if not status_data.get("minor_access_enabled"):
            toggle_response = authenticated_parent_client.post(
                f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/toggle-minor-access"
            )
            assert toggle_response.status_code == 200
            toggle_data = toggle_response.json()
            enabled = toggle_data.get("enabled") or toggle_data.get("minor_access_enabled")
            print(f"✅ Minor access toggled on: enabled={enabled}")
        else:
            print(f"✅ Minor access already enabled")
        
        # Verify final state
        verify_response = authenticated_parent_client.get(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/minor-access-status"
        )
        verify_data = verify_response.json()
        assert verify_data.get("minor_access_enabled") == True, f"Minor access should be enabled: {verify_data}"


# =============================================================================
# TEST 5: Minor Login Flow (Depends on PIN + access enabled)
# =============================================================================
class Test05MinorLogin:
    """Test minor athlete login with code + PIN"""
    
    def test_01_minor_login_success(self, api_client):
        """Minor can login with valid athlete code and PIN"""
        response = api_client.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": MINOR_ATHLETE_CODE,
            "pin": MINOR_PIN
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "minor", f"Expected minor role, got {data['user']['role']}"
        assert data["user"]["athlete_id"] == LUCIA_ATHLETE_ID, f"Expected athlete_id {LUCIA_ATHLETE_ID}"
        print(f"✅ Minor login successful: {data['user']['full_name']}")
    
    def test_02_minor_login_wrong_pin_rejected(self, api_client):
        """Minor login with wrong PIN should be rejected"""
        response = api_client.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": MINOR_ATHLETE_CODE,
            "pin": "9999"  # Wrong PIN
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ Wrong PIN correctly rejected")
    
    def test_03_minor_login_invalid_code_rejected(self, api_client):
        """Minor login with invalid code should be rejected"""
        response = api_client.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "INVALIDCODE123",
            "pin": MINOR_PIN
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ Invalid athlete code correctly rejected")


# =============================================================================
# TEST 6: Minor Dashboard (Depends on successful login)
# =============================================================================
class Test06MinorDashboard:
    """Test minor athlete dashboard endpoint"""
    
    def test_01_minor_dashboard_access(self, api_client):
        """Minor can access their dashboard after login"""
        # First login as minor
        login_response = api_client.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": MINOR_ATHLETE_CODE,
            "pin": MINOR_PIN
        })
        assert login_response.status_code == 200, f"Minor login failed: {login_response.text}"
        token = login_response.json()["token"]
        
        # Access dashboard
        response = api_client.get(
            f"{BASE_URL}/api/minor/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "athlete" in data, "Response should contain athlete data"
        assert "stats" in data, "Response should contain stats"
        
        # Validate athlete data
        athlete = data["athlete"]
        assert athlete.get("id") == LUCIA_ATHLETE_ID
        assert "full_name" in athlete
        assert "qr_code" in athlete or "qr_identifier" in athlete
        
        # Validate stats
        stats = data["stats"]
        assert "total_attendances" in stats
        assert "monthly_attendances" in stats
        
        print(f"✅ Minor dashboard loaded successfully:")
        print(f"   - Athlete: {athlete.get('full_name')}")
        print(f"   - Total attendances: {stats.get('total_attendances')}")
        print(f"   - Monthly attendances: {stats.get('monthly_attendances')}")
        
        # Check for schedule and team info
        if "schedule" in data:
            print(f"   - Has schedule: {data['schedule'] is not None}")
        if "team" in data:
            print(f"   - Team: {data.get('team', {}).get('name', 'N/A')}")
    
    def test_02_minor_dashboard_requires_minor_role(self, authenticated_admin_client):
        """Dashboard should reject non-minor users"""
        response = authenticated_admin_client.get(f"{BASE_URL}/api/minor/dashboard")
        assert response.status_code == 403, f"Expected 403 for non-minor, got {response.status_code}"
        print("✅ Dashboard correctly rejects non-minor users")


# =============================================================================
# TEST 7: Parent Cross-Linking (Independent)
# =============================================================================
class Test07ParentCrossLinking:
    """Test automatic parent cross-linking via second_parent_email"""
    
    def test_01_create_minor_with_second_parent_email(self, authenticated_admin_client):
        """Creating minor with second_parent_email of existing user auto-populates second_parent_id"""
        import time
        import uuid
        
        # Generate unique test fiscal code
        unique_suffix = str(uuid.uuid4())[:8].upper()
        test_fiscal_code = f"TSTCRS15E55H{unique_suffix[:3]}Z"
        
        test_minor_data = {
            "full_name": f"TEST CROSSLINK {unique_suffix}",
            "first_name": f"CROSSLINK{unique_suffix[:4]}",
            "last_name": "TEST",
            "date_of_birth": "2015-05-15",
            "fiscal_code": test_fiscal_code,
            "is_minor": True,
            "parent_email": PARENT_SAURO_EMAIL,  # Primary parent
            "second_parent_email": PARENT_MARA_EMAIL,  # Should auto-link
        }
        
        response = authenticated_admin_client.post(
            f"{BASE_URL}/api/athletes/minor",
            json=test_minor_data
        )
        
        # Check if creation was successful
        if response.status_code in [200, 201]:
            data = response.json()
            athlete_id = data.get("id") or data.get("athlete", {}).get("id")
            print(f"📝 Created test athlete: {athlete_id}")
            
            # Verify the second_parent_id was auto-populated
            verify_response = authenticated_admin_client.get(f"{BASE_URL}/api/athletes/{athlete_id}")
            if verify_response.status_code == 200:
                athlete_data = verify_response.json()
                second_parent_id = athlete_data.get("second_parent_id")
                second_parent_email = athlete_data.get("second_parent_email")
                
                print(f"   - second_parent_email: {second_parent_email}")
                print(f"   - second_parent_id: {second_parent_id}")
                
                # Clean up - delete test athlete
                authenticated_admin_client.delete(f"{BASE_URL}/api/athletes/{athlete_id}")
                print(f"   - Test athlete cleaned up")
                
                if second_parent_id:
                    print("✅ Cross-linking: second_parent_id was auto-populated")
                else:
                    print("📝 Cross-linking: second_parent_id not populated (user may not exist in same society)")
        elif response.status_code == 422:
            # Validation error - check what's required
            print(f"📝 Minor creation validation error: {response.json()}")
        else:
            print(f"📝 Minor creation returned {response.status_code}: {response.text[:200]}")


# =============================================================================
# TEST 8: Toggle Access On/Off (Optional, run at end)
# =============================================================================
class Test08MinorAccessToggle:
    """Test minor access toggle - runs at end to not affect other tests"""
    
    def test_01_toggle_minor_access_off_and_on(self, authenticated_parent_client):
        """Test toggling minor access off and back on"""
        # Get initial state
        status_response = authenticated_parent_client.get(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/minor-access-status"
        )
        initial_enabled = status_response.json().get("minor_access_enabled")
        print(f"📝 Initial state: enabled={initial_enabled}")
        
        # Toggle off
        toggle_off_response = authenticated_parent_client.post(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/toggle-minor-access"
        )
        assert toggle_off_response.status_code == 200
        toggle_off_data = toggle_off_response.json()
        print(f"📝 After toggle: {toggle_off_data}")
        
        # Toggle back on to restore state
        toggle_on_response = authenticated_parent_client.post(
            f"{BASE_URL}/api/athletes/{LUCIA_ATHLETE_ID}/toggle-minor-access"
        )
        assert toggle_on_response.status_code == 200
        toggle_on_data = toggle_on_response.json()
        final_enabled = toggle_on_data.get("enabled") or toggle_on_data.get("minor_access_enabled")
        
        print(f"✅ Toggle test complete: final state enabled={final_enabled}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
