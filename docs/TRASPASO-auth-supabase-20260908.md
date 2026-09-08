# Traspaso — login de dataseed.cl sobre Supabase

Estado al **2026-09-08**. Escrito para que otra sesión (u otra cuenta) retome sin
releer nada más. Todo lo que dice "medido" se comprobó ejecutando, no razonando.

## El bloqueo, en una línea

`public.profiles` **no tiene la columna `is_active`**, y
[`api/auth/_lib/authorization.js:48`](../api/auth/_lib/authorization.js) exige
`profile.is_active === true`. Ningún login puede pasar aunque la credencial sea
correcta. Faltan además 6 de las 10 tablas del portal.

**No es un problema de Vercel.** Las variables de entorno están bien puestas: si
faltaran, `/api/auth/login` daría 503 y da 401. Vercel no tiene base de datos y no
ejecuta SQL. Tampoco hay CI que lo haga — `main` no tiene ningún workflow.

## Superficie de producción, medida el 2026-09-08

| Prueba | Resultado |
|---|---|
| `GET https://dataseed.cl/login` | 307 |
| `GET /api/auth/session` | 401 JSON |
| `POST /api/auth/login` **sin** cabecera `Origin` | **403** "Solicitud no autorizada." |
| `POST /api/auth/login` **con** `Origin: https://dataseed.cl` | 401 "No pudimos iniciar sesión." |

El 403 **no es una regresión**: `api/auth/login.js:28` valida same-origin. Un
`curl` sin `Origin` siempre da 403. Al medir, mandar la cabecera o se diagnostica
un bug inexistente.

## Estado real de la base — preflight Bloque A

Proyecto Supabase (único en la cuenta): **`pgmfppykgpqpzcoswszv`**.
Ejecutado por Daniel en el SQL Editor el 2026-09-07.

- Existen **4 de 10** tablas: `profiles`, `organizations`, `user_organizations`,
  `reports`. Faltan `agents`, `conversations`, `files`, `connectors`,
  `organization_settings`, `audit_log`.
- Las 4 tienen RLS **enabled**, `force` en **off**, 2 policies cada una
  (8 en total, de una versión histórica).
- Columnas de `profiles` hoy: `id, email, full_name, role` (default `client`),
  `company_name, created_at, updated_at`. **Sin `is_active`, sin `avatar_url`.**
- `anon` tiene `DELETE, INSERT, UPDATE, TRUNCATE` sobre las 4 tablas.
- Trigger `on_auth_user_created` → `handle_new_user()`, **activo**, cuerpo
  desconocido. La V1 lo reemplaza con `drop trigger if exists`.
- Anomalía: `authenticated` **no** tiene UPDATE sobre `profiles`; `anon` **sí**.

### Lo que el Bloque A NO permite afirmar

Tres policies tienen comando `ALL` (`organizations_admin_all`,
`user_org_admin_all`, `reports_admin_all`). `ALL` cubre INSERT y DELETE. Si su
`USING` evalúa true sin sesión, `anon` podría borrar filas **hoy, desde internet**.
No está medido: falta la expresión de las policies. Es el hueco más urgente.

`rls_forzada = off` **no** es brecha por sí sola — `FORCE` solo afecta al dueño de
la tabla, no a `anon`/`authenticated`. No contarlo como hallazgo.

## Lo que ya está hecho en el repo

- **PR #27 mergeado** (`main`): `supabase/migrations/20260723_secure_multitenant_auth.sql`,
  `supabase/preflight/bloque_a.sql`, `supabase/preflight/bloque_a_bis.sql`,
  `supabase/README.md`.
- **PR #7 cerrado** por obsoleto. Su rama `feat/secure-multitenant-auth` estaba
  83 commits atrás de `main` y 1 adelante; todo su contenido salvo el esquema ya
  estaba en `main` por otra vía. Revivirlo habría reintroducido versiones de julio.
