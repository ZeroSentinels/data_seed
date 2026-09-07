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
| `mp-sync.sh` | Cron del host, 2 veces al día: ingesta y después índice |
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
