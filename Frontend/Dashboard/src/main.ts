import './style.css'
import { state } from './state'
import { navigate, View } from './router'

function getDefaultView(): View {
  if (!state.currentUser) return 'auth';
  return state.currentUser.role === 'admin' ? 'admin' : 'dashboard';
}

// Init
navigate(getDefaultView());
