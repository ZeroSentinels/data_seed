import {
  getHeader,
  isSameOriginRequest,
  methodNotAllowed,
  normalizeEmail,
  parseRequestBody,
  sendJson,
} from './_lib/http.js';
import { SupabaseRequestError, sendPasswordRecovery } from './_lib/supabase.js';

export const config = { runtime: 'nodejs' };

const PUBLIC_MESSAGE = 'Si la cuenta existe, enviaremos instrucciones para recuperar el acceso.';

export function createForgotPasswordHandler({
  env = process.env,
  recover = sendPasswordRecovery,
} = {}) {
  return async function forgotPasswordHandler(req, res) {
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
    const redirectTo = `${origin}/site/login.html?recovery=1`;

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

export default createForgotPasswordHandler();
