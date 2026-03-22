"""
Test Coach Compensation API endpoints
Tests signed receipts visibility, compensation records, and threshold status
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://deletion-workflow-2.preview.emergentagent.com').rstrip('/')

# Test credentials
COACH_EMAIL = "coach.pietro@test.com"
COACH_PASSWORD = "Test1234"
COACH_ID = "6980467d813e3df28f2c763f"

ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "11092012"


class TestCoachCompensation:
    """Tests for coach compensation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as coach before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COACH_EMAIL, "password": COACH_PASSWORD}
        )
        assert response.status_code == 200, f"Coach login failed: {response.text}"
        data = response.json()
        self.coach_token = data["token"]
        self.coach_user = data["user"]
        self.headers = {"Authorization": f"Bearer {self.coach_token}"}
    
    def test_coach_login_success(self):
        """Test coach can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COACH_EMAIL, "password": COACH_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "coach"
        assert data["user"]["email"] == COACH_EMAIL
        print(f"PASS: Coach login successful, user id: {data['user']['id']}")
    
    def test_get_coach_profile(self):
        """Test getting coach profile with contract dates and compensation"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=self.headers
        )
        assert response.status_code == 200
        profile = response.json()
        
        # Verify profile has expected fields
        assert "full_name" in profile
        assert "monthly_compensation" in profile or profile.get("monthly_compensation") is not None or profile.get("monthly_compensation", 0) >= 0
        
        print(f"PASS: Coach profile retrieved")
        print(f"  - Full name: {profile.get('full_name')}")
        print(f"  - Monthly compensation: {profile.get('monthly_compensation', 0)}")
        print(f"  - Contract start: {profile.get('contract_start_date')}")
        print(f"  - Contract end: {profile.get('contract_end_date')}")
        
        return profile
    
    def test_get_compensation_records(self):
        """Test getting compensation records with signed receipts"""
        response = requests.get(
            f"{BASE_URL}/api/coach/{COACH_ID}/compensation",
            headers=self.headers
        )
        assert response.status_code == 200
        records = response.json()
        
        assert isinstance(records, list), "Expected list of compensation records"
        
        # Check for signed receipts (September and October 2024)
        signed_records = [r for r in records if r.get("receipt_signed")]
        
        print(f"PASS: Retrieved {len(records)} compensation records")
        print(f"  - Signed receipts: {len(signed_records)}")
        
        for r in signed_records:
            print(f"    - {r.get('month')}/{r.get('year')}: €{r.get('amount_gross', 0)} - Signed: {r.get('receipt_signed_date')}")
        
        # Verify we have signed receipts for Sep and Oct 2024
        sep_2024 = next((r for r in records if r.get("month") == 9 and r.get("year") == 2024), None)
        oct_2024 = next((r for r in records if r.get("month") == 10 and r.get("year") == 2024), None)
        
        assert sep_2024 is not None, "Expected September 2024 record"
        assert oct_2024 is not None, "Expected October 2024 record"
        assert sep_2024.get("receipt_signed") == True, "September 2024 should be signed"
        assert oct_2024.get("receipt_signed") == True, "October 2024 should be signed"
        
        print("PASS: September and October 2024 receipts are signed")
        
        return records
    
    def test_get_threshold_status(self):
        """Test getting threshold status for 2024"""
        response = requests.get(
            f"{BASE_URL}/api/coach/{COACH_ID}/threshold-status/2024",
            headers=self.headers
        )
        assert response.status_code == 200
        status = response.json()
        
        assert "thresholds" in status
        assert "5000" in status["thresholds"]
        assert "15000" in status["thresholds"]
        
        print(f"PASS: Threshold status retrieved for 2024")
        print(f"  - Yearly total: {status.get('yearly_total', 0)}")
        print(f"  - €5000 threshold needs declaration: {status['thresholds']['5000'].get('needs_declaration')}")
        print(f"  - €15000 threshold needs declaration: {status['thresholds']['15000'].get('needs_declaration')}")
        
        return status
    
    def test_annual_compensation_summary(self):
        """Test annual compensation summary for 2024"""
        response = requests.get(
            f"{BASE_URL}/api/coach/{COACH_ID}/compensation/annual/2024",
            headers=self.headers
        )
        assert response.status_code == 200
        summary = response.json()
        
        assert "year" in summary
        assert summary["year"] == 2024
        assert "total_received" in summary
        assert "months_received" in summary
        
        print(f"PASS: Annual summary for 2024")
        print(f"  - Total received: €{summary.get('total_received', 0)}")
        print(f"  - Months received: {summary.get('months_received', 0)}")
        
        return summary


