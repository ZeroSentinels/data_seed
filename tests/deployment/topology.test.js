import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../../', import.meta.url);
const rootPath = fileURLToPath(rootUrl);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

test('Vercel routes the protected portal without shadowing static site or API functions', async () => {
  const config = JSON.parse(await read('vercel.json'));
  assert.deepEqual(config.redirects, [
    { source: '/login', destination: '/site/login.html', permanent: false },
    { source: '/login.html', destination: '/site/login.html', permanent: false },
  ]);
  assert.deepEqual(config.rewrites, [{ source: '/portal', destination: '/api/portal' }]);
  assert.equal(config.routes, undefined);
  assert.equal(config.builds, undefined);

  const sources = config.headers.map((rule) => rule.source);
  assert.ok(sources.includes('/site/login.html'));
  assert.ok(sources.includes('/portal'));
  assert.ok(sources.includes('/api/auth/(.*)'));

  const serialized = JSON.stringify(config);
  assert.match(serialized, /Cache-Control/);
  assert.match(serialized, /no-store/);
  assert.match(serialized, /Content-Security-Policy/);
  assert.match(serialized, /X-Frame-Options/);
  assert.match(serialized, /Permissions-Policy/);
});

test('all local login and protected-portal assets exist under the repository document root', async () => {
  const html = await read('site/login.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(?:https?:|mailto:|#|data:)/.test(ref)) continue;
    const clean = ref.split(/[?#]/, 1)[0];
    await assert.doesNotReject(access(path.join(rootPath, 'site', clean)));
  }

  const portalSource = await read('api/portal.js');
  for (const ref of ['/site/portal.css', '/site/portal.js', '/site/assets/dataseed_logo_black.png']) {
    assert.match(portalSource, new RegExp(ref.replaceAll('/', '\\/').replace('.', '\\.')));
    await assert.doesNotReject(access(path.join(rootPath, ref.slice(1))));
  }
  assert.match(portalSource, /family=Syne/);
  assert.match(portalSource, /family=Inter/);
});

test('package scripts provide reproducible test and validation entry points', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts.test, 'node --test');
  assert.equal(pkg.scripts.check, 'node --check site/login.js && node --check site/portal.js && node --test');
});
