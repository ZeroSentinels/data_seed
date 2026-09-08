// Sesión propia e independiente para Pública: mismos mecanismos de seguridad
// que api/auth/_lib/cookies.js (HttpOnly, Secure, SameSite=Lax, prefijo
// __Host-), pero con nombres de cookie distintos para que iniciar/cerrar
// sesión en Pública nunca toque la sesión de /portal ni viceversa. No
// modifica cookies.js.
export const ACCESS_COOKIE = '__Host-pub_access';
export const REFRESH_COOKIE = '__Host-pub_refresh';
export const PERSIST_COOKIE = '__Host-pub_persist';
export const OAUTH_VERIFIER_COOKIE = '__Host-pub_oauth_verifier';

const ACCESS_MAX_AGE_SECONDS = 3600;
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_VERIFIER_MAX_AGE_SECONDS = 600;

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

export function buildOAuthVerifierCookie(verifier) {
  return serializeCookie(OAUTH_VERIFIER_COOKIE, verifier, { maxAge: OAUTH_VERIFIER_MAX_AGE_SECONDS });
}

export function clearOAuthVerifierCookie() {
  return serializeCookie(OAUTH_VERIFIER_COOKIE, '', { maxAge: 0 });
}
