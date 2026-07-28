export function getHeader(req, name) {
  const value = req?.headers?.[name.toLowerCase()] ?? req?.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

export function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
}

export function sendJson(res, status, payload) {
  setNoStore(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(payload);
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return sendJson(res, 405, { error: 'Método no permitido.' });
}

export function parseRequestBody(req) {
  if (req?.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req?.body === 'string' && req.body.length <= 16_384) {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

export function isSameOriginRequest(req, env = process.env) {
  const origin = getHeader(req, 'origin');
  if (!origin) return false;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const forwardedHost = String(getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const configured = String(env.APP_ORIGIN || '').replace(/\/$/, '');
  if (configured && origin === configured) return true;

  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const validProtocol = parsed.protocol === 'https:' || (local && parsed.protocol === 'http:');
  return Boolean(validProtocol && forwardedHost && parsed.host.toLowerCase() === forwardedHost);
}

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
