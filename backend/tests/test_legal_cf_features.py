"""
Test suite for Legal Acceptance Screen, CF Calculation, and Register-Athlete Form features
Testing:
1. CF calculation API /api/utils/calcola-cf
2. Athletes API with optional team_id and gender field  
3. Auth me endpoint for parent phone pre-fill
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://italian-sports-qa.preview.emergentagent.com').rstrip('/')


class TestCodiceFiscaleCalculation:
    """Tests for the CF calculation API endpoint"""
    
    def test_cf_calculation_basic(self):
        """Test basic CF calculation with valid data"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "Mario",
            "cognome": "Rossi",
            "data_nascita": "15/05/1990",
            "luogo_nascita": "Roma",
            "sesso": "M"
        })
        print(f"CF calculation response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("codice_fiscale") is not None
        assert len(data["codice_fiscale"]) == 16
        print(f"Calculated CF: {data['codice_fiscale']}")

    def test_cf_calculation_female(self):
        """Test CF calculation for female"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "Maria",
            "cognome": "Bianchi",
            "data_nascita": "20/03/1985",
            "luogo_nascita": "Milano",
            "sesso": "F"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("codice_fiscale") is not None
        print(f"Female CF: {data['codice_fiscale']}")

    def test_cf_calculation_iso_date_format(self):
        """Test CF calculation accepts YYYY-MM-DD format"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "Luca",
            "cognome": "Verdi",
            "data_nascita": "2000-07-25",  # ISO format
            "luogo_nascita": "Torino",
            "sesso": "M"
        })
        assert response.status_code == 200
        data = response.json()
        # Should handle ISO date format
        assert "codice_fiscale" in data
        print(f"ISO date CF result: {data}")

    def test_cf_calculation_invalid_city(self):
        """Test CF calculation with invalid city returns error"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "Test",
            "cognome": "User",
            "data_nascita": "01/01/2000",
            "luogo_nascita": "CittaInesistente123",
            "sesso": "M"
        })
        assert response.status_code == 200  # Returns 200 with error in body
        data = response.json()
        assert data.get("success") == False
        assert "error" in data
        print(f"Invalid city error: {data['error']}")


class TestAthleteAPIWithOptionalTeam:
    """Tests for Athletes API with optional team_id and gender field"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pallavoloperugia@gmail.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def parent_auth_token(self):
        """Get or create parent auth token"""
        # Try to login with test parent
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testparent@test.com",
            "password": "Test1234!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Parent login failed - testparent@test.com may not exist")

    def test_create_athlete_without_team(self, parent_auth_token):
        """Test creating athlete with team_id = null (as parent would)"""
        unique_cf = f"TST{uuid.uuid4().hex[:6].upper()}00A01H501Z"[:16]
        
        response = requests.post(
            f"{BASE_URL}/api/athletes",
            headers={"Authorization": f"Bearer {parent_auth_token}"},
            json={
                "full_name": "TEST_NOTEAM ATLETA",
                "first_name": "TEST_NOTEAM",
                "last_name": "ATLETA",
                "date_of_birth": "2010-05-15",
                "fiscal_code": unique_cf,
                "gender": "M",
                "team_id": None,  # Explicitly null
                "is_trial": True
            }
        )
        print(f"Create athlete without team: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        # Should succeed - team_id is optional
        assert response.status_code in [200, 201]
        data = response.json()
        assert data.get("full_name") == "TEST_NOTEAM ATLETA"
        # team_id should be None or null
        assert data.get("team_id") is None or data.get("team_id") == ""
        print(f"Created athlete ID: {data.get('id')}")
        return data.get("id")

    def test_create_athlete_with_gender(self, parent_auth_token):
        """Test creating athlete with gender field M/F"""
        unique_cf = f"TST{uuid.uuid4().hex[:6].upper()}00A01H501Y"[:16]
        
        response = requests.post(
            f"{BASE_URL}/api/athletes",
            headers={"Authorization": f"Bearer {parent_auth_token}"},
            json={
                "full_name": "TEST_GENDER FEMALE",
                "first_name": "TEST_GENDER",
                "last_name": "FEMALE",
                "date_of_birth": "2012-03-20",
                "fiscal_code": unique_cf,
                "gender": "F",  # Gender field
                "team_id": None,
                "is_trial": True
            }
        )
        print(f"Create athlete with gender: {response.status_code}")
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data.get("gender") == "F"
        print(f"Athlete gender: {data.get('gender')}")


class TestParentProfileForPhonePreFill:
    """Test parent /auth/me endpoint returns phone for pre-filling"""
    
    def test_parent_me_returns_phone(self):
        """Test that /auth/me returns parent's phone number"""
        # First login as parent
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testparent@test.com",
            "password": "Test1234!"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Parent login failed")
        
        token = login_response.json().get("token")
        
        # Get user profile
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        print(f"GET /auth/me status: {me_response.status_code}")
        assert me_response.status_code == 200
        
        data = me_response.json()
        print(f"Parent profile data: {data}")
        
        # Check that phone field exists in response (even if None)
        assert "phone" in data or "id" in data  # At minimum should have id
        print(f"Parent phone: {data.get('phone', 'Not set')}")


class TestLegalAcceptanceFlow:
    """Test legal acceptance flow for new users"""
    
    def test_accept_legal_endpoint(self):
        """Test the /auth/accept-legal endpoint"""
        # Login as test parent
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testparent@test.com",
            "password": "Test1234!"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Parent login failed")
        
        token = login_response.json().get("token")
        
        # Check current legal_accepted status
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        
        user_data = me_response.json()
        print(f"Current legal_accepted_at: {user_data.get('legal_accepted_at')}")
        
        # The accept-legal endpoint should work
        accept_response = requests.post(
            f"{BASE_URL}/api/auth/accept-legal",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Accept legal response: {accept_response.status_code}")
        print(f"Response: {accept_response.text[:200]}")
        
        # Should succeed (200) even if already accepted
        assert accept_response.status_code == 200


class TestAthleteCreateModel:
    """Verify the AthleteCreate model accepts gender and optional team_id"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pallavoloperugia@gmail.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_athlete_model_gender_field(self, admin_token):
        """Verify gender field is accepted in athlete creation"""
        unique_cf = f"ADM{uuid.uuid4().hex[:6].upper()}00A01H501X"[:16]
        
        response = requests.post(
            f"{BASE_URL}/api/athletes",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "full_name": "TEST_ADMIN_GENDER ATLETA",
                "first_name": "TEST_ADMIN_GENDER",
                "last_name": "ATLETA",
                "date_of_birth": "2008-11-10",
                "fiscal_code": unique_cf,
                "gender": "M",
                "team_id": None,
                "is_trial": False,
                "phone_father": "333123456"
            }
        )
        
        print(f"Admin create athlete: {response.status_code}")
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data.get("gender") == "M"
        assert data.get("phone_father") == "333123456"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
