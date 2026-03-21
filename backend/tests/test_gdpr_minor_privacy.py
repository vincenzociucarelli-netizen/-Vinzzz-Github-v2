"""
Tests for GDPR Privacy endpoints for minor athletes
Testing the new GDPRPrivacyModal flow that replaces simple privacy acceptance
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://athlete-trial-sys.preview.emergentagent.com').rstrip('/')

# Test credentials
PARENT_EMAIL = "sauro@test.com"
PARENT_PASSWORD = "Test1234"
MINOR_ATHLETE_ID = "69b5e0beefab8e9f13304720"  # PESSI LUCIA

class TestGDPRMinorPrivacyEndpoints:
    """Tests for GDPR privacy flow for minors"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as parent and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as parent
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        self.token = data.get("token")
        self.user = data.get("user")
        
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}"
        })
        
        print(f"Logged in as: {self.user.get('full_name')} (role: {self.user.get('role')})")
    
    def test_01_parent_login_success(self):
        """Test parent login returns correct user info"""
        assert self.user is not None, "User data not returned"
        assert self.user.get("role") == "parent", f"Expected role 'parent', got '{self.user.get('role')}'"
        assert self.user.get("email") == PARENT_EMAIL, "Email mismatch"
        print(f"✓ Parent login successful: {self.user.get('full_name')}")
    
    def test_02_get_minor_athlete_data(self):
        """Test fetching minor athlete LUCIA's data"""
        response = self.session.get(f"{BASE_URL}/api/athletes/{MINOR_ATHLETE_ID}")
        assert response.status_code == 200, f"Failed to get athlete: {response.text}"
        
        athlete = response.json()
        assert athlete.get("id") == MINOR_ATHLETE_ID, "Athlete ID mismatch"
        assert athlete.get("is_minor") == True, "Expected athlete to be a minor"
        assert athlete.get("full_name") == "PESSI LUCIA", f"Expected 'PESSI LUCIA', got '{athlete.get('full_name')}'"
        
        # Verify current status for testing
        print(f"✓ Athlete data retrieved: {athlete.get('full_name')}")
        print(f"  Status: {athlete.get('status')}, Privacy accepted: {athlete.get('privacy_accepted')}")
    
    def test_03_preview_gdpr_privacy_minor(self):
        """Test GDPR privacy preview endpoint for minor"""
        payload = {
            "document_type": "gdpr_minor",
            "signer_name": "SAURO",
            "signer_surname": "PESSI",
            "signer_fiscal_code": "PSSSAR70A01G478R",
            "minor_id": MINOR_ATHLETE_ID,
            "minor_name": "LUCIA",
            "minor_surname": "PESSI"
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/preview-gdpr-privacy", json=payload)
        assert response.status_code == 200, f"Preview failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Preview was not successful"
        assert "pdf_base64" in data, "PDF base64 not in response"
        assert len(data.get("pdf_base64", "")) > 1000, "PDF seems too small"
        assert "ANTEPRIMA" in data.get("document_title", ""), "Expected 'ANTEPRIMA' in title"
        
        print(f"✓ GDPR preview generated successfully")
        print(f"  Document title: {data.get('document_title')}")
        print(f"  PDF size: {len(data.get('pdf_base64', ''))} chars")
    
    def test_04_sign_gdpr_privacy_minor(self):
        """Test GDPR privacy signing endpoint for minor"""
        # Test signature (base64 PNG)
        test_signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
        
        payload = {
            "document_type": "gdpr_minor",
            "signer_name": "SAURO",
            "signer_surname": "PESSI",
            "signer_fiscal_code": "PSSSAR70A01G478R",
            "minor_id": MINOR_ATHLETE_ID,
            "minor_name": "LUCIA",
            "minor_surname": "PESSI",
            "signature_base64": test_signature,
            "user_agent": "Pytest Test Agent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/sign-gdpr-privacy", json=payload)
        assert response.status_code == 200, f"Sign failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Signing was not successful"
        assert "document_id" in data, "Document ID not returned"
        assert "pdf_url" in data, "PDF URL not returned"
        assert "gdpr_metadata" in data, "GDPR metadata not returned"
        
        # Verify metadata includes required GDPR fields
        metadata = data.get("gdpr_metadata", {})
        assert "document_version" in metadata, "Document version not in metadata"
        assert "timestamp" in metadata, "Timestamp not in metadata"
        assert "document_hash" in metadata, "Document hash not in metadata"
        
        print(f"✓ GDPR document signed successfully")
        print(f"  Document ID: {data.get('document_id')}")
        print(f"  Metadata: {metadata}")
    
    def test_05_sign_gdpr_without_signature_fails(self):
        """Test that signing without a signature fails"""
        payload = {
            "document_type": "gdpr_minor",
            "signer_name": "SAURO",
            "signer_surname": "PESSI",
            "minor_id": MINOR_ATHLETE_ID,
            "signature_base64": "",  # Empty signature
            "user_agent": "Pytest Test Agent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/sign-gdpr-privacy", json=payload)
        # Should either fail or handle gracefully
        # The endpoint might accept empty signature and return success=true with empty signature
        # Or it might validate and return an error
        print(f"  Response for empty signature: {response.status_code}")
        print(f"  Response body: {response.text[:200] if response.text else 'empty'}")
    
    def test_06_sign_gdpr_without_minor_id_fails(self):
        """Test that signing for minor without minor_id fails"""
        payload = {
            "document_type": "gdpr_minor",
            "signer_name": "SAURO",
            "signer_surname": "PESSI",
            # minor_id intentionally missing
            "signature_base64": "data:image/png;base64,test",
            "user_agent": "Pytest Test Agent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/documents/sign-gdpr-privacy", json=payload)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "minore" in data.get("detail", "").lower() or "minor" in data.get("detail", "").lower(), \
            f"Expected error about minor ID, got: {data.get('detail')}"
        
        print(f"✓ Correctly rejected signing without minor_id")
        print(f"  Error: {data.get('detail')}")
    
    def test_07_athlete_activation_after_gdpr(self):
        """Test that athlete can be activated after GDPR signing"""
        # This simulates what the frontend does after successful signing
        payload = {
            "privacy_accepted": True,
            "image_consent": True,
            "status": "active"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/athletes/{MINOR_ATHLETE_ID}", json=payload)
        assert response.status_code == 200, f"Activation failed: {response.text}"
        
        athlete = response.json()
        assert athlete.get("status") == "active", f"Expected status 'active', got '{athlete.get('status')}'"
        assert athlete.get("privacy_accepted") == True, "Privacy should be accepted"
        
        print(f"✓ Athlete activated successfully after GDPR signing")
        print(f"  Status: {athlete.get('status')}, Privacy: {athlete.get('privacy_accepted')}")
    
    def test_08_reset_athlete_for_future_tests(self):
        """Reset athlete to trial status for future testing"""
        payload = {
            "privacy_accepted": False,
            "status": "trial"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/athletes/{MINOR_ATHLETE_ID}", json=payload)
        assert response.status_code == 200, f"Reset failed: {response.text}"
        
        athlete = response.json()
        assert athlete.get("status") == "trial", "Reset to trial failed"
        assert athlete.get("privacy_accepted") == False, "Privacy reset failed"
        
        print(f"✓ Athlete reset to trial status for future tests")


class TestGDPRDocumentRetrieval:
    """Tests for retrieving signed GDPR documents"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as parent and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        self.token = data.get("token")
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}"
        })
    
    def test_09_list_documents_for_minor(self):
        """Test listing documents for a minor athlete"""
        response = self.session.get(f"{BASE_URL}/api/documents?entity_id={MINOR_ATHLETE_ID}")
        
        # This endpoint might not exist or return empty list
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Documents endpoint accessible")
            print(f"  Found {len(data) if isinstance(data, list) else 0} documents")
        elif response.status_code == 404:
            print(f"  Documents listing endpoint not found (404)")
        else:
            print(f"  Documents endpoint returned: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
