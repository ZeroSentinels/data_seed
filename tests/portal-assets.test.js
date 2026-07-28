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

test('protected portal assets provide a responsive DataSeed shell and secure logout', async () => {
  const [css, js] = await Promise.all([
    source('site/portal.css'),
    source('site/portal.js'),
  ]);

  assert.match(css, /--bg:\s*#050e06/i);
  assert.match(css, /font-family:\s*['"]Syne/i);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
  assert.match(css, /min-height:\s*44px/i);
  assert.match(js, /\/api\/auth\/logout/);
  assert.match(js, /method:\s*['"]POST['"]/);
  assert.match(js, /credentials:\s*['"]same-origin['"]/);
  assert.match(js, /\/site\/login\.html/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|tenant_id|organization_id/i);
});
