import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../api/auth/_lib/authorization.js';
import { createPortalHandler } from '../api/portal.js';

function request(overrides = {}) {
  return { method: 'GET', url: '/portal', headers: {}, ...overrides };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { this.body = payload; return this; },
    end(payload = '') { this.body = payload; return this; },
  };
}

const identity = {
  user: { id: 'user-1', email: 'client@example.com' },
  profile: { full_name: '<script>alert(1)</script>', role: 'client' },
  membership: { role: 'member' },
  organization: { id: 'org-a', name: 'Cliente <A>', type: 'client', plan: 'pro' },
};

test('portal redirects unauthenticated requests to the canonical login before rendering content', async () => {
  const handler = createPortalHandler({
    authenticate: async () => {
      throw new AuthorizationError('required', { status: 401, code: 'authentication_required' });
    },
    clearCookies: () => ['clear-session'],
  });
  const res = response();
  await handler(request(), res);

  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.Location, '/site/login.html?reason=session');
  assert.deepEqual(res.headers['Set-Cookie'], ['clear-session']);
  assert.equal(res.body, '');
});

test('portal renders only the authenticated organization and escapes provider data', async () => {
  const handler = createPortalHandler({
    authenticate: async () => ({ identity, setCookies: ['rotated-session'] }),
    clearCookies: () => ['clear-session'],
  });
  const res = response();
  await handler(request(), res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.match(res.headers['Cache-Control'], /no-store/);
  assert.deepEqual(res.headers['Set-Cookie'], ['rotated-session']);
  assert.match(res.body, /Cliente &lt;A&gt;/);
  assert.match(res.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(res.body, /<script>alert|org-a|user-1|access-token|refresh-token/);
  assert.match(res.body, /data-auth-action="logout"/);
});

test('portal fails closed on provider outages', async () => {
  const handler = createPortalHandler({
    authenticate: async () => { throw new Error('provider down'); },
    clearCookies: () => ['clear-session'],
  });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(String(res.body), /provider down/);
  assert.match(String(res.body), /temporalmente no disponible/i);
});
