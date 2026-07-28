import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { authenticateRequest } from '../../api/auth/_lib/session.js';
import { createSessionHandler } from '../../api/auth/session.js';

function request(cookie = '', overrides = {}) {
  return {
    method: 'GET',
    headers: { cookie, ...overrides.headers },
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

const identity = {
  user: { id: 'user-1', email: 'client@example.com' },
  profile: { full_name: 'Client User', role: 'client' },
  membership: { role: 'member' },
  organization: { id: 'org-a', name: 'Tenant A', type: 'client', plan: 'pro' },
};

test('authenticateRequest validates the HttpOnly access cookie without refreshing', async () => {
  let refreshed = false;
  const result = await authenticateRequest(request('__Host-ds_access=access-token'), {
    resolve: async (token) => {
      assert.equal(token, 'access-token');
      return identity;
    },
    refresh: async () => { refreshed = true; },
  });

  assert.equal(result.identity.organization.id, 'org-a');
  assert.equal(result.setCookies, null);
  assert.equal(refreshed, false);
});

test('authenticateRequest rotates an expired session using only the refresh cookie', async () => {
  const seen = [];
  const result = await authenticateRequest(request(
    '__Host-ds_access=expired; __Host-ds_refresh=refresh-token; __Host-ds_persist=1',
  ), {
    resolve: async (token) => {
      seen.push(token);
      if (token === 'expired') {
        throw new AuthorizationError('expired', { status: 401, code: 'invalid_session' });
      }
      return identity;
    },
    refresh: async (token) => {
      assert.equal(token, 'refresh-token');
      return { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
    },
    buildCookies: (_session, options) => {
      assert.deepEqual(options, { remember: true });
      return ['rotated-access', 'rotated-refresh', 'persist'];
    },
  });

  assert.deepEqual(seen, ['expired', 'new-access']);
  assert.deepEqual(result.setCookies, ['rotated-access', 'rotated-refresh', 'persist']);
});

test('authenticateRequest fails closed when no provider session exists', async () => {
  await assert.rejects(
    authenticateRequest(request(), { resolve: async () => identity }),
    (error) => error instanceof AuthorizationError && error.status === 401,
  );
});

test('session endpoint returns safe tenant context and never returns tokens or tenant ids', async () => {
  const handler = createSessionHandler({
    authenticate: async () => ({ identity, setCookies: ['rotated-cookie'] }),
    clearCookies: () => ['cleared-cookie'],
  });
  const res = response();
  await handler(request(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.headers['Set-Cookie'], ['rotated-cookie']);
  assert.equal(res.body.authenticated, true);
  assert.deepEqual(res.body.organization, { name: 'Tenant A', plan: 'pro' });
  assert.doesNotMatch(JSON.stringify(res.body), /access|refresh|org-a|user-1/);
});

test('session endpoint clears cookies and returns 401 for an invalid session', async () => {
  const handler = createSessionHandler({
    authenticate: async () => {
      throw new AuthorizationError('invalid', { status: 401, code: 'invalid_session' });
    },
    clearCookies: () => ['cleared-access', 'cleared-refresh'],
  });
  const res = response();
  await handler(request(), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.headers['Set-Cookie'], ['cleared-access', 'cleared-refresh']);
  assert.deepEqual(res.body, { authenticated: false, error: 'Sesión no válida.' });
});
