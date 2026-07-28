export const ACCESS_COOKIE = '__Host-ds_access';
export const REFRESH_COOKIE = '__Host-ds_refresh';
export const PERSIST_COOKIE = '__Host-ds_persist';

const ACCESS_MAX_AGE_SECONDS = 3600;
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    cookies[name] = safeDecode(part.slice(separator + 1).trim());
  }
  return cookies;
}

function serializeCookie(name, value, { maxAge } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  if (Number.isInteger(maxAge)) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function buildSessionCookies(session, { remember = false } = {}) {
  if (!session?.access_token || !session?.refresh_token) {
    throw new TypeError('Supabase session tokens are required');
  }

  const accessMaxAge = Math.min(
    ACCESS_MAX_AGE_SECONDS,
    Math.max(60, Number(session.expires_in) || ACCESS_MAX_AGE_SECONDS),
  );

  const cookies = [
    serializeCookie(ACCESS_COOKIE, session.access_token, remember ? { maxAge: accessMaxAge } : {}),
    serializeCookie(REFRESH_COOKIE, session.refresh_token, remember ? { maxAge: REFRESH_MAX_AGE_SECONDS } : {}),
  ];
  if (remember) {
    cookies.push(serializeCookie(PERSIST_COOKIE, '1', { maxAge: REFRESH_MAX_AGE_SECONDS }));
  }
  return cookies;
}

export function clearSessionCookies() {
  return [
    serializeCookie(ACCESS_COOKIE, '', { maxAge: 0 }),
    serializeCookie(REFRESH_COOKIE, '', { maxAge: 0 }),
    serializeCookie(PERSIST_COOKIE, '', { maxAge: 0 }),
  ];
}