- **Parche sobre el SQL original**: se agregaron `drop policy if exists` para los 9
  nombres que la propia migración crea. Sin eso, una segunda pasada abortaba con
  `policy already exists` y, como todo va en `begin;`/`commit;`, revertía entero.
  La primera pasada siempre estuvo bien: los 8 nombres históricos presentes ya
  estaban en su bloque de drops (esto corrige una auditoría previa que decía lo
  contrario).

## Siguiente paso — Bloque A-bis, antes de aplicar nada

`supabase/preflight/bloque_a_bis.sql`. Solo lectura, devuelve **una celda** JSON.
Cierra los cuatro huecos: expresiones `USING`/`WITH CHECK` de las 8 policies,
columnas de las otras 3 tablas, **conteos de filas** y cuerpo de
`handle_new_user()`.

**Por qué antes y no después:** la V1 hace
`add column is_active boolean not null default false` sobre `profiles`. Toda fila
preexistente queda **desactivada** y `authorization.js` le responde 403. No está
medido cuántas filas hay.

## Cómo ejecutar — tres caminos, ninguno intentado todavía

Al 2026-09-08 **no hay canal a la base**: no llegó ni el MCP de Supabase
(verificado: `ToolSearch +supabase` sin resultados; `~/.claude.json` solo tiene el
servidor `21st`) ni el archivo con la cadena de conexión.

**Camino A — arnés `pg` (recomendado).** Existe y nunca se corrió con credenciales:
`…/Temp/claude/C--Users-danie-OneDrive-Documentos-Claude/80a22ad0-df99-4820-a05b-a3859fb05fe1/scratchpad/supabase-apply/run.mjs`.
Modos: `preflight` · `apply` (transaccional) · `verify` (contra el contrato de
`api/auth/_lib/supabase.js`) · `seed --email --org` · `smoke` (simula RLS con el
rol `authenticated`). Lee la cadena de `DS_PG_URL` o del archivo apuntado por
`DS_PG_URL_FILE`, y **nunca la imprime ni la escribe a disco**.

Daniel la obtiene en el dashboard → botón **`Connect`** → pestaña
**`Session pooler`** (no `Direct connection`: suele ser solo IPv6; no
`Transaction pooler`: rompe migraciones largas en una transacción). La contraseña
se resetea en `Project Settings → Database → Reset database password`.
Trato: se pega en un archivo, se usa, se borra, y **Daniel rota la contraseña**.

**Camino B — MCP de Supabase.** `claude mcp add supabase --scope user --transport http "https://mcp.supabase.com/mcp?project_ref=pgmfppykgpqpzcoswszv"`,
sesión nueva, autorizar con `/mcp`. Da `execute_sql` y `apply_migration`. Contra:
el OAuth concede acceso **a nivel de cuenta**, más superficie que la cadena de
conexión y sin rotación equivalente. La propia doc de Supabase desaconseja
apuntarlo a producción.

**Camino C — Daniel ejecuta en el SQL Editor** y Claude verifica midiendo desde
afuera. Es donde quedó trabado dos veces: el panel de resultados es chico. Por eso
los preflight devuelven una sola celda JSON. Daniel no domina la UI de Supabase —
dar instrucciones literales (qué botón, dónde queda), no asumir que sabe llegar.

## Orden completo pendiente

1. Correr `bloque_a_bis.sql` y leer el resultado.
2. Decidir qué hacer con las filas preexistentes de `profiles` (si las hay).
3. Aplicar `migrations/20260723_secure_multitenant_auth.sql`. Una sola pasada,
   rol propietario.
4. Sembrar organización + activar el primer perfil.
5. Verificar el login de punta a punta **con cabecera `Origin`**.

## Invariante de diseño que no hay que "arreglar"

V1 es **invite-only**. `handle_new_user` crea los perfiles con `is_active = false`
a propósito y `authorization.js` exige *exactamente una* membresía activa
(0 → 403 `membership_required`, >1 → 409). **Un auto-registro se autentica y no
entra: es el diseño, no un bug.** El registro público de leads va por otra vía
(hoy Formspree `xzdwykww` en `site/index.html` y `site/publica.html`).
