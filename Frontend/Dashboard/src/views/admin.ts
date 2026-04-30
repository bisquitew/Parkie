import { api } from '../api';
import { state, ParkingLot } from '../state';
import { navigate } from '../router';
import { el, clearApp } from '../utils/dom';

export async function renderAdminPanel() {
  const app = clearApp();

  const logoutBtn = el('button', { id: 'logout', className: 'counter' }, "Logout");
  const pendingTabBtn = el('button', { 
    className: `tab-btn ${state.adminTab === 'pending' ? 'active' : ''}`
  }, "Pending Lots");
  const allTabBtn = el('button', { 
    className: `tab-btn ${state.adminTab === 'all' ? 'active' : ''}`
  }, "All Verified Lots");

  const adminLotsList = el('div', { id: 'admin-lots-list', className: 'lots-grid' }, 
    el('p', {}, "Loading lots...")
  );

  app.append(
    el('header', { className: 'dashboard-header' },
      el('h1', {}, "Admin Panel"),
      logoutBtn
    ),
    el('section', { id: 'center' },
      el('div', { className: 'admin-tabs' },
        pendingTabBtn,
        allTabBtn
      ),
      adminLotsList
    )
  );

  // Logout
  logoutBtn.addEventListener('click', () => {
    state.setUser(null);
    navigate('auth');
  });

  // Tab switching
  pendingTabBtn.addEventListener('click', () => {
    state.adminTab = 'pending';
    renderAdminPanel();
  });
  allTabBtn.addEventListener('click', () => {
    state.adminTab = 'all';
    renderAdminPanel();
  });

  await refreshAdminLots(adminLotsList);
}

async function refreshAdminLots(list: HTMLElement) {
  try {
    let lots: ParkingLot[];
    if (state.adminTab === 'pending') {
      lots = await api.getPendingLots();
    } else {
      lots = await api.get('/lots');
    }

    list.innerHTML = '';

    if (lots.length === 0) {
      list.appendChild(el('p', {}, state.adminTab === 'pending'
        ? 'No pending lots to review. All caught up! ✅'
        : 'No verified lots yet.'
      ));
      return;
    }

    lots.forEach(lot => {
      const card = el('div', { className: 'lot-card admin-lot-card' });
      
      const indicator = el('div', { 
        className: 'status-indicator', 
        style: `background-color: ${state.adminTab === 'pending' ? 'orange' : lot.status_color}` 
      });

      const info = el('div', { className: 'lot-info' },
        el('h3', {}, lot.name)
      );

      if (state.adminTab === 'pending') {
        info.appendChild(el('p', {}, `📍 ${lot.latitude.toFixed(4)}, ${lot.longitude.toFixed(4)}`));
        info.appendChild(el('p', {}, `🅿️ ${lot.capacity} spots · 📷 ${lot.camera_url ? 'Camera set' : 'No camera'}`));
        info.appendChild(el('p', {}, `🧩 ${lot.slots_data?.length || 0} slot(s) plotted`));
      } else {
        info.appendChild(el('p', {}, `${lot.available_spots} / ${lot.capacity} spots available`));
      }

      const actions = el('div', { className: 'admin-actions' });

      if (state.adminTab === 'pending') {
        const verifyBtn = el('button', { className: 'action-btn verify-btn', title: 'Verify' }, "✅");
        const rejectBtn = el('button', { className: 'action-btn reject-btn', title: 'Reject' }, "❌");

        verifyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Verify "${lot.name}"? It will appear in the mobile app.`)) return;
          try {
            verifyBtn.disabled = true;
            await api.verifyLot(lot.id);
            await refreshAdminLots(list);
          } catch (err: any) {
            alert('Failed to verify: ' + err.message);
            verifyBtn.disabled = false;
          }
        });

        rejectBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Reject and delete "${lot.name}"? This cannot be undone.`)) return;
          try {
            rejectBtn.disabled = true;
            await api.rejectLot(lot.id);
            await refreshAdminLots(list);
          } catch (err: any) {
            alert('Failed to reject: ' + err.message);
            rejectBtn.disabled = false;
          }
        });

        actions.append(verifyBtn, rejectBtn);
      } else {
        const unverifyBtn = el('button', { className: 'action-btn unverify-btn', title: 'Unverify' }, "🔒");
        unverifyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Unverify "${lot.name}"? It will be removed from the mobile app.`)) return;
          try {
            unverifyBtn.disabled = true;
            await api.unverifyLot(lot.id);
            await refreshAdminLots(list);
          } catch (err: any) {
            alert('Failed to unverify: ' + err.message);
            unverifyBtn.disabled = false;
          }
        });
        actions.appendChild(unverifyBtn);
      }

      card.append(indicator, info, actions);
      
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
