// Redirige a /publica-login si no hay sesión válida de Pública.
//
// La protección real está en el servidor (api/buscar.js y api/licitacion.js
// exigen la misma sesión antes de llamar a mp-api) — sin esto, cualquiera que
// llame esos endpoints directo, sin pasar por esta página, no obtiene nada.
// Este script es solo la experiencia: evita que alguien sin sesión vea el
// buscador cargar en blanco antes de que sus llamadas fallen con 401.
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
})();
