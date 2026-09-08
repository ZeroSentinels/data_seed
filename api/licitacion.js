// Proxy hacia mp-api. El formato de codigo lo valida mp-api (400 si no calza);
// aca solo se evita reenviar algo vacio. Requiere sesión de Pública, mismo
// motivo que api/buscar.js.
//
// Archivo plano (no api/licitacion/[codigo].js): la ruta dinámica de Vercel
// por corchetes ya falló una vez en este proyecto para
// api/auth/publica/[...action].js (todas las rutas devolvían 404 propio en
// producción — ver docs/operations/coordinacion-agentes.md). Se usa el mismo
// mecanismo probado que /api/auth/publica/*: un rewrite explícito en
// vercel.json ("/api/licitacion/(.*)" -> "/api/licitacion?codigo=$1") con un
// query param plano.
import { AuthorizationError } from './auth/_lib/authorization.js';
import { authenticatePublicaRequest } from './auth/_lib/publica-session.js';

const UPSTREAM_BASE = 'https://api.dataseed.cl/api/licitacion';
const TIMEOUT_MS = 15000;

export const config = { runtime: 'nodejs', maxDuration: 20 };

export function createLicitacionHandler({
  env = process.env,
  authenticate = authenticatePublicaRequest,
  fetchImpl = globalThis.fetch,
} = {}) {
  return async function licitacionHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Metodo no permitido.' });
    }

    try {
      const session = await authenticate(req, { env });
      if (session.setCookies) res.setHeader('Set-Cookie', session.setCookies);
    } catch (error) {
      const status = error instanceof AuthorizationError ? error.status : 401;
      return res.status(status).json({ error: 'Inicia sesión para usar el buscador.' });
    }

    const apiKey = env.MP_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'El buscador no esta disponible en este momento.' });
    }

    const codigo = req.query?.codigo;
    if (!codigo || typeof codigo !== 'string') {
      return res.status(400).json({ error: 'Codigo requerido.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const upstream = await fetchImpl(`${UPSTREAM_BASE}/${encodeURIComponent(codigo)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });

      const texto = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json');
      return res.send(texto);
    } catch (_error) {
      return res.status(503).json({ error: 'El buscador no responde en este momento.' });
    } finally {
      clearTimeout(timeout);
    }
  };
}

export default createLicitacionHandler();
