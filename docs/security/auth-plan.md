# Plan de autenticación DataSeed

## Estado

Implementado en la rama `feat/secure-multitenant-auth`. La activación productiva requiere configurar Supabase y aplicar la migración incluida antes de promover a `main`.

## Arquitectura

- Supabase Auth se consume exclusivamente desde Vercel Functions.
- Access token, refresh token y preferencia “Recordarme” se almacenan en cookies `__Host-*` con `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` y sin `Domain`.
- El frontend nunca recibe tokens ni selecciona una organización.
- El backend valida la sesión, el perfil activo, la membresía activa y la organización activa.
- V1 es invite-only y exige exactamente una organización activa por usuario. Cero o múltiples membresías fallan cerradas.
- `/portal` se renderiza en servidor y redirige a `/site/login.html` cuando la sesión no es válida.

## Aislamiento multi-tenant

La migración `supabase/migrations/20260723_secure_multitenant_auth.sql` crea o actualiza:

- `profiles`
- `organizations`
- `user_organizations`
- `reports`
- `agents`
- `conversations`
- `files`
- `connectors`
- `organization_settings`
- `audit_log`

RLS está habilitado y forzado en todas las tablas privadas. Las lecturas se limitan a la organización derivada de `auth.uid()`. El rol `authenticated` no puede cambiar roles, estados, membresías, `organization_id` ni escribir auditoría. El alta y la asignación de clientes deben ejecutarse por un canal administrativo seguro.

## Variables de entorno

Configurar en Vercel Preview y Production:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_ORIGIN=https://dataseed.cl`

No exponer `SUPABASE_SERVICE_ROLE_KEY` al frontend. El flujo de acceso implementado no la necesita.

## Activación

1. Aplicar la migración en el proyecto Supabase real.
2. Configurar Email/Password, confirmación de correo, SMTP y límites de Supabase Auth.
3. Crear organizaciones y usuarios por invitación.
4. Activar cada perfil y asociarlo a exactamente una organización.
5. Probar con dos organizaciones reales que A no puede consultar recursos de B y viceversa.
6. Configurar las variables de Vercel y validar login, refresh, recuperación, portal y logout en Preview.
7. Promover a `main` solo con aprobación y evidencia productiva.

## Verificación automatizada

`npm run check` valida sintaxis, UI, cookies, sesión, recuperación, logout, acceso directo, escape de HTML, aislamiento backend, RLS, rutas Vercel y referencias estáticas.
