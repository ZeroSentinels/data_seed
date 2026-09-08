import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthorizationError } from '../api/auth/_lib/authorization.js';
import { createBuscarHandler } from '../api/buscar.js';
import { createLicitacionHandler } from '../api/licitacion.js';

function request(body, overrides = {}) {
  return { method: 'POST', body, headers: {}, query: {}, ...overrides };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; },
  };
}

// Ambos proxies exigen sesión de Pública antes de llamar a mp-api: sin esto,
// cualquiera podría consumir la cuota pagada del backend sin pasar por
// /publica-login. Ver el comentario en api/buscar.js.

test('buscar: sin sesión válida, responde 401 y nunca llama a mp-api', async () => {
  let calledUpstream = false;
  const handler = createBuscarHandler({
    env: { MP_API_KEY: 'test-key' },
    authenticate: async () => { throw new AuthorizationError('Authentication required', { status: 401 }); },
    fetchImpl: async () => { calledUpstream = true; return new Response('{}'); },
  });
  const res = response();
  await handler(request({ q: 'construccion' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(calledUpstream, false);
});

test('buscar: con sesión válida, llama a mp-api con el Bearer y reenvía la respuesta', async () => {
  let upstreamCall;
  const handler = createBuscarHandler({
    env: { MP_API_KEY: 'test-key' },
    authenticate: async () => ({ identity: {}, setCookies: null }),
    fetchImpl: async (url, options) => {
      upstreamCall = { url: String(url), options };
      return new Response(JSON.stringify({ resultados: [] }), { status: 200 });
    },
  });
  const res = response();
  await handler(request({ q: 'construccion' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(upstreamCall.url, 'https://api.dataseed.cl/api/buscar');
  assert.equal(upstreamCall.options.headers.Authorization, 'Bearer test-key');
});

test('licitacion: sin sesión válida, responde 401 y nunca llama a mp-api', async () => {
  let calledUpstream = false;
  const handler = createLicitacionHandler({
    env: { MP_API_KEY: 'test-key' },
    authenticate: async () => { throw new AuthorizationError('Authentication required', { status: 401 }); },
    fetchImpl: async () => { calledUpstream = true; return new Response('{}'); },
  });
  const res = response();
  await handler(request(undefined, { method: 'GET', query: { codigo: 'ABC-123' } }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(calledUpstream, false);
});

test('licitacion: con sesión válida, pasa el código a mp-api', async () => {
  let upstreamUrl;
  const handler = createLicitacionHandler({
    env: { MP_API_KEY: 'test-key' },
    authenticate: async () => ({ identity: {}, setCookies: null }),
    fetchImpl: async (url) => { upstreamUrl = String(url); return new Response(JSON.stringify({}), { status: 200 }); },
  });
  const res = response();
  await handler(request(undefined, { method: 'GET', query: { codigo: 'ABC-123' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(upstreamUrl, 'https://api.dataseed.cl/api/licitacion/ABC-123');
});
