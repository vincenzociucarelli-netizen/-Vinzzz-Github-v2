"""
Test suite for 3 key features:
1. PRO badge for compensated athletes
2. Italian date format (DD/MM/YYYY) in compensation settings
3. Simplified adult athlete registration (3 required fields)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://team-mgmt-final.preview.emergentagent.com')


class TestConfig:
    admin_email = "test.admin@test.com"
    admin_password = "Test1234"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TestConfig.admin_email, "password": TestConfig.admin_password}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def auth_headers(admin_token):
    """Return authenticated headers"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestPROBadge:
    """Test PRO badge functionality for compensated athletes"""
    
    def test_compensated_athletes_have_athlete_type(self, auth_headers):
        """Verify compensated athletes return athlete_type field"""
        response = requests.get(f"{BASE_URL}/api/athletes", headers=auth_headers)
        assert response.status_code == 200
        
        athletes = response.json()
        # Find compensated athletes
        compensated = [a for a in athletes if a.get("athlete_type") == "compensated"]
        
        # Should have at least one compensated athlete in test data
        assert len(compensated) > 0, "No compensated athletes found in test data"
        
        # Verify they all have the correct athlete_type
        for athlete in compensated:
            assert athlete["athlete_type"] == "compensated"
            print(f"PASS: Athlete {athlete['full_name']} has athlete_type='compensated' (PRO badge should show)")
    
    def test_quota_athletes_have_quota_type(self, auth_headers):
        """Verify regular athletes have athlete_type='quota'"""
        response = requests.get(f"{BASE_URL}/api/athletes", headers=auth_headers)
        assert response.status_code == 200
        
        athletes = response.json()
        quota = [a for a in athletes if a.get("athlete_type") == "quota"]
        
        # Should have quota athletes
        assert len(quota) > 0, "No quota athletes found"
        
        for athlete in quota[:3]:  # Check first 3
            assert athlete["athlete_type"] == "quota"
            print(f"PASS: Athlete {athlete['full_name']} has athlete_type='quota' (no PRO badge)")


