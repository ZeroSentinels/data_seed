// Estado de sesión de Pública (independiente del /api/auth/session general).
import { AuthorizationError } from '../_lib/authorization.js';
import { clearSessionCookies } from '../_lib/publica-cookies.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';
import { authenticatePublicaRequest } from '../_lib/publica-session.js';

export const config = { runtime: 'nodejs' };

export function createPublicaSessionHandler({
  authenticate = authenticatePublicaRequest,
  clearCookies = clearSessionCookies,
  env = process.env,
} = {}) {
  return async function publicaSessionHandler(req, res) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

    try {
      const session = await authenticate(req, { env });
      if (session.setCookies) res.setHeader('Set-Cookie', session.setCookies);
      return sendJson(res, 200, {
        authenticated: true,
        user: {
          email: session.identity.user.email,
          name: session.identity.profile.full_name || session.identity.user.email,
        },
        organization: {
          name: session.identity.organization.name,
          plan: session.identity.organization.plan,
        },
      });
    } catch (error) {
      res.setHeader('Set-Cookie', clearCookies());
      if (error instanceof AuthorizationError || error?.status === 401) {
        const status = error.status === 403 ? 403 : 401;
        return sendJson(res, status, {
          authenticated: false,
          error: status === 403 ? 'Cuenta no autorizada.' : 'Sesión no válida.',
        });
      }
      return sendJson(res, 503, {
        authenticated: false,
        error: 'No pudimos validar la sesión. Intenta nuevamente.',
      });
    }
  };
}

export default createPublicaSessionHandler();
