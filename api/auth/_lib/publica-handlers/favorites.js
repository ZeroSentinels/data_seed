// Licitaciones favoritas del panel de autoservicio (/publica-buscador,
// sección "Favoritas"). Guardadas sobre organization_settings, clave
// "favoritos" — hermana de "buscador_perfil"/"certificaciones" (mismo
// jsonb, ver api/auth/_lib/publica-handlers/search-profile.js y
// certifications.js). Ver
// supabase/migrations/20260909_publica_favorites.sql.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica-router.js.
import { AuthorizationError } from '../authorization.js';
import { authenticatePublicaRequest } from '../publica-session.js';
import { isSameOriginRequest, parseRequestBody, sendJson } from '../http.js';
import { getOrganizationSettings, savePublicaFavorites } from '../supabase.js';

const MAX_FAVORITOS = 200;

function esListaValida(favoritos) {
  if (!Array.isArray(favoritos) || favoritos.length > MAX_FAVORITOS) return false;
  return favoritos.every((item) => item && typeof item === 'object' && typeof item.codigo === 'string' && item.codigo);
}

export function createFavoritesHandler({
  env = process.env,
  authenticate = authenticatePublicaRequest,
  getSettings = getOrganizationSettings,
  saveFavorites = savePublicaFavorites,
} = {}) {
  return async function favoritesHandler(req, res) {
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
        const favoritos = (row && row.settings && row.settings.favoritos) || [];
        return sendJson(res, 200, { favoritos });
      } catch (error) {
        return sendJson(res, 503, { error: 'No pudimos cargar tus licitaciones favoritas.' });
      }
    }

    if (req.method === 'POST') {
      if (!isSameOriginRequest(req, env)) {
        return sendJson(res, 403, { error: 'Solicitud no autorizada.' });
      }
      const body = parseRequestBody(req);
      const favoritos = body?.favoritos;
      if (!esListaValida(favoritos)) {
        return sendJson(res, 400, { error: 'Lista de favoritos inválida.' });
      }
      try {
        await saveFavorites(session.accessToken, favoritos, { env });
        return sendJson(res, 200, { ok: true });
      } catch (error) {
        return sendJson(res, 503, { error: 'No pudimos guardar tus favoritos.' });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  };
}

export default createFavoritesHandler();
