import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('protected portal assets exist and implement secure logout', async () => {
  const js = await read('site/portal.js');
  assert.match(js, /fetch\('\/api\/auth\/logout'/);
  assert.match(js, /method: 'POST'/);
  assert.match(js, /credentials: 'same-origin'/);
  assert.match(js, /window\.location\.replace\('\/site\/login\.html'/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|access_token|refresh_token|tenant_id|organization_id/i);
});

test('protected portal CSS is DataSeed-branded, responsive and accessible', async () => {
  const css = await read('site/portal.css');
  assert.match(css, /--g:\s*#00ff41/);
  assert.match(css, /font-family:\s*'Syne'/);
  assert.match(css, /font-family:\s*'Inter'/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.doesNotMatch(css, /min-width:\s*320px/);
});
