// Sesión de Pública para /publica-buscador: redirige a /publica-login si no
// hay sesión válida, y maneja el botón "Cerrar sesión" del encabezado.
//
// La protección real está en el servidor (api/buscar.js y api/licitacion.js
// exigen la misma sesión antes de llamar a mp-api) — sin esto, cualquiera que
// llame esos endpoints directo, sin pasar por esta página, no obtiene nada.
// El chequeo de acá es solo la experiencia: evita que alguien sin sesión vea
// el buscador cargar en blanco antes de que sus llamadas fallen con 401.
//
// No se integró en site/publica-buscador.js (1400+ líneas, sin auditar acá)
// para no arriesgar romper nada de esa lógica — vive aparte y se carga antes.
(function () {
  'use strict';

  fetch('/api/auth/publica/session', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(function (response) {
      if (!response.ok) throw new Error('unauthenticated');
      return response.json();
    })
    .then(function (payload) {
      if (!payload || payload.authenticated !== true) throw new Error('unauthenticated');
    })
    .catch(function () {
      window.location.replace('/publica-login');
    });

  document.addEventListener('DOMContentLoaded', function () {
    var logoutButton = document.getElementById('publicaLogoutButton');
    if (!logoutButton) return;
    logoutButton.addEventListener('click', function () {
      logoutButton.disabled = true;
      fetch('/api/auth/publica/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
        .catch(function () {
          // Si la revocación remota falla, el servidor igual limpia las
          // cookies locales (ver api/auth/_lib/publica-handlers/logout.js) —
          // seguimos al login de todos modos.
        })
        .then(function () {
          window.location.replace('/publica-login');
        });
    });
  });
})();
