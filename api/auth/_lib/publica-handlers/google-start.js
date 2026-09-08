// Arranca el login con Google para Pública (flujo PKCE, sin supabase-js).
// GET porque es una navegación de nivel superior (el botón "Continuar con
// Google" es un <a>, no un fetch): el navegador va a
// https://<project>.supabase.co/auth/v1/authorize y de ahí a Google.
//
// El redirect URI que hay que registrar en Google Cloud Console es el de
// Supabase (https://<project-ref>.supabase.co/auth/v1/callback), NO esta
// URL — Supabase reenvía acá (a redirect_to) después de procesar el login.
//
// NO se manda `state`: GoTrue genera el suyo (es el id de la fila que crea en
// auth.flow_state) y lo valida al volver de Google. Mandar uno propio lo pisa,
// el /callback de Supabase falla con "OAuth state not found or expired" y,
// como el redirect_to vive dentro de ese state, cae al Site URL — la portada.
// Medido el 2026-09-08: dos intentos, dos 400 en auth_logs. La protección CSRF
// de este flujo es la cookie __Host-pub_oauth_verifier + PKCE, no el state.
//
// No es una ruta de Vercel (vive bajo _lib/, que Vercel no cuenta como
// función serverless): lo despacha api/auth/publica-router.js.
import { getHeader, methodNotAllowed } from '../http.js';
import { buildOAuthVerifierCookie } from '../publica-cookies.js';
import { generateCodeChallenge, generateCodeVerifier } from '../pkce.js';

function resolveOrigin(req, env) {
  const configured = String(env.APP_ORIGIN || '').replace(/\/$/, '');
  if (configured) return configured;
  const forwardedHost = requestHost(req);
  return forwardedHost ? `https://${forwardedHost}` : '';
}

function requestHost(req) {
  return String(getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
}

// El sitio responde igual en el apex y en www, pero el `redirect_to` sale
// siempre del APP_ORIGIN (el apex). Si arrancamos en www, la cookie del
// verifier queda en www -- `__Host-` no lleva Domain, es host-only -- y el
// callback corre en el apex, que nunca la recibe: el usuario ve "El enlace de
// Google expiró" y vuelve al login. Medido el 2026-09-08 con la cuenta de
// prueba: fallaba desde www, funcionaba desde el apex.
//
// Se resuelve rebotando al host canónico ANTES de emitir la cookie, para que
// cookie y callback vivan en el mismo host. Solo se rebota entre el apex y su
// hermano www: cualquier otro host (previews de Vercel, localhost) sigue de
// largo, para no mandar un preview a producción.
function canonicalRedirect(req, configured) {
  if (!configured) return '';
  let configuredHost;
  try {
    configuredHost = new URL(configured).host.toLowerCase();
  } catch {
    return '';
  }
  const host = requestHost(req);
  if (!host || host === configuredHost) return '';
  const isWwwSibling = host === `www.${configuredHost}` || configuredHost === `www.${host}`;
  return isWwwSibling ? `${configured}/api/auth/publica/google/start` : '';
}

export function createGoogleStartHandler({ env = process.env } = {}) {
  return async function googleStartHandler(req, res) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

    const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
    const configured = String(env.APP_ORIGIN || '').replace(/\/$/, '');

    const canonical = canonicalRedirect(req, configured);
    if (canonical) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.writeHead(302, { Location: canonical });
      return res.end();
    }

    const origin = resolveOrigin(req, env);
    if (!supabaseUrl.startsWith('https://') || !origin) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(503).json({ error: 'El acceso con Google no está disponible en este momento.' });
    }

    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set('provider', 'google');
    authorizeUrl.searchParams.set('redirect_to', `${origin}/api/auth/publica/google/callback`);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 's256');

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Set-Cookie', buildOAuthVerifierCookie(verifier));
    res.writeHead(302, { Location: authorizeUrl.toString() });
    return res.end();
  };
}

export default createGoogleStartHandler();
