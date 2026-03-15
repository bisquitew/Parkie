import './style.css'
import { api } from './api'

// --- Types ---
interface User {
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin';
}

interface ParkingLot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  camera_url: string;
  status_color: string;
  capacity: number;
  available_spots: number;
  slots_data?: number[][];
  is_verified?: boolean;
  owner_id?: string;
}

// --- State ---
let currentUser: User | null = null;
try {
  currentUser = JSON.parse(localStorage.getItem('user') || 'null');
} catch (e) {
  console.error("Failed to parse user from localStorage", e);
  localStorage.removeItem('user');
}
let currentLots: ParkingLot[] = [];
let currentLot: ParkingLot | null = null;
let adminTab: 'pending' | 'all' = 'pending';

function getDefaultView(): 'auth' | 'dashboard' | 'admin' | 'lot-view' {
  if (!currentUser) return 'auth';
  return currentUser.role === 'admin' ? 'admin' : 'dashboard';
}

let currentView: 'auth' | 'dashboard' | 'admin' | 'lot-view' = getDefaultView();

// --- Components ---

function renderAuth() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <section id="center">
      <div class="auth-container">
        <h1>Parkie Dashboard</h1>
        <div id="auth-form-container">
          <form id="login-form">
            <h2>Login</h2>
            <input type="email" id="login-email" placeholder="Email" required>
            <input type="password" id="login-password" placeholder="Password" required>
            <button type="submit" class="counter">Login</button>
            <p>Don't have an account? <a href="#" id="show-register">Register</a></p>
          </form>
        </div>
      </div>
    </section>
  `;

  // Event Listeners
  document.querySelector('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.querySelector('#login-email') as HTMLInputElement).value;
    const password = (document.querySelector('#login-password') as HTMLInputElement).value;
    try {
      const user = await api.post('/login', { email, password });
      currentUser = user;
      localStorage.setItem('user', JSON.stringify(user));
      navigate(user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  });

  document.querySelector('#show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    renderRegister();
  });
}

function renderRegister() {
  const container = document.querySelector('#auth-form-container')!;
  container.innerHTML = `
    <form id="register-form">
      <h2>Register</h2>
      <input type="text" id="register-name" placeholder="Full Name" required>
      <input type="email" id="register-email" placeholder="Email" required>
      <input type="password" id="register-password" placeholder="Password" required>
      <button type="submit" class="counter">Register</button>
      <p>Already have an account? <a href="#" id="show-login">Login</a></p>
    </form>
  `;

  document.querySelector('#register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.querySelector('#register-name') as HTMLInputElement).value;
    const email = (document.querySelector('#register-email') as HTMLInputElement).value;
    const password = (document.querySelector('#register-password') as HTMLInputElement).value;
    try {
      const user = await api.post('/register', { name, email, password });
      currentUser = user;
      localStorage.setItem('user', JSON.stringify(user));
      navigate(user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  });

  document.querySelector('#show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    renderAuth();
  });
}

async function renderDashboard() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <header class="dashboard-header">
      <h1>Welcome, ${currentUser?.name}</h1>
      <button id="logout" class="counter">Logout</button>
    </header>
    <section id="center">
      <div class="dashboard-controls">
        <h2>Your Parking Lots</h2>
        <button id="add-lot-btn" class="counter">Add Parking Lot</button>
      </div>
      <div id="lots-list" class="lots-grid">
        <p>Loading your lots...</p>
      </div>
    </section>

    <!-- Modal for adding lot -->
    <div id="add-lot-modal" class="modal" style="display:none">
      <div class="modal-content">
        <h2>Add New Parking Lot</h2>
        <form id="add-lot-form">
          <input type="text" id="lot-name" placeholder="Lot Name" required>
          <input type="number" step="any" id="lot-lat" placeholder="Latitude" required>
          <input type="number" step="any" id="lot-lng" placeholder="Longitude" required>
          <input type="text" id="lot-camera" placeholder="Camera URL or Local Path" required>
          <div class="modal-actions">
            <button type="button" id="close-modal" class="counter secondary">Cancel</button>
            <button type="submit" class="counter">Create</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Logout
  document.querySelector('#logout')?.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('user');
    navigate('auth');
  });

  // Modal Toggle
  const modal = document.querySelector('#add-lot-modal') as HTMLElement;
  document.querySelector('#add-lot-btn')?.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  document.querySelector('#close-modal')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Add Lot Form
  document.querySelector('#add-lot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      owner_id: currentUser?.user_id,
      name: (document.querySelector('#lot-name') as HTMLInputElement).value,
      latitude: parseFloat((document.querySelector('#lot-lat') as HTMLInputElement).value),
      longitude: parseFloat((document.querySelector('#lot-lng') as HTMLInputElement).value),
      camera_url: (document.querySelector('#lot-camera') as HTMLInputElement).value,
      slots_data: [] // Initially empty
    };

    try {
      await api.post('/lots', payload);
      modal.style.display = 'none';
      await refreshLots();
    } catch (err: any) {
      alert(err.message);
    }
  });

  await refreshLots();
}

async function refreshLots() {
  const list = document.querySelector('#lots-list')!;
  const userId = currentUser?.user_id || (currentUser as any)?.id;
  
  if (!userId) {
    list.innerHTML = '<p class="error">Error: User ID not found. Please logout and login again.</p>';
    return;
  }

  try {
    currentLots = await api.get(`/my_lots/${userId}`);
    if (currentLots.length === 0) {
      list.innerHTML = '<p>No parking lots found. Add your first one!</p>';
      return;
    }

    list.innerHTML = currentLots.map(lot => `
      <div class="lot-card" data-id="${lot.id}">
        <div class="status-indicator" style="background-color: ${lot.status_color}"></div>
        <div class="lot-info">
          <h3>${lot.name}</h3>
          <p>${lot.available_spots} / ${lot.capacity} spots available</p>
        </div>
      </div>
    `).join('');

    // Add click listeners to cards
    document.querySelectorAll('.lot-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        currentLot = currentLots.find(l => l.id === id) || null;
        navigate('lot-view');
      });
    });

  } catch (err: any) {
    list.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

// --- Admin Panel ---

async function renderAdminPanel() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <header class="dashboard-header">
      <h1>Admin Panel</h1>
      <button id="logout" class="counter">Logout</button>
    </header>
    <section id="center">
      <div class="admin-tabs">
        <button class="tab-btn ${adminTab === 'pending' ? 'active' : ''}" data-tab="pending">
          Pending Lots
        </button>
        <button class="tab-btn ${adminTab === 'all' ? 'active' : ''}" data-tab="all">
          All Verified Lots
        </button>
      </div>
      <div id="admin-lots-list" class="lots-grid">
        <p>Loading lots...</p>
      </div>
    </section>
  `;

  // Logout
  document.querySelector('#logout')?.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('user');
    navigate('auth');
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adminTab = btn.getAttribute('data-tab') as 'pending' | 'all';
      renderAdminPanel();
    });
  });

  await refreshAdminLots();
}

