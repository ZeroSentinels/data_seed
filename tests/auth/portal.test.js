import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { createPortalHandler } from '../../api/portal.js';

function request(overrides = {}) {
  return { method: 'GET', headers: {}, ...overrides };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    end(payload = '') { this.body = payload; return this; },
    send(payload = '') { this.body = payload; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const identity = {
  user: { id: 'user-1', email: 'client@example.com' },
  profile: { full_name: '<img src=x onerror=alert(1)>', role: 'client' },
  membership: { role: 'member' },
  organization: {
    id: 'org-a',
    name: '<script>alert("tenant")</script> Tenant A',
    type: 'client',
    plan: 'pro',
  },
};

test('portal redirects direct unauthenticated access to the canonical login', async () => {
  const handler = createPortalHandler({
    authenticate: async () => {
      throw new AuthorizationError('missing', { status: 401, code: 'authentication_required' });
    },
  });
  const res = response();
  await handler(request(), res);

  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.Location, '/site/login.html?reason=session');
  assert.match(res.headers['Cache-Control'], /no-store/);
  assert.equal(res.body, '');
});

test('portal renders only escaped context derived from the authenticated session', async () => {
  const handler = createPortalHandler({
    authenticate: async () => ({ identity, accessToken: 'server-only-token' }),
  });
  const res = response();
  await handler(request({ query: { tenant_id: 'org-b' } }), res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.match(res.headers['Cache-Control'], /no-store/);
  assert.match(res.body, /Portal de clientes/);
  assert.match(res.body, /&lt;script&gt;alert\(&quot;tenant&quot;\)&lt;\/script&gt; Tenant A/);
  assert.match(res.body, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(res.body, /\/site\/portal\.js/);
  assert.doesNotMatch(res.body, /<script>alert|<img src=x|server-only-token|org-a|org-b|user-1/);
});

test('portal rejects unsupported methods', async () => {
  const handler = createPortalHandler({ authenticate: async () => ({ identity }) });
  const res = response();
  await handler(request({ method: 'POST' }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});
