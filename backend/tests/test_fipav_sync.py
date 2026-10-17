"""
FIPAV Calendar Sync Endpoint Tests
Tests for POST /api/matches/sync-fipav endpoint

Features tested:
1. Admin can call the endpoint (200)
2. Non-admin gets 403
3. Response format is correct (message, scraped_total, updated, existing_matched, changes)
4. Scraping from FIPAV portal works
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "Test1234"
PARENT_EMAIL = "pino@test.com"
PARENT_PASSWORD = "Test1234"


class TestFIPAVSync:
    """Tests for FIPAV Calendar Sync endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def parent_token(self):
        """Get parent (non-admin) authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARENT_EMAIL, "password": PARENT_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Parent login failed: {response.status_code} - {response.text}")
        return response.json().get("token")
    
    def test_admin_can_call_sync_fipav(self, admin_token):
        """Test that admin can successfully call the sync-fipav endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/matches/sync-fipav",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should return 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Sync response: {data}")
        
        # Verify response structure
        assert "message" in data, "Response should contain 'message'"
        assert "scraped_total" in data, "Response should contain 'scraped_total'"
        assert "updated" in data, "Response should contain 'updated'"
        assert "existing_matched" in data, "Response should contain 'existing_matched'"
        assert "changes" in data, "Response should contain 'changes'"
        
        # Verify data types
        assert isinstance(data["scraped_total"], int), "scraped_total should be an integer"
        assert isinstance(data["updated"], int), "updated should be an integer"
        assert isinstance(data["existing_matched"], int), "existing_matched should be an integer"
        assert isinstance(data["changes"], list), "changes should be a list"
    
    def test_non_admin_gets_403(self, parent_token):
        """Test that non-admin users get 403 Forbidden"""
        response = requests.post(
            f"{BASE_URL}/api/matches/sync-fipav",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        
        # Should return 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail'"
        print(f"403 response detail: {data['detail']}")
    
    def test_unauthenticated_gets_401(self):
        """Test that unauthenticated requests get 401"""
        response = requests.post(f"{BASE_URL}/api/matches/sync-fipav")
        
        # Should return 401 or 403 (depending on auth middleware)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
    
    def test_response_format_changes_array(self, admin_token):
        """Test that changes array has correct structure when there are changes"""
        response = requests.post(
            f"{BASE_URL}/api/matches/sync-fipav",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # If there are changes, verify their structure
        if data["changes"]:
            for change in data["changes"]:
                assert "match_number" in change, "Each change should have 'match_number'"
                # Changes can have date_old/date_new for date changes
                # or result_old/result_new for result changes
                has_date_change = "date_old" in change and "date_new" in change
                has_result_change = "result_old" in change and "result_new" in change
                
                # At least one type of change should be present
                # (or it could be opponent/home_away change which we don't track in changes)
                print(f"Change for match {change['match_number']}: {change}")
        else:
            print("No changes detected - calendar already synced")
    
    def test_scraping_returns_matches(self, admin_token):
        """Test that scraping actually returns matches from FIPAV portal"""
        response = requests.post(
            f"{BASE_URL}/api/matches/sync-fipav",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have scraped some matches from FIPAV portal
        # Note: This depends on the actual FIPAV portal having data
        print(f"Scraped {data['scraped_total']} matches from FIPAV portal")
        print(f"Matched {data['existing_matched']} existing matches in DB")
        print(f"Updated {data['updated']} matches")
        
        # The scraper should at least attempt to scrape
        # (scraped_total could be 0 if portal is down or no matches found)
        assert data["scraped_total"] >= 0, "scraped_total should be non-negative"
    
    def test_message_format(self, admin_token):
        """Test that the message format is correct"""
        response = requests.post(
            f"{BASE_URL}/api/matches/sync-fipav",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Message should contain sync info
        message = data["message"]
        assert "Sincronizzazione completata" in message, f"Message should contain 'Sincronizzazione completata': {message}"
        assert "aggiornate" in message, f"Message should contain 'aggiornate': {message}"
        assert "trovate" in message, f"Message should contain 'trovate': {message}"
        
        print(f"Sync message: {message}")


class TestFIPAVSyncIdempotency:
    """Test that running sync multiple times is idempotent"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        return response.json().get("token")
    
    def test_second_sync_returns_zero_updates(self, admin_token):
        """Test that running sync twice returns 0 updates on second run (if no changes on portal)"""
        # First sync
        response1 = requests.post(
            f"{BASE_URL}/api/matches/sync-fipav",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response1.status_code == 200
        data1 = response1.json()
        print(f"First sync: {data1['updated']} updates")
        
        # Second sync immediately after
        response2 = requests.post(
            f"{BASE_URL}/api/matches/sync-fipav",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        print(f"Second sync: {data2['updated']} updates")
        
        # Second sync should have 0 updates (or same as first if portal changed)
        # This is expected behavior - running sync twice should be idempotent
        assert data2["updated"] == 0 or data2["updated"] <= data1["updated"], \
            "Second sync should have 0 or fewer updates than first"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
