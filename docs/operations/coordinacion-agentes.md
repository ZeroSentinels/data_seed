# Dos agentes sobre este repo — protocolo de coordinación

Desde el 2026-09-08 hay **dos Claude Code trabajando este repositorio**: el de
Daniel y el de Matías. Este documento es para los dos, y sobre todo para el que
llegue sin el contexto de la sesión donde se decidió algo.

**Si vas a cambiar cualquier cosa bajo `api/auth/`, `site/login*`,
`supabase/migrations/` o `vercel.json`, leé esto completo antes.**

---

## 1 · La carga de la prueba es de quien cambia

No alcanza con que el cambio parezca correcto ni con que los tests pasen en tu
máquina. **La afirmación "no rompí nada" no vale sin la medición que la
sostiene.** La consigna operativa del equipo es literal:

> No me digas que funciona: mostrame con qué lo comprobaste.

Un PR que toca autenticación tiene que traer, en su descripción:

| Qué | Cómo se ve la evidencia |
|---|---|
| Los tests | La salida de `npm run check` con el conteo real (`pass N`, `fail 0`) |
| El barrido de secretos | `bash ./scripts/ci/scan-secrets.sh <sha base>` en verde |
| El login sigue vivo | La petición medida contra el endpoint, con su código de respuesta |
| Lo que **no** cambió | Qué invariante de la §3 podría haber tocado y por qué no lo tocó |

**Trampa medida, no la redescubras:** al medir el login hay que mandar la
cabecera `Origin: https://dataseed.cl`. Sin ella, `site/login.js` y el endpoint
responden **403 por same-origin** y parece una regresión que no existe. Un
"rompí el login" sin esa cabecera es un falso positivo.

Un PR sin evidencia no se discute: **se revierte y se discute después.** No es
desconfianza, es que el costo de verificar de nuevo lo paga el otro y el repo
despliega a producción.

## 2 · Cómo revertir, si hay que revertir

Hay dos niveles y no son lo mismo:

1. **Revertir el código** — `git revert <sha del squash>` sobre `main`, PR
   aparte. Cada merge a `main` es un solo commit de squash, así que revertir un
   cambio completo es una operación limpia. Para el procedimiento largo está
   `docs/operations/rollback.md`.
2. **Revertir el despliegue** — promover el deployment anterior en Vercel. Es
   más rápido que el revert de código y no ensucia la historia, pero **no
   deshace migraciones de base de datos**: un cambio de esquema aplicado sigue
   aplicado.

**Consecuencia práctica:** una migración de Supabase no se revierte con un
rollback de despliegue. Toda migración va con su procedimiento de vuelta atrás
escrito **antes** de aplicarse, o no va.

## 3 · Invariantes que no se cambian sin decisión escrita

Cada uno de estos costó una sesión de medición. Cambiar alguno no es un detalle
de implementación: es revertir una decisión, y va con su propio documento.

1. **`SUPABASE_SERVICE_ROLE_KEY` no va en el env del proyecto Vercel
   `data-seed`.** Decisión cerrada el 2026-09-08 en
   `docs/security/service-role-key-decision.md`. Esa clave ignora RLS por
   completo (`rolbypassrls = true`, medido) y el env del proyecto lo comparten
   todas las funciones, incluida una que responde a pedidos anónimos. El
   self-serve **no la necesita**: el alta va por `provision_self_serve_org()`.
   Si creés que hace falta, leé ese documento y respondé sus cuatro puntos.
2. **Los dos tests que vetan esa clave se quedan** —
   `tests/site-login.test.js:50` y `tests/ui/login.test.js:32`. Si un test tuyo
   falla contra ellos, el que está mal es el tuyo.
3. **El portal de Dataseed es invite-only.** Pública es freemium self-serve. Son
   dos reglas de autorización distintas: no se resuelve relajando la única que
   hay, porque eso abre el portal de clientes.
4. **`authenticated` tiene 0 privilegios de escritura**, y RLS con `FORCE` en
   las 10 tablas. Es deliberado. El camino de escritura es una función
   `security definer` con contrato estrecho, no un `grant`.
5. **La compuerta de CI se queda en `main`.** Si un trabajo del flujo te
   molesta, se arregla la regla y se dice por qué en el PR. No se saltea.

## 4 · Reparto de trabajo, para no pisarnos

Al 2026-09-08, la lista de pendientes del self-serve está en
`docs/security/service-role-key-decision.md`. Antes de tomar un punto,
**anunciálo en el PR o en un issue**, porque los cinco tocan los mismos cuatro
archivos:

| # | Trabajo | Archivos que toca |
|---|---|---|
| 1 | Destino del login por audiencia | `site/login.js`, `api/auth/login.js` |
| 2 | 403 `membership_required` → formulario de alta | `site/login.js`, `api/auth/_lib/authorization.js` |
| 3 | `provision_self_serve_org()` + tests | `supabase/migrations/`, `tests/auth/` |
| 4 | Membresía freemium no habilita `/portal` | `api/auth/_lib/authorization.js` |
| 5 | Límite de tasa en el registro | `vercel.json`, borde |

**Los puntos 1 y 2 tocan `site/login.js` los dos.** Si los toman dos agentes en
paralelo, hay conflicto garantizado. Que los tome el mismo, o que el segundo
espere el merge del primero.

## 5 · Nada de push directo a `main`

Todo entra por PR, con la compuerta corriendo. `main` es lo que Vercel
despliega a `dataseed.cl`: un push directo publica sin que nadie haya mirado.

---

## Referencias

- `docs/security/service-role-key-decision.md` — la decisión del self-serve y la lista de pendientes.
- `docs/TRASPASO-auth-supabase-20260908.md` — estado del login y del esquema.
- `docs/operations/rollback.md` — procedimiento largo de vuelta atrás.
- `docs/security/secret-policy.md` — qué no puede entrar al repo.
