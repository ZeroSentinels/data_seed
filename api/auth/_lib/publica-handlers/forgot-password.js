// Igual que api/auth/forgot-password.js, pero el link de recuperación vuelve
// a /publica-login en vez de /site/login.html.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica-router.js.
import {
  getHeader,
  isSameOriginRequest,
  methodNotAllowed,
  normalizeEmail,
  parseRequestBody,
  sendJson,
} from '../http.js';
import { SupabaseRequestError, sendPasswordRecovery } from '../supabase.js';

const PUBLIC_MESSAGE = 'Si la cuenta existe, enviaremos instrucciones para recuperar el acceso.';

export function createPublicaForgotPasswordHandler({
  env = process.env,
  recover = sendPasswordRecovery,
} = {}) {
  return async function publicaForgotPasswordHandler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!isSameOriginRequest(req, env)) {
      return sendJson(res, 403, { error: 'Solicitud no autorizada.' });
    }

    const body = parseRequestBody(req);
    const email = normalizeEmail(body?.email);
    if (!email) {
      return sendJson(res, 400, { error: 'Ingresa un correo electrónico válido.' });
    }

    const origin = String(env.APP_ORIGIN || getHeader(req, 'origin') || '').replace(/\/$/, '');
    const redirectTo = `${origin}/publica-login?recovery=1`;

    try {
      await recover(email, redirectTo, { env });
    } catch (error) {
      if (!(error instanceof SupabaseRequestError) || error.status >= 500) {
        return sendJson(res, 503, {
          error: 'No pudimos procesar la solicitud. Intenta nuevamente.',
        });
      }
    }

    return sendJson(res, 200, { ok: true, message: PUBLIC_MESSAGE });
  };
}

export default createPublicaForgotPasswordHandler();
