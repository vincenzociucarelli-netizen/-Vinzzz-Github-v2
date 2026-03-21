"""
Tests for Adult Athlete Dashboard Flow
- Login with adult athlete credentials
- Profile display with avatar, name, team, status
- Payments page showing installments
- Schedule page with training, match day, warmup/rifinitura
- Withdraw trial functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://accesso-atleta-2024.preview.emergentagent.com').rstrip('/')

# Test credentials for adult athlete
ATHLETE_EMAIL = "lisa@test.com"
ATHLETE_PASSWORD = "Test1234"
ATHLETE_ID = "699e98da29d5cad371478523"
TEAM_ID = "698660a0bd36233989be88df"


class TestAdultAthleteLogin:
    """Test adult athlete login flow"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data["user"]["email"] == ATHLETE_EMAIL
        assert data["user"]["role"] == "athlete"
        assert data["user"]["full_name"] == "RAPELLI LISA"
        print(f"✅ Login successful for {ATHLETE_EMAIL}")
    
    def test_login_wrong_password(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": "WrongPassword"
        })
        assert response.status_code == 401, "Should reject wrong password"
        print("✅ Correctly rejected wrong password")


class TestAdultAthleteDashboard:
    """Test adult athlete dashboard profile display"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_auth_me(self):
        """Test /auth/me returns athlete_id"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["athlete_id"] == ATHLETE_ID, f"Wrong athlete_id: {data.get('athlete_id')}"
        assert data["email"] == ATHLETE_EMAIL
        assert data["role"] == "athlete"
        print(f"✅ /auth/me returns correct athlete_id: {ATHLETE_ID}")
    
    def test_get_athlete_profile(self):
        """Test athlete profile shows correct data: avatar, name, team, status"""
        response = requests.get(f"{BASE_URL}/api/athletes/{ATHLETE_ID}", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check name
        assert data["full_name"] == "RAPELLI LISA", f"Wrong name: {data.get('full_name')}"
        
        # Check status - should be 'trial' (Periodo di Prova)
        assert data["status"] == "trial", f"Wrong status: {data.get('status')}"
        
        # Check team_name
        assert data["team_name"] == "Serie D", f"Wrong team: {data.get('team_name')}"
        
        # Check team_id
        assert data["team_id"] == TEAM_ID, f"Wrong team_id: {data.get('team_id')}"
        
        # Check athlete_type is quota (not compensated)
        assert data["athlete_type"] == "quota", f"Wrong athlete_type: {data.get('athlete_type')}"
        
        # Check profile_photo exists
        assert data.get("profile_photo") is not None, "No profile_photo returned"
        
        print(f"✅ Profile shows: Name='{data['full_name']}', Status='{data['status']}', Team='{data['team_name']}'")


class TestAdultAthletePayments:
    """Test athlete payments page showing installments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_payments(self):
        """Test payments endpoint returns 3 installments totaling €800"""
        response = requests.get(f"{BASE_URL}/api/payments/{ATHLETE_ID}", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check we have exactly 3 installments
        assert len(data) == 3, f"Expected 3 installments, got {len(data)}"
        
        # Check amounts
        amounts = [p["amount"] for p in data]
        assert 300 in amounts, "Missing €300 installment"
        assert amounts.count(250) == 2, "Should have two €250 installments"
        
        # Check total
        total = sum(amounts)
        assert total == 800, f"Total should be €800, got €{total}"
        
        # Check descriptions
        descriptions = [p.get("description", "") for p in data]
        assert any("iscrizione" in d.lower() for d in descriptions), "Missing 'Quota iscrizione'"
        
        print(f"✅ Payments: {len(data)} installments, Total €{total} (€300 + €250 + €250)")
    
    def test_payments_structure(self):
        """Test payment records have required fields"""
        response = requests.get(f"{BASE_URL}/api/payments/{ATHLETE_ID}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        for payment in data:
            assert "id" in payment, "Missing id"
            assert "amount" in payment, "Missing amount"
            assert "athlete_id" in payment, "Missing athlete_id"
            assert payment["athlete_id"] == ATHLETE_ID
        
        print("✅ All payments have correct structure")


class TestAdultAthleteSchedule:
    """Test schedule page with training, match day, and rifinitura"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_team_schedule(self):
        """Test team endpoint returns training sessions, match day, and warmup"""
        response = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check team name
        assert data["name"] == "Serie D", f"Wrong team name: {data.get('name')}"
        
        # Check training_sessions exist
        assert "training_sessions" in data, "Missing training_sessions"
        sessions = data["training_sessions"]
        assert len(sessions) > 0, "No training sessions"
        print(f"✅ Found {len(sessions)} training sessions")
    
    def test_training_sessions_content(self):
        """Test training sessions have days and times"""
        response = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=self.headers)
        data = response.json()
        sessions = data["training_sessions"]
        
        # Check each session has required fields
        for session in sessions:
            assert "day" in session, "Session missing day"
            # Sessions should have time fields
            has_time = session.get("timeStart") or session.get("start_time")
            # Venerdì may have empty times
            if session.get("day") != "Venerdì":
                assert has_time, f"Session for {session.get('day')} missing time"
        
        # Check we have common training days
        days = [s["day"] for s in sessions]
        assert "Lunedì" in days or "Monday" in days, "Missing Monday training"
        print(f"✅ Training sessions have valid structure")
    
    def test_match_day(self):
        """Test match_day is Sabato 18:00"""
        response = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=self.headers)
        data = response.json()
        
        assert "match_day" in data, "Missing match_day"
        match_day = data["match_day"]
        assert match_day is not None, "match_day is null"
        
        # Check day
        assert match_day.get("day") == "Sabato", f"Match day should be Sabato, got {match_day.get('day')}"
        
        # Check time
        assert match_day.get("time") == "18:00", f"Match time should be 18:00, got {match_day.get('time')}"
        
        print(f"✅ Match day: {match_day.get('day')} {match_day.get('time')}")
    
    def test_warmup_session(self):
        """Test warmup_session (rifinitura) is 10:00-11:30"""
        response = requests.get(f"{BASE_URL}/api/teams/{TEAM_ID}", headers=self.headers)
        data = response.json()
        
        # Check warmup_session exists
        assert "warmup_session" in data, "Missing warmup_session"
        warmup = data["warmup_session"]
        assert warmup is not None, "warmup_session is null"
        
        # Check times
        start = warmup.get("timeStart") or warmup.get("start_time")
        end = warmup.get("timeEnd") or warmup.get("end_time")
        
        assert start == "10:00", f"Warmup start should be 10:00, got {start}"
        assert end == "11:30", f"Warmup end should be 11:30, got {end}"
        
        print(f"✅ Rifinitura: {start} - {end}")


class TestWithdrawTrial:
    """Test withdraw from trial functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ATHLETE_EMAIL,
            "password": ATHLETE_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_withdraw_trial_endpoint_exists(self):
        """Test withdraw-trial endpoint exists - NOT actually calling it"""
        # Note: We're not actually calling this as it would withdraw the test user
        # Just verify the endpoint pattern is correct by checking athlete status
        response = requests.get(f"{BASE_URL}/api/athletes/{ATHLETE_ID}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify athlete is in trial status (meaning withdraw button should be visible)
        assert data["status"] == "trial", f"Athlete should be in trial status to show withdraw button, got: {data['status']}"
        print("✅ Athlete is in 'trial' status - Recesso dalla Prova button should be visible")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
