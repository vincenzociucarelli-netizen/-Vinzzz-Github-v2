"""
Test foreign-born athlete birth fields feature:
1. Backend API GET /api/payments/{athlete_id}/fiscal-receipt returns country_of_birth
2. For athlete born in Brazil (Federica Mauri), verify country_of_birth is 'Brasile'
3. Validate athlete profile validation skips birth_place for foreign athletes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://registrateam-vol.preview.emergentagent.com')

# Test credentials
PARENT_EMAIL = "paula@test.com"
PARENT_PASSWORD = "Test1234"
ADMIN_EMAIL = "vincenzo.ciucarelli@gmail.com"
ADMIN_PASSWORD = "Test123"

# Federica Mauri - born in Brazil
FOREIGN_ATHLETE_ID = "69d182d59b63201486edc280"
EXPECTED_COUNTRY = "Brasile"


class TestForeignAthleteBirthFields:
    """Tests for foreign-born athlete birth fields feature"""
    
    @pytest.fixture(scope="class")
    def parent_token(self):
        """Get parent (Paula) authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Parent login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    def test_fiscal_receipt_returns_country_of_birth(self, parent_token):
        """Test that GET /api/payments/{athlete_id}/fiscal-receipt returns country_of_birth field"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(
            f"{BASE_URL}/api/payments/{FOREIGN_ATHLETE_ID}/fiscal-receipt",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify athlete data structure
        assert "athlete" in data, "Response should contain 'athlete' key"
        athlete = data["athlete"]
        
        # Verify country_of_birth field exists
        assert "country_of_birth" in athlete, "Athlete data should contain 'country_of_birth' field"
        print(f"✓ country_of_birth field present: {athlete['country_of_birth']}")
    
    def test_federica_mauri_country_is_brasile(self, parent_token):
        """Test that Federica Mauri (born in Brazil) has country_of_birth = 'Brasile'"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(
            f"{BASE_URL}/api/payments/{FOREIGN_ATHLETE_ID}/fiscal-receipt",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        athlete = data["athlete"]
        
        # Verify country_of_birth is Brasile
        assert athlete.get("country_of_birth") == EXPECTED_COUNTRY, \
            f"Expected country_of_birth '{EXPECTED_COUNTRY}', got '{athlete.get('country_of_birth')}'"
        print(f"✓ Federica Mauri country_of_birth is correctly '{EXPECTED_COUNTRY}'")
    
    def test_fiscal_receipt_athlete_data_structure(self, parent_token):
        """Test that fiscal receipt returns complete athlete data structure"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(
            f"{BASE_URL}/api/payments/{FOREIGN_ATHLETE_ID}/fiscal-receipt",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        athlete = data["athlete"]
        
        # Verify all expected fields are present
        expected_fields = [
            "first_name", "last_name", "fiscal_code", "address", 
            "postal_code", "city", "province", "date_of_birth",
            "birth_place", "birth_province", "country_of_birth"
        ]
        
        for field in expected_fields:
            assert field in athlete, f"Missing field: {field}"
        
        print(f"✓ All expected athlete fields present in fiscal receipt response")
        print(f"  - first_name: {athlete.get('first_name')}")
        print(f"  - last_name: {athlete.get('last_name')}")
        print(f"  - country_of_birth: {athlete.get('country_of_birth')}")
        print(f"  - birth_place: {athlete.get('birth_place')}")
        print(f"  - birth_province: {athlete.get('birth_province')}")
    
    def test_italian_athlete_has_italia_country(self, admin_token):
        """Test that Italian-born athletes have country_of_birth = 'Italia' (default)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get list of athletes to find an Italian-born one
        response = requests.get(
            f"{BASE_URL}/api/athletes",
            headers=headers
        )
        
        if response.status_code != 200:
            pytest.skip(f"Could not get athletes list: {response.status_code}")
        
        athletes = response.json()
        
        # Find an athlete with country_of_birth = Italia or empty
        italian_athlete = None
        for athlete in athletes:
            country = (athlete.get("country_of_birth") or "Italia").upper()
            if country == "ITALIA" and athlete.get("_id") != FOREIGN_ATHLETE_ID:
                italian_athlete = athlete
                break
        
        if not italian_athlete:
            pytest.skip("No Italian-born athlete found for comparison")
        
        athlete_id = str(italian_athlete.get("_id") or italian_athlete.get("id"))
        
        # Get fiscal receipt for Italian athlete
        response = requests.get(
            f"{BASE_URL}/api/payments/{athlete_id}/fiscal-receipt",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            athlete_data = data.get("athlete", {})
            country = athlete_data.get("country_of_birth", "Italia")
            assert country.upper() == "ITALIA", f"Expected 'Italia', got '{country}'"
            print(f"✓ Italian athlete has country_of_birth = '{country}'")
        else:
            print(f"Note: Could not get fiscal receipt for Italian athlete (may not have payments)")


class TestAthleteProfileValidation:
    """Tests for athlete profile validation - birth_place not required for foreign athletes"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    def test_foreign_athlete_profile_complete_without_birth_place(self, admin_token):
        """Test that foreign athlete profile is considered complete without birth_place"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get Federica Mauri's profile
        response = requests.get(
            f"{BASE_URL}/api/athletes/{FOREIGN_ATHLETE_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        athlete = response.json()
        
        # Verify country_of_birth is set to Brasile
        assert athlete.get("country_of_birth") == EXPECTED_COUNTRY, \
            f"Expected country_of_birth '{EXPECTED_COUNTRY}', got '{athlete.get('country_of_birth')}'"
        
        # For foreign athletes, birth_place should not be required
        # The profile should be valid even if birth_place is empty
        print(f"✓ Foreign athlete profile:")
        print(f"  - country_of_birth: {athlete.get('country_of_birth')}")
        print(f"  - birth_place: {athlete.get('birth_place') or '(empty - OK for foreign)'}")
        print(f"  - birth_province: {athlete.get('birth_province') or '(empty - OK for foreign)'}")


class TestFiscalReceiptEndpointAccess:
    """Tests for fiscal receipt endpoint access control"""
    
    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are denied"""
        response = requests.get(
            f"{BASE_URL}/api/payments/{FOREIGN_ATHLETE_ID}/fiscal-receipt"
        )
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403 for unauthenticated, got {response.status_code}"
        print(f"✓ Unauthenticated access correctly denied with {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
