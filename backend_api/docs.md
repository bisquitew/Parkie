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
- **Response:** Returns all lots belonging to a specific owner.

### 6. Create/Register Parking Lot (`POST /lots`)
**Used by:** Web Dashboard.
- **Payload:** Includes `owner_id`, `name`, `latitude`, `longitude`, `camera_url`, `slots_data`, and optional `capacity`.

### 7. Setup/Update Existing Lot (`PUT /lots/{lot_id}/setup`)
**Used by:** Web Dashboard.
- **Method:** `PUT`
- **Logic:** Replaces the configuration of an existing lot and resets `is_verified` to `false`.

### 8. Admin: Verify Parking Lot (`PATCH /lots/{lot_id}/verify`)
**Used by:** Admin Dashboard.
- **Method:** `PATCH`
- **Query Params:** `verified` (bool, default: true)
- **Logic:** Partially updates the lot to set its verification status.

### 9. Get Lot Configuration (`GET /lots/{lot_id}/config`)
**Used by:** `ai_vision` script.

---

## 🛠️ Database Schema (Supabase)

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
- `last_updated`: `timestamptz`
- `camera_url`: `text`
- `slots_data`: `jsonb` (Array of 8-coordinate vectors)
- `latitude`: `float8`
- `longitude`: `float8`
- `is_verified`: `boolean` (Default: false)
