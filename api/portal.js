import { AuthorizationError } from './auth/_lib/authorization.js';
import { clearSessionCookies } from './auth/_lib/cookies.js';
import { authenticateRequest } from './auth/_lib/session.js';

export const config = { runtime: 'nodejs' };

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}

function portalHtml(identity) {
  const name = escapeHtml(identity.profile.full_name || identity.user.email);
  const email = escapeHtml(identity.user.email);
  const organization = escapeHtml(identity.organization.name);
  const plan = escapeHtml(identity.organization.plan);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <title>${organization} — Portal DataSeed</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/site/portal.css">
  <script src="/site/portal.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Saltar al contenido</a>
  <div class="portal-shell">
    <header class="portal-header">
      <a class="portal-brand" href="/site/index.html" aria-label="DataSeed, ir al sitio principal">
        <img src="/site/assets/dataseed_logo_black.png" alt="" width="40" height="40">
        <span><strong>DataSeed</strong><small>Portal de clientes</small></span>
      </a>
      <div class="portal-user">
        <span class="portal-identity"><strong>${name}</strong><small>${email}</small></span>
        <button class="logout-button" type="button" data-auth-action="logout">Cerrar sesión</button>
      </div>
    </header>
    <main id="main" class="portal-main">
      <section class="portal-welcome" aria-labelledby="portal-title">
        <p class="portal-status"><span aria-hidden="true"></span> Entorno privado verificado</p>
        <h1 id="portal-title">${organization}</h1>
        <p>Este espacio está aislado y autorizado para tu organización. Los módulos se habilitarán según el plan contratado.</p>
        <span class="plan-badge">Plan ${plan}</span>
      </section>
      <section class="module-grid" aria-label="Módulos del portal">
        <article><span>01</span><h2>Datos y reportes</h2><p>Indicadores, entregables y fuentes aprobadas para la organización.</p><strong>Próximamente</strong></article>
        <article><span>02</span><h2>Agentes y conversaciones</h2><p>Automatizaciones y trazabilidad del trabajo asistido por IA.</p><strong>Próximamente</strong></article>
        <article><span>03</span><h2>Archivos y conectores</h2><p>Integraciones y recursos privados administrados por DataSeed.</p><strong>Próximamente</strong></article>
      </section>
      <p id="portal-message" class="portal-message" role="status" aria-live="polite"></p>
    </main>
  </div>
</body>
</html>`;
}

export function createPortalHandler({
  authenticate = authenticateRequest,
  clearCookies = clearSessionCookies,
  env = process.env,
} = {}) {
  return async function portalHandler(req, res) {
    setSecurityHeaders(res);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).end('Método no permitido.');
    }

    try {
      const session = await authenticate(req, { env });
      if (session.setCookies) res.setHeader('Set-Cookie', session.setCookies);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(portalHtml(session.identity));
    } catch (error) {
      res.setHeader('Set-Cookie', clearCookies());
      if (error instanceof AuthorizationError || error?.status === 401 || error?.status === 403) {
        res.setHeader('Location', '/site/login.html?reason=session');
        return res.status(303).end();
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(503).send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Portal no disponible</title><body><main><h1>Portal temporalmente no disponible</h1><p>Intenta nuevamente en unos minutos.</p><a href="/site/login.html">Volver al acceso</a></main></body></html>');
    }
  };
}

export default createPortalHandler();
