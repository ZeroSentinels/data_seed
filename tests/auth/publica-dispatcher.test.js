import test from 'node:test';
import assert from 'node:assert/strict';

import dispatcher from '../../api/auth/publica/[...action].js';

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

// El dispatcher existe para que Vercel cuente una sola función serverless en
// vez de siete (plan Hobby: máximo 12 por deployment). Ver el comentario en
// api/auth/publica/[...action].js. Estos tests solo verifican el ruteo por
// segmento de path — el comportamiento de cada endpoint ya lo cubre
// tests/auth/publica.test.js contra las funciones importadas directamente.

test('dispatcher: rutea /login, /signup y /google/start,callback a su handler', async () => {
  const getRes = response();
  await dispatcher({ method: 'GET', query: { action: ['session'] }, headers: {} }, getRes);
  // session sin cookie -> 401, pero lo importante es que NO sea 404: llegó al handler correcto.
  assert.notEqual(getRes.statusCode, 404);

  const googleRes = response();
  await dispatcher({ method: 'GET', query: { action: ['google', 'start'] }, headers: {} }, googleRes);
  assert.notEqual(googleRes.statusCode, 404);
});

test('dispatcher: ruta desconocida bajo /api/auth/publica/* responde 404, no cae a ningún handler', async () => {
  const res = response();
  await dispatcher({ method: 'GET', query: { action: ['no-existe'] }, headers: {} }, res);
  assert.equal(res.statusCode, 404);
});

test('dispatcher: sin segmentos de path responde 404', async () => {
  const res = response();
  await dispatcher({ method: 'GET', query: {}, headers: {} }, res);
  assert.equal(res.statusCode, 404);
});
