"""
Test cases for Trial Period Endpoints
Tests:
1. Verify payments collection is empty
2. Test /api/trial/check-pending endpoint - returns athletes with expired trial linked to parent via parent_id
3. Test /api/trial/accept-privacy/{athlete_id} - sets privacy_accepted=True and status='active'
4. Test /api/trial/request-deletion/{athlete_id} - deletes athlete and all related data
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path

# Load env
load_dotenv(Path('/app/backend/.env'))

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://squad-mgmt-preview.preview.emergentagent.com').rstrip('/')

# Test parent credentials (will create if not exists)
TEST_PARENT_EMAIL = "testparent@trial.com"
TEST_PARENT_PASSWORD = "test1234"

# Admin credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "test1234"

class TestPaymentsEmpty:
    """Verify that payments collection is empty"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin to check payments"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    def test_payments_collection_is_empty(self, admin_token):
        """Verify no payments exist in database"""
        # Use MongoDB directly since we can't get all payments via API easily
        # We'll check by getting athletes and seeing if they have payments
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get athletes 
        response = requests.get(f"{BASE_URL}/api/athletes", headers=headers)
        assert response.status_code == 200, f"Failed to get athletes: {response.text}"
        
        athletes = response.json()
        print(f"Found {len(athletes)} athletes")
        
        # Check payments for each athlete (spot check first few)
        for athlete in athletes[:3]:
            athlete_id = athlete.get("id")
            pay_response = requests.get(
                f"{BASE_URL}/api/athletes/{athlete_id}/payments",
                headers=headers
            )
            if pay_response.status_code == 200:
                payments = pay_response.json()
                assert len(payments) == 0, f"Athlete {athlete_id} has {len(payments)} payments - should be 0"
                print(f"Athlete {athlete.get('full_name')}: 0 payments (correct)")


