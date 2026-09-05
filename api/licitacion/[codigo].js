// Proxy hacia mp-api. El formato de codigo lo valida mp-api (400 si no calza);
// aca solo se evita reenviar algo vacio.
const UPSTREAM_BASE = 'https://api.dataseed.cl/api/licitacion';
const TIMEOUT_MS = 15000;

export const config = { runtime: 'nodejs', maxDuration: 20 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo no permitido.' });
  }

  const apiKey = process.env.MP_API_KEY;
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
    const upstream = await fetch(`${UPSTREAM_BASE}/${encodeURIComponent(codigo)}`, {
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
}
