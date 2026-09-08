import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { SupabaseRequestError } from '../../api/auth/_lib/supabase.js';
import { ProvisioningError } from '../../api/auth/_lib/publica-provisioning.js';
import { createPublicaLoginHandler } from '../../api/auth/_lib/publica-handlers/login.js';
import { createPublicaSignupHandler } from '../../api/auth/_lib/publica-handlers/signup.js';
import { createPublicaLogoutHandler } from '../../api/auth/_lib/publica-handlers/logout.js';
import { createPublicaSessionHandler } from '../../api/auth/_lib/publica-handlers/session.js';
import { createGoogleStartHandler } from '../../api/auth/_lib/publica-handlers/google-start.js';
import { createGoogleCallbackHandler } from '../../api/auth/_lib/publica-handlers/google-callback.js';

function request(body = {}, overrides = {}) {
  return {
    method: 'POST',
    body,
    url: overrides.url,
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
    writeHead(code, headers) { this.statusCode = code; Object.assign(this.headers, headers); },
  };
}

const identity = {
  user: { id: 'user-1', email: 'client@example.com' },
  profile: { full_name: 'Client User', role: 'client' },
  membership: { role: 'admin' },
  organization: { id: 'org-a', name: 'Empresa A', type: 'client', plan: 'free' },
};

test('publica login: mismos requisitos que el login general, pero cookies y redirectTo propios de Pública', async () => {
  let cookieCall;
  const handler = createPublicaLoginHandler({
    env: { APP_ORIGIN: 'https://dataseed.cl' },
    signIn: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }),
    provision: async () => ({ created: false, organizationId: 'org-a' }),
    resolve: async () => identity,
    revoke: async () => {},
    buildCookies: (session, options) => { cookieCall = { session, options }; return ['pub-access-cookie', 'pub-refresh-cookie']; },
  });

  const methodRes = response();
  await handler(request({}, { method: 'GET' }), methodRes);
  assert.equal(methodRes.statusCode, 405);

  const badOriginRes = response();
  await handler(request({ email: 'a@b.cl', password: 'x' }, {
    headers: { origin: 'https://evil.example', host: 'dataseed.cl', 'x-forwarded-host': 'dataseed.cl' },
  }), badOriginRes);
  assert.equal(badOriginRes.statusCode, 403);

  const res = response();
  await handler(request({ email: 'client@example.com', password: 'pass1234', remember: true }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.headers['Set-Cookie'], ['pub-access-cookie', 'pub-refresh-cookie']);
  assert.equal(cookieCall.options.remember, true);
  assert.equal(res.body.redirectTo, '/publica-buscador');
  assert.doesNotMatch(JSON.stringify(res.body), /access|refresh|org-a/);
});

test('publica login: credenciales inválidas devuelven mensaje genérico, sin filtrar el error de Supabase', async () => {
  const handler = createPublicaLoginHandler({
    env: {},
    signIn: async () => { throw new SupabaseRequestError('Invalid login credentials', { status: 400 }); },
    provision: async () => ({ created: false }),
    resolve: async () => identity,
    revoke: async () => {},
    buildCookies: () => [],
  });
  const res = response();
  await handler(request({ email: 'client@example.com', password: 'wrong' }), res);
  assert.equal(res.statusCode, 401);
  assert.doesNotMatch(JSON.stringify(res.body), /Invalid login credentials/);
});

