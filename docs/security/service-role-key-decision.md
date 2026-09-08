# ¿Va `SUPABASE_SERVICE_ROLE_KEY` en el env de Vercel?

**Estado: abierto. Falta la justificación técnica de para qué se necesita.**
Fecha: 2026-09-08. Escrito para que la discusión sea por escrito y con números,
no por chat.

> **Pedido recibido:** poner `SUPABASE_SERVICE_ROLE_KEY` en las variables de
> entorno del proyecto Vercel `data-seed`.
>
> **Motivo declarado (Matías):** publicar el **self-serve**.
>
> **Respuesta corta:** el motivo es legítimo y el hueco que identifica es real —
> después de V1 la app no puede crear organizaciones ni membresías—. Pero esto
> **no es una decisión de variable de entorno**: el self-serve **revierte el
> invariante invite-only** que se acaba de aplicar, y eso exige una decisión de
> producto explícita, no un env var. Y para el camino de escritura que necesita,
> **hay una alternativa que no requiere la clave**: una función
> `security definer` con contrato estrecho. Detalle abajo.

## Qué es esa clave, medido

```sql
select rolname, rolsuper, rolbypassrls from pg_roles where rolname = 'service_role';
```

| rol | superusuario | **ignora RLS** |
|---|---|---|
| `service_role` | no | **sí** |
| `authenticated` | no | no |
| `anon` | no | no |

`service_role` tiene **`rolbypassrls = true`**. Medido contra
`pgmfppykgpqpzcoswszv` el 2026-09-08, no supuesto.

Eso significa que **anula por completo** el modelo de aislamiento que se aplicó
ese mismo día en la migración V1:

- las 10 policies de `select` acotadas a `{authenticated}`
- `FORCE ROW LEVEL SECURITY` en las 10 tablas
- los 0 privilegios de escritura de `authenticated`
- `is_org_member()` como único camino para ver datos de otra organización

Quien tenga esa clave lee y escribe **todas** las filas de **todas** las
organizaciones. No hay multi-tenancy para ese portador.

## Por qué el env de Vercel es el peor lugar

Un env de proyecto en Vercel es **compartido por todas las funciones**. Estas son
las que hay hoy en `main` y sus controles de acceso, medidos:

| Función | Valida same-origin o sesión |
|---|---|
| `api/auth/login.js` | sí |
| `api/auth/logout.js` | sí |
| `api/auth/session.js` | sí |
| `api/auth/forgot-password.js` | sí |
| `api/portal.js` | sí |
| **`api/demo-chat.js`** | **no — ninguno** |

`api/demo-chat.js` es el demo público del Agent Engine: **sin autenticación, sin
same-origin, y alimentado por entrada de usuario hacia un LLM upstream**. Poner
la clave en este env la deja presente en `process.env` del runtime de ese
endpoint.

**"Esa función todavía no va" no significa que no esté expuesta.** Medido el
2026-09-08 contra producción:

| Petición | Respuesta |
|---|---|
| `GET /api/demo-chat` | **405** (la función existe y evalúa el método) |
| `POST /api/demo-chat` | **500** — "El asistente no está disponible en este momento" |
| `GET /api/no-existe` (control) | 404 |

La función **está desplegada y se ejecuta con pedidos anónimos**. Falla recién en
la llamada al upstream, por configuración. El 405 y el 500 —en vez del 404 del
control— prueban que el código corre. Cualquier variable del env del proyecto
está en su `process.env` cuando eso pasa.

**Matiz honesto, para no inflar el hallazgo:** hoy `demo-chat.js` lee únicamente
`HERMES_API_KEY` y no enumera el entorno, así que **no** filtra la clave por sí
solo. Esto es un argumento de **radio de explosión y mínimo privilegio**, no un
exploit demostrado. `[Probable]`, no `[Seguro]`. El riesgo se materializa con
cualquier bug futuro, un manejador de errores que volque el entorno, una
dependencia comprometida, o una inyección de prompt que derive en que el endpoint
haga una llamada que el autor no previó.

## Lo que el repo ya decidió sobre esta clave

No es una discusión nueva. Hay **dos tests que prohíben activamente** que esa
clave aparezca:

- `tests/site-login.test.js:50` → `assert.doesNotMatch(js, /SUPABASE_(ANON|SERVICE)|service_role|anonKey/i)`
- `tests/ui/login.test.js:32` → `assert.doesNotMatch(js, /supabase|anonkey|service_role|.../i)`

Y **ninguna línea de código del repo la referencia**. Las únicas dos apariciones
en `main` son esos tests, que la vetan. La arquitectura actual usa la clave
`anon` más el **JWT del propio usuario**, y deja que RLS haga cumplir el
aislamiento. Ese es el patrón correcto y funciona: verificado el 2026-09-08
simulando la sesión de un usuario, que vio exactamente 1 perfil, 1 organización
y 1 membresía.

