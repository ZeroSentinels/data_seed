# Autenticación multi-tenant segura — Plan ejecutado

## Objetivo

Convertir `site/login.html` en un login real y proteger un portal por organización, sin tokens en `localStorage` ni autorización basada en identificadores enviados por el frontend.

## Decisión

Supabase Auth mediante Vercel Functions, cookies `__Host-*` seguras y resolución server-side de una única membresía activa. La migración fuerza RLS para perfiles, organizaciones, reportes, agentes, conversaciones, archivos, conectores y configuraciones.

## Entregables

- UI DataSeed responsive con dark/light, validación y estados completos.
- Login, sesión/refresh, recuperación y logout server-side.
- Portal privado renderizado en servidor.
- Migración invite-only y multi-tenant con RLS.
- Headers/CSP y rewrite de Vercel.
- Pruebas Node reproducibles mediante `npm run check`.

## Activación pendiente de infraestructura

- Configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `APP_ORIGIN` en Vercel.
- Aplicar la migración en Supabase.
- Crear dos tenants y usuarios reales para la prueba E2E cruzada.
- Promover a `main` únicamente con aprobación.
