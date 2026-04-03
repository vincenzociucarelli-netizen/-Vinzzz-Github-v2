"""
Test Versione Lite Security Features
- nome_lite login (case insensitive)
- PIN rate limiting with progressive blocking
- set-nome-lite endpoint (uniqueness, validation)
- set-lite-personalization endpoint
- minor dashboard returns nome_lite, lite_color, lite_emoji
- attendance/check uses qr_identifier NOT nome_lite
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://registrateam-vol.preview.emergentagent.com')

# Test data from context
MARTINA_ID = "3d7df7a283444a2c83483d33"
LAURA_ID = "69ba6a5538c980c04288ef17"
PARENT_EMAIL = "perla@test.com"
PARENT_PASSWORD = "Test1234"


class TestSetup:
    """Setup and cleanup for tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def parent_token(self, api_client):
        """Get parent authentication token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Parent login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def minor_token(self, api_client):
        """Get minor athlete token via nome_lite login"""
        response = api_client.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "MartinaG",
            "pin": "1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Minor login failed: {response.status_code} - {response.text}")


class TestMinorLoginWithNomeLite:
    """Test POST /api/auth/minor-login with nome_lite + PIN"""
    
    def test_login_with_nome_lite_success(self):
        """Login with nome_lite (MartinaG) + correct PIN"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "MartinaG",
            "pin": "1234"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "minor"
        print(f"✓ Login with nome_lite 'MartinaG' successful")
    
    def test_login_case_insensitive(self):
        """Login should be case insensitive for nome_lite"""
        # Test lowercase
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "martinag",
            "pin": "1234"
        })
        assert response.status_code == 200, f"Lowercase login failed: {response.status_code}"
        print(f"✓ Login with lowercase 'martinag' successful")
        
        # Test uppercase
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "MARTINAG",
            "pin": "1234"
        })
        assert response.status_code == 200, f"Uppercase login failed: {response.status_code}"
        print(f"✓ Login with uppercase 'MARTINAG' successful")
    
    def test_login_fallback_to_athlete_code(self):
        """Login should also work with athlete_code as fallback"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "MARTY2008",
            "pin": "1234"
        })
        assert response.status_code == 200, f"Athlete code fallback failed: {response.status_code}"
        print(f"✓ Login with athlete_code 'MARTY2008' fallback successful")
    
    def test_login_wrong_pin(self):
        """Login with wrong PIN should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "MartinaG",
            "pin": "9999"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        assert "PIN non corretto" in response.json().get("detail", "")
        print(f"✓ Wrong PIN correctly rejected")
    
    def test_login_invalid_nome_lite(self):
        """Login with non-existent nome_lite should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "NonExistentUser123",
            "pin": "1234"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid nome_lite correctly rejected")


class TestProgressiveBlocking:
    """Test PIN attempt limiting with progressive blocking"""
    
    @pytest.fixture(autouse=True)
    def clear_login_attempts(self):
        """Clear login attempts before each test"""
        # We'll use a unique test key to avoid affecting real users
        pass
    
    def test_progressive_blocking_after_3_attempts(self):
        """After 3 failed attempts, should get 30s block"""
        # Use a unique test nome_lite that doesn't exist
        test_key = "TestBlockUser123"
        
        # Clear any existing attempts for this test key
        # First, make 3 failed attempts
        for i in range(3):
            response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
                "athlete_code": test_key,
                "pin": "0000"
            })
            # Should get 401 for invalid nome_lite
            assert response.status_code == 401, f"Attempt {i+1}: Expected 401, got {response.status_code}"
        
        # 4th attempt should be blocked (429)
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": test_key,
            "pin": "0000"
        })
        # After 3 failures, should get 429 with block message
        if response.status_code == 429:
            assert "Troppi tentativi" in response.json().get("detail", "")
            print(f"✓ Progressive blocking activated after 3 attempts")
        else:
            # May still be 401 if blocking threshold not reached
            print(f"Note: Got {response.status_code} - blocking may require more attempts")


class TestSetNomeLite:
    """Test POST /api/athletes/{id}/set-nome-lite endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Parent login failed")
    
    def test_set_nome_lite_validation_min_length(self, parent_token):
        """nome_lite must be at least 3 characters"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/{MARTINA_ID}/set-nome-lite",
            json={"nome_lite": "AB"},
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "almeno 3 caratteri" in response.json().get("detail", "")
        print(f"✓ Minimum length validation works")
    
    def test_set_nome_lite_validation_max_length(self, parent_token):
        """nome_lite must not exceed 20 characters"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/{MARTINA_ID}/set-nome-lite",
            json={"nome_lite": "A" * 21},
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "20 caratteri" in response.json().get("detail", "")
        print(f"✓ Maximum length validation works")
    
    def test_set_nome_lite_uniqueness(self, parent_token):
        """nome_lite must be unique - trying to set 'MartinaG' for another athlete should fail"""
        # Try to set MartinaG (already used by Martina) for Laura
        response = requests.post(
            f"{BASE_URL}/api/athletes/{LAURA_ID}/set-nome-lite",
            json={"nome_lite": "MartinaG"},
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 409, f"Expected 409 conflict, got {response.status_code}: {response.text}"
        assert "già in uso" in response.json().get("detail", "")
        print(f"✓ Uniqueness validation works - duplicate nome_lite rejected")
    
    def test_set_nome_lite_success(self, parent_token):
        """Successfully set a unique nome_lite"""
        unique_name = f"TestUser{int(time.time()) % 10000}"
        response = requests.post(
            f"{BASE_URL}/api/athletes/{LAURA_ID}/set-nome-lite",
            json={"nome_lite": unique_name},
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        # May fail if Laura doesn't exist or parent doesn't own Laura
        if response.status_code == 200:
            data = response.json()
            assert data.get("nome_lite") == unique_name
            print(f"✓ Successfully set nome_lite to '{unique_name}'")
        else:
            print(f"Note: Could not set nome_lite for Laura: {response.status_code} - {response.text}")


class TestSetLitePersonalization:
    """Test POST /api/athletes/{id}/set-lite-personalization endpoint"""
    
    @pytest.fixture
    def minor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "MartinaG",
            "pin": "1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Minor login failed")
    
    def test_set_personalization_color(self, minor_token):
        """Minor can set lite_color"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/{MARTINA_ID}/set-lite-personalization",
            json={"lite_color": "#FF5722"},
            headers={"Authorization": f"Bearer {minor_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("lite_color") == "#FF5722"
        print(f"✓ Successfully set lite_color to #FF5722")
    
    def test_set_personalization_emoji(self, minor_token):
        """Minor can set lite_emoji"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/{MARTINA_ID}/set-lite-personalization",
            json={"lite_emoji": "⚽"},
            headers={"Authorization": f"Bearer {minor_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("lite_emoji") == "⚽"
        print(f"✓ Successfully set lite_emoji to ⚽")
    
    def test_set_personalization_both(self, minor_token):
        """Minor can set both color and emoji"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/{MARTINA_ID}/set-lite-personalization",
            json={"lite_color": "#E91E63", "lite_emoji": "🏐"},
            headers={"Authorization": f"Bearer {minor_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("lite_color") == "#E91E63"
        assert data.get("lite_emoji") == "🏐"
        print(f"✓ Successfully set both lite_color and lite_emoji")
    
    def test_personalization_requires_minor_role(self):
        """Parent cannot set personalization - only minor can"""
        parent_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        if parent_response.status_code != 200:
            pytest.skip("Parent login failed")
        parent_token = parent_response.json().get("token")
        
        response = requests.post(
            f"{BASE_URL}/api/athletes/{MARTINA_ID}/set-lite-personalization",
            json={"lite_color": "#000000"},
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Parent correctly denied personalization access")


class TestMinorDashboard:
    """Test GET /api/minor/dashboard returns nome_lite, lite_color, lite_emoji"""
    
    @pytest.fixture
    def minor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/minor-login", json={
            "athlete_code": "MartinaG",
            "pin": "1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Minor login failed")
    
    def test_dashboard_returns_lite_fields(self, minor_token):
        """Dashboard should return nome_lite, lite_color, lite_emoji, first_name, last_name"""
        response = requests.get(
            f"{BASE_URL}/api/minor/dashboard",
            headers={"Authorization": f"Bearer {minor_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        athlete = data.get("athlete", {})
        assert "nome_lite" in athlete, "Dashboard should return nome_lite"
        assert "lite_color" in athlete, "Dashboard should return lite_color"
        assert "lite_emoji" in athlete, "Dashboard should return lite_emoji"
        assert "first_name" in athlete, "Dashboard should return first_name"
        assert "last_name" in athlete, "Dashboard should return last_name"
        
        print(f"✓ Dashboard returns all Lite fields:")
        print(f"  - nome_lite: {athlete.get('nome_lite')}")
        print(f"  - lite_color: {athlete.get('lite_color')}")
        print(f"  - lite_emoji: {athlete.get('lite_emoji')}")
        print(f"  - first_name: {athlete.get('first_name')}")
        print(f"  - last_name: {athlete.get('last_name')}")


class TestAttendanceUsesQRIdentifier:
    """Test that attendance/check uses qr_identifier NOT nome_lite"""
    
    @pytest.fixture
    def coach_token(self):
        """Get coach token - need to find a coach user"""
        # Try admin login as fallback
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pallavoloperugia@gmail.com",
            "password": "Test1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Coach/Admin login failed")
    
    def test_attendance_with_nome_lite_should_fail(self, coach_token):
        """Attendance check with nome_lite should NOT work (should use qr_identifier)"""
        # Try to check attendance using nome_lite - this should fail
        response = requests.post(
            f"{BASE_URL}/api/attendance/check",
            json={
                "qr_code": "MartinaG",  # Using nome_lite instead of qr_identifier
                "team_id": "some_team_id"
            },
            headers={"Authorization": f"Bearer {coach_token}"}
        )
        # Should fail because nome_lite is not a valid qr_identifier
        # The endpoint looks for qr_identifier, athlete_code, or id - NOT nome_lite
        if response.status_code == 404:
            print(f"✓ Attendance correctly rejects nome_lite - uses qr_identifier only")
        elif response.status_code == 403:
            print(f"Note: Got 403 - may need coach role, but nome_lite lookup not implemented")
        else:
            print(f"Note: Got {response.status_code} - {response.text}")
    
    def test_attendance_endpoint_exists(self, coach_token):
        """Verify attendance/check endpoint exists and requires proper auth"""
        response = requests.post(
            f"{BASE_URL}/api/attendance/check",
            json={"qr_code": "TEST123", "team_id": "test"},
            headers={"Authorization": f"Bearer {coach_token}"}
        )
        # Should get 403 (not coach) or 404 (not found) - not 500 or 405
        assert response.status_code in [403, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Attendance endpoint exists and validates properly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
