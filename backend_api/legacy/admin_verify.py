import requests
import sys

API_BASE_URL = "http://localhost:8000"

def list_pending_lots():
    try:
        # include_unverified=true to see pending lots
        response = requests.get(f"{API_BASE_URL}/lots?include_unverified=true")
        response.raise_for_status()
        lots = response.json()
        
        pending = [lot for lot in lots if not lot.get("is_verified", False)]
        
        if not pending:
            print("\n✅ No pending parking lots found.")
            return []
        
        print("\n--- Pending Parking Lots ---")
        for i, lot in enumerate(pending, 1):
            print(f"[{i}] ID: {lot['id']}")
            print(f"    Name: {lot['name']}")
            print(f"    Capacity: {lot['capacity']}")
            print(f"    Location: {lot['latitude']}, {lot['longitude']}")
            print("-" * 30)
        return pending
    except Exception as e:
        print(f"❌ Error fetching lots: {e}")
        return []

def verify_lot(lot_id):
    try:
        response = requests.patch(f"{API_BASE_URL}/lots/{lot_id}/verify?verified=true")
        response.raise_for_status()
        data = response.json()
        print(f"\n✅ Successfully verified lot: {data['lot_id']}")
    except Exception as e:
        print(f"❌ Error verifying lot: {e}")

def main():
    while True:
        pending = list_pending_lots()
        
        if not pending:
            break
            
        choice = input("\nEnter the index number to verify, or 'q' to quit: ").strip()
        
        if choice.lower() == 'q':
            break
            
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(pending):
                lot_id = pending[idx]['id']
                verify_lot(lot_id)
            else:
                print("Invalid index.")
        except ValueError:
            print("Please enter a valid number or 'q'.")

if __name__ == "__main__":
    main()
