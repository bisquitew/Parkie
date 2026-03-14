<p align="center">
  <img src="https://img.shields.io/badge/ITfest-2026-8d23be?style=for-the-badge&labelColor=0a0a0a" alt="ITfest 2026" />
  <img src="https://img.shields.io/badge/Team-UniHackers-10b981?style=for-the-badge&labelColor=0a0a0a" alt="UniHackers" />
</p>

<h1 align="center">🅿️ Parkie</h1>
<h3 align="center">AI-Powered Smart Parking · Real-Time Availability · Zero Guesswork</h3>

<p align="center">
  <em>Find a parking spot before you even get there.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/YOLOv11-FF6F00?style=flat-square&logo=pytorch&logoColor=white" />
  <img src="https://img.shields.io/badge/React_Native-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white" />
</p>

---

## ✨ What is Parkie?

Parkie uses **computer vision** to detect cars in parking lots from live camera feeds and shows **real-time availability** on a mobile map — so drivers can find open spots instantly, without circling the block.

```
📷 Camera  →  🤖 AI Vision (YOLOv11)  →  ⚡ Backend API  →  📱 Mobile App
                                                          →  🖥️  Dashboard
```

### How it works

1. **Lot owners** register their parking lots on the **web dashboard** and define parking slot polygons by clicking on a camera frame
2. **AI Vision Agent** runs YOLO inference on the camera feed, detects which slots are occupied, and reports to the backend
3. **Drivers** open the **mobile app**, see a live map with color-coded pins (🟢 green / 🟡 yellow / 🔴 red), and navigate to the best spot
4. Updates flow in **real-time** via Supabase Realtime — no refreshing needed

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PARKIE SYSTEM                            │
├──────────────┬──────────────────┬────────────────────────────────┤
│  📷 Camera   │  🤖 AI Vision    │  ⚡ Backend API (FastAPI)      │
│  Feed/RTSP   │  YOLOv11 + CV2   │  REST · Supabase · bcrypt     │
│              │                  │                                │
│              │  Inference: 5s   │  13 endpoints                  │
│              │  Reporting: 15s  │  Verification workflow         │
│              │  Smoothing: 5x   │  Frame capture (OpenCV)        │
├──────────────┴──────────────────┴────────────────────────────────┤
│                     🗄️ Supabase (PostgreSQL)                     │
│              Tables: users · parking_lots                        │
│              Realtime: WebSocket push on UPDATE                  │
├──────────────────────────────┬───────────────────────────────────┤
│  📱 Mobile App               │  🖥️  Web Dashboard                │
│  Expo · React Native · Maps  │  Vite · TypeScript · Canvas       │
│  Live pins · Navigation      │  Lot CRUD · Slot polygon editor   │
│  Nearby search (Nominatim)   │  Camera frame capture             │
└──────────────────────────────┴───────────────────────────────────┘
```

---

## 📂 Project Structure

```
unihackers/
├── backend_api/          # FastAPI REST API
│   ├── main.py           # App + all endpoints
│   ├── admin_verify.py   # CLI tool for lot verification
│   ├── docs.md           # API documentation
│   └── requirements.txt
│
├── ai_vision/            # Computer vision pipeline
│   ├── vision_agent.py   # Production agent (headless)
│   ├── smart_parking.py  # Local viewer with GUI
│   ├── select_slots.py   # Interactive slot polygon selector
│   ├── train_pklot.py    # PKLot dataset training script
│   └── requirements.txt
│
└── Frontend/
    ├── Parkie/           # Mobile app (Expo / React Native)
    │   ├── screens/      # HomeScreen
    │   ├── components/   # GoogleMaps, NearbySearch, ParkingCard...
    │   ├── lib/          # API service, Supabase client, data transforms
    │   └── theme/        # Design tokens (dark amethyst theme)
    │
    └── Dashboard/        # Web dashboard (Vite / TypeScript)
        └── src/
            ├── main.ts   # SPA: auth, lots, canvas slot editor
            ├── api.ts    # API client
            └── style.css # Styling
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- **Supabase** project ([supabase.com](https://supabase.com))
- **ngrok** (for tunneling the backend)

### 1. Backend API

```bash
cd backend_api
pip install -r requirements.txt
```

Create a `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

Start the server:
```bash
uvicorn main:app --reload --port 8000
```

> 📖 Swagger docs available at `http://localhost:8000/docs`

### 2. AI Vision Agent

```bash
cd ai_vision
pip install -r requirements.txt
```

Create a `.env` file:
```env
BACKEND_URL=http://localhost:8000
LOT_ID=your-lot-uuid
```

Run the agent:
```bash
# Production (headless, reports to backend)
python vision_agent.py --video assets/demo_video.mp4

# With debug GUI
python vision_agent.py --video assets/demo_video.mp4 --debug

# Define parking slots first (interactive)
python select_slots.py --video assets/demo_video.mp4
```

### 3. Mobile App (Parkie)

```bash
cd Frontend/Parkie
npm install
npx expo start
```

> Update `config/api.js` with your backend URL (ngrok or local).

### 4. Web Dashboard

```bash
cd Frontend/Dashboard
npm install
npm run dev
```

> Update `VITE_API_BASE_URL` in `.env` or the fallback in `src/api.ts`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Create a lot owner account |
| `POST` | `/login` | Authenticate and get user profile |
| `GET` | `/lots` | All verified lots (mobile app) |
| `GET` | `/lots/colors` | Lightweight color-only updates |
| `GET` | `/lots/{id}` | Single lot details |
| `GET` | `/lots/{id}/config` | Camera URL + slot polygons (AI agent) |
| `GET` | `/my_lots/{owner_id}` | Owner's lots (dashboard) |
| `POST` | `/lots` | Register a new parking lot |
| `POST` | `/lots/{id}/setup` | Save slot polygon configuration |
| `POST` | `/update_lot` | Update occupancy (AI agent → backend) |
| `POST` | `/capture_frame` | Grab a camera frame as base64 |
| `PATCH` | `/lots/{id}/verify` | Admin: verify/reject a lot |

---

## 🗄️ Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `name` | `text` | |
| `email` | `text` | Unique |
| `password` | `text` | bcrypt hashed |
| `created_at` | `timestamptz` | |

### `parking_lots`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | FK → users.id |
| `name` | `text` | |
| `latitude` | `float8` | |
| `longitude` | `float8` | |
| `camera_url` | `text` | RTSP/HTTP stream URL |
| `slots_data` | `jsonb` | Array of 8-coord polygon vectors |
| `capacity` | `int` | Total slots |
| `available_spots` | `int` | Currently free |
| `status_color` | `text` | `green` / `yellow` / `red` / `gray` |
| `is_verified` | `boolean` | Admin approval flag |
| `last_updated` | `timestamptz` | Last AI scan time |

---

## 🤖 AI Detection Pipeline

The vision agent uses a multi-step approach for robust parking detection:

1. **YOLO Inference** — YOLOv11m detects vehicles (car, motorcycle, bus, truck, bicycle)
2. **Polygon Matching** — 10-point sampling checks if a vehicle overlaps a slot polygon
3. **Large Vehicle Filter** — Detections > 12% of frame area are ignored (passing buses/trucks)
4. **Occupancy Smoothing** — 5-frame sliding window with majority vote prevents flicker
5. **Backend Reporting** — Stable occupancy posted every 15 seconds

---

## 🎨 Design System

The mobile app uses a **premium dark amethyst** theme:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0a` | Main screen |
| Primary | `#8d23be` | CTAs, active elements |
| Surface | `#401056` | Cards, glass panels |
| Status Green | `#10b981` | < 70% occupied |
| Status Yellow | `#f59e0b` | 70–85% occupied |
| Status Red | `#ef4444` | > 85% occupied |

Glassmorphism with `rgba(64, 16, 86, 0.4)` backgrounds and violet borders throughout.

---

## 👥 Team UniHackers

Built with ☕ and 🍜 at **ITfest 2026 Hackathon**. :3 

---

<p align="center">
  <sub>Made for ITfest 2026 · Timișoara, Romania 🇷🇴</sub>
</p>
