import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../../api/auth/publica-router.js';

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

// El router existe para que Vercel cuente una sola función serverless en vez
// de siete (plan Hobby: máximo 12 por deployment). Ver el comentario en
// api/auth/publica-router.js — incluye por qué se descartó la ruta dinámica
// [...action].js (en producción devolvía 404 propio en todas las rutas).
// `req.query.path` lo llena el rewrite de vercel.json
// ("/api/auth/publica/(.*)" -> "/api/auth/publica-router?path=$1"), no un
// segmento de ruta dinámico de Vercel. Estos tests solo verifican el ruteo
// por ese query param — el comportamiento de cada endpoint ya lo cubre
// tests/auth/publica.test.js contra las funciones importadas directamente.

test('router: rutea /login, /session y /google/start a su handler', async () => {
  const getRes = response();
  await router({ method: 'GET', query: { path: 'session' }, headers: {} }, getRes);
  // session sin cookie -> 401, pero lo importante es que NO sea 404: llegó al handler correcto.
  assert.notEqual(getRes.statusCode, 404);

  const googleRes = response();
  await router({ method: 'GET', query: { path: 'google/start' }, headers: {} }, googleRes);
  assert.notEqual(googleRes.statusCode, 404);
});

test('router: ruta desconocida bajo /api/auth/publica/* responde 404, no cae a ningún handler', async () => {
  const res = response();
  await router({ method: 'GET', query: { path: 'no-existe' }, headers: {} }, res);
  assert.equal(res.statusCode, 404);
});

test('router: sin query "path" responde 404', async () => {
  const res = response();
  await router({ method: 'GET', query: {}, headers: {} }, res);
  assert.equal(res.statusCode, 404);
});
