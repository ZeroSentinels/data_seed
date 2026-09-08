import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

test('publica-buscador tiene botón de cerrar sesión conectado a /api/auth/publica/logout', async () => {
  const html = await read('site/publica-buscador.html');
  assert.match(html, /id="publicaLogoutButton"/);

  const js = await read('site/publica-buscador-auth-guard.js');
  assert.match(js, /publicaLogoutButton/);
  assert.match(js, /\/api\/auth\/publica\/logout/);
  assert.match(js, /\/api\/auth\/publica\/session/);
});

test('publica-buscador no se indexa (noindex) y carga el guard de sesión antes que el resto', async () => {
  const html = await read('site/publica-buscador.html');
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /<script src="\/site\/publica-buscador-auth-guard\.js"><\/script>/);
});
