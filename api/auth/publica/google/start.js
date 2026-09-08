// Arranca el login con Google para Pública (flujo PKCE, sin supabase-js).
// GET porque es una navegación de nivel superior (el botón "Continuar con
// Google" es un <a>, no un fetch): el navegador va a
// https://<project>.supabase.co/auth/v1/authorize y de ahí a Google.
//
// El redirect URI que hay que registrar en Google Cloud Console es el de
// Supabase (https://<project-ref>.supabase.co/auth/v1/callback), NO esta
// URL — Supabase reenvía acá (a redirect_to) después de procesar el login.
import { randomUUID } from 'node:crypto';
import { getHeader, methodNotAllowed } from '../../_lib/http.js';
import { buildOAuthVerifierCookie } from '../../_lib/publica-cookies.js';
import { generateCodeChallenge, generateCodeVerifier } from '../../_lib/pkce.js';

export const config = { runtime: 'nodejs' };

function resolveOrigin(req, env) {
  const configured = String(env.APP_ORIGIN || '').replace(/\/$/, '');
  if (configured) return configured;
  const forwardedHost = String(getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || '')
    .split(',')[0]
    .trim();
  return forwardedHost ? `https://${forwardedHost}` : '';
}

export function createGoogleStartHandler({ env = process.env } = {}) {
  return async function googleStartHandler(req, res) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

    const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
    const origin = resolveOrigin(req, env);
    if (!supabaseUrl.startsWith('https://') || !origin) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(503).json({ error: 'El acceso con Google no está disponible en este momento.' });
    }

    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = randomUUID();

    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set('provider', 'google');
    authorizeUrl.searchParams.set('redirect_to', `${origin}/api/auth/publica/google/callback`);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 's256');
    authorizeUrl.searchParams.set('state', state);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Set-Cookie', buildOAuthVerifierCookie(verifier));
    res.writeHead(302, { Location: authorizeUrl.toString() });
    return res.end();
  };
}

export default createGoogleStartHandler();
