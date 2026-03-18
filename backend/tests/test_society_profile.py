"""
Test Society Profile Feature
Testing the new Society Profile page, settings restructuring, and business card sharing.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://squad-manager-18.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")

@pytest.fixture
def auth_headers(admin_token):
    """Headers with admin authentication"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Test admin can login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "admin"
        print(f"✅ Admin login successful, role: {data['user']['role']}")


class TestSocietySettingsAPI:
    """Test GET /api/settings/society endpoint"""
    
    def test_get_society_settings_returns_all_fields(self):
        """Verify GET /api/settings/society returns all society data fields"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        
        # Required fields for society profile
        expected_fields = [
            "name", "logo", "address", "postal_code", "city", "province",
            "fiscal_code", "phone", "phone2", "email", "pec",
            "president_name", "ragione_sociale", "sport_praticato"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✅ Society settings contains all required fields")
        print(f"   Society name: {data.get('name')}")
        print(f"   Address: {data.get('address')}")
        print(f"   Phone: {data.get('phone')}")
        print(f"   Email: {data.get('email')}")
        
    def test_get_society_settings_returns_stamp_signature(self):
        """Verify stamp_signature field is returned"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        assert "stamp_signature" in data
        print(f"✅ Stamp signature field present: {bool(data.get('stamp_signature'))}")
        
    def test_get_society_settings_returns_sport_image(self):
        """Verify sport_image field is returned"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        assert "sport_image" in data
        print(f"✅ Sport image field present: {bool(data.get('sport_image'))}")


class TestSocietySettingsPatch:
    """Test PATCH /api/settings/society endpoint"""
    
    def test_patch_society_settings_requires_auth(self):
        """Verify PATCH requires authentication"""
        response = requests.patch(f"{BASE_URL}/api/settings/society", json={
            "name": "Test Society"
        })
        assert response.status_code in [401, 403]
        print("✅ PATCH requires authentication")
    
    def test_patch_society_settings_with_auth(self, auth_headers):
        """Test PATCH can update society fields"""
        # First get current settings
        response = requests.get(f"{BASE_URL}/api/settings/society")
        current_data = response.json()
        original_name = current_data.get("name", "")
        
        # Update with a test change (we'll restore it)
        test_update = {
            "phone2": "333-1234567"  # Update secondary phone
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            json=test_update,
            headers=auth_headers
        )
        assert response.status_code == 200
        print("✅ PATCH society settings successful")
        
        # Verify the change was applied
        response = requests.get(f"{BASE_URL}/api/settings/society")
        updated_data = response.json()
        assert updated_data.get("phone2") == "333-1234567"
        print(f"✅ Phone2 updated to: {updated_data.get('phone2')}")
        
    def test_patch_society_all_fields(self, auth_headers):
        """Test PATCH can update all relevant society profile fields"""
        update_data = {
            "name": "Pallavolo Perugia SSD",
            "ragione_sociale": "Pallavolo Perugia Società Sportiva Dilettantistica",
            "sport_praticato": "Pallavolo",
            "address": "Via Roma, 1",
            "postal_code": "06100",
            "city": "Perugia",
            "province": "PG",
            "phone": "075-1234567",
            "phone2": "333-9876543",
            "email": "info@pallavoloperugia.it",
            "pec": "pallavoloperugia@pec.it",
            "president_name": "Mario Rossi"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        print("✅ All society profile fields updated successfully")
        
        # Verify changes
        response = requests.get(f"{BASE_URL}/api/settings/society")
        data = response.json()
        for key, value in update_data.items():
            assert data.get(key) == value, f"Field {key} not updated correctly"
        print("✅ All fields verified after update")


class TestOtherSettingsFields:
    """Test 'Altre Impostazioni' fields in settings"""
    
    def test_certificate_blocking_field_exists(self):
        """Verify block_expired_certificates field exists"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        assert "block_expired_certificates" in data
        print(f"✅ Certificate blocking field present: {data.get('block_expired_certificates')}")
        
    def test_season_dates_fields_exist(self):
        """Verify season start month/day fields exist"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        assert "season_start_month" in data
        assert "season_start_day" in data
        print(f"✅ Season dates present: month={data.get('season_start_month')}, day={data.get('season_start_day')}")
        
    def test_patch_certificate_blocking(self, auth_headers):
        """Test updating certificate blocking toggle"""
        # Toggle to true
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            json={"block_expired_certificates": True},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.json().get("block_expired_certificates") == True
        print("✅ Certificate blocking toggle works")
        
    def test_patch_season_dates(self, auth_headers):
        """Test updating season date settings"""
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            json={
                "season_start_month": 7,
                "season_start_day": 1
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify
        response = requests.get(f"{BASE_URL}/api/settings/society")
        data = response.json()
        assert data.get("season_start_month") == 7
        assert data.get("season_start_day") == 1
        print("✅ Season date settings work")


class TestConfigurationSettings:
    """Test other configuration fields needed for settings"""
    
    def test_athlete_roles_field_exists(self):
        """Verify athlete_roles array exists"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        assert "athlete_roles" in data
        print(f"✅ Athlete roles present: {data.get('athlete_roles', [])[:3]}...")
        
    def test_dirigente_qualifications_field_exists(self):
        """Verify dirigente_qualifications array exists"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        assert "dirigente_qualifications" in data
        print(f"✅ Dirigente qualifications present: {data.get('dirigente_qualifications', [])[:3]}...")
        
    def test_venues_field_exists(self):
        """Verify venues array exists"""
        response = requests.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        assert "venues" in data
        print(f"✅ Venues present: {len(data.get('venues', []))} venues")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
