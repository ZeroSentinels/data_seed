"""Sondas M-1..M-6 del SDD del motor, contra el endpoint real."""
import json
import os
import sys
import time
import unicodedata
import urllib.request

BASE = sys.argv[1]
LLAVE = os.environ.get("MP_API_KEY", "")
ok = fail = 0


def pedir(cuerpo):
    req = urllib.request.Request(BASE + "/api/buscar", method="POST")
    req.add_header("Authorization", "Bearer " + LLAVE)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, json.dumps(cuerpo).encode(), timeout=90) as r:
        return json.loads(r.read())


def check(nombre, cond, detalle=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  OK    {nombre}  {detalle}")
    else:
        fail += 1
        print(f"  FALLA {nombre}  {detalle}")


def sn(s):
    return "".join(c for c in unicodedata.normalize("NFD", (s or "").lower())
                   if unicodedata.category(c) != "Mn")


print("=== resultados y latencia por termino ===")
tiempos = []
datos = {}
for t in ["limpieza", "aseo", "servicio", "informatica", "inteligencia artificial",
          "camion", "obras", "software", "alimentos", "ambulancia"]:
    a = time.perf_counter()
    d = pedir({"texto": t, "solo_abiertas": True, "limite": 5})
    ms = (time.perf_counter() - a) * 1000
    tiempos.append(ms)
    datos[t] = d
    vias = sorted({v for r in d["resultados"] for v in r.get("via", [])})
    print(f"  {t:<24} total={d['total']:>5}  [{ms:5.0f} ms]  vias={vias}")

print()
print("=== M-3: tildes simetricas ===")
for a, b in [("informatica", "informática"), ("mantencion", "mantención"),
             ("camion", "camión"), ("gestion", "gestión"), ("energia", "energía")]:
    ta = pedir({"texto": a, "limite": 1})["total"]
    tb = pedir({"texto": b, "limite": 1})["total"]
    check(f"M-3 {a}/{b}", ta == tb, f"{ta} vs {tb}")

print()
print("=== M-4: orden de palabras irrelevante ===")
for a, b in [("inteligencia artificial", "artificial inteligencia"),
             ("servicio aseo", "aseo servicio")]:
    ta = pedir({"texto": a, "limite": 1})["total"]
    tb = pedir({"texto": b, "limite": 1})["total"]
    check(f"M-4 {a}", ta == tb, f"{ta} vs {tb}")

print()
print("=== M-5: la procedencia no miente ===")
d = pedir({"texto": "aseo", "solo_abiertas": True, "limite": 50})
solo_rubro = [r for r in d["resultados"] if r.get("via") == ["rubro"]]
malos = [r for r in solo_rubro if "aseo" in sn(r["nombre"])]
check("M-5 solo-rubro no contiene el termino", len(malos) == 0,
      f"solo-rubro={len(solo_rubro)} violaciones={len(malos)}")
if solo_rubro:
    print("        ejemplo inferido por rubro:", solo_rubro[0]["nombre"][:58])

print()
print("=== M-2: la union solo suma (n_con_monto + oculto == n) ===")
for t, d in datos.items():
    m = d["metricas"]
    if not (m["monto"]["n_con_monto"] + m["monto"]["n_oculto_por_organismo"] == m["n"]):
        check(f"M-2 invariante {t}", False, str(m["monto"]))
        break
else:
    check("M-2 invariante de monto en los 10 terminos", True, "")

print()
print("=== M-6: latencia ===")
tiempos.sort()
p95 = tiempos[int(len(tiempos) * 0.95) - 1]
check("M-6 p95 < 300 ms", p95 < 300, f"p95={p95:.0f} ms  max={tiempos[-1]:.0f} ms")

print()
print(f"== {ok} OK, {fail} FALLAS ==")
sys.exit(1 if fail else 0)
