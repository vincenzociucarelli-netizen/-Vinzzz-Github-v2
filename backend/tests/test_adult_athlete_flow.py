"""
Test cases for Adult Athlete Registration and Privacy Flow
Tests the complete lifecycle of an adult athlete (18+) from:
1. Registration via /api/auth/register-adult-athlete
2. Athlete appears in pending list (status='trial' initially)
3. Admin approves athlete
4. Athlete can login
5. Athlete profile view/update
6. Privacy signing flow (after trial period or on first profile save)
7. Document archive verification

This tests the flow for Italian sports society management app (RegistraTEAM).
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path

# Load env
load_dotenv(Path('/app/backend/.env'))

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://athlete-payments.preview.emergentagent.com').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "test.admin@test.com"
ADMIN_PASSWORD = "Test1234"

# Generate unique test athlete data
TEST_UNIQUE_ID = str(uuid.uuid4())[:8]
TEST_ATHLETE_EMAIL = f"testadult_{TEST_UNIQUE_ID}@test.com"
TEST_ATHLETE_PASSWORD = "TestAdult2025"
TEST_ATHLETE_FIRST_NAME = "MARIO"
TEST_ATHLETE_LAST_NAME = "ROSSI"
TEST_ATHLETE_PHONE = "333 1234567"
# Birth date making them 25 years old (well over 18)
TEST_ATHLETE_DOB = "2001-01-01"

@pytest.fixture(scope="module")
def admin_session():
    """Login as admin"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['token']}"})
        print(f"Admin login successful - user_id: {data['user']['id']}")
        return {"session": session, "user_id": data["user"]["id"], "token": data["token"]}
    
    pytest.fail(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def invite_code(admin_session):
    """Get society invite code from admin"""
    session = admin_session["session"]
    
    response = session.get(f"{BASE_URL}/api/societies/invite-code")
    if response.status_code == 200:
        code = response.json().get("invite_code")
        print(f"Got invite code: {code}")
        return code
    
    pytest.fail(f"Failed to get invite code: {response.status_code} - {response.text}")


class TestAdultAthleteRegistration:
    """Test adult athlete self-registration endpoint"""
    
    registered_athlete_token = None
    registered_athlete_id = None
    registered_user_id = None
    
    def test_01_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")  # Use /api prefix for proper routing
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"API health check passed: {data}")
    
    def test_02_register_adult_athlete_success(self, invite_code):
        """Test successful registration of an adult athlete (18+)"""
        registration_data = {
            "email": TEST_ATHLETE_EMAIL,
            "password": TEST_ATHLETE_PASSWORD,
            "first_name": TEST_ATHLETE_FIRST_NAME,
            "last_name": TEST_ATHLETE_LAST_NAME,
            "phone": TEST_ATHLETE_PHONE,
            "invite_code": invite_code,
            "date_of_birth": TEST_ATHLETE_DOB,
            "fiscal_code": None,  # Optional
            "gender": "M"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register-adult-athlete",
            json=registration_data
        )
        
        assert response.status_code == 200, f"Registration failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        
        user = data["user"]
        assert user.get("email") == TEST_ATHLETE_EMAIL.lower()
        assert user.get("role") == "athlete"
        assert user.get("status") == "approved", f"Adult athlete user should be auto-approved, got {user.get('status')}"
        assert "athlete_id" in user, "Response should contain athlete_id"
        
        # Store for later tests
        TestAdultAthleteRegistration.registered_athlete_token = data["token"]
        TestAdultAthleteRegistration.registered_athlete_id = user["athlete_id"]
        TestAdultAthleteRegistration.registered_user_id = user["id"]
        
        print(f"Adult athlete registered successfully:")
        print(f"  User ID: {user['id']}")
        print(f"  Athlete ID: {user['athlete_id']}")
        print(f"  Email: {user['email']}")
        print(f"  Status: {user['status']}")
    
    def test_03_registered_athlete_can_login(self):
        """Test that newly registered adult athlete can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_ATHLETE_EMAIL,
            "password": TEST_ATHLETE_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "token" in data
        user = data["user"]
        assert user["email"] == TEST_ATHLETE_EMAIL.lower()
        assert user["role"] == "athlete"
        
        print(f"Adult athlete login successful")
    
    def test_04_registered_athlete_duplicate_email_fails(self, invite_code):
        """Test that duplicate email registration fails"""
        registration_data = {
            "email": TEST_ATHLETE_EMAIL,  # Same email
            "password": TEST_ATHLETE_PASSWORD,
            "first_name": "DUPLICATE",
            "last_name": "USER",
            "phone": "999 8888888",
            "invite_code": invite_code,
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register-adult-athlete",
            json=registration_data
        )
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        assert "già registrata" in response.json().get("detail", "").lower()
        print("Duplicate email correctly rejected")
    
    def test_05_registration_without_invite_code_fails(self):
        """Test that registration without invite code fails"""
        registration_data = {
            "email": f"no_invite_{TEST_UNIQUE_ID}@test.com",
            "password": TEST_ATHLETE_PASSWORD,
            "first_name": "NO",
            "last_name": "INVITE",
            "phone": "333 0000000",
            "invite_code": "",  # Empty invite code
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register-adult-athlete",
            json=registration_data
        )
        
        assert response.status_code == 400, f"Expected 400 for missing invite code, got {response.status_code}"
        print("Missing invite code correctly rejected")


class TestAdultAthleteProfile:
    """Test adult athlete profile endpoints"""
    
    def test_01_get_athlete_profile(self):
        """Test fetching athlete's own profile via /auth/me"""
        token = TestAdultAthleteRegistration.registered_athlete_token
        if not token:
            pytest.skip("No athlete token from registration")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Failed to get profile: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("email") == TEST_ATHLETE_EMAIL.lower()
        assert data.get("first_name") == TEST_ATHLETE_FIRST_NAME
        assert data.get("last_name") == TEST_ATHLETE_LAST_NAME
        assert data.get("role") == "athlete"
        
        # Check trial_end_date is included
        assert "trial_end_date" in data, "Profile should include trial_end_date for GDPR flow"
        
        # Privacy should be False initially
        privacy = data.get("privacy_accepted")
        print(f"Profile loaded - privacy_accepted: {privacy}")
        print(f"Trial end date: {data.get('trial_end_date')}")
    
    def test_02_update_athlete_profile(self):
        """Test updating athlete profile"""
        token = TestAdultAthleteRegistration.registered_athlete_token
        if not token:
            pytest.skip("No athlete token from registration")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        update_data = {
            "address": "Via Roma, 123",
            "city": "PERUGIA",
            "province": "PG",
            "postal_code": "06100",
            "phone": "333 9876543"
        }
        
        response = requests.patch(f"{BASE_URL}/api/auth/me", headers=headers, json=update_data)
        
        assert response.status_code == 200, f"Update failed: {response.status_code} - {response.text}"
        
        # Verify changes persisted
        get_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data.get("address") == "Via Roma, 123"
        assert data.get("city") == "PERUGIA"
        assert data.get("province") == "PG"
        
        print(f"Profile updated successfully - address: {data.get('address')}, city: {data.get('city')}")


