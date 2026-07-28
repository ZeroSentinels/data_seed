import { AuthorizationError, resolveIdentity } from './authorization.js';
import {
  ACCESS_COOKIE,
  PERSIST_COOKIE,
  REFRESH_COOKIE,
  buildSessionCookies,
  parseCookies,
} from './cookies.js';
import { getHeader } from './http.js';
import { SupabaseRequestError, refreshSession } from './supabase.js';

function isInvalidSession(error) {
  return error?.status === 401 || (
    error instanceof SupabaseRequestError && [400, 401].includes(error.status)
  );
}

function authenticationRequired() {
  return new AuthorizationError('Authentication required', {
    status: 401,
    code: 'authentication_required',
  });
}

export async function authenticateRequest(req, {
  env = process.env,
  resolve = resolveIdentity,
  refresh = refreshSession,
  buildCookies = buildSessionCookies,
} = {}) {
  const cookies = parseCookies(getHeader(req, 'cookie'));
  const accessToken = cookies[ACCESS_COOKIE];

  if (accessToken) {
    try {
      const identity = await resolve(accessToken, { providerOptions: { env } });
      return { identity, accessToken, setCookies: null };
    } catch (error) {
      if (!isInvalidSession(error)) throw error;
    }
  }

  const refreshToken = cookies[REFRESH_COOKIE];
  if (!refreshToken) throw authenticationRequired();

  let session;
  try {
    session = await refresh(refreshToken, { env });
  } catch (error) {
    if (isInvalidSession(error)) throw authenticationRequired();
    throw error;
  }

  const identity = await resolve(session.access_token, { providerOptions: { env } });
  const remember = cookies[PERSIST_COOKIE] === '1';
  return {
    identity,
    accessToken: session.access_token,
    setCookies: buildCookies(session, { remember }),
  };
}
