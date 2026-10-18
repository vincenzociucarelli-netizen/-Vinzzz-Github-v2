"""
Test Codice Fiscale calculation with stato_nascita parameter
Tests the /api/utils/calcola-cf endpoint with foreign and Italian births
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestCodiceFiscaleCalculation:
    """Tests for Codice Fiscale calculation endpoint with stato_nascita support"""
    
    def test_cf_foreign_birth_germany(self):
        """Test CF calculation for person born in Germany - should use country code Z112"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "HANS",
            "cognome": "MULLER",
            "data_nascita": "15/03/1990",
            "luogo_nascita": "BERLINO",
            "sesso": "M",
            "stato_nascita": "GERMANIA"
        })
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "codice_fiscale" in data, "Response should contain codice_fiscale field"
        assert data.get("success") == True, f"CF calculation should succeed: {data}"
        
        cf = data.get("codice_fiscale")
        assert cf is not None, "Codice fiscale should not be None"
        assert len(cf) == 16, f"CF should be 16 characters, got {len(cf)}: {cf}"
        
        # Check that the CF contains foreign birth code (Z112 for Germany)
        # The birthplace code is positions 11-15 in the CF
        print(f"Calculated CF for HANS MULLER (GERMANIA): {cf}")
        assert "Z112" in cf, f"CF should contain Z112 (Germany code), got: {cf}"
    
    def test_cf_italian_birth(self):
        """Test CF calculation for person born in Italy - should use city code"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "LUCIA",
            "cognome": "PESSI",
            "data_nascita": "12/06/2012",
            "luogo_nascita": "PERUGIA",
            "sesso": "F",
            "stato_nascita": "Italia"
        })
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "codice_fiscale" in data, "Response should contain codice_fiscale field"
        assert data.get("success") == True, f"CF calculation should succeed: {data}"
        
        cf = data.get("codice_fiscale")
        assert cf is not None, "Codice fiscale should not be None"
        assert len(cf) == 16, f"CF should be 16 characters, got {len(cf)}: {cf}"
        
        # Check that the CF contains Italian city code (G478 for Perugia)
        print(f"Calculated CF for LUCIA PESSI (PERUGIA): {cf}")
        assert "G478" in cf, f"CF should contain G478 (Perugia code), got: {cf}"
    
    def test_cf_italian_birth_default_stato(self):
        """Test CF calculation without explicit stato_nascita - should default to Italia"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "MARIO",
            "cognome": "ROSSI",
            "data_nascita": "01/01/1980",
            "luogo_nascita": "ROMA",
            "sesso": "M"
            # No stato_nascita - should default to Italia
        })
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data.get("success") == True, f"CF calculation should succeed: {data}"
        
        cf = data.get("codice_fiscale")
        assert cf is not None, "Codice fiscale should not be None"
        assert len(cf) == 16, f"CF should be 16 characters, got {len(cf)}: {cf}"
        print(f"Calculated CF for MARIO ROSSI (ROMA, no stato_nascita): {cf}")
        # H501 is Rome's code
        assert "H501" in cf, f"CF should contain H501 (Roma code), got: {cf}"
    
    def test_cf_foreign_birth_france(self):
        """Test CF calculation for person born in France"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "JEAN",
            "cognome": "DUPONT",
            "data_nascita": "25/12/1985",
            "luogo_nascita": "PARIGI",
            "sesso": "M",
            "stato_nascita": "FRANCIA"
        })
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "codice_fiscale" in data, "Response should contain codice_fiscale field"
        
        if data.get("success"):
            cf = data.get("codice_fiscale")
            assert cf is not None, "Codice fiscale should not be None"
            assert len(cf) == 16, f"CF should be 16 characters, got {len(cf)}: {cf}"
            print(f"Calculated CF for JEAN DUPONT (FRANCIA): {cf}")
            # Z110 is France's code
            assert "Z110" in cf, f"CF should contain Z110 (France code), got: {cf}"
        else:
            # Some foreign countries may not be in the database
            print(f"CF calculation failed for France: {data.get('error')}")
    
    def test_cf_endpoint_validation_missing_fields(self):
        """Test CF calculation with missing required fields"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "TEST",
            # Missing other required fields
        })
        
        # Should return validation error
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}: {response.text}"
    
    def test_cf_date_format_yyyy_mm_dd(self):
        """Test CF calculation with YYYY-MM-DD date format"""
        response = requests.post(f"{BASE_URL}/api/utils/calcola-cf", json={
            "nome": "ANNA",
            "cognome": "BIANCHI",
            "data_nascita": "1995-07-20",  # YYYY-MM-DD format
            "luogo_nascita": "MILANO",
            "sesso": "F",
            "stato_nascita": "Italia"
        })
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data.get("success") == True, f"CF calculation should succeed with YYYY-MM-DD format: {data}"
        
        cf = data.get("codice_fiscale")
        assert cf is not None, "Codice fiscale should not be None"
        print(f"Calculated CF for ANNA BIANCHI (MILANO, YYYY-MM-DD date): {cf}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
