#!/usr/bin/env python3
"""
Backend API Testing for Sports Club App
Tests the certificate upload base64 endpoint and team creation endpoint
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://role-profiles.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.results = []
        self.admin_token = None
        self.parent_token = None
        self.team_id = None
        self.athlete_id = None
    
    def add_result(self, test_name, success, message, details=None):
        self.results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        })
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def print_summary(self):
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if total - passed > 0:
            print("\nFAILED TESTS:")
            for r in self.results:
                if not r["success"]:
                    print(f"  - {r['test']}: {r['message']}")
        print("="*60)

def create_sample_pdf_base64():
    """Create a simple PDF content as base64 for testing"""
    # Simple PDF content (minimal valid PDF)
    pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Medical Certificate) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF"""
    return base64.b64encode(pdf_content).decode('utf-8')

def test_register_admin(test_results):
    """Test admin user registration"""
    url = f"{BACKEND_URL}/auth/register"
    data = {
        "email": "admin@sportsclub.com",
        "password": "AdminPass123!",
        "role": "admin",
        "full_name": "Club Administrator"
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            result = response.json()
            test_results.admin_token = result.get("token")
            test_results.add_result(
                "Admin Registration", 
                True, 
                "Admin user registered successfully",
                {"user_id": result.get("user", {}).get("id")}
            )
            return True
        else:
            test_results.add_result(
                "Admin Registration", 
                False, 
                f"Registration failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Admin Registration", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_register_parent(test_results):
    """Test parent user registration"""
    url = f"{BACKEND_URL}/auth/register"
    data = {
        "email": "parent@sportsclub.com",
        "password": "ParentPass123!",
        "role": "parent",
        "full_name": "Marco Rossi"
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            result = response.json()
            test_results.parent_token = result.get("token")
            test_results.add_result(
                "Parent Registration", 
                True, 
                "Parent user registered successfully",
                {"user_id": result.get("user", {}).get("id")}
            )
            return True
        else:
            test_results.add_result(
                "Parent Registration", 
                False, 
                f"Registration failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Parent Registration", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_create_team(test_results):
    """Test team creation endpoint (admin only)"""
    if not test_results.admin_token:
        test_results.add_result(
            "Team Creation", 
            False, 
            "No admin token available"
        )
        return False
    
    url = f"{BACKEND_URL}/teams"
    headers = {"Authorization": f"Bearer {test_results.admin_token}"}
    
    # Calculate future dates for installments
    installment_2_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
    installment_3_date = (datetime.now() + timedelta(days=120)).strftime("%Y-%m-%d")
    
    data = {
        "name": "Squadra Pallavolo Under 16",
        "description": "Squadra giovanile di pallavolo",
        "total_amount": 300.0,
        "installment_1_amount": 100.0,
        "installment_2_amount": 100.0,
        "installment_2_due_date": installment_2_date,
        "installment_3_amount": 100.0,
        "installment_3_due_date": installment_3_date,
        "bank_info": "IBAN: IT60 X054 2811 1010 0000 0123 456",
        "paypal_email": "payments@sportsclub.com",
        "venue": "Palestra Liceo Alessi",
        "training_schedule": "Lunedì 18:00-20:00, Mercoledì 19:00-21:00",
        "championships": "Serie C, Coppa Italia",
        "calendar_link": "https://calendar.example.com/volleyball"
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            result = response.json()
            test_results.team_id = result.get("id")
            test_results.add_result(
                "Team Creation", 
                True, 
                "Team created successfully",
                {"team_id": test_results.team_id, "team_name": result.get("name")}
            )
            return True
        else:
            test_results.add_result(
                "Team Creation", 
                False, 
                f"Team creation failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Team Creation", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_create_athlete(test_results):
    """Test athlete creation (parent only)"""
    if not test_results.parent_token or not test_results.team_id:
        test_results.add_result(
            "Athlete Creation", 
            False, 
            "Missing parent token or team ID"
        )
        return False
    
    url = f"{BACKEND_URL}/athletes"
    headers = {"Authorization": f"Bearer {test_results.parent_token}"}
    
    # Calculate date of birth for a 15-year-old (minor)
    dob = (datetime.now() - timedelta(days=15*365)).strftime("%Y-%m-%d")
    
    data = {
        "full_name": "Giulia Rossi",
        "date_of_birth": dob,
        "fiscal_code": "RSSGLA07A01H501Z",
        "address": "Via Roma 123",
        "city": "Milano",
        "postal_code": "20100",
        "province": "MI",
        "phone_athlete": "3331234567",
        "phone_father": "3339876543",
        "phone_mother": "3335555555",
        "tax_payer_name": "Marco Rossi",
        "tax_payer_fiscal_code": "RSSMRC75B15F205X",
        "team_id": test_results.team_id
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            result = response.json()
            test_results.athlete_id = result.get("id")
            test_results.add_result(
                "Athlete Creation", 
                True, 
                "Athlete created successfully",
                {"athlete_id": test_results.athlete_id, "athlete_name": result.get("full_name")}
            )
            return True
        else:
            test_results.add_result(
                "Athlete Creation", 
                False, 
                f"Athlete creation failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Athlete Creation", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_certificate_upload_base64(test_results):
    """Test certificate upload using base64 endpoint (HIGH PRIORITY)"""
    if not test_results.parent_token or not test_results.athlete_id:
        test_results.add_result(
            "Certificate Upload Base64", 
            False, 
            "Missing parent token or athlete ID"
        )
        return False
    
    url = f"{BACKEND_URL}/certificates/upload-base64"
    headers = {"Authorization": f"Bearer {test_results.parent_token}"}
    
    # Create sample PDF base64 data
    pdf_base64 = create_sample_pdf_base64()
    
    # Issue date: today, validity: 12 months
    issue_date = datetime.now().strftime("%Y-%m-%d")
    
    data = {
        "athlete_id": test_results.athlete_id,
        "issue_date": issue_date,
        "validity_months": 12,
        "pdf_base64": pdf_base64
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            result = response.json()
            test_results.add_result(
                "Certificate Upload Base64", 
                True, 
                "Certificate uploaded successfully via base64 endpoint",
                {
                    "message": result.get("message"),
                    "expiry_date": result.get("expiry_date"),
                    "athlete_id": test_results.athlete_id
                }
            )
            return True
        else:
            test_results.add_result(
                "Certificate Upload Base64", 
                False, 
                f"Certificate upload failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Certificate Upload Base64", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_get_certificate(test_results):
    """Test retrieving the uploaded certificate"""
    if not test_results.parent_token or not test_results.athlete_id:
        test_results.add_result(
            "Certificate Retrieval", 
            False, 
            "Missing parent token or athlete ID"
        )
        return False
    
    url = f"{BACKEND_URL}/certificates/{test_results.athlete_id}"
    headers = {"Authorization": f"Bearer {test_results.parent_token}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            result = response.json()
            test_results.add_result(
                "Certificate Retrieval", 
                True, 
                "Certificate retrieved successfully",
                {
                    "athlete_id": result.get("athlete_id"),
                    "issue_date": result.get("issue_date"),
                    "expiry_date": result.get("expiry_date"),
                    "validity_months": result.get("validity_months")
                }
            )
            return True
        else:
            test_results.add_result(
                "Certificate Retrieval", 
                False, 
                f"Certificate retrieval failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Certificate Retrieval", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_auth_validation(test_results):
    """Test that endpoints require proper authentication"""
    # Test certificate upload without token
    url = f"{BACKEND_URL}/certificates/upload-base64"
    data = {
        "athlete_id": "test_id",
        "issue_date": "2024-01-01",
        "validity_months": 12,
        "pdf_base64": "test_data"
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 401 or response.status_code == 403:
            test_results.add_result(
                "Authentication Validation", 
                True, 
                "Endpoint properly requires authentication"
            )
            return True
        else:
            test_results.add_result(
                "Authentication Validation", 
                False, 
                f"Endpoint should require auth but returned status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Authentication Validation", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_forgot_password(test_results):
    """Test POST /api/auth/forgot-password endpoint"""
    url = f"{BACKEND_URL}/auth/forgot-password"
    data = {
        "email": "test@example.com"
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            result = response.json()
            expected_message = "Se l'email esiste, riceverai un codice di reset"
            
            if result.get("message") == expected_message:
                test_results.add_result(
                    "Forgot Password Endpoint", 
                    True, 
                    "Forgot password endpoint working correctly",
                    {"message": result.get("message")}
                )
                return True
            else:
                test_results.add_result(
                    "Forgot Password Endpoint", 
                    False, 
                    f"Unexpected message: {result.get('message')}",
                    {"expected": expected_message, "actual": result.get("message")}
                )
                return False
        else:
            test_results.add_result(
                "Forgot Password Endpoint", 
                False, 
                f"Forgot password failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Forgot Password Endpoint", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_reset_password(test_results):
    """Test POST /api/auth/reset-password endpoint"""
    url = f"{BACKEND_URL}/auth/reset-password"
    data = {
        "email": "test@example.com",
        "reset_code": "TESTCODE",
        "new_password": "newpass123"
    }
    
    try:
        response = requests.post(url, json=data)
        # This should fail with 400 since we don't have a valid reset token
        if response.status_code == 400:
            result = response.json()
            error_detail = result.get("detail", "")
            
            # Check for expected error messages
            expected_errors = [
                "Email non trovata",
                "Nessuna richiesta di reset trovata",
                "Codice scaduto",
                "Codice non valido"
            ]
            
            if any(expected in error_detail for expected in expected_errors):
                test_results.add_result(
                    "Reset Password Endpoint", 
                    True, 
                    "Reset password endpoint working correctly",
                    {"error_detail": error_detail}
                )
                return True
            else:
                test_results.add_result(
                    "Reset Password Endpoint", 
                    False, 
                    f"Unexpected error message: {error_detail}",
                    {"response": response.text}
                )
                return False
        else:
            test_results.add_result(
                "Reset Password Endpoint", 
                False, 
                f"Unexpected status code: {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Reset Password Endpoint", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_change_password_no_auth(test_results):
    """Test POST /api/auth/change-password without authentication"""
    url = f"{BACKEND_URL}/auth/change-password"
    data = {
        "current_password": "wrongpass",
        "new_password": "newpass123"
    }
    
    try:
        response = requests.post(url, json=data)
        # Should fail with 401 or 403 due to missing authentication
        if response.status_code in [401, 403]:
            test_results.add_result(
                "Change Password No Auth", 
                True, 
                "Change password correctly requires authentication",
                {"status_code": response.status_code}
            )
            return True
        else:
            test_results.add_result(
                "Change Password No Auth", 
                False, 
                f"Unexpected status code: {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Change Password No Auth", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_change_password_with_auth(test_results):
    """Test POST /api/auth/change-password with authentication"""
    if not test_results.admin_token:
        test_results.add_result(
            "Change Password With Auth", 
            False, 
            "No admin token available for authenticated test"
        )
        return False
    
    url = f"{BACKEND_URL}/auth/change-password"
    headers = {"Authorization": f"Bearer {test_results.admin_token}"}
    
    # Test with wrong current password
    data = {
        "current_password": "wrongpass",
        "new_password": "newpass123"
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        # Should fail with 400 due to incorrect current password
        if response.status_code == 400:
            result = response.json()
            error_detail = result.get("detail", "")
            
            if "Password attuale non corretta" in error_detail:
                test_results.add_result(
                    "Change Password With Auth", 
                    True, 
                    "Change password correctly validates current password",
                    {"error_detail": error_detail}
                )
                return True
            else:
                test_results.add_result(
                    "Change Password With Auth", 
                    False, 
                    f"Unexpected error message: {error_detail}",
                    {"response": response.text}
                )
                return False
        else:
            test_results.add_result(
                "Change Password With Auth", 
                False, 
                f"Unexpected status code: {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Change Password With Auth", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def test_admin_login_existing(test_results):
    """Test login with existing admin credentials"""
    url = f"{BACKEND_URL}/auth/login"
    data = {
        "email": "pallavoloperugia@gmail.com",
        "password": "11092012"
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            result = response.json()
            # Store the existing admin token for change password test
            if not test_results.admin_token:  # Only if we don't have one from registration
                test_results.admin_token = result.get("token")
            test_results.add_result(
                "Existing Admin Login", 
                True, 
                "Existing admin login successful",
                {"user_id": result.get("user", {}).get("id")}
            )
            return True
        else:
            test_results.add_result(
                "Existing Admin Login", 
                False, 
                f"Login failed with status {response.status_code}",
                {"response": response.text}
            )
            return False
    except Exception as e:
        test_results.add_result(
            "Existing Admin Login", 
            False, 
            f"Request failed: {str(e)}"
        )
        return False

def main():
    print("Starting Backend API Tests for Sports Club App")
    print(f"Testing against: {BACKEND_URL}")
    print("="*60)
    
    test_results = TestResults()
    
    # Run tests in sequence
    print("\n1. Testing User Registration...")
    test_register_admin(test_results)
    test_register_parent(test_results)
    
    print("\n2. Testing Existing Admin Login...")
    test_admin_login_existing(test_results)
    
    print("\n3. Testing Team Creation...")
    test_create_team(test_results)
    
    print("\n4. Testing Athlete Creation...")
    test_create_athlete(test_results)
    
    print("\n5. Testing Certificate Upload (HIGH PRIORITY)...")
    test_certificate_upload_base64(test_results)
    
    print("\n6. Testing Certificate Retrieval...")
    test_get_certificate(test_results)
    
    print("\n7. Testing Authentication...")
    test_auth_validation(test_results)
    
    print("\n8. Testing Password Management Endpoints...")
    test_forgot_password(test_results)
    test_reset_password(test_results)
    test_change_password_no_auth(test_results)
    test_change_password_with_auth(test_results)
    
    # Print final summary
    test_results.print_summary()
    
    # Return exit code based on results
    failed_tests = sum(1 for r in test_results.results if not r["success"])
    return 0 if failed_tests == 0 else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)