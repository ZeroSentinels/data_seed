# SDD · Motor de búsqueda del buscador de licitaciones

Complementa `publica-buscador.md`, que define **el contrato**. Este documento
define **cómo se resuelve la consulta del usuario**: qué existe hoy, qué se
propone, y con qué evidencia.

**Estado:** propuesta. Nada de la §5 está construido. Lo de la §3 sí está en
producción y medido.

---

## 1. El problema, en una línea

El usuario escribe lo que se le ocurre, y no hay forma de cubrir el 100 % de las
formas de pedir lo mismo. La pregunta de diseño no es *"cómo adivinamos"* sino
**cuánta cobertura se compra con cuánta latencia y cuánta complejidad**.

### 1.1 Corrección a un supuesto de partida

Se planteó incorporar un grafo semántico **para acelerar la búsqueda**. Los
números dicen que la velocidad no es el problema:

| operación | tiempo medido |
|---|---|
| búsqueda por texto sobre abiertas | **25–65 ms** |
| búsqueda + expansión por grafo UNSPSC | **39–51 ms** |
| detalle masticado completo | 43–49 ms |

`[MEDIDO 2026-09-05]` **Agregar el grafo no cuesta latencia perceptible, y no la
ahorra tampoco.** Lo que compra es **cobertura y relevancia**. Vale la pena — por
esa razón, no por velocidad. Decirlo al revés llevaría a optimizar lo que ya está
resuelto.

---

## 2. Qué ya existe y no se estaba usando

Regla aplicada antes de escribir una línea: **buscar lo implementado, medirlo, y
recién ahí decidir.**

| Pieza | Estado | Sirve para |
|---|---|---|
| Tabla **`unspsc`** en el almacén | **4.468 filas**, 4 niveles (55 segmento · 279 familia · 1.084 clase · 3.050 commodity) | Taxonomía oficial de productos y servicios. **Es el grafo semántico, ya poblado** |
| `licitacion_item.unspsc_commodity` | **469.831 de 469.843 ítems codificados (100,0 %)**, 10.123 códigos distintos | Une cada licitación al grafo |
| `strip_accents`, `damerau_levenshtein`, `jaro_winkler_similarity` | **nativas de DuckDB**, sin extensión | Tildes y tolerancia a errores de tipeo |
| Extensión **FTS** de DuckDB | **descargable**, no instalada | Stemming español + ranking BM25 |
| `mp_codes_search` en `mp-mcp` | implementada | Búsqueda de códigos UNSPSC, ya resuelta |

**No hace falta construir un grafo: hay uno oficial, curado por Naciones Unidas,
con el 100 % de los ítems ya codificados contra él.** Construir uno propio sería
reimplementar peor lo que ChileCompra ya publica.

---

## 3. Lo que ya está en producción (capa 1)

`[MEDIDO 2026-09-05]` Búsqueda determinista por tokens normalizados. Sin modelo
de lenguaje.

1. Se quitan tildes **de los dos lados** — `strip_accents` en SQL para el campo,
   `unicodedata` en Python para la consulta.
2. La consulta se parte en palabras; se exige que **todas** aparezcan.
3. Cada palabra se recorta al plural más común (`servicios` → `servicio`), con
   umbrales de largo para no destrozar palabras cortas (`mes` no puede volverse `me`).
4. Orden: lo que coincide en el **título** va antes que lo que sólo coincide en la
   descripción.

Efecto medido:

| consulta | antes | ahora |
|---|---|---|
| `informatica` / `informática` | 3 / 13 | **17 / 17** |
| `mantencion` / `mantención` | 90 / 296 | **385 / 385** |
| `artificial inteligencia` | **0** | **11** |
| `servicios` / `servicio` | 642 / 2088 | **2255 / 2255** |

**Trampa pagada:** normalizar sólo el campo rompe el buscador al revés —
`informática` con tilde cayó de 13 a **cero**. Los dos lados o ninguno.

**Lo que esta capa NO hace:** no entiende sinónimos (`aseo` no encuentra
`limpieza`), no entiende conceptos, y su "stemming" es un recorte de plural, no
un stemmer.

