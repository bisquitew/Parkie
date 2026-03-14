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
   ```

3. **Run the Server:**
   ```bash
   uvicorn main:app --reload
   ```
   *The API will be available at: `http://localhost:8000`*
   *Interactive Swagger docs: `http://localhost:8000/docs`*

---

## 📡 Endpoints

### 1. Update Parking Data (`POST /update_lot`)
**Used by:** `ai_vision` component.
- **URL:** `/update_lot`
- **Method:** `POST`
- **Payload (JSON):**
  ```json
  {
    "lot_id": "uuid-string",
    "detected_cars": 15
  }
  ```
- **Logic:**
  1. Fetches the lot's `capacity` from Supabase.
  2. Calculates `available_spots = capacity - detected_cars` (minimum 0).
  3. Updates `available_spots` and `last_updated` in the database.
  4. Returns the updated data and the calculated `status_color`.

---

### 2. Get All Lots (`GET /lots`)
**Used by:** `mobile_app` (List view or initial map load).
- **URL:** `/lots`
- **Method:** `GET`
- **Response:** A list of all parking lot objects, including `id`, `name`, `capacity`, `available_spots`, `last_updated`, and a dynamically calculated `status_color`.

---

### 3. Get Map Colors Only (`GET /lots/colors`)
**Used by:** `mobile_app` (Efficient map marker updates).
- **URL:** `/lots/colors`
- **Method:** `GET`
- **Response:** A lightweight list of markers for fast UI updates.
  ```json
  [
    { "id": "uuid-1", "status_color": "green" },
    { "id": "uuid-2", "status_color": "red" }
  ]
  ```

---

### 4. Get Single Lot Detail (`GET /lots/{lot_id}`)
**Used by:** `mobile_app` (Detailed view when a lot is selected).
- **URL:** `/lots/{lot_id}`
- **Method:** `GET`
- **Response:** Full details for a specific lot.

---

### 5. Create/Register Parking Lot (`POST /lots`)
**Used by:** Web Dashboard (Lot Owner - Initial registration).
- **URL:** `/lots`
- **Method:** `POST`
- **Payload (JSON):**
  ```json
  {
    "name": "Central Plaza Parking",
    "latitude": 45.523062,
    "longitude": -122.676482,
    "camera_url": "https://example.com/stream.m3u8",
    "slots_data": [
      [x1, y1, x2, y2, x3, y3, x4, y4],
      ...
    ],
    "capacity": 100
  }
  ```
- **Logic:**
  1. Creates a **new record** in the database.
  2. Returns the generated `lot_id`.
  3. Sets `is_verified` to `false` (requires admin review).

---

### 6. Setup/Update Existing Lot (`POST /lots/{lot_id}/setup`)
**Used by:** Web Dashboard (Lot Owner - Re-configuration).
- **URL:** `/lots/{lot_id}/setup`
- **Method:** `POST`
- **Payload (JSON):** Same as Creation.
- **Logic:**
  1. Updates an **existing record** by ID.
  2. Sets `is_verified` to `false` (requires admin re-review).

---

### 7. Get Lot Configuration (`GET /lots/{lot_id}/config`)
**Used by:** `ai_vision` script (Initial setup).
- **URL:** `/lots/{lot_id}/config`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "camera_url": "https://example.com/stream.m3u8",
    "slots_data": [[x1, y1, x2, y2, x3, y3, x4, y4], ...]
  }
  ```

---

### 8. Health Check (`GET /`)
- **URL:** `/`
- **Method:** `GET`
- **Response:** `{"message": "Parkie API is online!"}`

---

## 🎨 Color Logic (Calculated in Backend)

The `status_color` is calculated based on the **occupancy rate** (`occupied / capacity`):
- 🟢 **Green:** Below 70% occupied.
- 🟡 **Yellow:** Between 70% and 85% occupied.
- 🔴 **Red:** Above 85% occupied.
- ⚪ **Gray:** Invalid capacity (0 or less).

---

## 🛠️ Database Schema (Supabase)

users Table
This table stores the account details for parking lot owners.
id: uuid (Primary Key)
name: text
email: text (Unique)
password: text (Hashed password)
created_at: timestamptz (Default: now())

parking_lots Table
This table stores the configuration and live data for each parking lot, linked to its owner.
id: uuid (Primary Key)
owner_id: uuid (Foreign Key referencing users.id)
name: text
capacity: int
available_spots: int
last_updated: timestamptz
camera_url: text (URL for the live feed)
slots_data: jsonb (Array of 8-coordinate vectors [x1, y1, x2, y2, x3, y3, x4, y4])
latitude: float8 (GPS Latitude)
longitude: float8 (GPS Longitude)
is_verified: boolean (Default: false, for admin review)