#!/bin/sh
# Sincronizacion del almacen de Mercado Publico. Lo llama el cron 2 veces al dia.
#
# El log se recorta a 2 MB antes de cada corrida: sin esto crece sin techo y el
# punto de todo este trabajo es no comerse el disco.
LOG=/var/log/mp-sync.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 2097152 ] && tail -c 1048576 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "===== $(date -Is) inicio =====" >> "$LOG"
# --meses 2: el mes en curso se rearma a diario en la fuente y el anterior puede
# recibir correcciones. Los otros 10 ya estan cargados y no se vuelven a bajar.
if docker exec mp-mcp mp-ingest sync --meses 2 --retencion 36 >> "$LOG" 2>&1; then
    echo "$(date -Is) OK" >> "$LOG"
else
    echo "$(date -Is) FALLO (ver arriba). El almacen anterior sigue servido." >> "$LOG"
fi

# --- indice de busqueda del buscador de Publica ------------------------------
# Se reconstruye SIEMPRE, haya fallado la ingesta o no: si fallo, el almacen
# anterior sigue servido y el indice tiene que corresponder a ESE almacen. No
# reconstruirlo dejaria el indice apuntando a un snapshot que ya no existe.
#
# Corre en un contenedor efimero con el volumen en lectura-escritura. mp-api lo
# monta en solo lectura y detecta el archivo nuevo por inodo, sin reiniciarse:
# por eso este paso nunca recrea ni reinicia nada.
#
# Escribe a .next y hace rename atomico, igual que la ingesta: mp-api nunca ve
# un indice a medio construir.
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
