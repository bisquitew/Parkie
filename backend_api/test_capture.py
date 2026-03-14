import requests
import base64
import os

BASE_URL = "http://localhost:8000"

# Using the local file in backend_api/assets as requested
VIDEO_PATH = os.path.abspath("assets/demo3.mp4")

def test_capture_frame():
    print(f"Testing /capture_frame with: {VIDEO_PATH}")

    payload = {
        "camera_url": VIDEO_PATH
    }

    try:
        response = requests.post(f"{BASE_URL}/capture_frame", json=payload)

        if response.status_code != 200:
            print(f"❌ Capture Failed (Status {response.status_code}): {response.text}")
            return

        data = response.json()
        if "image" not in data:
            print("❌ 'image' key missing in response")
            return

        header, encoded = data["image"].split(",", 1)
        image_data = base64.b64decode(encoded)

        output_file = "test_capture_output.jpg"
        with open(output_file, "wb") as f:
            f.write(image_data)

        print(f"✅ Frame captured and saved to: {os.path.abspath(output_file)}")

    except Exception as e:
        print(f"❌ Error during capture test: {e}")

def test_lot_setup():
    print("\nTesting /lots/{lot_id}/setup...")
    fake_lot_id = "00000000-0000-0000-0000-000000000000"

    payload = {
        "camera_url": VIDEO_PATH,
        "slots_data": [
            [10, 10, 50, 10, 50, 50, 10, 50],
            [60, 10, 100, 10, 100, 50, 60, 50]
        ]
    }

    try:
        response = requests.post(f"{BASE_URL}/lots/{fake_lot_id}/setup", json=payload)
        if response.status_code == 404:
            print("✅ Lot Setup Endpoint is reachable (Returned 404 for fake ID)")
        elif response.status_code == 200:
            print("✅ Lot Setup Successful")
        else:
            print(f"❓ Unexpected status {response.status_code}: {response.text}")

    except Exception as e:
        print(f"❌ Error during setup test: {e}")

if __name__ == "__main__":
    # Ensure the script is run from the backend_api directory
    test_capture_frame()
    test_lot_setup()