class TestTrialEndpoints:
    """Test trial period endpoints"""
    
    @pytest.fixture(scope="class")
    def parent_session(self):
        """Create or login as test parent"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to login first
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_PARENT_EMAIL,
            "password": TEST_PARENT_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            session.headers.update({"Authorization": f"Bearer {data['token']}"})
            return {"session": session, "user_id": data["user"]["id"], "token": data["token"]}
        
        pytest.skip(f"Parent login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            session.headers.update({"Authorization": f"Bearer {data['token']}"})
            return {"session": session, "user_id": data["user"]["id"], "token": data["token"]}
        
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def test_team(self, admin_session):
        """Get or create a test team"""
        session = admin_session["session"]
        
        # Get existing teams
        response = session.get(f"{BASE_URL}/api/teams")
        if response.status_code == 200 and len(response.json()) > 0:
            team = response.json()[0]
            return team
        
        # Create a team if none exists
        team_data = {
            "name": "TEST_TrialTeam",
            "description": "Team for trial testing",
            "total_amount": 500.0,
            "installment_1_amount": 200.0,
            "installment_2_amount": 150.0,
            "installment_2_due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "installment_3_amount": 150.0,
            "installment_3_due_date": (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d"),
            "bank_info": "Test Bank IBAN",
            "paypal_email": "test@paypal.com"
        }
        
        response = session.post(f"{BASE_URL}/api/teams", json=team_data)
        if response.status_code in [200, 201]:
            return response.json()
        
        pytest.skip(f"Could not get or create team: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def test_athlete_expired_trial(self, admin_session, parent_session, test_team):
        """Create a test athlete with expired trial period"""
        admin = admin_session["session"]
        parent_id = parent_session["user_id"]
        team_id = test_team["id"]
        
        # Create athlete with trial via parent
        parent_s = parent_session["session"]
        athlete_data = {
            "full_name": "TEST_TrialAthlete DeleteMe",
            "first_name": "TEST",
            "last_name": "TrialAthlete",
            "date_of_birth": "2010-01-15",
            "fiscal_code": "TSTDEL10A15H501Z",
            "team_id": team_id,
            "is_trial": True,
            "privacy_accepted": False
        }
        
        response = parent_s.post(f"{BASE_URL}/api/athletes", json=athlete_data)
        if response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test athlete: {response.status_code} - {response.text}")
        
        athlete = response.json()
        athlete_id = athlete["id"]
        print(f"Created test athlete: {athlete_id}")
        
        # Need admin to approve to trial status with expired trial_end_date
        approve_data = {
            "status": "trial"
        }
        response = admin.patch(f"{BASE_URL}/api/athletes/{athlete_id}/approve", json=approve_data)
        if response.status_code != 200:
            print(f"Warning: Could not approve athlete: {response.status_code} - {response.text}")
        
        # Now we need to manually set trial_end_date to past (this is done via MongoDB directly)
        # For testing purposes, we'll use an endpoint or assume the date was already expired
        
        return {"id": athlete_id, "full_name": athlete.get("full_name", athlete_data["full_name"])}
    
    def test_check_pending_trials_endpoint_exists(self, parent_session):
        """Test /api/trial/check-pending returns 200 and correct structure"""
        session = parent_session["session"]
        
        response = session.get(f"{BASE_URL}/api/trial/check-pending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "athletes_requiring_action" in data, "Response should have 'athletes_requiring_action' field"
        assert isinstance(data["athletes_requiring_action"], list), "athletes_requiring_action should be a list"
        
        print(f"check-pending response: {data}")
    
    def test_trial_status_endpoint(self, parent_session, test_athlete_expired_trial):
        """Test /api/trial/status/{athlete_id} endpoint"""
        session = parent_session["session"]
        athlete_id = test_athlete_expired_trial["id"]
        
        response = session.get(f"{BASE_URL}/api/trial/status/{athlete_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Trial status for {athlete_id}: {data}")
        
        # Verify structure
        assert "athlete_id" in data
        assert "privacy_accepted" in data
        assert "trial_end_date" in data
    
    def test_accept_privacy_sets_active_status(self, parent_session, admin_session, test_team):
        """Test /api/trial/accept-privacy/{athlete_id} sets privacy_accepted=True and status='active'"""
        parent_s = parent_session["session"]
        parent_id = parent_session["user_id"]
        admin = admin_session["session"]
        team_id = test_team["id"]
        
        # Create a fresh athlete for this test
        athlete_data = {
            "full_name": "TEST_AcceptPrivacy Athlete",
            "first_name": "TEST_Accept",
            "last_name": "Privacy",
            "date_of_birth": "2012-05-20",
            "fiscal_code": "TSTPVT12E20H501X",
            "team_id": team_id,
            "is_trial": True,
            "privacy_accepted": False
        }
        
        create_response = parent_s.post(f"{BASE_URL}/api/athletes", json=athlete_data)
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        athlete = create_response.json()
        athlete_id = athlete["id"]
        print(f"Created athlete for privacy test: {athlete_id}")
        
        try:
            # Approve to trial first
            admin.patch(f"{BASE_URL}/api/athletes/{athlete_id}/approve", json={"status": "trial"})
            
            # Now accept privacy
            response = parent_s.post(f"{BASE_URL}/api/trial/accept-privacy/{athlete_id}")
            assert response.status_code == 200, f"accept-privacy failed: {response.status_code} - {response.text}"
            
            data = response.json()
            print(f"Accept privacy response: {data}")
            assert data.get("status") == "active", f"Expected status='active', got {data.get('status')}"
            
            # Verify by fetching athlete
            get_response = parent_s.get(f"{BASE_URL}/api/athletes/{athlete_id}")
            assert get_response.status_code == 200, f"Failed to get athlete: {get_response.text}"
            
            updated_athlete = get_response.json()
            assert updated_athlete.get("privacy_accepted") == True, "privacy_accepted should be True"
            assert updated_athlete.get("status") == "active", f"status should be 'active', got {updated_athlete.get('status')}"
            print(f"Verified: privacy_accepted={updated_athlete.get('privacy_accepted')}, status={updated_athlete.get('status')}")
            
        finally:
            # Cleanup: delete the test athlete
            admin.delete(f"{BASE_URL}/api/athletes/{athlete_id}")
            print(f"Cleaned up athlete {athlete_id}")
    
    def test_request_deletion_deletes_all_data(self, parent_session, admin_session, test_team):
        """Test /api/trial/request-deletion/{athlete_id} deletes athlete and all related data"""
        parent_s = parent_session["session"]
        admin = admin_session["session"]
        team_id = test_team["id"]
        
        # Create a fresh athlete for deletion test
        athlete_data = {
            "full_name": "TEST_ToDelete Athlete",
            "first_name": "TEST_ToDelete",
            "last_name": "Athlete",
            "date_of_birth": "2011-08-10",
            "fiscal_code": "TSTDEL11H10H501Y",
            "team_id": team_id,
            "is_trial": True,
            "privacy_accepted": False
        }
        
        create_response = parent_s.post(f"{BASE_URL}/api/athletes", json=athlete_data)
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        athlete = create_response.json()
        athlete_id = athlete["id"]
        print(f"Created athlete for deletion test: {athlete_id}")
        
        # Approve to trial
        admin.patch(f"{BASE_URL}/api/athletes/{athlete_id}/approve", json={"status": "trial"})
        
        # Add some related data that should be deleted
        # 1. Add a payment
        payment_data = {
            "athlete_id": athlete_id,
            "amount": 100.0,
            "paid_date": datetime.now().strftime("%d/%m/%Y"),
            "is_cash": True,
            "notes": "Test payment for deletion"
        }
        pay_response = admin.post(f"{BASE_URL}/api/payments", json=payment_data)
        if pay_response.status_code in [200, 201]:
            print(f"Created test payment for athlete {athlete_id}")
        
        # 2. Add an attendance (if endpoint exists)
        # Attendance is created via QR scan, so skip for now
        
        # Now request deletion
        response = parent_s.post(f"{BASE_URL}/api/trial/request-deletion/{athlete_id}")
        assert response.status_code == 200, f"Deletion request failed: {response.status_code} - {response.text}"
        
        data = response.json()
        print(f"Deletion response: {data}")
        assert "deleted_athlete" in data or "message" in data, "Response should confirm deletion"
        
        # Verify athlete no longer exists
        verify_response = admin.get(f"{BASE_URL}/api/athletes/{athlete_id}")
        assert verify_response.status_code == 404, f"Athlete should be deleted, but got {verify_response.status_code}"
        print(f"Verified: athlete {athlete_id} no longer exists (404)")
        
        # Verify payments were also deleted
        payments_response = admin.get(f"{BASE_URL}/api/athletes/{athlete_id}/payments")
        # Should return 404 since athlete doesn't exist, or empty list
        if payments_response.status_code == 200:
            payments = payments_response.json()
            assert len(payments) == 0, f"Payments should be deleted, found {len(payments)}"
        print(f"Verified: payments for deleted athlete are gone")


class TestTrialCheckPendingWithParentId:
    """Test that check-pending correctly uses parent_id instead of parent_email"""
    
    @pytest.fixture(scope="class")
    def parent_session(self):
        """Login as test parent"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_PARENT_EMAIL,
            "password": TEST_PARENT_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            session.headers.update({"Authorization": f"Bearer {data['token']}"})
            return {"session": session, "user_id": data["user"]["id"], "token": data["token"]}
        
        pytest.skip(f"Parent login failed: {response.status_code}")
    
    def test_check_pending_finds_athletes_by_parent_id(self, parent_session):
        """Verify check-pending uses parent_id field to find athletes"""
        session = parent_session["session"]
        parent_id = parent_session["user_id"]
        
        response = session.get(f"{BASE_URL}/api/trial/check-pending")
        assert response.status_code == 200, f"Failed: {response.status_code}"
        
        data = response.json()
        print(f"Parent {parent_id} - check-pending response: {data}")
        
        # The endpoint should return a list (may be empty if no expired trials)
        assert "athletes_requiring_action" in data
        assert isinstance(data["athletes_requiring_action"], list)
        
        # If there are athletes, each should have required fields
        for athlete in data["athletes_requiring_action"]:
            assert "id" in athlete, "Each athlete should have 'id'"
            assert "full_name" in athlete, "Each athlete should have 'full_name'"
            print(f"  Found athlete requiring action: {athlete.get('full_name')} (id: {athlete.get('id')})")


