# Esquema de autenticación — DataSeed Portal

## Qué hay acá

- `migrations/20260723_secure_multitenant_auth.sql` — migración V1. Crea las 10
  tablas del portal, activa y **fuerza** RLS, define las policies de lectura por
  membresía y revoca los grants amplios de `anon`/`authenticated`. Corre entera
  dentro de `begin;`/`commit;`: si algo falla, revierte completa.
- `preflight/bloque_a.sql` y `preflight/bloque_a_bis.sql` — **solo lectura**.
  Inventarían el estado real de la base antes de aplicar. Devuelven una sola
  celda JSON para poder copiarlas desde el panel del SQL Editor.

## Nada de esto se aplica solo

No hay CI ni paso de despliegue que ejecute SQL. Vercel publica el sitio y las
funciones; **no toca la base**. Mergear este PR deja el archivo versionado, no
crea una sola tabla. Alguien tiene que ejecutar la migración contra el proyecto
Supabase con un rol propietario.

## Orden de aplicación

1. Correr `preflight/bloque_a.sql` y `preflight/bloque_a_bis.sql`, y leer los
   resultados. En particular: cuántas filas hay en `profiles`.
2. **Advertencia medida:** la migración agrega
   `profiles.is_active boolean not null default false`. Toda fila preexistente de
   `profiles` queda **desactivada**, y `api/auth/_lib/authorization.js` responde
   403 a un perfil inactivo. Si ya hay perfiles en uso, hay que reactivarlos
   después de aplicar.
3. Aplicar `migrations/20260723_secure_multitenant_auth.sql`.
4. Crear la organización y activar el primer perfil. V1 es **invite-only**: el
   trigger `handle_new_user` crea los perfiles con `is_active = false` a
   propósito, y `authorization.js` exige *exactamente una* membresía activa
   (0 → 403 `membership_required`, >1 → 409). Un auto-registro se autentica y no
   entra. Es el diseño, no un bug.
