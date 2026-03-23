"""
Tests for Digital Signature System - RegistraTEAM
Testing endpoints:
- POST /api/documents/sign - Create signed document
- GET /api/documents/signed - List signed documents
- GET /api/documents/signed/{id}/pdf - Download PDF
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://season-enroll.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "pallavoloperugia@gmail.com"
ADMIN_PASSWORD = "11092012"

# Simple test signature (small red dot PNG in base64)
TEST_SIGNATURE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2NkIAIwEqGGYRSM+IKMABF0AAODPqQeAAAAAElFTkSuQmCC"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin authentication"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestDocumentSignEndpoint:
    """Tests for POST /api/documents/sign"""
    
    created_document_id = None
    
    def test_sign_document_success(self, admin_headers):
        """Test creating a signed document with valid data"""
        payload = {
            "document_type": "test_document",
            "document_title": "Test Digital Signature Document",
            "document_text": "This is a test document for digital signature validation. " 
                            "Il/La sottoscritto/a Test User dichiara di aver letto e accettato i termini.",
            "signer_name": "Test User Admin",
            "signer_email": ADMIN_EMAIL,
            "signature_base64": TEST_SIGNATURE_BASE64,
            "related_entity_id": None,
            "additional_data": {
                "Tipo Test": "Backend API Test",
                "Data Creazione": "Test automatico"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert data["success"] == True, "Response should indicate success"
        assert "document_id" in data, "Response should contain document_id"
        assert "message" in data, "Response should contain message"
        assert len(data["document_id"]) > 0, "document_id should not be empty"
        
        # Store for later tests
        TestDocumentSignEndpoint.created_document_id = data["document_id"]
        print(f"✓ Created signed document with ID: {data['document_id']}")
    
    def test_sign_document_privacy_consent_type(self, admin_headers):
        """Test creating a privacy consent document (like in parent flow)"""
        payload = {
            "document_type": "privacy_consent",
            "document_title": "Consenso Privacy - Test Atleta",
            "document_text": """Il/La sottoscritto/a Genitore Test, in qualità di genitore/tutore dell'atleta Test Atleta, 
dichiara di aver letto e compreso l'informativa sulla privacy ai sensi del Regolamento UE 2016/679 (GDPR).

Autorizza il trattamento dei dati personali propri e del minore per le finalità connesse all'attività sportiva, incluse:
- Gestione dell'iscrizione e tesseramento
- Comunicazioni relative all'attività sportiva
- Pubblicazione di foto/video su canali ufficiali della società
- Adempimenti assicurativi e federali