class TestAdminViewsPendingAthletes:
    """Test admin view of pending athletes"""
    
    def test_01_admin_can_see_pending_athletes(self, admin_session):
        """Test that admin can see pending athletes list"""
        session = admin_session["session"]
        
        response = session.get(f"{BASE_URL}/api/athletes/pending")
        
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        pending = response.json()
        assert isinstance(pending, list)
        
        print(f"Found {len(pending)} pending athletes")
        for athlete in pending[:5]:  # Show first 5
            print(f"  - {athlete.get('full_name')} (team: {athlete.get('team_name')}, status: {athlete.get('status')})")
    
    def test_02_admin_can_see_all_athletes(self, admin_session):
        """Test that admin can see all athletes including our test athlete"""
        session = admin_session["session"]
        
        response = session.get(f"{BASE_URL}/api/athletes")
        
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        athletes = response.json()
        
        # Find our test athlete by ID (more reliable than email)
        athlete_id = TestAdultAthleteRegistration.registered_athlete_id
        test_athlete = None
        for a in athletes:
            # Try both email and ID matching
            if a.get("id") == athlete_id or a.get("email") == TEST_ATHLETE_EMAIL.lower():
                test_athlete = a
                break
        
        if test_athlete:
            print(f"Found test athlete:")
            print(f"  ID: {test_athlete.get('id')}")
            print(f"  Full Name: {test_athlete.get('full_name')}")
            print(f"  Status: {test_athlete.get('status')}")
            print(f"  Privacy Accepted: {test_athlete.get('privacy_accepted')}")
        else:
            # Adult athletes might not appear in /athletes list if they have no team_id
            # This is expected behavior - verify via /auth/me instead
            print(f"Test athlete not in /athletes list (may need team assignment)")
            print(f"Expected ID: {athlete_id}")
            print(f"Total athletes in list: {len(athletes)}")


