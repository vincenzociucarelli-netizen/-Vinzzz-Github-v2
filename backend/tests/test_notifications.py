"""
Test cases for /api/notifications/expiring endpoint
This endpoint returns expiring notifications for:
1. Adult athletes in their dashboard
2. Parents of minors in their dashboard
Notifications show: certificate expirations, payment due dates with amounts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://prova-system.preview.emergentagent.com').rstrip('/')


class TestNotificationsEndpoint:
    """Test the /api/notifications/expiring endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test by logging in as Genny (adult athlete)"""
        # Login as adult athlete
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "genny@test.com",
            "password": "Test1234"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.user = response.json()["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_notifications_endpoint_returns_200(self):
        """Test that endpoint returns 200 status code"""
        response = requests.get(f"{BASE_URL}/api/notifications/expiring", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Endpoint returns 200 OK")
    
    def test_notifications_response_structure(self):
        """Test that response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/notifications/expiring", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data, "Response should have 'notifications' key"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        print(f"✓ Response structure is correct")
    
    def test_certificate_notification_structure(self):
        """Test that certificate notifications have correct fields"""
        response = requests.get(f"{BASE_URL}/api/notifications/expiring", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        notifications = data["notifications"]
        
        # Find certificate notification
        cert_notifs = [n for n in notifications if n.get("type") == "certificate"]
        
        if cert_notifs:
            notif = cert_notifs[0]
            assert "type" in notif, "Should have 'type' field"
            assert "athlete_id" in notif, "Should have 'athlete_id' field"
            assert "athlete_name" in notif, "Should have 'athlete_name' field"
            assert "message" in notif, "Should have 'message' field"
            assert "status" in notif, "Should have 'status' field (expired, urgent, warning)"
            assert "expiry_date" in notif, "Should have 'expiry_date' field"
            assert "days_until" in notif, "Should have 'days_until' field"
            print(f"✓ Certificate notification has correct structure")
            print(f"  - Message: {notif['message']}")
            print(f"  - Date: {notif['expiry_date']}")
            print(f"  - Status: {notif['status']}")
        else:
            print("No certificate notifications found (athlete may not have expiring certificate)")
    
    def test_genny_certificate_expiry_notification(self):
        """Test that Genny sees certificate expiry warning (5 days)"""
        response = requests.get(f"{BASE_URL}/api/notifications/expiring", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        notifications = data["notifications"]
        
        # Find certificate notification for Genny
        cert_notifs = [n for n in notifications if n.get("type") == "certificate"]
        
        assert len(cert_notifs) > 0, "Genny should have certificate expiry notification"
        
        notif = cert_notifs[0]
        assert "GENNY" in notif["athlete_name"].upper() or "FERRI" in notif["athlete_name"].upper(), \
            f"Notification should be for Genny, got: {notif['athlete_name']}"
        assert notif["status"] == "warning", f"Status should be 'warning', got: {notif['status']}"
        assert "scade tra" in notif["message"].lower() or "5 giorni" in notif["message"], \
            f"Message should mention expiry, got: {notif['message']}"
        assert notif["expiry_date"] == "04/03/2026", f"Expected expiry date 04/03/2026, got: {notif['expiry_date']}"
        
        print(f"✓ Genny's certificate expiry notification verified")
        print(f"  - Athlete: {notif['athlete_name']}")
        print(f"  - Message: {notif['message']}")
        print(f"  - Date: {notif['expiry_date']}")
        print(f"  - Days until: {notif['days_until']}")
    
    def test_notifications_sorted_by_urgency(self):
        """Test that notifications are sorted by urgency (expired first, then urgent, then warning)"""
        response = requests.get(f"{BASE_URL}/api/notifications/expiring", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        notifications = data["notifications"]
        
        if len(notifications) > 1:
            # Check that expired comes before urgent, urgent before warning
            status_order = {"expired": 0, "urgent": 1, "warning": 2}
            prev_order = -1
            for notif in notifications:
                current_order = status_order.get(notif.get("status", "warning"), 2)
                assert current_order >= prev_order, "Notifications should be sorted by urgency"
                prev_order = current_order
            print(f"✓ Notifications are sorted by urgency")
        else:
            print("Only 1 notification, skipping sort test")
    
    def test_unauthorized_access(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/expiring")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
