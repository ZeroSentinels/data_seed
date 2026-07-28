import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { SupabaseRequestError } from '../../api/auth/_lib/supabase.js';
import { createForgotPasswordHandler } from '../../api/auth/forgot-password.js';
import { createLogoutHandler } from '../../api/auth/logout.js';

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
  };
}

const env = { APP_ORIGIN: 'https://dataseed.cl' };

test('forgot-password validates same-origin input and uses an allowlisted redirect', async () => {
  let call;
  const handler = createForgotPasswordHandler({
    env,
    recover: async (...args) => { call = args; },
  });

  const invalidRes = response();
  await handler(request({ email: 'invalid' }), invalidRes);
  assert.equal(invalidRes.statusCode, 400);
  assert.equal(call, undefined);

  const okRes = response();
  await handler(request({ email: ' CLIENT@example.com ' }), okRes);
  assert.equal(okRes.statusCode, 200);
  assert.deepEqual(okRes.body, {
    ok: true,
    message: 'Si la cuenta existe, enviaremos instrucciones para recuperar el acceso.',
  });
  assert.equal(call[0], 'client@example.com');
  assert.equal(call[1], 'https://dataseed.cl/site/login.html?recovery=1');
});

test('forgot-password does not reveal whether Supabase knows the account', async () => {
  const unknownHandler = createForgotPasswordHandler({
    env,
    recover: async () => { throw new SupabaseRequestError('User not found', { status: 400 }); },
  });
  const unknownRes = response();
  await unknownHandler(request({ email: 'unknown@example.com' }), unknownRes);

  const knownHandler = createForgotPasswordHandler({ env, recover: async () => {} });
  const knownRes = response();
  await knownHandler(request({ email: 'known@example.com' }), knownRes);

  assert.equal(unknownRes.statusCode, 200);
  assert.deepEqual(unknownRes.body, knownRes.body);
  assert.doesNotMatch(JSON.stringify(unknownRes.body), /not found|unknown/i);
});

test('logout revokes the authenticated provider session and clears every cookie', async () => {
  let revoked;
  const handler = createLogoutHandler({
    env,
    authenticate: async () => ({ accessToken: 'access-token' }),
    revoke: async (token) => { revoked = token; },
    clearCookies: () => ['clear-access', 'clear-refresh', 'clear-persist'],
  });
  const res = response();
  await handler(request(), res);

  assert.equal(revoked, 'access-token');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.headers['Set-Cookie'], ['clear-access', 'clear-refresh', 'clear-persist']);
  assert.deepEqual(res.body, { ok: true, redirectTo: '/site/login.html' });
});

test('logout is idempotent without a session and fails closed on provider outages', async () => {
  const missingHandler = createLogoutHandler({
    env,
    authenticate: async () => { throw new AuthorizationError('missing', { status: 401 }); },
    clearCookies: () => ['clear'],
  });
  const missingRes = response();
  await missingHandler(request(), missingRes);
  assert.equal(missingRes.statusCode, 200);
  assert.deepEqual(missingRes.headers['Set-Cookie'], ['clear']);

  const outageHandler = createLogoutHandler({
    env,
    authenticate: async () => ({ accessToken: 'access-token' }),
    revoke: async () => { throw new SupabaseRequestError('offline', { status: 502 }); },
    clearCookies: () => ['clear'],
  });
  const outageRes = response();
  await outageHandler(request(), outageRes);
  assert.equal(outageRes.statusCode, 503);
  assert.deepEqual(outageRes.headers['Set-Cookie'], ['clear']);
  assert.equal(outageRes.body.ok, false);
});
