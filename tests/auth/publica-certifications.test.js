import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { createCertificationsHandler } from '../../api/auth/_lib/publica-handlers/certifications.js';

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

test('certifications GET: sin sesión válida responde 401 y no llama a Supabase', async () => {
  let called = false;
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => { throw new AuthorizationError('Authentication required', { status: 401 }); },
    getSettings: async () => { called = true; return null; },
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test('certifications GET: con sesión, devuelve las certificaciones guardadas bajo la clave certificaciones', async () => {
  let settingsCall;
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async (accessToken, organizationId) => {
      settingsCall = { accessToken, organizationId };
      return { settings: { certificaciones: { os10: true, iso9001: false, iso45001: false } } };
    },
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.certificaciones, { os10: true, iso9001: false, iso45001: false });
  assert.equal(settingsCall.accessToken, 'access');
  assert.equal(settingsCall.organizationId, 'org-a');
});

test('certifications GET: si la organización todavía no tiene fila guardada, responde certificaciones vacías (no error)', async () => {
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async () => null,
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.certificaciones, {});
});

test('certifications GET: no pisa ni depende de la clave buscador_perfil de la misma fila', async () => {
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    getSettings: async () => ({
      settings: {
        buscador_perfil: { region: 'Metropolitana', monto: '', soloAbiertas: true },
        certificaciones: { os10: true, iso9001: true, iso45001: false },
      },
    }),
  });
  const res = response();
  await handler(request(undefined), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.certificaciones, { os10: true, iso9001: true, iso45001: false });
});

test('certifications POST: exige same-origin, igual que el resto de los endpoints de escritura de Pública', async () => {
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveCertifications: async () => {},
  });
  const res = response();
  await handler(request({ certificaciones: { os10: true } }, {
    method: 'POST',
    headers: { origin: 'https://evil.example', host: 'dataseed.cl', 'x-forwarded-host': 'dataseed.cl' },
  }), res);
  assert.equal(res.statusCode, 403);
});

test('certifications POST: guarda las certificaciones vía la función security-definer, nunca con una clave elevada', async () => {
  let saveCall;
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveCertifications: async (accessToken, certificaciones) => { saveCall = { accessToken, certificaciones }; },
  });
  const res = response();
  await handler(request({ certificaciones: { os10: true, iso9001: false, iso45001: true } }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(saveCall.accessToken, 'access');
  assert.deepEqual(saveCall.certificaciones, { os10: true, iso9001: false, iso45001: true });
});

test('certifications POST: certificaciones inválidas (no objeto) responde 400 sin llamar a guardar', async () => {
  let called = false;
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
    saveCertifications: async () => { called = true; },
  });
  const res = response();
  await handler(request({ certificaciones: 'no-es-un-objeto' }, { method: 'POST' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

test('certifications: método no soportado responde 405', async () => {
  const handler = createCertificationsHandler({
    env: {},
    authenticate: async () => ({ identity, accessToken: 'access', setCookies: null }),
  });
  const res = response();
  await handler(request(undefined, { method: 'DELETE' }), res);
  assert.equal(res.statusCode, 405);
});