test('publica login: sin organización activa, falla cerrado y revoca la sesión del proveedor', async () => {
  let revoked = false;
  const handler = createPublicaLoginHandler({
    env: {},
    signIn: async () => ({ access_token: 'access', refresh_token: 'refresh' }),
    provision: async () => ({ created: false }),
    resolve: async () => { throw new AuthorizationError('No membership', { status: 403, code: 'membership_required' }); },
    revoke: async () => { revoked = true; },
    buildCookies: () => [],
  });
  const res = response();
  await handler(request({ email: 'client@example.com', password: 'pass1234' }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(revoked, true);
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('publica login: aprovisiona (idempotente) antes de resolver identidad, usando la empresa guardada en el signup pendiente', async () => {
  let provisionCall;
  const handler = createPublicaLoginHandler({
    env: {},
    signIn: async () => ({
      access_token: 'access',
      refresh_token: 'refresh',
      user: { id: 'user-1', email: 'client@example.com', user_metadata: { empresa: 'Empresa Nueva' } },
    }),
    provision: async (input) => { provisionCall = input; return { created: true, organizationId: 'org-a' }; },
    resolve: async () => identity,
    revoke: async () => {},
    buildCookies: () => ['pub-access-cookie', 'pub-refresh-cookie'],
  });
  const res = response();
  await handler(request({ email: 'client@example.com', password: 'pass1234' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(provisionCall.accessToken, 'access');
  assert.equal(provisionCall.empresa, 'Empresa Nueva');
});

test('publica login: si falla el aprovisionamiento, no deja sesión activa y revoca la sesión del proveedor', async () => {
  let revoked = false;
  const handler = createPublicaLoginHandler({
    env: {},
    signIn: async () => ({ access_token: 'access', refresh_token: 'refresh' }),
    provision: async () => { throw new ProvisioningError('fail', { status: 502 }); },
    resolve: async () => identity,
    revoke: async () => { revoked = true; },
    buildCookies: () => [],
  });
  const res = response();
  await handler(request({ email: 'client@example.com', password: 'pass1234' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(revoked, true);
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('publica signup: crea usuario, aprovisiona organización y deja sesión iniciada', async () => {
  let provisionCall;
  let signUpCall;
  const handler = createPublicaSignupHandler({
    env: { APP_ORIGIN: 'https://dataseed.cl' },
    signUp: async (credentials) => { signUpCall = credentials; return { user: { id: 'new-user' }, access_token: 'access', refresh_token: 'refresh' }; },
    provision: async (input) => { provisionCall = input; return { created: true }; },
    resolve: async () => identity,
    buildCookies: () => ['pub-access-cookie', 'pub-refresh-cookie'],
  });
  const res = response();
  await handler(request({ email: 'nueva@empresa.cl', password: 'pass12345', empresa: 'Empresa Nueva' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.redirectTo, '/publica-buscador');
  assert.deepEqual(res.headers['Set-Cookie'], ['pub-access-cookie', 'pub-refresh-cookie']);
  assert.equal(provisionCall.accessToken, 'access');
  assert.equal(provisionCall.empresa, 'Empresa Nueva');
  // El link de confirmación de correo tiene que volver a /publica-login, no a
  // la Site URL genérica de Supabase (la home de dataseed.cl) — sin esto el
  // usuario confirma y queda varado sin saber que ya puede iniciar sesión.
  assert.equal(signUpCall.redirect_to, 'https://dataseed.cl/publica-login?confirmado=1');
});

test('publica signup: exige empresa y contraseña de al menos 8 caracteres, sin llamar a Supabase', async () => {
  let called = false;
  const handler = createPublicaSignupHandler({
    env: {},
    signUp: async () => { called = true; },
  });

  const shortPasswordRes = response();
  await handler(request({ email: 'a@b.cl', password: '1234567', empresa: 'Acme' }), shortPasswordRes);
  assert.equal(shortPasswordRes.statusCode, 400);
  assert.equal(called, false);

  const noEmpresaRes = response();
  await handler(request({ email: 'a@b.cl', password: 'pass12345', empresa: '' }), noEmpresaRes);
  assert.equal(noEmpresaRes.statusCode, 400);
  assert.equal(called, false);
});

test('publica signup: si falla el aprovisionamiento de organización, no deja al usuario con sesión silenciosa', async () => {
  const handler = createPublicaSignupHandler({
    env: {},
    signUp: async () => ({ user: { id: 'new-user' }, access_token: 'access', refresh_token: 'refresh' }),
    provision: async () => { throw new ProvisioningError('fail', { status: 502 }); },
  });
  const res = response();
  await handler(request({ email: 'nueva@empresa.cl', password: 'pass12345', empresa: 'Empresa Nueva' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('publica signup: si Supabase exige confirmar el correo, no puede aprovisionar todavía (no hay access_token) y queda pendiente para el login', async () => {
  let provisioned = false;
  const handler = createPublicaSignupHandler({
    env: {},
    signUp: async () => ({ user: { id: 'new-user' } }), // sin access_token: requiere confirmación
    provision: async () => { provisioned = true; return { created: true }; },
  });
  const res = response();
  await handler(request({ email: 'nueva@empresa.cl', password: 'pass12345', empresa: 'Empresa Nueva' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pendingConfirmation, true);
  assert.equal(res.headers['Set-Cookie'], undefined);
  assert.equal(provisioned, false);
});

test('publica signup: correo ya registrado y confirmado (identities: []) responde 409 sin decir "revisa tu correo"', async () => {
  let provisioned = false;
  const handler = createPublicaSignupHandler({
    env: {},
    // Comportamiento real de Supabase con "Confirm email" activado: no
    // devuelve error para no filtrar qué correos existen, pero la identidad
    // viene vacía en vez de la nueva.
    signUp: async () => ({ user: { id: 'existing-user', identities: [] } }),
    provision: async () => { provisioned = true; return { created: true }; },
  });
  const res = response();
  await handler(request({ email: 'ya@existe.cl', password: 'pass12345', empresa: 'Empresa' }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.accountExists, true);
  assert.doesNotMatch(res.body.error, /revisa tu correo/i);
  assert.equal(provisioned, false);
});

test('publica signup: cuota horaria de correos agotada responde 429 y NO dice "intenta nuevamente"', async () => {
  let provisioned = false;
  const handler = createPublicaSignupHandler({
    env: {},
    // Texto literal del 429 de Supabase cuando se agota la ventana horaria del
    // SMTP integrado (medido en produccion el 2026-09-08).
    signUp: async () => {
      throw new SupabaseRequestError('email rate limit exceeded', { status: 429 });
    },
    provision: async () => { provisioned = true; return { created: true }; },
  });
  const res = response();
  await handler(request({ email: 'nuevo@ejemplo.cl', password: 'pass12345', empresa: 'Empresa' }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.rateLimited, true);
  assert.equal(res.body.retryAfter, 3600);
  assert.equal(res.headers['Retry-After'], '3600');
  // La regresion que motiva este test: el 429 caia al 503 generico y el usuario
  // leia "Intenta nuevamente", que es exactamente lo que no hay que hacer.
  assert.doesNotMatch(res.body.error, /intenta nuevamente/i);
  assert.match(res.body.error, /no se cre[oó]/i);
  assert.equal(provisioned, false);
});

test('publica signup: el cooldown corto informa los segundos que declara Supabase, no la hora completa', async () => {
  const handler = createPublicaSignupHandler({
    env: {},
    signUp: async () => {
      throw new SupabaseRequestError(
        'For security purposes, you can only request this after 57 seconds.',
        { status: 429 },
      );
    },
    provision: async () => ({ created: true }),
  });
  const res = response();
  await handler(request({ email: 'nuevo@ejemplo.cl', password: 'pass12345', empresa: 'Empresa' }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.retryAfter, 57);
  assert.equal(res.headers['Retry-After'], '57');
  assert.match(res.body.error, /57 segundos/);
});

test('publica logout y session usan sus propias cookies, no las del portal general', async () => {
  const logoutHandler = createPublicaLogoutHandler({
    env: {},
    authenticate: async () => ({ accessToken: 'access' }),
    refresh: async () => ({ access_token: 'access' }),
    revoke: async () => {},
    clearCookies: () => ['clear-pub-access', 'clear-pub-refresh'],
  });
  const logoutRes = response();
  await logoutHandler(request({}, { headers: { origin: 'https://dataseed.cl', host: 'dataseed.cl', 'x-forwarded-host': 'dataseed.cl', cookie: '__Host-pub_access=access' } }), logoutRes);
  assert.equal(logoutRes.statusCode, 200);
  assert.equal(logoutRes.body.redirectTo, '/publica-login');
  assert.deepEqual(logoutRes.headers['Set-Cookie'], ['clear-pub-access', 'clear-pub-refresh']);

  const sessionHandler = createPublicaSessionHandler({
    env: {},
    authenticate: async () => ({ identity, setCookies: null }),
    clearCookies: () => ['clear-pub-access'],
  });
  const sessionRes = response();
  await sessionHandler(request({}, { method: 'GET' }), sessionRes);
  assert.equal(sessionRes.statusCode, 200);
  assert.equal(sessionRes.body.authenticated, true);
  assert.equal(sessionRes.body.organization.name, 'Empresa A');
});

test('publica session sin cookie válida responde 401 y limpia cookies', async () => {
  const handler = createPublicaSessionHandler({
    env: {},
    authenticate: async () => { throw new AuthorizationError('Authentication required', { status: 401, code: 'authentication_required' }); },
    clearCookies: () => ['clear-pub-access'],
  });
  const res = response();
  await handler(request({}, { method: 'GET' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.authenticated, false);
  assert.deepEqual(res.headers['Set-Cookie'], ['clear-pub-access']);
});

test('google start: redirige a Supabase con PKCE y deja la cookie de verifier, nunca el verifier en la URL', async () => {
  const handler = createGoogleStartHandler({
    env: { SUPABASE_URL: 'https://proj.supabase.co', APP_ORIGIN: 'https://dataseed.cl' },
  });
  const res = response();
  await handler(request({}, { method: 'GET' }), res);
  assert.equal(res.statusCode, 302);
  const location = new URL(res.headers.Location);
  assert.equal(location.origin, 'https://proj.supabase.co');
  assert.equal(location.pathname, '/auth/v1/authorize');
  assert.equal(location.searchParams.get('provider'), 'google');
  assert.equal(location.searchParams.get('redirect_to'), 'https://dataseed.cl/api/auth/publica/google/callback');
  assert.equal(location.searchParams.get('code_challenge_method'), 's256');
  assert.ok(location.searchParams.get('code_challenge'));
  assert.match(res.headers['Set-Cookie'], /__Host-pub_oauth_verifier=/);
});

test('google callback: sin code o con error del proveedor, vuelve al login con un error legible (no expone detalle interno)', async () => {
  const handler = createGoogleCallbackHandler({ env: {} });

  const noCodeRes = response();
  await handler(request({}, { method: 'GET', url: '/api/auth/publica/google/callback?error=access_denied' }), noCodeRes);
  assert.equal(noCodeRes.statusCode, 302);
  assert.equal(noCodeRes.headers.Location, '/publica-login?error=google');

  const noVerifierRes = response();
  await handler(request({}, { method: 'GET', url: '/api/auth/publica/google/callback?code=abc', headers: { cookie: '' } }), noVerifierRes);
  assert.equal(noVerifierRes.statusCode, 302);
  assert.equal(noVerifierRes.headers.Location, '/publica-login?error=expirado');
});

test('google callback: éxito aprovisiona (si hace falta), resuelve identidad y deja sesión propia de Pública', async () => {
  let provisionCall;
  const handler = createGoogleCallbackHandler({
    env: {},
    exchange: async () => ({ access_token: 'access', refresh_token: 'refresh' }),
    fetchUser: async () => ({ id: 'user-1', email: 'client@example.com', user_metadata: { full_name: 'Client User' } }),
    provision: async (input) => { provisionCall = input; return { created: true }; },
    resolve: async () => identity,
    buildCookies: () => ['pub-access-cookie', 'pub-refresh-cookie'],
  });
  const res = response();
  await handler(request({}, {
    method: 'GET',
    url: '/api/auth/publica/google/callback?code=abc',
    headers: { cookie: '__Host-pub_oauth_verifier=verifier-value' },
  }), res);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/publica-buscador');
  assert.equal(provisionCall.accessToken, 'access');
  assert.equal(provisionCall.empresa, null);
  assert.ok(res.headers['Set-Cookie'].some((c) => c.startsWith('pub-access-cookie')));
});
