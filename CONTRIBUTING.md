# Cómo se trabaja en este repositorio

Este repositorio es **público**, vive en `contacto101/data_seed`, y despliega
solo: lo que entra a una rama de larga vida lo publica Vercel sin que nadie
apriete nada. Con más de un equipo tocando las mismas ramas, las reglas de abajo
son el único punto donde alguien mira antes de que algo salga a internet.

**Por ser público, todo lo que se sube es visible.** Rige el barrido de
`scripts/ci/scan-secrets.sh` (§2) **y** el *secret scanning* gratuito de GitHub,
que sólo corre en repos públicos. Son dos capas, no una — pero ninguna sustituye
mirar el propio `git diff` antes de empujar.

> ### Por qué es público, y no una decisión estética
>
> `[MEDIDO 2026-09-06 al 09-07]` El repositorio pasó por cuatro estados en dos
> días — público → privado → organización `dataseed-cl` → cuenta personal →
> público otra vez. Cada paso destapó un bloqueo de plan que no se puede
> esquivar con configuración:
>
> | Estado | Qué se rompió | Evidencia |
> |---|---|---|
> | privado en organización | **Vercel no despliega.** `POST /projects/{id}/link` → `409 repo_owned_by_org`: *"private and owned by an organization, which is not supported on the Hobby plan"* | API de Vercel |
> | privado en cuenta personal | **Vercel tampoco despliega.** El deployment se creó y quedó en estado `BLOCKED`, no `ERROR`: se frena antes de compilar | `v6/deployments` → `BLOCKED` |
> | privado, cualquier dueño | **Branch protection no se aplica.** GitHub sólo hace cumplir *rulesets* en repos privados con plan Pro o superior | la propia UI de GitHub |
> | **público** | **nada** — deploy en verde y *rulesets* aplicables | `state: success`, *"Deployment has completed"* |
>
> Volver a público resolvió **los dos bloqueos a la vez y sin pagar nada**. Las
> alternativas medidas eran Vercel Pro (~USD 20/mes) para el deploy **más**
> GitHub Team (~USD 4/asiento/mes, 6 asientos) para la protección de ramas.
>
> **Si en algún momento se vuelve a privatizar, los dos bloqueos vuelven.** La
> salida sin costo sería separar en dos repos: éste público con `site/`, `api/`
> y `tests/`, y uno privado aparte con `docs/operations/`, `backups/` y
> `scripts/ops/`.

**Trampa ya pagada, para no repetirla:** al mover el repositorio entre dueños,
la integración de Vercel **no sigue el redirect de GitHub**. El proyecto quedó
con `link: {org: "contacto101"}` apuntando a un path que ya no existía, y
**dejó de recibir eventos en silencio** — el sitio seguía arriba sirviendo el
último deployment, así que nada parecía roto. Se detectó recién al ver que los
commits no tenían ningún status de Vercel. Tras cualquier cambio de dueño o de
visibilidad: empujar un commit de prueba y confirmar que aparece el check
`Vercel`, antes de asumir que el deploy automático funciona.

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

> ### PENDIENTE — activar la compuerta
>
> **`[2026-09-07]` Ahora que el repositorio es público, esto YA SE PUEDE
> aplicar** — GitHub hace cumplir *rulesets* gratis en repos públicos. Estuvo
> bloqueado mientras fue privado; ya no lo está.
>
> Configurar una sola vez, con una cuenta que tenga `Admin` sobre el repositorio
> (`contacto101` lo tiene por ser el dueño): Settings → Branches → regla de
> protección para `main` y `preview/*` con *Require a pull request* y *Require
> status checks to pass*, marcando los cuatro trabajos de CI **y el check
> `Vercel`** — un PR cuyo preview no compila tampoco debería mergear.
>
> Nombres exactos de los checks:
> ```
> Sintaxis y pruebas (22)
> Sintaxis y pruebas (24)
> Barrido de secretos y de nombres de infraestructura
> Fin de linea normalizado
> Vercel
> ```
>
> **Hasta que se configure, este archivo es una sugerencia, no una compuerta.**
> El CI corre en cada push a `preview/**` y a `main`, no sólo en PRs: si alguien
> empuja directo, el check queda rojo y registrado, pero **no bloquea nada**. Es
> detección, no prevención.

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
