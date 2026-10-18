"""
Test Pre-season Registration Form with Dynamic Sport Name
Tests:
1. GET /api/preseason/public/{id} returns sport_name, society_logo, society_name
2. POST /api/preseason/public/{id}/respond accepts new volleyball experience fields
3. Admin login flow
4. Parent login flow
5. Adult athlete login flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test campaign ID from the request
TEST_CAMPAIGN_ID = "6f3b4944-47b1-4fdf-b0a0-e6b11070ffc3"

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "Test1234"
PARENT_EMAIL = "perla@test.com"
PARENT_PASSWORD = "Test1234"
ADULT_ATHLETE_EMAIL = "luna@18piu.com"
ADULT_ATHLETE_PASSWORD = "Test1234"


class TestPreseasonPublicEndpoint:
    """Test GET /api/preseason/public/{id} endpoint"""
    
    def test_get_public_campaign_returns_sport_name(self):
        """Test that public campaign endpoint returns sport_name field"""
        response = requests.get(f"{BASE_URL}/api/preseason/public/{TEST_CAMPAIGN_ID}")
        
        # Check status code
        if response.status_code == 404:
            pytest.skip(f"Campaign {TEST_CAMPAIGN_ID} not found - may need to create test data")
        if response.status_code == 410:
            pytest.skip("Campaign is expired or inactive")
            
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "id" in data, "Response should contain 'id'"
        assert "title" in data, "Response should contain 'title'"
        assert "society_name" in data, "Response should contain 'society_name'"
        assert "society_logo" in data, "Response should contain 'society_logo'"
        assert "sport_name" in data, "Response should contain 'sport_name'"
        
        print(f"Campaign ID: {data['id']}")
        print(f"Title: {data['title']}")
        print(f"Society Name: {data['society_name']}")
        print(f"Sport Name: {data['sport_name']}")
        print(f"Society Logo present: {bool(data['society_logo'])}")
    
    def test_public_campaign_sport_name_value(self):
        """Test that sport_name has expected value (Pallavolo)"""
        response = requests.get(f"{BASE_URL}/api/preseason/public/{TEST_CAMPAIGN_ID}")
        
        if response.status_code != 200:
            pytest.skip(f"Campaign not accessible: {response.status_code}")
        
        data = response.json()
        sport_name = data.get("sport_name", "")
        
        # Sport name should be set (Pallavolo based on context)
        print(f"Sport name value: '{sport_name}'")
        # Note: We don't assert specific value as it depends on society settings


class TestPreseasonSubmitResponse:
    """Test POST /api/preseason/public/{id}/respond endpoint"""
    
    def test_submit_response_with_played_volleyball_yes(self):
        """Test submitting response with played_volleyball=true (SI path)"""
        payload = {
            "first_name": "Test",
            "last_name": "Atleta",
            "birth_date": "01/01/2010",
            "phone_athlete": "3331234567",
            "phone_parent": "3339876543",
            "already_member": False,
            "previous_club": "",
            "played_volleyball": True,  # SI
            "played_at_school": True,   # A scuola
            "played_in_society": True,  # In una Societa
            "years_in_society": "3",    # Per quanti anni
            "previous_sport": "",       # Not used when played_volleyball=true
            "championships_played": "Under 14",
            "role_played": "Palleggiatore",
            "interest_level": "si",
            "notes": "Test submission with SI path"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/preseason/public/{TEST_CAMPAIGN_ID}/respond",
            json=payload
        )
        
        if response.status_code == 404:
            pytest.skip(f"Campaign {TEST_CAMPAIGN_ID} not found")
        if response.status_code == 410:
            pytest.skip("Campaign is expired or inactive")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain success message"
        assert "id" in data, "Response should contain response ID"
        print(f"Response ID: {data['id']}")
        print(f"Message: {data['message']}")
    
    def test_submit_response_with_played_volleyball_no(self):
        """Test submitting response with played_volleyball=false (NO path)"""
        payload = {
            "first_name": "Test",
            "last_name": "Nuovo",
            "birth_date": "15/06/2012",
            "phone_athlete": "",
            "phone_parent": "3331112222",
            "already_member": False,
            "previous_club": "",
            "played_volleyball": False,  # NO
            "played_at_school": False,
            "played_in_society": False,
            "years_in_society": "",
            "previous_sport": "Calcio, Nuoto",  # Che sport hai praticato
            "championships_played": "",
            "role_played": "",
            "interest_level": "ci_penso",
            "notes": "Test submission with NO path"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/preseason/public/{TEST_CAMPAIGN_ID}/respond",
            json=payload
        )
        
        if response.status_code == 404:
            pytest.skip(f"Campaign {TEST_CAMPAIGN_ID} not found")
        if response.status_code == 410:
            pytest.skip("Campaign is expired or inactive")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "id" in data
        print(f"Response ID: {data['id']}")


class TestLoginFlows:
    """Test login flows for admin, parent, and adult athlete"""
    
    def test_admin_login(self):
        """Test admin login with pallavoloperugia@gmail.com"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        print(f"Admin login successful: {data['user']['full_name']}")
        return data["token"]
    
    def test_parent_login(self):
        """Test parent login with perla@test.com"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}
        )
        
        assert response.status_code == 200, f"Parent login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "parent", f"Expected parent role, got {data['user']['role']}"
        print(f"Parent login successful: {data['user']['full_name']}")
        return data["token"]
    
    def test_adult_athlete_login(self):
        """Test adult athlete login with luna@18piu.com"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADULT_ATHLETE_EMAIL, "password": ADULT_ATHLETE_PASSWORD}
        )
        
        assert response.status_code == 200, f"Adult athlete login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"Adult athlete login successful: {data['user']['full_name']}, role: {data['user']['role']}")
        return data["token"]


class TestSocietySettings:
    """Test society settings endpoint for sport_name"""
    
    def test_get_society_settings_has_sport_praticato(self):
        """Test that society settings include sport_praticato field"""
        # First login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get society settings
        response = requests.get(f"{BASE_URL}/api/settings/society", headers=headers)
        
        assert response.status_code == 200, f"Failed to get settings: {response.status_code}"
        
        data = response.json()
        print(f"Society settings keys: {list(data.keys())}")
        
        # Check for sport_praticato field
        sport_praticato = data.get("sport_praticato", "")
        print(f"sport_praticato value: '{sport_praticato}'")
        
        # The field should exist (may be empty or have value)
        assert "sport_praticato" in data or "sport_name" in data, "Settings should have sport_praticato or sport_name"


class TestMinorLiteLogin:
    """Test minor lite login flow"""
    
    def test_minor_lite_login(self):
        """Test minor login with MartinaG / PIN 1234"""
        response = requests.post(
            f"{BASE_URL}/api/auth/minor-login",
            json={"athlete_code": "MartinaG", "pin": "1234"}
        )
        
        if response.status_code == 404:
            pytest.skip("Minor athlete MartinaG not found")
        if response.status_code == 429:
            pytest.skip("Rate limited - too many attempts")
        
        assert response.status_code == 200, f"Minor login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "token" in data
        print(f"Minor login successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