---

## 4. Evidencia de las dos capas propuestas

### 4.1 FTS — stemming español y ranking BM25

Ensayado sobre una **copia aislada** de la tabla `licitacion` (98.000 filas), sin
tocar producción.

| | capa 1 (hoy) | FTS + stemmer español |
|---|---|---|
| `inteligencia artificial` | 11 | **19** (+73 %) |
| `informatica` | 17 | **31** (+82 %) |
| `servicios` / `servicio` | 2255 / 2255 | 2087 / 2087 |
| velocidad | 39 ms | **41 ms** |
| ranking | heurística de 2 niveles | **BM25 real** |
| `aseo` vs `limpieza` | distintos | **también distintos** |

- Índice: **6,2 s** de construcción, 5,06 M filas en las tablas del índice.
- FTS devuelve *menos* en `servicios` porque matchea **palabras completas
  stemmed**, mientras la capa 1 matchea subcadenas (y por eso arrastra
  `autoservicio`). FTS es más preciso; la capa 1 tiene más recall bruto.
- `[MEDIDO]` BM25 pone primero *"CAPACITACIÓN EN INTELIGENCIA ARTIFICIAL"*, no la
  que cierra antes.
- **FTS no acelera nada** a este tamaño de datos. Da recall y relevancia.
- **FTS tampoco resuelve sinónimos.** Eso lo resuelve la §4.2 o nada.

### 4.2 Grafo UNSPSC — el único que resuelve sinónimos

La idea: el término del usuario se busca **en los nombres de la taxonomía**, y las
licitaciones se alcanzan por su código, no por su texto.

**Primer intento, fallido, y por qué importa:** matchear contra `unspsc.nombre`
completo devuelve basura. Ese campo guarda la **ruta entera**
(`segmento / familia / clase`), así que `aseo` matchea *"Ropa, maletas y productos
de aseo personal"* y arrastra `Zapatillas`, `Suéteres` y `Combustibles gaseosos`.
Los resultados **empeoraron**: de 123 a 97, y los 97 equivocados.

**Corregido — matchear sólo la hoja** (`split_part(nombre, '/', -1)`):

| término | sólo texto | sólo grafo | **unión** | tiempo |
|---|---|---|---|---|
| `limpieza` | 66 | 121 | **157 (+138 %)** | 51 ms |
| `aseo` | 123 | 5 | **127** | 42 ms |
| `camion` | 58 | 17 | **67** | 39 ms |
| `informatica` | 16 | 1 | **17** | 37 ms |

`[MEDIDO]` Lo que el grafo aporta y el texto no encuentra, con `aseo`:

> *"CONV SUM DE JABONES ANTISÉPTICOS Y DESINFECTANTES"* · *"Adquisición
> dispensadores región Antofagasta"* · *"CAJAS PLÁSTICAS"*

Licitaciones de aseo cuyo título nunca dice "aseo". **Eso es cobertura semántica
real, obtenida de una taxonomía oficial, sin un solo token de IA.**

**Defecto pendiente, ya detectado:** la hoja se matchea por subcadena, así que
`aseo` matchea `Combustibles g-ASEO-sos`. **Exige frontera de palabra** antes de
construirlo. Sin eso, la capa 2 mete ruido en vez de sacarlo.

---

## 5. Diseño propuesto — tres capas, en unión

```
consulta del usuario
   │
   ├─ capa 1 · tokens normalizados        (ya en produccion)
   ├─ capa 2 · FTS bm25, stemmer espanol  (propuesta)
   └─ capa 3 · grafo UNSPSC por hoja      (propuesta)
                    │
                    ▼
        UNION de codigos, ordenada por relevancia
```

- **Unión, no intersección.** Cada capa aporta resultados que las otras no ven.
- **La respuesta declara qué capa encontró cada resultado.** Un resultado que sólo
  aparece por grafo es una inferencia del sistema, no una coincidencia literal, y
  el usuario tiene derecho a saberlo. Campo propuesto: `via: ["texto"|"fts"|"rubro"]`.
