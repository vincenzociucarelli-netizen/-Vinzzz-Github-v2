"""
Test Prima Nota Pagamenti endpoints:
- GET /api/payments/registro-stagione - Season payment registry with receipt numbers
- GET /api/payments/solleciti - Athletes with unpaid payments
- POST /api/payments/solleciti/notifica - Send in-app notifications to parents
- POST /api/payments/import - Import payments from Excel (Cognome+Nome format)
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://registrateam-vol.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "Test1234"


class TestPrimaNotaPagamenti:
    """Test Prima Nota Pagamenti feature endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        assert self.token, "No token in login response"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"✓ Admin login successful")
    
    # ==================== REGISTRO STAGIONE TESTS ====================
    
    def test_registro_stagione_returns_season_info(self):
        """GET /api/payments/registro-stagione returns season info with payments"""
        response = self.session.get(f"{BASE_URL}/api/payments/registro-stagione")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "season" in data, "Missing 'season' field"
        assert "total_payments" in data, "Missing 'total_payments' field"
        assert "total_amount" in data, "Missing 'total_amount' field"
        assert "rows" in data, "Missing 'rows' field"
        
        # Verify season format (e.g., "25/26")
        assert "/" in data["season"], f"Season format invalid: {data['season']}"
        
        # Verify numeric fields
        assert isinstance(data["total_payments"], int), "total_payments should be int"
        assert isinstance(data["total_amount"], (int, float)), "total_amount should be numeric"
        assert isinstance(data["rows"], list), "rows should be a list"
        
        print(f"✓ Registro stagione: {data['season']} - {data['total_payments']} payments, €{data['total_amount']:.2f}")
    
    def test_registro_stagione_row_structure(self):
        """Verify each row in registro has correct fields including receipt number"""
        response = self.session.get(f"{BASE_URL}/api/payments/registro-stagione")
        assert response.status_code == 200
        
        data = response.json()
        if data["rows"]:
            row = data["rows"][0]
            expected_fields = ["Ric. Fiscale", "Data Registrazione", "Cognome", "Nome", 
                             "Data Pagamento", "Tipo", "Importo", "Causale"]
            for field in expected_fields:
                assert field in row, f"Missing field '{field}' in row"
            
            # Verify receipt number format (e.g., "RIC-2025-0001")
            receipt = row.get("Ric. Fiscale", "")
            if receipt:
                assert "RIC-" in receipt or receipt.startswith("RIC"), f"Invalid receipt format: {receipt}"
            
            print(f"✓ Row structure verified: {row['Cognome']} {row['Nome']} - Ric. {receipt}")
        else:
            print("⚠ No payments in registro to verify row structure")
    
    def test_registro_stagione_requires_admin(self):
        """Verify registro-stagione requires admin role"""
        # Create a new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/payments/registro-stagione")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Registro stagione correctly requires authentication")
    
    # ==================== SOLLECITI TESTS ====================
    
    def test_solleciti_returns_athletes_with_unpaid(self):
        """GET /api/payments/solleciti returns athletes with unpaid payments"""
        response = self.session.get(f"{BASE_URL}/api/payments/solleciti")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Solleciti: {len(data)} athletes with unpaid payments")
        
        if data:
            # Verify first athlete structure
            athlete = data[0]
            expected_fields = ["athlete_id", "cognome", "nome", "squadra", 
                             "parent_name", "parent_email", "parent_phone",
                             "parent_id", "total_due", "installments"]
            for field in expected_fields:
                assert field in athlete, f"Missing field '{field}' in sollecito"
            
            # Verify installments structure
            assert isinstance(athlete["installments"], list), "installments should be a list"
            if athlete["installments"]:
                inst = athlete["installments"][0]
                assert "id" in inst, "Missing 'id' in installment"
                assert "description" in inst, "Missing 'description' in installment"
                assert "amount" in inst, "Missing 'amount' in installment"
                assert "due_date" in inst, "Missing 'due_date' in installment"
            
            print(f"✓ First sollecito: {athlete['cognome']} {athlete['nome']} - €{athlete['total_due']:.2f}")
    
    def test_solleciti_sorted_by_cognome(self):
        """Verify solleciti are sorted alphabetically by cognome"""
        response = self.session.get(f"{BASE_URL}/api/payments/solleciti")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 1:
            cognomi = [a.get("cognome", "").upper() for a in data]
            assert cognomi == sorted(cognomi), "Solleciti should be sorted by cognome"
            print(f"✓ Solleciti correctly sorted by cognome")
        else:
            print("⚠ Not enough solleciti to verify sorting")
    
    def test_solleciti_requires_admin(self):
        """Verify solleciti requires admin role"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/payments/solleciti")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Solleciti correctly requires authentication")
    
    # ==================== SOLLECITI NOTIFICA TESTS ====================
    
    def test_solleciti_notifica_requires_athlete_ids(self):
        """POST /api/payments/solleciti/notifica requires athlete_ids"""
        response = self.session.post(f"{BASE_URL}/api/payments/solleciti/notifica", json={})
        assert response.status_code == 400, f"Expected 400 for empty request, got {response.status_code}"
        print("✓ Notifica correctly requires athlete_ids")
    
    def test_solleciti_notifica_sends_notifications(self):
        """POST /api/payments/solleciti/notifica sends in-app notifications"""
        # First get solleciti to find athletes with unpaid payments
        solleciti_response = self.session.get(f"{BASE_URL}/api/payments/solleciti")
        assert solleciti_response.status_code == 200
        
        solleciti = solleciti_response.json()
        if not solleciti:
            print("⚠ No athletes with unpaid payments to test notification")
            pytest.skip("No athletes with unpaid payments")
        
        # Get first athlete with a parent
        athlete_with_parent = None
        for s in solleciti:
            if s.get("parent_id"):
                athlete_with_parent = s
                break
        
        if not athlete_with_parent:
            print("⚠ No athletes with parent_id to test notification")
            pytest.skip("No athletes with parent_id")
        
        # Send notification
        response = self.session.post(f"{BASE_URL}/api/payments/solleciti/notifica", json={
            "athlete_ids": [athlete_with_parent["athlete_id"]]
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Missing 'success' field"
        assert "sent" in data, "Missing 'sent' field"
        assert "message" in data, "Missing 'message' field"
        assert data["success"] == True, "success should be True"
        
        print(f"✓ Notification sent: {data['message']}")
    
    def test_solleciti_notifica_requires_admin(self):
        """Verify solleciti/notifica requires admin role"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(f"{BASE_URL}/api/payments/solleciti/notifica", json={
            "athlete_ids": ["test-id"]
        })
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Notifica correctly requires authentication")
    
    # ==================== IMPORT TESTS ====================
    
    def test_import_requires_file(self):
        """POST /api/payments/import requires a file"""
        response = self.session.post(f"{BASE_URL}/api/payments/import")
        assert response.status_code == 422, f"Expected 422 for missing file, got {response.status_code}"
        print("✓ Import correctly requires file")
    
    def test_import_requires_admin(self):
        """Verify import requires admin role"""
        no_auth_session = requests.Session()
        # Create a minimal Excel file
        try:
            import pandas as pd
            df = pd.DataFrame({"Cognome": ["TEST"], "Nome": ["TEST"], "DataPagamento": ["01/01/2025"], 
                              "Importo": [100], "TipoPagamento": ["B"]})
            buffer = io.BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            files = {"file": ("test.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            response = no_auth_session.post(f"{BASE_URL}/api/payments/import", files=files)
            assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
            print("✓ Import correctly requires authentication")
        except ImportError:
            print("⚠ pandas not available, skipping import auth test")
            pytest.skip("pandas not available")
    
    def test_import_validates_columns(self):
        """POST /api/payments/import validates required columns"""
        try:
            import pandas as pd
            # Create file with missing columns
            df = pd.DataFrame({"WrongColumn": ["TEST"]})
            buffer = io.BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            # Need to use multipart form data
            files = {"file": ("test.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            # Remove Content-Type header for multipart
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{BASE_URL}/api/payments/import", files=files, headers=headers)
            
            assert response.status_code == 400, f"Expected 400 for invalid columns, got {response.status_code}"
            assert "Colonne mancanti" in response.text or "mancanti" in response.text.lower(), f"Expected column error: {response.text}"
            print("✓ Import correctly validates required columns")
        except ImportError:
            print("⚠ pandas not available, skipping column validation test")
            pytest.skip("pandas not available")
    
    def test_import_handles_nonmatching_names(self):
        """POST /api/payments/import handles non-matching names with proper error"""
        try:
            import pandas as pd
            # Create file with non-existent athlete
            df = pd.DataFrame({
                "Cognome": ["NONEXISTENT_TEST_ATHLETE"],
                "Nome": ["FAKE"],
                "DataPagamento": ["01/01/2025"],
                "Importo": [100],
                "TipoPagamento": ["B"]
            })
            buffer = io.BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            files = {"file": ("test.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{BASE_URL}/api/payments/import", files=files, headers=headers)
            
            assert response.status_code == 200, f"Expected 200 (with errors), got {response.status_code}: {response.text}"
            data = response.json()
            
            # Should have 0 imported and 1 error
            assert data.get("imported") == 0, f"Expected 0 imported, got {data.get('imported')}"
            assert len(data.get("errors", [])) > 0, "Expected errors for non-matching name"
            
            # Error should mention "non trovato"
            error_text = " ".join(data.get("errors", []))
            assert "non trovato" in error_text.lower(), f"Expected 'non trovato' in error: {error_text}"
            
            print(f"✓ Import correctly handles non-matching names: {data['errors'][0]}")
        except ImportError:
            print("⚠ pandas not available, skipping non-matching names test")
            pytest.skip("pandas not available")
    
    def test_import_cognome_nome_format(self):
        """POST /api/payments/import accepts Cognome+Nome format"""
        try:
            import pandas as pd
            # Create file with correct format but test athlete
            df = pd.DataFrame({
                "Cognome": ["RAPELLI"],  # Known athlete from context
                "Nome": ["LISA"],
                "DataPagamento": ["01/01/2025"],
                "Importo": [0.01],  # Minimal amount to avoid real impact
                "TipoPagamento": ["B"],
                "Causale": ["TEST_IMPORT_DELETE_ME"]
            })
            buffer = io.BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            files = {"file": ("test.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{BASE_URL}/api/payments/import", files=files, headers=headers)
            
            # Could be 200 (success) or 200 with errors if athlete not found
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            
            # Check response structure
            assert "imported" in data, "Missing 'imported' field"
            assert "errors" in data, "Missing 'errors' field"
            assert "message" in data, "Missing 'message' field"
            
            if data["imported"] > 0:
                print(f"✓ Import Cognome+Nome format works: {data['imported']} imported")
            else:
                print(f"⚠ Import returned errors (athlete may not exist): {data.get('errors', [])}")
        except ImportError:
            print("⚠ pandas not available, skipping Cognome+Nome format test")
            pytest.skip("pandas not available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
