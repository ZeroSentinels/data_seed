# `mp-api` — backend del buscador de licitaciones

Copia versionada de lo que corre en el VPS. **La copia viva está en el servidor**;
esto existe para que el código tenga historia, revisión y CI, no como fuente de
despliegue. Si cambian, gana el servidor y hay que traerlo acá en el mismo PR.

Contrato: [`docs/architecture/publica-buscador.md`](../../docs/architecture/publica-buscador.md)
Motor de búsqueda: [`docs/architecture/publica-buscador-motor.md`](../../docs/architecture/publica-buscador-motor.md)

| Archivo | Qué es |
|---|---|
| `app.py` | El servicio. Dos endpoints más `/health`. Sólo lectura sobre el almacén |
| `construir_indice.py` | Construye la base de búsqueda (FTS + árbol UNSPSC). Lo llama `mp-sync.sh` |
| `mp-sync.sh` | Cron del host, 4 veces al día en horario hábil de Chile: ingesta y después índice |
| `sondas.py` | Sondas del contrato (S-1..S-10) |
| `verificar_motor.py` | Sondas del motor de búsqueda (M-2..M-6) |

## Por qué el índice vive en una base aparte

`[MEDIDO 2026-09-05]` El índice FTS se guarda como esquema persistente **dentro**
del archivo `.duckdb`, y la ingesta reconstruye el almacén entero dos veces al día
con *rename* atómico: cualquier índice creado por fuera se borraría. Ponerlo
dentro exigiría que lo creara la ingesta → rebuild de la imagen de `mp-mcp` →
recrear ese contenedor → **cortar la sesión de WhatsApp de Demeter**, y volver a
pagarlo cada vez que se tocara el índice.

La base de búsqueda vive en el **mismo volumen que `mp-api` ya monta**, así que
aparece y se actualiza **sin recrear ni reiniciar nada, nunca**. `mp-api` detecta
el archivo nuevo por inodo.

## Degradación

Si el índice falta o no abre, el buscador **no falla**: cae a búsqueda por texto
sobre el almacén y lo declara en `meta.limitaciones` con severidad alta, y en
`/health` con `"indice": "ausente"`. Verificado escondiendo el archivo: 200,
66 resultados en vez de 157, aviso alto, y recuperación automática al devolverlo.

## Correr las sondas

```sh
export MP_API_KEY=...      # de /docker/mp-api/.env en el VPS
python3 sondas.py          http://<ip-interna>:8757
python3 verificar_motor.py http://<ip-interna>:8757
```

## `Busqueda._abrir()` cierra antes de abrir — y por qué importa

`[MEDIDO 2026-09-08]` DuckDB mantiene una **cache de instancias por ruta**. Si al
reabrir el índice se llama `duckdb.connect()` con la conexión vieja todavía viva,
devuelve la **instancia cacheada, atada al inodo borrado**: el archivo nuevo nunca
se abre.

El síntoma es silencioso, que es lo peor de todo: `_abrir()` "tiene éxito",
`self.firma` se actualiza al inodo nuevo, la condición de `viva` no vuelve a
dispararse, y el API **no** declara *"Búsqueda en modo reducido"*. El buscador
sirve un `as_of` fresco sobre un índice congelado en el que había al arrancar el
contenedor, y la brecha crece en cada corrida.

Medido antes del arreglo, 1 h 45 después de la corrida de las 14:06 UTC:

| | `licitacion_texto` |
|---|---|
| índice **servido** (inodo `(deleted)`, leído por `/proc/<pid>/fd/`) | 98.472 |
| índice en disco | 98.561 |

**89 licitaciones invisibles.** `Almacen._refrescar()` y `mp_mcp/store.py` ya
cerraban primero; `Busqueda._abrir()` era el único de los tres invertido.

**Contrapartida aceptada:** cerrando primero, un índice que no abra deja la
búsqueda en modo reducido hasta la próxima reconstrucción — **pero declarado** en
`meta.limitaciones`. Se prefiere el fallo declarado al fallo callado.

**Cómo verificarlo — no alcanza con leer el código, ya se demostró:**

```sh
# reconstruir el índice como lo hace el cron, sin reiniciar mp-api
docker run --rm -v mp-data:/data/mp -v /docker/mp-api/construir_indice.py:/c.py:ro   --entrypoint python mp-mcp:0.5.2 /c.py
# forzar una consulta y mirar los handles: NINGUNO debe decir (deleted)
lsof -n | grep duckdb | grep uvicorn
docker run --rm -v mp-data:/data/mp alpine ls -li /data/mp/mp_busqueda.duckdb
```

El inodo que `uvicorn` tiene abierto debe ser el mismo que el de `ls -li`.

## `orden`: el defecto es `reciente`, y es deliberado

`[MEDIDO 2026-09-08 20:2x UTC]` Antes el orden estaba fijo en `bm25 desc,
fecha_cierre asc`: relevancia y despues lo que cierra antes. Una licitacion
publicada hoy cierra mas tarde, asi que **se hundia bajo el corte de la pagina**.
Buscando `"servicio"` (2.057 resultados) las tres primeras eran del 04, 07 y 04
de septiembre: **ninguna del dia**, con el sello diciendo `as_of: 2026-09-08`.
Parecia ingesta atrasada y no lo era.

`POST /api/buscar` acepta `orden`:

| valor | SQL | medido con `"servicio"` |
|---|---|---|
| `reciente` **(defecto)** | `fecha_publicacion desc nulls last, codigo` | primeras del **2026-09-08** |
| `cierre` | `fecha_cierre asc nulls last, codigo` | cierran hoy |
| `relevancia` | `bm25 desc, fecha_cierre asc` (el de antes) | 04, 07 |

El defecto es `reciente` porque **el frontend no manda `orden`**: con cualquier
otro defecto el arreglo no se ve. Sin texto de busqueda no hay relevancia que
ordenar, asi que `relevancia` cae a `cierre`.

## Una clave desconocida es un 400, no una busqueda

`{"consulta": "servicio"}` devolvia **200 con el universo entero**: la clave se
ignoraba y no quedaba ninguna senal de que el texto no se habia aplicado. Ahora
el endpoint valida contra `CLAVES_BUSCAR` (`texto`, `solo_abiertas`, `region`,
`limite`, `desde`, `orden`) y una clave de mas responde
`400 Claves no reconocidas: ...`. Verificado que los dos unicos clientes
—`site/publica-buscador.js` y el proxy `api/buscar.js`, que reenvia el cuerpo
tal cual— mandan solo claves de esa lista.

## Lo que NO está acá

`sync.py` (la ingesta) vive en el repo `mcp-mercado-publico`, no en éste. Su
parche del techo de disco sigue **sólo dentro del contenedor** `mp-mcp`: una
recreación de la imagen lo borra.