- **`meta.limitaciones` gana una entrada permanente**: la búsqueda no entiende
  conceptos ni intención, sólo palabras y códigos.

### 5.1 Dónde vive el índice — la decisión que hay que tomar

`[MEDIDO]` El índice FTS se guarda como **esquema persistente dentro del archivo
`.duckdb`**, y la documentación de DuckDB dice que **no se actualiza solo**
cuando la tabla cambia. La ingesta reconstruye el almacén entero dos veces al día
con *rename* atómico: **cualquier índice creado por fuera se borra en la siguiente
corrida**.

| | A · lo crea la ingesta | B · base de búsqueda aparte |
|---|---|---|
| Dónde | dentro de `mp.duckdb` | archivo propio, ~**64 MB** |
| Cambios en `mp-mcp` | **sí** — rebuild de imagen y recrear contenedor | **ninguno** |
| Costo operativo | **corta la sesión de WhatsApp de Demeter** | ninguno |
| Costo por sync | ~6 s | ~7 s (0,9 s copia + 6,2 s índice) |
| Consistencia | atómica con el almacén | puede quedar un ciclo atrasada |
| Disco | dentro de los 9,4 GB | +64 MB (hay 47 GB libres) |

**Inclinación: B.** El corte de la sesión de Demeter es un costo real y recurrente
—cada vez que haya que tocar el índice—, contra 64 MB y un desfase máximo de doce
horas en un dato que ya se actualiza dos veces al día. La consistencia atómica no
compra nada aquí: el buscador ya declara su `as_of`.

Si se elige B, el paso vive en `mp-sync.sh` (cron del host), **no** dentro del
contenedor.

---

## 6. Lo que este diseño NO hace, dicho antes de construirlo

- **No entiende intención ni conceptos.** "Algo para que el hospital no se quede
  sin insumos" no va a funcionar. Eso requiere embeddings o un modelo, y los dos
  agregan latencia e infraestructura.
- **No cubre sinónimos fuera de la taxonomía.** Si UNSPSC no relaciona dos
  términos, el buscador tampoco.
- **No corrige errores de tipeo todavía.** `damerau_levenshtein` y
  `jaro_winkler_similarity` están disponibles y sin usar; es una capa 4 posible,
  no incluida acá.
- **No incluye Compra Ágil.** Sigue bloqueada por G-CUOTA (D-016).

---

## 7. Verificación exigida antes de declararlo funcionando

Cada sonda con umbral o control negativo. Una que pase por haber podido correr no
prueba nada.

| # | Afirmación | Umbral / control negativo |
|---|---|---|
| M-1 | El grafo no mete ruido | `aseo` **no** puede devolver `Combustibles gaseosos`. Control de la falla ya medida |
| M-2 | La unión sólo suma | Para 20 términos, `union >= max(texto, grafo)` en todos |
| M-3 | Tildes simétricas | Para 10 pares con/sin tilde, mismo `total` |
| M-4 | Orden de palabras irrelevante | `"a b"` y `"b a"` dan el mismo `total` |
| M-5 | La procedencia no miente | Un resultado con `via: ["rubro"]` **no** contiene el término en su texto |
| M-6 | Latencia | p95 < 300 ms sobre 20 términos reales, medido por el camino público |
| M-7 | El índice sobrevive al sync | Tras una corrida de `mp-sync.sh`, el índice existe y responde |
| M-8 | Control negativo del índice | Con el índice ausente, el buscador **degrada a capa 1 y lo declara**, no falla |

---

## 8. Decisiones abiertas

1. **§5.1: opción A o B.** Es la única que tiene costo operativo real.
2. **¿`via` se muestra en la interfaz?** Mi inclinación: sí, discreto — un
   resultado inferido por rubro no es lo mismo que una coincidencia literal.
3. **Paginación.** Hoy el frontend pide 50 y no pagina: con `total: 2255` el
   usuario ve 50 y no hay forma de ver el resto. El endpoint ya soporta `desde`.
   Es independiente de este motor, pero se nota más cuanto mejor busca.
