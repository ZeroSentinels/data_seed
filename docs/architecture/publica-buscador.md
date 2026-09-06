# Buscador de licitaciones — Pública

Documento de diseño de la pantalla `/publica-buscador` y de los dos endpoints que
la alimentan. Es la fuente de verdad del contrato: si el código y este documento
discrepan, se corrigen los dos en el mismo PR.

**Estado `[MEDIDO 2026-09-06]`:** los dos endpoints están **construidos y en
producción** en `mp-api` (VPS), con las sondas del contrato en verde — ver
`ops/mp-api/README.md`. El motor de búsqueda de tres capas también está
implementado: `docs/architecture/publica-buscador-motor.md`.

**Lo que sigue pendiente, y por qué el preview público puede seguir mostrando
datos de ejemplo:**

1. **Falta `MP_API_KEY` en las variables de entorno de Vercel.** Sin ella,
   `api/buscar.js` y `api/licitacion/[codigo].js` devuelven `500` — el buscador
   se ve roto en el navegador aunque el backend esté sano. El valor vive en
   `/docker/mp-api/.env` del VPS (600); no se imprime acá.
2. **Los PR que traen el backend y el motor todavía no están mergeados** a esta
   rama — revisar PRs abiertos del repo antes de asumir que lo de abajo ya está
   en `preview/buscador-licitaciones`.

Hasta que los dos pasos anteriores se completen, nadie debe mostrar el preview
público como si consultara datos en vivo — el backend existe, pero el camino
completo (Vercel → `mp-api`) no está cerrado todavía.

---

## 1. Qué es y qué no es

Un **buscador**. Una caja de texto y resultados. No es un dashboard.

Objetivo: que alguien escriba un rubro y en menos de 3 segundos vea las
licitaciones abiertas a las que podría postular, con lo suficiente para decidir
**si vale la pena**, sin abrir Mercado Público.

**Fuera de alcance de esta pantalla, y no se dibuja aunque aparezca en material
comercial:** alertas, resumen de bases con IA, predicción de precio, score de
probabilidad de ganar, chat.

> **Discrepancia conocida con `docs/product/publica.md`.** Ese documento lista
> como diferenciales *"Scoring de oportunidad"*, *"Resumen inteligente de bases"*
> e *"Inteligencia competitiva"*. Ninguno está construido y ninguno se muestra
> acá. `docs/product/publica.md` describe la **ambición del producto**; este
> documento describe **lo que existe**. Al implementar, manda éste.

---

## 2. Regla de la casa: el hueco se dice, no se rellena

`[MEDIDO 2026-09-04]` **El 46,1 % de las licitaciones abiertas no publica monto**
(2.281 de 4.950). No es un hueco de datos: es una práctica de compra. Medido:

| | |
|---|---|
| `visibilidad_monto = FALSE` y estado `Publicada` | **2.281 de 2.281 sin monto (100 %)** |
| `visibilidad_monto = TRUE` y estado `Publicada` | **0 de 2.669 sin monto** |

El organismo esconde el presupuesto mientras recibe ofertas y lo publica al
adjudicar. Por lo tanto, en la interfaz **nunca** `$0`, **nunca** `—`, **nunca**
en blanco: dice **"Monto no publicado por el organismo"**.

**Ningún número absoluto se hornea en el código ni en el copy.** Las cifras de
arriba se mueven todos los días; van en este documento con su fecha, y en la
pantalla salen siempre de la respuesta del endpoint.

---

## 3. Campos disponibles

Nombres exactos de la fuente. La interfaz no puede mostrar nada que no esté acá.