async function refreshAdminLots() {
  const list = document.querySelector('#admin-lots-list')!;

  try {
    let lots: ParkingLot[];
    if (adminTab === 'pending') {
      lots = await api.getPendingLots();
    } else {
      lots = await api.get('/lots');
    }

    if (lots.length === 0) {
      list.innerHTML = adminTab === 'pending'
        ? '<p>No pending lots to review. All caught up! ✅</p>'
        : '<p>No verified lots yet.</p>';
      return;
    }

    if (adminTab === 'pending') {
      list.innerHTML = lots.map(lot => `
        <div class="lot-card admin-lot-card" data-id="${lot.id}">
          <div class="status-indicator" style="background-color: orange"></div>
          <div class="lot-info">
            <h3>${lot.name}</h3>
            <p>📍 ${lot.latitude.toFixed(4)}, ${lot.longitude.toFixed(4)}</p>
            <p>🅿️ ${lot.capacity} spots · 📷 ${lot.camera_url ? 'Camera set' : 'No camera'}</p>
            <p>🧩 ${lot.slots_data?.length || 0} slot(s) plotted</p>
          </div>
          <div class="admin-actions">
            <button class="action-btn verify-btn" data-id="${lot.id}" title="Verify">✅</button>
            <button class="action-btn reject-btn" data-id="${lot.id}" title="Reject">❌</button>
          </div>
        </div>
      `).join('');

      // Verify buttons
      document.querySelectorAll('.verify-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const lotId = btn.getAttribute('data-id')!;
          const lotName = lots.find(l => l.id === lotId)?.name || 'this lot';
          if (!confirm(`Verify "${lotName}"? It will appear in the mobile app.`)) return;
          try {
            (btn as HTMLButtonElement).disabled = true;
            await api.verifyLot(lotId);
            await refreshAdminLots();
          } catch (err: any) {
            alert('Failed to verify: ' + err.message);
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });

      // Reject buttons
      document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const lotId = btn.getAttribute('data-id')!;
          const lotName = lots.find(l => l.id === lotId)?.name || 'this lot';
          if (!confirm(`Reject and delete "${lotName}"? This cannot be undone.`)) return;
          try {
            (btn as HTMLButtonElement).disabled = true;
            await api.rejectLot(lotId);
            await refreshAdminLots();
          } catch (err: any) {
            alert('Failed to reject: ' + err.message);
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });

      // Click card to inspect lot
      document.querySelectorAll('.admin-lot-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-id');
          currentLot = lots.find(l => l.id === id) || null;
          navigate('lot-view');
        });
      });

    } else {
      // All verified lots with unverify option
      list.innerHTML = lots.map(lot => `
        <div class="lot-card admin-lot-card" data-id="${lot.id}">
          <div class="status-indicator" style="background-color: ${lot.status_color}"></div>
          <div class="lot-info">
            <h3>${lot.name}</h3>
            <p>${lot.available_spots} / ${lot.capacity} spots available</p>
          </div>
          <div class="admin-actions">
            <button class="action-btn unverify-btn" data-id="${lot.id}" title="Unverify">🔒</button>
          </div>
        </div>
      `).join('');

      // Unverify buttons
      document.querySelectorAll('.unverify-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const lotId = btn.getAttribute('data-id')!;
          const lotName = lots.find(l => l.id === lotId)?.name || 'this lot';
          if (!confirm(`Unverify "${lotName}"? It will be removed from the mobile app.`)) return;
          try {
            (btn as HTMLButtonElement).disabled = true;
            await api.unverifyLot(lotId);
            await refreshAdminLots();
          } catch (err: any) {
            alert('Failed to unverify: ' + err.message);
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });

      document.querySelectorAll('.admin-lot-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-id');
          currentLot = lots.find(l => l.id === id) || null;
          navigate('lot-view');
        });
      });
    }
  } catch (err: any) {
    list.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

function renderLotView() {
  if (!currentLot) {
    navigate(currentUser?.role === 'admin' ? 'admin' : 'dashboard');
    return;
  }

  const backTarget = currentUser?.role === 'admin' ? 'admin' : 'dashboard';
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <header class="dashboard-header">
      <button id="back-to-dashboard" class="counter">← Back</button>
      <h1>${currentLot.name}</h1>
      <div></div> <!-- Spacer -->
    </header>
    <section id="center">
      <div class="lot-details">
        <p>Location: ${currentLot.latitude}, ${currentLot.longitude}</p>
        <p>Step 1: Capture a frame from the camera stream.</p>
        <p>Step 2: Click points on the image to define parking slots (4 points per slot).</p>
      </div>

      <div class="canvas-actions">
        <input type="text" id="camera-url-input" value="${currentLot.camera_url}" placeholder="Camera URL or Path" style="width: 300px; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
        <button id="capture-frame-btn" class="counter">Capture Frame</button>
        <span id="capture-status"></span>
      </div>
      
      <div id="loading-overlay" class="loading-overlay" style="display:none">
        <div class="spinner"></div>
        <p>Capturing frame...</p>
      </div>

      <div class="canvas-container">
        <canvas id="detection-canvas"></canvas>
        <div id="canvas-placeholder">Click 'Capture Frame' to start plotting</div>
      </div>

      <div class="canvas-controls" style="display:none">
        <button id="undo-point" class="counter secondary">Undo Last Point</button>
        <button id="clear-points" class="counter secondary">Clear All</button>
        <button id="save-config" class="counter">Save Configuration</button>
      </div>
    </section>
  `;

  document.querySelector('#back-to-dashboard')?.addEventListener('click', () => navigate(backTarget));
  
  const captureBtn = document.querySelector('#capture-frame-btn') as HTMLButtonElement;
  const cameraInput = document.querySelector('#camera-url-input') as HTMLInputElement;
  const loadingOverlay = document.querySelector('#loading-overlay') as HTMLElement;
  const status = document.querySelector('#capture-status') as HTMLElement;
  
  captureBtn.addEventListener('click', async () => {
    if (!currentLot) return;
    const url = cameraInput.value;
    if (!url) {
        alert("Please enter a camera URL/Path.");
        return;
    }

    captureBtn.disabled = true;
    loadingOverlay.style.display = 'flex';
    status.innerText = "Capturing...";

    try {
      const base64Image = await api.captureFrame(url);
      status.innerText = "Frame captured!";
      initCanvas(base64Image, url);
      document.querySelector('.canvas-controls')!.setAttribute('style', 'display:flex');
      document.querySelector('#canvas-placeholder')!.setAttribute('style', 'display:none');
    } catch (err: any) {
      status.innerText = "Error: " + err.message;
      alert("Failed to capture frame: " + err.message);
    } finally {
      captureBtn.disabled = false;
      loadingOverlay.style.display = 'none';
    }
  });
}

let points: { x: number, y: number }[] = [];
let img: HTMLImageElement;
let draggingPointIndex: number | null = null;

function initCanvas(base64Image: string, cameraUrl: string) {
  const canvas = document.querySelector('#detection-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const saveBtn = document.querySelector('#save-config') as HTMLButtonElement;

  // Initialize from existing slots if available and not already initialized
  if (points.length === 0 && currentLot?.slots_data) {
    currentLot.slots_data.forEach(slot => {
        for (let i = 0; i < 8; i += 2) {
            points.push({ x: slot[i], y: slot[i+1] });
        }
    });
  }

  img = new Image();
  img.src = base64Image;
  
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    draw();
  };

  const getMousePos = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY)
    };
  };

  canvas.addEventListener('mousedown', (e) => {
    if (!img.complete || !img.src) return;
    const { x, y } = getMousePos(e);

    // Check if clicking near an existing point to drag
    const hitRadius = 10;
    const hitIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < hitRadius);

    if (hitIndex !== -1) {
      draggingPointIndex = hitIndex;
    } else {
      points.push({ x, y });
      draw();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (draggingPointIndex === null) return;
    const { x, y } = getMousePos(e);
    points[draggingPointIndex] = { x, y };
    draw();
  });

  window.addEventListener('mouseup', () => {
    draggingPointIndex = null;
  });

  document.querySelector('#undo-point')?.addEventListener('click', () => {
    points.pop();
    draw();
  });

  document.querySelector('#clear-points')?.addEventListener('click', () => {
    points = [];
    draw();
  });

  saveBtn.addEventListener('click', async () => {
    if (points.length % 4 !== 0 || points.length === 0) {
      alert("Please define at least one complete slot (4 points per slot).");
      return;
    }

    const slots_data: number[][] = [];
    for (let i = 0; i < points.length; i += 4) {
      const p1 = points[i];
      const p2 = points[i+1];
      const p3 = points[i+2];
      const p4 = points[i+3];
      slots_data.push([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]);
    }

    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
      if (!currentLot) return;
      await api.saveLotSetup(currentLot.id, cameraUrl, slots_data);
      alert("Configuration saved successfully!");
      navigate(currentUser?.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err: any) {
      alert(`Error saving configuration: ${err.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = "Save Configuration";
    }
  });

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    ctx.lineWidth = 2;
    
    for (let i = 0; i < points.length; i += 4) {
      ctx.strokeStyle = '#aa3bff';
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      if (points[i+1]) ctx.lineTo(points[i+1].x, points[i+1].y);
      if (points[i+2]) ctx.lineTo(points[i+2].x, points[i+2].y);
      if (points[i+3]) ctx.lineTo(points[i+3].x, points[i+3].y);
      if (points[i+3]) ctx.closePath();
      ctx.stroke();
      
      for (let j = 0; j < 4 && i+j < points.length; j++) {
        ctx.fillStyle = i+j === draggingPointIndex ? '#ff00ff' : '#aa3bff';
        ctx.beginPath();
        ctx.arc(points[i+j].x, points[i+j].y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const remaining = points.length % 4;
    if (remaining > 0) {
      const start = points.length - remaining;
      ctx.strokeStyle = '#ff3b3b';
      ctx.beginPath();
      ctx.moveTo(points[start].x, points[start].y);
      for (let j = 1; j < remaining; j++) {
        ctx.lineTo(points[start+j].x, points[start+j].y);
      }
      ctx.stroke();
      
      for (let j = 0; j < remaining; j++) {
        ctx.fillStyle = start+j === draggingPointIndex ? '#ff00ff' : '#ff3b3b';
        ctx.beginPath();
        ctx.arc(points[start+j].x, points[start+j].y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- Navigation ---

function navigate(view: 'auth' | 'dashboard' | 'admin' | 'lot-view') {
  currentView = view;
  points = []; // Reset canvas points on navigation
  if (view === 'auth') renderAuth();
  else if (view === 'dashboard') renderDashboard();
  else if (view === 'admin') renderAdminPanel();
  else if (view === 'lot-view') renderLotView();
}

// Init
navigate(currentView);
