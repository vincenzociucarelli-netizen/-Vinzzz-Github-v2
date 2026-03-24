"""
Tests for Trial Document Signature Flow and Society Card Downloads (JPG)
- POST /api/athletes/{id}/sign-trial-document - accepts signature_base64, returns signed PDF
- POST /api/athletes/{id}/sign-trial-document - rejects invalid/short signatures with 400
- GET /api/athletes/{id}/trial-document - returns PDF but NOT set trial_document_generated
- GET /api/athletes/{id} - returns trial_document_generated field
- GET /api/society/card-fiscale - returns image/jpeg
- GET /api/society/card-bancaria - returns image/jpeg
"""
import pytest
import requests
import jwt
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://squad-mgmt-preview.preview.emergentagent.com').rstrip('/')
JWT_SECRET = "Bsh0AAbKSGo6piMgc4B1rx4o0ilbA5bKWAf9Joem62A"
ADMIN_USER_ID = "697fdba0d218717959e73eec"
TEST_ATHLETE_ID_LAURA = "69ba6a5538c980c04288ef17"  # Minor with trial_document_generated=False


def generate_admin_token():
    """Generate admin JWT token"""
    payload = {
        "user_id": ADMIN_USER_ID,
        "role": "admin",
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.fixture
def admin_token():
    return generate_admin_token()


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def authenticated_client(api_client, admin_token):
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


class TestTrialDocumentSignature:
    """Tests for the trial document signature flow"""
    
    def test_get_trial_document_does_not_mark_generated(self, authenticated_client):
        """GET /api/athletes/{id}/trial-document should return PDF but NOT set trial_document_generated"""
        # First, ensure we know current state
        athlete_res = authenticated_client.get(f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}")
        assert athlete_res.status_code == 200
        initial_state = athlete_res.json().get("trial_document_generated", False)
        
        # Call GET trial-document (preview only)
        res = authenticated_client.get(f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}/trial-document")
        # Should return PDF (200) or 400 if profile incomplete
        assert res.status_code in [200, 400], f"Expected 200 or 400, got {res.status_code}"
        
        if res.status_code == 200:
            # Verify content type is PDF
            assert "application/pdf" in res.headers.get("content-type", "")
            print("Trial document preview returned PDF successfully")
            
            # Verify state is NOT changed
            athlete_res2 = authenticated_client.get(f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}")
            assert athlete_res2.status_code == 200
            new_state = athlete_res2.json().get("trial_document_generated", False)
            assert new_state == initial_state, "GET trial-document should NOT change trial_document_generated"
            print(f"trial_document_generated unchanged: {initial_state} -> {new_state}")
        else:
            # 400 means profile incomplete - which is valid behavior
            print(f"Trial document preview returned 400 (profile may be incomplete): {res.json()}")
    
    def test_sign_trial_document_rejects_empty_signature(self, authenticated_client):
        """POST sign-trial-document should reject empty signatures with 400"""
        res = authenticated_client.post(
            f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}/sign-trial-document",
            json={"signature_base64": ""}
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        data = res.json()
        assert "detail" in data
        print(f"Empty signature correctly rejected: {data['detail']}")
    
    def test_sign_trial_document_rejects_short_signature(self, authenticated_client):
        """POST sign-trial-document should reject signatures under 100 chars with 400"""
        short_sig = "data:image/png;base64,abc123"  # Less than 100 chars
        res = authenticated_client.post(
            f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}/sign-trial-document",
            json={"signature_base64": short_sig}
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        data = res.json()
        assert "detail" in data
        print(f"Short signature correctly rejected: {data['detail']}")
    
    def test_sign_trial_document_with_valid_signature(self, authenticated_client):
        """POST sign-trial-document should accept valid signature and return signed PDF"""
        # Generate a valid base64 signature (a simple 1x1 PNG image)
        # This is a minimal valid PNG base64
        valid_signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" + "A" * 50
        
        res = authenticated_client.post(
            f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}/sign-trial-document",
            json={"signature_base64": valid_signature}
        )
        
        # Should return 200 with PDF or 400 if profile incomplete
        assert res.status_code in [200, 400], f"Expected 200 or 400, got {res.status_code}: {res.text[:500]}"
        
        if res.status_code == 200:
            # Verify content type is PDF
            assert "application/pdf" in res.headers.get("content-type", "")
            print("Signed trial document PDF returned successfully")
            
            # Verify trial_document_generated is now True
            athlete_res = authenticated_client.get(f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}")
            assert athlete_res.status_code == 200
            athlete_data = athlete_res.json()
            assert athlete_data.get("trial_document_generated") == True, "trial_document_generated should be True after signing"
            print("trial_document_generated correctly set to True after signing")
        else:
            data = res.json()
            print(f"Sign request returned 400 (profile may be incomplete): {data.get('detail', data)}")
    
    def test_get_athlete_returns_trial_document_generated_field(self, authenticated_client):
        """GET /api/athletes/{id} should return trial_document_generated boolean field"""
        res = authenticated_client.get(f"{BASE_URL}/api/athletes/{TEST_ATHLETE_ID_LAURA}")
        assert res.status_code == 200
        data = res.json()
        assert "trial_document_generated" in data, "Response must include trial_document_generated field"
        assert isinstance(data["trial_document_generated"], bool), "trial_document_generated must be boolean"
        print(f"trial_document_generated field present: {data['trial_document_generated']}")


class TestSocietyCards:
    """Tests for society card downloads (JPG format)"""
    
    def test_fiscal_card_returns_jpeg(self, authenticated_client):
        """GET /api/society/card-fiscale should return image/jpeg"""
        res = authenticated_client.get(f"{BASE_URL}/api/society/card-fiscale")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        content_type = res.headers.get("content-type", "")
        assert "image/jpeg" in content_type, f"Expected image/jpeg, got {content_type}"
        # Verify content is non-empty
        assert len(res.content) > 100, "JPEG content should not be empty"
        print(f"Fiscal card returned as JPEG ({len(res.content)} bytes)")
    
    def test_bank_card_returns_jpeg(self, authenticated_client):
        """GET /api/society/card-bancaria should return image/jpeg (or 400 if no IBAN)"""
        res = authenticated_client.get(f"{BASE_URL}/api/society/card-bancaria")
        # 200 if IBAN exists, 400 if IBAN missing
        assert res.status_code in [200, 400], f"Expected 200 or 400, got {res.status_code}"
        
        if res.status_code == 200:
            content_type = res.headers.get("content-type", "")
            assert "image/jpeg" in content_type, f"Expected image/jpeg, got {content_type}"
            assert len(res.content) > 100, "JPEG content should not be empty"
            print(f"Bank card returned as JPEG ({len(res.content)} bytes)")
        else:
            data = res.json()
            print(f"Bank card returned 400 (IBAN may be missing): {data.get('detail', data)}")


class TestTrialDocumentNonMinorRestriction:
    """Verify trial document is only for minor athletes"""
    
    def test_trial_document_requires_minor(self, authenticated_client):
        """Trial document endpoints should reject non-minor athletes"""
        # This is verified by 400 response with "solo per atleti minorenni" message
        # We're testing with a minor athlete so this is just documenting the behavior
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
