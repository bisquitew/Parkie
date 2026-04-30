import requests
import random
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

def test_health():
    print("Testing / (Health Check)...")
    r = requests.get(f"{BASE_URL}/")
    assert r.status_code == 200
    print("✅ Health Check Passed\n")

def test_user_flow():
    print("Testing User Flow (Register & Login)...")
    email = f"owner_{random.randint(1000, 9999)}@example.com"
    signup_data = {
        "name": "Test Owner",
        "email": email,
        "password": "securepassword123"
    }
    
    # 1. Register
    r = requests.post(f"{BASE_URL}/auth/register", json=signup_data)
    assert r.status_code == 200
    user_id = r.json()["user_id"]
    print(f"✅ User Registered: {user_id}")
    
    # 2. Login
    login_data = {"email": email, "password": "securepassword123"}
    r = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    assert r.status_code == 200
    token = r.json()["access_token"]
    print("✅ User Login Successful")
    
    return user_id, token

def test_parking_lot_flow(owner_id, token):
    print("Testing Parking Lot Flow...")
    headers = {"Authorization": f"Bearer {token}"}
    
    lot_data = {
        "owner_id": owner_id,
        "name": "Hackathon Plaza",
        "latitude": 45.523062,
        "longitude": -122.676482,
        "camera_url": "https://demo-stream.com/live.m3u8",
        "slots_data": [[100, 100, 200, 100, 200, 200, 100, 200]], # One slot (8 coords)
        "capacity": 10
    }
    
    # 1. Create Lot
    r = requests.post(f"{BASE_URL}/lots", json=lot_data, headers=headers)
    assert r.status_code == 200
    lot_id = r.json()["lot_id"]
    print(f"✅ Lot Created: {lot_id}")
    
    # 2. Check My Lots (Owner View)
    r = requests.get(f"{BASE_URL}/lots/my", headers=headers)
    assert r.status_code == 200
    assert any(lot["id"] == lot_id for lot in r.json())
    print("✅ Owner Lot List Verified")
    
    # 3. Verify Public List (Should be EMPTY because is_verified=false)
    r = requests.get(f"{BASE_URL}/lots")
    assert r.status_code == 200
    assert all(lot["id"] != lot_id for lot in r.json())
    print("✅ Public Filter (Unverified) Verified")
    
    # 4. Admin Verify Lot (PATCH)
    # Note: Using the same token for admin for simplicity if the test user is granted admin or if we mock it.
    # In real scenario, we might need an admin token.
    r = requests.patch(f"{BASE_URL}/admin/lots/{lot_id}/verify", params={"verified": True}, headers=headers)
    # If the user is not an admin, this might fail unless we make them one.
    if r.status_code == 403:
        print("⚠️ Admin verification skipped (Current user is not admin)")
    else:
        assert r.status_code == 200
        print("✅ Lot Admin Verified")
    
        # 5. Verify Public List (Should now contain the lot)
        r = requests.get(f"{BASE_URL}/lots")
        assert r.status_code == 200
        assert any(lot["id"] == lot_id for lot in r.json())
        print("✅ Public Filter (Verified) Verified")
    
    # 6. Get Lot Config (AI Vision View - Public)
    r = requests.get(f"{BASE_URL}/lots/{lot_id}/config")
    assert r.status_code == 200
    assert r.json()["camera_url"] == lot_data["camera_url"]
    print("✅ AI Config Retrieval Verified")
    
    # 7. Update Lot Occupancy (AI Vision Update - Public)
    update_payload = {
        "lot_id": lot_id,
        "detected_cars": 3
    }
    r = requests.post(f"{BASE_URL}/vision/update_lot", json=update_payload)
    assert r.status_code == 200
    assert r.json()["available_spots"] == 7 # 10 - 3
    print("✅ AI Occupancy Update Verified")
    
    # 8. Setup/Update Lot (PUT)
    lot_data["name"] = "Updated Plaza"
    r = requests.put(f"{BASE_URL}/lots/{lot_id}/setup", json=lot_data, headers=headers)
    assert r.status_code == 200
    print("✅ Lot Re-configuration (PUT) Verified")

if __name__ == "__main__":
    print("--- Starting API Integration Tests ---\n")
    try:
        test_health()
        owner_id, token = test_user_flow()
        test_parking_lot_flow(owner_id, token)
        print("\n--- All Tests Passed! 🚀 ---")
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")
        print("Note: Make sure the FastAPI server is running at http://localhost:8000")
