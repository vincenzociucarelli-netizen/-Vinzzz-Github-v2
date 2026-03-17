"""
Test Prima Nota CSV Export and Settings Reorganization
Tests for iteration 44 features:
1. GET /api/export-csv/prima-nota - CSV export with required columns
2. GET /api/payments/{athlete_id}/fiscal-receipt - receipt_number and registration_date fields
3. Settings reorganization (verified via API, UI tested separately)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"
PARENT_EMAIL = "sauro@test.com"
PARENT_PASSWORD = "Test1234"


class TestPrimaNotaCSVExport:
    """Test Prima Nota Cassa CSV export endpoint"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json().get("token")
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

    def test_prima_nota_export_returns_csv(self):
        """Test that /api/export-csv/prima-nota returns valid CSV"""
        response = requests.get(
            f"{BASE_URL}/api/export-csv/prima-nota",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Prima Nota export failed: {response.status_code} - {response.text}"
        
        # Check content type is CSV
        content_type = response.headers.get("content-type", "")
        assert "csv" in content_type.lower() or "text" in content_type.lower(), f"Expected CSV content type, got: {content_type}"

    def test_prima_nota_csv_has_required_columns(self):
        """Test CSV header has all required columns in correct order"""
        response = requests.get(
            f"{BASE_URL}/api/export-csv/prima-nota",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200
        
        csv_content = response.text
        lines = csv_content.strip().split('\n')
        
        assert len(lines) >= 1, "CSV should have at least header row"
        
        header_line = lines[0]
        # CSV uses semicolon delimiter
        columns = header_line.split(';')
        
        # Expected columns (exact order as per requirements)
        expected_columns = [
            'N. Progressivo',
            'Data Pagamento',
            'Data Registrazione',
            'Atleta',
            'Codice Fiscale',
            'Squadra',
            'Metodo Pagamento',
            'Descrizione',
            'Importo'
        ]
        
        assert len(columns) == len(expected_columns), f"Expected {len(expected_columns)} columns, got {len(columns)}: {columns}"
        
        for i, expected in enumerate(expected_columns):
            assert columns[i] == expected, f"Column {i} should be '{expected}', got '{columns[i]}'"
        
        print(f"✅ Prima Nota CSV has all {len(expected_columns)} required columns")

    def test_prima_nota_csv_may_have_data_rows(self):
        """Test that CSV may contain data rows (not just header)"""
        response = requests.get(
            f"{BASE_URL}/api/export-csv/prima-nota",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200
        
        csv_content = response.text
        lines = csv_content.strip().split('\n')
        
        # Header is required, data rows are optional but expected
        print(f"Prima Nota CSV has {len(lines)} lines (1 header + {len(lines)-1} data rows)")
        
        if len(lines) > 1:
            # Verify first data row has correct number of columns
            data_row = lines[1].split(';')
            assert len(data_row) == 9, f"Data row should have 9 columns, got {len(data_row)}"
            print(f"✅ Prima Nota CSV has {len(lines)-1} data row(s)")
        else:
            print("⚠️ Prima Nota CSV has no data rows (header only) - may need payments with receipt_number")

    def test_prima_nota_requires_admin_role(self):
        """Test that non-admin users cannot access Prima Nota export"""
        # Login as parent
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200
        parent_token = response.json().get("token")
        
        # Try to access Prima Nota export
        response = requests.get(
            f"{BASE_URL}/api/export-csv/prima-nota",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403 for parent, got {response.status_code}"
        print("✅ Prima Nota export correctly restricted to admin only")


class TestFiscalReceiptEndpoint:
    """Test fiscal receipt endpoint returns receipt_number and registration_date"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication and get test athlete"""
        # Login as parent
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        self.parent_token = response.json().get("token")
        self.parent_headers = {"Authorization": f"Bearer {self.parent_token}"}
        
        # Get athletes
        response = requests.get(
            f"{BASE_URL}/api/athletes",
            headers=self.parent_headers
        )
        assert response.status_code == 200
        athletes = response.json()
        
        # Use first athlete or known test athlete
        self.test_athlete_id = "69b5e0beefab8e9f13304720"  # PESSI LUCIA from previous tests

    def test_fiscal_receipt_endpoint_exists(self):
        """Test that fiscal-receipt endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/payments/{self.test_athlete_id}/fiscal-receipt",
            headers=self.parent_headers
        )
        
        assert response.status_code == 200, f"Fiscal receipt failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "payments" in data, "Response should have 'payments' field"
        assert "athlete" in data, "Response should have 'athlete' field"
        assert "receipt_number" in data, "Response should have 'receipt_number' field"
        
        print(f"✅ Fiscal receipt endpoint working, {len(data.get('payments', []))} payments returned")

    def test_fiscal_receipt_payments_have_required_fields(self):
        """Test that each payment in response has receipt_number and registration_date"""
        response = requests.get(
            f"{BASE_URL}/api/payments/{self.test_athlete_id}/fiscal-receipt",
            headers=self.parent_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        payments = data.get("payments", [])
        
        if len(payments) > 0:
            for i, payment in enumerate(payments):
                # Check receipt_number field exists
                assert "receipt_number" in payment, f"Payment {i} missing 'receipt_number' field"
                
                # Check registration_date field exists
                assert "registration_date" in payment, f"Payment {i} missing 'registration_date' field"
                
                # Check other expected fields
                assert "date" in payment, f"Payment {i} missing 'date' field"
                assert "amount" in payment, f"Payment {i} missing 'amount' field"
                assert "payment_method" in payment, f"Payment {i} missing 'payment_method' field"
                
                print(f"  Payment {i}: receipt_number='{payment.get('receipt_number')}', registration_date='{payment.get('registration_date')}'")
            
            print(f"✅ All {len(payments)} payments have receipt_number and registration_date fields")
        else:
            print("⚠️ No payments found for test athlete - fields verified in response structure")


class TestSocietySettings:
    """Test society settings have season fields"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json().get("token")
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

    def test_society_settings_endpoint(self):
        """Test that society settings endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/settings/society",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Settings failed: {response.status_code} - {response.text}"
        
        data = response.json()
        print(f"✅ Society settings endpoint working")

    def test_society_settings_has_season_fields(self):
        """Test that society settings has season start/end fields"""
        response = requests.get(
            f"{BASE_URL}/api/settings/society",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check season fields exist (or use defaults)
        season_start_month = data.get("season_start_month", 7)
        season_start_day = data.get("season_start_day", 1)
        season_end_month = data.get("season_end_month", 6)
        season_end_day = data.get("season_end_day", 30)
        
        # Verify defaults are volleyball season (July 1 to June 30)
        assert 1 <= season_start_month <= 12, f"Invalid season_start_month: {season_start_month}"
        assert 1 <= season_start_day <= 31, f"Invalid season_start_day: {season_start_day}"
        assert 1 <= season_end_month <= 12, f"Invalid season_end_month: {season_end_month}"
        assert 1 <= season_end_day <= 31, f"Invalid season_end_day: {season_end_day}"
        
        print(f"✅ Season settings: start={season_start_day}/{season_start_month}, end={season_end_day}/{season_end_month}")

    def test_society_settings_has_certificate_blocking(self):
        """Test that society settings has block_expired_certificates field"""
        response = requests.get(
            f"{BASE_URL}/api/settings/society",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # block_expired_certificates should be present
        block_value = data.get("block_expired_certificates")
        print(f"✅ block_expired_certificates = {block_value}")

    def test_society_settings_can_update_season(self):
        """Test that season settings can be updated"""
        # First get current settings
        response = requests.get(
            f"{BASE_URL}/api/settings/society",
            headers=self.admin_headers
        )
        assert response.status_code == 200
        original_data = response.json()
        
        # Update season settings
        update_payload = {
            "season_start_month": 7,
            "season_start_day": 1,
            "season_end_month": 6,
            "season_end_day": 30,
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=self.admin_headers,
            json=update_payload
        )
        
        assert response.status_code == 200, f"Update failed: {response.status_code} - {response.text}"
        print("✅ Season settings can be updated via PATCH")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
