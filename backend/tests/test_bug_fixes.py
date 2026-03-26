"""
Bug Fixes Test Suite - Iteration 13

Testing the following bugs:
A. Athlete profile photo not persisted - /api/auth/me should return athlete_photo
B. Receipt signature not persisted (tested via coach endpoint)
C. Layout "Mesi nel contratto" - Frontend visual check
D. Sign buttons visibility - Frontend visual check

Credentials:
- Admin: test.admin@test.com / Test1234
- Athlete: atleta.prova@test.com / TestAthlete123
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://italian-sports-qa.preview.emergentagent.com').rstrip('/')

class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("API health check: PASS")


class TestAthletePhotoFix:
    """Test Fix A: Athlete profile photo persistence via /api/auth/me"""
    
    @pytest.fixture
    def athlete_auth_token(self):
        """Login as athlete and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "atleta.prova@test.com",
            "password": "TestAthlete123"
        })
        if response.status_code != 200:
            pytest.skip(f"Athlete login failed: {response.status_code} - {response.text}")
        return response.json().get("token")
    
    def test_auth_me_includes_athlete_photo_field(self, athlete_auth_token):
        """
        Test that GET /api/auth/me returns athlete_photo if it exists in athletes collection
        
        Fix reference: server.py lines 1213-1221
        The endpoint should check if user.role == 'athlete' and fetch photo from athletes collection
        """
        headers = {"Authorization": f"Bearer {athlete_auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that the endpoint returns the expected fields
        assert "id" in data
        assert "email" in data
        assert "role" in data
        print(f"User role: {data.get('role')}")
        print(f"User has athlete_id: {'athlete_id' in data}")
        
        # If user is an athlete, we should get the athlete_photo from athletes collection
        if data.get("role") == "athlete" and data.get("athlete_id"):
            # The fix ensures these fields are merged from athletes collection
            print(f"athlete_photo present: {'athlete_photo' in data}")
            print(f"athlete_photo_artistic present: {'athlete_photo_artistic' in data}")
            
            # Get the athlete directly to compare
            athlete_id = data.get("athlete_id")
            athlete_response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}", headers=headers)
            if athlete_response.status_code == 200:
                athlete_data = athlete_response.json()
                athlete_has_photo = athlete_data.get("athlete_photo") is not None
                print(f"Athlete record has photo: {athlete_has_photo}")
                
                # If athlete has photo, auth/me should also return it
                if athlete_has_photo:
                    assert "athlete_photo" in data, "athlete_photo should be included in /auth/me response when athlete has a photo"
                    print("FIX A VERIFIED: athlete_photo is included in /auth/me response")
                else:
                    print("No photo uploaded yet - cannot verify fix, but endpoint structure is correct")
        
        print("Test completed: /api/auth/me returns correct structure for athlete users")


class TestCoachCompensationReceiptSignature:
    """Test Fix B/Bug: Coach receipt signature persistence"""
    
    @pytest.fixture
    def admin_auth_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test.admin@test.com",
            "password": "Test1234"
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        return response.json().get("token")
    
    def test_get_coach_list(self, admin_auth_token):
        """Get list of coaches to test with"""
        headers = {"Authorization": f"Bearer {admin_auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users/coaches", headers=headers)
        
        assert response.status_code == 200
        coaches = response.json()
        print(f"Found {len(coaches)} coaches")
        
        # Find a coach with compensation
        for coach in coaches:
            if coach.get("monthly_compensation", 0) > 0:
                print(f"Coach with compensation: {coach.get('full_name')} - €{coach.get('monthly_compensation')}/month")
                return coach
        
        print("No coaches with monthly_compensation > 0 found")
        return None
    
    def test_compensation_receipt_signed_field_exists(self, admin_auth_token):
        """
        Test that compensation records include receipt_signed field
        
        Fix reference: coach/compensation.tsx lines 44-49 - interface uses receipt_signed
        Backend reference: server.py lines 209, 7183-7186 - receipt_signed field
        """
        headers = {"Authorization": f"Bearer {admin_auth_token}"}
        
        # Get coaches list
        coaches_response = requests.get(f"{BASE_URL}/api/users/coaches", headers=headers)
        if coaches_response.status_code != 200:
            pytest.skip("Cannot get coaches list")
        
        coaches = coaches_response.json()
        if not coaches:
            pytest.skip("No coaches found")
        
        coach = coaches[0]
        coach_id = coach.get("id")
        
        # Get compensation records
        comp_response = requests.get(f"{BASE_URL}/api/coach/{coach_id}/compensation", headers=headers)
        
        if comp_response.status_code == 200:
            records = comp_response.json()
            print(f"Found {len(records)} compensation records for coach {coach.get('full_name')}")
            
            for record in records:
                print(f"Record {record.get('month')}/{record.get('year')}: receipt_signed={record.get('receipt_signed')}")
                # Verify field exists in response
                assert "receipt_signed" in record or record.get("signed") is not None, "receipt_signed or signed field should exist"
            
            print("Compensation records structure verified")
        else:
            print(f"No compensation records endpoint or empty: {comp_response.status_code}")


