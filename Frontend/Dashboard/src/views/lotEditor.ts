import { api } from '../api';
import { state } from '../state';
import { navigate } from '../router';
import { el, clearApp } from '../utils/dom';

let points: { x: number, y: number }[] = [];
let img: HTMLImageElement | null = null;
let draggingPointIndex: number | null = null;

export function renderLotView() {
  if (!state.currentLot) {
    navigate(state.currentUser?.role === 'admin' ? 'admin' : 'dashboard');
    return;
  }

  points = []; // Reset points when entering view
  img = null;

  const backTarget = state.currentUser?.role === 'admin' ? 'admin' : 'dashboard';
  const app = clearApp();

  const backBtn = el('button', { id: 'back-to-dashboard', className: 'counter' }, "← Back");
  const cameraUrlInput = el('input', { 
    type: 'text', 
    id: 'camera-url-input', 
    value: state.currentLot.camera_url, 
    placeholder: 'Camera URL or Path', 
    style: 'width: 300px; padding: 8px; border-radius: 4px; border: 1px solid #ccc;' 
  });
  const captureBtn = el('button', { id: 'capture-frame-btn', className: 'counter' }, "Capture Frame");
  const captureStatus = el('span', { id: 'capture-status' });
  
  const loadingOverlay = el('div', { id: 'loading-overlay', className: 'loading-overlay', style: 'display:none' },
    el('div', { className: 'spinner' }),
    el('p', {}, "Capturing frame...")
  );

  const canvas = el('canvas', { id: 'detection-canvas' });
  const canvasPlaceholder = el('div', { id: 'canvas-placeholder' }, "Click 'Capture Frame' to start plotting");
  
  const undoBtn = el('button', { id: 'undo-point', className: 'counter secondary' }, "Undo Last Point");
  const clearBtn = el('button', { id: 'clear-points', className: 'counter secondary' }, "Clear All");
  const saveBtn = el('button', { id: 'save-config', className: 'counter' }, "Save Configuration");

  const canvasControls = el('div', { className: 'canvas-controls', style: 'display:none' },
    undoBtn,
    clearBtn,
    saveBtn
  );

  app.append(
    el('header', { className: 'dashboard-header' },
      backBtn,
      el('h1', {}, state.currentLot.name),
      el('div', {}) // Spacer
    ),
    el('section', { id: 'center' },
      el('div', { className: 'lot-details' },
        el('p', {}, `Location: ${state.currentLot.latitude}, ${state.currentLot.longitude}`),
        el('p', {}, "Step 1: Capture a frame from the camera stream."),
        el('p', {}, "Step 2: Click points on the image to define parking slots (4 points per slot).")
      ),
      el('div', { className: 'canvas-actions' },
        cameraUrlInput,
        captureBtn,
        captureStatus
      ),
      loadingOverlay,
      el('div', { className: 'canvas-container' },
        canvas,
        canvasPlaceholder
      ),
      canvasControls
    )
  );

  backBtn.addEventListener('click', () => navigate(backTarget));

  captureBtn.addEventListener('click', async () => {
    const url = cameraUrlInput.value;
    if (!url) {
      alert("Please enter a camera URL/Path.");
      return;
    }

    captureBtn.disabled = true;
    loadingOverlay.style.display = 'flex';
    captureStatus.innerText = "Capturing...";

    try {
      const base64Image = await api.captureFrame(url);
      captureStatus.innerText = "Frame captured!";
      initCanvas(canvas, base64Image, url, canvasControls, canvasPlaceholder, saveBtn, undoBtn, clearBtn);
      canvasControls.style.display = 'flex';
      canvasPlaceholder.style.display = 'none';
    } catch (err: any) {
      captureStatus.innerText = "Error: " + err.message;
      alert("Failed to capture frame: " + err.message);
    } finally {
      captureBtn.disabled = false;
      loadingOverlay.style.display = 'none';
    }
  });
}

function initCanvas(
  canvas: HTMLCanvasElement, 
  base64Image: string, 
  cameraUrl: string, 
  controls: HTMLElement, 
  placeholder: HTMLElement,
  saveBtn: HTMLButtonElement,
  undoBtn: HTMLButtonElement,
  clearBtn: HTMLButtonElement
) {
  const ctx = canvas.getContext('2d')!;

  // Initialize from existing slots if available and not already initialized
  if (points.length === 0 && state.currentLot?.slots_data) {
    state.currentLot.slots_data.forEach(slot => {
      for (let i = 0; i < 8; i += 2) {
        points.push({ x: slot[i], y: slot[i+1] });
      }
    });
  }

  img = new Image();
  img.src = base64Image;
  
  img.onload = () => {
    canvas.width = img!.width;
    canvas.height = img!.height;
    draw(ctx, canvas);
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
    if (!img || !img.complete || !img.src) return;
    const { x, y } = getMousePos(e);

    const hitRadius = 10;
    const hitIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < hitRadius);

    if (hitIndex !== -1) {
      draggingPointIndex = hitIndex;
    } else {
      points.push({ x, y });
      draw(ctx, canvas);
    }
  });

  const mouseMoveHandler = (e: MouseEvent) => {
    if (draggingPointIndex === null) return;
    const { x, y } = getMousePos(e);
    points[draggingPointIndex] = { x, y };
    draw(ctx, canvas);
  };

  const mouseUpHandler = () => {
    draggingPointIndex = null;
  };

  window.addEventListener('mousemove', mouseMoveHandler);
  window.addEventListener('mouseup', mouseUpHandler);

  // Clean up listeners when navigating away (this is a bit tricky without a proper framework)
  // For now we just keep it simple.

  undoBtn.onclick = () => {
    points.pop();
    draw(ctx, canvas);
  };

  clearBtn.onclick = () => {
    points = [];
    draw(ctx, canvas);
  };

  saveBtn.onclick = async () => {
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
      if (!state.currentLot) return;
      await api.saveLotSetup(state.currentLot.id, cameraUrl, slots_data);
      alert("Configuration saved successfully!");
      navigate(state.currentUser?.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err: any) {
      alert(`Error saving configuration: ${err.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = "Save Configuration";
    }
  };
}

function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  if (!img) return;
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
