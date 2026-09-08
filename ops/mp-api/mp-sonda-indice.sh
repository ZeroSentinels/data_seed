#!/bin/sh
# Sonda detectiva del buscador de Publica. Corre DESPUES de cada corrida del cron
# de ingesta (mp-sync.sh) y responde tres preguntas, midiendo, no leyendo logs:
#
#   1. El inodo de mp_busqueda.duckdb que tiene abierto mp-api es el mismo que
#      esta en disco? (el bug del 2026-09-08: mp-api servia un inodo BORRADO y
#      la busqueda quedaba congelada 3 h, en silencio, con el sello al dia)
#   2. El indice tiene las mismas filas que el almacen? (si la reconstruccion
#      fallo, el indice corresponde a un almacen anterior)
#   3. El dato esta fresco? (max(fecha_publicacion) del almacen)
#
# Por que existe: el 2026-09-08 la falla vivio tres reconstrucciones porque el
# unico aviso era un renglon en /var/log/mp-sync.log que nadie lee. Un control
# detectivo que nadie verifica corriendo no es un control.
#
# Se autorepara SOLO en el caso 1, que es el unico con remedio conocido y medido:
# reiniciar mp-api (1,6-3 s de corte). Una sola vez por corrida, y vuelve a medir.
# Los casos 2 y 3 NO se tocan: no hay remedio automatico honesto para ellos.
#
# Salidas: /var/log/mp-sonda-indice.log (humano) y journald con prioridad
# daemon.err en las alertas (journalctl -t mp-sonda-indice -p err).
set -u

LOG=/var/log/mp-sonda-indice.log
DAT=/var/lib/docker/volumes/mp-data/_data
IMG=mp-mcp:0.5.2
DIAS_FRESCURA=4          # tolera un fin de semana largo sin publicaciones
FORZAR="${MP_SONDA_FORZAR_FALLA:-}"   # solo para probar el camino de alerta

ESTADO=ok
say()    { echo "$(date -Is) $*" >> "$LOG"; }
alerta() { ESTADO=alerta; logger -t mp-sonda-indice -p daemon.err "$*" 2>/dev/null; say "ALERTA $*"; }

# --- 0. No medir sobre una corrida a medio hacer -----------------------------
# El almacen se escribe primero y el indice se reconstruye al final: un desfase
# durante la corrida es esperado, no una falla.
if pgrep -f "/usr/local/bin/mp-sync.sh" >/dev/null 2>&1; then
    say "omitida: mp-sync.sh esta corriendo"
    exit 0
fi

inodo_disco() { stat -c %i "$DAT/$1" 2>/dev/null || echo "-"; }

