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

**Estado:** 🔄 En ejecución en `feat/secure-multitenant-auth`

**Solicitud:** Implementar el flujo completo de login, sesión segura, rutas privadas y aislamiento multi-tenant, manteniendo la identidad visual DataSeed y validando desktop/mobile.

**Hallazgos:** `main` es un sitio estático con una única función pública de demo; no existe backend de sesiones ni portal privado. La rama histórica Supabase persiste sesiones en navegador y contiene políticas RLS con escalamiento de rol, escritura directa de auditoría y cambios cross-tenant, por lo que no se reutilizará sin correcciones.

**Decisión técnica:** Supabase Auth desde funciones serverless Vercel; tokens solo en cookies `HttpOnly`, `Secure`, `SameSite=Lax`; V1 invite-only con exactamente una membresía activa por usuario y resolución de organización exclusivamente en backend. Cero o múltiples membresías fallan cerradas.

**Plan:** Completar por TDD login, refresh, recuperación y logout; añadir portal protegido, migración RLS segura, UI DataSeed responsive y verificación de rutas/CSP/aislamiento. Variables reales, migración aplicada y prueba E2E con dos tenants siguen siendo requisitos de activación productiva si no están disponibles en el entorno.

## 2026-07-23 11:43 -04:00 — Validar autenticación multi-tenant con Supabase de producción
- Estado: validaciones completadas; despliegue y migración no ejecutados. La migración queda a la espera de corrección y aprobación.
- Resultado: variables configuradas localmente y en Vercel (Production/Preview, tipo sensitive); suite final 63/63; login y portal verificados en desktop y 320/375/390 px; conexión real con Supabase confirmada mediante Publishable Key.
- Hallazgo bloqueante: el esquema actual ya contiene tablas históricas y la migración no completa columnas requeridas de organizations; además reemplaza trigger/funciones/policies y revoca grants. No es segura para aplicar sin preflight SQL, backup y ajuste no destructivo.
- Seguridad: escaneo de 95 archivos sin claves reales; .env ignorado; .env.example contiene solo nombres. No se usó Secret Key ni service_role.

## 2026-07-27 23:45 -04 — Habilitar login real con usuario y contraseña

- Estado: Preview funcional publicado; producción sin cambios. Creación de la cuenta a la espera del correo del usuario y del gate de migración Supabase.
- Solicitud: reemplazar la página provisional por un acceso real con usuario/correo y contraseña.
- Resultado: rama `feat/secure-multitenant-auth` publicada y PR draft abierto; Preview con formulario, APIs same-origin, cookies seguras y portal fail-closed. Suite ejecutada dos veces: 63/63 y 0 fallos; rutas, assets, desktop y 375 px verificados; Supabase Auth respondió correctamente con error genérico para credenciales inválidas.
- Bloqueo productivo: la migración actual no es segura para el esquema histórico y no se creó una cuenta sin una dirección de correo confirmada. No se aplicó SQL ni se promovió a `main`.

## 2026-07-28 00:07 -04 — Publicar login funcional en dataseed.cl

- Estado: superficie de login publicada en `main` y verificada en producción; alta de usuarios y migración Supabase continúan pendientes.
- Solicitud: hacer commit y push a `main` para que `https://dataseed.cl/site/login.html` muestre el formulario funcional.
- Resultado: PR 8 mergeado mediante squash; Vercel Production quedó READY. HTML, CSS y JavaScript respondieron 200 y sus hashes coincidieron exactamente con el commit; `/login` redirige al formulario, `/portal` sin sesión redirige al login, `/api/auth/session` devuelve 401 y credenciales ficticias reciben 401 genérico.
- Gate: 58/58 pruebas aprobadas en dos rondas, revisión independiente PASS, UI verificada entre 320 y 1280 px, CSP/cabeceras correctas, secretos ausentes y grafo multibranch sin duplicados, dangling edges ni self-loops.
- Seguridad: no se incluyó ni aplicó ninguna migración SQL. La autorización permanece fail-closed hasta corregir el esquema histórico y crear cuentas administradas. Rollback disponible en `checkpoint/pre-login-production-20260728-0001`.
