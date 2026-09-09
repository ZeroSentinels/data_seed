// Perfil de búsqueda guardado del panel de autoservicio (/publica-buscador):
// filtros (región, monto, solo abiertas) persistidos por organización, sobre
// organization_settings (V1, sin uso previo — confirmado antes de escribir
// esto). Ver supabase/migrations/20260908b_publica_search_profile.sql.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica-router.js.
import { AuthorizationError } from '../authorization.js';
import { authenticatePublicaRequest } from '../publica-session.js';
import { isSameOriginRequest, parseRequestBody, sendJson } from '../http.js';
import { getOrganizationSettings, savePublicaSearchProfile } from '../supabase.js';

export function createSearchProfileHandler({
  env = process.env,
  authenticate = authenticatePublicaRequest,
  getSettings = getOrganizationSettings,
  saveProfile = savePublicaSearchProfile,
} = {}) {
  return async function searchProfileHandler(req, res) {
    let session;
    try {
      session = await authenticate(req, { env });
      if (session.setCookies) res.setHeader('Set-Cookie', session.setCookies);
    } catch (error) {
      const status = error instanceof AuthorizationError ? error.status : 401;
      return sendJson(res, status, { error: 'Inicia sesión para continuar.' });
    }

    if (req.method === 'GET') {
      try {
        const row = await getSettings(session.accessToken, session.identity.organization.id, { env });
        const perfil = (row && row.settings && row.settings.buscador_perfil) || {};
        return sendJson(res, 200, { perfil });
      } catch (error) {
        return sendJson(res, 503, { error: 'No pudimos cargar tu perfil de búsqueda.' });
      }
    }

    if (req.method === 'POST') {
      if (!isSameOriginRequest(req, env)) {
        return sendJson(res, 403, { error: 'Solicitud no autorizada.' });
      }
      const body = parseRequestBody(req);
      const perfil = body?.perfil;
      if (!perfil || typeof perfil !== 'object' || Array.isArray(perfil)) {
        return sendJson(res, 400, { error: 'Perfil inválido.' });
      }
      try {
        await saveProfile(session.accessToken, perfil, { env });
        return sendJson(res, 200, { ok: true });
      } catch (error) {
        return sendJson(res, 503, { error: 'No pudimos guardar tu perfil de búsqueda.' });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  };
}

export default createSearchProfileHandler();
