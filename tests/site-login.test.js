import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function source(path) {
  try {
    return await readFile(new URL(path, root), 'utf8');
  } catch {
    return '';
  }
}

test('login page exposes the complete accessible customer access flow', async () => {
  const html = await source('site/login.html');

  assert.match(html, /<html[^>]+lang="es"/i);
  assert.match(html, /Portal de clientes/i);
  assert.match(html, /<form[^>]+id="login-form"/i);
  assert.match(html, /<label[^>]+for="email"/i);
  assert.match(html, /<input[^>]+id="email"[^>]+type="email"[^>]+autocomplete="email"/i);
  assert.match(html, /<label[^>]+for="password"/i);
  assert.match(html, /<input[^>]+id="password"[^>]+type="password"[^>]+autocomplete="current-password"/i);
  assert.match(html, /id="password-toggle"[^>]+aria-controls="password"/i);
  assert.match(html, /<input[^>]+id="remember"[^>]+type="checkbox"/i);
  assert.match(html, /id="forgot-password"/i);
  assert.match(html, /Iniciar sesión/i);
  assert.match(html, /mailto:contacto@dataseed\.cl/i);
  assert.match(html, /href="index\.html"/i);
  assert.match(html, /id="login-status"[^>]+aria-live="polite"/i);
  assert.match(html, /id="theme-toggle"/i);
  assert.match(html, /href="login\.css"/i);
  assert.match(html, /src="login\.js"/i);
});

test('login client handles validation, loading, success, recovery and generic server errors without browser token storage', async () => {
  const js = await source('site/login.js');

  assert.match(js, /\/api\/auth\/login/);
  assert.match(js, /\/api\/auth\/session/);
  assert.match(js, /\/api\/auth\/forgot-password/);
  assert.match(js, /credentials:\s*['"]same-origin['"]/);
  assert.match(js, /Iniciando sesión/);
  assert.match(js, /Acceso correcto/);
  assert.match(js, /Credenciales incorrectas|No pudimos iniciar sesión/);
  assert.match(js, /servidor|Intenta nuevamente/i);
  assert.match(js, /passwordInput\.type/);
  assert.doesNotMatch(js, /localStorage\.setItem\([^\n]*(token|password|session)/i);
  assert.doesNotMatch(js, /SUPABASE_(ANON|SERVICE)|service_role|anonKey/i);
  assert.doesNotMatch(js, /tenant_id|organization_id/i);
});

test('login styles reuse the DataSeed system in light/dark and supported responsive widths', async () => {
  const css = await source('site/login.css');

  assert.match(css, /--bg:\s*#050e06/i);
  assert.match(css, /--g:\s*#00ff41/i);
  assert.match(css, /html\[data-theme="light"\]/i);
  assert.match(css, /font-family:\s*['"]Syne/i);
  assert.match(css, /font-family:\s*['"]Inter/i);
  assert.match(css, /min-height:\s*44px/i);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/i);
  assert.match(css, /@media\s*\(max-width:\s*520px\)/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
  assert.match(css, /:focus-visible/i);
});
