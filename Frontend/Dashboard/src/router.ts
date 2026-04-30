import { state } from './state';
import { renderAuth } from './views/auth';
import { renderDashboard } from './views/dashboard';
import { renderAdminPanel } from './views/admin';
import { renderLotView } from './views/lotEditor';

export type View = 'auth' | 'dashboard' | 'admin' | 'lot-view';

export function navigate(view: View) {
  // Reset lot editor points when navigating
  // We'll need a way to reset points if they are stored in the view module
  // Or maybe we can move points to state if needed, but for now let's keep it simple.
  
  if (view === 'auth') {
    renderAuth();
  } else if (view === 'dashboard') {
    renderDashboard();
  } else if (view === 'admin') {
    renderAdminPanel();
  } else if (view === 'lot-view') {
    renderLotView();
  }
}
