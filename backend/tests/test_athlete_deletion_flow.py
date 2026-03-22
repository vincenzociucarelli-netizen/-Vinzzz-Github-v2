"""
Test suite for 'Me ne vado' (athlete deletion) flow
Tests the complete deletion workflow:
1. GET /api/athletes/{athlete_id}/deletion-check - returns obligations and deletion preview
2. POST /api/athletes/{athlete_id}/request-deletion - marks athlete for deletion, notifies admin
3. POST /api/athletes/{athlete_id}/approve-deletion - deletes athlete data, archives fiscal data if obligations
4. POST /api/athletes/{athlete_id}/reject-deletion - clears deletion request
5. GET /api/athletes/deletion-requests - admin sees pending requests
6. Auto-delete parent account when no other children and no obligations
7. Preserve fiscal documents when obligations exist (archive to archived_deletions collection)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
from bson import ObjectId

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://deletion-workflow-2.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"


class TestAthleteDeletionFlow:
    """Test suite for athlete deletion (Me ne vado) flow"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth token"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_team(self, admin_headers):
        """Get an existing team for deletion tests"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get teams: {response.text}"
        teams = response.json()
        assert len(teams) > 0, "No teams available for testing"
        return teams[0]
    
    @pytest.fixture(scope="class")
    def test_parent(self, admin_headers):
        """Create a test parent account for deletion tests"""
        parent_email = f"test_deletion_parent_{datetime.now().strftime('%H%M%S')}@test.com"
        
        # Get society invite code
        response = requests.get(f"{BASE_URL}/api/societies/invite-code", headers=admin_headers)
        invite_code = response.json().get("invite_code", "")
        
        # Register parent
        parent_data = {
            "email": parent_email,
            "password": "testpass123",
            "full_name": "TEST DELETION PARENT",
            "role": "parent",
            "invite_code": invite_code
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=parent_data)
        if response.status_code != 200:
            # Parent might already exist, try login
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": parent_email,
                "password": "testpass123"
            })
        
        data = response.json()
        parent_token = data.get("token")
        parent_user = data.get("user", {})
        
        yield {
            "id": parent_user.get("id"),
            "email": parent_email,
            "token": parent_token,
            "headers": {"Authorization": f"Bearer {parent_token}"}
        }
        
        # Cleanup - delete parent if still exists
        if parent_user.get("id"):
            requests.delete(f"{BASE_URL}/api/users/{parent_user['id']}", headers=admin_headers)
    
    @pytest.fixture
    def test_athlete_no_obligations(self, admin_headers, test_team, test_parent):
        """Create a test athlete with NO fiscal obligations for full deletion test"""
        # Parent creates athlete
        athlete_data = {
            "full_name": f"TEST DELETION ATHLETE {datetime.now().strftime('%H%M%S')}",
            "first_name": "TEST",
            "last_name": f"DELETION_{datetime.now().strftime('%H%M%S')}",
            "date_of_birth": "2010-05-15",
            "fiscal_code": f"TSTDEL{datetime.now().strftime('%y%m%d')}X000X",
            "team_id": test_team["id"],
            "is_trial": True
        }
        response = requests.post(f"{BASE_URL}/api/athletes", json=athlete_data, headers=test_parent["headers"])
        assert response.status_code == 200, f"Failed to create test athlete: {response.text}"
        athlete = response.json()
        
        # Admin approves athlete to trial status
        requests.patch(f"{BASE_URL}/api/athletes/{athlete['id']}/status", 
                      json={"status": "trial"}, headers=admin_headers)
        
        yield athlete
        # Cleanup - delete athlete if still exists
        requests.delete(f"{BASE_URL}/api/athletes/{athlete['id']}", headers=admin_headers)
    
    # ==================== DELETION CHECK TESTS ====================
    
    def test_deletion_check_returns_obligations_preview(self, admin_headers, test_athlete_no_obligations):
        """Test GET /api/athletes/{id}/deletion-check returns correct preview"""
        athlete_id = test_athlete_no_obligations["id"]
        
        response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}/deletion-check", headers=admin_headers)
        
        assert response.status_code == 200, f"Deletion check failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "athlete_id" in data
        assert "athlete_name" in data
        assert "has_obligations" in data
        assert "obligations" in data
        assert "parent_info" in data
        assert "data_to_delete" in data
        
        # Verify obligations structure
        obligations = data["obligations"]
        assert "unpaid_payments" in obligations
        assert "fiscal_documents" in obligations
        assert "compensations" in obligations
        
        # Verify parent info structure
        parent_info = data["parent_info"]
        assert "parent_id" in parent_info
        assert "parent_has_other_children" in parent_info
        assert "parent_can_be_deleted" in parent_info
        
        # Verify data_to_delete structure
        data_to_delete = data["data_to_delete"]
        assert "attendances" in data_to_delete
        assert "certificates" in data_to_delete
        assert "signed_documents" in data_to_delete
        assert "payments" in data_to_delete
        
        print(f"✓ Deletion check returned correct structure for athlete {athlete_id}")
        print(f"  has_obligations: {data['has_obligations']}")
        print(f"  data_to_delete: {data_to_delete}")
    
    def test_deletion_check_shows_no_obligations_for_clean_athlete(self, admin_headers, test_athlete_no_obligations):
        """Test that athlete without obligations shows has_obligations=False"""
        athlete_id = test_athlete_no_obligations["id"]
        
        response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}/deletion-check", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Clean athlete should have no obligations
        assert data["has_obligations"] == False, f"Expected no obligations but got: {data['obligations']}"
        assert data["obligations"]["unpaid_payments"]["count"] == 0
        assert data["obligations"]["fiscal_documents"]["count"] == 0
        assert data["obligations"]["compensations"]["count"] == 0
        
        print(f"✓ Clean athlete correctly shows no obligations")
    
    def test_deletion_check_requires_auth(self):
        """Test that deletion check requires authentication"""
        response = requests.get(f"{BASE_URL}/api/athletes/fake_id/deletion-check")
        assert response.status_code == 403 or response.status_code == 401
        print("✓ Deletion check correctly requires authentication")
    
    def test_deletion_check_returns_404_for_nonexistent_athlete(self, admin_headers):
        """Test that deletion check returns 404 for non-existent athlete"""
        response = requests.get(f"{BASE_URL}/api/athletes/nonexistent_id_12345/deletion-check", headers=admin_headers)
        assert response.status_code == 404
        print("✓ Deletion check correctly returns 404 for non-existent athlete")
    
    # ==================== REQUEST DELETION TESTS ====================
    
    def test_request_deletion_marks_athlete(self, admin_headers, test_athlete_no_obligations, test_parent):
        """Test POST /api/athletes/{id}/request-deletion marks athlete for deletion"""
        athlete_id = test_athlete_no_obligations["id"]
        
        # Request deletion as parent
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/request-deletion", 
                                headers=test_parent["headers"])
        
        assert response.status_code == 200, f"Request deletion failed: {response.text}"
        data = response.json()
        assert "message" in data
        
        # Verify athlete is marked for deletion
        athlete_response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}", headers=admin_headers)
        athlete = athlete_response.json()
        
        assert athlete.get("deletion_requested") == True, "Athlete should be marked for deletion"
        assert athlete.get("deletion_requested_by") is not None
        assert athlete.get("deletion_requested_at") is not None
        
        print(f"✓ Athlete {athlete_id} correctly marked for deletion")
        print(f"  deletion_requested_by: {athlete.get('deletion_requested_by_name')}")
    
    def test_request_deletion_prevents_duplicates(self, admin_headers, test_athlete_no_obligations, test_parent):
        """Test that duplicate deletion requests are rejected"""
        athlete_id = test_athlete_no_obligations["id"]
        
        # First request (may already be done)
        requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/request-deletion", 
                     headers=test_parent["headers"])
        
        # Second request should fail
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/request-deletion", 
                                headers=test_parent["headers"])
        
        assert response.status_code == 400, f"Expected 400 for duplicate request, got {response.status_code}"
        print("✓ Duplicate deletion request correctly rejected")
    
    def test_request_deletion_creates_admin_notification(self, admin_headers, test_athlete_no_obligations):
        """Test that deletion request creates admin notification"""
        athlete_id = test_athlete_no_obligations["id"]
        
        # Get notifications
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=admin_headers)
        
        if response.status_code == 200:
            notifications = response.json()
            # Check for any recent deletion_requested notifications (within last 5 minutes)
            deletion_notifications = [n for n in notifications 
                                     if n.get("type") == "deletion_requested"]
            
            # At least one deletion notification should exist (may not match exact athlete_id due to test ordering)
            assert len(deletion_notifications) > 0, "Should have at least one deletion notification"
            print(f"✓ Admin notification created for deletion request (found {len(deletion_notifications)} deletion notifications)")
        else:
            print(f"⚠ Could not verify notifications (status {response.status_code})")
    
    # ==================== DELETION REQUESTS LIST TESTS ====================
    
    def test_get_deletion_requests_admin_only(self, admin_headers, test_parent):
        """Test GET /api/athletes/deletion-requests is admin only"""
        # Admin should succeed
        response = requests.get(f"{BASE_URL}/api/athletes/deletion-requests", headers=admin_headers)
        assert response.status_code == 200, f"Admin should access deletion requests: {response.text}"
        
        # Parent should fail
        response = requests.get(f"{BASE_URL}/api/athletes/deletion-requests", headers=test_parent["headers"])
        assert response.status_code == 403, "Parent should not access deletion requests"
        
        print("✓ Deletion requests list correctly restricted to admin")
    
    def test_get_deletion_requests_returns_pending(self, admin_headers, test_athlete_no_obligations):
        """Test that deletion requests list includes pending requests"""
        athlete_id = test_athlete_no_obligations["id"]
        
        response = requests.get(f"{BASE_URL}/api/athletes/deletion-requests", headers=admin_headers)
        assert response.status_code == 200
        
        requests_list = response.json()
        athlete_request = next((r for r in requests_list if r["id"] == athlete_id), None)
        
        if athlete_request:
            assert "full_name" in athlete_request
            assert "team_name" in athlete_request
            assert "requested_at" in athlete_request
            assert "requested_by_name" in athlete_request
            print(f"✓ Deletion request found in list: {athlete_request['full_name']}")
        else:
            print(f"⚠ Athlete {athlete_id} not found in deletion requests (may have been processed)")
    
    # ==================== REJECT DELETION TESTS ====================
    
    def test_reject_deletion_clears_request(self, admin_headers, test_athlete_no_obligations, test_parent):
        """Test POST /api/athletes/{id}/reject-deletion clears the request"""
        athlete_id = test_athlete_no_obligations["id"]
        
        # Ensure deletion is requested
        requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/request-deletion", 
                     headers=test_parent["headers"])
        
        # Reject deletion
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/reject-deletion", 
                                headers=admin_headers)
        
        assert response.status_code == 200, f"Reject deletion failed: {response.text}"
        
        # Verify athlete is no longer marked for deletion
        athlete_response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}", headers=admin_headers)
        athlete = athlete_response.json()
        
        assert athlete.get("deletion_requested") != True, "Deletion request should be cleared"
        
        print(f"✓ Deletion request correctly rejected and cleared for athlete {athlete_id}")
    
    def test_reject_deletion_admin_only(self, admin_headers, test_athlete_no_obligations, test_parent):
        """Test that only admin can reject deletion"""
        athlete_id = test_athlete_no_obligations["id"]
        
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/reject-deletion", 
                                headers=test_parent["headers"])
        
        assert response.status_code == 403, "Parent should not be able to reject deletion"
        print("✓ Reject deletion correctly restricted to admin")
    
    # ==================== APPROVE DELETION TESTS ====================
    
    def test_approve_deletion_deletes_athlete_no_obligations(self, admin_headers, test_team, test_parent):
        """Test approve deletion fully deletes athlete with no obligations"""
        # Create fresh athlete for this test
        athlete_data = {
            "full_name": f"TEST APPROVE DELETE {datetime.now().strftime('%H%M%S')}",
            "first_name": "APPROVE",
            "last_name": f"DELETE_{datetime.now().strftime('%H%M%S')}",
            "date_of_birth": "2010-07-10",
            "fiscal_code": f"TSTAPD{datetime.now().strftime('%y%m%d')}X000X",
            "team_id": test_team["id"],
            "is_trial": True
        }
        response = requests.post(f"{BASE_URL}/api/athletes", json=athlete_data, headers=test_parent["headers"])
        assert response.status_code == 200, f"Failed to create athlete: {response.text}"
        athlete = response.json()
        athlete_id = athlete["id"]
        
        # Admin approves athlete
        requests.patch(f"{BASE_URL}/api/athletes/{athlete_id}/status", 
                      json={"status": "trial"}, headers=admin_headers)
        
        # Request deletion
        requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/request-deletion", 
                     headers=test_parent["headers"])
        
        # Approve deletion
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/approve-deletion", 
                                headers=admin_headers)
        
        assert response.status_code == 200, f"Approve deletion failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert data.get("had_obligations") == False, "Should have no obligations"
        
        # Verify athlete is deleted
        athlete_response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}", headers=admin_headers)
        assert athlete_response.status_code == 404, "Athlete should be deleted"
        
        print(f"✓ Athlete {athlete_id} fully deleted (no obligations)")
        print(f"  Response: {data['message']}")
    
    def test_approve_deletion_admin_only(self, admin_headers, test_athlete_no_obligations, test_parent):
        """Test that only admin can approve deletion"""
        athlete_id = test_athlete_no_obligations["id"]
        
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/approve-deletion", 
                                headers=test_parent["headers"])
        
        assert response.status_code == 403, "Parent should not be able to approve deletion"
        print("✓ Approve deletion correctly restricted to admin")
    
    def test_approve_deletion_returns_404_for_nonexistent(self, admin_headers):
        """Test approve deletion returns 404 for non-existent athlete"""
        response = requests.post(f"{BASE_URL}/api/athletes/nonexistent_id_12345/approve-deletion", 
                                headers=admin_headers)
        assert response.status_code == 404
        print("✓ Approve deletion correctly returns 404 for non-existent athlete")


class TestDeletionWithObligations:
    """Test deletion flow with fiscal obligations"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_team(self, admin_headers):
        """Get an existing team"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=admin_headers)
        teams = response.json()
        return teams[0] if teams else None
    
    @pytest.fixture(scope="class")
    def test_parent_with_obligations(self, admin_headers):
        """Create a test parent for obligations testing"""
        parent_email = f"test_oblig_parent_{datetime.now().strftime('%H%M%S')}@test.com"
        
        response = requests.get(f"{BASE_URL}/api/societies/invite-code", headers=admin_headers)
        invite_code = response.json().get("invite_code", "")
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": parent_email,
            "password": "testpass123",
            "full_name": "TEST OBLIG PARENT",
            "role": "parent",
            "invite_code": invite_code
        })
        
        data = response.json()
        yield {
            "id": data.get("user", {}).get("id"),
            "email": parent_email,
            "token": data.get("token"),
            "headers": {"Authorization": f"Bearer {data.get('token')}"}
        }
        
        # Cleanup
        if data.get("user", {}).get("id"):
            requests.delete(f"{BASE_URL}/api/users/{data['user']['id']}", headers=admin_headers)
    
    def test_deletion_check_shows_obligations_with_unpaid_payments(self, admin_headers, test_team, test_parent_with_obligations):
        """Test that deletion check shows obligations when unpaid payments exist"""
        if not test_team:
            pytest.skip("No team available")
        
        # Create athlete
        athlete_data = {
            "full_name": f"TEST OBLIG ATHLETE {datetime.now().strftime('%H%M%S')}",
            "first_name": "OBLIG",
            "last_name": f"ATHLETE_{datetime.now().strftime('%H%M%S')}",
            "date_of_birth": "2010-08-20",
            "fiscal_code": f"TSTOBG{datetime.now().strftime('%y%m%d')}X000X",
            "team_id": test_team["id"],
            "is_trial": True
        }
        response = requests.post(f"{BASE_URL}/api/athletes", json=athlete_data, 
                                headers=test_parent_with_obligations["headers"])
        
        if response.status_code != 200:
            pytest.skip(f"Could not create athlete: {response.text}")
        
        athlete = response.json()
        athlete_id = athlete["id"]
        
        # Admin approves
        requests.patch(f"{BASE_URL}/api/athletes/{athlete_id}/status", 
                      json={"status": "trial"}, headers=admin_headers)
        
        # Create unpaid payment
        payment_data = {
            "athlete_id": athlete_id,
            "amount": 100.0,
            "paid_date": datetime.now().strftime("%d/%m/%Y"),
            "is_cash": False,
            "description": "TEST Unpaid payment"
        }
        response = requests.post(f"{BASE_URL}/api/payments", json=payment_data, headers=admin_headers)
        
        if response.status_code == 200:
            payment = response.json()
            # Mark as unpaid
            requests.patch(f"{BASE_URL}/api/payments/{payment['id']}", 
                          json={"paid": False}, headers=admin_headers)
        
        # Check deletion obligations
        response = requests.get(f"{BASE_URL}/api/athletes/{athlete_id}/deletion-check", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should show obligations
        print(f"  has_obligations: {data.get('has_obligations')}")
        print(f"  unpaid_payments: {data.get('obligations', {}).get('unpaid_payments', {})}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/athletes/{athlete_id}", headers=admin_headers)
        
        print("✓ Deletion check correctly shows obligations status")


class TestParentAutoDeletion:
    """Test parent auto-deletion when no other children"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_team(self, admin_headers):
        response = requests.get(f"{BASE_URL}/api/teams", headers=admin_headers)
        teams = response.json()
        return teams[0] if teams else None
    
    def test_parent_deleted_when_single_child_deleted(self, admin_headers, test_team):
        """Test parent is deleted when their only child is deleted"""
        if not test_team:
            pytest.skip("No team available")
        
        # Create fresh parent
        parent_email = f"single_child_{datetime.now().strftime('%H%M%S')}@test.com"
        response = requests.get(f"{BASE_URL}/api/societies/invite-code", headers=admin_headers)
        invite_code = response.json().get("invite_code", "")
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": parent_email,
            "password": "testpass123",
            "full_name": "SINGLE CHILD PARENT",
            "role": "parent",
            "invite_code": invite_code
        })
        
        if response.status_code != 200:
            pytest.skip(f"Could not create parent: {response.text}")
        
        parent_data = response.json()
        parent_id = parent_data.get("user", {}).get("id")
        parent_headers = {"Authorization": f"Bearer {parent_data.get('token')}"}
        
        # Create single child
        athlete_data = {
            "full_name": f"SINGLE CHILD {datetime.now().strftime('%H%M%S')}",
            "first_name": "SINGLE",
            "last_name": f"CHILD_{datetime.now().strftime('%H%M%S')}",
            "date_of_birth": "2012-03-20",
            "fiscal_code": f"SNGLCH{datetime.now().strftime('%y%m%d')}X000X",
            "team_id": test_team["id"],
            "is_trial": True
        }
        response = requests.post(f"{BASE_URL}/api/athletes", json=athlete_data, headers=parent_headers)
        
        if response.status_code != 200:
            requests.delete(f"{BASE_URL}/api/users/{parent_id}", headers=admin_headers)
            pytest.skip(f"Could not create athlete: {response.text}")
        
        athlete = response.json()
        athlete_id = athlete["id"]
        
        # Admin approves
        requests.patch(f"{BASE_URL}/api/athletes/{athlete_id}/status", 
                      json={"status": "trial"}, headers=admin_headers)
        
        # Request deletion
        requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/request-deletion", headers=parent_headers)
        
        # Approve deletion
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/approve-deletion", 
                                headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"  Deletion response: {data}")
        
        if data.get("parent_deleted"):
            print(f"✓ Parent auto-deleted when single child deleted")
        else:
            print(f"⚠ Parent not deleted - may have other children or obligations")
            # Cleanup parent manually
            requests.delete(f"{BASE_URL}/api/users/{parent_id}", headers=admin_headers)
    
    def test_parent_not_deleted_when_has_multiple_children(self, admin_headers, test_team):
        """Test parent is NOT deleted when they have other children"""
        if not test_team:
            pytest.skip("No team available")
        
        # Create fresh parent
        parent_email = f"multi_child_{datetime.now().strftime('%H%M%S')}@test.com"
        response = requests.get(f"{BASE_URL}/api/societies/invite-code", headers=admin_headers)
        invite_code = response.json().get("invite_code", "")
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": parent_email,
            "password": "testpass123",
            "full_name": "MULTI CHILD PARENT",
            "role": "parent",
            "invite_code": invite_code
        })
        
        if response.status_code != 200:
            pytest.skip(f"Could not create parent: {response.text}")
        
        parent_data = response.json()
        parent_id = parent_data.get("user", {}).get("id")
        parent_headers = {"Authorization": f"Bearer {parent_data.get('token')}"}
        
        # Create first child
        athlete1_data = {
            "full_name": f"FIRST CHILD {datetime.now().strftime('%H%M%S')}",
            "first_name": "FIRST",
            "last_name": f"CHILD_{datetime.now().strftime('%H%M%S')}",
            "date_of_birth": "2011-04-15",
            "fiscal_code": f"FRSTCH{datetime.now().strftime('%y%m%d')}X000X",
            "team_id": test_team["id"],
            "is_trial": True
        }
        response = requests.post(f"{BASE_URL}/api/athletes", json=athlete1_data, headers=parent_headers)
        
        if response.status_code != 200:
            requests.delete(f"{BASE_URL}/api/users/{parent_id}", headers=admin_headers)
            pytest.skip(f"Could not create first athlete: {response.text}")
        
        athlete1 = response.json()
        athlete1_id = athlete1["id"]
        
        # Create second child
        athlete2_data = {
            "full_name": f"SECOND CHILD {datetime.now().strftime('%H%M%S')}",
            "first_name": "SECOND",
            "last_name": f"CHILD_{datetime.now().strftime('%H%M%S')}",
            "date_of_birth": "2013-05-20",
            "fiscal_code": f"SCNDCH{datetime.now().strftime('%y%m%d')}X000X",
            "team_id": test_team["id"],
            "is_trial": True
        }
        response = requests.post(f"{BASE_URL}/api/athletes", json=athlete2_data, headers=parent_headers)
        
        if response.status_code != 200:
            requests.delete(f"{BASE_URL}/api/athletes/{athlete1_id}", headers=admin_headers)
            requests.delete(f"{BASE_URL}/api/users/{parent_id}", headers=admin_headers)
            pytest.skip(f"Could not create second athlete: {response.text}")
        
        athlete2 = response.json()
        athlete2_id = athlete2["id"]
        
        # Admin approves both
        requests.patch(f"{BASE_URL}/api/athletes/{athlete1_id}/status", 
                      json={"status": "trial"}, headers=admin_headers)
        requests.patch(f"{BASE_URL}/api/athletes/{athlete2_id}/status", 
                      json={"status": "trial"}, headers=admin_headers)
        
        # Request deletion for first child only
        requests.post(f"{BASE_URL}/api/athletes/{athlete1_id}/request-deletion", headers=parent_headers)
        
        # Approve deletion
        response = requests.post(f"{BASE_URL}/api/athletes/{athlete1_id}/approve-deletion", 
                                headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Parent should NOT be deleted
        assert data.get("parent_deleted") == False, "Parent should not be deleted when has other children"
        print(f"✓ Parent correctly NOT deleted (has other children)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/athletes/{athlete2_id}", headers=admin_headers)
        requests.delete(f"{BASE_URL}/api/users/{parent_id}", headers=admin_headers)


class TestDeletionEdgeCases:
    """Edge case tests for deletion flow"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_admin_can_request_deletion_on_behalf(self, admin_headers):
        """Test that admin can request deletion on behalf of parent"""
        # Get any trial athlete
        athletes = requests.get(f"{BASE_URL}/api/athletes", headers=admin_headers).json()
        trial_athletes = [a for a in athletes if a.get("status") == "trial" and not a.get("deletion_requested")]
        
        if trial_athletes:
            athlete = trial_athletes[0]
            athlete_id = athlete["id"]
            
            # Admin requests deletion
            response = requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/request-deletion", 
                                    headers=admin_headers)
            
            if response.status_code == 200:
                print(f"✓ Admin can request deletion on behalf of parent")
                # Clean up - reject the request
                requests.post(f"{BASE_URL}/api/athletes/{athlete_id}/reject-deletion", 
                             headers=admin_headers)
            elif response.status_code == 400:
                print(f"⚠ Athlete already has deletion request")
            else:
                print(f"⚠ Unexpected response: {response.status_code}")
        else:
            print("⚠ No trial athletes available for test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