# Inodo que tiene ABIERTO el proceso, leido de /proc en vez de lsof: no depende
# de un paquete extra y ademas delata el sufijo "(deleted)" del enlace.
servido() {
    _n="$1"; _pid=$(docker inspect -f '{{.State.Pid}}' mp-api 2>/dev/null) || return 1
    [ -n "${_pid:-}" ] && [ "$_pid" != "0" ] || return 1
    for fd in /proc/"$_pid"/fd/*; do
        _t=$(readlink "$fd" 2>/dev/null) || continue
        case "$_t" in
            "/data/mp/$_n"|"/data/mp/$_n "*)
                case "$_t" in *"(deleted)"*) echo "BORRADO"; return 0;; esac
                stat -L -c %i "$fd" 2>/dev/null && return 0
                ;;
        esac
    done
    echo "-"
}

filas() {
    docker run --rm -v mp-data:/data/mp:ro --entrypoint python "$IMG" -c "
import duckdb, sys
try:
    c = duckdb.connect('/data/mp/$1', read_only=True)
    print(c.execute('select count(*) from $2').fetchone()[0])
except Exception as e:
    print('-')
" 2>/dev/null | tail -1
}

# --- 1. inodo servido vs inodo en disco --------------------------------------
D_IDX=$(inodo_disco mp_busqueda.duckdb)
S_IDX=$(servido mp_busqueda.duckdb)
D_ALM=$(inodo_disco mp.duckdb)
S_ALM=$(servido mp.duckdb)
[ "$FORZAR" = "inodo" ] && S_IDX="999999999"

REINICIO="no"
if [ "$S_IDX" != "$D_IDX" ] || [ "$S_ALM" != "$D_ALM" ]; then
    alerta "mp-api sirve otro archivo que el que hay en disco:" \
           "indice servido=$S_IDX disco=$D_IDX | almacen servido=$S_ALM disco=$D_ALM." \
           "Es el bug del inodo congelado: la busqueda responde con datos viejos" \
           "y el sello dice que estan al dia. Reiniciando mp-api una vez."
    T0=$(date +%s%3N)
    docker restart mp-api >/dev/null 2>&1
    i=0
    while [ "$i" -lt 60 ]; do
        docker exec mp-api python -c "
import os,json,urllib.request
r=urllib.request.Request('http://127.0.0.1:8757/api/buscar',
  data=json.dumps({'texto':'a','limite':1}).encode(),
  headers={'Authorization':'Bearer '+os.environ['MP_API_KEY'],'Content-Type':'application/json'})
urllib.request.urlopen(r,timeout=8).read(1)" >/dev/null 2>&1 && break
        i=$((i+1)); sleep 1
    done
    REINICIO="si ($(( $(date +%s%3N) - T0 )) ms)"
    S_IDX=$(servido mp_busqueda.duckdb); S_ALM=$(servido mp.duckdb)
    if [ "$S_IDX" != "$D_IDX" ] || [ "$S_ALM" != "$D_ALM" ]; then
        alerta "el reinicio NO alcanzo: sigue sirviendo indice=$S_IDX (disco $D_IDX)," \
               "almacen=$S_ALM (disco $D_ALM). Hace falta una persona."
    else
        say "reparado por reinicio: indice=$S_IDX almacen=$S_ALM"
    fi
fi

# --- 2. filas del indice vs filas del almacen --------------------------------
F_IDX=$(filas mp_busqueda.duckdb licitacion_texto)
F_ALM=$(filas mp.duckdb licitacion)
[ "$FORZAR" = "filas" ] && F_IDX=$((${F_ALM:-0} - 42))

if [ "$F_IDX" = "-" ] || [ "$F_ALM" = "-" ]; then
    alerta "no se pudo contar: indice=$F_IDX almacen=$F_ALM. Si el indice no abre," \
            "el buscador esta en modo reducido (sin FTS ni rubro) hasta la proxima" \
            "reconstruccion, y lo declara en meta.limitaciones."
elif [ "$F_IDX" != "$F_ALM" ]; then
    alerta "el indice no corresponde al almacen: licitacion_texto=$F_IDX vs" \
           "licitacion=$F_ALM ($((F_ALM - F_IDX)) de diferencia). La reconstruccion" \
           "fallo o quedo a medias; el reinicio no arregla esto. Ver 'indice de" \
           "busqueda' en /var/log/mp-sync.log."
fi

# --- 3. frescura del dato ----------------------------------------------------
DIAS=$(docker run --rm -v mp-data:/data/mp:ro --entrypoint python "$IMG" -c "
import duckdb
try:
    c = duckdb.connect('/data/mp/mp.duckdb', read_only=True)
    # Sin date_diff a proposito: su primer argumento es un string SQL y las
    # comillas simples ya estan tomadas por el literal de python. Restar dos
    # DATE en DuckDB da los dias directo.
    print(c.execute('select current_date - cast(max(fecha_publicacion) as date) from licitacion').fetchone()[0])
except Exception:
    print('-')
" 2>/dev/null | tail -1)
[ "$FORZAR" = "frescura" ] && DIAS=99

if [ "$DIAS" = "-" ] || [ -z "$DIAS" ]; then
    alerta "no se pudo leer la frescura del almacen."
elif [ "$DIAS" -gt "$DIAS_FRESCURA" ]; then
    alerta "la licitacion mas nueva del almacen tiene $DIAS dias (tope" \
           "$DIAS_FRESCURA). La ingesta no esta trayendo datos nuevos."
fi

say "estado=$ESTADO indice_inodo=$S_IDX/$D_IDX almacen_inodo=$S_ALM/$D_ALM filas=$F_IDX/$F_ALM dias_ultimo_publicado=$DIAS reinicio=$REINICIO"
exit 0
