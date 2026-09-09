# Traspaso — panel de autoservicio de /publica-buscador (filtros, fit score, orden)

Estado al **2026-09-08**. Escrito para que Daniel (o su sesión de Claude)
retome sin releer todo el hilo. Tres features, un solo PR sin mergear
todavía: **`feat/publica-buscador-perfil-guardado`**.

## Qué hay en ese PR, en orden

1. **Persistencia de filtros/perfil de búsqueda.** Región, monto y "solo
   abiertas" se guardan por organización y se recargan al iniciar sesión.
2. **Fit score autodeclarado** (OS10 / ISO 9001 / ISO 45001). El cliente tilda
   qué certificaciones tiene; si el **título** de una licitación las menciona,
   la tarjeta muestra un aviso ("Menciona X en el título — no verifica el
   pliego"). Es una aproximación por palabra clave: `/api/buscar` no devuelve
   `descripcion` al cliente (solo `nombre`, medido en `CAMPOS_BUS` de
   `ops/mp-api/app.py`), así que no hay más texto disponible para comparar.
3. **Ordenamiento visible**: reciente (default) / cierre más próximo / mayor
   monto. El backend (`ORDENES` en `ops/mp-api/app.py`) ya tenía "reciente" y
   "cierre" funcionando; se agregó "monto" (`monto_estimado_clp desc nulls
   last, codigo`, mismo patrón que las otras dos entradas).

## Dónde vive cada pieza

| Qué | Archivos |
|---|---|
| Esquema (misma tabla para 1 y 2) | `organization_settings.settings`, jsonb con dos claves hermanas: `buscador_perfil` (filtros) y `certificaciones` (fit score) — mezcladas con `\|\|`, ninguna pisa a la otra |
| SQL, sin ejecutar todavía | `supabase/migrations/20260908b_publica_search_profile.sql` (función `save_publica_search_profile`) y `20260908c_publica_certifications.sql` (función `save_publica_certifications`) — mismo patrón `security definer` que `provision_self_serve_org()`, `authenticated` no tiene `insert`/`update` directo sobre esa tabla a propósito (V1) |
| Endpoints | `api/auth/_lib/publica-handlers/search-profile.js`, `.../certifications.js` — registrados en `api/auth/publica-router.js` (sigue en 9/12 funciones serverless, límite del plan Hobby) |
| Frontend | `site/publica-buscador.js` (+ `.html`, `.css`) — 3 checkboxes de certificaciones, botón de "Cerrar sesión" (ver abajo), `<select>` de orden. Todo agregado; **cero líneas de `filtrarResultados`/`aplicarFiltrosYRenderizar` tocadas** más allá de que ahora reciben un parámetro extra |
| Backend de orden | `ops/mp-api/app.py` (VPS, no Vercel — ver nota crítica abajo) |

## Repuesto de paso: el botón de logout que se había perdido

Un commit mío (`7f80581`, botón de "Cerrar sesión" + plantilla de correo con
marca DataSeed) se pusheó a `feat/publica-buscador-conectado` **después** de
que el PR #41 ya se había mergeado — nunca llegó a `main`. Vos ya lo habías
detectado y anotado en `docs/operations/smtp-propio-supabase.md` §5
("pendiente en el repo"). Está repuesto en este mismo PR; esa sección del doc
ya la actualicé a "rescatada".

## ⚠️ Dos pasos manuales, fuera de Vercel, después de mergear

1. **Correr 2 migraciones en el SQL Editor de Supabase**, en cualquier orden:
   - `supabase/migrations/20260908b_publica_search_profile.sql`
   - `supabase/migrations/20260908c_publica_certifications.sql`

   Sin esto, guardar filtros/certificaciones responde 503 (leer sí funciona,
   `authenticated` ya tiene `select` sobre esa tabla por la V1).

2. **El cambio de `ops/mp-api/app.py` no se despliega solo.** `ops/mp-api/README.md`
   es explícito: este repo es *"copia versionada de lo que corre en el
   VPS... no como fuente de despliegue"*. Alguien con acceso al servidor tiene
   que copiar el `app.py` actualizado y correr `docker restart mp-api` (mismo
   mecanismo que ya usa `mp-sonda-indice.sh:86`). Yo no tengo acceso a ese
   servidor — sin este paso, el `<select>` de orden manda `orden: "monto"` y
   el servidor real todavía no lo reconoce (`orden debe ser uno de: ...`, 400).

## Verificación hecha

`npm run check`: **133/133** en la punta del PR. Sin acceso a los `.duckdb`
reales del VPS, la entrada nueva de `ORDENES` en `app.py` se verificó
estáticamente con `ast` (parseando el dict, sin ejecutar el módulo) — quedó
exacta, sin tocar `"reciente"` ni `"cierre"`.

## Referencias

- `docs/operations/coordinacion-agentes.md` §4.1 — el choque de diseño del
  self-serve (2026-09-08), por si hace falta el contexto de por qué el
  self-serve de Pública terminó con este mecanismo de `security definer` en
  vez de una clave de privilegios elevados.
- `docs/security/service-role-key-decision.md` — mismo tema, más en detalle.
- `docs/operations/smtp-propio-supabase.md` — el runbook de SMTP y la
  plantilla de correo, ya resuelto.
