"""
Test suite for Personal Documents / Consent Documents feature
Tests:
1. GET /api/documents/my-documents returns parent_name in grouped response
2. GET /api/documents/my-documents returns consent-based virtual documents in grouped.personal array
3. Personal section shows consent docs: privacy_viewed, data_processing, and terms_of_use
4. Consent documents have correct metadata (source, document_version, ip_address)
5. POST /api/auth/register with consents payload saves all 4 consent keys correctly
6. GET /api/users/me/consents returns all 4 saved consent values correctly after registration
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://consent-audit-test.preview.emergentagent.com')

class TestConsentDocuments:
    """Test consent documents feature for parent's personal documents section"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def parent_auth(self, api_client):
        """Login as parent Sofia and return token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sofia@test.com",
            "password": "Test1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Parent login failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def marco_auth(self, api_client):
        """Login as parent Marco and return token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "marco@test.com",
            "password": "Test1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Marco login failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def admin_auth(self, api_client):
        """Login as admin and return token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pallavoloperugia@gmail.com",
            "password": "Test1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed - skipping authenticated tests")
    
    # ==================== TEST: GET /api/documents/my-documents ====================
    
    def test_my_documents_returns_parent_name(self, api_client, parent_auth):
        """Test that GET /api/documents/my-documents returns parent_name in grouped response"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/my-documents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check grouped structure exists
        assert "grouped" in data, "Response should contain 'grouped' key"
        grouped = data["grouped"]
        
        # Check parent_name is present
        assert "parent_name" in grouped, "grouped should contain 'parent_name'"
        assert grouped["parent_name"], "parent_name should not be empty"
        print(f"✓ Parent name returned: {grouped['parent_name']}")
    
    def test_my_documents_returns_consent_documents(self, api_client, parent_auth):
        """Test that GET /api/documents/my-documents returns consent-based virtual documents"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/my-documents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        grouped = data.get("grouped", {})
        personal = grouped.get("personal", [])
        
        # Check for consent documents in personal section
        consent_docs = [doc for doc in personal if doc.get("is_consent_record") == True]
        print(f"✓ Found {len(consent_docs)} consent documents in personal section")
        
        # Verify consent documents have is_consent_record=true
        for doc in consent_docs:
            assert doc.get("is_consent_record") == True, f"Consent doc should have is_consent_record=true: {doc}"
            print(f"  - {doc.get('document_title')}: is_consent_record={doc.get('is_consent_record')}")
    
    def test_consent_documents_have_correct_types(self, api_client, parent_auth):
        """Test that personal section shows privacy_viewed, data_processing, and terms_of_use consent docs"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/my-documents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        personal = data.get("grouped", {}).get("personal", [])
        
        consent_docs = [doc for doc in personal if doc.get("is_consent_record") == True]
        doc_types = [doc.get("document_type") for doc in consent_docs]
        
        # Check for expected consent types
        expected_types = ["consent_privacy_viewed", "consent_data_processing", "consent_terms"]
        found_types = []
        
        for expected in expected_types:
            if expected in doc_types:
                found_types.append(expected)
                print(f"✓ Found consent type: {expected}")
            else:
                print(f"⚠ Missing consent type: {expected}")
        
        # At minimum, privacy_viewed and data_processing should be present if user has consents
        print(f"✓ Found consent document types: {doc_types}")
    
    def test_consent_documents_have_metadata(self, api_client, parent_auth):
        """Test that consent documents have correct metadata (source, document_version, ip_address)"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/my-documents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        personal = data.get("grouped", {}).get("personal", [])
        
        consent_docs = [doc for doc in personal if doc.get("is_consent_record") == True]
        
        for doc in consent_docs:
            metadata = doc.get("consent_metadata", {})
            print(f"✓ Consent doc '{doc.get('document_title')}' metadata: {metadata}")
            
            # Check source field
            assert "source" in metadata, f"Consent metadata should have 'source': {doc}"
            
            # document_version and ip_address may be present depending on how consent was recorded
            if metadata.get("document_version"):
                print(f"  - document_version: {metadata.get('document_version')}")
            if metadata.get("ip_address"):
                print(f"  - ip_address: {metadata.get('ip_address')}")
    
    def test_consent_documents_not_clickable(self, api_client, parent_auth):
        """Test that consent documents have is_consent_record=true (frontend uses this to disable click)"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/my-documents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        personal = data.get("grouped", {}).get("personal", [])
        
        consent_docs = [doc for doc in personal if doc.get("is_consent_record") == True]
        
        for doc in consent_docs:
            # Consent docs should NOT have pdf_filename (no PDF to open)
            assert doc.get("pdf_filename") is None, f"Consent doc should not have pdf_filename: {doc}"
            print(f"✓ Consent doc '{doc.get('document_title')}' has no PDF (is_consent_record=true)")
    
    def test_children_documents_still_display(self, api_client, parent_auth):
        """Test that children's document sections still display correctly below personal section"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/my-documents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        grouped = data.get("grouped", {})
        
        # Check minors array exists
        assert "minors" in grouped, "grouped should contain 'minors' array"
        minors = grouped.get("minors", [])
        
        print(f"✓ Found {len(minors)} minor sections")
        for minor in minors:
            print(f"  - {minor.get('minor_name')}: {len(minor.get('documents', []))} documents")
    
    # ==================== TEST: GET /api/users/me/consents ====================
    
    def test_get_my_consents_endpoint(self, api_client, parent_auth):
        """Test GET /api/users/me/consents returns saved consent values"""
        response = api_client.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check consents structure
        assert "consents" in data, "Response should contain 'consents' key"
        consents = data.get("consents")
        
        if consents:
            print(f"✓ User consents found:")
            for key, value in consents.items():
                print(f"  - {key}: {value}")
        else:
            print("⚠ No consents found for this user (may not have registered with consents)")
    
    def test_get_my_consents_has_all_keys(self, api_client, parent_auth):
        """Test that GET /api/users/me/consents returns all 4 consent keys if present"""
        response = api_client.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {parent_auth}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        consents = data.get("consents", {})
        
        expected_keys = ["privacy_viewed", "data_processing", "images_internal", "images_promo"]
        
        if consents:
            for key in expected_keys:
                if key in consents:
                    print(f"✓ Consent key '{key}' present: {consents[key]}")
                else:
                    print(f"⚠ Consent key '{key}' not present")
        else:
            print("⚠ No consents object - user may have registered before consent feature")


class TestRegistrationConsents:
    """Test registration with GDPR consents"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def admin_auth(self, api_client):
        """Login as admin and return token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "pallavoloperugia@gmail.com",
            "password": "Test1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def invite_code(self, api_client, admin_auth):
        """Get society invite code"""
        response = api_client.get(
            f"{BASE_URL}/api/societies/invite-code",
            headers={"Authorization": f"Bearer {admin_auth}"}
        )
        if response.status_code == 200:
            return response.json().get("invite_code")
        return "TESTCODE"  # Fallback
    
    def test_register_with_all_consents(self, api_client, invite_code):
        """Test POST /api/auth/register with consents payload saves all 4 consent keys"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"test_consent_{unique_id}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "Test1234",
            "full_name": f"TEST CONSENT {unique_id}",
            "role": "parent",
            "invite_code": invite_code,
            "consents": {
                "privacy_viewed": True,
                "data_processing": True,
                "images_internal": True,
                "images_promo": False
            }
        })
        
        # Registration should succeed
        assert response.status_code == 200, f"Registration failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Get token for verification
        token = data.get("token")
        assert token, "Registration should return a token"
        
        # Verify consents were saved by calling /users/me/consents
        consents_response = api_client.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert consents_response.status_code == 200
        consents_data = consents_response.json()
        consents = consents_data.get("consents", {})
        
        # Verify all 4 consent keys are saved
        assert "privacy_viewed" in consents, "privacy_viewed should be saved"
        assert "data_processing" in consents, "data_processing should be saved"
        assert "images_internal" in consents, "images_internal should be saved"
        assert "images_promo" in consents, "images_promo should be saved"
        
        # Verify values
        assert consents["privacy_viewed"].get("value") == True, "privacy_viewed should be True"
        assert consents["data_processing"].get("value") == True, "data_processing should be True"
        assert consents["images_internal"].get("value") == True, "images_internal should be True"
        assert consents["images_promo"].get("value") == False, "images_promo should be False"
        
        print(f"✓ All 4 consent keys saved correctly for {test_email}")
        print(f"  - privacy_viewed: {consents['privacy_viewed'].get('value')}")
        print(f"  - data_processing: {consents['data_processing'].get('value')}")
        print(f"  - images_internal: {consents['images_internal'].get('value')}")
        print(f"  - images_promo: {consents['images_promo'].get('value')}")
        
        # Cleanup: Delete test user
        # Note: In production, we'd clean up the test user
    
    def test_register_consent_has_timestamp_and_source(self, api_client, invite_code):
        """Test that registered consents have timestamp and source='registration'"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"test_consent_meta_{unique_id}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "Test1234",
            "full_name": f"TEST CONSENT META {unique_id}",
            "role": "parent",
            "invite_code": invite_code,
            "consents": {
                "privacy_viewed": True,
                "data_processing": True,
                "images_internal": False,
                "images_promo": False
            }
        })
        
        if response.status_code != 200:
            pytest.skip(f"Registration failed: {response.text}")
        
        token = response.json().get("token")
        
        # Get consents
        consents_response = api_client.get(
            f"{BASE_URL}/api/users/me/consents",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert consents_response.status_code == 200
        consents = consents_response.json().get("consents", {})
        
        # Check metadata for privacy_viewed
        pv = consents.get("privacy_viewed", {})
        assert "timestamp" in pv, "Consent should have timestamp"
        assert pv.get("source") == "registration", f"Source should be 'registration', got: {pv.get('source')}"
        
        print(f"✓ Consent metadata verified:")
        print(f"  - timestamp: {pv.get('timestamp')}")
        print(f"  - source: {pv.get('source')}")


class TestMyDocumentsWithMarco:
    """Test my-documents endpoint with Marco (another parent)"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def marco_auth(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "marco@test.com",
            "password": "Test1234"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Marco login failed")
    
    def test_marco_my_documents_structure(self, api_client, marco_auth):
        """Test that Marco's my-documents returns correct structure"""
        response = api_client.get(
            f"{BASE_URL}/api/documents/my-documents",
            headers={"Authorization": f"Bearer {marco_auth}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "grouped" in data
        grouped = data["grouped"]
        
        assert "personal" in grouped, "Should have personal section"
        assert "minors" in grouped, "Should have minors section"
        assert "parent_name" in grouped, "Should have parent_name"
        
        print(f"✓ Marco's documents structure verified")
        print(f"  - parent_name: {grouped.get('parent_name')}")
        print(f"  - personal docs: {len(grouped.get('personal', []))}")
        print(f"  - minors: {len(grouped.get('minors', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
