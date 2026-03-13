import requests
import os
import zipfile
import io

# Direct link to a sample parking lot video (raw GitHub file)
VIDEO_URL = "https://raw.githubusercontent.com/MoazEldsouky/Parking-Space-Counter-using-OpenCV-Python-Computer-Vision/main/carPark.mp4"
ASSETS_DIR = "assets"
TARGET_FILE = os.path.join(ASSETS_DIR, "demo_video.mp4")

def download_samples():
    if not os.path.exists(ASSETS_DIR):
        os.makedirs(ASSETS_DIR)
        
    print(f"Downloading sample parking video from GitHub...")
    
    try:
        response = requests.get(VIDEO_URL, stream=True)
        response.raise_for_status()
        
        with open(TARGET_FILE, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        print(f"Successfully downloaded sample to {TARGET_FILE}")
        print("You can now run 'python main.py' to test detection.")
        
    except Exception as e:
        print(f"Failed to download sample: {e}")

if __name__ == "__main__":
    download_samples()
