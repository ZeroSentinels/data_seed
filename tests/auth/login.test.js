import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { SupabaseRequestError } from '../../api/auth/_lib/supabase.js';
import { createLoginHandler } from '../../api/auth/login.js';

function request(body = {}, overrides = {}) {
  return {
    method: 'POST',
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
  membership: { role: 'member' },
  organization: { id: 'org-a', name: 'Tenant A', type: 'client', plan: 'pro' },
};

function dependencies(overrides = {}) {
  return {
    env: { APP_ORIGIN: 'https://dataseed.cl' },
    signIn: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }),
    resolve: async () => identity,
    revoke: async () => {},
    buildCookies: () => ['access-cookie', 'refresh-cookie'],
    ...overrides,
  };
}

test('login accepts POST only and requires a same-origin browser request', async () => {
  const handler = createLoginHandler(dependencies());
  const methodRes = response();
  await handler(request({}, { method: 'GET' }), methodRes);
  assert.equal(methodRes.statusCode, 405);
  assert.equal(methodRes.headers.Allow, 'POST');

  const originRes = response();
  await handler(request({ email: 'client@example.com', password: 'secret' }, {
    headers: { origin: 'https://evil.example', host: 'dataseed.cl', 'x-forwarded-host': 'dataseed.cl' },
  }), originRes);
  assert.equal(originRes.statusCode, 403);
});

test('login validates required fields before calling the provider', async () => {
  let called = false;
  const handler = createLoginHandler(dependencies({ signIn: async () => { called = true; } }));
  const res = response();
  await handler(request({ email: 'invalid', password: '' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
  assert.equal(res.body.error, 'Completa correctamente el correo y la contraseña.');
});

test('login returns a generic message for invalid credentials', async () => {
  const handler = createLoginHandler(dependencies({
    signIn: async () => { throw new SupabaseRequestError('Invalid login credentials', { status: 400 }); },
  }));
  const res = response();
  await handler(request({ email: 'client@example.com', password: 'wrong-password' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'No pudimos iniciar sesión. Revisa tus credenciales.');
  assert.doesNotMatch(JSON.stringify(res.body), /Invalid login credentials/);
});

test('login resolves organization server-side, ignores tenant input and sets HttpOnly cookies', async () => {
  let cookieOptions;
  const handler = createLoginHandler(dependencies({
    buildCookies: (session, options) => {
      cookieOptions = { session, options };
      return ['access-cookie', 'refresh-cookie'];
    },
  }));
  const res = response();
  await handler(request({
    email: ' CLIENT@example.com ',
    password: 'correct-password',
    remember: true,
    tenant_id: 'org-b',
  }), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.headers['Set-Cookie'], ['access-cookie', 'refresh-cookie']);
  assert.equal(cookieOptions.options.remember, true);
  assert.equal(res.body.redirectTo, '/portal');
  assert.deepEqual(res.body.organization, { name: 'Tenant A', plan: 'pro' });
  assert.equal(res.body.organization.id, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /access|refresh|org-a|org-b/);
});

test('login fails closed and revokes the provider session when membership resolution fails', async () => {
  let revoked = false;
  const handler = createLoginHandler(dependencies({
    resolve: async () => { throw new AuthorizationError('No membership', { status: 403, code: 'membership_required' }); },
    revoke: async () => { revoked = true; },
  }));
  const res = response();
  await handler(request({ email: 'client@example.com', password: 'correct-password' }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(revoked, true);
  assert.equal(res.headers['Set-Cookie'], undefined);
  assert.equal(res.body.error, 'Tu cuenta no tiene un entorno habilitado. Contacta a soporte.');
});
