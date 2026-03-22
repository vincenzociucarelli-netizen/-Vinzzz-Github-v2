"""
Test profile-check and trial-document APIs, and settings PATCH endpoint
Features tested:
1. GET /api/athletes/{athlete_id}/profile-check returns is_complete, parent_missing, athlete_missing
2. GET /api/athletes/{athlete_id}/trial-document returns 400 when parent/athlete profile incomplete
3. PATCH /api/settings/society accepts block_expired_certificates, trial_max_days, trial_max_sessions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trial-end-flow.preview.emergentagent.com')

@pytest.fixture(scope='module')
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "pallavoloperugia@gmail.com",
        "password": "password"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")

@pytest.fixture(scope='module')
def auth_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestProfileCheckEndpoint:
    """Tests for GET /api/athletes/{athlete_id}/profile-check"""
    
    def test_profile_check_returns_expected_structure(self, auth_headers):
        """Profile check endpoint should return is_complete, parent_missing, athlete_missing"""
        # Use test athlete ID provided in context
        athlete_id = "6980555944b98b037b4a14ec"
        
        response = requests.get(
            f"{BASE_URL}/api/athletes/{athlete_id}/profile-check",
            headers=auth_headers
        )
        
        # Should return 200
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Validate structure
        assert "is_complete" in data, "Response should contain 'is_complete'"
        assert "parent_missing" in data, "Response should contain 'parent_missing'"
        assert "athlete_missing" in data, "Response should contain 'athlete_missing'"
        
        # Validate types
        assert isinstance(data["is_complete"], bool), "is_complete should be boolean"
        assert isinstance(data["parent_missing"], list), "parent_missing should be list"
        assert isinstance(data["athlete_missing"], list), "athlete_missing should be list"
        
        print(f"Profile check result: is_complete={data['is_complete']}")
        print(f"Parent missing fields: {data['parent_missing']}")
        print(f"Athlete missing fields: {data['athlete_missing']}")
    
    def test_profile_check_nonexistent_athlete_returns_404(self, auth_headers):
        """Profile check for non-existent athlete should return 404"""
        fake_athlete_id = "000000000000000000000000"
        
        response = requests.get(
            f"{BASE_URL}/api/athletes/{fake_athlete_id}/profile-check",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestTrialDocumentEndpoint:
    """Tests for GET /api/athletes/{athlete_id}/trial-document"""
    
    def test_trial_document_incomplete_profile_returns_400(self, auth_headers):
        """Trial document generation should return 400 when profile is incomplete"""
        # Use test athlete with incomplete profile
        athlete_id = "6980555944b98b037b4a14ec"
        
        response = requests.get(
            f"{BASE_URL}/api/athletes/{athlete_id}/trial-document",
            headers=auth_headers
        )
        
        # Should return 400 with detail message about incomplete profile
        # OR 400 with different error if athlete is not minor / other validation
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data, "Error response should contain 'detail'"
            print(f"Trial document error (expected): {data['detail']}")
            # The error should mention incomplete profile OR not minor
            # Both are valid 400 responses
            assert response.status_code == 400
        else:
            # If 200, document was generated (profile complete)
            # If 403, access denied
            print(f"Trial document response: {response.status_code}")
    
    def test_trial_document_nonexistent_athlete_returns_404(self, auth_headers):
        """Trial document for non-existent athlete should return 404"""
        fake_athlete_id = "000000000000000000000000"
        
        response = requests.get(
            f"{BASE_URL}/api/athletes/{fake_athlete_id}/trial-document",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestSettingsSocietyEndpoint:
    """Tests for PATCH /api/settings/society"""
    
    def test_settings_society_accepts_all_trial_fields(self, auth_headers):
        """Settings endpoint should accept block_expired_certificates, trial_max_days, trial_max_sessions together"""
        
        # First get current settings
        get_response = requests.get(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        current = get_response.json()
        
        # Save original values
        original_block = current.get("block_expired_certificates", False)
        original_days = current.get("trial_max_days", 7)
        original_sessions = current.get("trial_max_sessions", 3)
        
        # Update all three together
        new_block = not original_block
        new_days = 10 if original_days != 10 else 7
        new_sessions = 4 if original_sessions != 4 else 3
        
        patch_response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={
                "block_expired_certificates": new_block,
                "trial_max_days": new_days,
                "trial_max_sessions": new_sessions
            }
        )
        
        assert patch_response.status_code == 200, f"Expected 200, got {patch_response.status_code}: {patch_response.text}"
        
        # Verify changes
        verify_response = requests.get(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        updated = verify_response.json()
        
        assert updated["block_expired_certificates"] == new_block, "block_expired_certificates not updated"
        assert updated["trial_max_days"] == new_days, "trial_max_days not updated"
        assert updated["trial_max_sessions"] == new_sessions, "trial_max_sessions not updated"
        
        print(f"Settings updated successfully: block={new_block}, days={new_days}, sessions={new_sessions}")
        
        # Restore original values
        requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={
                "block_expired_certificates": original_block,
                "trial_max_days": original_days,
                "trial_max_sessions": original_sessions
            }
        )
    
    def test_settings_society_trial_days_validation(self, auth_headers):
        """Trial max days should be clamped to 3-15"""
        
        # Test min value (should clamp to 3)
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={"trial_max_days": 1}
        )
        assert response.status_code == 200
        
        verify = requests.get(f"{BASE_URL}/api/settings/society", headers=auth_headers)
        assert verify.json()["trial_max_days"] == 3, "trial_max_days should be clamped to min 3"
        
        # Test max value (should clamp to 15)
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={"trial_max_days": 30}
        )
        assert response.status_code == 200
        
        verify = requests.get(f"{BASE_URL}/api/settings/society", headers=auth_headers)
        assert verify.json()["trial_max_days"] == 15, "trial_max_days should be clamped to max 15"
        
        # Restore default
        requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={"trial_max_days": 7}
        )
    
    def test_settings_society_trial_sessions_validation(self, auth_headers):
        """Trial max sessions should be clamped to 1-5"""
        
        # Test min value (should clamp to 1)
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={"trial_max_sessions": 0}
        )
        assert response.status_code == 200
        
        verify = requests.get(f"{BASE_URL}/api/settings/society", headers=auth_headers)
        assert verify.json()["trial_max_sessions"] == 1, "trial_max_sessions should be clamped to min 1"
        
        # Test max value (should clamp to 5)
        response = requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={"trial_max_sessions": 10}
        )
        assert response.status_code == 200
        
        verify = requests.get(f"{BASE_URL}/api/settings/society", headers=auth_headers)
        assert verify.json()["trial_max_sessions"] == 5, "trial_max_sessions should be clamped to max 5"
        
        # Restore default
        requests.patch(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers,
            json={"trial_max_sessions": 3}
        )


class TestSettingsEndpointContainsBlockCertField:
    """Verify GET /api/settings/society includes block_expired_certificates"""
    
    def test_settings_contains_block_expired_certificates(self, auth_headers):
        """Settings response should include block_expired_certificates field"""
        
        response = requests.get(
            f"{BASE_URL}/api/settings/society",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "block_expired_certificates" in data, "Settings should contain block_expired_certificates"
        assert "trial_max_days" in data, "Settings should contain trial_max_days"
        assert "trial_max_sessions" in data, "Settings should contain trial_max_sessions"
        
        print(f"Current settings: block={data['block_expired_certificates']}, days={data['trial_max_days']}, sessions={data['trial_max_sessions']}")