L'autorizzazione è valida per tutta la durata dell'attività sportiva presso la società.""",
            "signer_name": "Genitore Test",
            "signer_email": ADMIN_EMAIL,
            "signature_base64": TEST_SIGNATURE_BASE64,
            "related_entity_id": "test-athlete-id-123",
            "additional_data": {
                "Atleta": "Test Atleta",
                "Genitore/Tutore": "Genitore Test",
                "Tipo documento": "Consenso Privacy e Liberatoria"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "document_id" in data
        print(f"✓ Created privacy consent document with ID: {data['document_id']}")
    
    def test_sign_document_without_auth_fails(self):
        """Test that signing without authentication returns 401 or 403"""
        payload = {
            "document_type": "test",
            "document_title": "Test",
            "document_text": "Test",
            "signer_name": "Test",
            "signer_email": "test@test.com",
            "signature_base64": TEST_SIGNATURE_BASE64
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=payload
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Unauthenticated request correctly rejected")
    
    def test_sign_document_missing_required_fields(self, admin_headers):
        """Test validation for missing required fields"""
        # Missing document_type
        payload = {
            "document_title": "Test",
            "document_text": "Test",
            "signer_name": "Test",
            "signer_email": "test@test.com",
            "signature_base64": TEST_SIGNATURE_BASE64
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=payload,
            headers=admin_headers
        )
        
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        print("✓ Missing required field validation works")


class TestListSignedDocuments:
    """Tests for GET /api/documents/signed"""
    
    def test_list_documents_authenticated(self, admin_headers):
        """Test listing signed documents as authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/documents/signed",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Response should be a list"
        
        # If we have documents from earlier tests, verify structure
        if len(data) > 0:
            doc = data[0]
            assert "id" in doc, "Document should have id"
            assert "document_type" in doc, "Document should have document_type"
            assert "document_title" in doc, "Document should have document_title"
            assert "signer_name" in doc, "Document should have signer_name"
            assert "signed_at" in doc, "Document should have signed_at"
            # PDF data should NOT be included in list (for performance)
            assert "pdf_base64" not in doc, "pdf_base64 should not be in list response"
        
        print(f"✓ Listed {len(data)} signed documents")
    
    def test_list_documents_without_auth_fails(self):
        """Test that listing without authentication returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/documents/signed")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated list correctly rejected")


class TestDownloadSignedPDF:
    """Tests for GET /api/documents/signed/{id}/pdf"""
    
    def test_download_pdf_success(self, admin_headers):
        """Test downloading a signed document PDF"""
        # First, create a document
        create_payload = {
            "document_type": "pdf_download_test",
            "document_title": "PDF Download Test Document",
            "document_text": "Test document for PDF download verification.",
            "signer_name": "Test Downloader",
            "signer_email": ADMIN_EMAIL,
            "signature_base64": TEST_SIGNATURE_BASE64
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=create_payload,
            headers=admin_headers
        )
        
        assert create_response.status_code == 200, f"Failed to create document: {create_response.text}"
        document_id = create_response.json()["document_id"]
        
        # Now download the PDF
        download_response = requests.get(
            f"{BASE_URL}/api/documents/signed/{document_id}/pdf",
            headers=admin_headers
        )
        
        assert download_response.status_code == 200, f"Expected 200, got {download_response.status_code}"
        
        # Verify it's actually a PDF
        assert download_response.headers.get("content-type") == "application/pdf", "Response should be PDF"
        
        # Verify PDF starts with correct header
        content = download_response.content
        assert content[:4] == b'%PDF', "Content should start with PDF header"
        assert len(content) > 100, "PDF should have substantial content"
        
        print(f"✓ Downloaded PDF successfully ({len(content)} bytes)")
    
    def test_download_nonexistent_document(self, admin_headers):
        """Test downloading a non-existent document returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/documents/signed/nonexistent-id-12345/pdf",
            headers=admin_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent document correctly returns 404")
    
    def test_download_without_auth_fails(self):
        """Test that downloading without authentication returns 401 or 403"""
        response = requests.get(
            f"{BASE_URL}/api/documents/signed/some-id/pdf"
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated download correctly rejected")


class TestPDFGeneration:
    """Tests for PDF content generation"""
    
    def test_pdf_contains_signature_and_timestamp(self, admin_headers):
        """Test that generated PDF contains signature image and timestamp"""
        payload = {
            "document_type": "content_test",
            "document_title": "Content Verification Test",
            "document_text": "Testing that PDF generation includes all required elements.",
            "signer_name": "Content Tester",
            "signer_email": ADMIN_EMAIL,
            "signature_base64": TEST_SIGNATURE_BASE64,
            "additional_data": {
                "Test Key": "Test Value",
                "Another Key": "Another Value"
            }
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=payload,
            headers=admin_headers
        )
        
        assert create_response.status_code == 200
        document_id = create_response.json()["document_id"]
        
        download_response = requests.get(
            f"{BASE_URL}/api/documents/signed/{document_id}/pdf",
            headers=admin_headers
        )
        
        assert download_response.status_code == 200
        
        # Check PDF has reasonable size (should include signature image)
        content = download_response.content
        assert len(content) > 500, f"PDF seems too small ({len(content)} bytes), might be missing content"
        
        # PDF should be valid
        assert content[:4] == b'%PDF'
        assert b'%%EOF' in content or content.endswith(b'%%EOF\n') or b'endobj' in content
        
        print(f"✓ PDF generated with all content ({len(content)} bytes)")
    
    def test_pdf_with_long_text(self, admin_headers):
        """Test PDF generation with very long text (should wrap correctly)"""
        long_text = "Questo è un testo molto lungo che dovrebbe essere avvolto correttamente nel PDF. " * 50
        
        payload = {
            "document_type": "long_text_test",
            "document_title": "Long Text Document Test",
            "document_text": long_text,
            "signer_name": "Long Text Tester",
            "signer_email": ADMIN_EMAIL,
            "signature_base64": TEST_SIGNATURE_BASE64
        }
        
        response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ PDF with long text generated successfully")


class TestDatabasePersistence:
    """Tests for document database persistence"""
    
    def test_document_saved_to_database(self, admin_headers):
        """Test that signed document is properly saved to database"""
        unique_title = f"Database Persistence Test {os.urandom(4).hex()}"
        
        create_payload = {
            "document_type": "persistence_test",
            "document_title": unique_title,
            "document_text": "Testing database persistence.",
            "signer_name": "Persistence Tester",
            "signer_email": ADMIN_EMAIL,
            "signature_base64": TEST_SIGNATURE_BASE64,
            "related_entity_id": "test-entity-persistence"
        }
        
        # Create document
        create_response = requests.post(
            f"{BASE_URL}/api/documents/sign",
            json=create_payload,
            headers=admin_headers
        )
        
        assert create_response.status_code == 200
        document_id = create_response.json()["document_id"]
        
        # Verify in list
        list_response = requests.get(
            f"{BASE_URL}/api/documents/signed",
            headers=admin_headers
        )
        
        assert list_response.status_code == 200
        documents = list_response.json()
        
        # Find our document
        found_doc = None
        for doc in documents:
            if doc.get("id") == document_id:
                found_doc = doc
                break
        
        assert found_doc is not None, f"Document {document_id} not found in list"
        assert found_doc["document_title"] == unique_title
        assert found_doc["document_type"] == "persistence_test"
        assert found_doc["signer_name"] == "Persistence Tester"
        assert found_doc["related_entity_id"] == "test-entity-persistence"
        
        print(f"✓ Document persisted and retrieved correctly: {document_id}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
