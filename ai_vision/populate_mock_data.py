import requests
import random
import time
import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "https://undateable-lashawnda-unnectareous.ngrok-free.dev")

# Realistic Timișoara Locations
LOCATIONS = [
    {"name": "Piata Unirii Central", "lat": 45.7581, "lon": 21.2290, "cap": 45},
    {"name": "Shopping City South",  "lat": 45.7275, "lon": 21.2114, "cap": 500},
    {"name": "Bega Business Center", "lat": 45.7541, "lon": 21.2312, "cap": 80},
    {"name": "Gara de Nord",         "lat": 45.7505, "lon": 21.2081, "cap": 120},
    {"name": "Parcare Continental",   "lat": 45.7538, "lon": 21.2303, "cap": 150},
    {"name": "CRAFT Exhibition",    "lat": 45.7482, "lon": 21.2401, "cap": 60},
    {"name": "Piata 700 Business",  "lat": 45.7567, "lon": 21.2223, "cap": 110},
    {"name": "UVT Sports Field",    "lat": 45.7480, "lon": 21.2335, "cap": 50},
    {"name": "Stadion Dan Paltinisanu", "lat": 45.7405, "lon": 21.2435, "cap": 800},
    {"name": "UVT Headquarters",   "lat": 45.7483, "lon": 21.2315, "cap": 40}
]

def generate_dummy_slots(count):
    """Generates dummy 4-point polygons for mapping."""
    slots = []
    for _ in range(count):
        # Just random boxes for the DB to have something
        slots.append([100, 100, 200, 100, 200, 200, 100, 200])
    return slots

def run_population():
    print(f"--- Parkie Mock Data Generator (Timișoara Edition) ---")
    print(f"Backend: {BACKEND_URL}\n")

    # 1. Register a Mock Owner
    owner_email = f"mock_owner_timisoara@parkie.ro" # Constant email to reuse owner
    print(f"Checking/Registering mock owner: {owner_email}...")
    try:
        # Try login first to get existing ID
        login_resp = requests.post(f"{BACKEND_URL}/login", json={
            "email": owner_email,
            "password": "mockpassword123"
        })
        if login_resp.status_code == 200:
            owner_id = login_resp.json()["user_id"]
            print(f"✅ Found existing owner ID: {owner_id}")
        else:
            # Register if not found
            reg_resp = requests.post(f"{BACKEND_URL}/register", json={
                "name": "Timișoara Admin",
                "email": owner_email,
                "password": "mockpassword123"
            })
            owner_id = reg_resp.json()["user_id"]
            print(f"✅ Created new owner ID: {owner_id}")
    except Exception as e:
        print(f"❌ Owner setup failed: {e}.")
        return

    # 2. Fetch existing lots to avoid duplicates
    existing_lots = {}
    try:
        lots_resp = requests.get(f"{BACKEND_URL}/lots?include_unverified=true")
        if lots_resp.status_code == 200:
            existing_lots = {lot["name"]: lot["id"] for lot in lots_resp.json()}
            print(f"✅ Synced with {len(existing_lots)} existing lots from backend.\n")
    except Exception as e:
        print(f"⚠️ Could not sync existing lots: {e}")

    # 3. Create/Sync and Verify Lots
    lot_ids = []
    for loc in LOCATIONS:
        name = loc["name"]
        if name in existing_lots:
            lid = existing_lots[name]
            print(f"♻️ Reusing existing lot: {name} ({lid})")
        else:
            print(f"✨ Creating new lot: {name}...")
            try:
                payload = {
                    "owner_id": owner_id,
                    "name": name,
                    "latitude": loc["lat"],
                    "longitude": loc["lon"],
                    "camera_url": "https://parkie.ro/mock-stream",
                    "slots_data": generate_dummy_slots(loc["cap"]),
                    "capacity": loc["cap"]
                }
                create_resp = requests.post(f"{BACKEND_URL}/lots", json=payload)
                lid = create_resp.json()["lot_id"]
                # Verify immediately
                requests.patch(f"{BACKEND_URL}/lots/{lid}/verify", params={"verified": True})
            except Exception as e:
                print(f"⚠️ Failed to create {name}: {e}")
                continue

        # Diverse initial occupancy profiles:
        # - Some low (0-20%)
        # - Some medium (40-60%)
        # - Some high (85-98%)
        profile = random.choice(["low", "med", "high"])
        if profile == "low":    perc = random.uniform(0.02, 0.20)
        elif profile == "med":  perc = random.uniform(0.40, 0.60)
        else:                   perc = random.uniform(0.85, 0.98)
        
        initial_cars = int(loc["cap"] * perc)
        lot_ids.append({"id": lid, "cap": loc["cap"], "current": initial_cars, "name": name})
        print(f"   📊 Profile: {profile.upper()} ({initial_cars}/{loc['cap']})")

    print(f"\n🚀 {len(lot_ids)} lots synced! Starting dynamic updates...\n")

    # 4. Dynamic Update Loop
    while True:
        for lot in lot_ids:
            # 1 in 20 chance to start a "rush" if not already rushing and not full
            if not lot.get("is_rushing") and lot["current"] < lot["cap"] * 0.8:
                if random.random() < 0.05:
                    lot["is_rushing"] = True
                    print(f"🔥 RUSH START: {lot['name']} is filling up fast!")

            if lot.get("is_rushing"):
                # Rushing: +10% to +15% of capacity per 10s
                change = random.randint(int(lot["cap"] * 0.1), int(lot["cap"] * 0.15))
                lot["current"] = min(lot["cap"], lot["current"] + change)
                
                # End rush if nearly full
                if lot["current"] >= lot["cap"] * 0.95:
                    lot["is_rushing"] = False
                    print(f"🛑 RUSH END: {lot['name']} is now full.")
            else:
                # Normal fluctuation: +/- 2 cars
                change = random.choice([-2, -1, 0, 1, 2])
                lot["current"] = max(0, min(lot["cap"], lot["current"] + change))
            
            try:
                requests.post(f"{BACKEND_URL}/update_lot", json={
                    "lot_id": lot["id"],
                    "detected_cars": lot["current"]
                })
            except:
                pass
        
        print(f"[{time.strftime('%H:%M:%S')}] Updated {len(lot_ids)} lots.")
        time.sleep(10)

if __name__ == "__main__":
    run_population()
