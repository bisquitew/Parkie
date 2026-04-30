import { api } from '../api';
import { state } from '../state';
import { navigate } from '../router';
import { el, clearApp } from '../utils/dom';

export async function renderDashboard() {
  const app = clearApp();

  const addLotModal = el('div', { id: 'add-lot-modal', className: 'modal' },
    el('div', { className: 'modal-content' },
      el('h2', {}, "Add New Parking Lot"),
      el('form', { id: 'add-lot-form' },
        el('input', { type: 'text', id: 'lot-name', placeholder: 'Lot Name', required: true }),
        el('input', { type: 'number', step: 'any', id: 'lot-lat', placeholder: 'Latitude', required: true }),
        el('input', { type: 'number', step: 'any', id: 'lot-lng', placeholder: 'Longitude', required: true }),
        el('input', { type: 'text', id: 'lot-camera', placeholder: 'Camera URL or Local Path', required: true }),
        el('div', { className: 'modal-actions' },
          el('button', { type: 'button', id: 'close-modal', className: 'counter secondary' }, "Cancel"),
          el('button', { type: 'submit', className: 'counter' }, "Create")
        )
      )
    )
  );
  addLotModal.style.display = 'none';

  const logoutBtn = el('button', { id: 'logout', className: 'counter' }, "Logout");
  const addLotBtn = el('button', { id: 'add-lot-btn', className: 'counter' }, "Add Parking Lot");
  const lotsList = el('div', { id: 'lots-list', className: 'lots-grid' }, "Loading your lots...");

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
    addLotModal
  );

  logoutBtn.addEventListener('click', () => {
    state.setUser(null);
    navigate('auth');
  });

  addLotBtn.addEventListener('click', () => {
    addLotModal.style.display = 'flex';
  });

  addLotModal.querySelector('#close-modal')?.addEventListener('click', () => {
    addLotModal.style.display = 'none';
  });

  addLotModal.querySelector('#add-lot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      owner_id: state.currentUser?.user_id,
      name: (app.querySelector('#lot-name') as HTMLInputElement).value,
      latitude: parseFloat((app.querySelector('#lot-lat') as HTMLInputElement).value),
      longitude: parseFloat((app.querySelector('#lot-lng') as HTMLInputElement).value),
      camera_url: (app.querySelector('#lot-camera') as HTMLInputElement).value,
      slots_data: []
    };

    try {
      await api.post('/lots', payload);
      addLotModal.style.display = 'none';
      await refreshLots(lotsList);
    } catch (err: any) {
      alert(err.message);
    }
  });

  await refreshLots(lotsList);
}

async function refreshLots(list: HTMLElement) {
  try {
    const lots = await api.get('/lots/my');
    state.currentLots = lots;
    
    list.innerHTML = '';
    if (lots.length === 0) {
      list.textContent = 'No parking lots found. Add your first one!';
      return;
    }

    lots.forEach((lot: any) => {
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
    list.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}
