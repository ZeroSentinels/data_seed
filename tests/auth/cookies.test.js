import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCESS_COOKIE,
  PERSIST_COOKIE,
  REFRESH_COOKIE,
  buildSessionCookies,
  clearSessionCookies,
  parseCookies,
} from '../../api/auth/_lib/cookies.js';

test('parseCookies decodes values and ignores malformed pairs', () => {
  const cookies = parseCookies('theme=dark; encoded=hello%20world; invalid; empty=');
  assert.deepEqual(cookies, {
    theme: 'dark',
    encoded: 'hello world',
    empty: '',
  });
});

test('buildSessionCookies creates host-only secure HttpOnly session cookies', () => {
  const headers = buildSessionCookies({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
  }, { remember: false });

  assert.equal(headers.length, 2);
  assert.match(headers[0], new RegExp(`^${ACCESS_COOKIE}=access-token`));
  assert.match(headers[1], new RegExp(`^${REFRESH_COOKIE}=refresh-token`));
  for (const header of headers) {
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Path=\//);
    assert.doesNotMatch(header, /Domain=/);
    assert.doesNotMatch(header, /Max-Age=/);
  }
});

test('remembered sessions use bounded cookie lifetimes', () => {
  const headers = buildSessionCookies({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 999999,
  }, { remember: true });

  assert.equal(headers.length, 3);
  assert.match(headers[0], /Max-Age=3600/);
  assert.match(headers[1], /Max-Age=2592000/);
  assert.match(headers[2], new RegExp(`^${PERSIST_COOKIE}=1`));
  assert.match(headers[2], /HttpOnly/);
  assert.match(headers[2], /Max-Age=2592000/);
});

test('clearSessionCookies expires all host cookies', () => {
  const headers = clearSessionCookies();
  assert.equal(headers.length, 3);
  assert.match(headers[0], new RegExp(`^${ACCESS_COOKIE}=`));
  assert.match(headers[1], new RegExp(`^${REFRESH_COOKIE}=`));
  assert.match(headers[2], new RegExp(`^${PERSIST_COOKIE}=`));
  for (const header of headers) {
    assert.match(header, /Max-Age=0/);
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Path=\//);
  }
});
