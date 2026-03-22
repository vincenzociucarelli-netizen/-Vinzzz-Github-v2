"""
Test Pre-Season Campaign Feature
Tests all preseason campaign endpoints for sports societies.
Admin creates campaigns, public users submit responses, admin views stats and exports CSV.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', os.environ.get('EXPO_PUBLIC_BACKEND_URL', '')).rstrip('/')
if not BASE_URL:
    BASE_URL = "https://sports-portal-10.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"

# Existing campaign ID from context
EXISTING_CAMPAIGN_ID = "6f3b4944-47b1-4fdf-b0a0-e6b11070ffc3"


class TestPreseasonCampaigns:
    """Test suite for Pre-Season Campaign feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.created_campaign_id = None
        self.created_response_ids = []
        
    def get_admin_token(self):
        """Login as admin and get token"""
        if self.admin_token:
            return self.admin_token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json().get("token")
            return self.admin_token
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        
    def auth_headers(self):
        """Get authorization headers"""
        token = self.get_admin_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # ==================== CAMPAIGN CRUD TESTS ====================
    
    def test_01_create_campaign(self):
        """POST /api/preseason/campaigns - Admin creates a new campaign"""
        headers = self.auth_headers()
        
        # Create campaign with future dates
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "title": "TEST_Campagna Pre-Stagione 2026/2027",
            "season": "2026/2027",
            "open_date": tomorrow,
            "close_date": next_month,
            "description": "Test campaign for automated testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/preseason/campaigns", 
                                     json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain campaign id"
        assert data["title"] == payload["title"], "Title should match"
        assert data["season"] == payload["season"], "Season should match"
        assert data["is_active"] == True, "New campaign should be active"
        assert data["response_count"] == 0, "New campaign should have 0 responses"
        
        # Store for cleanup
        self.__class__.created_campaign_id = data["id"]
        print(f"Created campaign: {data['id']}")
        
    def test_02_list_campaigns(self):
        """GET /api/preseason/campaigns - Admin lists all campaigns"""
        headers = self.auth_headers()
        
        response = self.session.get(f"{BASE_URL}/api/preseason/campaigns", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Should contain at least the existing campaign
        campaign_ids = [c["id"] for c in data]
        assert EXISTING_CAMPAIGN_ID in campaign_ids, f"Existing campaign {EXISTING_CAMPAIGN_ID} should be in list"
        
        # Check campaign structure
        for campaign in data:
            assert "id" in campaign
            assert "title" in campaign
            assert "season" in campaign
            assert "is_active" in campaign
            assert "response_count" in campaign
            
        print(f"Found {len(data)} campaigns")
        
    def test_03_get_campaign_detail(self):
        """GET /api/preseason/campaigns/{id} - Admin gets campaign details"""
        headers = self.auth_headers()
        
        response = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}", 
                                    headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == EXISTING_CAMPAIGN_ID
        assert "title" in data
        assert "season" in data
        assert "response_count" in data
        assert data["response_count"] >= 1, "Existing campaign should have at least 1 response"
        
        print(f"Campaign '{data['title']}' has {data['response_count']} responses")
        
    def test_04_update_campaign_toggle_active(self):
        """PATCH /api/preseason/campaigns/{id} - Admin toggles campaign active status"""
        headers = self.auth_headers()
        
        # First create a test campaign to update
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        create_response = self.session.post(f"{BASE_URL}/api/preseason/campaigns", 
            json={
                "title": "TEST_Campaign for Update Test",
                "season": "2026/2027",
                "open_date": tomorrow,
                "close_date": next_month
            }, headers=headers)
        
        assert create_response.status_code == 200
        campaign_id = create_response.json()["id"]
        
        # Toggle to inactive
        response = self.session.patch(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}",
                                      json={"is_active": False}, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["is_active"] == False, "Campaign should be inactive after update"
        
        # Toggle back to active
        response = self.session.patch(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}",
                                      json={"is_active": True}, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] == True, "Campaign should be active after second update"
        
        # Cleanup - delete the test campaign
        self.session.delete(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}", headers=headers)
        print("Campaign toggle active test passed")
        
    def test_05_update_campaign_fields(self):
        """PATCH /api/preseason/campaigns/{id} - Admin updates campaign fields"""
        headers = self.auth_headers()
        
        # Create test campaign
        create_response = self.session.post(f"{BASE_URL}/api/preseason/campaigns", 
            json={
                "title": "TEST_Original Title",
                "season": "2026/2027"
            }, headers=headers)
        
        assert create_response.status_code == 200
        campaign_id = create_response.json()["id"]
        
        # Update title and description
        response = self.session.patch(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}",
            json={
                "title": "TEST_Updated Title",
                "description": "Updated description"
            }, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_Updated Title"
        assert data["description"] == "Updated description"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}", headers=headers)
        print("Campaign field update test passed")

    # ==================== PUBLIC ENDPOINTS TESTS ====================
    
    def test_06_public_campaign_info(self):
        """GET /api/preseason/public/{id} - Public gets campaign info (no auth)"""
        # No auth headers - public endpoint
        response = self.session.get(f"{BASE_URL}/api/preseason/public/{EXISTING_CAMPAIGN_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == EXISTING_CAMPAIGN_ID
        assert "title" in data
        assert "season" in data
        assert "society_name" in data
        assert "society_logo" in data
        
        # Should NOT expose sensitive fields
        assert "created_by" not in data, "Public endpoint should not expose created_by"
        
        print(f"Public campaign info: {data['title']} - {data['season']}")
        
    def test_07_public_submit_response(self):
        """POST /api/preseason/public/{id}/respond - Public submits form (no auth)"""
        # No auth headers - public endpoint
        payload = {
            "first_name": "TEST_Mario",
            "last_name": "TEST_Rossi",
            "birth_date": "2010-05-15",
            "phone_athlete": "3331234567",
            "phone_parent": "3339876543",
            "already_member": False,
            "previous_club": "ASD Test Club",
            "championships_played": "Under 14",
            "role_played": "Palleggiatore",
            "interest_level": "si",
            "notes": "Test response from automated testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/preseason/public/{EXISTING_CAMPAIGN_ID}/respond",
                                     json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "id" in data
        
        self.__class__.created_response_ids = getattr(self.__class__, 'created_response_ids', [])
        self.__class__.created_response_ids.append(data["id"])
        
        print(f"Public response submitted: {data['id']}")
        
    def test_08_public_submit_thinking_response(self):
        """POST /api/preseason/public/{id}/respond - Submit 'ci_penso' interest level"""
        payload = {
            "first_name": "TEST_Giulia",
            "last_name": "TEST_Bianchi",
            "birth_date": "2011-03-20",
            "phone_parent": "3335551234",
            "already_member": True,
            "interest_level": "ci_penso",
            "notes": "Devo parlare con i genitori"
        }
        
        response = self.session.post(f"{BASE_URL}/api/preseason/public/{EXISTING_CAMPAIGN_ID}/respond",
                                     json=payload)
        
        assert response.status_code == 200
        data = response.json()
        self.__class__.created_response_ids.append(data["id"])
        print(f"'Ci penso' response submitted: {data['id']}")
        
    def test_09_public_submit_no_interest_response(self):
        """POST /api/preseason/public/{id}/respond - Submit 'no' interest level"""
        payload = {
            "first_name": "TEST_Luca",
            "last_name": "TEST_Verdi",
            "birth_date": "2009-08-10",
            "phone_athlete": "3337778899",
            "already_member": False,
            "previous_club": "Altro Club",
            "interest_level": "no",
            "notes": "Mi sono trasferito"
        }
        
        response = self.session.post(f"{BASE_URL}/api/preseason/public/{EXISTING_CAMPAIGN_ID}/respond",
                                     json=payload)
        
        assert response.status_code == 200
        data = response.json()
        self.__class__.created_response_ids.append(data["id"])
        print(f"'No' response submitted: {data['id']}")

    # ==================== AUTHENTICATED RESPONSE TEST ====================
    
    def test_10_authenticated_submit_response(self):
        """POST /api/preseason/campaigns/{id}/respond - Authenticated user submits response"""
        headers = self.auth_headers()
        
        payload = {
            "first_name": "TEST_Admin",
            "last_name": "TEST_User",
            "birth_date": "2008-01-01",
            "phone_athlete": "3330001111",
            "already_member": True,
            "interest_level": "si",
            "notes": "Authenticated response test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}/respond",
                                     json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data
        self.__class__.created_response_ids.append(data["id"])
        print(f"Authenticated response submitted: {data['id']}")

    # ==================== RESPONSES & STATS TESTS ====================
    
    def test_11_get_responses_with_stats(self):
        """GET /api/preseason/campaigns/{id}/responses - Admin sees responses with stats"""
        headers = self.auth_headers()
        
        response = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}/responses",
                                    headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "responses" in data
        assert "stats" in data
        
        # Check stats structure
        stats = data["stats"]
        assert "total" in stats
        assert "interested" in stats
        assert "thinking" in stats
        assert "not_interested" in stats
        assert "existing_members" in stats
        assert "new_athletes" in stats
        
        # Verify stats are integers
        assert isinstance(stats["total"], int)
        assert isinstance(stats["interested"], int)
        assert isinstance(stats["thinking"], int)
        assert isinstance(stats["not_interested"], int)
        
        # Total should equal sum of interest levels
        assert stats["total"] == stats["interested"] + stats["thinking"] + stats["not_interested"]
        
        # Total should equal sum of member types
        assert stats["total"] == stats["existing_members"] + stats["new_athletes"]
        
        print(f"Stats: Total={stats['total']}, Interested={stats['interested']}, Thinking={stats['thinking']}, No={stats['not_interested']}")
        print(f"Members: Existing={stats['existing_members']}, New={stats['new_athletes']}")
        
        # Check response structure
        if data["responses"]:
            resp = data["responses"][0]
            assert "id" in resp
            assert "first_name" in resp
            assert "last_name" in resp
            assert "birth_date" in resp
            assert "interest_level" in resp
            assert "already_member" in resp

    # ==================== CSV EXPORT TEST ====================
    
    def test_12_export_csv(self):
        """GET /api/preseason/campaigns/{id}/export - Admin exports CSV"""
        headers = self.auth_headers()
        
        response = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}/export",
                                    headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "text/csv" in content_type, f"Expected text/csv, got {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp
        assert "preiscrizioni_" in content_disp
        
        # Parse CSV content
        csv_content = response.text
        lines = csv_content.strip().split('\n')
        
        # Check header row (semicolon delimiter)
        header = lines[0]
        assert "Nome" in header
        assert "Cognome" in header
        assert "Data Nascita" in header
        assert "Telefono Atleta" in header
        assert "Telefono Genitore" in header
        assert "Gia Iscritto" in header
        assert "Club Precedente" in header
        assert "Campionati Giocati" in header
        assert "Ruolo" in header
        assert "Interesse" in header
        assert "Note" in header
        assert "Data Risposta" in header
        
        # Should have data rows
        assert len(lines) > 1, "CSV should have at least header + 1 data row"
        
        print(f"CSV export: {len(lines)-1} data rows")
        print(f"Header: {header}")

    # ==================== ACTIVE CAMPAIGN FOR BANNER TEST ====================
    
    def test_13_get_active_campaign_for_banner(self):
        """GET /api/preseason/active - Returns active campaign for parent banner"""
        headers = self.auth_headers()
        
        response = self.session.get(f"{BASE_URL}/api/preseason/active", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "active" in data
        
        if data["active"]:
            assert "campaign" in data
            assert "already_responded" in data
            assert isinstance(data["already_responded"], bool)
            print(f"Active campaign found: {data['campaign'].get('title', 'N/A')}")
            print(f"Already responded: {data['already_responded']}")
        else:
            print("No active campaign for this society")

    # ==================== CLOSED/INACTIVE CAMPAIGN TESTS ====================
    
    def test_14_closed_campaign_returns_410(self):
        """Closed/inactive campaign returns 410 on public endpoints"""
        headers = self.auth_headers()
        
        # Create a campaign and immediately deactivate it
        create_response = self.session.post(f"{BASE_URL}/api/preseason/campaigns", 
            json={
                "title": "TEST_Inactive Campaign",
                "season": "2025/2026"
            }, headers=headers)
        
        assert create_response.status_code == 200
        campaign_id = create_response.json()["id"]
        
        # Deactivate the campaign
        self.session.patch(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}",
                          json={"is_active": False}, headers=headers)
        
        # Try to access public info - should return 410
        response = self.session.get(f"{BASE_URL}/api/preseason/public/{campaign_id}")
        assert response.status_code == 410, f"Expected 410 for inactive campaign, got {response.status_code}"
        
        # Try to submit response - should return 410
        response = self.session.post(f"{BASE_URL}/api/preseason/public/{campaign_id}/respond",
            json={
                "first_name": "Test",
                "last_name": "User",
                "birth_date": "2010-01-01",
                "interest_level": "si"
            })
        assert response.status_code == 410, f"Expected 410 for inactive campaign response, got {response.status_code}"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}", headers=headers)
        print("Inactive campaign 410 test passed")
        
    def test_15_expired_campaign_returns_410(self):
        """Expired campaign (past close_date) returns 410"""
        headers = self.auth_headers()
        
        # Create a campaign with past close date (use 3 days ago to avoid timezone edge cases)
        three_days_ago = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        two_weeks_ago = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
        
        create_response = self.session.post(f"{BASE_URL}/api/preseason/campaigns", 
            json={
                "title": "TEST_Expired Campaign 2",
                "season": "2024/2025",
                "open_date": two_weeks_ago,
                "close_date": three_days_ago
            }, headers=headers)
        
        assert create_response.status_code == 200
        campaign_id = create_response.json()["id"]
        
        # Try to access public info - should return 410 (expired)
        response = self.session.get(f"{BASE_URL}/api/preseason/public/{campaign_id}")
        assert response.status_code == 410, f"Expected 410 for expired campaign, got {response.status_code}: {response.text}"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}", headers=headers)
        print("Expired campaign 410 test passed")

    # ==================== DELETE CAMPAIGN TEST ====================
    
    def test_16_delete_campaign_with_responses(self):
        """DELETE /api/preseason/campaigns/{id} - Deletes campaign and all responses"""
        headers = self.auth_headers()
        
        # Create a campaign
        create_response = self.session.post(f"{BASE_URL}/api/preseason/campaigns", 
            json={
                "title": "TEST_Campaign to Delete",
                "season": "2026/2027"
            }, headers=headers)
        
        assert create_response.status_code == 200
        campaign_id = create_response.json()["id"]
        
        # Add a response
        self.session.post(f"{BASE_URL}/api/preseason/public/{campaign_id}/respond",
            json={
                "first_name": "Delete",
                "last_name": "Test",
                "birth_date": "2010-01-01",
                "interest_level": "si"
            })
        
        # Verify response was added
        responses_before = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}/responses",
                                            headers=headers)
        assert responses_before.json()["stats"]["total"] >= 1
        
        # Delete campaign
        delete_response = self.session.delete(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}",
                                              headers=headers)
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        assert "message" in delete_response.json()
        
        # Verify campaign is gone
        get_response = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}",
                                        headers=headers)
        assert get_response.status_code == 404, "Deleted campaign should return 404"
        
        print("Delete campaign with responses test passed")

    # ==================== RESPONSE COUNT UPDATE TEST ====================
    
    def test_17_response_count_updates(self):
        """Response count updates correctly after submissions"""
        headers = self.auth_headers()
        
        # Create a fresh campaign
        create_response = self.session.post(f"{BASE_URL}/api/preseason/campaigns", 
            json={
                "title": "TEST_Count Test Campaign",
                "season": "2026/2027"
            }, headers=headers)
        
        assert create_response.status_code == 200
        campaign_id = create_response.json()["id"]
        initial_count = create_response.json()["response_count"]
        assert initial_count == 0, "New campaign should have 0 responses"
        
        # Submit 3 responses
        for i in range(3):
            self.session.post(f"{BASE_URL}/api/preseason/public/{campaign_id}/respond",
                json={
                    "first_name": f"Count{i}",
                    "last_name": "Test",
                    "birth_date": "2010-01-01",
                    "interest_level": "si"
                })
        
        # Check count via list endpoint
        list_response = self.session.get(f"{BASE_URL}/api/preseason/campaigns", headers=headers)
        campaigns = list_response.json()
        test_campaign = next((c for c in campaigns if c["id"] == campaign_id), None)
        assert test_campaign is not None
        assert test_campaign["response_count"] == 3, f"Expected 3 responses, got {test_campaign['response_count']}"
        
        # Check count via detail endpoint
        detail_response = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}",
                                           headers=headers)
        assert detail_response.json()["response_count"] == 3
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/preseason/campaigns/{campaign_id}", headers=headers)
        print("Response count update test passed")

    # ==================== AUTHORIZATION TESTS ====================
    
    def test_18_non_admin_cannot_create_campaign(self):
        """Non-admin users cannot create campaigns"""
        # Try without auth
        response = self.session.post(f"{BASE_URL}/api/preseason/campaigns",
            json={
                "title": "Unauthorized Campaign",
                "season": "2026/2027"
            })
        
        # Should fail with 401 (no auth) or 403 (wrong role)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Authorization test passed - non-admin blocked")

    def test_19_non_admin_cannot_view_responses(self):
        """Non-admin users cannot view campaign responses"""
        # Try without auth
        response = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}/responses")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Authorization test passed - responses protected")

    def test_20_non_admin_cannot_export(self):
        """Non-admin users cannot export CSV"""
        # Try without auth
        response = self.session.get(f"{BASE_URL}/api/preseason/campaigns/{EXISTING_CAMPAIGN_ID}/export")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Authorization test passed - export protected")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
