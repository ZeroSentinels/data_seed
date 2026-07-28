import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('login page contains the complete accessible customer form', async () => {
  const html = await read('site/login.html');
  assert.match(html, /<h1[^>]*>Portal de clientes<\/h1>/);
  assert.match(html, /<form id="login-form"[^>]*novalidate>/);
  assert.match(html, /id="email"[^>]*type="email"[^>]*autocomplete="email"/);
  assert.match(html, /id="password"[^>]*type="password"[^>]*autocomplete="current-password"/);
  assert.match(html, /id="password-toggle"[^>]*aria-controls="password"/);
  assert.match(html, /id="remember"[^>]*type="checkbox"/);
  assert.match(html, /id="forgot-password"/);
  assert.match(html, />Iniciar sesión<\/span>/);
  assert.match(html, />Solicitar acceso<\/a>/);
  assert.match(html, />\s*Volver al sitio principal\s*<\/a>/);
  assert.match(html, /id="login-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="email-error"[^>]*aria-live="polite"/);
  assert.match(html, /id="password-error"[^>]*aria-live="polite"/);
});

test('login client talks only to same-origin server APIs and never stores credentials or tokens', async () => {
  const js = await read('site/login.js');
  assert.match(js, /fetch\('\/api\/auth\/login'/);
  assert.match(js, /fetch\('\/api\/auth\/forgot-password'/);
  assert.match(js, /fetch\('\/api\/auth\/session'/);
  assert.match(js, /credentials: 'same-origin'/);
  assert.match(js, /window\.location\.(?:assign|replace)\('\/portal'\)/);
  assert.doesNotMatch(js, /supabase|anonkey|service_role|tenant_id|organization_id/i);
  assert.doesNotMatch(js, /sessionStorage/);
  assert.doesNotMatch(js, /localStorage\.(?:setItem|getItem)\((?!'dataseed-theme')/);
  assert.doesNotMatch(js, /localStorage\.setItem\([^,]+,\s*(?:password|credentials|token)/i);
});

test('login styles preserve DataSeed dark/light identity and responsive accessibility', async () => {
  const [html, css] = await Promise.all([read('site/login.html'), read('site/login.css')]);
  assert.match(html, /family=Syne/);
  assert.match(html, /family=Inter/);
  assert.doesNotMatch(html, /DM\+Sans|DM Sans/);
  assert.match(css, /--g:\s*#00ff41/);
  assert.match(css, /html\[data-theme="light"\]/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(css, /min-width:\s*320px/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /:focus-visible/);
});

test('login CSP permits only same-origin scripts and API connections', async () => {
  const html = await read('site/login.html');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval|https:\/\/\*\.supabase\.co|esm\.sh/);
});
