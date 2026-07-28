import test from 'node:test';
import assert from 'node:assert/strict';

import { createForgotPasswordHandler } from '../../api/auth/forgot-password.js';
import { createLogoutHandler } from '../../api/auth/logout.js';
import { SupabaseRequestError } from '../../api/auth/_lib/supabase.js';

function request(body = {}, overrides = {}) {
  const { headers = {}, ...rest } = overrides;
  return {
    method: 'POST',
    body,
    headers: {
      origin: 'https://dataseed.cl',
      host: 'dataseed.cl',
      'x-forwarded-host': 'dataseed.cl',
      ...headers,
    },
    ...rest,
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

test('forgot password validates same-origin input and uses a non-enumerative response', async () => {
  let call;
  const handler = createForgotPasswordHandler({
    env,
    recover: async (email, redirectTo) => { call = { email, redirectTo }; },
  });

  const res = response();
  await handler(request({ email: ' CLIENT@example.com ' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(call, {
    email: 'client@example.com',
    redirectTo: 'https://dataseed.cl/site/login.html?recovery=1',
  });
  assert.match(res.body.message, /Si la cuenta existe/);
  assert.doesNotMatch(JSON.stringify(res.body), /client@example.com/);
});

test('forgot password keeps the same public response for an unknown account', async () => {
  const handler = createForgotPasswordHandler({
    env,
    recover: async () => {
      throw new SupabaseRequestError('User not found', { status: 400 });
    },
  });
  const res = response();
  await handler(request({ email: 'unknown@example.com' }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /Si la cuenta existe/);
  assert.doesNotMatch(JSON.stringify(res.body), /not found|unknown/i);
});

test('forgot password reports provider outages without exposing provider details', async () => {
  const handler = createForgotPasswordHandler({
    env,
    recover: async () => {
      throw new SupabaseRequestError('database unavailable', { status: 503 });
    },
  });
  const res = response();
  await handler(request({ email: 'client@example.com' }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'No pudimos procesar la solicitud. Intenta nuevamente.');
  assert.doesNotMatch(JSON.stringify(res.body), /database/);
});

test('logout revokes the provider access token and always clears all cookies', async () => {
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

test('logout clears browser cookies and reports when provider revocation is unavailable', async () => {
  const handler = createLogoutHandler({
    env,
    authenticate: async () => ({ accessToken: 'access-token' }),
    revoke: async () => { throw new Error('network down'); },
    clearCookies: () => ['clear-all'],
  });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
  assert.deepEqual(res.headers['Set-Cookie'], ['clear-all']);
});
