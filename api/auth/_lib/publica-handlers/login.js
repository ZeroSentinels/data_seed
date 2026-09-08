// Login por email/password para Pública. Mismo proyecto Supabase que
// api/auth/login.js, pero sesión completamente independiente: cookies
// __Host-pub_* propias (ver ../publica-cookies.js), nunca las
// __Host-ds_* del portal general. No modifica api/auth/login.js.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica-router.js.
import { buildSessionCookies } from '../publica-cookies.js';
import { AuthorizationError, resolveIdentity } from '../authorization.js';
import { ensureOrganizationForUser, ProvisioningError } from '../publica-provisioning.js';
import {
  isSameOriginRequest,
  methodNotAllowed,
  normalizeEmail,
  parseRequestBody,
  sendJson,
} from '../http.js';
import {
  SupabaseRequestError,
  signInWithPassword,
  signOut,
} from '../supabase.js';

export function createPublicaLoginHandler({
  env = process.env,
  signIn = signInWithPassword,
  provision = ensureOrganizationForUser,
  resolve = resolveIdentity,
  revoke = signOut,
  buildCookies = buildSessionCookies,
} = {}) {
  return async function publicaLoginHandler(req, res) {
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

    // Idempotente: si el signup quedó pendiente de confirmar correo, acá
    // nunca se llegó a aprovisionar (no había access_token disponible
    // todavía). Si ya estaba aprovisionado, esto solo confirma que existe y
    // no crea nada nuevo.
    const empresa = session.user?.user_metadata?.empresa || null;
    try {
      await provision({ accessToken: session.access_token, empresa }, { env });
    } catch (error) {
      try {
        await revoke(session.access_token, { env });
      } catch {
        // El navegador nunca recibe esta sesión fallida.
      }
      const provisioningError = error instanceof ProvisioningError;
      return sendJson(res, provisioningError ? 502 : 503, {
        error: 'No pudimos preparar tu organización. Contacta a soporte.',
      });
    }

    let identity;
    try {
      identity = await resolve(session.access_token, { providerOptions: { env } });
    } catch (error) {
      try {
        await revoke(session.access_token, { env });
      } catch {
        // El navegador nunca recibe esta sesión fallida.
      }
      if (error instanceof AuthorizationError) {
        return sendJson(res, error.status, {
          error: 'Tu cuenta no tiene un entorno habilitado en Pública. Contacta a soporte.',
        });
      }
      return sendJson(res, 503, { error: 'No pudimos validar tu entorno. Intenta nuevamente.' });
    }

    const cookies = buildCookies(session, { remember: body?.remember === true });
    res.setHeader('Set-Cookie', cookies);
    return sendJson(res, 200, {
      ok: true,
      redirectTo: '/publica-buscador',
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

export default createPublicaLoginHandler();
