import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { createSearchProfileHandler } from '../../api/auth/_lib/publica-handlers/search-profile.js';

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

test('search-profile GET: sin sesión válida responde 401 y no llama a Supabase', async () => {
  let called = false;
  const handler = createSearchProfileHandler({
    env: {},
    authenticate: async () => { throw new AuthorizationError('Authentication required', { status: 401 }); },
    getSettings: async () => { called = true; return null; },
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test('search-profile GET: con sesión, devuelve el perfil guardado bajo la clave buscador_perfil', async () => {
  let settingsCall;
  const handler = createSearchProfileHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async (accessToken, organizationId) => {
      settingsCall = { accessToken, organizationId };
      return { settings: { buscador_perfil: { region: 'Metropolitana', monto: '', soloAbiertas: true } } };
    },
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.perfil, { region: 'Metropolitana', monto: '', soloAbiertas: true });
  assert.equal(settingsCall.accessToken, 'access');
  assert.equal(settingsCall.organizationId, 'org-a');
});

test('search-profile GET: si la organización todavía no tiene fila guardada, responde perfil vacío (no error)', async () => {
  const handler = createSearchProfileHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async () => null,
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.perfil, {});
});

test('search-profile POST: exige same-origin, igual que el resto de los endpoints de escritura de Pública', async () => {
  const handler = createSearchProfileHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveProfile: async () => {},
  });
  const res = response();
  await handler(request({ perfil: { region: 'Metropolitana' } }, {
    method: 'POST',
    headers: { origin: 'https://evil.example', host: 'dataseed.cl', 'x-forwarded-host': 'dataseed.cl' },
  }), res);
  assert.equal(res.statusCode, 403);
});

test('search-profile POST: guarda el perfil vía la función security-definer, nunca con una clave elevada', async () => {
  let saveCall;
  const handler = createSearchProfileHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveProfile: async (accessToken, perfil) => { saveCall = { accessToken, perfil }; },
  });
  const res = response();
  await handler(request({ perfil: { region: 'Metropolitana', monto: 'mayor_10m', soloAbiertas: false } }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(saveCall.accessToken, 'access');
  assert.deepEqual(saveCall.perfil, { region: 'Metropolitana', monto: 'mayor_10m', soloAbiertas: false });
});

test('search-profile POST: perfil inválido (no objeto) responde 400 sin llamar a guardar', async () => {
  let called = false;
  const handler = createSearchProfileHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveProfile: async () => { called = true; },
  });
  const res = response();
  await handler(request({ perfil: 'no-es-un-objeto' }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test('search-profile: método no soportado responde 405', async () => {
  const handler = createSearchProfileHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
  });
  const res = response();
  await handler(request(undefined, { method: 'DELETE' }), res);
  assert.equal(res.statusCode, 405);
});
