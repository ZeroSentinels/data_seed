// Certificaciones autodeclaradas (OS10, ISO 9001, ISO 45001) para el fit
// score del panel de autoservicio (/publica-buscador). Guardadas sobre
// organization_settings, clave "certificaciones" — hermana de
// "buscador_perfil" (mismo jsonb, ver
// api/auth/_lib/publica-handlers/search-profile.js). Ver
// supabase/migrations/20260908c_publica_certifications.sql.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica-router.js.
import { AuthorizationError } from '../authorization.js';
import { authenticatePublicaRequest } from '../publica-session.js';
import { isSameOriginRequest, parseRequestBody, sendJson } from '../http.js';
import { getOrganizationSettings, savePublicaCertifications } from '../supabase.js';

export function createCertificationsHandler({
  env = process.env,
  authenticate = authenticatePublicaRequest,
  getSettings = getOrganizationSettings,
  saveCertifications = savePublicaCertifications,
} = {}) {
  return async function certificationsHandler(req, res) {
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
        const certificaciones = (row && row.settings && row.settings.certificaciones) || {};
        return sendJson(res, 200, { certificaciones });
      } catch (error) {
        return sendJson(res, 503, { error: 'No pudimos cargar tus certificaciones.' });
      }
    }

    if (req.method === 'POST') {
      if (!isSameOriginRequest(req, env)) {
        return sendJson(res, 403, { error: 'Solicitud no autorizada.' });
      }
      const body = parseRequestBody(req);
      const certificaciones = body?.certificaciones;
      if (!certificaciones || typeof certificaciones !== 'object' || Array.isArray(certificaciones)) {
        return sendJson(res, 400, { error: 'Certificaciones inválidas.' });
      }
      try {
        await saveCertifications(session.accessToken, certificaciones, { env });
        return sendJson(res, 200, { ok: true });
      } catch (error) {
        return sendJson(res, 503, { error: 'No pudimos guardar tus certificaciones.' });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  };
}

export default createCertificationsHandler();
