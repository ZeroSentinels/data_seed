# Cómo se trabaja en este repositorio

Este repositorio es **privado** (pasó de público a privado el 2026-09-05) y
despliega solo: lo que entra a una rama de larga vida lo publica Vercel sin que
nadie apriete nada. Con más de un equipo tocando las mismas ramas, las reglas de
abajo son el único punto donde alguien mira antes de que algo salga a internet.

**Al ser privado, el secret scanning gratuito de GitHub ya no corre.** Esa red
existía sólo mientras el repo era público. `scripts/ci/scan-secrets.sh` (§2) pasó
de ser una capa extra a ser la única.

**Pendiente de verificar tras la migración a organización:** la integración de
Vercel con GitHub postea un check (`Vercel`) sobre cada commit — así se entera
hoy del push. Mover el repo a una organización nueva puede exigir re-vincular esa
integración. Revisarlo apenas la organización esté lista, **antes** de asumir que
el deploy automático sigue funcionando: la falla, si ocurre, es silenciosa.

`AGENTS.md` describe cómo opera el agente Demeter. Este documento describe cómo
trabajan las personas. Cuando discrepen, manda éste para personas.

---

## 1. Ramas

| Rama | Qué es |
|---|---|
| `main` | producción |
| `preview/*` | rama compartida de una línea de trabajo; despliega a un preview de Vercel |
| `feat/*`, `fix/*` | trabajo individual; nace de la rama compartida y vuelve a ella por PR |

**No se pushea directo a `main` ni a `preview/*`.** Se abre PR. Vale para todos,
internos y externos.

Excepción documentada: los respaldos automáticos de Demeter en `backups/` y
`graphify-out/`. Son commits de una máquina, no de una persona, y no tocan
`site/`, `api/`, `tests/` ni `docs/`. Si alguna vez lo hacen, es un incidente.

## 2. Todo PR pasa por CI

`.github/workflows/ci.yml` corre tres trabajos y **ninguno es opcional**:

1. **Sintaxis y pruebas** — `npm run check` en Node 22 y 24.
2. **Barrido de secretos** — `scripts/ci/scan-secrets.sh` sobre las líneas
   agregadas.
3. **Fin de línea** — ningún archivo de texto con CRLF en el índice.

Un PR en rojo no se mergea. Si una regla del barrido da falso positivo, se ajusta
la regla **en el PR** y se explica por qué; no se saltea.

`.github/dependabot.yml` vigila versiones de las acciones de GitHub ancladas y de
las dependencias npm que el equipo agregue. Sus PRs pasan por la misma compuerta
que cualquier otro.

> Configurar en GitHub, una sola vez, **con una cuenta que tenga `Admin` sobre el
> repositorio** (hoy ninguna cuenta activa lo tiene — ver nota de la organización
> más arriba): Settings → Branches → regla de protección para `main` y
> `preview/*` con *Require a pull request* y *Require status checks to pass*,
> marcando los tres trabajos de CI **y el check `Vercel`** (o como se llame tras
> la re-vinculación) — un PR cuyo preview no compila tampoco debería mergear.
> **Sin esta configuración, este archivo es una sugerencia, no una compuerta.**

## 3. Antes de abrir el PR

```bash
npm run check        # tiene que quedar en verde
./scripts/ci/scan-secrets.sh   # barre lo agregado desde el commit anterior
```

Y una mirada al `git diff` propio. `docs/security/secret-policy.md` lista qué no
se commitea nunca.

## 4. Secretos

Ninguno entra al repositorio. Las credenciales viven en variables de entorno del
proyecto de Vercel, y el código las lee de `process.env`. El patrón de referencia
es `api/demo-chat.js`: la clave se usa en el servidor y **nunca** llega al HTML.

Lo mismo vale para **nombres de infraestructura** — hosts, direcciones internas,
nombres de contenedores o de bóvedas de credenciales — incluso dentro de
comentarios. El barrido de CI los busca por patrón. Para vigilar nombres
concretos sin escribirlos acá, se define el secreto de repositorio
`INFRA_DENYLIST`.

## 5. Fin de línea

`.gitattributes` fuerza LF. Si vienes de Windows y ves diffs con el archivo
entero modificado:

```bash
git add --renormalize .
```

Sin esto, `tests/ui/landing-mobile.test.js` falla en tu máquina y pasa en la de
al lado, y cada diff se vuelve ilegible.

## 6. Rutas nuevas

Agregar una ruta a `vercel.json` **obliga** a actualizar
`tests/deployment/topology.test.js`, que compara la lista completa de `rewrites`
con `deepEqual`. Es deliberado: es el guard contra que una ruta nueva ensombrezca
al sitio estático o a las funciones de `api/`. Ya se rompió una vez al agregar
`/publica-buscador` sin tocarlo.

## 7. Dónde está escrito el contrato

- `docs/architecture/publica-buscador.md` — buscador de licitaciones y sus dos
  endpoints. **Si el código y ese documento discrepan, se corrigen los dos en el
  mismo PR.**
- `docs/product/design-system.md` — identidad visual.
- `docs/security/secret-policy.md` — qué no se commitea.
- `docs/INDEX.md` — índice del resto.

Los documentos de `docs/product/` describen la **ambición** del producto; los de
`docs/architecture/` describen **lo que existe**. Al implementar, mandan los
segundos.

## 8. Commits

En español, descriptivos, en modo imperativo, con prefijo tipo
`feat:` / `fix:` / `docs:` / `test:` / `chore:`.
