"""
Test Federation Calendar Import Endpoints
Tests the FIPAV and FIP federation scraping/import functionality
"""

import pytest
import requests
import os
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://deletion-workflow-2.preview.emergentagent.com')
if not BASE_URL.startswith('http'):
    BASE_URL = f"https://{BASE_URL}"
BASE_URL = BASE_URL.rstrip('/')

# Test credentials
ADMIN_EMAIL = "test.admin@test.com"
ADMIN_PASSWORD = "Admin123!"

class TestFederationPublicEndpoints:
    """Test public federation endpoints (no auth required)"""
    
    def test_get_regions_fipav(self):
        """GET /api/federation/regions - returns FIPAV regions"""
        response = requests.get(f"{BASE_URL}/api/federation/regions", params={"federation": "fipav"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of regions
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check Umbria is in list (required for this test)
        region_ids = [r["id"] for r in data]
        assert "umbria" in region_ids
        
        # Verify structure
        for region in data:
            assert "id" in region
            assert "name" in region
            assert isinstance(region["id"], str)
            assert isinstance(region["name"], str)
    
    def test_get_regions_fip(self):
        """GET /api/federation/regions - returns FIP regions (subset)"""
        response = requests.get(f"{BASE_URL}/api/federation/regions", params={"federation": "fip"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of regions
        assert isinstance(data, list)
        # FIP has fewer regions supported
        region_ids = [r["id"] for r in data]
        assert "umbria" in region_ids
    
    def test_get_seasons_fipav_umbria(self):
        """GET /api/federation/seasons - returns seasons from FIPAV Umbria"""
        response = requests.get(
            f"{BASE_URL}/api/federation/seasons",
            params={"federation": "fipav", "region": "umbria"},
            timeout=30  # Web scraping can be slow
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of seasons
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one season from FIPAV"
        
        # Verify structure
        for season in data:
            assert "id" in season
            assert "name" in season
            assert "Stagione" in season["name"] or "Sportiva" in season["name"]
    
    def test_get_championships_fipav_umbria(self):
        """GET /api/federation/championships - returns championships"""
        response = requests.get(
            f"{BASE_URL}/api/federation/championships",
            params={"federation": "fipav", "region": "umbria"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of championships
        assert isinstance(data, list)
        assert len(data) > 0, "Expected championships from FIPAV Umbria"
        
        # Verify structure
        for champ in data:
            assert "id" in champ
            assert "name" in champ
    
    def test_get_championships_with_season(self):
        """GET /api/federation/championships - with season filter"""
        # First get seasons
        seasons_response = requests.get(
            f"{BASE_URL}/api/federation/seasons",
            params={"federation": "fipav", "region": "umbria"},
            timeout=30
        )
        assert seasons_response.status_code == 200
        seasons = seasons_response.json()
        
        if seasons:
            season_id = seasons[0]["id"]
            
            response = requests.get(
                f"{BASE_URL}/api/federation/championships",
                params={"federation": "fipav", "region": "umbria", "season_id": season_id},
                timeout=30
            )
            
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_get_societies_fipav_umbria(self):
        """GET /api/federation/societies - returns societies/teams"""
        response = requests.get(
            f"{BASE_URL}/api/federation/societies",
            params={"federation": "fipav", "region": "umbria"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of societies
        assert isinstance(data, list)
        assert len(data) > 0, "Expected societies from FIPAV Umbria"
        
        # Verify structure
        for society in data:
            assert "id" in society
            assert "name" in society
        
        # Check for Pallavolo Perugia (expected in list)
        society_names = [s["name"].lower() for s in data]
        has_perugia = any("perugia" in name for name in society_names)
        assert has_perugia, "Expected Pallavolo Perugia to be in societies list"


class TestFederationAuthenticatedEndpoints:
    """Test authenticated federation endpoints (admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin to get token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Cannot login as admin: {login_response.text}")
        
        self.token = login_response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_preview_requires_admin_auth(self):
        """POST /api/federation/preview - requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/federation/preview",
            json={"federation": "fipav", "region": "umbria"}
        )
        
        assert response.status_code == 403 or response.status_code == 401
    
    def test_preview_matches_fipav(self):
        """POST /api/federation/preview - preview matches for FIPAV society"""
        response = requests.post(
            f"{BASE_URL}/api/federation/preview",
            headers=self.headers,
            json={
                "federation": "fipav",
                "region": "umbria",
                "society_name": "PALLAVOLO PERUGIA",
                "federation_society_id": "3477",  # Pallavolo Perugia ID
                "season_id": "2173"  # 2024/2025 season
            },
            timeout=60  # Web scraping can be slow
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "matches" in data
        assert "count" in data
        assert isinstance(data["matches"], list)
        assert isinstance(data["count"], int)
        
        # If matches found, verify structure
        if data["matches"]:
            match = data["matches"][0]
            assert "match_number" in match
            assert "date" in match
            assert "home_team" in match
            assert "away_team" in match
            # result and championship are optional
            
            # Verify at least one match has PERUGIA in team name
            has_perugia_match = any(
                "perugia" in m.get("home_team", "").lower() or 
                "perugia" in m.get("away_team", "").lower()
                for m in data["matches"]
            )
            assert has_perugia_match, "Expected matches with Perugia team"
    
    def test_import_requires_admin_auth(self):
        """POST /api/federation/import - requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/federation/import",
            json={"federation": "fipav", "region": "umbria", "team_mappings": []}
        )
        
        assert response.status_code == 403 or response.status_code == 401
    
    def test_import_matches_fipav(self):
        """POST /api/federation/import - import matches (requires team mappings)"""
        # First, we need to get local teams
        teams_response = requests.get(
            f"{BASE_URL}/api/teams",
            headers=self.headers
        )
        
        if teams_response.status_code != 200:
            pytest.skip("Cannot get local teams")
        
        teams = teams_response.json()
        
        if not teams:
            pytest.skip("No local teams available for mapping")
        
        # Use first team for mapping
        local_team_id = teams[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/federation/import",
            headers=self.headers,
            json={
                "federation": "fipav",
                "region": "umbria",
                "society_name": "PALLAVOLO PERUGIA",
                "federation_society_id": "3477",
                "season_id": "2173",
                "team_mappings": [
                    {
                        "federation_team_name": "PALLAVOLO PERUGIA",
                        "local_team_id": local_team_id
                    }
                ]
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "imported" in data
        assert "skipped" in data
        assert isinstance(data["imported"], int)
        assert isinstance(data["skipped"], int)
    
    def test_get_federation_config(self):
        """GET /api/federation/config - get saved configuration"""
        response = requests.get(
            f"{BASE_URL}/api/federation/config",
            headers=self.headers
        )
        
        # Can be 200 (config exists) or 404 (no config yet)
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            # If config exists, verify structure
            if data:
                assert "federation" in data or data == {}


class TestFederationErrorHandling:
    """Test error handling for federation endpoints"""
    
    def test_invalid_federation(self):
        """GET /api/federation/regions - with invalid federation"""
        response = requests.get(
            f"{BASE_URL}/api/federation/regions",
            params={"federation": "invalid_federation"}
        )
        
        assert response.status_code == 200
        # Should return empty list for unknown federation
        data = response.json()
        assert data == []
    
    def test_invalid_region(self):
        """GET /api/federation/seasons - with invalid region"""
        response = requests.get(
            f"{BASE_URL}/api/federation/seasons",
            params={"federation": "fipav", "region": "invalid_region"},
            timeout=30
        )
        
        # Should either return 200 with empty list or 500/520 with error
        # 520 is Cloudflare error that can occur when external federation site unavailable
        assert response.status_code in [200, 500, 520]


# Run tests when executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
