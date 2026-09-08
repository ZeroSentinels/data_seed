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
// función serverless): lo despacha api/auth/publica-router.js.
import { buildSessionCookies } from '../publica-cookies.js';
import { AuthorizationError, resolveIdentity } from '../authorization.js';
import { ensureOrganizationForUser, ProvisioningError } from '../publica-provisioning.js';
import {
  getHeader,
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

// Cuota horaria del SMTP integrado de Supabase, en segundos. Es el techo que se
// informa cuando el 429 no trae un plazo propio.
const EMAIL_QUOTA_WINDOW_SECONDS = 3600;

// Supabase distingue dos 429 en /signup y hay que tratarlos distinto porque el
// plazo difiere en dos órdenes de magnitud:
//
//   "For security purposes, you can only request this after 57 seconds."
//       -> cooldown corto entre envíos; esperar y reintentar sí funciona.
//   "email rate limit exceeded"
//       -> cuota de la ventana horaria agotada; reintentar antes no sirve.
//
// Solo el primero declara el plazo, así que el segundo se informa con la
// ventana completa. Se acota a [1, 3600] para no emitir un Retry-After absurdo
// si el texto del proveedor cambia.
function parseRetryAfterSeconds(message) {
  const match = /after (\d+) seconds?/i.exec(String(message || ''));
  if (!match) return EMAIL_QUOTA_WINDOW_SECONDS;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds < 1) return EMAIL_QUOTA_WINDOW_SECONDS;
  return Math.min(seconds, EMAIL_QUOTA_WINDOW_SECONDS);
}

// "Tu cuenta no se creó" es literal, no un consuelo: cuando /signup responde
// 429 no llega a insertar en auth.users. Sin decirlo, el usuario no sabe si
// tiene que registrarse de nuevo o intentar iniciar sesión.
function rateLimitMessage(retryAfter) {
  if (retryAfter < 120) {
    return `Espera ${retryAfter} segundos antes de volver a intentarlo. Tu cuenta no se creó.`;
  }
  const minutes = Math.ceil(retryAfter / 60);
  return `Alcanzamos el límite de correos de confirmación. Tu cuenta no se creó: vuelve a intentarlo en ${minutes} minutos.`;
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

    // Si Supabase exige confirmar el correo, el link del mail vuelve acá en
    // vez de a la Site URL genérica (la home de dataseed.cl) — sin esto, el
    // usuario confirma pero queda en la home sin ninguna indicación de que
    // ya puede iniciar sesión en Pública.
    const origin = String(env.APP_ORIGIN || getHeader(req, 'origin') || '').replace(/\/$/, '');
    const redirectTo = `${origin}/publica-login?confirmado=1`;

    let signUpResult;
    try {
      // `empresa` viaja como user_metadata para que, si el correo requiere
      // confirmación (sin access_token todavía), el login posterior pueda
      // usarla como nombre de la organización al aprovisionar.
      signUpResult = await signUp({ email, password, data: { empresa }, redirect_to: redirectTo }, { env });
    } catch (error) {
      // El 429 tiene que ir ANTES del genérico: Supabase limita los correos de
      // confirmación y sin este caso el error caía al 503 "Intenta nuevamente",
      // que es el peor consejo posible — reintentar no libera la cuota. Medido
      // en producción el 2026-09-08: el SMTP integrado permite 2 correos por
      // hora, y los auth_logs muestran 15 reintentos seguidos entre 11:58 y
      // 12:01 UTC, todos 429, porque el mensaje pedía justamente reintentar.
      if (error instanceof SupabaseRequestError && error.status === 429) {
        const retryAfter = parseRetryAfterSeconds(error.message);
        res.setHeader('Retry-After', String(retryAfter));
        return sendJson(res, 429, {
          ok: false,
          rateLimited: true,
          retryAfter,
          error: rateLimitMessage(retryAfter),
        });
      }
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

    // Supabase no devuelve error si el correo ya tiene una cuenta confirmada
    // (a propósito, para no filtrar qué correos están registrados a quien no
    // tiene la contraseña): responde 200 igual, pero con `identities: []` en
    // vez de la identidad nueva. Sin este chequeo, el usuario ve "revisa tu
    // correo" y espera un mail que nunca llega, porque no hay nada que
    // confirmar de nuevo.
    if (Array.isArray(signUpResult.user?.identities) && signUpResult.user.identities.length === 0) {
      return sendJson(res, 409, {
        ok: false,
        accountExists: true,
        error: 'Ya existe una cuenta con este correo. Inicia sesión en su lugar.',
      });
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

export default createPublicaSignupHandler();
