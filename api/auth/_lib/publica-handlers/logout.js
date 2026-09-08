// Logout de la sesión de Pública. Solo toca cookies __Host-pub_* — nunca
// afecta la sesión de /portal (__Host-ds_*). No modifica api/auth/logout.js.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica/[...action].js.
import { AuthorizationError } from '../authorization.js';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
} from '../publica-cookies.js';
import { parseCookies } from '../cookies.js';
import {
  getHeader,
  isSameOriginRequest,
  methodNotAllowed,
  sendJson,
} from '../http.js';
import { authenticatePublicaRequest } from '../publica-session.js';
import {
  SupabaseRequestError,
  refreshSession,
  signOut,
} from '../supabase.js';

export function createPublicaLogoutHandler({
  env = process.env,
  authenticate = authenticatePublicaRequest,
  refresh = refreshSession,
  revoke = signOut,
  clearCookies = clearSessionCookies,
} = {}) {
  return async function publicaLogoutHandler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!isSameOriginRequest(req, env)) {
      return sendJson(res, 403, { error: 'Solicitud no autorizada.' });
    }

    const cookies = parseCookies(getHeader(req, 'cookie'));
    const refreshToken = cookies[REFRESH_COOKIE];
    let accessToken = cookies[ACCESS_COOKIE];
    let providerFailed = false;

    if (!accessToken && !refreshToken) {
      try {
        ({ accessToken } = await authenticate(req, { env }));
      } catch (error) {
        if (!(error instanceof AuthorizationError)) providerFailed = true;
      }
    }

    if (!accessToken && refreshToken && !providerFailed) {
      try {
        const session = await refresh(refreshToken, { env });
        accessToken = session.access_token;
      } catch (error) {
        if (!(error instanceof SupabaseRequestError) || ![400, 401].includes(error.status)) {
          providerFailed = true;
        }
      }
    }

    if (accessToken && !providerFailed) {
      try {
        await revoke(accessToken, { env });
      } catch (error) {
        const expired = error instanceof SupabaseRequestError && [400, 401].includes(error.status);
        if (expired && refreshToken) {
          try {
            const session = await refresh(refreshToken, { env });
            await revoke(session.access_token, { env });
          } catch (retryError) {
            if (!(retryError instanceof SupabaseRequestError) || ![400, 401].includes(retryError.status)) {
              providerFailed = true;
            }
          }
        } else {
          providerFailed = true;
        }
      }
    }

    res.setHeader('Set-Cookie', clearCookies());
    if (providerFailed) {
      return sendJson(res, 503, {
        ok: false,
        error: 'La sesión local se cerró, pero no pudimos confirmar la revocación remota.',
      });
    }
    return sendJson(res, 200, { ok: true, redirectTo: '/publica-login' });
  };
}

export default createPublicaLogoutHandler();
