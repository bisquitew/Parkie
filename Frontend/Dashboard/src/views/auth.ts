import { api } from '../api';
import { state } from '../state';
import { navigate } from '../router';
import { el, clearApp } from '../utils/dom';

export function renderAuth() {
  const app = clearApp();

  const emailInput = el('input', { type: 'email', id: 'login-email', placeholder: 'Email', required: true });
  const passwordInput = el('input', { type: 'password', id: 'login-password', placeholder: 'Password', required: true });
  const showRegister = el('a', { href: '#', id: 'show-register' }, "Register");

  const loginForm = el('form', { id: 'login-form' },
    el('h2', {}, "Login"),
    emailInput,
    passwordInput,
    el('button', { type: 'submit', className: 'counter' }, "Login"),
    el('p', {}, "Don't have an account? ", showRegister)
  );

  const authFormContainer = el('div', { id: 'auth-form-container' }, loginForm);

  app.appendChild(
    el('section', { id: 'center' },
      el('div', { className: 'auth-container' },
        el('h1', {}, "Parkie Dashboard"),
        authFormContainer
      )
    )
  );

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { email: emailInput.value, password: passwordInput.value });
      state.setUser({
        ...response.user,
        access_token: response.access_token
      });
      navigate(response.user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  });

  showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    renderRegister(authFormContainer);
  });
}

function renderRegister(container: HTMLElement) {
  container.innerHTML = '';

  const nameInput = el('input', { type: 'text', id: 'register-name', placeholder: 'Full Name', required: true });
  const emailInput = el('input', { type: 'email', id: 'register-email', placeholder: 'Email', required: true });
  const passwordInput = el('input', { type: 'password', id: 'register-password', placeholder: 'Password', required: true });
  const showLogin = el('a', { href: '#', id: 'show-login' }, "Login");

  const registerForm = el('form', { id: 'register-form' },
    el('h2', {}, "Register"),
    nameInput,
    emailInput,
    passwordInput,
    el('button', { type: 'submit', className: 'counter' }, "Register"),
    el('p', {}, "Already have an account? ", showLogin)
  );

  container.appendChild(registerForm);

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { 
        name: nameInput.value, 
        email: emailInput.value, 
        password: passwordInput.value 
      });
      // Login after register
      const response = await api.post('/auth/login', { 
        email: emailInput.value, 
        password: passwordInput.value 
      });
      state.setUser({
        ...response.user,
        access_token: response.access_token
      });
      navigate(response.user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  });

  showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    renderAuth();
  });
}
