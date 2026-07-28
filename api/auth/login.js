import { buildSessionCookies } from './_lib/cookies.js';
import { AuthorizationError, resolveIdentity } from './_lib/authorization.js';
import {
  isSameOriginRequest,
  methodNotAllowed,
  normalizeEmail,
  parseRequestBody,
  sendJson,
} from './_lib/http.js';
import {
  SupabaseRequestError,
  signInWithPassword,
  signOut,
} from './_lib/supabase.js';

export const config = { runtime: 'nodejs' };

export function createLoginHandler({
  env = process.env,
  signIn = signInWithPassword,
  resolve = resolveIdentity,
  revoke = signOut,
  buildCookies = buildSessionCookies,
} = {}) {
  return async function loginHandler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!isSameOriginRequest(req, env)) {
      return sendJson(res, 403, { error: 'Solicitud no autorizada.' });
    }

    const body = parseRequestBody(req);
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password || password.length > 1024) {
      return sendJson(res, 400, { error: 'Completa correctamente el correo y la contraseña.' });
    }

    let session;
    try {
      session = await signIn({ email, password }, { env });
    } catch (error) {
      if (error instanceof SupabaseRequestError && [400, 401].includes(error.status)) {
        return sendJson(res, 401, { error: 'No pudimos iniciar sesión. Revisa tus credenciales.' });
      }
      return sendJson(res, 503, { error: 'No pudimos procesar el acceso. Intenta nuevamente.' });
    }

    let identity;
    try {
      identity = await resolve(session.access_token, { providerOptions: { env } });
    } catch (error) {
      try {
        await revoke(session.access_token, { env });
      } catch {
        // The browser never receives this failed provider session.
      }
      if (error instanceof AuthorizationError) {
        return sendJson(res, error.status, {
          error: 'Tu cuenta no tiene un entorno habilitado. Contacta a soporte.',
        });
      }
      return sendJson(res, 503, { error: 'No pudimos validar tu entorno. Intenta nuevamente.' });
    }

    const cookies = buildCookies(session, { remember: body?.remember === true });
    res.setHeader('Set-Cookie', cookies);
    return sendJson(res, 200, {
      ok: true,
      redirectTo: '/portal',
      user: {
        email: identity.user.email,
        name: identity.profile.full_name || identity.user.email,
      },
      organization: {
        name: identity.organization.name,
        plan: identity.organization.plan,
      },
    });
  };
}

export default createLoginHandler();
