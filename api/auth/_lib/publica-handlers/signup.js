// Signup self-serve para Pública (email/password). Regla de negocio
// confirmada: si es la primera vez, se le crea automáticamente su propia
// organización con plan 'free' (ver ../publica-provisioning.js).
//
// Si el proyecto de Supabase exige confirmar el correo (config del propio
// proyecto, no de este código), Supabase no devuelve sesión todavía: se
// aprovisiona la organización igual, para que quede lista apenas confirme,
// y se responde pidiendo revisar el correo, sin dejarlo con sesión activa.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica/[...action].js.
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
import { SupabaseRequestError, signUpWithPassword } from '../supabase.js';

function normalizeEmpresa(value) {
  const empresa = String(value || '').trim();
  return empresa ? empresa.slice(0, 200) : '';
}

export function createPublicaSignupHandler({
  env = process.env,
  signUp = signUpWithPassword,
  provision = ensureOrganizationForUser,
  resolve = resolveIdentity,
  buildCookies = buildSessionCookies,
} = {}) {
  return async function publicaSignupHandler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!isSameOriginRequest(req, env)) {
      return sendJson(res, 403, { error: 'Solicitud no autorizada.' });
    }

    const body = parseRequestBody(req);
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';
    const empresa = normalizeEmpresa(body?.empresa);
    if (!email || !password || password.length < 8 || password.length > 1024) {
      return sendJson(res, 400, {
        error: 'Completa correctamente el correo y una contraseña de al menos 8 caracteres.',
      });
    }
    if (!empresa) {
      return sendJson(res, 400, { error: 'Indica el nombre de tu empresa.' });
    }

    let signUpResult;
    try {
      // `empresa` viaja como user_metadata para que, si el correo requiere
      // confirmación (sin access_token todavía), el login posterior pueda
      // usarla como nombre de la organización al aprovisionar.
      signUpResult = await signUp({ email, password, data: { empresa } }, { env });
    } catch (error) {
      if (error instanceof SupabaseRequestError && error.status === 400) {
        return sendJson(res, 400, {
          error: error.message || 'No pudimos crear tu cuenta. Revisa los datos ingresados.',
        });
      }
      return sendJson(res, 503, { error: 'No pudimos procesar el registro. Intenta nuevamente.' });
    }

    const userId = signUpResult?.user?.id || signUpResult?.id;
    if (!userId) {
      return sendJson(res, 503, { error: 'No pudimos crear tu cuenta. Intenta nuevamente.' });
    }

    // Sin access_token (correo pendiente de confirmar) no hay con qué llamar
    // a la función de aprovisionamiento: necesita el JWT del propio usuario,
    // no admite una clave de privilegios elevados. Queda pendiente para el
    // primer login exitoso (ver ./login.js), que reintenta esto mismo de
    // forma idempotente.
    if (!signUpResult.access_token) {
      return sendJson(res, 200, {
        ok: true,
        pendingConfirmation: true,
        message: 'Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
      });
    }

    try {
      await provision({ accessToken: signUpResult.access_token, empresa }, { env });
    } catch (error) {
      const provisioningError = error instanceof ProvisioningError;
      return sendJson(res, provisioningError ? 502 : 503, {
        ok: false,
        error: 'Creamos tu usuario, pero no pudimos preparar tu organización. Contacta a soporte.',
      });
    }

    let identity;
    try {
      identity = await resolve(signUpResult.access_token, { providerOptions: { env } });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return sendJson(res, 200, {
          ok: true,
          pendingConfirmation: true,
          message: 'Tu cuenta se creó. Confirma tu correo para poder iniciar sesión.',
        });
      }
      return sendJson(res, 503, { error: 'No pudimos validar tu entorno. Intenta nuevamente.' });
    }

    const cookies = buildCookies(signUpResult, { remember: true });
    res.setHeader('Set-Cookie', cookies);
    return sendJson(res, 200, {
      ok: true,
      redirectTo: '/publica',
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

export default createPublicaSignupHandler();
