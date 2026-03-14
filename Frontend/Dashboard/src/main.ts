import './style.css'
import { api } from './api'

// --- Types ---
interface User {
  user_id: string;
  name: string;
  email: string;
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
}

// --- State ---
let currentUser: User | null = JSON.parse(localStorage.getItem('user') || 'null');
let currentLots: ParkingLot[] = [];
let currentLot: ParkingLot | null = null;
let currentView: 'auth' | 'dashboard' | 'lot-view' = currentUser ? 'dashboard' : 'auth';

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
      navigate('dashboard');
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
      navigate('dashboard');
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
          <input type="url" id="lot-camera" placeholder="Camera URL (Image/Stream)" required>
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
  try {
    currentLots = await api.get(`/my_lots/${currentUser?.user_id}`);
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

function renderLotView() {
  if (!currentLot) {
    navigate('dashboard');
    return;
  }

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
        <p>Configuration: Click points on the image below to define parking slots (4 points per slot).</p>
      </div>
      
      <div class="canvas-container">
        <canvas id="detection-canvas"></canvas>
      </div>

      <div class="canvas-controls">
        <button id="undo-point" class="counter secondary">Undo Last Point</button>
        <button id="clear-points" class="counter secondary">Clear All</button>
        <button id="save-config" class="counter">Save Configuration</button>
      </div>
    </section>
  `;

  document.querySelector('#back-to-dashboard')?.addEventListener('click', () => navigate('dashboard'));

  initCanvas();
}

let points: { x: number, y: number }[] = [];
let img: HTMLImageElement;

function initCanvas() {
  const canvas = document.querySelector('#detection-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  img = new Image();
  img.src = currentLot?.camera_url || '';
  
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    draw();
  };

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    points.push({ x, y });
    draw();
  });

  document.querySelector('#undo-point')?.addEventListener('click', () => {
    points.pop();
    draw();
  });

  document.querySelector('#clear-points')?.addEventListener('click', () => {
    points = [];
    draw();
  });

  document.querySelector('#save-config')?.addEventListener('click', async () => {
    if (points.length % 4 !== 0) {
      alert("Please complete the current slot (4 points required per slot).");
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

    try {
      await api.put(`/lots/${currentLot?.id}/setup`, {
        owner_id: currentUser?.user_id,
        name: currentLot?.name,
        latitude: currentLot?.latitude,
        longitude: currentLot?.longitude,
        camera_url: currentLot?.camera_url,
        slots_data
      });
      alert("Configuration saved successfully!");
      navigate('dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  });

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Draw existing slots
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#aa3bff';
    
    for (let i = 0; i < points.length; i += 4) {
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      if (points[i+1]) ctx.lineTo(points[i+1].x, points[i+1].y);
      if (points[i+2]) ctx.lineTo(points[i+2].x, points[i+2].y);
      if (points[i+3]) ctx.lineTo(points[i+3].x, points[i+3].y);
      if (points[i+3]) ctx.closePath();
      ctx.stroke();
      
      // Draw points
      for (let j = 0; j < 4 && i+j < points.length; j++) {
        ctx.fillStyle = '#aa3bff';
        ctx.beginPath();
        ctx.arc(points[i+j].x, points[i+j].y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw current incomplete slot points
    const remaining = points.length % 4;
    if (remaining > 0) {
      const start = points.length - remaining;
      ctx.beginPath();
      ctx.moveTo(points[start].x, points[start].y);
      for (let j = 1; j < remaining; j++) {
        ctx.lineTo(points[start+j].x, points[start+j].y);
      }
      ctx.stroke();
      
      for (let j = 0; j < remaining; j++) {
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath();
        ctx.arc(points[start+j].x, points[start+j].y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- Navigation ---

function navigate(view: 'auth' | 'dashboard' | 'lot-view') {
  currentView = view;
  points = []; // Reset canvas points on navigation
  if (view === 'auth') renderAuth();
  else if (view === 'dashboard') renderDashboard();
  else if (view === 'lot-view') renderLotView();
}

// Init
navigate(currentView);