| Campo | Notas |
|---|---|
| `codigo` | identificador, ej. `1596-45-LE26` |
| `tipo` | `LE`, `LP`, `L1`, `LR`, `CO`, `LQ`, `O1`… mostrar el nombre, no la sigla |
| `nombre` | a veces en MAYÚSCULAS; normalizar visualmente |
| `descripcion` | para el detalle, no para la tarjeta |
| `estado` | `Publicada`, `Cerrada`, `Adjudicada`, `Desierta`, `Revocada`, `Suspendida` |
| `fecha_publicacion` | |
| `fecha_cierre` | **el dato más importante**; de acá salen los días restantes |
| `fecha_adjudicacion` | sólo si se adjudicó |
| `region_comprador`, `comuna_comprador` | |
| `monto_estimado_clp` | **NULL en el 46,1 % de las abiertas** — ver §2 |
| `visibilidad_monto` | booleano. **Es el que distingue "el organismo lo ocultó" de "no hay dato"**. Sin él la §2 no se puede cumplir |
| `organismo_nombre`, `organismo_codigo` | `organismo_nombre` viene en MAYÚSCULAS |
| `n_oferentes` | `[MEDIDO]` presente en **0 de 5.701** licitaciones `Publicada` y en el 100 % de las cerradas/adjudicadas. En una abierta es NULL **y es correcto**: todavía nadie sabe cuántos se presentaron |
| `cantidad_reclamos`, `es_obra` | |
| `url_ficha`, `url_acta` | enlaces a Mercado Público |

Los ítems de cada licitación traen `nombre_producto`, `cantidad`,
`unidad_medida` y el código UNSPSC en cuatro niveles
(`unspsc_commodity`, `unspsc_clase`, `unspsc_familia`, `unspsc_segmento`).

### Compra Ágil no aparece acá

No porque se haya excluido, sino porque **es compra directa y no genera una
licitación**. Sus órdenes de compra sí están en la fuente y se consultan por otra
vía. Si hay que explicarlo en pantalla, con esta redacción exacta:

> *"Compra Ágil no aparece acá porque no genera una licitación: es un mecanismo de
> compra directa. Sus órdenes sí están en la base."*

Y en ningún texto de la interfaz debe decir *"todas las licitaciones de Mercado
Público"*. Se dice **"licitaciones públicas"**.

---

## 4. `POST /api/buscar`

```jsonc
// petición
{ "texto": "inteligencia artificial", "solo_abiertas": true,
  "region": null, "limite": 25, "desde": 0 }
```

```jsonc
// respuesta
{
  "total": 11,
  "resultados": [ { "codigo": "…", "tipo": "LE", "nombre": "…", "estado": "…",
                    "fecha_publicacion": "…", "fecha_cierre": "…",
                    "region_comprador": "…", "monto_estimado_clp": 17533000,
                    "visibilidad_monto": true, "organismo_nombre": "…",
                    "n_oferentes": null, "url_ficha": "…" } ],
  "metricas": { … },   // §4.2
  "meta": { "fuente": "ChileCompra - Mercado Público",
            "as_of": "2026-09-04",
            "limitaciones": [ { "limitacion": "…", "severidad": "media" } ] }
}
```

`meta` es **obligatorio y se muestra**, discreto al pie. Ningún número se muestra
sin decir de dónde viene y hasta cuándo llega.

`meta.limitaciones[]` viaja **siempre como objeto** `{limitacion, severidad}`.
Ya hubo un incidente por una fuente interna que las emitía como cadenas sueltas y
un `as_of` que llegaba como objeto: el consumidor degradaba a texto justo los
casos que más necesitaban mostrar su salvedad. El frontend acepta ambas formas
por defensa, pero **el endpoint emite la forma canónica**.

### 4.1 Las tres definiciones que el contrato anterior daba por obvias

Estaban sin escribir y cada una mueve la cifra de portada. Quedan cerradas acá.

**a) `solo_abiertas`** = `estado = 'Publicada' AND fecha_cierre >= meta.as_of`.

`[MEDIDO 2026-09-04]` De 5.701 con `estado='Publicada'`: **4.950 vigentes, 738 ya
cerradas, 13 sin `fecha_cierre`**. Implementarlo sólo por `estado` metería **751
licitaciones muertas (13,2 %)** en la pantalla cuyo elemento de mayor peso visual
es *"Cierra en X días"*. Las 13 sin fecha **se excluyen y se declaran** en
`meta.limitaciones`; no se ocultan.

