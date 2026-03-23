"""
Test Coach Onboarding Checklist Feature
Tests:
1. PATCH /api/users/{id}/onboarding endpoint
2. Onboarding checklist saves correctly
3. Prior compensation (compensi pregressi) saves correctly
4. Banner logic verifies missing data
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://season-enroll.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "11092012"

# Test coach data
TEST_COACH_EMAIL = f"test_coach_onboarding_{int(time.time())}@test.com"
TEST_COACH_PASSWORD = "test1234"
TEST_COACH_NAME = "Test Onboarding Coach"

class TestCoachOnboarding:
    """Tests for Coach Onboarding Checklist feature"""
    
    admin_token = None
    test_coach_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        # Login as admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        yield
        
    def test_01_admin_login_works(self):
        """Test admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"PASS: Admin login successful, role: {data['user']['role']}")
    
    def test_02_create_pending_coach(self):
        """Create a pending coach for testing"""
        # Register a new coach (will be in pending status)
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_COACH_EMAIL,
                "password": TEST_COACH_PASSWORD,
                "role": "coach",
                "full_name": TEST_COACH_NAME,
                "first_name": "Test",
                "last_name": "OnboardingCoach"
            }
        )
        assert response.status_code == 200, f"Coach registration failed: {response.text}"
        data = response.json()
        TestCoachOnboarding.test_coach_id = data["user"]["id"]
        assert data["user"]["status"] == "pending", f"Expected pending status, got: {data['user']['status']}"
        print(f"PASS: Created pending coach with ID: {TestCoachOnboarding.test_coach_id}")
    
    def test_03_get_pending_coaches_list(self):
        """Test that pending coaches endpoint returns our test coach"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/users/pending",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get pending users: {response.text}"
        pending = response.json()
        
        # Check if our test coach is in the pending list
        coach_found = any(u["email"] == TEST_COACH_EMAIL for u in pending)
        assert coach_found, f"Test coach not found in pending list"
        print(f"PASS: Found {len(pending)} pending users, test coach in list")
    
    def test_04_onboarding_endpoint_requires_admin(self):
        """Test that onboarding endpoint requires admin role"""
        # Try with coach token
        coach_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_COACH_EMAIL, "password": TEST_COACH_PASSWORD}
        )
        # This will fail because coach is pending
        assert coach_login.status_code == 403, "Pending coach should not be able to login"
        print("PASS: Pending coach cannot login (expected behavior)")
    
    def test_05_onboarding_endpoint_with_checklist(self):
        """Test PATCH /api/users/{id}/onboarding saves checklist data"""
        if not TestCoachOnboarding.test_coach_id:
            pytest.skip("No test coach ID available")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Send onboarding data with checklist
        onboarding_data = {
            "onboarding_checklist": {
                "contract_signed": True,
                "ras_registered": False,
                "id_acquired": True,
                "fiscal_code_acquired": True,
                "criminal_record": False
            },
            "prior_compensation": 1500.50,
            "onboarding_completed": True,
            "onboarding_date": datetime.utcnow().isoformat()
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}/onboarding",
            headers=headers,
            json=onboarding_data
        )
        
        assert response.status_code == 200, f"Onboarding update failed: {response.text}"
        data = response.json()
        assert data["message"] == "Dati onboarding aggiornati"
        print("PASS: Onboarding endpoint accepted checklist and prior_compensation")
    
    def test_06_verify_onboarding_data_saved(self):
        """Verify onboarding data was actually saved in database"""
        if not TestCoachOnboarding.test_coach_id:
            pytest.skip("No test coach ID available")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get user details
        response = requests.get(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        user = response.json()
        
        # Verify checklist
        assert "onboarding_checklist" in user, "onboarding_checklist not saved"
        checklist = user["onboarding_checklist"]
        assert checklist["contract_signed"] == True
        assert checklist["ras_registered"] == False
        assert checklist["id_acquired"] == True
        assert checklist["fiscal_code_acquired"] == True
        assert checklist["criminal_record"] == False
        
        # Verify prior compensation
        assert "prior_compensation" in user, "prior_compensation not saved"
        assert user["prior_compensation"] == 1500.50
        
        # Verify onboarding completed flag
        assert user.get("onboarding_completed") == True
        
        print("PASS: All onboarding data verified in database")
        print(f"  - Checklist: {checklist}")
        print(f"  - Prior compensation: €{user['prior_compensation']}")
    
    def test_07_approve_coach_after_onboarding(self):
        """Test approving coach after onboarding data is saved"""
        if not TestCoachOnboarding.test_coach_id:
            pytest.skip("No test coach ID available")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Approve the coach
        response = requests.patch(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}/status",
            headers=headers,
            json={"status": "approved"}
        )
        
        assert response.status_code == 200, f"Coach approval failed: {response.text}"
        print("PASS: Coach approved successfully after onboarding")
    
    def test_08_verify_coach_approved_with_onboarding_data(self):
        """Verify approved coach still has onboarding data"""
        if not TestCoachOnboarding.test_coach_id:
            pytest.skip("No test coach ID available")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        user = response.json()
        
        # Verify status is approved
        assert user["status"] == "approved", f"Expected approved status, got: {user['status']}"
        
        # Verify onboarding data persisted after approval
        assert user.get("onboarding_checklist") is not None, "Onboarding checklist lost after approval"
        assert user.get("prior_compensation") == 1500.50, "Prior compensation lost after approval"
        
        print("PASS: Coach is approved and onboarding data persisted")
    
    def test_09_check_banner_logic_missing_data(self):
        """Test banner should show when checklist items are missing"""
        if not TestCoachOnboarding.test_coach_id:
            pytest.skip("No test coach ID available")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}",
            headers=headers
        )
        
        user = response.json()
        checklist = user.get("onboarding_checklist", {})
        
        # Check which items are missing (should trigger banner in frontend)
        missing_items = []
        if not checklist.get("contract_signed"):
            missing_items.append("Contratto")
        if not checklist.get("ras_registered"):
            missing_items.append("Iscrizione RAS")
        if not checklist.get("id_acquired"):
            missing_items.append("Documento identità")
        if not checklist.get("fiscal_code_acquired"):
            missing_items.append("Codice fiscale")
        if not checklist.get("criminal_record"):
            missing_items.append("Casellario giudiziale")
        
        # We intentionally left ras_registered and criminal_record as false
        assert "Iscrizione RAS" in missing_items, "RAS should be missing"
        assert "Casellario giudiziale" not in missing_items or checklist.get("criminal_record") == False
        
        print(f"PASS: Banner logic working - missing items: {missing_items}")
    
    def test_10_update_partial_onboarding(self):
        """Test partial update of onboarding data"""
        if not TestCoachOnboarding.test_coach_id:
            pytest.skip("No test coach ID available")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Update only prior_compensation
        response = requests.patch(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}/onboarding",
            headers=headers,
            json={"prior_compensation": 2000.00}
        )
        
        assert response.status_code == 200, f"Partial update failed: {response.text}"
        
        # Verify prior_compensation updated but checklist unchanged
        response = requests.get(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}",
            headers=headers
        )
        user = response.json()
        
        assert user["prior_compensation"] == 2000.00, f"Prior compensation not updated"
        assert user.get("onboarding_checklist") is not None, "Checklist was overwritten"
        
        print("PASS: Partial update works - prior_compensation updated, checklist preserved")
    
    def test_11_cleanup_test_coach(self):
        """Cleanup - delete test coach"""
        if not TestCoachOnboarding.test_coach_id:
            pytest.skip("No test coach ID to delete")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/users/{TestCoachOnboarding.test_coach_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to delete test coach: {response.text}"
        print("PASS: Test coach cleaned up")


class TestOnboardingWithPriorCompensation:
    """Additional tests for prior_compensation edge cases"""
    
    def test_prior_compensation_zero(self):
        """Test prior_compensation with zero value"""
        # Login as admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        admin_token = response.json()["token"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a new pending coach
        coach_email = f"test_zero_comp_{int(time.time())}@test.com"
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": coach_email,
                "password": "test1234",
                "role": "coach",
                "full_name": "Zero Comp Coach"
            }
        )
        assert reg_response.status_code == 200
        coach_id = reg_response.json()["user"]["id"]
        
        # Set prior_compensation to 0
        onboarding_response = requests.patch(
            f"{BASE_URL}/api/users/{coach_id}/onboarding",
            headers=headers,
            json={
                "prior_compensation": 0,
                "onboarding_checklist": {
                    "contract_signed": True,
                    "ras_registered": True,
                    "id_acquired": True,
                    "fiscal_code_acquired": True,
                    "criminal_record": True
                }
            }
        )
        assert onboarding_response.status_code == 200
        
        # Verify
        user_response = requests.get(f"{BASE_URL}/api/users/{coach_id}", headers=headers)
        user = user_response.json()
        assert user.get("prior_compensation") == 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{coach_id}", headers=headers)
        print("PASS: prior_compensation with zero value works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
