import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

// Regresión: un <style> inline en site/publica-login.html quedó bloqueado en
// producción por su propio CSP (style-src 'self', sin unsafe-inline) — el
// navegador lo ignora sin error visible en consola, y la página se ve sin
// estilos (tabs, botón de Google, separador). Ver site/publica-login.css.
test('publica-login no usa <style> inline: su propio CSP (style-src \'self\') lo bloquearía', async () => {
  const html = await read('site/publica-login.html');
  assert.doesNotMatch(html, /<style[\s>]/);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.match(html, /<link rel="stylesheet" href="\/site\/publica-login\.css">/);
});

test('publica-login CSP sigue sin unsafe-inline en style-src', async () => {
  const html = await read('site/publica-login.html');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  assert.match(csp, /style-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline/);
});