**b) `rubro`** = `unspsc_commodity` (8 dígitos).

`[MEDIDO]` sobre las 2.281 abiertas con presupuesto oculto, cobertura de historia
del mismo organismo y mismo rubro según el nivel elegido:

| nivel | n≥1 | n≥3 |
|---|---|---|
| **`unspsc_commodity`** | **1.194 · 52,3 %** | **705 · 30,9 %** |
| `unspsc_segmento` | 441 · 19,3 % | 112 |
| `unspsc_familia` | 284 · 12,4 % | 47 |
| `unspsc_clase` | 218 · 9,6 % | 33 |

Elegir `unspsc_clase` haría caer el diferenciador de 52 % a 10 % **sin que nada
falle**: devolvería `sin_datos` en silencio. Cuando la licitación tiene ítems con
commodities distintos, se usa la **unión** de commodities y `n_licitaciones`
cuenta **licitaciones distintas**, no ítems.

**c) `metricas.competencia`** viaja con su universo explícito, o no viaja.

Una búsqueda por texto libre no tiene rubro, y `n_oferentes` no existe en ninguna
licitación abierta (§3). O sea: esta métrica **nunca** se calcula sobre las filas
que el usuario está viendo. Por lo tanto lleva `universo` obligatorio y el
frontend **está obligado a imprimirlo junto al número**. Si no se puede mostrar
así, se saca la métrica: un número de competencia mal atribuido es peor que
ninguno.

### 4.1-bis Cómo se calcula `meta.as_of`, y por qué no se le pregunta a la ingesta

`[MEDIDO 2026-09-05]` **La tabla `ingesta_log` no es una fuente de verdad sobre
frescura.** La corrida del 2026-09-04 19:16 escribió `ok=True` en esa tabla
mientras el script que la invoca la registraba como **FALLO**: el ZIP mensual de
ChileCompra devolvió **870 bytes** — la cáscara HTML de su SPA, no datos — y esa
carga se omitió. Un chequeo de frescura que lea `ingesta_log.ok` habría dicho que
todo estaba bien.

`as_of` = `max(fecha_publicacion)`. Además el endpoint emite dos avisos en
`meta.limitaciones`, ambos con severidad **alta**:

| Aviso | Cuándo |
|---|---|
| Almacén atrasado | `as_of` a más de **2 días** de hoy. Es la señal robusta: si la ingesta muere, este número crece solo |
| Carga incompleta | un día hábil ya cerrado trae **menos del 60 %** de la mediana de los días hábiles previos |

**Dos calibraciones que costaron una medición cada una:**

1. **No se evalúa el último día.** El día más nuevo está parcial por construcción
   — la fuente publica durante el día y el bulk llega con atraso. Se evalúa el
   **penúltimo**. Evidencia: el 2026-09-04 cerró con 270 licitaciones frente a una
   mediana de 421; a la mañana siguiente, tras el sync de las 07:00, el mismo día
   tenía **448**. Alarmar sobre el último día habría gritado por algo que se curó
   solo en doce horas.
2. **Sólo días hábiles.** `[MEDIDO]` los fines de semana traen **1 a 6**
   licitaciones contra **378-501** de un día hábil — una caída del 99 %. Sin ese
   filtro la sonda daría falso positivo cada lunes y cada martes, que es la forma
   más rápida de que nadie vuelva a mirar la alarma.

### 4.1-ter El filtro `region` no puede compararse por igualdad exacta

`[MEDIDO 2026-09-05]` `region_comprador` **no es un campo limpio**. Entre las 16
regiones oficiales convive:

