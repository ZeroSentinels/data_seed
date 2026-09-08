# Traspaso — login de dataseed.cl sobre Supabase

Estado al **2026-09-08, 02:20 UTC**. Escrito para que otra sesión retome sin
releer nada más. Todo lo que dice "medido" se comprobó ejecutando, no razonando.

> **Actualización de esta versión:** la migración V1 **ya se aplicó**. El bloqueo
> del `is_active` está resuelto. Lo único que falta es crear el primer usuario y
> sembrar su organización. Las secciones de "cómo ejecutar" quedaron obsoletas y
> se reescribieron: hay canal (MCP de Supabase) y funciona.

> **Corrección del 2026-09-08, 19:05 UTC — este documento quedó desactualizado
> abajo de esta línea.** El login y el registro **funcionan en producción**:
> medido con `count(*)`, hay usuarios, perfiles y membresías reales; `auth.users`
> **no** está vacío. Lo que sigue vale como historia del esquema, no como estado.
>
> **El login con Google ya está habilitado y arreglado (PR #47).** El síntoma era
> que tras autenticar en Google el usuario caía en la portada y no en
> `/publica-buscador`. Causa medida: `google-start.js` mandaba un `state` propio
> al `/authorize` de Supabase y **pisaba el de GoTrue, que es el `id` de la fila
> que crea en `auth.flow_state`**. El `/callback` de Supabase no encontraba esa
> fila (`400: OAuth state not found or expired`, 18:45:52 y 18:46:21 en
> `auth_logs`) y, como el `redirect_to` viaja dentro del state, caía al Site URL.
> Arreglo: borrar el parámetro. Verificado en producción — el `start` en vivo ya
> no emite `state`.
>
> Trampa que queda anotada: `https://www.dataseed.cl/...` **no** está en la
> allowlist de Redirect URLs (sondeado: GoTrue cae al Site URL). Hoy no muerde
> porque `APP_ORIGIN` está fijado al apex, así que el `start` desde `www` igual
> emite el `redirect_to` del apex. Si alguien cambia `APP_ORIGIN`, muerde.

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

## Corrección: `organizations` NO estaba vacía

Una versión anterior de este documento afirmaba que las 4 tablas tenían 0 filas.
**Era falso para `organizations`**, que tiene 1 fila desde el 2026-06-04:
`DataSeed Staging`, `type=internal`, `plan=free`, activa, con **0 membresías y 0
reportes** — nada la referencia.

**De dónde salió el error:** el campo `rows` de `list_tables` (MCP de Supabase)
es **`pg_class.reltuples`**, la estimación del planificador, que solo se
actualiza con `ANALYZE`/`VACUUM`. Una tabla con filas viejas sin analizar reporta
0. Se tomó un estimado y se presentó como medición.

**No hubo daño, pero por suerte y no por cuidado:** la columna que la migración
agregó a `organizations` fue `is_active` con default **`true`**, así que la fila
quedó intacta y activa. La operación peligrosa era `profiles.is_active` con
default **`false`**, y `profiles` sí estaba vacía de verdad. Si la fila
preexistente hubiera estado en `profiles`, se habría desactivado en silencio bajo
la afirmación de que no había riesgo.

**Regla:** para afirmar cuántas filas hay, `select count(*)`. Un estimado del
planificador no se etiqueta como medición.

Conteo real al 2026-09-08 (`select count(*)`, tabla por tabla): `organizations`
= 1; `auth.users`, `profiles`, `user_organizations`, `reports`, `agents`,
`conversations`, `files`, `connectors`, `organization_settings`, `audit_log` = 0.

## Verificación de punta a punta, en dry-run

La secuencia completa de alta se probó dentro de una transacción con `rollback`,
simulando la sesión del usuario con
`set_config('request.jwt.claims', …)` + `set local role authenticated`:

| Verificación | Resultado |
|---|---|
| El trigger `handle_new_user` creó el perfil | 1 |
| Lo creó **inactivo** (invariante invite-only) | 1 |
| Perfiles visibles bajo RLS como ese usuario | **1** (solo el propio) |
| Organizaciones visibles | **1** (vía `is_org_member`) |
| Membresías activas visibles | **1** — lo que exige `authorization.js` |
| `is_active` / `role` del perfil | `true` / `admin` |
| `plan` / `name` de la organización | `enterprise` / `Dataseed` |
| `role` de la membresía | `owner` |

Control negativo: la misma consulta con un token **sin** `sub` devolvió 0
perfiles y 0 organizaciones. RLS deniega sin identidad.

Con esos valores el login pasa. Todo revirtió: `auth.users` volvió a 0.

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

**2. "La migración desactiva filas preexistentes" — no pasó, pero por poco.**
`auth.users` y `profiles` estaban en 0, y `profiles.is_active` (default `false`)
era la única operación capaz de bloquear cuentas. `organizations` **sí** tenía
una fila, pero ahí la columna agregada entraba con default `true`. Ver la
sección "Corrección" arriba: la afirmación original de "0 filas en las 4 tablas"
salía de un estimado del planificador, no de un conteo.

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

Falta **un solo dato**: el correo del primer usuario. La secuencia ya está
probada en dry-run y se ejecuta en una pasada.

1. **Renombrar** `DataSeed Staging` → `Dataseed` con `plan=enterprise`
   (decidido: nada la referencia, así que renombrar no rompe nada y evita dejar
   dos organizaciones internas).
2. **Crear el usuario** con `email_confirmed_at = now()` y una contraseña
   aleatoria que se genera y se descarta, de modo que **no queda ninguna
   contraseña usable**. `email_confirmed_at` es obligatorio:
   `authorization.js:36` exige `email_confirmed_at` o responde 403
   `email_unconfirmed`.
3. **Activar el perfil** (`is_active = true`, `role = 'admin'`) y crear la
   **membresía única** (`role = 'owner'`). El trigger ya creó el perfil inactivo.
4. **El usuario define su contraseña** desde "olvidé mi contraseña" en
   `dataseed.cl/login`. Riesgo conocido: sin SMTP propio, Supabase usa su
   servicio por defecto, con límite de ~2-3 correos por hora y tendencia a caer
   en spam. `[Probable]` funciona; si no llega, se resuelve por el panel
   (Authentication → Users → Add user → toggle *Auto Confirm User*).
5. **Verificar el login de punta a punta** con la cabecera `Origin`.

### Alternativa descartada: página de registro público

Se evaluó crear una página de registro en dataseed.cl, copia de la de login.
**No sirve para entrar al portal:** el trigger crea el perfil con
`is_active = false`, así que el auto-registrado se autentica y recibe 403
`account_inactive`. No elimina ningún paso —igual hay que activarlo por el canal
de servicio— y agrega una **superficie pública de escritura** sobre el auth de
producción, que hoy no existe (no hay endpoint de signup) y que necesitaría
límite de tasa en el borde.

El registro público de **leads** es otra cosa y sigue vigente: va por HubSpot
Forms API reemplazando el Formspree de `site/index.html` y `site/publica.html`,
bloqueado por el Portal ID y el Form GUID. Un lead y un usuario del portal no
comparten tabla.

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

## Trabajo en paralelo — pedido de `SUPABASE_SERVICE_ROLE_KEY`

Hay un pedido de poner `SUPABASE_SERVICE_ROLE_KEY` en el env de Vercel.
**Está abierto y sin resolver.** La discusión, con las mediciones, está en
[`docs/security/service-role-key-decision.md`](security/service-role-key-decision.md).

**Resolución al 2026-09-08: diferido.** El self-serve viene después; para que el
login funcione no se necesita la clave. Por eso no se agrega al env ahora.

Resumen: `service_role` tiene `rolbypassrls = true` (medido), o sea **anula todo
el modelo de aislamiento que se aplicó en esta migración**. El env de Vercel es
compartido por todas las funciones, incluida `api/demo-chat.js`, que no tiene
ningún control de autenticación ni same-origin. Ninguna línea del repo referencia
esa clave hoy, y **dos tests la vetan** explícitamente
(`tests/site-login.test.js:50`, `tests/ui/login.test.js:32`).

El motivo declarado es **publicar el self-serve**, y el hueco que identifica es
real: después de V1, `authenticated` tiene 0
privilegios de escritura, así que la app no puede crear organizaciones ni
membresías ni activar perfiles, y eso exige un canal de servicio—. El desacuerdo
es sobre **dónde vive la credencial**, no sobre si hace falta. Para el alta
inicial no se necesita: se hace por el canal administrativo sin que ninguna clave
entre al runtime.

**Nota de coordinación:** al 2026-09-08 no hay ramas ni PRs de Matías en
`contacto101/data_seed` — las ramas recientes son todas de `danielcaignet-dataseed`.
Si está trabajando fuera del repo, no hay forma de ver qué necesita la clave para
hacer. Por eso el pedido se responde por escrito en ese documento.

## Historial de PRs

- **#24** — diagnóstico de fallos de auth. Mergeado.
- **#27** — versiona `supabase/migrations/`, `supabase/preflight/`, README.
- **#28** — este traspaso.
- **#29** — corrige `organizations.plan` y revoca EXECUTE de dos funciones.
- **#7** — cerrado por obsoleto (83 commits atrás de `main`).