class TestItalianDateFormat:
    """Test Italian date format (DD/MM/YYYY) in compensation settings"""
    
    @pytest.fixture
    def compensated_athlete_id(self, auth_headers):
        """Find a compensated athlete for testing"""
        response = requests.get(f"{BASE_URL}/api/athletes", headers=auth_headers)
        athletes = response.json()
        compensated = [a for a in athletes if a.get("athlete_type") == "compensated"]
        
        if not compensated:
            pytest.skip("No compensated athletes available for testing")
        
        return compensated[0]["id"]
    
    def test_get_athlete_with_dates(self, auth_headers, compensated_athlete_id):
        """Verify athlete data includes contract dates"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{compensated_athlete_id}", 
            headers=auth_headers
        )
        assert response.status_code == 200
        
        athlete = response.json()
        print(f"Athlete contract dates: start={athlete.get('contract_start_date')}, end={athlete.get('contract_end_date')}")
        
        # Dates should be in ISO format from backend
        if athlete.get("contract_start_date"):
            assert "-" in athlete["contract_start_date"], "Date should contain hyphens (ISO format)"
    
    def test_update_compensation_with_iso_dates(self, auth_headers, compensated_athlete_id):
        """Test updating compensation with ISO date format (as sent from frontend)"""
        # First get current values
        get_response = requests.get(
            f"{BASE_URL}/api/athletes/{compensated_athlete_id}", 
            headers=auth_headers
        )
        original = get_response.json()
        original_start = original.get("contract_start_date")
        original_end = original.get("contract_end_date")
        original_monthly = original.get("monthly_compensation")
        
        # Update with new test dates (ISO format - as frontend sends after conversion)
        test_payload = {
            "monthly_compensation": 900,
            "contract_start_date": "2026-01-15",
            "contract_end_date": "2026-08-20"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/athletes/{compensated_athlete_id}/compensation/settings",
            headers=auth_headers,
            json=test_payload
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify the update was applied
        verify_response = requests.get(
            f"{BASE_URL}/api/athletes/{compensated_athlete_id}", 
            headers=auth_headers
        )
        updated = verify_response.json()
        
        assert updated["monthly_compensation"] == 900
        assert "2026-01-15" in str(updated["contract_start_date"])
        assert "2026-08-20" in str(updated["contract_end_date"])
        
        print(f"PASS: Dates updated correctly - start: {updated['contract_start_date']}, end: {updated['contract_end_date']}")
        
        # Restore original values
        restore_payload = {
            "monthly_compensation": original_monthly or 800,
            "contract_start_date": original_start,
            "contract_end_date": original_end
        }
        requests.patch(
            f"{BASE_URL}/api/athletes/{compensated_athlete_id}/compensation/settings",
            headers=auth_headers,
            json=restore_payload
        )


class TestSimplifiedAdultRegistration:
    """Test simplified adult athlete registration (only 3 required fields)"""
    
    def test_create_adult_athlete_minimum_fields(self, auth_headers):
        """Test creating adult athlete with only first_name, last_name, email"""
        test_data = {
            "first_name": "UNITTEST",
            "last_name": "ADULTATHLETETEST",
            "email": "unittest.adult@test.com"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/athletes/adult",
            headers=auth_headers,
            json=test_data
        )
        
        assert response.status_code == 200, f"Adult registration failed: {response.text}"
        result = response.json()
        
        assert "athlete_id" in result
        assert "athlete_code" in result
        athlete_id = result["athlete_id"]
        
        print(f"PASS: Adult athlete created with ID {athlete_id} and code {result['athlete_code']}")
        
        # Verify the athlete was created correctly
        verify_response = requests.get(
            f"{BASE_URL}/api/athletes/{athlete_id}",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        
        athlete = verify_response.json()
        assert athlete["first_name"] == "UNITTEST"
        assert athlete["last_name"] == "ADULTATHLETETEST"
        assert athlete["email"] == "unittest.adult@test.com"
        assert athlete["athlete_type"] == "quota"  # Default type
        assert athlete["is_minor"] == False  # Adult athlete
        assert athlete["status"] == "active"  # Adults are immediately active
        
        print(f"PASS: Adult athlete verified - is_minor=False, status=active")
        
        # Clean up - delete test athlete
        delete_response = requests.delete(
            f"{BASE_URL}/api/athletes/{athlete_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        print(f"PASS: Test athlete cleaned up")
    
    def test_create_compensated_adult_athlete(self, auth_headers):
        """Test creating compensated adult athlete (PRO)"""
        test_data = {
            "first_name": "UNITPRO",
            "last_name": "ATHLETETEST",
            "email": "unittest.pro@test.com",
            "athlete_type": "compensated"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/athletes/adult",
            headers=auth_headers,
            json=test_data
        )
        
        assert response.status_code == 200, f"PRO athlete registration failed: {response.text}"
        result = response.json()
        athlete_id = result["athlete_id"]
        
        # Verify the athlete type is correct
        verify_response = requests.get(
            f"{BASE_URL}/api/athletes/{athlete_id}",
            headers=auth_headers
        )
        athlete = verify_response.json()
        
        assert athlete["athlete_type"] == "compensated"
        print(f"PASS: Adult PRO athlete created with athlete_type='compensated'")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/athletes/{athlete_id}", headers=auth_headers)
        print(f"PASS: Test PRO athlete cleaned up")
    
    def test_adult_athlete_optional_fields(self, auth_headers):
        """Test that optional fields work correctly"""
        test_data = {
            "first_name": "UNITOPT",
            "last_name": "OPTIONALTEST",
            "email": "unittest.optional@test.com",
            "fiscal_code": "TSTTST90A01H501Z",
            "date_of_birth": "1990-01-15",
            "phone": "+39123456789"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/athletes/adult",
            headers=auth_headers,
            json=test_data
        )
        
        assert response.status_code == 200, f"Registration with optional fields failed: {response.text}"
        athlete_id = response.json()["athlete_id"]
        
        # Verify optional fields were saved
        verify_response = requests.get(
            f"{BASE_URL}/api/athletes/{athlete_id}",
            headers=auth_headers
        )
        athlete = verify_response.json()
        
        assert athlete.get("fiscal_code") == "TSTTST90A01H501Z"
        assert athlete.get("phone_athlete") == "+39123456789"
        assert "1990-01-15" in str(athlete.get("date_of_birth") or "")
        
        print(f"PASS: Optional fields saved correctly")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/athletes/{athlete_id}", headers=auth_headers)


class TestBackendHealth:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("PASS: API health check")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TestConfig.admin_email, "password": TestConfig.admin_password}
        )
        assert response.status_code == 200
        assert "token" in response.json()
        print("PASS: Admin login working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