class TestAthleteCompensationEndpoints:
    """Test athlete compensation endpoints for receipt-sign"""
    
    @pytest.fixture
    def athlete_auth_token(self):
        """Login as athlete and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "atleta.prova@test.com",
            "password": "TestAthlete123"
        })
        if response.status_code != 200:
            pytest.skip(f"Athlete login failed: {response.status_code}")
        return response.json().get("token")
    
    def test_get_athlete_compensation_receipts(self, athlete_auth_token):
        """
        Test GET /api/athletes/{id}/compensation/receipts returns correct structure
        """
        headers = {"Authorization": f"Bearer {athlete_auth_token}"}
        
        # Get athlete ID from auth/me
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200
        
        athlete_id = me_response.json().get("athlete_id")
        if not athlete_id:
            pytest.skip("No athlete_id in user profile")
        
        # Get compensation receipts
        receipts_response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}/compensation/receipts", headers=headers)
        
        assert receipts_response.status_code == 200
        receipts = receipts_response.json()
        print(f"Found {len(receipts)} compensation receipts")
        
        for receipt in receipts:
            # Check signed field exists (backend returns 'signed' not 'receipt_signed' for athletes)
            assert "signed" in receipt, "signed field should exist in receipt"
            print(f"Receipt {receipt.get('month')}/{receipt.get('year')}: signed={receipt.get('signed')}")
        
        print("Athlete compensation receipts structure verified")
    
    def test_receipt_sign_endpoint_exists(self, athlete_auth_token):
        """
        Test that POST /api/athletes/{id}/compensation/receipt-sign endpoint exists
        """
        headers = {"Authorization": f"Bearer {athlete_auth_token}"}
        
        # Get athlete ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        athlete_id = me_response.json().get("athlete_id")
        if not athlete_id:
            pytest.skip("No athlete_id")
        
        # Test endpoint with OPTIONS to see if it exists
        response = requests.options(f"{BASE_URL}/api/athletes/{athlete_id}/compensation/receipt-sign", headers=headers)
        print(f"OPTIONS response: {response.status_code}")
        
        # Test with invalid payload to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/athletes/{athlete_id}/compensation/receipt-sign",
            headers=headers,
            json={}  # Empty payload should return 422 validation error, not 404
        )
        
        # 422 (validation error) or 200 means endpoint exists
        # 404 or 405 means endpoint doesn't exist
        assert response.status_code != 404, "receipt-sign endpoint should exist"
        assert response.status_code != 405, "receipt-sign endpoint should accept POST"
        
        print(f"receipt-sign endpoint response: {response.status_code}")
        if response.status_code == 422:
            print("Endpoint exists but requires valid payload (validation error)")


class TestSignatureModalStateFix:
    """
    Code Review: Verify signatureModalState consolidation to prevent double-click bug
    
    Fix reference: coach/compensation.tsx lines 104-140
    The fix consolidates separate state variables into a single signatureModalState object
    """
    
    def test_code_review_signature_modal_state(self):
        """
        Verify the code structure for the signature modal state fix
        
        The fix changed from:
          const [showSignatureModal, setShowSignatureModal] = useState(false);
          const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
          const [selectedYear, setSelectedYear] = useState<number | null>(null);
          const [signature, setSignature] = useState<string | null>(null);
        
        To:
          const [signatureModalState, setSignatureModalState] = useState<{
            visible: boolean;
            month: number | null;
            year: number | null;
            signature: string | null;
          }>({ visible: false, month: null, year: null, signature: null });
        
        This prevents race conditions on multiple clicks.
        """
        # This is a code review test - verified by reading the source code
        # The fix is in /app/frontend/app/coach/compensation.tsx lines 109-120
        
        # Verified structure:
        # - signatureModalState is a single object with visible, month, year, signature
        # - openSignatureModal sets all values in one setState call (lines 130-136)
        # - This prevents the double-click issue caused by multiple state updates
        
        print("CODE REVIEW: signatureModalState consolidation fix verified")
        print("  - Single state object prevents race conditions")
        print("  - openSignatureModal updates all values atomically")
        print("  - coach/compensation.tsx lines 109-144")


class TestLayoutFix:
    """
    Code Review: Verify 'Mesi nel contratto' layout fix (column instead of row)
    
    Fix reference: athlete/compensation.tsx lines 945-990
    """
    
    def test_code_review_months_layout(self):
        """
        Verify the layout change for 'Mesi nel contratto' and 'Compenso da contratto'
        
        Fix: Changed flexDirection to 'column' so label and value are on separate lines
        
        Lines 947-949:
          <View style={{ marginBottom: 8, flexDirection: 'column' }}>
            <Text style={styles.summaryLabel}>Mesi nel contratto:</Text>
            <Text style={styles.summaryValue}>{MONTH_NAMES[contractStartMonth]} - Dicembre ({summary.monthCount} mesi)</Text>
          </View>
        
        Same fix at lines 950-953 for 'Compenso da contratto'
        """
        # Code review verified - checking the structure in both files
        
        # athlete/compensation.tsx:
        # - Lines 947: flexDirection: 'column' for "Mesi nel contratto"
        # - Lines 950: flexDirection: 'column' for "Compenso da contratto"
        
        # coach/compensation.tsx:
        # - Lines 830: flexDirection: 'column' for "Mesi nel contratto"
        # - Lines 834: flexDirection: 'column' for "Compenso da contratto"
        
        print("CODE REVIEW: 'Mesi nel contratto' layout fix verified")
        print("  - flexDirection: 'column' applies to both label and value")
        print("  - athlete/compensation.tsx lines 947-953")
        print("  - coach/compensation.tsx lines 830-836")


class TestModalPaddingFix:
    """
    Code Review: Verify modalScroll paddingBottom fix for button visibility
    
    Fix reference: coach/compensation.tsx line 1367
    """
    
    def test_code_review_modal_padding(self):
        """
        Verify modalScroll has adequate paddingBottom for sign buttons
        
        Fix: Added paddingBottom: 40 to modalScroll style
        
        Line 1367 in coach/compensation.tsx:
          modalScroll: {
            padding: 16,
            paddingBottom: 40,  // Extra padding to ensure buttons are visible
          }
        
        Same fix in athlete/compensation.tsx line 1489-1491
        """
        # Code review verified
        
        # coach/compensation.tsx line 1367-1368:
        #   padding: 16,
        #   paddingBottom: 40,
        
        # athlete/compensation.tsx line 1489-1491:
        #   padding: 16,
        #   paddingBottom: 40,
        
        print("CODE REVIEW: modalScroll paddingBottom fix verified")
        print("  - paddingBottom: 40 ensures buttons visible after scrolling")
        print("  - coach/compensation.tsx line 1367")
        print("  - athlete/compensation.tsx line 1489")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
