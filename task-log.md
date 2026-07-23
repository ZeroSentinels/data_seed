# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-07-23 07:54:42 -04 — Botón de acceso en header de la landing

**Estado:** ✅ Finalizada exitosamente

**Solicitud:** Agregar en el header de la landing de DataSeed un botón de login con jerarquía visual de SaaS, realizar commit y push.

**Qué se hizo:** Se reemplazó el acceso inline por un botón secundario «Iniciar sesión» ubicado antes del CTA «Reservar diagnóstico». Se agregaron estados hover/focus, soporte dark/light, objetivos táctiles de 44 px y etiquetas compactas responsive. El enlace utiliza `/login.html`, ruta existente en la rama de autenticación Supabase.

**Verificación:** Revisión visual aprobada en escritorio y 375 px; navegación sin solapamiento a 901 px; `site/index.html` y `login.html` respondieron HTTP 200; validación estructural, `git diff --check`, escaneo estático e independiente sin fallos. Cambio pusheado en `feat/header-login-saas` con commit `488430b`.

## 2026-07-23 08:17 -04 — Localizar dashboard de Demeter/DataSeed
- Estado: completado.
- Solicitud: buscar en el repositorio y validar con el grafo de conocimiento la ubicación del dashboard creado para Demeter.
- Hallazgo: rama `internal-agent-console`; entrada `console.html`; lógica en `components/console/app.js` (`renderOpsDashboard`); estilos en `components/console/console.css`; inventario en `components/console/generated/ops-inventory.json`; API en `api/demeter-chat.js`.
- Verificación: Graphify relacionó `demeter` con `renderOpsDashboard`; `npm run check` pasó; vista local cargó sin errores JS; preview Vercel respondió HTTP 200. No está en `main` y `https://dataseed.cl/console.html` respondió 404.
- Aviso: el preview de la rama es público, tiene bypass de auth y expone metadatos operativos; no se modificó ni publicó producto.

## 2026-07-23 08:33:08 -04 — Publicar acceso de landing en main

**Estado:** ✅ Finalizada exitosamente

**Solicitud:** Llevar a `main` y a `dataseed.cl` el botón de acceso visible en el preview de la rama.

**Qué se hizo:** Se descartó el merge completo de la rama de autenticación al detectar vulnerabilidades críticas de RLS y aislamiento. Se publicó en `main` únicamente el header validado y una página provisional segura en `site/login.html`, sin scripts, formularios ni autenticación simulada. También se actualizó el grafo multibranch.

**Verificación:** Dos validaciones técnicas con 0 fallos; revisión independiente aprobada; header sin recortes en 320/375/901/1101 px; grafo deduplicado de 12 ramas, 100% extraído y 0% ambiguo. `main` quedó en `3c55dc2`. Vercel sirvió `site/index.html` y `site/login.html` con HTTP 200, y sus hashes SHA-256 coincidieron exactamente con los archivos versionados.

## 2026-07-23 09:04:50 -04 — Login real multi-tenant para clientes

**Estado:** ⏳ A la espera de autorización y decisiones de arquitectura

**Solicitud:** Implementar el flujo completo de login, sesión segura, rutas privadas y aislamiento multi-tenant, usando Codex para inspección, modificación y validación.

**Hallazgos:** `main` es un sitio estático con una única función pública de demo; no existe backend de sesiones, proveedor auth configurado ni portal privado. El proyecto Vercel no tiene variables Supabase/Postgres/Auth en Production o Preview. La rama histórica Supabase usa sesiones persistidas en navegador y contiene políticas RLS con escalamiento de rol, escritura de auditoría y movimientos cross-tenant, por lo que no puede promoverse.

**Bloqueos:** Codex CLI quedó instalado en `/opt/data/.local/bin/codex`, pero no está autenticado y devolvió HTTP 401. Se requiere autenticarlo y confirmar/proveer un proyecto Supabase real, variables de Vercel y un usuario/organización de prueba. También se debe confirmar V1 invite-only con exactamente una organización activa por usuario.

**Plan:** Guardado en `.hermes/plans/2026-07-23_090450-secure-multitenant-auth.md` dentro de la rama local `feat/secure-multitenant-auth`. No se modificó código de producción.