## El hueco es real: el self-serve necesita un camino de escritura

Después de V1, `authenticated` tiene **0 privilegios de escritura**. La app:

- **no puede** crear una organización
- **no puede** crear una membresía
- **no puede** activar un perfil — `is_active` no está entre las columnas que
  `authenticated` puede actualizar (solo `full_name` y `avatar_url`)

Eso es deliberado y exige un canal de servicio. **El pedido identifica un hueco
que existe.** El desacuerdo no es sobre si hace falta un camino de escritura.

## Pero el self-serve revierte el invariante que se acaba de aplicar

V1 es **invite-only por diseño**, y eso no es un detalle de implementación:

- `handle_new_user` crea el perfil con `is_active = false`
- `authorization.js` exige *exactamente una* membresía activa
- el traspaso lo marca como "invariante de diseño que no hay que arreglar"

**Un auto-registrado hoy se autentica y recibe 403.** Publicar self-serve
significa decidir lo contrario, y eso es una **decisión de producto y de
seguridad**, no una variable de entorno. Si se resuelve agregando la clave y
auto-aprovisionando en el signup, el resultado es:

- cualquier persona en internet puede crear una **organización** y una
  **membresía** — creación de inquilinos sin límite
- el `is_active = false` pasa a ser decorativo
- una clave que **ignora RLS** queda en el camino de petición de un endpoint
  **anónimo**: la peor ubicación posible para ella

**Pregunta de producto que hay que responder antes de escribir código:** ¿a qué
accede un usuario de self-serve? Si obtiene su propia organización vacía, el
modelo de inquilinos se sostiene pero se publica un endpoint de creación de
organizaciones. Si tiene que ver datos de Dataseed, el aislamiento multi-tenant
se rompe y hay que rediseñarlo, no parcharlo.

## Contrapropuesta: el self-serve no necesita esta clave

El patrón estándar de Supabase para esto es una función **`security definer`** con
contrato estrecho, no una clave con permisos totales en un proceso de Node. V1 ya
usa ese patrón para `is_org_member()`.

Algo así como `provision_self_serve_org(org_name text)`:

- corre como su dueño, así que **ignora RLS de forma legítima y acotada**
- se otorga **solo a `authenticated`** — quien la llama ya tiene un JWT válido,
  porque el signup se hizo antes con la clave `anon`
- valida internamente: que quien llama **no tenga** ninguna membresía previa, que
  el perfil sea el suyo, y crea **exactamente** una organización, una membresía y
  activa el perfil
- deja rastro en `audit_log`, que hoy existe y nadie escribe
- `set search_path = ''`, como las otras funciones de V1

Con eso el bypass de RLS vive **dentro de la base**, limitado a una operación
auditable y verificable con tests, en vez de repartir una llave maestra al
runtime. La clave `service_role` deja de ser necesaria para el self-serve.

Lo que se pierde: hay que escribir y testear esa función, y el signup queda
atado a su contrato. Es más trabajo que agregar un env var — y es la diferencia
entre un permiso acotado y uno total.

## Resolución al 2026-09-08: diferido

**El self-serve viene después; el objetivo actual es solo que el login funcione.**
Para eso **no se necesita la clave**: el alta del primer usuario es una operación
de una sola vez que se hace por el canal administrativo (MCP de Supabase), sin
que ninguna credencial entre al runtime de producción.

Por lo tanto: **no se agrega `SUPABASE_SERVICE_ROLE_KEY` al env de Vercel ahora.**

Cuando el self-serve entre en agenda, lo que hace falta antes de escribir código:

1. La **decisión de producto**: a qué accede un usuario de self-serve, y si eso
   convive con el aislamiento multi-tenant o lo redefine.
2. Evaluar la **contrapropuesta** `security definer` frente a la clave. Si se
   descarta, escribir por qué no alcanza.
3. Si igual tiene que ir la clave: **no en este env**. Proyecto de Vercel
   separado o Supabase Edge Function, con su propia autenticación, límite de tasa
   en el borde, y un test que verifique que no se referencia fuera de un único
   módulo — el mismo espíritu de los dos tests que ya la vetan.
4. Declarar por escrito, como exige `CLAUDE.md`: qué superficie queda expuesta,
   qué la protege, qué pasa si ese control cae, y qué se pierde al cerrarla.

## Referencias

- `docs/TRASPASO-auth-supabase-20260908.md` — estado del login y del esquema.
- `docs/security/secret-policy.md` — política de secretos del repo.
- `supabase/migrations/20260723_secure_multitenant_auth.sql` — el modelo de
  aislamiento que esta clave anularía.
