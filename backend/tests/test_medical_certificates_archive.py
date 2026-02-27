"""
Test Medical Certificates Archive API endpoints
Tests for the new 5-year medical certificate archive feature for ASD legal compliance
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMedicalCertificatesArchive:
    """Test medical certificates archive endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test.admin@test.com", "password": "Test1234"}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_archive_list_endpoint_returns_200(self):
        """Test that archive list endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "certificates" in data
        assert "total" in data
        print(f"Archive list returned: {data['total']} certificates")
    
    def test_archive_list_response_structure(self):
        """Test that archive list has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "certificates" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        
        # Check types
        assert isinstance(data["certificates"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["page"], int)
        assert isinstance(data["pages"], int)
    
    def test_stats_endpoint_returns_200(self):
        """Test that stats endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_certificates" in data
        assert "by_year" in data
        print(f"Stats returned: {data['total_certificates']} total, by_year: {data['by_year']}")
    
    def test_stats_response_structure(self):
        """Test that stats has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "total_certificates" in data
        assert "by_year" in data
        
        # Check types
        assert isinstance(data["total_certificates"], int)
        assert isinstance(data["by_year"], dict)
    
    def test_archive_search_functionality(self):
        """Test search functionality"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive",
            params={"search": "test"},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "certificates" in data
        assert "total" in data
    
    def test_archive_pagination(self):
        """Test pagination parameters"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive",
            params={"page": 1, "limit": 10},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
    
    def test_archive_unauthorized_access(self):
        """Test that unauthenticated access is rejected"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive"
        )
        assert response.status_code in [401, 403]
    
    def test_stats_unauthorized_access(self):
        """Test that unauthenticated access to stats is rejected"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive/stats"
        )
        assert response.status_code in [401, 403]
    
    def test_individual_certificate_not_found(self):
        """Test that non-existent certificate returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive/nonexistent-id",
            headers=self.headers
        )
        assert response.status_code == 404


class TestAthleteLogin:
    """Test that athlete cannot access admin archive"""
    
    def test_athlete_cannot_access_archive(self):
        """Athlete should not be able to access admin archive"""
        # Login as athlete
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "genny@test.com", "password": "Test1234"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access archive
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive",
            headers=headers
        )
        assert response.status_code == 403
        print("Correctly blocked athlete access to archive")
    
    def test_athlete_cannot_access_stats(self):
        """Athlete should not be able to access admin stats"""
        # Login as athlete
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "genny@test.com", "password": "Test1234"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access stats
        response = requests.get(
            f"{BASE_URL}/api/admin/medical-certificates-archive/stats",
            headers=headers
        )
        assert response.status_code == 403
        print("Correctly blocked athlete access to stats")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
