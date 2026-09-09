import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { createFavoritesHandler } from '../../api/auth/_lib/publica-handlers/favorites.js';

function request(body, overrides = {}) {
  return {
    method: 'GET',
    body,
    headers: {
      origin: 'https://dataseed.cl',
      host: 'dataseed.cl',
      'x-forwarded-host': 'dataseed.cl',
      ...overrides.headers,
    },
    ...overrides,
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end(payload) { this.body = payload; return this; },
  };
}

const identity = {
  user: { id: 'user-1', email: 'client@example.com' },
  profile: { full_name: 'Client User', role: 'client' },
  membership: { role: 'admin' },
  organization: { id: 'org-a', name: 'Empresa A', type: 'client', plan: 'free' },
};

const favoritoValido = { codigo: 'ABC-123', nombre: 'Construcción de escuela', organismo_nombre: 'Municipalidad X' };

test('favorites GET: sin sesión válida responde 401 y no llama a Supabase', async () => {
  let called = false;
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => { throw new AuthorizationError('Authentication required', { status: 401 }); },
    getSettings: async () => { called = true; return null; },
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test('favorites GET: con sesión, devuelve la lista guardada bajo la clave favoritos', async () => {
  let settingsCall;
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async (accessToken, organizationId) => {
      settingsCall = { accessToken, organizationId };
      return { settings: { favoritos: [favoritoValido] } };
    },
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.favoritos, [favoritoValido]);
  assert.equal(settingsCall.accessToken, 'access');
  assert.equal(settingsCall.organizationId, 'org-a');
});

test('favorites GET: si la organización todavía no tiene fila guardada, responde lista vacía (no error)', async () => {
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async () => null,
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.favoritos, []);
});

test('favorites GET: no pisa ni depende de buscador_perfil/certificaciones de la misma fila', async () => {
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async () => ({
      settings: {
        buscador_perfil: { region: 'Metropolitana', monto: '', soloAbiertas: true },
        certificaciones: { os10: true },
        favoritos: [favoritoValido],
      },
    }),
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.favoritos, [favoritoValido]);
});

test('favorites POST: exige same-origin, igual que el resto de los endpoints de escritura de Pública', async () => {
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveFavorites: async () => {},
  });
  const res = response();
  await handler(request({ favoritos: [favoritoValido] }, {
    method: 'POST',
    headers: { origin: 'https://evil.example', host: 'dataseed.cl', 'x-forwarded-host': 'dataseed.cl' },
  }), res);
  assert.equal(res.statusCode, 403);
});

test('favorites POST: guarda la lista vía la función security-definer, nunca con una clave elevada', async () => {
  let saveCall;
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveFavorites: async (accessToken, favoritos) => { saveCall = { accessToken, favoritos }; },
  });
  const res = response();
  await handler(request({ favoritos: [favoritoValido] }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(saveCall.accessToken, 'access');
  assert.deepEqual(saveCall.favoritos, [favoritoValido]);
});

test('favorites POST: rechaza una lista que no es array', async () => {
  let called = false;
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveFavorites: async () => { called = true; },
  });
  const res = response();
  await handler(request({ favoritos: { codigo: 'ABC-123' } }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test('favorites POST: rechaza items sin código', async () => {
  let called = false;
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveFavorites: async () => { called = true; },
  });
  const res = response();
  await handler(request({ favoritos: [{ nombre: 'Sin código' }] }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test('favorites POST: rechaza una lista más grande que el máximo permitido', async () => {
  let called = false;
  const listaGrande = Array.from({ length: 201 }, (_, i) => ({ codigo: `COD-${i}` }));
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveFavorites: async () => { called = true; },
  });
  const res = response();
  await handler(request({ favoritos: listaGrande }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test('favorites: método no soportado responde 405', async () => {
  const handler = createFavoritesHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
  });
  const res = response();
  await handler(request(undefined, { method: 'DELETE' }), res);
  assert.equal(res.statusCode, 405);
});