- nombres de **comuna** (`Concepción`, `Coquimbo`, `Iquique`, `Peumo`, `San Clemente`);
- nombres de **organismo** mal cargados (`SERVICIO DE SALUD OCCIDENTE HOSPITAL SAN JUAN DE D`);
- un **artefacto de parseo** (`AwardCriteria.Text14`);
- y **espacios finales inconsistentes**: `"Región de Antofagasta "` con espacio
  convive con la forma sin espacio.

Consecuencias, las dos verificadas:

1. **El backend compara con `trim()` en los dos lados.** Medido: buscar
   `"Región de Antofagasta"` sin espacio final devolvía **0** resultados contra
   los **2.590** reales. Un filtro que falla en silencio es peor que uno que no existe.
2. **El selector de la interfaz no se puebla con lo que devuelve la base.** Usa
   una lista fija de las 16 regiones oficiales (`REGIONES_OFICIALES` en
   `site/publica-buscador.js`). Poblarlo dinámicamente le mostraría al cliente
   `AwardCriteria.Text14` como si fuera una región.

**No se corrige el dato en origen.** El almacén replica lo que publica
ChileCompra; limpiarlo ahí sería inventar una precisión que la fuente no tiene.

### 4.2 `metricas` — dentro de la misma respuesta

Van en la respuesta de `/api/buscar`, no en un endpoint aparte: son siempre del
filtro vigente y un segundo viaje sólo agrega latencia.

```jsonc
"metricas": {
  "n": 11,
  "monto": { "n_con_monto": 5, "n_oculto_por_organismo": 6,
             "suma_clp": 99013000, "mediana_clp": 17533000 },
  "cierre": { "en_3_dias": 2, "en_7_dias": 3, "mas_de_7": 8 },
  "top_organismos": [ { "nombre": "…", "n": 3 } ],
  "top_regiones":   [ { "nombre": "…", "n": 4 } ],
  "competencia": { "oferentes_mediana": 5, "n": 612,
                   "universo": "licitaciones ya adjudicadas que coinciden
                   con la misma busqueda -- NO son las que se estan mostrando" }
}
```

| Campo | Regla dura |
|---|---|
| `monto.n_oculto_por_organismo` | sale de `visibilidad_monto = FALSE`. **Nunca se llama "sin dato"** |
| `monto.suma_clp` / `mediana_clp` | sólo sobre las que sí traen monto, y **siempre** se muestran junto a `n_con_monto`. Una suma que calla cuántas quedaron afuera miente |
| `cierre.*` | contra `meta.as_of`, **nunca** contra la fecha del navegador |
| `competencia` | inútil sin `n` y sin `universo` — ver §4.1c |

Invariante verificable: `n_con_monto + n_oculto_por_organismo == n`.

---

## 5. `GET /api/licitacion/{codigo}` — el detalle masticado

Reemplaza al enlace a Mercado Público como destino principal.

```jsonc
{
  "codigo": "1016-8-LE26",
  "items": [ { "nombre_producto": "Software de sistema experto", "cantidad": 1.0,
               "unidad_medida": "Unidad", "unspsc_commodity": "43231511" } ],
  "referencia_historica": {
    "alcance": "organismo_y_rubro" | "rubro" | "sin_datos",
    "n_licitaciones": 12,
    "monto_mediana_clp": 11250000,
    "monto_p10_clp": 8100000,
    "monto_p90_clp": 19400000,
    "oferentes_mediana": 3,
    "montos_clp": [11250000]        // solo cuando n < 3 — ver §5.1
  },
  "url_ficha": "https://www.mercadopublico.cl/…",
  "meta": { }                        // mismo bloque meta que /api/buscar
}
```

> **Enmienda `[2026-09-05]` — `montos_clp`.** El contrato original no tenía dónde
> poner el valor cuando `n < 3`, y la regla §5.1 exige mostrarlo *"como dato
> puntual"*. Sin este campo la regla no se puede cumplir: o se calla el dato, o
> se lo disfraza de mediana. Viaja **sólo** con `n < 3`, y en ese caso
> `monto_mediana_clp`, `monto_p10_clp` y `monto_p90_clp` van todos en `null`.
> Verificado con el caso del propio SDD: `1002772-83-LE26` →
> `alcance: "organismo_y_rubro"`, `n_licitaciones: 1`, sin mediana ni percentiles.

