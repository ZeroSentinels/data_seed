"""mp-api -- los dos endpoints del buscador de licitaciones de Publica.

Contrato: docs/architecture/publica-buscador.md del repo del sitio.

Solo lectura sobre el almacen. Dos capas: el volumen se monta :ro y DuckDB se
abre con read_only=True. Ni un INSERT es posible aunque el codigo tuviera un bug.

No usa la clase Store de mp_mcp a proposito: Store abre ademas catalogo.duckdb en
lectura-escritura (perezosamente) y sobre un montaje :ro eso reventaria. Se copia
solo la parte que importa -- reabrir cuando la ingesta publica un snapshot nuevo.
"""
import json
import os
import re
import unicodedata
from pathlib import Path

import duckdb
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

DB = os.environ.get("MP_DB", "/data/mp/mp.duckdb")
API_KEY = os.environ.get("MP_API_KEY", "")      # vacio = sin auth (modo interno)
LIMITE_MAX = 50
TEXTO_MAX = 120

FUENTE = "ChileCompra - Mercado Publico"
LIM_COMPRA_AGIL = {
    "limitacion": ("Compra Agil no aparece aca porque no genera una licitacion: "
                   "es un mecanismo de compra directa. Sus ordenes si estan en la base."),
    "severidad": "media",
}

CODIGO_RE = re.compile(r"^[0-9A-Za-z]+-[0-9A-Za-z]+-[0-9A-Za-z]+$")

# -- conexion ---------------------------------------------------------------

class Almacen:
    """Conexion de solo lectura que se reabre cuando la ingesta rota el archivo.

    La ingesta construye mp.next.duckdb aparte y hace un rename atomico. En Linux
    el rename no rompe al lector: conserva el inodo viejo hasta que reabra. Sin
    esta reapertura el servicio serviria el snapshot anterior para siempre --  y
    ademas mantendria fijados 10 GB de un inodo que ya nadie mas referencia.
    """

    def __init__(self, ruta: str):
        self.ruta = ruta
        self.con = duckdb.connect(ruta, read_only=True)
        self.firma = self._firma()

    def _firma(self):
        try:
            s = Path(self.ruta).stat()
            return (s.st_ino, s.st_mtime_ns, s.st_size)
        except OSError:
            return None

    def _refrescar(self):
        actual = self._firma()
        if actual is None or actual == self.firma:
            return
        try:
            self.con.close()
        except Exception:
            pass
        self.con = duckdb.connect(self.ruta, read_only=True)
        self.firma = actual

    def filas(self, sql, params=None):
        self._refrescar()
        cur = self.con.execute(sql, params or [])
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def una(self, sql, params=None):
        f = self.filas(sql, params)
        return f[0] if f else None


ALM = Almacen(DB)

# -- helpers ----------------------------------------------------------------

def _fecha(v):
    return v.isoformat() if hasattr(v, "isoformat") else v


def _limpiar(fila):
    return {k: _fecha(v) for k, v in fila.items()}