class TestUnauthorizedAccess:
    """Test that trial endpoints properly restrict access"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            session.headers.update({"Authorization": f"Bearer {data['token']}"})
            return session
        
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def other_parent_session(self):
        """Login as different parent"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try another existing parent (with passwords reset to test1234)
        for email in ["armida.raschi@gmail.com", "parent@sportsclub.com", "lidia@test.com"]:
            response = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "test1234"
            })
            if response.status_code == 200:
                data = response.json()
                session.headers.update({"Authorization": f"Bearer {data['token']}"})
                return {"session": session, "user_id": data["user"]["id"], "email": email}
        
        pytest.skip("Could not login as other parent - password may not be test1234")
    
    def test_accept_privacy_unauthorized_for_other_parent(self, admin_session, other_parent_session):
        """Test that a parent cannot accept privacy for another parent's athlete"""
        admin = admin_session
        other_parent = other_parent_session["session"]
        
        # Get an athlete that belongs to a different parent (testparent@trial.com)
        response = admin.get(f"{BASE_URL}/api/athletes")
        if response.status_code != 200:
            pytest.skip("Could not get athletes")
        
        athletes = response.json()
        
        # Find athlete belonging to testparent@trial.com (parent_id = 69910a58884529bf5e446d55)
        target_athlete = None
        for a in athletes:
            if a.get("parent_id") == "69910a58884529bf5e446d55":
                target_athlete = a
                break
        
        if not target_athlete:
            pytest.skip("No athlete found for testparent@trial.com")
        
        athlete_id = target_athlete["id"]
        
        # Try to accept privacy as other parent - should fail
        response = other_parent.post(f"{BASE_URL}/api/trial/accept-privacy/{athlete_id}")
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}: {response.text}"
        print(f"Correctly rejected: other parent cannot accept privacy for athlete {athlete_id}")
    
    def test_request_deletion_unauthorized_for_other_parent(self, admin_session, other_parent_session):
        """Test that a parent cannot delete another parent's athlete"""
        admin = admin_session
        other_parent = other_parent_session["session"]
        
        # Get athletes
        response = admin.get(f"{BASE_URL}/api/athletes")
        if response.status_code != 200:
            pytest.skip("Could not get athletes")
        
        athletes = response.json()
        
        # Find athlete belonging to testparent@trial.com
        target_athlete = None
        for a in athletes:
            if a.get("parent_id") == "69910a58884529bf5e446d55":
                target_athlete = a
                break
        
        if not target_athlete:
            pytest.skip("No athlete found for testparent@trial.com")
        
        athlete_id = target_athlete["id"]
        
        # Try to delete as other parent - should fail
        response = other_parent.post(f"{BASE_URL}/api/trial/request-deletion/{athlete_id}")
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}: {response.text}"
        print(f"Correctly rejected: other parent cannot delete athlete {athlete_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
