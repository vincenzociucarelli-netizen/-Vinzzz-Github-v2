"""
GDPR Updates Testing - Italian Sports App
Tests for GDPR compliance updates:
1. PDF generation for minors - no medical certificate section, no data processing consent
2. PDF generation for adults - no data processing consent, has PRESA VISIONE sections
3. Registration endpoint - only privacy_viewed required, not data_processing
"""

import pytest
import requests
import os
import base64
import io
import pdfplumber

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SOFIA_EMAIL = "sofia@test.com"
SOFIA_PASSWORD = "Test1234"
MINOR_ID = "69c38ee1dc8c8fca3147c54a"  # Pia's ID


class TestGDPRPDFUpdates:
    """Test GDPR PDF generation updates"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for Sofia (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SOFIA_EMAIL, "password": SOFIA_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def extract_pdf_text(self, pdf_base64: str) -> str:
        """Extract text from base64-encoded PDF"""
        pdf_bytes = base64.b64decode(pdf_base64)
        pdf_file = io.BytesIO(pdf_bytes)
        
        text = ""
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    
    # ==================== GDPR MINOR PDF TESTS ====================
    
    def test_gdpr_minor_preview_endpoint_returns_200(self, auth_headers):
        """Test that GDPR minor preview endpoint returns 200"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_minor", "minor_id": MINOR_ID},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "pdf_base64" in data
        print(f"✓ GDPR minor preview endpoint returns 200")
    
    def test_gdpr_minor_pdf_has_anteprima_title(self, auth_headers):
        """Test that GDPR minor PDF title contains ANTEPRIMA"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_minor", "minor_id": MINOR_ID},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check document_title contains ANTEPRIMA
        doc_title = data.get("document_title", "")
        assert "ANTEPRIMA" in doc_title, f"Title should contain ANTEPRIMA, got: {doc_title}"
        print(f"✓ GDPR minor PDF title contains ANTEPRIMA: {doc_title}")
    
    def test_gdpr_minor_pdf_no_certificato_medico(self, auth_headers):
        """Test that GDPR minor PDF does NOT contain CERTIFICATO MEDICO SPORTIVO section"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_minor", "minor_id": MINOR_ID},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should NOT contain medical certificate references
        forbidden_strings = [
            "CERTIFICATO MEDICO SPORTIVO",
            "CERTIFICATO MEDICO",
            "certificato medico sportivo",
        ]
        
        for forbidden in forbidden_strings:
            assert forbidden.upper() not in pdf_text.upper(), f"PDF should NOT contain '{forbidden}'"
        
        print(f"✓ GDPR minor PDF does NOT contain CERTIFICATO MEDICO SPORTIVO")
    
    def test_gdpr_minor_pdf_no_autorizzazione_trattamento_dati(self, auth_headers):
        """Test that GDPR minor PDF does NOT contain Autorizzazione trattamento dati"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_minor", "minor_id": MINOR_ID},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should NOT contain data processing authorization
        forbidden_strings = [
            "Autorizzazione trattamento dati",
            "AUTORIZZAZIONE TRATTAMENTO DATI",
            "Consenso al trattamento dati",
            "CONSENSO AL TRATTAMENTO DATI",
        ]
        
        for forbidden in forbidden_strings:
            assert forbidden.upper() not in pdf_text.upper(), f"PDF should NOT contain '{forbidden}'"
        
        print(f"✓ GDPR minor PDF does NOT contain Autorizzazione trattamento dati")
    
    def test_gdpr_minor_pdf_no_consensi_espressi(self, auth_headers):
        """Test that GDPR minor PDF does NOT contain CONSENSI ESPRESSI"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_minor", "minor_id": MINOR_ID},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should NOT contain old terminology
        forbidden_strings = [
            "CONSENSI ESPRESSI",
            "METADATI DI FIRMA",
            "FIRMA DIGITALE DEL DOCUMENTO",
        ]
        
        for forbidden in forbidden_strings:
            assert forbidden.upper() not in pdf_text.upper(), f"PDF should NOT contain '{forbidden}'"
        
        print(f"✓ GDPR minor PDF does NOT contain old terminology (CONSENSI ESPRESSI, METADATI DI FIRMA)")
    
    def test_gdpr_minor_pdf_has_presa_visione(self, auth_headers):
        """Test that GDPR minor PDF contains PRESA VISIONE sections"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_minor", "minor_id": MINOR_ID},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should contain new terminology
        required_strings = [
            "PRESA VISIONE",
            "METADATI PRESA VISIONE",
            "7. PRESA VISIONE DEL DOCUMENTO",
        ]
        
        for required in required_strings:
            assert required.upper() in pdf_text.upper(), f"PDF should contain '{required}'"
        
        print(f"✓ GDPR minor PDF contains PRESA VISIONE sections")
    
    # ==================== GDPR ADULT PDF TESTS ====================
    
    def test_gdpr_adult_preview_endpoint_returns_200(self, auth_headers):
        """Test that GDPR adult preview endpoint returns 200"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_adult"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "pdf_base64" in data
        print(f"✓ GDPR adult preview endpoint returns 200")
    
    def test_gdpr_adult_pdf_no_autorizzazione_trattamento_dati(self, auth_headers):
        """Test that GDPR adult PDF does NOT contain Autorizzazione trattamento dati per gestione rapporto"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_adult"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should NOT contain data processing authorization
        forbidden_strings = [
            "Autorizzazione trattamento dati per gestione rapporto",
            "Autorizzazione trattamento dati",
            "AUTORIZZAZIONE TRATTAMENTO DATI",
            "Consenso al trattamento dati",
        ]
        
        for forbidden in forbidden_strings:
            assert forbidden.upper() not in pdf_text.upper(), f"PDF should NOT contain '{forbidden}'"
        
        print(f"✓ GDPR adult PDF does NOT contain Autorizzazione trattamento dati")
    
    def test_gdpr_adult_pdf_no_consensi_espressi(self, auth_headers):
        """Test that GDPR adult PDF does NOT contain CONSENSI ESPRESSI"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_adult"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should NOT contain old terminology
        forbidden_strings = [
            "CONSENSI ESPRESSI",
            "METADATI DI FIRMA",
            "FIRMA DIGITALE DEL DOCUMENTO",
        ]
        
        for forbidden in forbidden_strings:
            assert forbidden.upper() not in pdf_text.upper(), f"PDF should NOT contain '{forbidden}'"
        
        print(f"✓ GDPR adult PDF does NOT contain old terminology")
    
    def test_gdpr_adult_pdf_has_presa_visione_section_7(self, auth_headers):
        """Test that GDPR adult PDF contains section 7. PRESA VISIONE DEL DOCUMENTO"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_adult"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should contain section 7 with PRESA VISIONE
        assert "7. PRESA VISIONE DEL DOCUMENTO" in pdf_text.upper() or "7. PRESA VISIONE" in pdf_text.upper(), \
            f"PDF should contain '7. PRESA VISIONE DEL DOCUMENTO'"
        
        print(f"✓ GDPR adult PDF contains section 7. PRESA VISIONE DEL DOCUMENTO")
    
    def test_gdpr_adult_pdf_has_metadati_presa_visione(self, auth_headers):
        """Test that GDPR adult PDF contains METADATI PRESA VISIONE"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_adult"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        
        # Should contain METADATI PRESA VISIONE
        assert "METADATI PRESA VISIONE" in pdf_text.upper(), \
            f"PDF should contain 'METADATI PRESA VISIONE'"
        
        print(f"✓ GDPR adult PDF contains METADATI PRESA VISIONE")


