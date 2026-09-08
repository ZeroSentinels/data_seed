// Proxy hacia mp-api (ver docs/architecture/publica-buscador.md).
// Mismo patron que api/demo-chat.js: la llave vive en process.env, nunca en el
// HTML publico. mp-api ya valida y acota todo (limite maximo 50, techo de
// tiempo, solo lectura sobre el almacen); esta funcion no reimplementa esas
// reglas, solo evita que un cliente llame directo con una llave que no tiene.
//
// Requiere sesión válida de Pública (__Host-pub_*): sin esto, cualquiera
// podría llamar este endpoint directo y consumir la cuota pagada de mp-api
// sin pasar por /publica-login. Es la protección real, más importante que
// gatear la página en sí (ver api/publica-buscador.js).
import { AuthorizationError } from './auth/_lib/authorization.js';
import { authenticatePublicaRequest } from './auth/_lib/publica-session.js';

const UPSTREAM_URL = 'https://api.dataseed.cl/api/buscar';
const TIMEOUT_MS = 15000;

export const config = { runtime: 'nodejs', maxDuration: 20 };

export function createBuscarHandler({
  env = process.env,
  authenticate = authenticatePublicaRequest,
  fetchImpl = globalThis.fetch,
} = {}) {
  return async function buscarHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
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

    const cuerpo = req.body;
    if (!cuerpo || typeof cuerpo !== 'object') {
      return res.status(400).json({ error: 'Cuerpo invalido.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const upstream = await fetchImpl(UPSTREAM_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuerpo),
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

export default createBuscarHandler();
