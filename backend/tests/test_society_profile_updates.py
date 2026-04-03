"""
Test Society Profile Updates - IBAN, Bank Name, Affiliations, PDF Cards
Tests for new features:
1. PATCH /api/settings/society saves iban, bank_name, affiliations
2. GET /api/settings/society returns iban, bank_name, affiliations, season_end_month, season_end_day
3. GET /api/society/card-fiscale generates PDF
4. GET /api/society/card-bancaria generates PDF when IBAN present
5. GET /api/society/card-bancaria returns 400 when IBAN not present
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://registrateam-vol.preview.emergentagent.com').rstrip('/')

# Test data
TEST_ADMIN = {
    "email": "pallavoloperugia@gmail.com",
    "password": "password"
}

# Test affiliations
TEST_AFFILIATIONS = [
    {"name": "FIPAV", "number": "12345"},
    {"name": "UISP", "number": "67890"}
]

TEST_IBAN = "IT60X0542811101000000123456"
TEST_BANK_NAME = "Banca di Perugia"


class TestSocietyProfileAPI:
    """Test society profile APIs with new fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=TEST_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("token")
        assert token, "No token in login response"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        print(f"✅ Admin login successful")
    
    # === GET /api/settings/society Tests ===
    
    def test_get_society_settings_returns_iban(self):
        """GET /api/settings/society should return iban field"""
        response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        
        assert "iban" in data, "Response should include 'iban' field"
        print(f"✅ GET /api/settings/society returns iban: {data.get('iban')}")
    
    def test_get_society_settings_returns_bank_name(self):
        """GET /api/settings/society should return bank_name field"""
        response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        
        assert "bank_name" in data, "Response should include 'bank_name' field"
        print(f"✅ GET /api/settings/society returns bank_name: {data.get('bank_name')}")
    
    def test_get_society_settings_returns_affiliations(self):
        """GET /api/settings/society should return affiliations field"""
        response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        
        assert "affiliations" in data, "Response should include 'affiliations' field"
        assert isinstance(data.get("affiliations"), list), "affiliations should be a list"
        print(f"✅ GET /api/settings/society returns affiliations: {data.get('affiliations')}")
    
    def test_get_society_settings_returns_season_end_month(self):
        """GET /api/settings/society should return season_end_month field"""
        response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        
        assert "season_end_month" in data, "Response should include 'season_end_month' field"
        assert isinstance(data.get("season_end_month"), int), "season_end_month should be an integer"
        print(f"✅ GET /api/settings/society returns season_end_month: {data.get('season_end_month')}")
    
    def test_get_society_settings_returns_season_end_day(self):
        """GET /api/settings/society should return season_end_day field"""
        response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert response.status_code == 200
        data = response.json()
        
        assert "season_end_day" in data, "Response should include 'season_end_day' field"
        assert isinstance(data.get("season_end_day"), int), "season_end_day should be an integer"
        print(f"✅ GET /api/settings/society returns season_end_day: {data.get('season_end_day')}")
    
    # === PATCH /api/settings/society Tests ===
    
    def test_patch_society_saves_iban(self):
        """PATCH /api/settings/society should save iban"""
        payload = {"iban": TEST_IBAN}
        response = self.session.patch(f"{BASE_URL}/api/settings/society", json=payload)
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify by GET
        get_response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data.get("iban") == TEST_IBAN, f"IBAN not saved correctly. Expected {TEST_IBAN}, got {data.get('iban')}"
        print(f"✅ PATCH saves iban correctly: {TEST_IBAN}")
    
    def test_patch_society_saves_bank_name(self):
        """PATCH /api/settings/society should save bank_name"""
        payload = {"bank_name": TEST_BANK_NAME}
        response = self.session.patch(f"{BASE_URL}/api/settings/society", json=payload)
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify by GET
        get_response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data.get("bank_name") == TEST_BANK_NAME, f"Bank name not saved correctly. Expected {TEST_BANK_NAME}, got {data.get('bank_name')}"
        print(f"✅ PATCH saves bank_name correctly: {TEST_BANK_NAME}")
    
    def test_patch_society_saves_affiliations(self):
        """PATCH /api/settings/society should save affiliations"""
        payload = {"affiliations": TEST_AFFILIATIONS}
        response = self.session.patch(f"{BASE_URL}/api/settings/society", json=payload)
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Verify by GET
        get_response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert get_response.status_code == 200
        data = get_response.json()
        affiliations = data.get("affiliations", [])
        
        assert len(affiliations) >= 2, f"Expected at least 2 affiliations, got {len(affiliations)}"
        fipav_found = any(a.get("name") == "FIPAV" and a.get("number") == "12345" for a in affiliations)
        uisp_found = any(a.get("name") == "UISP" and a.get("number") == "67890" for a in affiliations)
        assert fipav_found, "FIPAV affiliation not found"
        assert uisp_found, "UISP affiliation not found"
        print(f"✅ PATCH saves affiliations correctly: {affiliations}")
    
    # === PDF Card Tests ===
    
    def test_card_fiscale_generates_pdf(self):
        """GET /api/society/card-fiscale should generate a PDF"""
        response = self.session.get(f"{BASE_URL}/api/society/card-fiscale")
        assert response.status_code == 200, f"Card fiscale failed: {response.text}"
        
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF, got Content-Type: {content_type}"
        
        # Check PDF magic bytes
        content = response.content
        assert content.startswith(b'%PDF'), "Response should start with PDF magic bytes"
        assert len(content) > 1000, f"PDF too small: {len(content)} bytes"
        print(f"✅ GET /api/society/card-fiscale generates PDF ({len(content)} bytes)")
    
    def test_card_bancaria_generates_pdf_when_iban_present(self):
        """GET /api/society/card-bancaria should generate PDF when IBAN is set"""
        # First ensure IBAN is set
        self.session.patch(f"{BASE_URL}/api/settings/society", json={"iban": TEST_IBAN, "bank_name": TEST_BANK_NAME})
        
        response = self.session.get(f"{BASE_URL}/api/society/card-bancaria")
        assert response.status_code == 200, f"Card bancaria failed: {response.text}"
        
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF, got Content-Type: {content_type}"
        
        # Check PDF magic bytes
        content = response.content
        assert content.startswith(b'%PDF'), "Response should start with PDF magic bytes"
        assert len(content) > 500, f"PDF too small: {len(content)} bytes"
        print(f"✅ GET /api/society/card-bancaria generates PDF ({len(content)} bytes)")
    
    def test_card_bancaria_returns_400_when_no_iban(self):
        """GET /api/society/card-bancaria should return 400 when IBAN is not set"""
        # First clear IBAN
        self.session.patch(f"{BASE_URL}/api/settings/society", json={"iban": ""})
        
        response = self.session.get(f"{BASE_URL}/api/society/card-bancaria")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        error_detail = response.json().get("detail", "")
        assert "IBAN" in error_detail or "iban" in error_detail.lower(), f"Error should mention IBAN: {error_detail}"
        print(f"✅ GET /api/society/card-bancaria returns 400 when no IBAN: {error_detail}")
        
        # Restore IBAN for other tests
        self.session.patch(f"{BASE_URL}/api/settings/society", json={"iban": TEST_IBAN})


class TestSocietyProfileAllFields:
    """Test all new fields together"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=TEST_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_save_and_retrieve_all_new_fields(self):
        """Test saving and retrieving all new fields together"""
        payload = {
            "iban": TEST_IBAN,
            "bank_name": TEST_BANK_NAME,
            "affiliations": TEST_AFFILIATIONS,
            "season_end_month": 6,
            "season_end_day": 30
        }
        
        # Save
        response = self.session.patch(f"{BASE_URL}/api/settings/society", json=payload)
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        # Retrieve
        get_response = self.session.get(f"{BASE_URL}/api/settings/society")
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data.get("iban") == TEST_IBAN
        assert data.get("bank_name") == TEST_BANK_NAME
        assert len(data.get("affiliations", [])) >= 2
        assert data.get("season_end_month") == 6
        assert data.get("season_end_day") == 30
        
        print("✅ All new fields saved and retrieved correctly")
        print(f"   - IBAN: {data.get('iban')}")
        print(f"   - Bank Name: {data.get('bank_name')}")
        print(f"   - Affiliations: {data.get('affiliations')}")
        print(f"   - Season End: {data.get('season_end_day')}/{data.get('season_end_month')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