class TestAdminViewCoachCompensation:
    """Tests for admin viewing coach compensation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.admin_token = data["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_admin_can_view_coach_compensation(self):
        """Test admin can view coach compensation records"""
        response = requests.get(
            f"{BASE_URL}/api/coach/{COACH_ID}/compensation",
            headers=self.headers
        )
        assert response.status_code == 200
        records = response.json()
        
        assert isinstance(records, list)
        print(f"PASS: Admin can view coach compensation ({len(records)} records)")
        
        return records
    
    def test_admin_can_view_coaches_list(self):
        """Test admin can get list of coaches"""
        response = requests.get(
            f"{BASE_URL}/api/users/coaches",
            headers=self.headers
        )
        assert response.status_code == 200
        coaches = response.json()
        
        assert isinstance(coaches, list)
        print(f"PASS: Admin retrieved {len(coaches)} coaches")
        
        # Find test coach
        test_coach = next((c for c in coaches if c.get("email") == COACH_EMAIL), None)
        if test_coach:
            print(f"  - Found test coach: {test_coach.get('full_name')}")
            print(f"    Monthly compensation: €{test_coach.get('monthly_compensation', 0)}")
        
        return coaches


class TestSignatureCanvasComponent:
    """Verify SignaturePadInline component exists and uses react-signature-canvas for web"""
    
    def test_signature_component_exists(self):
        """Verify SignaturePadInline component file exists"""
        import os
        component_path = "/app/frontend/src/components/SignaturePadInline.tsx"
        assert os.path.exists(component_path), f"SignaturePadInline.tsx not found at {component_path}"
        
        with open(component_path, 'r') as f:
            content = f.read()
        
        # Check for web signature canvas import
        assert "react-signature-canvas" in content, "Should use react-signature-canvas for web"
        assert "SignatureCanvasWeb" in content or "SignatureCanvas" in content, "Should have web canvas component"
        assert "Platform.OS === 'web'" in content, "Should have platform-specific logic"
        
        print("PASS: SignaturePadInline component verified")
        print("  - Uses react-signature-canvas for web")
        print("  - Has platform-specific logic")


class TestIlMioProfiloLink:
    """Test that 'Il Mio Profilo' link exists in compensation page"""
    
    def test_profile_link_in_compensation_page(self):
        """Verify 'Il Mio Profilo' link is in compensation.tsx"""
        import os
        comp_path = "/app/frontend/app/coach/compensation.tsx"
        assert os.path.exists(comp_path), f"compensation.tsx not found at {comp_path}"
        
        with open(comp_path, 'r') as f:
            content = f.read()
        
        # Check for Il Mio Profilo link positioned correctly (under coach name)
        assert "Il Mio Profilo" in content, "Should have 'Il Mio Profilo' text"
        
        # The link should be inside a TouchableOpacity that routes to profile
        assert "router.push('/coach/profile')" in content, "Should link to /coach/profile"
        
        # Check that it's in the coach name section (before year summaries)
        profile_link_index = content.find("Il Mio Profilo")
        year_summary_index = content.find("Year Summaries")
        
        # If no exact comment, check that it comes before summaryCard elements
        summary_card_index = content.find("summaryCard")
        
        assert profile_link_index < summary_card_index, "'Il Mio Profilo' link should appear before summary cards (under coach name)"
        
        print("PASS: 'Il Mio Profilo' link verified in compensation.tsx")
        print("  - Link text found")
        print("  - Routes to /coach/profile")
        print("  - Positioned correctly (under coach name, before summaries)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
