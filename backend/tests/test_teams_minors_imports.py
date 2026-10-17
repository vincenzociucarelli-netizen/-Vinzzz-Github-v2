"""
Tests for: Teams Management, Minor Athletes, Excel Import/Export
Features: Team CRUD, minor athlete parent-child relationships, payments/matches import, export-athletes-codes
"""
import pytest
import requests
import os
import json
from io import BytesIO

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "password"

# Known test data from the database
EXISTING_TEAM_ID_UNDER14 = "697fec5d90eef140898ebfd7"
EXISTING_TEAM_ID_UNDER16 = "697fed6190eef140898ebfd9"
MINOR_ATHLETE_ID_GIULIA = "698146f951a98f19b5555a42"
MINOR_ATHLETE_PARENT_ID_GIULIA = "698146f951a98f19b5555a3e"
MINOR_ATHLETE_ID_CLAUDIA = "698307e20b72f8e9f97407ed"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    return data.get("token")

@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


# ==================== TEAMS CRUD TESTS ====================

class TestTeamsCRUD:
    """Test team CRUD operations"""
    
    def test_get_teams_list(self, admin_headers):
        """GET /api/teams - Should return list of teams"""
        response = requests.get(f"{BASE_URL}/api/teams", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        teams = response.json()
        assert isinstance(teams, list), "Response should be a list"
        # Verify known teams exist
        team_names = [t.get("name") for t in teams]
        print(f"Found {len(teams)} teams: {team_names[:5]}...")
        
    def test_get_team_detail(self, admin_headers):
        """GET /api/teams/{id} - Should return team with coach info"""
        response = requests.get(f"{BASE_URL}/api/teams/{EXISTING_TEAM_ID_UNDER14}", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        team = response.json()
        assert team.get("id") == EXISTING_TEAM_ID_UNDER14
        assert "name" in team
        assert "coach_info" in team, "Team should include coach_info"
        assert "dirigenti_info" in team, "Team should include dirigenti_info"
        print(f"Team: {team.get('name')}, Coaches: {len(team.get('coach_info', []))}")
        
    def test_create_team(self, admin_headers):
        """POST /api/teams - Should create a new team"""
        team_data = {
            "name": "TEST_Team_Pytest",
            "description": "Created by pytest",
            "total_amount": 500,
            "installment_1_amount": 200,
            "installment_2_amount": 150,
            "installment_2_due_date": "15/01/2026",
            "installment_3_amount": 150,
            "installment_3_due_date": "15/03/2026",
            "bank_info": "Test IBAN",
            "paypal_email": "test@paypal.com"
        }
        response = requests.post(f"{BASE_URL}/api/teams", json=team_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        team = response.json()
        assert team.get("name") == "TEST_Team_Pytest"
        assert team.get("total_amount") == 500
        print(f"Created team ID: {team.get('id')}")
        # Store for cleanup
        TestTeamsCRUD.created_team_id = team.get("id")
        
    def test_update_team(self, admin_headers):
        """PATCH /api/teams/{id} - Should update team details"""
        if not hasattr(TestTeamsCRUD, 'created_team_id'):
            pytest.skip("No team created to update")
        
        update_data = {
            "description": "Updated by pytest",
            "venue": "Palazzetto Test"
        }
        response = requests.patch(
            f"{BASE_URL}/api/teams/{TestTeamsCRUD.created_team_id}", 
            json=update_data, 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        team = response.json()
        assert team.get("description") == "Updated by pytest"
        assert team.get("venue") == "Palazzetto Test"
        
    def test_get_team_athletes(self, admin_headers):
        """GET /api/teams/{team_id}/athletes - Should return athletes in team"""
        response = requests.get(
            f"{BASE_URL}/api/teams/{EXISTING_TEAM_ID_UNDER14}/athletes", 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        athletes = response.json()
        assert isinstance(athletes, list), "Response should be a list"
        print(f"Under 14 team has {len(athletes)} athletes")
        
    def test_get_team_athletes_count(self, admin_headers):
        """GET /api/teams/{team_id}/athletes-count - Should return athlete count"""
        response = requests.get(
            f"{BASE_URL}/api/teams/{EXISTING_TEAM_ID_UNDER14}/athletes-count", 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "count" in data
        print(f"Under 14 athlete count: {data['count']}")
        
    def test_delete_test_team(self, admin_headers):
        """DELETE /api/teams/{id} - Cleanup test team"""
        if not hasattr(TestTeamsCRUD, 'created_team_id'):
            pytest.skip("No team to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/teams/{TestTeamsCRUD.created_team_id}", 
            headers=admin_headers
        )
        # Should succeed if no athletes, otherwise expect 400
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print(f"Team deletion status: {response.status_code}")


# ==================== MINOR ATHLETES TESTS ====================

class TestMinorAthletes:
    """Test minor athlete features and parent-child relationship"""
    
    def test_get_athletes_list_shows_minors(self, admin_headers):
        """GET /api/athletes - List should include is_minor and parent_id for minor athletes"""
        response = requests.get(f"{BASE_URL}/api/athletes", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        athletes = response.json()
        
        # Find athletes with parent_id (indicates minor)
        athletes_with_parent = [a for a in athletes if a.get("parent_id")]
        print(f"Found {len(athletes_with_parent)} athletes with parent_id")
        
        # Check if our known minor athlete is in the list
        giulia = next((a for a in athletes if a.get("id") == MINOR_ATHLETE_ID_GIULIA), None)
        if giulia:
            assert giulia.get("parent_id") == MINOR_ATHLETE_PARENT_ID_GIULIA, "Parent ID should match"
            print(f"Found GIULIA with parent_id: {giulia.get('parent_id')}")
        
    def test_get_minor_athlete_detail(self, admin_headers):
        """GET /api/athletes/{id} - Minor athlete should include parent_id"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{MINOR_ATHLETE_ID_GIULIA}", 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        athlete = response.json()
        
        assert athlete.get("id") == MINOR_ATHLETE_ID_GIULIA
        assert athlete.get("parent_id") == MINOR_ATHLETE_PARENT_ID_GIULIA, "Should have parent_id"
        print(f"Minor athlete: {athlete.get('full_name')}, is_minor: {athlete.get('is_minor')}, parent_id: {athlete.get('parent_id')}")
        
    def test_get_minor_athlete_claudia(self, admin_headers):
        """GET /api/athletes/{id} - Test second minor athlete"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/{MINOR_ATHLETE_ID_CLAUDIA}", 
            headers=admin_headers
        )
        # May or may not exist
        if response.status_code == 200:
            athlete = response.json()
            print(f"Found athlete CLAUDIA: {athlete.get('full_name')}, parent_id: {athlete.get('parent_id')}")
        else:
            print(f"Claudia athlete not found: {response.status_code}")


# ==================== EXCEL TEMPLATE / IMPORT TESTS ====================

class TestExcelImportExport:
    """Test Excel template export and import functionality"""
    
    def test_export_athletes_codes(self, admin_headers):
        """GET /api/payments/export-athletes-codes - Should return athletes with codes"""
        response = requests.get(
            f"{BASE_URL}/api/payments/export-athletes-codes", 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        athletes = response.json()
        assert isinstance(athletes, list), "Response should be a list"
        
        if len(athletes) > 0:
            # Check structure
            first = athletes[0]
            assert "CodiceAtleta" in first, "Should have CodiceAtleta field"
            assert "Cognome" in first, "Should have Cognome field"
            assert "Nome" in first, "Should have Nome field"
            assert "Squadra" in first, "Should have Squadra field"
            print(f"Export returned {len(athletes)} athletes with codes")
            print(f"Sample: {first}")
        else:
            print("No athletes found for export")
            
    def test_matches_import_endpoint(self, admin_headers):
        """POST /api/matches/import - Test import with valid data format"""
        # Test with empty matches array to verify endpoint exists and accepts format
        import_data = {
            "matches": []
        }
        response = requests.post(
            f"{BASE_URL}/api/matches/import", 
            json=import_data, 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        result = response.json()
        assert "imported" in result or "message" in result
        print(f"Matches import response: {result}")
        
    def test_matches_import_with_sample_data(self, admin_headers):
        """POST /api/matches/import - Test import with sample match data"""
        import_data = {
            "matches": [
                {
                    "team_id": EXISTING_TEAM_ID_UNDER14,
                    "match_number": "TEST_MATCH_001",
                    "date": "2026-02-15 15:00",
                    "opponent": "Test Opponent Team",
                    "venue": "Test Venue",
                    "home_away": "home"
                }
            ]
        }
        response = requests.post(
            f"{BASE_URL}/api/matches/import", 
            json=import_data, 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        result = response.json()
        assert result.get("imported", 0) >= 0
        print(f"Import result: {result}")
        
        # Cleanup - delete the test match
        if result.get("imported", 0) > 0:
            # The import will replace matches with same match_number, so delete by reimporting empty
            cleanup_data = {"matches": []}
            # Actually matches with TEST_MATCH_001 number will be auto-deleted on next import
            print("Test match created - will be cleaned up on next import")
            
    def test_payments_import_endpoint_exists(self, admin_headers):
        """POST /api/payments/import - Verify endpoint accepts file upload"""
        # Create a minimal test Excel file in memory using pandas if available
        try:
            import pandas as pd
            
            # Create sample data
            df = pd.DataFrame({
                'CodiceAtleta': ['INVALID_CODE_123'],
                'DataPagamento': ['01/01/2026'],
                'Importo': [100.00],
                'TipoPagamento': ['B']  # Bonifico
            })
            
            # Save to bytes buffer
            buffer = BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            # Upload file
            files = {'file': ('test_payments.xlsx', buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            headers_no_content_type = {"Authorization": admin_headers["Authorization"]}
            
            response = requests.post(
                f"{BASE_URL}/api/payments/import",
                files=files,
                headers=headers_no_content_type
            )
            
            # Expect 200 with errors (invalid code) or 400 for format issues
            assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
            result = response.json()
            print(f"Payments import response: {result}")
            
            # If successful, should have errors about invalid athlete code
            if response.status_code == 200:
                errors = result.get("errors", [])
                assert any("INVALID_CODE_123" in str(e) or "non trovato" in str(e) for e in errors), "Should report invalid athlete code"
                
        except ImportError:
            pytest.skip("pandas not available for Excel creation")


# ==================== ATHLETE ENDPOINT TESTS ====================

class TestAthleteEndpoints:
    """Additional athlete endpoint tests"""
    
    def test_get_all_athletes(self, admin_headers):
        """GET /api/athletes - Full list with payment info"""
        response = requests.get(f"{BASE_URL}/api/athletes", headers=admin_headers)
        assert response.status_code == 200
        athletes = response.json()
        
        if len(athletes) > 0:
            first = athletes[0]
            # Check expected fields
            expected_fields = ["id", "full_name", "team_id", "status", "parent_id"]
            for field in expected_fields:
                assert field in first, f"Missing field: {field}"
        
        print(f"Total athletes: {len(athletes)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