def _as_of():
    """Fecha de corte del almacen, con deteccion de carga incompleta y de atraso.

    Devuelve (as_of, limitaciones_extra).

    Por que no se lee ingesta_log.ok: [MEDIDO 2026-09-05] la corrida del
    2026-09-04 19:16 escribio ok=True en esa tabla mientras el wrapper la
    registraba como FALLO -- el ZIP mensual de ChileCompra devolvio 870 bytes
    (la cascara HTML de su SPA) y esa carga se omitio. Preguntarle a la ingesta
    si le fue bien habria dicho que si.

    Por que NO se compara el ultimo dia: el dia mas nuevo esta parcial por
    construccion -- la fuente publica durante el dia y el bulk llega con atraso.
    Alarmar sobre el es garantia de falso positivo diario, y una alarma que
    siempre suena no la lee nadie. Se compara el ANTEPENULTIMO dia disponible,
    que a esa altura ya deberia estar completo. [MEDIDO] con el umbral sobre el
    ultimo dia, el 2026-09-04 dio 270 contra una mediana de 421 (0,64) y no
    disparo por 18 filas: el umbral estaba mal puesto y ademas sobre el dia
    equivocado.
    """
    r = ALM.una("select max(fecha_publicacion) f, max(_ingerido_en) i from licitacion")
    as_of = _fecha(r["f"]) if r and r["f"] else None
    # Instante real de la ultima escritura, en UTC y con hora. as_of es una FECHA
    # (el ultimo dia con licitaciones publicadas) y no sirve para decirle al
    # usuario "actualizado hace X": el 2026-09-07 a las 09:53 de Chile as_of
    # decia 2026-09-04 -- correcto como cobertura de datos, inutil como senal de
    # frescura del sistema. Son dos cosas distintas y viajan por separado.
    actualizado = r["i"].isoformat() + "Z" if r and r.get("i") else None
    lims = []

    # 1) Atraso: es la senal robusta. Si la ingesta murio, esto crece solo.
    atraso = ALM.una(
        "select date_diff('day', max(fecha_publicacion), current_date) d from licitacion")
    dias_atraso = int(atraso["d"]) if atraso and atraso["d"] is not None else None
    if dias_atraso is not None and dias_atraso > 2:
        lims.append({
            "limitacion": (
                f"Los datos estan atrasados {dias_atraso} dias: el ultimo dia cargado "
                f"es {as_of}. La ingesta corre dos veces al dia; este atraso indica "
                f"que fallo."),
            "severidad": "alta",
        })

    # 2) Carga parcial de un dia habil que ya deberia estar completo.
    #    Solo dias habiles: [MEDIDO 2026-09-05] los fines de semana traen 1 a 6
    #    licitaciones contra 378-501 de un dia habil -- una caida del 99%. Sin
    #    este filtro la sonda gritaria falso positivo cada lunes y cada martes,
    #    que es la forma mas rapida de que nadie vuelva a mirar la alarma.
    dias = ALM.filas(
        """select fecha_publicacion d, count(*) n from licitacion
            where fecha_publicacion >= (select max(fecha_publicacion) - 16 from licitacion)
              and dayofweek(fecha_publicacion) between 1 and 5
            group by 1 order by 1""")
    if len(dias) >= 5:
        objetivo = dias[-2]              # el ultimo se excluye: siempre parcial
        previos = sorted(d["n"] for d in dias[:-2])
        mediana = previos[len(previos) // 2]
        if mediana and objetivo["n"] < mediana * 0.6:
            lims.append({
                "limitacion": (
                    f"La carga del {_fecha(objetivo['d'])} quedo incompleta: "
                    f"{objetivo['n']} licitaciones frente a una mediana de {mediana} "
                    f"en los dias previos. La fuente puede haber fallado."),
                "severidad": "alta",
            })
    return as_of, lims, actualizado


def _meta(extra=None):
    as_of, lims, actualizado = _as_of()
    return {
        "fuente": FUENTE,
        "as_of": as_of,
        # Cuando corrio la ingesta por ultima vez, en UTC. Distinto de as_of:
        # as_of = hasta que dia hay licitaciones; actualizado_en = cuando lo
        # trajimos. El frontend muestra el segundo como "actualizado hace X".
        "actualizado_en": actualizado,
        "ingesta_cada": "4 veces al dia en horario habil de Chile",
        "limitaciones": [LIM_COMPRA_AGIL] + lims + list(extra or []),
    }


def _autorizado(request):
    if not API_KEY:
        return True
    cab = request.headers.get("authorization", "")
    return cab.startswith("Bearer ") and cab[7:] == API_KEY


def _error(status, msg):
    return JSONResponse({"error": msg}, status_code=status)

def _raiz(palabra):
    """Recorta el plural castellano mas comun. NO es un stemmer.

    Como el match es por subcadena, buscar la raiz encuentra tambien la forma
    plural: 'computador' encuentra 'computadores'. Sin esto el buscador es
    asimetrico -- [MEDIDO 2026-09-05] 'servicio' devolvia 2.088 abiertas y
    'servicios' solo 642, la misma pregunta con un 69% menos de respuesta.

    Los umbrales de largo evitan destrozar palabras cortas: 'mes' no puede
    volverse 'me', 'gas' no puede volverse 'ga'.
    """
    if len(palabra) > 5 and palabra.endswith("es"):
        return palabra[:-2]
    if len(palabra) > 4 and palabra.endswith("s"):
        return palabra[:-1]
    return palabra


def _sin_tildes(texto):
    """Quita tildes del lado de la CONSULTA.

    Tiene que existir aunque el campo ya se normalice con strip_accents en SQL:
    si solo se normaliza un lado, el buscador se rompe al reves. [MEDIDO
    2026-09-05] normalizando solo el campo, 'informatica' pasaba de 3 a 17
    resultados pero 'informatica' CON tilde caia de 13 a CERO. Los dos lados o
    ninguno.
    """
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


def _tokens(texto):
    """Parte la consulta en palabras normalizadas, sin duplicados ni ruido."""
    limpio = "".join(ch if ch.isalnum() else " " for ch in _sin_tildes(texto).lower())
    vistos, salida = set(), []
    for p in limpio.split():
        if len(p) < 2:                      # 'y', 'a', 'de' cortado: no aporta
            continue
        r = _raiz(p)
        if r not in vistos:
            vistos.add(r)
            salida.append(r)
        if len(salida) >= 8:                # techo duro: 8 tokens por consulta
            break
    return salida


class Busqueda:
    """Base de busqueda: indice FTS + arbol UNSPSC. Se reconstruye en cada sync.

    Vive en el MISMO volumen que ya monta este contenedor, asi que aparece y se
    actualiza sin recrear nada ni reiniciar nada, nunca.

    Es AUTOSUFICIENTE a proposito: trae copiadas las columnas que /api/buscar
    necesita para filtrar, contar y calcular metricas. [MEDIDO 2026-09-05]
    cruzando esta base con el almacen, la consulta 'servicio' tardaba 4,6 s
    porque habia que mover 42.000 codigos por Python; resolviendo todo aca son
    85-100 ms.

    Si el archivo no existe -- primer arranque, o un sync que fallo -- el
    buscador NO falla: degrada a la capa 1 sobre el almacen y lo declara en
    meta.limitaciones. Un motor de busqueda que se cae porque falta su indice es
    peor que uno que busca peor y lo dice.
    """

    def __init__(self, ruta, ext):
        self.ruta, self.ext = ruta, ext
        self.con = None
        self.firma = None
        self.motivo = "sin abrir todavia"
        self._abrir()

    def _firma(self):
        try:
            s = Path(self.ruta).stat()
            return (s.st_ino, s.st_mtime_ns, s.st_size)
        except OSError:
            return None

    def _abrir(self):
        f = self._firma()
        if f is None:
            self.con, self.firma = None, None
            self.motivo = "el indice de busqueda no existe todavia"
            return
        # [BUG 2026-09-08] Cerrar ANTES de abrir. DuckDB mantiene una cache de
        # instancias por ruta: con la conexion vieja todavia viva, connect()
        # devuelve la instancia cacheada -- atada al inodo BORRADO -- y el
        # indice servido queda congelado en el que habia al arrancar el
        # contenedor. En silencio: _abrir() "tiene exito", self.firma se
        # actualiza al inodo nuevo y la condicion de 'viva' no vuelve a
        # dispararse nunca. Almacen._refrescar() y mp_mcp/store.py ya cerraban
        # primero; este era el unico de los tres invertido.
        # [MEDIDO 15:53 UTC] 98.472 filas servidas contra 98.561 en disco: 89
        # licitaciones invisibles 1h45 despues de la corrida de las 14:06.
        # Contrapartida aceptada: si el indice nuevo no abre, la busqueda queda
        # en modo reducido -- pero DECLARADO en meta.limitaciones, contra la
        # falla callada de antes.
        if self.con is not None:
            try:
                self.con.close()
            except Exception:
                pass
            self.con = None
        try:
            con = duckdb.connect(self.ruta, read_only=True)
            con.execute(f"install '{self.ext}'")
            con.execute("load fts")
            con.execute("select 1 from licitacion_texto limit 1")
            self.con, self.firma, self.motivo = con, f, ""
        except Exception as e:
            self.con, self.firma = None, None
            self.motivo = f"el indice de busqueda no se pudo abrir: {str(e)[:80]}"

    @property
    def viva(self):
        actual = self._firma()
        if actual != self.firma:
            self._abrir()
        return self.con is not None

    def filas(self, sql, params=None):
        cur = self.con.execute(sql, params or [])
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


BUS = Busqueda(os.environ.get("MP_BUSQUEDA", "/data/mp/mp_busqueda.duckdb"),
               os.environ.get("MP_FTS_EXT", "/data/mp/fts.duckdb_extension"))


UMBRAL_COMPETENCIA = 10


def _competencia(med, n, hay_resultados):
    """Aplica la regla del umbral del SDD 5.1 a metricas.competencia.

    [BUG 2026-09-07] Buscar 'fermin' devolvia CERO resultados en pantalla y aun
    asi una tarjeta que decia "2 oferentes mediana, medido sobre 4 licitaciones".
    Dos fallas encadenadas:

      1. La regla del umbral estaba escrita solo para referencia_historica y
         nunca se extendio aca. Una "mediana" sobre n=4 -- valores [6,1,2,2] --
         es precision falsa, exactamente lo que el SDD prohibe.
      2. Se calculaba aunque el filtro no encontrara nada. Con n=0 en pantalla
         cualquier metrica es ruido: el usuario ve una estadistica de algo que
         no esta mirando.

    Ademas el universo NO es "del rubro". Las 4 licitaciones de 'fermin' eran
    transporte escolar, luminarias y un laboratorio de computacion: coincidian
    por un nombre propio en el titulo (Liceo Fermin del Real), no por rubro.
    Por eso 'universo' se redacta sin esa palabra y viaja siempre.
    """
    universo = ("licitaciones ya adjudicadas cuyo texto coincide con la misma "
                "busqueda -- NO son las que se estan mostrando, y no "
                "necesariamente son del mismo rubro")
    base = {"oferentes_mediana": None, "n": int(n or 0), "universo": universo}

    if not hay_resultados:
        # Sin resultados en pantalla no se publica ninguna metrica derivada.
        base["motivo_sin_dato"] = "la busqueda no devolvio resultados"
        return base
    if not n or n < 3:
        base["motivo_sin_dato"] = (
            f"solo {int(n or 0)} antecedente(s): son muy pocos para una mediana")
        return base
    if n < UMBRAL_COMPETENCIA:
        # Entre 3 y 9 se informa el dato pero SIN llamarlo mediana: el frontend
        # tiene que leer 'suficiente_para_mediana' antes de rotular.
        base["oferentes_mediana"] = float(med) if med is not None else None
        base["suficiente_para_mediana"] = False
        base["motivo_sin_dato"] = (
            f"{int(n)} antecedentes: por debajo de {UMBRAL_COMPETENCIA}, "
            "no se debe presentar como mediana de mercado")
        return base

    base["oferentes_mediana"] = float(med) if med is not None else None
    base["suficiente_para_mediana"] = True
    return base


def _filtros_bus(solo_abiertas, region, as_of):
    """Filtros que no son de texto, sobre licitacion_texto."""
    cond, params = ["1=1"], []
    if solo_abiertas:
        cond.append("l.estado = 'Publicada' and l.fecha_cierre >= ?")
        params.append(as_of)
    if region:
        cond.append("trim(l.region_comprador) = trim(?)")
        params.append(region)
    return " and ".join(cond), params


def _sql_busqueda(toks, consulta_fts):
    """Las tres capas, en union. Devuelve (cte_sql, params).

    UNION y no interseccion: cada capa encuentra lo que las otras no ven.
    [MEDIDO] 'limpieza' -> texto 66, rubro 121, union 157.

    Cada resultado sale marcado con la capa que lo encontro. Un resultado que
    solo aparece por rubro es una INFERENCIA del sistema, no una coincidencia
    literal, y el usuario tiene derecho a saberlo.
    """
    # Contra las columnas YA normalizadas del indice, no normalizando en caliente.
    like = " and ".join(
        ["(nombre_norm like '%' || ? || '%'"
         " or descripcion_norm like '%' || ? || '%')"] * len(toks))
    # Frontera de palabra obligatoria: sin ella 'aseo' matchea la hoja
    # 'Combustibles gASEOsos' y el grafo mete ruido en vez de sacarlo.
    rex = " and ".join(["regexp_matches(r.hoja_norm, '\\b' || ? || '\\b')"] * len(toks))

    p = [consulta_fts]
    for t in toks:
        p += [t]
    for t in toks:
        p += [t, t]

    cte = f"""
    por_fts as (
      select codigo, s from (
        select codigo, fts_main_licitacion_texto.match_bm25(codigo, ?) s
          from licitacion_texto) where s is not null),
    por_rubro as (
      select distinct rl.codigo from rubro r
        join rubro_licitacion rl on rl.codigo_rubro = r.codigo
       where {rex}),
    por_texto as (
      select codigo from licitacion_texto where {like}),
    todo as (
      select codigo, s, false vr, false vt from por_fts
      union all select codigo, null, true, false from por_rubro
      union all select codigo, null, false, true from por_texto),
    agr as (
      select codigo, max(s) bm25, max(vr) via_rubro, max(vt) via_texto,
             bool_or(s is not null) via_fts
        from todo group by codigo)
    """
    return cte, p

# -- filtro comun -----------------------------------------------------------

def _where(texto, solo_abiertas, region, as_of):
    """Arma el WHERE. Devuelve (sql, params, tokens).

    La busqueda es DETERMINISTA y sin modelo de lenguaje: normaliza tildes con
    strip_accents (nativa de DuckDB; la extension FTS no se puede usar porque
    este contenedor no tiene salida a internet), parte la consulta en palabras
    y exige que TODAS aparezcan. Eso arregla dos fallas medidas el 2026-09-05:

      - tildes: 'mantencion' devolvia 90 abiertas y 'mantencion' normalizada
        devuelve 354. Un usuario que escribe sin tildes -- lo normal en Chile --
        perdia el 75% de lo que existe, sin que nada se lo dijera.
      - orden de palabras: 'artificial inteligencia' devolvia CERO mientras
        'inteligencia artificial' devolvia 10.

    Lo que NO hace, y hay que decirlo: no entiende sinonimos ('aseo' no
    encuentra 'limpieza'), no entiende conceptos, y no ordena por relevancia
    semantica. Es coincidencia de palabras, buena y rapida, no comprension.
    """
    cond = ["1=1"]
    params = []

    toks = _tokens(texto) if texto else []
    for t in toks:
        # El campo se normaliza en caliente. Medido: sobre el conjunto de
        # abiertas no cuesta nada (27 ms contra 31 ms sin normalizar).
        cond.append("(strip_accents(lower(nombre)) like '%' || ? || '%'"
                    " or strip_accents(lower(descripcion)) like '%' || ? || '%')")
        params += [t, t]

    if solo_abiertas:
        # Definicion cerrada en el SDD 4.1a. Solo por estado dejaria entrar 751
        # licitaciones ya cerradas (13,2%) en una pantalla cuyo dato principal
        # es "cierra en X dias".
        cond.append("estado = 'Publicada' and fecha_cierre >= ?")
        params.append(as_of)

    if region:
        # [MEDIDO 2026-09-05] region_comprador trae espacios finales
        # inconsistentes ("Region de Antofagasta " vs sin espacio) ademas de
        # comunas y artefactos de parseo mezclados. trim() en los dos lados para
        # que un valor canonico sin espacio siga encontrando las filas sucias.
        cond.append("trim(region_comprador) = trim(?)")
        params.append(region)

    return " and ".join(cond), params, toks


def _orden(toks):
    """Relevancia sin modelo: lo que coincide en el NOMBRE va primero.

    Una licitacion cuyo titulo dice lo que el usuario pidio es mas relevante que
    una donde la palabra aparece enterrada en la descripcion. Es una heuristica
    de dos niveles, no un ranking -- pero es honesta y cuesta cero.
    """
    if not toks:
        return "fecha_cierre asc nulls last, codigo", []
    cond = " and ".join(
        ["strip_accents(lower(nombre)) like '%' || ? || '%'"] * len(toks))
    return (f"case when {cond} then 0 else 1 end, fecha_cierre asc nulls last, codigo",
            list(toks))

# -- POST /api/buscar -------------------------------------------------------

async def buscar(request):
    if not _autorizado(request):
        return _error(401, "No autorizado.")
    try:
        cuerpo = await request.json()
    except Exception:
        return _error(400, "Cuerpo JSON invalido.")
    if not isinstance(cuerpo, dict):
        return _error(400, "Cuerpo JSON invalido.")

    texto = (cuerpo.get("texto") or "")[:TEXTO_MAX]
    solo_abiertas = cuerpo.get("solo_abiertas", True) is not False
    region = cuerpo.get("region") or None
    try:
        limite = min(int(cuerpo.get("limite") or 25), LIMITE_MAX)
        desde = max(int(cuerpo.get("desde") or 0), 0)
    except (TypeError, ValueError):
        return _error(400, "limite y desde deben ser numeros.")
    limite = max(limite, 1)

    as_of, _, _actualizado = _as_of()
    if not as_of:
        return _error(503, "El almacen no esta disponible.")

    toks = _tokens(texto) if texto else []

    if BUS.viva:
        return _buscar_con_indice(toks, texto, solo_abiertas, region,
                                  as_of, limite, desde)
    # Degradacion declarada: sin indice se busca peor, pero se busca, y se dice.
    return _buscar_sin_indice(texto, solo_abiertas, region, as_of, limite, desde,
                              [{"limitacion": f"Busqueda en modo reducido: {BUS.motivo}. "
                                              "No se aplican stemming ni expansion por rubro.",
                                "severidad": "alta"}])


CAMPOS_BUS = ("codigo, tipo, nombre, estado, fecha_publicacion, fecha_cierre, "
              "region_comprador, monto_estimado_clp, visibilidad_monto, "
              "organismo_nombre, n_oferentes, url_ficha")


def _buscar_con_indice(toks, texto, solo_abiertas, region, as_of, limite, desde):
    """Una sola pasada de las tres capas, materializada en una tabla temporal.

    [MEDIDO 2026-09-05] La primera version corria la CTE una vez por cada
    agregado -- conteo, pagina, metricas de monto, cierre, top organismos, top
    regiones y competencia: SIETE escaneos FTS por peticion, 4,5 s. Materializar
    el conjunto una vez y agregar sobre el lo baja a una sola pasada.

    La tabla temporal vive en memoria de la conexion, no en el archivo: la base
    sigue abierta en solo lectura.
    """
    # Se materializa SIN el filtro de abiertas: competencia necesita las cerradas
    # y re-ejecutar la union para eso costaba otra pasada completa de FTS.
    # [MEDIDO] con dos pasadas: 1,8 s; con una: ver M-6.
    filtros, fp = _filtros_bus(False, region, as_of)

    if toks:
        cte, cp = _sql_busqueda(toks, _sin_tildes(texto))
        sel = (", ".join(f"l.{c.strip()}" for c in CAMPOS_BUS.split(","))
               + ", coalesce(bm25, -1) bm25"
               + ", coalesce(via_fts,false) via_fts"
               + ", coalesce(via_rubro,false) via_rubro"
               + ", coalesce(via_texto,false) via_texto")
        sql = (f"create or replace temp table sel as with {cte} "
               f"select {sel} from agr join licitacion_texto l using (codigo) where {filtros}")
        params = cp + fp
        orden = "bm25 desc, fecha_cierre asc nulls last, codigo"
    else:
        sel = (", ".join(f"l.{c.strip()}" for c in CAMPOS_BUS.split(","))
               + ", -1 bm25, false via_fts, false via_rubro, false via_texto")
        sql = (f"create or replace temp table sel as "
               f"select {sel} from licitacion_texto l where {filtros}")
        params = fp
        orden = "fecha_cierre asc nulls last, codigo"

    BUS.con.execute(sql, params)

    if solo_abiertas:
        BUS.con.execute("create or replace temp table selv as select * from sel "
                        "where estado = 'Publicada' and fecha_cierre >= ?", [as_of])
    else:
        BUS.con.execute("create or replace temp table selv as select * from sel")

    total = BUS.filas("select count(*) n from selv")[0]["n"]

    filas = BUS.filas(f"select * from selv order by {orden} limit ? offset ?",
                      [limite, desde])
    for f in filas:
        f.pop("bm25", None)
        f["via"] = [n for n, k in (("fts", "via_fts"), ("rubro", "via_rubro"),
                                   ("texto", "via_texto")) if f.pop(k, False)]

    m = BUS.filas("""select count(*) n, count(monto_estimado_clp) n_con_monto,
                            sum(case when visibilidad_monto = false then 1 else 0 end) n_oculto,
                            sum(monto_estimado_clp) suma, median(monto_estimado_clp) mediana,
                            sum(case when fecha_cierre <= cast(? as date) + 3 then 1 else 0 end) c3,
                            sum(case when fecha_cierre <= cast(? as date) + 7 then 1 else 0 end) c7
                       from selv""", [as_of, as_of])[0]
    orgs = BUS.filas("select organismo_nombre nombre, count(*) n from selv "
                     "where organismo_nombre is not null group by 1 order by n desc limit 5")
    regs = BUS.filas("select region_comprador nombre, count(*) n from selv "
                     "where region_comprador is not null group by 1 order by n desc limit 5")

    # Universo DISTINTO al del filtro, y por eso viaja declarado (SDD 4.1c). Se
    # calcula aparte porque ignora solo_abiertas a proposito: n_oferentes solo
    # existe en licitaciones ya cerradas.
    comp = BUS.filas("""select median(n_oferentes) med, count(n_oferentes) n
                          from sel where estado = 'Adjudicada'
                            and n_oferentes is not null""")[0] if toks else {"med": None, "n": 0}

    n = int(m["n"] or 0)
    c7 = int(m["c7"] or 0)
    metricas = {
        "n": n,
        "monto": {"n_con_monto": int(m["n_con_monto"] or 0),
                  "n_oculto_por_organismo": int(m["n_oculto"] or 0),
                  "suma_clp": float(m["suma"]) if m["suma"] is not None else None,
                  "mediana_clp": float(m["mediana"]) if m["mediana"] is not None else None},
        "cierre": {"en_3_dias": int(m["c3"] or 0), "en_7_dias": c7,
                   "mas_de_7": max(n - c7, 0)},
        "top_organismos": orgs, "top_regiones": regs,
        "competencia": _competencia(comp["med"], comp["n"], n > 0),
    }

    return JSONResponse({
        "total": int(total),
        "resultados": [_limpiar(f) for f in filas],
        "metricas": metricas,
        "meta": _meta([{
            "limitacion": ("La busqueda encuentra por palabras y por rubro oficial "
                           "UNSPSC, no por concepto: no entiende sinonimos fuera de "
                           "esa taxonomia ni interpreta intencion."),
            "severidad": "baja"}]),
    })


def _buscar_sin_indice(texto, solo_abiertas, region, as_of, limite, desde, avisos):
    """Capa 1 sola, sobre el almacen. Es el camino de degradacion cuando el
    indice de busqueda no esta disponible. Busca peor, y lo declara."""
    w, p, toks = _where(texto, solo_abiertas, region, as_of)

    total = ALM.una(f"select count(*) n from licitacion where {w}", p)["n"]

    campos = ("codigo, tipo, nombre, estado, fecha_publicacion, fecha_cierre, "
              "region_comprador, monto_estimado_clp, visibilidad_monto, "
              "organismo_nombre, n_oferentes, url_ficha")
    orden_sql, orden_p = _orden(toks)
    filas = ALM.filas(
        f"select {campos} from licitacion where {w} "
        f"order by {orden_sql} limit ? offset ?",
        p + orden_p + [limite, desde])

    m = ALM.una(
        f"""select count(*) n,
                   count(monto_estimado_clp) n_con_monto,
                   sum(case when visibilidad_monto = false then 1 else 0 end) n_oculto,
                   sum(monto_estimado_clp) suma,
                   median(monto_estimado_clp) mediana,
                   sum(case when fecha_cierre <= cast(? as date) + 3 then 1 else 0 end) c3,
                   sum(case when fecha_cierre <= cast(? as date) + 7 then 1 else 0 end) c7
              from licitacion where {w}""",
        # El orden importa: DuckDB liga los '?' por POSICION EN EL TEXTO, y estos
        # dos estan en el SELECT, antes del WHERE. Pasarlos al final hacia que el
        # filtro recibiera las fechas y las fechas el texto: la consulta devolvia
        # cero filas y el invariante n_con_monto+n_oculto==n pasaba igual, porque
        # 0+0==0. Un verde que no medía nada.
        [as_of, as_of] + p)

    orgs = ALM.filas(
        f"""select organismo_nombre nombre, count(*) n from licitacion where {w}
             and organismo_nombre is not null group by 1 order by n desc limit 5""", p)
    regs = ALM.filas(
        f"""select region_comprador nombre, count(*) n from licitacion where {w}
             and region_comprador is not null group by 1 order by n desc limit 5""", p)

    # competencia: universo DISTINTO al del filtro, y por eso viaja declarado.
    # [MEDIDO] n_oferentes esta en 0 de las licitaciones abiertas: esta metrica
    # nunca se calcula sobre las filas que el usuario ve (SDD 4.1c).
    # El universo se arma SIN solo_abiertas a proposito: con ese filtro puesto la
    # metrica seria estructuralmente cero siempre -- se pediria n_oferentes de
    # licitaciones abiertas, que por definicion no lo tienen. Se filtra solo por
    # texto y region, y el universo viaja declarado en la respuesta.
    wc, pc, _ = _where(texto, False, region, as_of)
    comp = ALM.una(
        f"""select median(n_oferentes) med, count(n_oferentes) n from licitacion
             where estado = 'Adjudicada' and n_oferentes is not null and ({wc})""", pc)

    c3 = int(m["c3"] or 0)
    c7 = int(m["c7"] or 0)
    n = int(m["n"] or 0)

    metricas = {
        "n": n,
        "monto": {
            "n_con_monto": int(m["n_con_monto"] or 0),
            "n_oculto_por_organismo": int(m["n_oculto"] or 0),
            "suma_clp": float(m["suma"]) if m["suma"] is not None else None,
            "mediana_clp": float(m["mediana"]) if m["mediana"] is not None else None,
        },
        "cierre": {"en_3_dias": c3, "en_7_dias": c7, "mas_de_7": max(n - c7, 0)},
        "top_organismos": orgs,
        "top_regiones": regs,
        "competencia": _competencia(comp["med"] if comp else None,
                                    comp["n"] if comp else 0, n > 0),
    }

    return JSONResponse({
        "total": int(total),
        "resultados": [_limpiar(f) for f in filas],
        "metricas": metricas,
        "meta": _meta(avisos),
    })

# -- GET /api/licitacion/{codigo} -------------------------------------------

def _referencia(codigo):
    """Historia de precio del mismo rubro. rubro = unspsc_commodity (SDD 4.1b).

    Intenta primero mismo organismo + mismo rubro; si no hay nada, degrada a solo
    rubro y LO DICE en 'alcance'. Nunca rellena sin declarar el cambio.
    """
    base = """
        select count(distinct l.codigo) n,
               median(l.monto_estimado_clp) med,
               quantile_cont(l.monto_estimado_clp, 0.10) p10,
               quantile_cont(l.monto_estimado_clp, 0.90) p90,
               median(l.n_oferentes) ofmed,
               list(distinct l.monto_estimado_clp)[1:3] valores
          from licitacion l
          join licitacion_item li on li.codigo_licitacion = l.codigo
         where l.estado = 'Adjudicada' and l.monto_estimado_clp is not null
           and l.codigo <> ?
           and li.unspsc_commodity in (
                 select unspsc_commodity from licitacion_item
                  where codigo_licitacion = ? and unspsc_commodity is not null)
    """
    org = ALM.una(base + """ and l.organismo_codigo = (
                 select organismo_codigo from licitacion where codigo = ?)""",
                  [codigo, codigo, codigo])
    if org and int(org["n"] or 0) > 0:
        return _armar_ref("organismo_y_rubro", org)
    rub = ALM.una(base, [codigo, codigo])
    if rub and int(rub["n"] or 0) > 0:
        return _armar_ref("rubro", rub)
    return {"alcance": "sin_datos", "n_licitaciones": 0}


def _armar_ref(alcance, r):
    """Aplica las reglas de umbral del SDD 5.1 y 5.2.

    n < 3  -> nada de lenguaje estadistico: se devuelven los valores puntuales.
    n < 10 -> sin percentiles: p10/p90 sobre menos de diez puntos son decorativos.
    """
    n = int(r["n"])
    ref = {"alcance": alcance, "n_licitaciones": n, "oferentes_mediana": None,
           "monto_mediana_clp": None, "monto_p10_clp": None, "monto_p90_clp": None}
    if r["ofmed"] is not None:
        ref["oferentes_mediana"] = float(r["ofmed"])
    if n < 3:
        # Campo extra al contrato original: sin el, la regla "mostrar el valor
        # como dato puntual" no se puede cumplir. Anotado como enmienda al SDD.
        ref["montos_clp"] = [float(v) for v in (r["valores"] or [])]
        return ref
    ref["monto_mediana_clp"] = float(r["med"]) if r["med"] is not None else None
    if n >= 10:
        ref["monto_p10_clp"] = float(r["p10"]) if r["p10"] is not None else None
        ref["monto_p90_clp"] = float(r["p90"]) if r["p90"] is not None else None
    return ref


async def licitacion(request):
    if not _autorizado(request):
        return _error(401, "No autorizado.")
    codigo = request.path_params["codigo"]
    if not CODIGO_RE.match(codigo) or len(codigo) > 40:
        return _error(400, "Codigo con formato invalido.")

    cab = ALM.una("select codigo, url_ficha from licitacion where codigo = ?", [codigo])
    if not cab:
        # 404 con cuerpo que explica, nunca 200 con objeto vacio (SDD 5, sonda 5).
        return _error(404, f"No hay ninguna licitacion con codigo {codigo} en el almacen.")

    items = ALM.filas(
        """select nombre_producto, cantidad, unidad_medida, unspsc_commodity
             from licitacion_item where codigo_licitacion = ? order by correlativo""",
        [codigo])

    return JSONResponse({
        "codigo": cab["codigo"],
        "items": [_limpiar(i) for i in items],
        "referencia_historica": _referencia(codigo),
        "url_ficha": cab["url_ficha"],
        "meta": _meta(),
    })


async def salud(request):
    try:
        as_of, lims, actualizado = _as_of()
        # El estado del indice viaja aca para que el vigia lo vea: sin esto,
        # el buscador degradado responde 200 y la degradacion pasa en silencio.
        indice = "ok" if BUS.viva else "ausente"
        avisos = [l["limitacion"] for l in lims]
        if indice != "ok":
            avisos.append(f"indice de busqueda {indice}: {BUS.motivo}")
        return JSONResponse({"ok": True, "as_of": as_of,
                             "actualizado_en": actualizado,
                             "indice": indice, "avisos": avisos})
    except Exception:
        return JSONResponse({"ok": False}, status_code=503)


app = Starlette(routes=[
    Route("/health", salud, methods=["GET"]),
    Route("/api/buscar", buscar, methods=["POST"]),
    Route("/api/licitacion/{codigo}", licitacion, methods=["GET"]),
])
