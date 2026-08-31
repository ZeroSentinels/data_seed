# Agent readiness — auditoría y cambios pasivos (2026-08-30)

**Alcance:** mejoras pasivas de descubrimiento y comprensión de contenido público (canonical, redirects de duplicados, metadatos, `Content-Signal`). No se modificó autenticación, RLS, CORS, CSP existente, DNS ni producción. No se hizo push ni deploy.

## Implementado

- `vercel.json`: redirects permanentes (308) de `/`, `/index.html`, `/site` y `/site/` hacia la canónica confirmada `/site/index.html`. Verificado en producción (solo lectura) que `/site/` servía el mismo contenido que `/site/index.html` (mismo ETag) sin redirigir — duplicado real, ahora resuelto.
- `vercel.json`: header `Content-Signal: ai-train=no, search=yes, ai-input=yes` agregado explícitamente sobre `/site/index.html`, sin depender solo de la directiva ya presente en `robots.txt`.
- `site/index.html`: corregido `<link rel="icon">` roto (`favicon.ico` no existía, 404 verificado) para apuntar al logo real ya publicado (`assets/dataseed_logo_black.png`).
- `site/index.html`: agregadas `twitter:title`, `twitter:description`, `twitter:image` (antes solo existía `twitter:card`), usando los mismos textos/imagen ya verificados en Open Graph.
- `tests/deployment/topology.test.js`: actualizado para reflejar los nuevos redirects intencionales, preservando la verificación de que no se shadowea `/portal`, `/api/*` ni los headers de seguridad existentes.

## No modificado (ya cumplía el objetivo, riesgo de tocarlo innecesariamente)

- `robots.txt`: reglas por bot ya afinadas (incluye `Content-Signal`, bloqueo de `GPTBot`/`ClaudeBot`/`Google-Extended` para entrenamiento, permiso a `Claude-User`/`Claude-SearchBot`/`OAI-SearchBot`/`ChatGPT-User` para búsqueda/asistencia). No se alteró.
- `sitemap.xml`: ya lista únicamente la URL canónica pública. No se cambió el valor canónico (ver decisión de canonical abajo).
- `llms.txt`: ya cubre servicios públicos, contacto y restricciones equivalentes al formato sugerido. No se reescribió para evitar churn sin beneficio real.
- JSON-LD (`Organization` + `WebSite`): ya usa solo datos públicos verificables. No se agregaron `sameAs`, teléfono, ratings ni reviews por no estar verificados.
- CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, cookies `__Host-*` (verificadas `HttpOnly`, `Secure`, `SameSite=Lax` en producción): sin cambios.

## Decisión de canonical

Se mantiene `https://dataseed.cl/site/index.html` como URL canónica (no `https://dataseed.cl/`), siguiendo la decisión ya documentada en `AGENTS.md`: *"La landing activa vive en `site/index.html`; el `index.html` raíz solo mantiene compatibilidad de acceso."* Mover el contenido real a `/` requeriría reestructurar la landing y contradice esa decisión explícita del equipo — no se hizo sin autorización expresa.

## Pendiente de configuración externa

- **Markdown for Agents (Cloudflare):** no implementable actualmente. Las consultas DNS públicas muestran nameservers `ns1/ns2.vercel-dns.com` — el sitio no está detrás de Cloudflare. `llms.txt` se mantiene como alternativa segura ya publicada. Si en el futuro se migra el dominio a Cloudflare, regla conceptual limitada a la página pública:
  ```
  http.host eq "dataseed.cl"
  and http.request.method in {"GET" "HEAD"}
  and http.request.uri.path eq "/site/index.html"
  ```
  No ejecutar contra la API de Cloudflare ni aplicar sin aprobación expresa.

## No implementado por seguridad (fuera de alcance deliberadamente)

API Catalog, OpenAPI público nuevo, OAuth/OIDC discovery, OAuth Protected Resource Metadata, `auth.md`, MCP Server / MCP Server Card, Agent Skills, ARD, `ai-catalog.json`, WebMCP, DNS-AID (ver `docs/security/dnsaid-readiness.md`, decisión previa vigente), DNSSEC, TLSA, nuevos SVCB/HTTPS records. Ninguno de estos tiene una capacidad pública real y auditada detrás; publicarlos sería anunciar mecanismos ficticios.

