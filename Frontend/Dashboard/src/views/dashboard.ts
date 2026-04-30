import { api } from '../api';
import { state, ParkingLot } from '../state';
import { navigate } from '../router';
import { el, clearApp } from '../utils/dom';

export async function renderDashboard() {
  const app = clearApp();

  const logoutBtn = el('button', { id: 'logout', className: 'counter' }, "Logout");
  const addLotBtn = el('button', { id: 'add-lot-btn', className: 'counter' }, "Add Parking Lot");
  const lotsList = el('div', { id: 'lots-list', className: 'lots-grid' }, 
    el('p', {}, "Loading your lots...")
  );

  // Modal elements
  const lotNameInput = el('input', { type: 'text', id: 'lot-name', placeholder: 'Lot Name', required: true });
  const lotLatInput = el('input', { type: 'number', step: 'any', id: 'lot-lat', placeholder: 'Latitude', required: true });
  const lotLngInput = el('input', { type: 'number', step: 'any', id: 'lot-lng', placeholder: 'Longitude', required: true });
  const lotCameraInput = el('input', { type: 'text', id: 'lot-camera', placeholder: 'Camera URL or Local Path', required: true });
  const closeModalBtn = el('button', { type: 'button', id: 'close-modal', className: 'counter secondary' }, "Cancel");
  const addLotForm = el('form', { id: 'add-lot-form' },
    lotNameInput,
    lotLatInput,
    lotLngInput,
    lotCameraInput,
    el('div', { className: 'modal-actions' },
      closeModalBtn,
      el('button', { type: 'submit', className: 'counter' }, "Create")
    )
  );

  const modal = el('div', { id: 'add-lot-modal', className: 'modal', style: 'display:none' },
    el('div', { className: 'modal-content' },
      el('h2', {}, "Add New Parking Lot"),
      addLotForm
    )
  );

  app.append(
    el('header', { className: 'dashboard-header' },
      el('h1', {}, `Welcome, ${state.currentUser?.name}`),
      logoutBtn
    ),
    el('section', { id: 'center' },
      el('div', { className: 'dashboard-controls' },
        el('h2', {}, "Your Parking Lots"),
        addLotBtn
      ),
      lotsList
    ),
    modal
  );

  // Logout
  logoutBtn.addEventListener('click', () => {
    state.setUser(null);
    navigate('auth');
  });

  // Modal Toggle
  addLotBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Add Lot Form
  addLotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      owner_id: state.currentUser?.user_id,
      name: lotNameInput.value,
      latitude: parseFloat(lotLatInput.value),
      longitude: parseFloat(lotLngInput.value),
      camera_url: lotCameraInput.value,
      slots_data: []
    };

    try {
      await api.post('/lots', payload);
      modal.style.display = 'none';
      await refreshLots(lotsList);
    } catch (err: any) {
      alert(err.message);
    }
  });

  await refreshLots(lotsList);
}

async function refreshLots(list: HTMLElement) {
  const userId = state.currentUser?.user_id;
  
  if (!userId) {
    list.innerHTML = '';
    list.appendChild(el('p', { className: 'error' }, "Error: User ID not found. Please logout and login again."));
    return;
  }

  try {
    state.currentLots = await api.get(`/my_lots/${userId}`);
    list.innerHTML = '';
    
    if (state.currentLots.length === 0) {
      list.appendChild(el('p', {}, "No parking lots found. Add your first one!"));
      return;
    }

    state.currentLots.forEach(lot => {
      const card = el('div', { className: 'lot-card' },
        el('div', { className: 'status-indicator', style: `background-color: ${lot.status_color}` }),
        el('div', { className: 'lot-info' },
          el('h3', {}, lot.name),
          el('p', {}, `${lot.available_spots} / ${lot.capacity} spots available`)
        )
      );
      
      card.addEventListener('click', () => {
        state.currentLot = lot;
        navigate('lot-view');
      });
      
      list.appendChild(card);
    });

  } catch (err: any) {
    list.innerHTML = '';
    list.appendChild(el('p', { className: 'error' }, `Error: ${err.message}`));
  }
}