**Cobertura de `referencia_historica`** `[MEDIDO 2026-09-04]`, sobre las 2.281
abiertas con presupuesto oculto:

| alcance | cobertura |
|---|---|
| mismo organismo **y** mismo rubro | 1.194 → **52,3 %** (con n≥3: 705, **30,9 %**) |
| mismo rubro, cualquier organismo | 2.097 → **91,9 %** (con n≥5: 1.961) |
| sin datos | 184 → **8,1 %** |

Código inexistente → **404 con cuerpo que explica**, nunca 200 con objeto vacío.

### 5.1 La regla del umbral — no negociable

Caso real: `1002772-83-LE26`, presupuesto oculto, con **una sola** licitación
histórica del mismo organismo y rubro. Presentar eso como *"mediana $11.250.000,
rango $11.250.000 a $11.250.000, 1,0 oferentes promedio"* es **precisión falsa**.

1. **`n_licitaciones` viaja SIEMPRE.** Ningún número de referencia se muestra sin él.
2. **Con `n < 3`: prohibido el lenguaje estadístico.** Ni "mediana", ni "promedio",
   ni "rango". Se dice **"único antecedente"** o **"2 antecedentes"**, y el valor
   se muestra como dato puntual.
3. **Con `n = 0`**: `alcance: "sin_datos"`. No se rellena con el rubro completo sin
   decir que se cambió de alcance — `alcance` existe exactamente para eso.
4. **El `alcance` se muestra**, no se esconde: "este organismo" y "el rubro en
   general" no son la misma afirmación.

Y vende **mejor**: *"el único antecedente de este organismo en este rubro fue
$11,25 M"* es más persuasivo que una mediana inventada, porque es específico y el
cliente lo puede verificar.

### 5.2 El rango va por percentiles, nunca por mínimo y máximo

`[MEDIDO]` Para un rubro con 1.504 adjudicaciones, `min`–`max` da
**$1 – $255.000.000**; `p10`–`p90` da **$696.500 – $11.735.000**. Dos puntos sobre
mil quinientos arruinan el rango: en toda la fuente hay **13.458 adjudicaciones de
≤ $1.000 (4,87 %)**, de las cuales **3.868 son de exactamente $1**.

Por eso los campos son `monto_p10_clp` y `monto_p90_clp`, y la etiqueta dice
**"rango habitual"** o **"8 de cada 10 casos"**, nunca "rango".

**Con `n < 10` no se muestra rango de ningún tipo:** sólo la mediana con su `n`, y
con `n < 3` ni eso (§5.1).

---

## 6. Suscripción y sesión — contrato declarado, no implementado

Pública se divide en servicios y **cada plan abre un subconjunto**. Hoy el modelo
existe a medias y hay que decirlo con precisión:

- `resolveIdentity()` (`api/auth/_lib/authorization.js`) ya devuelve
  `organization.plan`, con `'free'` por defecto.
- **No existe ninguna función que lo aplique.** El único guard es
  `assertOrganizationAccess`, que compara organización, no plan.

**Contrato que se declara ahora y se implementa después:**

```js
// api/auth/_lib/authorization.js  (por construir)
export function assertPlanAccess(identity, servicio) { /* … */ }
```

- `servicio` es un identificador estable (`'buscador'`, `'buscador.detalle'`,
  `'dashboard'`, `'dashboard.agente'`, …), no un nombre de pantalla.
- El mapa **plan → servicios** vive en un solo archivo y **nadie lo consulta en
  línea**: si un endpoint necesita saber el plan, llama a esta función.
- Falla con la forma de error que ya usa el módulo: `AuthorizationError` con
  `status` y `code`. Código sugerido: `plan_insufficient`, status **402**.
