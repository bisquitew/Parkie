# 🧠 Parkie Backend API Documentation

This FastAPI service acts as the "glue" between the **AI Vision** component (detecting cars) and the **Mobile App** (displaying status). It manages data in **Supabase** and dynamically calculates parking availability and marker colors.

---

## 🚀 Quick Start

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Setup Environment:**
   Create a `.env` file in the `backend_api/` directory:
   ```env
   SUPABASE_URL=your_project_url
   SUPABASE_SERVICE_KEY=your_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   ```

3. **Run the Server:**
   ```bash
   uvicorn main:app --reload
   ```
   *The API will be available at: `http://localhost:8000`*
   *Interactive Swagger docs: `http://localhost:8000/docs`*

---

## 📡 Endpoints

### 1. User Registration (`POST /register`)
**Used by:** Lot Owners.
- **Payload:** `{ "name": "...", "email": "...", "password": "..." }`
- **Logic:** Hashes the password and creates a new user in the `users` table.

### 2. User Login (`POST /login`)
**Used by:** Lot Owners.
- **Payload:** `{ "email": "...", "password": "..." }`
- **Logic:** Verifies the hashed password and returns the `user_id`.

### 3. Update Parking Data (`POST /update_lot`)
**Used by:** `ai_vision` component.
- **Payload:** `{ "lot_id": "...", "detected_cars": 15 }`

### 4. Get All Lots (`GET /lots`)
**Used by:** `mobile_app`.
- **Query Params:** `include_unverified` (bool, default: false)
- **Response:** Returns **verified lots** by default.

### 5. Get Owner's Lots (`GET /my_lots/{owner_id}`)
**Used by:** Web Dashboard.
- **Response:** Returns all lots belonging to a specific owner. Handles invalid UUIDs with a 400 error.

### 6. Get Lot Colors Only (`GET /lots/colors`)
**Used by:** `mobile_app` (Optimized polling).
- **Response:** Returns only the `id` and `status_color` for every **verified** lot.

### 7. Get Single Lot Details (`GET /lots/{lot_id}`)
**Used by:** `mobile_app` / Web Dashboard.
- **Response:** Returns full details for a single parking lot.

### 8. Create/Register Parking Lot (`POST /lots`)
**Used by:** Web Dashboard.
- **Payload:** Includes `owner_id`, `name`, `latitude`, `longitude`, `camera_url`, `slots_data`, and optional `capacity`.

### 9. Setup/Update Existing Lot (`PUT /lots/{lot_id}/setup`)
**Used by:** Web Dashboard.
- **Method:** `PUT`
- **Logic:** Replaces the configuration of an existing lot and resets `is_verified` to `false`.

### 10. Capture Camera Frame (`POST /capture_frame`)
**Used by:** Admin Dashboard (Setup phase).
- **Payload:** `{ "camera_url": "..." }`
- **Logic:** Connects to the camera stream, grabs exactly one frame, and returns it as a base64-encoded JPEG.

### 11. Lot Configuration Setup (`POST /lots/{lot_id}/setup`)
**Used by:** Admin Dashboard (Setup phase).
- **Payload:** `{ "camera_url": "...", "slots_data": [[...], [...]] }`
- **Logic:** Updates the `camera_url` and `slots_data` for a specific lot and recalculates `capacity`.

### 12. Admin: Verify Parking Lot (`PATCH /lots/{lot_id}/verify`)
**Used by:** Admin Dashboard / Admin Script.
- **Method:** `PATCH`
- **Query Params:** `verified` (bool, default: true)
- **Logic:** Partially updates the lot to set its verification status.

### 14. Get Lot Configuration (`GET /lots/{lot_id}/config`)
**Used by:** `ai_vision` script.
- **Response:** Returns `camera_url` and `slots_data`.

### 15. Voice Search (`POST /search/voice`)
**Used by:** Mobile App (hands-free voice search).
- **Content-Type:** `multipart/form-data`
- **Form Field:** `audio` — an audio file (.mp3, .wav, .m4a, etc.)
- **Logic:**
  1. Transcribes the audio using OpenAI Whisper (`language="ro"`).
  2. Geocodes the spoken place name via Nominatim (biased to Romania).
- **Response:**
  ```json
  {
    "transcript": "Piața 700",
    "location": {
      "name": "Piața 700, Timișoara, Romania",
      "latitude": 45.7489,
      "longitude": 21.2087
    }
  }
  ```
  If geocoding fails, `location` will be `null`.
- **Env Requirement:** `OPENAI_API_KEY` must be set in `.env`.

---

## 🛠️ Admin Tools

### 1. Admin Verification Script (`admin_verify.py`)
An interactive CLI tool to list pending parking lots and verify them.
```bash
python admin_verify.py
```
*Note: Make sure the backend server is running locally on port 8000.*

---

## 🏗️ Database Schema (Supabase)

### `users` Table
- `id`: `uuid` (Primary Key)
- `name`: `text`
- `email`: `text` (Unique)
- `password`: `text` (Hashed)
- `created_at`: `timestamptz`

### `parking_lots` Table
- `id`: `uuid` (Primary Key)
- `owner_id`: `uuid` (Foreign Key referencing users.id)
- `name`: `text`
- `capacity`: `int`
- `available_spots`: `int`
- `status_color`: `text` (e.g., "green", "yellow", "red", "gray")
- `last_updated`: `timestamptz`
- `camera_url`: `text`
- `slots_data`: `jsonb` (Array of 8-coordinate vectors)
- `latitude`: `float8`
- `longitude`: `float8`
- `is_verified`: `boolean` (Default: false)
