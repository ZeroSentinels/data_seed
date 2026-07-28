(() => {
  'use strict';

  const logoutButton = document.querySelector('[data-auth-action="logout"]');
  const message = document.getElementById('portal-message');

  function setMessage(text, state = '') {
    if (!message) return;
    message.textContent = text;
    if (state) message.dataset.state = state;
    else message.removeAttribute('data-state');
  }

  async function logout() {
    if (!logoutButton) return;
    logoutButton.disabled = true;
    logoutButton.textContent = 'Cerrando…';
    setMessage('Invalidando la sesión…');

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      window.location.replace('/site/login.html');
    } catch {
      setMessage('No pudimos conectar con el servidor. Intenta cerrar sesión nuevamente.', 'error');
      logoutButton.disabled = false;
      logoutButton.textContent = 'Cerrar sesión';
    }
  }

  logoutButton?.addEventListener('click', logout);
})();