## Riesgos o decisiones pendientes (no asumidas)

- `site/tablero-construccion.html` existe en `site/` pero no está enlazado desde la landing (`site/index.html`), ni desde `robots.txt` ni `sitemap.xml` — su carácter público/privado es ambiguo. Se dejó **fuera** del sitemap y sin modificar, tratándolo como no confirmado como público hasta que se indique lo contrario.
- La página pública principal (`/site/index.html`) no tiene `Content-Security-Policy` propia (a diferencia de `login.html`/`portal`/`api/auth/*`). El 2026-08-30 se agregaron `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` sobre esta ruta (sin riesgo, no dependen de scripts/estilos). El `Content-Security-Policy` queda **pendiente a propósito**: la página tiene ~33 atributos `style="..."` inline, ~8 bloques `<script>` inline (incluido el módulo que carga el widget de chat n8n vía `cdn.jsdelivr.net`) y varios `onclick="..."` en botones de la demo. Un CSP estricto sin `unsafe-inline` (requisito de este proyecto) exige primero extraer esos estilos/scripts a archivos externos (`site/index.css`, `site/index.js`) y reemplazar los `onclick` por listeners — un refactor real, no un header suelto, que además no se pudo verificar visualmente en un navegador desde este entorno. Decisión explícita del cliente (2026-08-30): no ejecutar ese refactor todavía: queda para una tarea aparte que se pueda probar en preview antes de mergear.

## Cambios de pulido "world class" (2026-08-30, sesión 2)

- **Ícono liviano y legible:** se recortó el ícono (cabeza + red neuronal) del logo original, se hizo transparente el fondo (antes era un cuadrado negro sólido, se veía mal en tema claro) y se guardó como `site/assets/dataseed-icon.png` (16 KB). Se generó `site/favicon.ico` multi-resolución (16/32/48px) a partir de ese recorte. Nav, footer y login ahora usan este ícono liviano (antes cargaban el logo completo de 367 KB, incluido en el `<link rel="preload" fetchpriority="high">` que afecta LCP). El logo completo (`dataseed_logo_black.png`, con texto "DATASEED / DATA DRIVEN") **no se modificó**: sigue siendo el usado en `og:image`, `twitter:image`, JSON-LD y en el portal privado (`api/portal.js`), donde corresponde mostrar el lockup completo.
- **Dashboard demo etiquetado como ilustrativo:** el mockup de "Cómo funciona" decía "Dashboard Ejecutivo — Dataseed" con métricas ($4.2M revenue, etc.) sin aclarar que eran de ejemplo. Se cambió a "Dashboard Ejecutivo — Ejemplo ilustrativo (Minería)" y "Datos de demostración, no reales", sin tocar layout ni cifras.
- **Nota de incidente:** un script de Python usado para recortar el ícono sobrescribió por error el archivo original `dataseed_logo_black.png` durante esta sesión. Se detectó por `git status` antes de commitear y se restauró con `git checkout -- site/assets/dataseed_logo_black.png` (byte-idéntico al original, verificado). No llegó a commitearse ni pushearse en el estado incorrecto.

## Validación ejecutada

- `node -e "JSON.parse(...)"` sobre `vercel.json`: válido.
- `npm run check` (`node --check site/login.js && node --check site/portal.js && node --test`): **63/63 tests OK** (se actualizó `tests/deployment/topology.test.js` para reflejar los nuevos redirects intencionales).
- Lecturas de solo lectura contra producción (`curl -I`/`curl -D -`) confirmando: `/` → 200 (antes de este cambio, wrapper JS), `/site/index.html` → 200, `/site/` → 200 con el mismo ETag que `/site/index.html` (duplicado confirmado), `robots.txt`/`sitemap.xml`/`llms.txt` → 200 con `Content-Type` correcto, `/portal` sin sesión → 303 a login con limpieza de cookies, `/api/auth/session` sin sesión → 401 con limpieza de cookies, `Accept: text/markdown` sobre `/` → ignorado (confirma que Markdown for Agents no está activo). Ninguna de estas pruebas modificó producción.
- No se ejecutó deploy, push ni PR. Los cambios quedan en el working tree local para revisión.
