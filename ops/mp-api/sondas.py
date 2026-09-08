import json, os, sys, urllib.request, time
BASE = sys.argv[1]
# Desde F3 el servicio exige Bearer. La llave se pasa por entorno, nunca por
# argumento: los argumentos quedan visibles en `ps` para cualquier proceso.
LLAVE = os.environ.get("MP_API_KEY", "")
ok = fail = 0
def pedir(ruta, cuerpo=None):
    req = urllib.request.Request(BASE + ruta, method="POST" if cuerpo is not None else "GET")
    if LLAVE:
        req.add_header("Authorization", "Bearer " + LLAVE)
    data = None
    if cuerpo is not None:
        req.add_header("Content-Type", "application/json")
        data = json.dumps(cuerpo).encode()
    try:
        with urllib.request.urlopen(req, data, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, {}
def check(nombre, cond, detalle=""):
    global ok, fail
    if cond: ok += 1; print(f"  OK    {nombre}  {detalle}")
    else:    fail += 1; print(f"  FALLA {nombre}  {detalle}")

print("S-1 no se inventa monto")
s, d = pedir("/api/buscar", {"texto": "servicio", "solo_abiertas": True, "limite": 50})
m = d["metricas"]
check("S-1a invariante", m["monto"]["n_con_monto"] + m["monto"]["n_oculto_por_organismo"] == m["n"] and m["n"] > 0,
      f'{m["monto"]["n_con_monto"]}+{m["monto"]["n_oculto_por_organismo"]}=={m["n"]}')
malos = [r for r in d["resultados"] if r["visibilidad_monto"] is False and r["monto_estimado_clp"] is not None]
check("S-1b control negativo: oculto sin monto", len(malos) == 0, f"violaciones={len(malos)}")

print("S-10 solo_abiertas no cuela cerradas")
as_of = d["meta"]["as_of"]
tarde = [r for r in d["resultados"] if r["fecha_cierre"] and r["fecha_cierre"] < as_of]
check("S-10", len(tarde) == 0, f"as_of={as_of} vencidas={len(tarde)}")

print("S-5 codigo inexistente")
s, d = pedir("/api/licitacion/ZZZZ-0-XX00")
check("S-5", s == 404 and "error" in d, f"http={s}")

print("S-6 sin inyeccion SQL")
s, d = pedir("/api/buscar", {"texto": "'; drop table licitacion;--", "limite": 5})
check("S-6a responde sin error", s == 200, f"http={s}")
# solo_abiertas=False a proposito: el umbral de 40.000 es del universo completo
# (42.990 medido). Con el filtro de abiertas puesto son ~2.155 y la sonda
# fallaba por estar mal calibrada, no por un problema del almacen.
s2, d2 = pedir("/api/buscar", {"texto": "servicio", "solo_abiertas": False, "limite": 1})
check("S-6b almacen intacto", s2 == 200 and d2["total"] > 40000, f'total={d2.get("total")}')

print("S-7 techo de costo")
s, d = pedir("/api/buscar", {"texto": "a", "limite": 100000})
check("S-7", s == 200 and len(d["resultados"]) <= 50, f'devueltos={len(d.get("resultados",[]))}')

print("S-2 / S-3 reglas de umbral")
s, d = pedir("/api/licitacion/1002772-83-LE26")
r = d.get("referencia_historica", {})
check("S-2 n<3 sin lenguaje estadistico",
      r.get("n_licitaciones", 99) < 3 and r.get("monto_mediana_clp") is None
      and r.get("monto_p10_clp") is None and "montos_clp" in r,
      f'alcance={r.get("alcance")} n={r.get("n_licitaciones")}')

print("S-4 alcance no miente + S-3 percentiles")
s, d = pedir("/api/licitacion/1016-8-LE26")
r = d["referencia_historica"]
check("S-4 alcance declarado", r["alcance"] in ("organismo_y_rubro", "rubro", "sin_datos"),
      f'alcance={r["alcance"]} n={r["n_licitaciones"]}')
if r["n_licitaciones"] >= 10:
    check("S-3 n>=10 con percentiles", r["monto_p10_clp"] is not None, f'p10={r["monto_p10_clp"]}')
else:
    check("S-3 n<10 sin percentiles", r["monto_p10_clp"] is None, f'n={r["n_licitaciones"]}')
check("S-detalle items", len(d["items"]) > 0, f'items={len(d["items"])}')

print("latencia")
t = time.perf_counter(); pedir("/api/buscar", {"texto": "servicio", "limite": 25}); b = (time.perf_counter()-t)*1000
t = time.perf_counter(); pedir("/api/licitacion/1016-8-LE26"); c = (time.perf_counter()-t)*1000
print(f"  buscar peor caso: {b:.0f} ms | detalle: {c:.0f} ms")

print(f"\n== {ok} OK, {fail} FALLAS ==")
sys.exit(1 if fail else 0)
