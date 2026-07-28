import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogoutHandler } from '../../api/auth/logout.js';
import { SupabaseRequestError } from '../../api/auth/_lib/supabase.js';

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

function request(cookie) {
  return {
    method: 'POST',
    body: {},
    headers: {
      origin: 'https://dataseed.cl',
      host: 'dataseed.cl',
      cookie,
    },
  };
}

const env = { APP_ORIGIN: 'https://dataseed.cl' };

test('logout revokes the cookie token even when tenant authorization is no longer valid', async () => {
  let revoked;
  const handler = createLogoutHandler({
    env,
    revoke: async (token) => { revoked = token; },
    clearCookies: () => ['clear-all'],
  });
  const res = response();
  await handler(request('__Host-ds_access=access-token; __Host-ds_refresh=refresh-token'), res);
  assert.equal(revoked, 'access-token');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.headers['Set-Cookie'], ['clear-all']);
});

test('logout refreshes and retries revocation when the access token expired', async () => {
  const revoked = [];
  const handler = createLogoutHandler({
    env,
    revoke: async (token) => {
      revoked.push(token);
      if (token === 'expired') throw new SupabaseRequestError('expired', { status: 401 });
    },
    refresh: async (token) => {
      assert.equal(token, 'refresh-token');
      return { access_token: 'new-access', refresh_token: 'new-refresh' };
    },
    clearCookies: () => ['clear-all'],
  });
  const res = response();
  await handler(request('__Host-ds_access=expired; __Host-ds_refresh=refresh-token'), res);
  assert.deepEqual(revoked, ['expired', 'new-access']);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.headers['Set-Cookie'], ['clear-all']);
});