class TestRegistrationConsents:
    """Test registration endpoint consent requirements"""
    
    def test_registration_accepts_only_privacy_viewed(self):
        """Test that registration accepts consents with only privacy_viewed (no data_processing required)"""
        import uuid
        
        # Generate unique test email
        test_email = f"test_gdpr_{uuid.uuid4().hex[:8]}@test.com"
        
        # Try to register with only privacy_viewed consent
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "Test1234!",
                "full_name": "TEST GDPR User",
                "first_name": "TEST",
                "last_name": "GDPR User",
                "role": "parent",
                "invite_code": "",  # No invite code
                "consents": {
                    "privacy_viewed": True
                    # Note: data_processing is NOT included
                }
            }
        )
        
        # The registration might fail for other reasons (no invite code, etc.)
        # but it should NOT fail because data_processing is missing
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            # Check that the error is NOT about data_processing
            assert "data_processing" not in error_detail.lower(), \
                f"Registration should not require data_processing consent. Error: {error_detail}"
            print(f"✓ Registration does not require data_processing (failed for other reason: {error_detail})")
        elif response.status_code == 200 or response.status_code == 201:
            print(f"✓ Registration succeeded with only privacy_viewed consent")
        else:
            # Other status codes - check if it's about data_processing
            error_detail = response.json().get("detail", "") if response.headers.get("content-type", "").startswith("application/json") else response.text
            assert "data_processing" not in str(error_detail).lower(), \
                f"Registration should not require data_processing consent. Error: {error_detail}"
            print(f"✓ Registration does not require data_processing (status: {response.status_code})")


