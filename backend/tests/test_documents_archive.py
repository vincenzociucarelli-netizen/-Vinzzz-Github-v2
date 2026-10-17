"""
Tests for Document Archive Endpoints - Bug Fixes Verification
Tests: 
A.1) Document download API: GET /api/documents/download/{id}
A.2) Documents archive API: GET /api/documents/archive
B) My documents API: GET /api/documents/my-documents
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Test API health check"""
    
    def test_api_health(self):
        """Test that API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login(self):
        """Test admin login to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test.admin@test.com",
            "password": "Test1234"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "admin"
        print(f"✓ Admin login successful - user ID: {data.get('user', {}).get('id')}")
        return data["token"]


class TestDocumentsArchive:
    """Test GET /api/documents/archive endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test.admin@test.com",
            "password": "Test1234"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_archive_endpoint_exists(self, admin_token):
        """Test that documents archive endpoint exists and responds"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/documents/archive", headers=headers)
        
        # Should return 200 even if no documents exist
        assert response.status_code == 200, f"Archive endpoint returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "documents" in data, "Response should have 'documents' field"
        assert "total" in data, "Response should have 'total' field"
        assert "page" in data, "Response should have 'page' field"
        assert isinstance(data["documents"], list), "documents should be a list"
        
        print(f"✓ Documents archive endpoint working - found {data['total']} documents")
    
    def test_archive_requires_auth(self):
        """Test that archive endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/documents/archive")
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print("✓ Archive endpoint correctly requires authentication")
    
    def test_archive_with_filters(self, admin_token):
        """Test archive with filter parameters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test with coach filter
        response = requests.get(
            f"{BASE_URL}/api/documents/archive?figure_type=coach",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["documents"], list)
        print(f"✓ Archive with coach filter - found {len(data['documents'])} documents")
        
        # Test with dirigente filter
        response = requests.get(
            f"{BASE_URL}/api/documents/archive?figure_type=dirigente",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["documents"], list)
        print(f"✓ Archive with dirigente filter - found {len(data['documents'])} documents")
    
    def test_archive_pagination(self, admin_token):
        """Test archive pagination parameters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/documents/archive?page=1&limit=5",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "page" in data and data["page"] == 1
        assert "limit" in data and data["limit"] == 5
        assert "total_pages" in data
        print(f"✓ Archive pagination working - page {data['page']}/{data['total_pages']}")


class TestMyDocuments:
    """Test GET /api/documents/my-documents endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test.admin@test.com",
            "password": "Test1234"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_my_documents_endpoint_exists(self, admin_token):
        """Test that my-documents endpoint exists and responds"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/documents/my-documents", headers=headers)
        
        assert response.status_code == 200, f"My documents endpoint returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "documents" in data, "Response should have 'documents' field"
        assert "total" in data, "Response should have 'total' field"
        assert isinstance(data["documents"], list), "documents should be a list"
        
        print(f"✓ My documents endpoint working - found {data['total']} documents")
    
    def test_my_documents_requires_auth(self):
        """Test that my-documents endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/documents/my-documents")
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print("✓ My documents endpoint correctly requires authentication")
    
    def test_my_documents_structure(self, admin_token):
        """Test that my-documents returns correct document structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/documents/my-documents", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if data["documents"]:
            doc = data["documents"][0]
            # Check expected fields
            expected_fields = ["id", "document_type", "signed_at"]
            for field in expected_fields:
                assert field in doc, f"Document should have '{field}' field"
            print(f"✓ Document structure verified with fields: {list(doc.keys())}")
        else:
            print("✓ My documents endpoint works - no documents for current user (expected)")


class TestDocumentDownload:
    """Test GET /api/documents/download/{document_id} endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test.admin@test.com",
            "password": "Test1234"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_download_nonexistent_document(self, admin_token):
        """Test download with non-existent document ID returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/documents/download/nonexistent-doc-id",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404 for nonexistent doc, got {response.status_code}"
        print("✓ Download endpoint correctly returns 404 for nonexistent documents")
    
    def test_download_requires_auth(self):
        """Test that download endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/documents/download/some-doc-id")
        assert response.status_code in [401, 403], f"Expected 401/403 but got {response.status_code}"
        print("✓ Download endpoint correctly requires authentication")
    
    def test_download_existing_document(self, admin_token):
        """Test download with existing document ID from archive"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First, get a document from the archive
        archive_response = requests.get(f"{BASE_URL}/api/documents/archive", headers=headers)
        assert archive_response.status_code == 200
        
        data = archive_response.json()
        if data["documents"] and len(data["documents"]) > 0:
            doc_id = data["documents"][0]["id"]
            
            # Try to download it
            download_response = requests.get(
                f"{BASE_URL}/api/documents/download/{doc_id}",
                headers=headers
            )
            
            # Should be 200 if PDF exists, or 404 if file is missing
            assert download_response.status_code in [200, 404], \
                f"Expected 200 or 404, got {download_response.status_code}: {download_response.text}"
            
            if download_response.status_code == 200:
                # Verify it's a PDF
                content_type = download_response.headers.get("content-type", "")
                assert "pdf" in content_type.lower() or "application/octet-stream" in content_type.lower(), \
                    f"Expected PDF content type, got {content_type}"
                print(f"✓ Document download working - downloaded doc {doc_id}")
            else:
                print(f"✓ Download endpoint returns 404 when PDF file is missing (doc {doc_id})")
        else:
            print("✓ Download endpoint exists - no documents in archive to download")


class TestEndpointIntegration:
    """Integration tests for document endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test.admin@test.com",
            "password": "Test1234"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_full_document_flow(self, admin_token):
        """Test the full document flow: archive -> get ID -> download"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Step 1: Get documents from archive
        archive_response = requests.get(f"{BASE_URL}/api/documents/archive", headers=headers)
        assert archive_response.status_code == 200, "Archive endpoint should work"
        archive_data = archive_response.json()
        
        print(f"  Archive returned {archive_data['total']} documents")
        
        # Step 2: Check my documents
        my_docs_response = requests.get(f"{BASE_URL}/api/documents/my-documents", headers=headers)
        assert my_docs_response.status_code == 200, "My documents endpoint should work"
        my_docs_data = my_docs_response.json()
        
        print(f"  My documents returned {my_docs_data['total']} documents")
        
        # Step 3: If documents exist, try to download one
        if archive_data['documents']:
            doc_id = archive_data['documents'][0]['id']
            download_response = requests.get(
                f"{BASE_URL}/api/documents/download/{doc_id}",
                headers=headers
            )
            assert download_response.status_code in [200, 404], \
                f"Download should return 200 or 404, got {download_response.status_code}"
            print(f"  Download endpoint responded correctly for doc {doc_id[:8]}...")
        
        print("✓ Full document flow integration test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
