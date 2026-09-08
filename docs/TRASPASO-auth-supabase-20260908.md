# Traspaso — login de dataseed.cl sobre Supabase

Estado al **2026-09-08, 02:20 UTC**. Escrito para que otra sesión retome sin
releer nada más. Todo lo que dice "medido" se comprobó ejecutando, no razonando.

> **Actualización de esta versión:** la migración V1 **ya se aplicó**. El bloqueo
> del `is_active` está resuelto. Lo único que falta es crear el primer usuario y
> sembrar su organización. Las secciones de "cómo ejecutar" quedaron obsoletas y
> se reescribieron: hay canal (MCP de Supabase) y funciona.

## Dónde está parado esto

**Esquema aplicado.** Falta el primer usuario. Nadie puede entrar todavía porque
`auth.users` está vacío, no porque falte esquema.

## Lo que se aplicó

Migración `supabase/migrations/20260723_secure_multitenant_auth.sql` aplicada a
**`pgmfppykgpqpzcoswszv`** vía MCP (`apply_migration`), registrada en el historial
como **`20260908021750_secure_multitenant_auth_v1`**. Antes de aplicar se corrió
la migración entera en una transacción con `rollback` y se verificó que revirtió
(4 tablas → 10 dentro de la tx → 4 de nuevo al revertir).

### Antes y después, medido

| Métrica | Antes | Después |
|---|---|---|
| Tablas en `public` | 4 | **10** |
| Policies | 8 (históricas) | **10** (V1) |
| Policies que aplican a `anon` | 0 | **0** |
| Grants de tabla a `anon` | **28** | **0** |
| Tablas con `FORCE RLS` | 0 | **10** |
| Privilegios de escritura de `authenticated` | varios | **0** |
| `profiles.is_active` | ausente | presente |
| `organizations.plan` | ausente | presente |
| Avisos del linter de seguridad | 7 | **2** (ambos intencionales) |

Contrato verificado columna por columna contra `api/auth/_lib/supabase.js`: las
**13** columnas que la app selecciona existen.

### El bug que casi hizo fracasar la aplicación

La V1 declaraba `organizations.plan` dentro de un `create table if not exists`
que era **no-op** porque la tabla ya existía, y el bloque de
`alter table add column if not exists` omitía justo esa columna. Como
`_lib/supabase.js:126` selecciona `organizations(id,name,type,plan,is_active)`,
aplicar la V1 original habría arreglado el `is_active` y dejado el login roto
igual, fallando en `getMemberships` con un 400 de PostgREST → 503. Corregido en
**PR #29** antes de aplicar.

**Lección para la próxima migración sobre tablas preexistentes:** un
`create table if not exists` no agrega columnas. Toda columna nueva tiene que
repetirse en un `alter table ... add column if not exists`, o no llega nunca.

## Los dos riesgos que el traspaso anterior marcaba: ambos descartados

**1. "`anon` podría borrar filas hoy desde internet" — era falso.** Las 8 policies
históricas estaban **todas** acotadas a `{authenticated}`; ninguna aplicaba a
`anon`. Con RLS habilitado y cero policies para ese rol, PostgreSQL deniega por
defecto, así que los grants de `DELETE/INSERT/UPDATE` de `anon` eran **inertes**.
Las tres policies `ALL` exigían `current_user_role() = 'admin'`, que sin sesión es
NULL. Igual quedó todo revocado por la V1.

Residual honesto: `anon` tenía `TRUNCATE`, que **no** pasa por RLS.
`[Probable]` no explotable porque PostgREST no expone TRUNCATE por HTTP. Ya
revocado.

**2. "La migración desactiva filas preexistentes" — no había filas.**
`auth.users` = 0 y las 4 tablas = 0 filas. Nada que desactivar.

`rls_forzada = off` **no** era brecha: `FORCE` solo afecta al dueño de la tabla.

## Avisos de seguridad que quedan, y por qué se dejan

- `audit_log` con RLS y sin policy — **intencional**. Nivel INFO. Solo
  `service_role` debería escribirla; nada la lee. Hoy está vacía y nada le
  escribe: no cuenten con auditoría todavía.
- `is_org_member(uuid)` ejecutable por `authenticated` — **intencional**. La V1 lo
  otorga a propósito (`grant execute ... to authenticated`) porque las policies la
  necesitan.

Desaparecieron: los tres avisos de `SECURITY DEFINER` ejecutable por `anon`
(`current_user_role`, `handle_new_user`, `is_org_member`) y el de `search_path`
mutable en `touch_updated_at`.

## El canal para ejecutar

**MCP de Supabase, funcionando.** Da `execute_sql`, `apply_migration`,
`list_tables`, `get_advisors`, `list_migrations`. Verificado que respeta
transacciones: se probó `begin; create table …; rollback;` y la tabla no
sobrevivió.

Contra a tener presente: el OAuth concede acceso **a nivel de cuenta**, más
superficie que una cadena de conexión y sin rotación equivalente. **Conviene
desconectarlo cuando no se esté usando.**

**No tiene herramienta para crear usuarios de `auth`.** Ese paso es el único que
requiere el panel.

## Lo que falta

1. **Crear el primer usuario** en el panel (Authentication → Users → Add user).
   Requiere correo, contraseña y confirmar el correo en el alta.
2. **Sembrar la organización y activar el perfil** — vía MCP, tres sentencias:
   `insert into organizations`, `update profiles set is_active = true`,
   `insert into user_organizations`. El trigger `handle_new_user` ya creó el
   perfil con `is_active = false` al crearse el usuario.
3. **Verificar el login de punta a punta.**

### Regla al medir el login

Mandar siempre `Origin: https://dataseed.cl`. Sin esa cabecera
`api/auth/login.js:28` devuelve **403 "Solicitud no autorizada."** por la
validación same-origin, y parece una regresión que no existe.

| Prueba | Resultado esperado hoy |
|---|---|
| `GET /login` | 307 |
| `GET /api/auth/session` | 401 JSON |
| `POST /api/auth/login` sin `Origin` | 403 |
| `POST /api/auth/login` con `Origin`, credencial falsa | 401 |

Medido después de aplicar la migración: los cuatro dan lo esperado. **401, no
503** — o sea el esquema no rompió nada.

## Invariante de diseño que no hay que "arreglar"

V1 es **invite-only**. `handle_new_user` crea los perfiles con `is_active = false`
a propósito y `authorization.js` exige *exactamente una* membresía activa
(0 → 403 `membership_required`, >1 → 409). **Un auto-registro se autentica y no
entra: es el diseño, no un bug.** El registro público de leads va por otra vía
(hoy Formspree `xzdwykww` en `site/index.html` y `site/publica.html`).

## Diagnóstico de fallos

`api/auth/_lib/diagnostics.js` (PR #24, en `main`) registra cada fallo de auth en
los logs de Vercel con etapa y código, sin filtrar PII. Al depurar el primer
login, ahí se distingue `account_inactive` de `membership_required` de un error de
Supabase, en vez de un 401 opaco. Los códigos posibles están en
`api/auth/_lib/authorization.js`.

## Historial de PRs

- **#24** — diagnóstico de fallos de auth. Mergeado.
- **#27** — versiona `supabase/migrations/`, `supabase/preflight/`, README.
- **#28** — este traspaso.
- **#29** — corrige `organizations.plan` y revoca EXECUTE de dos funciones.
- **#7** — cerrado por obsoleto (83 commits atrás de `main`).
