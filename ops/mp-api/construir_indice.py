"""Construye la base de busqueda del buscador de Publica.

Corre DESPUES de cada sync, desde el cron del host. Nunca desde mp-api, que
monta el volumen en solo lectura.

Por que una base aparte y no un indice dentro de mp.duckdb:
  [MEDIDO 2026-09-05] el indice FTS se guarda como esquema persistente dentro
  del archivo, y la doc de DuckDB dice que no se actualiza solo cuando la tabla
  cambia. La ingesta reconstruye mp.duckdb entero dos veces al dia con rename
  atomico, asi que cualquier indice creado por fuera se borraria. Ponerlo dentro
  exigiria que lo creara la ingesta -> rebuild de la imagen mp-mcp -> recrear el
  contenedor -> cortar la sesion de WhatsApp de Demeter, y volver a pagarlo cada
  vez que se toque el indice.

  Esta base vive en el MISMO volumen que mp-api ya monta, asi que mp-api la abre
  sin ningun cambio de compose y sin reiniciarse nunca.

Escribe a un archivo .next y hace rename atomico, el mismo patron que la
ingesta: un lector nunca ve un indice a medio construir.
"""
import os
import sys
import time
import duckdb

ORIGEN = os.environ.get("MP_DB", "/data/mp/mp.duckdb")
DESTINO = os.environ.get("MP_BUSQUEDA", "/data/mp/mp_busqueda.duckdb")
EXT = os.environ.get("MP_FTS_EXT", "/data/mp/fts.duckdb_extension")
TMP = DESTINO + ".next"

t0 = time.perf_counter()
for f in (TMP, TMP + ".wal"):
    if os.path.exists(f):
        os.remove(f)

con = duckdb.connect(TMP)
con.execute(f"install '{EXT}'")
con.execute("load fts")

con.execute(f"attach '{ORIGEN}' as o (read_only)")

# -- 1. texto de las licitaciones, para el indice FTS ------------------------
# Se copian TODAS las columnas que /api/buscar necesita para filtrar, contar y
# calcular metricas. Asi la busqueda entera corre dentro de esta base, sin cruzar
# al almacen: [MEDIDO 2026-09-05] cruzando bases, 'servicio' tardaba 4,6 s porque
# habia que mover 42.000 codigos por Python. Autosuficiente, no cruza nada.
con.execute("""
    create table licitacion_texto as
    select codigo, nombre, coalesce(descripcion, '') descripcion,
           estado, fecha_publicacion, fecha_cierre, tipo,
           region_comprador, organismo_nombre, organismo_codigo,
           monto_estimado_clp, visibilidad_monto, n_oferentes, url_ficha,
           -- Texto ya normalizado. [MEDIDO 2026-09-05] calcular
           -- strip_accents(lower(descripcion)) en caliente sobre las 98.000
           -- filas costaba 805 ms de los 830 de la consulta completa. Precomputado
           -- se paga una vez por sync en vez de una vez por busqueda.
           strip_accents(lower(nombre)) nombre_norm,
           strip_accents(lower(coalesce(descripcion, ''))) descripcion_norm
      from o.licitacion""")
n_lic = con.execute("select count(*) from licitacion_texto").fetchone()[0]

# -- 2. hoja del arbol UNSPSC, normalizada -----------------------------------
# unspsc.nombre guarda la RUTA COMPLETA (segmento / familia / clase). Matchear
# contra la ruta entera devuelve basura: 'aseo' matchea "Ropa, maletas y
# productos de aseo personal" y arrastra Zapatillas y Sueteres. [MEDIDO] los
# resultados empeoraban de 123 a 97. Se guarda SOLO la hoja, ya normalizada,
# para no pagar strip_accents en cada consulta.
con.execute("""
    create table rubro as
    select codigo,
           trim(split_part(nombre, '/', -1)) hoja,
           strip_accents(lower(trim(split_part(nombre, '/', -1)))) hoja_norm
      from o.unspsc
     where nivel = 'commodity'""")
n_rub = con.execute("select count(*) from rubro").fetchone()[0]

# -- 3. que licitaciones tocan cada rubro ------------------------------------
con.execute("""
    create table rubro_licitacion as
    select distinct li.unspsc_commodity codigo_rubro, li.codigo_licitacion codigo
      from o.licitacion_item li
     where li.unspsc_commodity is not null""")
n_rl = con.execute("select count(*) from rubro_licitacion").fetchone()[0]

con.execute("detach o")

# -- 4. indice FTS con stemmer espanol ---------------------------------------
t1 = time.perf_counter()
con.execute("""
    PRAGMA create_fts_index('licitacion_texto', 'codigo', 'nombre', 'descripcion',
                            stemmer = 'spanish', stopwords = 'none',
                            strip_accents = 1, lower = 1, overwrite = 1)""")
t_fts = time.perf_counter() - t1

# -- 5. sello, para que mp-api sepa contra que almacen se construyo ----------
con.execute("create table sello as select current_timestamp construido_en, ? as origen_mtime",
            [str(os.path.getmtime(ORIGEN))])
con.close()

# -- 6. rename atomico -------------------------------------------------------
os.replace(TMP, DESTINO)
if os.path.exists(TMP + ".wal"):
    os.remove(TMP + ".wal")
os.chmod(DESTINO, 0o644)

tam = os.path.getsize(DESTINO) / 1048576
print(f"OK  licitaciones={n_lic}  rubros={n_rub}  rubro_licitacion={n_rl}  "
      f"fts={t_fts:.1f}s  total={time.perf_counter()-t0:.1f}s  tam={tam:.0f}MB")
