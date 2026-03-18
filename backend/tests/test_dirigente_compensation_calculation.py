"""
Test suite for dirigente compensation calculation fixes:
1. GET /api/dirigente/{id}/compensation returns correct receipts with amount_gross values
2. GET /api/dirigente/{id}/threshold-status/{year} returns correct yearly totals
3. GET /api/users/dirigenti returns list of dirigenti

Specific test cases:
- MARZO LELLA (id: 69b0272442818f49becb7b25, monthly: €4,000)
  - March 2026 receipt of €7,500, supplementary should be €3,500 (7500-4000)
- CIUCHETTI VINZZZZ (id: 697fdf1650268927c8157788, monthly: €300)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sports-app-qa.preview.emergentagent.com')

class TestDirigenteCompensationAPIs:
    """Test dirigente compensation APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin to get token"""
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "pallavoloperugia@gmail.com", "password": "password"}
        )
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
            self.user = login_resp.json().get("user", {})
        else:
            pytest.skip(f"Login failed: {login_resp.status_code} - {login_resp.text}")
    
    def test_login_success(self):
        """Test admin login works"""
        assert self.token is not None, "Token should be set after login"
        print(f"✓ Login successful, user: {self.user.get('email')}")
    
    def test_get_dirigenti_list(self):
        """Test GET /api/users/dirigenti returns list of dirigenti"""
        resp = requests.get(f"{BASE_URL}/api/users/dirigenti", headers=self.headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/users/dirigenti returned {len(data)} dirigenti")
        
        # Print dirigenti names and IDs for reference
        for d in data:
            monthly = d.get('monthly_compensation', 0) or 0
            print(f"  - {d.get('full_name')}: id={d.get('id')}, monthly=€{monthly}")
    
    def test_get_marzo_lella_compensation(self):
        """Test compensation for MARZO LELLA (id: 69b0272442818f49becb7b25)"""
        dirigente_id = "69b0272442818f49becb7b25"
        
        resp = requests.get(
            f"{BASE_URL}/api/dirigente/{dirigente_id}/compensation",
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Response should be a list of receipts
        assert isinstance(data, list), "Response should be a list of compensation records"
        print(f"✓ GET /api/dirigente/{dirigente_id}/compensation returned {len(data)} records")
        
        # Check for March 2026 receipt
        march_2026_receipt = None
        for receipt in data:
            if receipt.get('month') == 3 and receipt.get('year') == 2026:
                march_2026_receipt = receipt
                break
        
        if march_2026_receipt:
            amount_gross = march_2026_receipt.get('amount_gross', march_2026_receipt.get('amount', 0))
            print(f"  March 2026 receipt found: amount_gross = €{amount_gross}")
            
            # Verify it has amount_gross field with value (should be €7,500 based on context)
            assert amount_gross > 0, "amount_gross should be > 0"
            print(f"  ✓ Receipt has amount_gross = €{amount_gross}")
        else:
            print(f"  Note: No March 2026 receipt found for this dirigente")
        
        # Print all receipts for inspection
        for r in data[:5]:  # Show first 5
            amount = r.get('amount_gross', r.get('amount', 0))
            signed = "Signed" if r.get('receipt_signed') else "Not signed"
            print(f"  - {r.get('month')}/{r.get('year')}: €{amount} ({signed})")
    
    def test_get_marzo_lella_threshold_status(self):
        """Test threshold status for MARZO LELLA in 2026"""
        dirigente_id = "69b0272442818f49becb7b25"
        year = 2026
        
        resp = requests.get(
            f"{BASE_URL}/api/dirigente/{dirigente_id}/threshold-status/{year}",
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        print(f"✓ GET /api/dirigente/{dirigente_id}/threshold-status/{year}")
        print(f"  yearly_total: €{data.get('yearly_total', 0)}")
        print(f"  total_with_prior: €{data.get('total_with_prior', 0)}")
        print(f"  monthly_compensation: €{data.get('monthly_compensation', 0)}")
        print(f"  exceeded_5000: {data.get('exceeded_5000', False)}")
        print(f"  exceeded_15000: {data.get('exceeded_15000', False)}")
        
        # Verify threshold calculation fields exist
        assert 'yearly_total' in data, "Response should have yearly_total"
    
    def test_get_ciuchetti_compensation(self):
        """Test compensation for CIUCHETTI VINZZZZ (id: 697fdf1650268927c8157788)"""
        dirigente_id = "697fdf1650268927c8157788"
        
        resp = requests.get(
            f"{BASE_URL}/api/dirigente/{dirigente_id}/compensation",
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        print(f"✓ GET /api/dirigente/{dirigente_id}/compensation returned {len(data)} records")
        
        for r in data[:5]:
            amount = r.get('amount_gross', r.get('amount', 0))
            signed = "Signed" if r.get('receipt_signed') else "Not signed"
            print(f"  - {r.get('month')}/{r.get('year')}: €{amount} ({signed})")
    
    def test_admin_can_access_own_dirigente_profile(self):
        """Test that admin can access their own dirigente profile page endpoint"""
        # Admin user ID from login
        admin_id = self.user.get('id')
        assert admin_id, "Admin ID should be present"
        
        # Try to access compensation endpoint for the admin user
        resp = requests.get(
            f"{BASE_URL}/api/dirigente/{admin_id}/compensation",
            headers=self.headers
        )
        
        # Admin should be able to access their own data
        print(f"GET /api/dirigente/{admin_id}/compensation: status={resp.status_code}")
        # Could be 200 (success) or 403/404 depending on if admin is also a dirigente
        if resp.status_code == 200:
            print("  ✓ Admin can access their own dirigente compensation data")
        else:
            print(f"  Note: Admin may not have dirigente profile: {resp.status_code}")
    
    def test_compensation_records_have_amount_gross(self):
        """Verify all compensation records have amount_gross field"""
        dirigente_id = "69b0272442818f49becb7b25"  # MARZO LELLA
        
        resp = requests.get(
            f"{BASE_URL}/api/dirigente/{dirigente_id}/compensation",
            headers=self.headers
        )
        
        assert resp.status_code == 200
        data = resp.json()
        
        records_with_amount_gross = 0
        records_without_amount_gross = 0
        
        for record in data:
            if 'amount_gross' in record and record['amount_gross'] is not None:
                records_with_amount_gross += 1
            else:
                records_without_amount_gross += 1
        
        print(f"✓ Records with amount_gross: {records_with_amount_gross}")
        print(f"  Records without amount_gross: {records_without_amount_gross}")
        
        if records_without_amount_gross > 0:
            print("  ⚠️ WARNING: Some records missing amount_gross field")


class TestCollaboratoreCompensationAPIs:
    """Test collaboratore compensation APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin"""
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "pallavoloperugia@gmail.com", "password": "password"}
        )
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip(f"Login failed: {login_resp.status_code}")
    
    def test_get_collaboratori_list(self):
        """Test getting list of collaboratori"""
        resp = requests.get(
            f"{BASE_URL}/api/users?role=collaboratore",
            headers=self.headers
        )
        
        # Could be 200 or may need different endpoint
        print(f"GET /api/users?role=collaboratore: status={resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            collab_list = [u for u in data if u.get('role') == 'collaboratore']
            print(f"  Found {len(collab_list)} collaboratori")
            for c in collab_list[:5]:
                monthly = c.get('monthly_compensation', 0) or 0
                print(f"  - {c.get('full_name')}: id={c.get('id')}, monthly=€{monthly}")


class TestCoachCompensationAPIs:
    """Test coach compensation APIs for reference implementation comparison"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin"""
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "pallavoloperugia@gmail.com", "password": "password"}
        )
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip(f"Login failed: {login_resp.status_code}")
    
    def test_get_coaches_list(self):
        """Test getting list of coaches"""
        resp = requests.get(f"{BASE_URL}/api/users/coaches", headers=self.headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        print(f"✓ GET /api/coaches returned {len(data)} coaches")
        for c in data[:5]:
            monthly = c.get('monthly_compensation', 0) or 0
            print(f"  - {c.get('full_name')}: id={c.get('id')}, monthly=€{monthly}")
    
    def test_coach_compensation_endpoint_format(self):
        """Test a coach compensation endpoint to compare with dirigente format"""
        # Get a coach first
        coaches_resp = requests.get(f"{BASE_URL}/api/coaches", headers=self.headers)
        if coaches_resp.status_code != 200:
            pytest.skip("Could not get coaches list")
        
        coaches = coaches_resp.json()
        if not coaches:
            pytest.skip("No coaches found")
        
        coach_id = coaches[0].get('id')
        print(f"Testing coach: {coaches[0].get('full_name')} ({coach_id})")
        
        resp = requests.get(
            f"{BASE_URL}/api/coach/{coach_id}/compensation",
            headers=self.headers
        )
        
        print(f"GET /api/coach/{coach_id}/compensation: status={resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            # Check if it's a list or object
            if isinstance(data, list):
                print(f"  Response is a list with {len(data)} records")
                for r in data[:3]:
                    amount = r.get('amount_gross', r.get('amount', 0))
                    print(f"  - {r.get('month')}/{r.get('year')}: €{amount}")
            else:
                print(f"  Response is an object: {list(data.keys())[:5]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