- Los nombres reales de los planes salen de la organización, no de este
  documento: escribirlos acá antes de que existan sería inventar el modelo de
  negocio en código.

**Postura de los dos endpoints hasta que exista `assertPlanAccess`:** ambos
aceptan identidad **opcional**. Si llega sesión válida, se resuelve y se adjunta;
si no, se responde igual. Cuando el gate exista, se agrega la llamada en un solo
punto por endpoint, sin reescribir la consulta. **No se hornea lógica de plan
dentro del SQL.**

---

## 7. Verificación exigida antes de declarar esto funcionando

Cada afirmación necesita umbral o control negativo. Una prueba que pasa por el
solo hecho de haber podido correr confirma cualquier cosa.

| # | Afirmación | Umbral / control negativo |
|---|---|---|
| 1 | No se inventa monto | `n_con_monto + n_oculto_por_organismo == n`. Control negativo: ninguna fila con `visibilidad_monto=false` puede traer `monto_estimado_clp` no nulo |
| 2 | `n < 3` sin lenguaje estadístico | `1002772-83-LE26` → sin `monto_p10_clp`/`p90`, con `n_licitaciones: 1` |
| 3 | `n < 10` sin rango | n=9 → sin percentiles; n=10 → con percentiles |
| 4 | `alcance` no miente | código con historia sólo de rubro → `"rubro"`, nunca `"organismo_y_rubro"` |
| 5 | Código inexistente | `ZZZZ-0-XX00` → **404 con cuerpo**, no 200 vacío |
| 6 | Sin inyección | texto con comillas y sentencias SQL → resultado vacío, sin error, fuente intacta |
| 7 | Techo de costo | `limite` fuera de rango se recorta al máximo declarado, no se acepta |
| 8 | Origen de sólo lectura | una escritura desde el servicio del buscador falla |
| 9 | Límite de tasa propio | ráfaga contra `/api/buscar` → 429, **y los demás servicios de Pública siguen respondiendo** |
| 10 | `solo_abiertas` no cuela cerradas | ninguna fila con `fecha_cierre < as_of` |
| 11 | Frescura | **implementado** — ver §4.1-bis. `/health` de `mp-api` expone `as_of` y los avisos; el vigía del VPS (`poc-watchdog.sh`) lo consulta cada 10 min y alarma con atraso > 2 días o carga parcial. **Verificado apagando `mp-api` a propósito:** registró los 4 síntomas y luego `RECUPERADO` |
| 12 | El vigía no inventa causas | Con `mp-api` apagado, la primera versión reportaba *"almacén atrasado 99 días"* — el almacén estaba intacto y lo caído era la API. Corregido: ahora dice **"la frescura quedó SIN VERIFICAR"**. Un diagnóstico inventado que se lee como medición es peor que un hueco declarado |

**Al agregar las rutas, hay que actualizar `tests/deployment/topology.test.js`.**
Ese test compara la lista completa de `rewrites` de `vercel.json` con
`deepEqual` a propósito: es el guard contra que una ruta nueva ensombrezca al
sitio estático o a las funciones. Ya se rompió una vez, al agregar
`/publica-buscador` sin tocarlo.

---

## 8. Deudas conocidas, para no redescubrirlas

- **Tipografía.** `docs/product/design-system.md` y
  `tests/deployment/topology.test.js` exigen **Syne**; `site/publica.html` y el
  buscador usan **Space Grotesk**. Se replicó lo real, no lo aspiracional. Quien
  corrija la deriva tiene que tocar los tres lugares.
- **`docs/security/auth-plan.md` describe Firebase/GCP**; lo implementado es
  Supabase (`api/auth/_lib/supabase.js`). El documento es histórico y no
  representa el sistema.
- **Tema.** El sitio es oscuro por identidad (`:root`) y claro por override
  (`html[data-theme="light"]`), aplicado antes del primer paint. El buscador
  soporta los dos con el mismo mecanismo. Medir el tema con el navegador en una
  sola condición de visita **no** es medir el CSS.