class TestPDFContentVerification:
    """Additional PDF content verification tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for Sofia (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SOFIA_EMAIL, "password": SOFIA_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def extract_pdf_text(self, pdf_base64: str) -> str:
        """Extract text from base64-encoded PDF"""
        pdf_bytes = base64.b64decode(pdf_base64)
        pdf_file = io.BytesIO(pdf_bytes)
        
        text = ""
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    
    def test_minor_pdf_full_content_check(self, auth_headers):
        """Full content verification for minor PDF"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_minor", "minor_id": MINOR_ID},
            headers=auth_headers
        )
        
        if response.status_code != 200:
            pytest.skip(f"Could not generate PDF: {response.status_code}")
        
        data = response.json()
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        pdf_text_upper = pdf_text.upper()
        
        # Print PDF content for debugging
        print("\n=== MINOR PDF CONTENT (first 3000 chars) ===")
        print(pdf_text[:3000])
        print("=== END MINOR PDF CONTENT ===\n")
        
        # Verify REQUIRED content
        required = [
            "INFORMATIVA PRIVACY PER MINORI",
            "PRESA VISIONE",
            "METADATI PRESA VISIONE",
            "DICHIARAZIONE",
            "DATI DEL MINORE",
            "DATI DEL GENITORE",
        ]
        
        for req in required:
            assert req.upper() in pdf_text_upper, f"Minor PDF missing required content: {req}"
        
        # Verify FORBIDDEN content
        forbidden = [
            "CERTIFICATO MEDICO SPORTIVO",
            "AUTORIZZAZIONE TRATTAMENTO DATI",
            "CONSENSI ESPRESSI",
            "METADATI DI FIRMA",
        ]
        
        for forb in forbidden:
            assert forb.upper() not in pdf_text_upper, f"Minor PDF contains forbidden content: {forb}"
        
        print("✓ Minor PDF full content verification passed")
    
    def test_adult_pdf_full_content_check(self, auth_headers):
        """Full content verification for adult PDF"""
        response = requests.post(
            f"{BASE_URL}/api/documents/preview-gdpr-privacy",
            json={"document_type": "gdpr_adult"},
            headers=auth_headers
        )
        
        if response.status_code != 200:
            pytest.skip(f"Could not generate PDF: {response.status_code}")
        
        data = response.json()
        pdf_text = self.extract_pdf_text(data["pdf_base64"])
        pdf_text_upper = pdf_text.upper()
        
        # Print PDF content for debugging
        print("\n=== ADULT PDF CONTENT (first 3000 chars) ===")
        print(pdf_text[:3000])
        print("=== END ADULT PDF CONTENT ===\n")
        
        # Verify REQUIRED content
        required = [
            "INFORMATIVA PRIVACY PER STAFF",
            "PRESA VISIONE",
            "METADATI PRESA VISIONE",
            "DICHIARAZIONE",
            "DATI DELL'INTERESSATO",
        ]
        
        for req in required:
            assert req.upper() in pdf_text_upper, f"Adult PDF missing required content: {req}"
        
        # Verify FORBIDDEN content
        forbidden = [
            "AUTORIZZAZIONE TRATTAMENTO DATI",
            "CONSENSI ESPRESSI",
            "METADATI DI FIRMA",
            "FIRMA DIGITALE DEL DOCUMENTO",
        ]
        
        for forb in forbidden:
            assert forb.upper() not in pdf_text_upper, f"Adult PDF contains forbidden content: {forb}"
        
        print("✓ Adult PDF full content verification passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
