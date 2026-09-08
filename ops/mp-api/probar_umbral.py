import sys

sys.path.insert(0, "/srv")
import app  # noqa: E402

print("=== los cuatro tramos de la regla del umbral ===")
casos = [
    (2.0, 0, False, "sin resultados en pantalla"),
    (2.0, 1, True, "n=1"),
    (2.0, 4, True, "n=4  (el caso fermin)"),
    (3.0, 7, True, "n=7  (tramo intermedio)"),
    (4.0, 2517, True, "n=2517  (suficiente)"),
]
fallas = 0
for med, n, hay, etq in casos:
    r = app._competencia(med, n, hay)
    mediana = r["oferentes_mediana"]
    suf = r.get("suficiente_para_mediana")
    motivo = r.get("motivo_sin_dato", "-")
    print(f"  {etq:<28} mediana={str(mediana):>5}  suf={str(suf):>5}")
    print(f"       motivo: {motivo}")

    # invariantes que no se negocian
    if not hay and mediana is not None:
        print("       FALLA: publica mediana sin resultados en pantalla")
        fallas += 1
    if hay and n < 3 and mediana is not None:
        print("       FALLA: publica mediana con n<3")
        fallas += 1
    if suf is True and n < app.UMBRAL_COMPETENCIA:
        print(f"       FALLA: dice suficiente con n<{app.UMBRAL_COMPETENCIA}")
        fallas += 1
    if mediana is not None and suf is None:
        print("       FALLA: da mediana sin declarar si alcanza")
        fallas += 1
    if "universo" not in r:
        print("       FALLA: falta universo")
        fallas += 1
    if "rubro" in r["universo"] and "no necesariamente" not in r["universo"]:
        print("       FALLA: el universo dice 'rubro' sin la salvedad")
        fallas += 1

print()
print(f"== {len(casos)} casos, {fallas} fallas ==")
sys.exit(1 if fallas else 0)
