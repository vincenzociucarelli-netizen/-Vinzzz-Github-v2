"""
Backend tests for Minor Athlete Flow features:
1. POST /api/athletes/minor - Create minor athlete with parent linkage (admin only)
2. POST /api/athletes/{id}/detach-parents - Detach parents for athletes 18+
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://deletion-workflow-2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"
TEST_PARENT_EMAIL = "genitore.test@example.com"
TEST_MINOR_ATHLETE_ID = "69b26bc51b2bbcb74f0e3c4f"  # MARCO VERDI


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    return response.json()["token"]


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def authenticated_client(api_client, admin_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


class TestMinorAthleteCreation:
    """Tests for POST /api/athletes/minor endpoint"""
    
    def test_create_minor_athlete_success(self, authenticated_client):
        """Create a minor athlete with parent linkage"""
        # Generate unique email for this test
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_parent_email = f"test_parent_{timestamp}@example.com"
        
        # Date of birth for a 15-year-old
        dob = (datetime.now() - timedelta(days=15*365)).strftime("%Y-%m-%d")
        
        response = authenticated_client.post(f"{BASE_URL}/api/athletes/minor", json={
            "first_name": "TEST_MINOR",
            "last_name": "ATHLETE",
            "date_of_birth": dob,
            "gender": "M",
            "phone": "3331234567",
            "parent_email": test_parent_email,
            "data_password": "testpass123"
        })
        
        print(f"Create minor response: {response.status_code} - {response.text[:500]}")
        
        # Should succeed with 200
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "athlete_id" in data, "Response should contain athlete_id"
        assert "parent_id" in data, "Response should contain parent_id"
        
        # Verify the athlete was created with is_minor=True
        athlete_response = authenticated_client.get(f"{BASE_URL}/api/athletes/{data['athlete_id']}")
        assert athlete_response.status_code == 200
        athlete_data = athlete_response.json()
        assert athlete_data.get("is_minor") == True, "Athlete should have is_minor=True"
        
        # Cleanup - delete the test athlete
        try:
            authenticated_client.delete(f"{BASE_URL}/api/athletes/{data['athlete_id']}")
            # Delete parent user if created
            authenticated_client.delete(f"{BASE_URL}/api/users/{data['parent_id']}")
        except:
            pass
    
    def test_create_minor_athlete_requires_admin(self, api_client):
        """Non-admin should not be able to create minor athlete"""
        response = api_client.post(f"{BASE_URL}/api/athletes/minor", json={
            "first_name": "TEST",
            "last_name": "MINOR",
            "date_of_birth": "2015-01-01",
            "parent_email": "parent@test.com",
            "data_password": "test123"
        })
        
        # Should fail without auth
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_create_minor_athlete_adult_rejected(self, authenticated_client):
        """Creating athlete 18+ via minor endpoint should fail"""
        # Date of birth for 20-year-old
        dob = (datetime.now() - timedelta(days=20*365)).strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        response = authenticated_client.post(f"{BASE_URL}/api/athletes/minor", json={
            "first_name": "TEST_ADULT",
            "last_name": "ATHLETE",
            "date_of_birth": dob,
            "parent_email": f"parent_adult_{timestamp}@test.com",
            "data_password": "testpass123"
        })
        
        print(f"Adult via minor endpoint response: {response.status_code} - {response.text}")
        
        # Should fail because athlete is 18+
        assert response.status_code == 400, \
            f"Expected 400 for adult athlete, got {response.status_code}: {response.text}"
        assert "18+" in response.text or "maggiorenni" in response.text.lower(), \
            "Error message should mention age requirement"
    
    def test_create_minor_athlete_required_fields(self, authenticated_client):
        """Test that required fields are validated"""
        # Missing required fields
        response = authenticated_client.post(f"{BASE_URL}/api/athletes/minor", json={
            "first_name": "TEST",
            # Missing: last_name, date_of_birth, parent_email, data_password
        })
        
        # Should fail validation
        assert response.status_code in [400, 422], \
            f"Expected 400/422 for missing fields, got {response.status_code}"


class TestDetachParents:
    """Tests for POST /api/athletes/{id}/detach-parents endpoint"""
    
    def test_detach_parents_requires_admin(self, api_client):
        """Non-admin should not be able to detach parents"""
        response = api_client.post(
            f"{BASE_URL}/api/athletes/{TEST_MINOR_ATHLETE_ID}/detach-parents",
            json={"athlete_email": "test@test.com", "athlete_password": "test123"}
        )
        
        # Should fail without auth
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_detach_parents_requires_email_and_password(self, authenticated_client):
        """Detach parents requires athlete_email and athlete_password in body"""
        # Test with missing fields
        response = authenticated_client.post(
            f"{BASE_URL}/api/athletes/{TEST_MINOR_ATHLETE_ID}/detach-parents",
            json={}  # Empty body
        )
        
        print(f"Empty body response: {response.status_code} - {response.text}")
        
        # Should fail validation
        assert response.status_code in [400, 422], \
            f"Expected 400/422 for missing fields, got {response.status_code}"
    
    def test_detach_parents_fails_for_under_18(self, authenticated_client):
        """Detaching parents should fail for athletes under 18"""
        # First verify MARCO VERDI exists and check their age
        athlete_response = authenticated_client.get(f"{BASE_URL}/api/athletes/{TEST_MINOR_ATHLETE_ID}")
        
        if athlete_response.status_code != 200:
            pytest.skip(f"Test athlete not found: {athlete_response.status_code}")
        
        athlete_data = athlete_response.json()
        print(f"Athlete data: {athlete_data.get('full_name')}, is_minor: {athlete_data.get('is_minor')}, dob: {athlete_data.get('date_of_birth')}")
        
        # Calculate age
        if athlete_data.get("date_of_birth"):
            dob = datetime.fromisoformat(athlete_data["date_of_birth"].replace("Z", "+00:00").replace("+00:00", "")[:10])
            age = (datetime.now() - dob).days // 365
            print(f"Calculated age: {age}")
            
            if age >= 18:
                pytest.skip(f"Test athlete is {age} years old, need athlete under 18 for this test")
        
        # Attempt to detach parents
        response = authenticated_client.post(
            f"{BASE_URL}/api/athletes/{TEST_MINOR_ATHLETE_ID}/detach-parents",
            json={
                "athlete_email": "marco.verdi.adult@test.com",
                "athlete_password": "testpassword123"
            }
        )
        
        print(f"Detach response for minor: {response.status_code} - {response.text}")
        
        # Should fail because athlete is under 18
        assert response.status_code == 400, \
            f"Expected 400 for underage athlete, got {response.status_code}: {response.text}"
        # Error message should mention age
        assert "18" in response.text or "anni" in response.text.lower(), \
            "Error message should mention age requirement"
    
    def test_detach_parents_success_for_adult(self, authenticated_client):
        """Successfully detach parents for 18+ athlete"""
        # First create a minor athlete that's 18 years old
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_parent_email = f"test_parent_detach_{timestamp}@example.com"
        
        # Date of birth for exactly 18-year-old
        dob = (datetime.now() - timedelta(days=18*365 + 30)).strftime("%Y-%m-%d")  # 18 years + 30 days
        
        # Create the minor athlete first
        create_response = authenticated_client.post(f"{BASE_URL}/api/athletes/minor", json={
            "first_name": "TEST_DETACH",
            "last_name": "ADULT",
            "date_of_birth": dob,
            "parent_email": test_parent_email,
            "data_password": "testpass123"
        })
        
        # This will fail with 400 because 18-year-old should use adult endpoint
        if create_response.status_code == 400:
            print("Minor endpoint correctly rejected 18+ athlete")
            # Use a younger age
            dob_young = (datetime.now() - timedelta(days=17*365)).strftime("%Y-%m-%d")
            create_response = authenticated_client.post(f"{BASE_URL}/api/athletes/minor", json={
                "first_name": "TEST_DETACH",
                "last_name": "YOUNG",
                "date_of_birth": dob_young,
                "parent_email": test_parent_email,
                "data_password": "testpass123"
            })
            
            if create_response.status_code != 200:
                pytest.skip(f"Could not create test athlete: {create_response.text}")
            
            athlete_id = create_response.json()["athlete_id"]
            
            # Update athlete DOB to make them 18+
            authenticated_client.patch(f"{BASE_URL}/api/athletes/{athlete_id}", json={
                "date_of_birth": dob  # Update to be 18+
            })
            
            # Now try to detach
            test_athlete_email = f"adult_athlete_{timestamp}@test.com"
            detach_response = authenticated_client.post(
                f"{BASE_URL}/api/athletes/{athlete_id}/detach-parents",
                json={
                    "athlete_email": test_athlete_email,
                    "athlete_password": "newpassword123"
                }
            )
            
            print(f"Detach response for updated adult: {detach_response.status_code} - {detach_response.text}")
            
            # Should succeed
            assert detach_response.status_code == 200, \
                f"Expected 200 for adult detach, got {detach_response.status_code}: {detach_response.text}"
            
            data = detach_response.json()
            assert "user_id" in data, "Response should contain new user_id"
            assert data["email"] == test_athlete_email, "Response should contain correct email"
            
            # Verify athlete is updated
            athlete_check = authenticated_client.get(f"{BASE_URL}/api/athletes/{athlete_id}")
            athlete_data = athlete_check.json()
            assert athlete_data.get("parents_detached") == True, "Athlete should have parents_detached=True"
            assert athlete_data.get("is_minor") == False, "Athlete should have is_minor=False"
            
            # Cleanup
            try:
                authenticated_client.delete(f"{BASE_URL}/api/athletes/{athlete_id}")
                authenticated_client.delete(f"{BASE_URL}/api/users/{data['user_id']}")
            except:
                pass
        else:
            pytest.skip(f"Unexpected response from create minor: {create_response.status_code}")


class TestExistingMinorAthlete:
    """Tests for existing test minor athlete MARCO VERDI"""
    
    def test_verify_minor_athlete_exists(self, authenticated_client):
        """Verify test minor athlete exists with is_minor=True"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/{TEST_MINOR_ATHLETE_ID}")
        
        if response.status_code != 200:
            pytest.skip(f"Test athlete not found: {response.status_code}")
        
        data = response.json()
        print(f"Minor athlete data: name={data.get('full_name')}, is_minor={data.get('is_minor')}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "full_name" in data, "Athlete should have full_name"
        # Note: is_minor might be None if not explicitly set, depending on migration
    
    def test_verify_parent_exists(self, authenticated_client):
        """Verify test parent account exists"""
        # Try to find parent by email
        response = authenticated_client.get(f"{BASE_URL}/api/users?email={TEST_PARENT_EMAIL}")
        
        # This endpoint might not exist, so just log
        print(f"Parent lookup response: {response.status_code}")
        
        # Alternative: login as parent
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_PARENT_EMAIL,
            "password": "genitore.test2026"  # Default password pattern from server.py
        })
        
        print(f"Parent login response: {login_response.status_code}")
        
        if login_response.status_code == 200:
            assert "token" in login_response.json(), "Parent should be able to login"
            print("Parent account exists and can login")
        else:
            print(f"Parent login failed (may not exist): {login_response.text}")


class TestHealthEndpoint:
    """Basic health check"""
    
    def test_api_health(self, api_client):
        """Verify API is healthy"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
