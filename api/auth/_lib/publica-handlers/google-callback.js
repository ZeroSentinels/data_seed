// Vuelta del login con Google (ver ./google-start.js). Es una navegación
// del propio Google/Supabase, no un fetch — por eso responde con redirects
// (302) y no con JSON, incluso en los casos de error.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica-router.js.
import { AuthorizationError, resolveIdentity } from '../authorization.js';
import {
  OAUTH_VERIFIER_COOKIE,
  buildSessionCookies,
  clearOAuthVerifierCookie,
} from '../publica-cookies.js';
import { parseCookies } from '../cookies.js';
import { getHeader } from '../http.js';
import { ensureOrganizationForUser, ProvisioningError } from '../publica-provisioning.js';
import { SupabaseRequestError, exchangeOAuthCode, getUser } from '../supabase.js';

function redirect(res, cookies, location) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const setCookie = [clearOAuthVerifierCookie(), ...(cookies || [])];
  res.setHeader('Set-Cookie', setCookie);
  res.writeHead(302, { Location: location });
  return res.end();
}

export function createGoogleCallbackHandler({
  env = process.env,
  exchange = exchangeOAuthCode,
  fetchUser = getUser,
  provision = ensureOrganizationForUser,
  resolve = resolveIdentity,
  buildCookies = buildSessionCookies,
} = {}) {
  return async function googleCallbackHandler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return redirect(res, null, '/publica-login?error=metodo');
    }

    const url = new URL(req.url, 'http://localhost');
    const code = url.searchParams.get('code');
    const providerError = url.searchParams.get('error');
    if (providerError) {
      return redirect(res, null, '/publica-login?error=google');
    }
    if (!code) {
      return redirect(res, null, '/publica-login?error=google');
    }

    const cookies = parseCookies(getHeader(req, 'cookie'));
    const verifier = cookies[OAUTH_VERIFIER_COOKIE];
    if (!verifier) {
      return redirect(res, null, '/publica-login?error=expirado');
    }

    let session;
    try {
      session = await exchange(code, verifier, { env });
    } catch (error) {
      return redirect(res, null, '/publica-login?error=google');
    }

    let user;
    try {
      user = await fetchUser(session.access_token, { env });
    } catch (error) {
      return redirect(res, null, '/publica-login?error=google');
    }
    if (!user?.id || !user?.email) {
      return redirect(res, null, '/publica-login?error=google');
    }

    try {
      await provision({ accessToken: session.access_token, empresa: null }, { env });
    } catch (error) {
      const label = error instanceof ProvisioningError ? 'organizacion' : 'servidor';
      return redirect(res, null, `/publica-login?error=${label}`);
    }

    let identity;
    try {
      identity = await resolve(session.access_token, { providerOptions: { env } });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return redirect(res, null, '/publica-login?error=sin_entorno');
      }
      return redirect(res, null, '/publica-login?error=servidor');
    }

    const sessionCookies = buildCookies(session, { remember: true });
    return redirect(res, sessionCookies, '/publica');
  };
}

export default createGoogleCallbackHandler();