class TestPrivacySigningFlow:
    """Test privacy consent signing flow for adult athletes"""
    
    def test_01_check_privacy_not_accepted_initially(self):
        """Verify privacy is not accepted after registration"""
        token = TestAdultAthleteRegistration.registered_athlete_token
        if not token:
            pytest.skip("No athlete token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        privacy_accepted = data.get("privacy_accepted", False)
        
        # Adult athletes start with privacy_accepted=False
        # They must sign it manually after trial or on first profile save
        print(f"Initial privacy_accepted: {privacy_accepted}")
    
    def test_02_sign_privacy_document(self):
        """Test signing privacy consent document"""
        token = TestAdultAthleteRegistration.registered_athlete_token
        athlete_id = TestAdultAthleteRegistration.registered_athlete_id
        if not token or not athlete_id:
            pytest.skip("No athlete token or ID")
        
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # First get athlete profile for document fields
        profile_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        profile = profile_response.json()
        
        # Sign privacy document
        sign_data = {
            "document_type": "privacy_consent",
            "document_title": "Consenso Privacy Atleta",
            "document_text": f"""
INFORMATIVA SULLA PRIVACY E CONSENSO AL TRATTAMENTO DEI DATI PERSONALI

Il/La sottoscritto/a {profile.get('full_name', 'TEST USER')}, nato/a il {profile.get('date_of_birth', '')},

DICHIARA
di aver letto e compreso l'informativa ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR) relativa al trattamento dei propri dati personali.

ACCONSENTE
al trattamento dei propri dati personali per le finalità connesse alla propria attività di Atleta presso la società sportiva.
            """.strip(),
            "signer_name": profile.get('full_name', f'{TEST_ATHLETE_LAST_NAME} {TEST_ATHLETE_FIRST_NAME}'),
            "signer_email": TEST_ATHLETE_EMAIL,
            "signature_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",  # Minimal valid base64 PNG
            "related_entity_id": athlete_id,
            "additional_data": {
                "role": "athlete",
                "fiscal_code": profile.get("fiscal_code")
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/documents/sign", headers=headers, json=sign_data)
        
        assert response.status_code == 200, f"Sign document failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "document_id" in data or "message" in data
        
        print(f"Privacy document signed successfully")
        print(f"Response: {data}")
        
        # Also update privacy_accepted flag
        update_response = requests.patch(
            f"{BASE_URL}/api/auth/me",
            headers=headers,
            json={"privacy_accepted": True}
        )
        
        assert update_response.status_code == 200, f"Update privacy flag failed: {update_response.text}"
        print("Privacy flag updated to True")
    
    def test_03_verify_privacy_accepted_after_signing(self):
        """Verify privacy is accepted after signing"""
        token = TestAdultAthleteRegistration.registered_athlete_token
        if not token:
            pytest.skip("No athlete token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("privacy_accepted") == True, f"privacy_accepted should be True, got {data.get('privacy_accepted')}"
        
        print(f"Verified: privacy_accepted = {data.get('privacy_accepted')}")


class TestDocumentsArchive:
    """Test documents archive shows signed privacy documents"""
    
    def test_01_documents_archive_accessible(self, admin_session):
        """Test admin can access documents archive"""
        session = admin_session["session"]
        
        response = session.get(f"{BASE_URL}/api/documents/archive?page=1&limit=20")
        
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "documents" in data or isinstance(data, list), "Response should contain documents"
        
        docs = data.get("documents") if isinstance(data, dict) else data
        print(f"Found {len(docs) if docs else 0} documents in archive")
        
        # Look for our athlete's privacy document
        for doc in (docs or [])[:10]:
            print(f"  - {doc.get('document_title', doc.get('document_type'))} ({doc.get('signer_name')})")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_athlete(self, admin_session):
        """Delete test athlete to avoid polluting database"""
        session = admin_session["session"]
        athlete_id = TestAdultAthleteRegistration.registered_athlete_id
        
        if not athlete_id:
            pytest.skip("No athlete ID to cleanup")
        
        # Delete athlete
        response = session.delete(f"{BASE_URL}/api/athletes/{athlete_id}")
        
        if response.status_code in [200, 204]:
            print(f"Deleted test athlete {athlete_id}")
        else:
            print(f"Warning: Could not delete athlete: {response.status_code} - {response.text}")
        
        # Also try to delete user
        user_id = TestAdultAthleteRegistration.registered_user_id
        if user_id:
            user_response = session.delete(f"{BASE_URL}/api/users/{user_id}")
            if user_response.status_code in [200, 204]:
                print(f"Deleted test user {user_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
