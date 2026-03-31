"""
Test Parent-Athlete Linking Feature
Tests the manual parent-athlete linking with approval workflow:
- POST /api/parent-link/search - search athletes by cognome/nome
- POST /api/parent-link/request - create pending link request
- GET /api/parent-link/requests - get pending requests
- POST /api/parent-link/respond - accept/reject requests
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "Test1234"
SOFIA_EMAIL = "sofia@test.com"
SOFIA_PASSWORD = "Test1234"
MARIO_EMAIL = "mario@test.com"
MARIO_PASSWORD = "Test1234"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def sofia_token():
    """Get Sofia (parent) auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SOFIA_EMAIL,
        "password": SOFIA_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Sofia login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def mario_token():
    """Get Mario (parent) auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": MARIO_EMAIL,
        "password": MARIO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Mario login failed: {response.status_code} - {response.text}")


class TestParentLinkSearch:
    """Tests for POST /api/parent-link/search"""
    
    def test_search_requires_auth(self):
        """Search endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/parent-link/search", json={
            "cognome": "ROSSI"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Search requires authentication")
    
    def test_search_requires_parent_role(self, admin_token):
        """Search endpoint requires parent role"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/search",
            json={"cognome": "ROSSI"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for admin, got {response.status_code}"
        print("PASS: Search requires parent role (admin rejected)")
    
    def test_search_requires_cognome(self, sofia_token):
        """Search requires cognome field"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/search",
            json={"nome": "GIULIA"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Cognome" in response.json().get("detail", "")
        print("PASS: Search requires cognome")
    
    def test_search_by_cognome_returns_results(self, sofia_token):
        """Search by cognome returns matching athletes"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/search",
            json={"cognome": "ROSSI"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "results" in data
        assert "count" in data
        # Should find ROSSI athletes (excluding already linked ones)
        print(f"PASS: Search returned {data['count']} results")
        for r in data["results"]:
            print(f"  - {r.get('last_name')} {r.get('first_name')} - Team: {r.get('team')}")
    
    def test_search_returns_team_and_dob(self, sofia_token):
        """Search results include team and date_of_birth for disambiguation"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/search",
            json={"cognome": "ROSSI"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if data["count"] > 0:
            result = data["results"][0]
            assert "team" in result, "Result should include team"
            assert "date_of_birth" in result, "Result should include date_of_birth"
            assert "id" in result, "Result should include id"
            assert "first_name" in result, "Result should include first_name"
            assert "last_name" in result, "Result should include last_name"
            print(f"PASS: Search result has all required fields: {list(result.keys())}")
        else:
            print("SKIP: No results to verify structure")
    
    def test_search_excludes_already_linked(self, sofia_token):
        """Search excludes athletes already linked to the searching parent"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/search",
            json={"cognome": "ROSSI"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Sofia has ROSSI PAOLA linked, so PAOLA should not appear
        for r in data["results"]:
            # Sofia's athlete should not be in results
            if r.get("first_name") == "PAOLA" and r.get("last_name") == "ROSSI":
                pytest.fail("Sofia's own athlete ROSSI PAOLA should not appear in search results")
        print("PASS: Search excludes already linked athletes")
    
    def test_search_with_nome_filters(self, sofia_token):
        """Search with nome filters results"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/search",
            json={"cognome": "ROSSI", "nome": "GIULIA"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should only return GIULIA or similar
        for r in data["results"]:
            assert "GIULIA" in r.get("first_name", "").upper() or r.get("first_name", "").upper() in "GIULIA", \
                f"Expected GIULIA, got {r.get('first_name')}"
        print(f"PASS: Search with nome filters correctly, found {data['count']} results")


class TestParentLinkRequest:
    """Tests for POST /api/parent-link/request"""
    
    def test_request_requires_auth(self):
        """Request endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/parent-link/request", json={
            "athlete_id": "test123"
        })
        assert response.status_code in [401, 403]
        print("PASS: Request requires authentication")
    
    def test_request_requires_parent_role(self, admin_token):
        """Request endpoint requires parent role"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/request",
            json={"athlete_id": "test123"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403
        print("PASS: Request requires parent role")
    
    def test_request_requires_athlete_id(self, mario_token):
        """Request requires athlete_id"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/request",
            json={},
            headers={"Authorization": f"Bearer {mario_token}"}
        )
        assert response.status_code == 400
        assert "ID atleta" in response.json().get("detail", "")
        print("PASS: Request requires athlete_id")
    
    def test_request_invalid_athlete(self, mario_token):
        """Request with invalid athlete_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/request",
            json={"athlete_id": "nonexistent123"},
            headers={"Authorization": f"Bearer {mario_token}"}
        )
        assert response.status_code == 404
        print("PASS: Request with invalid athlete returns 404")


class TestParentLinkRequests:
    """Tests for GET /api/parent-link/requests"""
    
    def test_requests_requires_auth(self):
        """Requests endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/parent-link/requests")
        assert response.status_code in [401, 403]
        print("PASS: Requests requires authentication")
    
    def test_requests_requires_parent_role(self, admin_token):
        """Requests endpoint requires parent role"""
        response = requests.get(
            f"{BASE_URL}/api/parent-link/requests",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403
        print("PASS: Requests requires parent role")
    
    def test_requests_returns_structure(self, sofia_token):
        """Requests returns to_approve and my_requests arrays"""
        response = requests.get(
            f"{BASE_URL}/api/parent-link/requests",
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "to_approve" in data, "Response should have to_approve"
        assert "my_requests" in data, "Response should have my_requests"
        assert isinstance(data["to_approve"], list)
        assert isinstance(data["my_requests"], list)
        print(f"PASS: Requests returns correct structure - to_approve: {len(data['to_approve'])}, my_requests: {len(data['my_requests'])}")


class TestParentLinkRespond:
    """Tests for POST /api/parent-link/respond"""
    
    def test_respond_requires_auth(self):
        """Respond endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/parent-link/respond", json={
            "request_id": "test123",
            "action": "accept"
        })
        assert response.status_code in [401, 403]
        print("PASS: Respond requires authentication")
    
    def test_respond_requires_parent_role(self, admin_token):
        """Respond endpoint requires parent role"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/respond",
            json={"request_id": "test123", "action": "accept"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403
        print("PASS: Respond requires parent role")
    
    def test_respond_requires_request_id_and_action(self, sofia_token):
        """Respond requires request_id and action"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/respond",
            json={},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 400
        print("PASS: Respond requires request_id and action")
    
    def test_respond_invalid_action(self, sofia_token):
        """Respond with invalid action returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/respond",
            json={"request_id": "test123", "action": "invalid"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 400
        print("PASS: Respond with invalid action returns 400")
    
    def test_respond_nonexistent_request(self, sofia_token):
        """Respond to nonexistent request returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/parent-link/respond",
            json={"request_id": "nonexistent123", "action": "accept"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert response.status_code == 404
        print("PASS: Respond to nonexistent request returns 404")


class TestParentLinkFullFlow:
    """End-to-end test of the parent linking flow"""
    
    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self, sofia_token, mario_token):
        """Setup test data and cleanup after"""
        # Store tokens for use in tests
        self.sofia_token = sofia_token
        self.mario_token = mario_token
        self.created_request_id = None
        self.test_athlete_id = None
        
        yield
        
        # Cleanup: Delete any test requests created
        if self.created_request_id:
            try:
                import pymongo
                client = pymongo.MongoClient("mongodb://localhost:27017")
                db = client["test_database"]
                db.parent_link_requests.delete_one({"id": self.created_request_id})
                # Also cleanup notifications
                db.notifications.delete_many({"data.request_id": self.created_request_id})
                print(f"Cleanup: Deleted test request {self.created_request_id}")
            except Exception as e:
                print(f"Cleanup error: {e}")
    
    def test_full_link_flow(self, sofia_token, mario_token):
        """Test complete flow: search -> request -> approve"""
        # Step 1: Mario searches for an athlete to link
        # First, find an athlete that Sofia owns (ROSSI PAOLA)
        import pymongo
        client = pymongo.MongoClient("mongodb://localhost:27017")
        db = client["test_database"]
        
        # Get Sofia's user ID
        sofia_user = db.users.find_one({"email": SOFIA_EMAIL})
        if not sofia_user:
            pytest.skip("Sofia user not found")
        sofia_id = sofia_user["id"]
        
        # Find an athlete owned by Sofia that Mario can request to link
        sofia_athlete = db.athletes.find_one({
            "parent_id": sofia_id,
            "second_parent_id": None  # Not already linked to second parent
        })
        
        if not sofia_athlete:
            pytest.skip("No suitable athlete found for Sofia to test linking")
        
        self.test_athlete_id = sofia_athlete["id"]
        athlete_last_name = sofia_athlete.get("last_name", "")
        athlete_first_name = sofia_athlete.get("first_name", "")
        print(f"Testing with athlete: {athlete_last_name} {athlete_first_name} (ID: {self.test_athlete_id})")
        
        # Step 2: Mario searches for this athlete
        search_response = requests.post(
            f"{BASE_URL}/api/parent-link/search",
            json={"cognome": athlete_last_name},
            headers={"Authorization": f"Bearer {mario_token}"}
        )
        assert search_response.status_code == 200, f"Search failed: {search_response.text}"
        search_data = search_response.json()
        
        # Find the specific athlete in results
        found_athlete = None
        for r in search_data["results"]:
            if r["id"] == self.test_athlete_id:
                found_athlete = r
                break
        
        assert found_athlete is not None, f"Athlete {athlete_last_name} {athlete_first_name} not found in search results"
        print(f"PASS: Mario found athlete in search: {found_athlete}")
        
        # Step 3: Mario sends link request
        request_response = requests.post(
            f"{BASE_URL}/api/parent-link/request",
            json={"athlete_id": self.test_athlete_id},
            headers={"Authorization": f"Bearer {mario_token}"}
        )
        assert request_response.status_code == 200, f"Request failed: {request_response.text}"
        request_data = request_response.json()
        assert request_data.get("success") == True
        assert "request_id" in request_data
        self.created_request_id = request_data["request_id"]
        print(f"PASS: Mario sent link request: {request_data['message']}")
        
        # Step 4: Verify notification was created for Sofia
        notification = db.notifications.find_one({
            "user_id": sofia_id,
            "type": "parent_link_request",
            "data.request_id": self.created_request_id
        })
        assert notification is not None, "Notification not created for primary parent"
        print(f"PASS: Notification created for Sofia: {notification['title']}")
        
        # Step 5: Sofia checks pending requests
        requests_response = requests.get(
            f"{BASE_URL}/api/parent-link/requests",
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert requests_response.status_code == 200
        requests_data = requests_response.json()
        
        # Find the request in to_approve
        found_request = None
        for r in requests_data["to_approve"]:
            if r["id"] == self.created_request_id:
                found_request = r
                break
        
        assert found_request is not None, "Request not found in Sofia's to_approve list"
        assert found_request["status"] == "pending"
        print(f"PASS: Sofia sees pending request from {found_request['requester_name']}")
        
        # Step 6: Sofia accepts the request
        respond_response = requests.post(
            f"{BASE_URL}/api/parent-link/respond",
            json={"request_id": self.created_request_id, "action": "accept"},
            headers={"Authorization": f"Bearer {sofia_token}"}
        )
        assert respond_response.status_code == 200, f"Respond failed: {respond_response.text}"
        respond_data = respond_response.json()
        assert respond_data.get("success") == True
        print(f"PASS: Sofia accepted request: {respond_data['message']}")
        
        # Step 7: Verify athlete now has second_parent_id set
        updated_athlete = db.athletes.find_one({"id": self.test_athlete_id})
        mario_user = db.users.find_one({"email": MARIO_EMAIL})
        assert updated_athlete.get("second_parent_id") == mario_user["id"], \
            f"second_parent_id not set correctly. Expected {mario_user['id']}, got {updated_athlete.get('second_parent_id')}"
        print(f"PASS: Athlete second_parent_id set to Mario's ID")
        
        # Step 8: Verify notification was sent to Mario
        mario_notification = db.notifications.find_one({
            "user_id": mario_user["id"],
            "type": "parent_link_accepted"
        })
        assert mario_notification is not None, "Acceptance notification not sent to Mario"
        print(f"PASS: Mario received acceptance notification: {mario_notification['title']}")
        
        # Cleanup: Remove second_parent_id from athlete
        db.athletes.update_one(
            {"id": self.test_athlete_id},
            {"$unset": {"second_parent_id": "", "second_parent_email": ""}}
        )
        print("Cleanup: Removed second_parent_id from athlete")


class TestParentLinkReject:
    """Test rejection flow"""
    
    def test_reject_flow(self, sofia_token, mario_token):
        """Test that rejection works correctly"""
        import pymongo
        client = pymongo.MongoClient("mongodb://localhost:27017")
        db = client["test_database"]
        
        # Get Sofia's user ID
        sofia_user = db.users.find_one({"email": SOFIA_EMAIL})
        mario_user = db.users.find_one({"email": MARIO_EMAIL})
        if not sofia_user or not mario_user:
            pytest.skip("Test users not found")
        
        # Find an athlete owned by Sofia
        sofia_athlete = db.athletes.find_one({
            "parent_id": sofia_user["id"],
            "second_parent_id": None
        })
        
        if not sofia_athlete:
            pytest.skip("No suitable athlete found")
        
        athlete_id = sofia_athlete["id"]
        
        # Mario sends request
        request_response = requests.post(
            f"{BASE_URL}/api/parent-link/request",
            json={"athlete_id": athlete_id},
            headers={"Authorization": f"Bearer {mario_token}"}
        )
        
        if request_response.status_code != 200:
            pytest.skip(f"Could not create request: {request_response.text}")
        
        request_id = request_response.json()["request_id"]
        
        try:
            # Sofia rejects
            reject_response = requests.post(
                f"{BASE_URL}/api/parent-link/respond",
                json={"request_id": request_id, "action": "reject"},
                headers={"Authorization": f"Bearer {sofia_token}"}
            )
            assert reject_response.status_code == 200
            assert reject_response.json().get("success") == True
            print("PASS: Sofia rejected request successfully")
            
            # Verify request status is rejected
            updated_request = db.parent_link_requests.find_one({"id": request_id})
            assert updated_request["status"] == "rejected"
            print("PASS: Request status updated to rejected")
            
            # Verify rejection notification sent to Mario
            rejection_notification = db.notifications.find_one({
                "user_id": mario_user["id"],
                "type": "parent_link_rejected"
            })
            assert rejection_notification is not None
            print("PASS: Mario received rejection notification")
            
        finally:
            # Cleanup
            db.parent_link_requests.delete_one({"id": request_id})
            db.notifications.delete_many({"data.request_id": request_id})
            db.notifications.delete_many({"user_id": mario_user["id"], "type": "parent_link_rejected"})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
