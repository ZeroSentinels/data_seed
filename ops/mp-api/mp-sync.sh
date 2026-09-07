#!/bin/sh
# Sincronizacion del almacen de Mercado Publico.
#
# HORARIO: lo dispara el cron 5 veces al dia, a las 11/14/17/20/23 UTC, que en
# Chile son 08/11/14/17/20 en verano y una hora menos en invierno. Las horas van
# en UTC a proposito: [MEDIDO 2026-08-21, re-verificado 2026-09-07] el cron de
# Ubuntu (3.0pl1) NO soporta CRON_TZ -- cero menciones en su manual, es una
# extension de cronie -- asi que anclarlo a America/Santiago desde el crontab no
# funciona. La grilla cada 3 h cubre el horario habil chileno en los dos
# regimenes, para que el corrimiento estacional no deje ningun tramo sin cubrir.
#
# POR QUE EN HORARIO HABIL Y NO SOLO DE MADRUGADA: [MEDIDO 2026-09-07] la
# corrida de las 04:00 Chile traia +2, +32, +755 filas; la de las 16:00 traia
# +1.101, +34.439, +71.973. Se publica durante el dia laboral, asi que una
# ingesta nocturna no tiene nada nuevo que traer y deja el dia en curso vacio
# hasta la madrugada siguiente.
#
# El log se recorta a 2 MB antes de cada corrida: sin esto crece sin techo y el
# punto de todo este trabajo es no comerse el disco.
LOG=/var/log/mp-sync.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 2097152 ] && tail -c 1048576 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

SALIDA=/tmp/mp-sync-salida.$$
echo "===== $(date -Is) inicio ($(TZ=America/Santiago date '+%H:%M %Z')) =====" >> "$LOG"

# --meses 2: el mes en curso se rearma a diario en la fuente y el anterior puede
# recibir correcciones. Los otros 10 ya estan cargados y no se vuelven a bajar.
docker exec mp-mcp mp-ingest sync --meses 2 --retencion 36 > "$SALIDA" 2>&1
CODIGO=$?
cat "$SALIDA" >> "$LOG"

# --- Distinguir el fallo real del ZIP vacio del mes en curso ----------------
# [MEDIDO 2026-09-07] ChileCompra publica el ZIP mensual del mes EN CURSO con la
# cabecera correcta y CERO filas, y lo llena al cerrar el mes: 2026-8 pesa 11 MB,
# 2026-9 pesa 870 bytes con 1 sola linea (la cabecera).
#
# El chequeo `if n < 100_000` de bulk.py lo rechaza con el mensaje "esto es la
# cascara HTML de su SPA o un error, no datos". ESO ES FALSO -- es un ZIP valido
# (empieza con PK, contiene lic_2026-9.csv). Control negativo: un mes que no
# existe devuelve HTTP 404 de 215 bytes, no un ZIP.
#
# Consecuencia: el script reportaba FALLO todos los dias de todos los meses, y
# una alarma que suena siempre no la lee nadie. Arreglar bulk.py exigiria
# rebuild de la imagen y recrear mp-mcp, lo que corta la sesion de WhatsApp de
# Demeter; se reconoce el caso aca, en el host, sin tocar el contenedor.
MES_ACTUAL=$(date -u +%Y-%-m)
if [ "$CODIGO" -ne 0 ]; then
    # Se cuentan URLs DISTINTAS, no lineas. [MEDIDO 2026-09-07] el mismo aviso de
    # 2026-9.zip aparece 4 veces en la salida (el JSON de resumen lo repite mas
    # la linea de "cargas omitidas"), asi que un umbral por cantidad de lineas
    # da un numero arbitrario que no distingue nada. Por URL distinta si: si
    # aparece una sola y es la del mes en curso, no hay fallo real.
    URLS_FALLIDAS=$(grep -o "https://[^ ]*\.zip devolvio solo" "$SALIDA" \
                    | sort -u | wc -l)
    DEL_MES=$(grep -c "lic-da/$MES_ACTUAL\.zip devolvio solo" "$SALIDA")
    OTROS_ERRORES=$(grep -c "Traceback\|ErrorBulk: [^h]" "$SALIDA")

    if [ "$URLS_FALLIDAS" -eq 1 ] && [ "$DEL_MES" -gt 0 ] && [ "$OTROS_ERRORES" -eq 0 ]; then
        echo "$(date -Is) OK (el bulk de $MES_ACTUAL viene vacio: ChileCompra" \
             "publica el mes en curso con la cabecera y cero filas, y lo llena al" \
             "cerrarlo. No es un fallo. La API cubre el dia a dia)" >> "$LOG"
        CODIGO=0
    fi
fi

if [ "$CODIGO" -eq 0 ]; then
    echo "$(date -Is) OK" >> "$LOG"
else
    echo "$(date -Is) FALLO (ver arriba). El almacen anterior sigue servido." >> "$LOG"
fi
rm -f "$SALIDA"

# --- indice de busqueda del buscador de Publica ------------------------------
# Se reconstruye SIEMPRE, haya fallado la ingesta o no: si fallo, el almacen
# anterior sigue servido y el indice tiene que corresponder a ESE almacen.
#
# Corre en un contenedor efimero con el volumen en lectura-escritura. mp-api lo
# monta en solo lectura y detecta el archivo nuevo por inodo, sin reiniciarse.
# Escribe a .next y hace rename atomico: mp-api nunca ve un indice a medio hacer.
echo "$(date -Is) indice de busqueda: construyendo" >> "$LOG"
if docker run --rm \
     -v mp-data:/data/mp \
     -v /docker/mp-api/construir_indice.py:/c.py:ro \
     --entrypoint python mp-mcp:0.5.2 /c.py >> "$LOG" 2>&1; then
    echo "$(date -Is) indice de busqueda: OK" >> "$LOG"
else
    # El buscador NO se cae por esto: mp-api degrada a busqueda por texto sobre
    # el almacen y lo declara en meta.limitaciones. Pero el vigia tiene que verlo.
    echo "$(date -Is) indice de busqueda: FALLO. El buscador degrada a texto." >> "$LOG"
fi

exit 0
