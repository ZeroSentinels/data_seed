#!/usr/bin/env bash
# Guardia de invariantes. Corre por EVENTO en cada pull request, no por reloj.
#
# Que hace: si el PR toca las rutas sensibles del auth, exige que la
# descripcion traiga la evidencia que pide docs/operations/coordinacion-agentes.md.
# Y falla siempre que un cambio reintroduzca una decision ya cerrada.
#
# Por que un script y no pasos de YAML: se puede correr local antes de empujar.
#   bash ./scripts/ci/guardia-invariantes.sh <sha base>
#
# El cuerpo del PR llega por la variable CUERPO_PR y NUNCA se evalua: se lee con
# grep sobre la variable. Un cuerpo de PR es texto de terceros; interpolarlo en
# el shell seria ejecucion de codigo ajeno.
set -euo pipefail

base="${1:-}"
rojo=0
aviso=0

if [ -n "$base" ] && git rev-parse --verify --quiet "$base^{commit}" >/dev/null; then
  rango="$base...HEAD"
else
  echo "Sin base de comparacion: no hay nada que vigilar."
  exit 0
fi

tocados="$(git diff --name-only "$rango" -- ':/' ':(exclude)graphify-out/**' || true)"
agregadas="$(git diff --unified=0 "$rango" -- ':/' ':(exclude)graphify-out/**' \
  | grep -E '^\+' | grep -Ev '^\+\+\+' || true)"

echo "Archivos tocados en $rango:"
printf '%s\n' "${tocados:-  (ninguno)}" | sed 's/^/  /'
echo

# ---------------------------------------------------------------- invariante 1
# La clave que ignora RLS no vuelve al codigo. Decision cerrada en
# docs/security/service-role-key-decision.md. Los .md pueden nombrarla: el
# documento que la prohibe tiene que poder escribirla.
codigo_con_clave="$(printf '%s\n' "$agregadas" \
  | grep -iE 'SUPABASE_SERVICE_ROLE_KEY|service_role' || true)"
if [ -n "$codigo_con_clave" ]; then
  no_doc=0
  for f in $tocados; do
    case "$f" in
      *.md) ;;
      tests/*) ;;
      scripts/ci/*) ;;  # el barrido y esta guardia nombran el patron a proposito
      *)
        if git diff --unified=0 "$rango" -- "$f" | grep -E '^\+' | grep -Ev '^\+\+\+' \
           | grep -qiE 'SUPABASE_SERVICE_ROLE_KEY|service_role'; then
          no_doc=1
          echo "HALLAZGO: $f agrega una referencia a la clave que ignora RLS."
        fi
        ;;
    esac
  done
  if [ "$no_doc" -ne 0 ]; then
    rojo=1
    echo "  Decision cerrada el 2026-09-08: la clave no entra al runtime."
    echo "  Leer docs/security/service-role-key-decision.md y responder sus"
    echo "  cuatro puntos antes de insistir. El self-serve no la necesita."
    echo
  fi
fi

# ---------------------------------------------------------------- invariante 2
# Los dos tests que vetan la clave siguen vetandola.
# Se busca con -F (cadena literal) y no con -E: el texto que hay en esos
# archivos ES una expresion regular fuente -- 'SUPABASE_(ANON|SERVICE)' con
# parentesis y barra. Buscarlo como ERE no matchea nada y la guardia daba un
# falso positivo. Medido antes de subir esto.
for archivo in tests/site-login.test.js tests/ui/login.test.js; do
  if [ ! -f "$archivo" ]; then
    rojo=1
    echo "HALLAZGO: $archivo desaparecio. Es uno de los dos tests que vetan la clave."
    echo
  elif ! grep -qF 'service_role' "$archivo"; then
    rojo=1
    echo "HALLAZGO: $archivo ya no veta la clave: no queda ninguna asercion"
    echo "  contra 'service_role'. Si tu test falla contra el, el que esta mal"
    echo "  es el tuyo."
    echo
  elif ! grep -qF 'doesNotMatch' "$archivo"; then
    rojo=1
    echo "HALLAZGO: $archivo menciona la clave pero ya no la veta con"
    echo "  assert.doesNotMatch. La asercion se degrado."
    echo
  fi
done

# ---------------------------------------------------------------- invariante 3
# Toda migracion trae su vuelta atras escrita. Un rollback de despliegue en
# Vercel no deshace un cambio de esquema ya aplicado.
if printf '%s\n' "$tocados" | grep -q '^supabase/migrations/'; then
  if printf '%s\n' "${CUERPO_PR:-}" | grep -qiE 'vuelta atr|rollback|revertir'; then
    echo "OK: la migracion declara su vuelta atras."
  else
    rojo=1
    echo "HALLAZGO: el PR toca supabase/migrations/ y su descripcion no dice"
    echo "  como se revierte. Una migracion aplicada no se deshace promoviendo"
    echo "  el deployment anterior. Escribir la vuelta atras antes de aplicar."
    echo
  fi
fi

# ---------------------------------------------------------------- invariante 4
# Rutas sensibles: la carga de la prueba es de quien cambia.
sensibles="$(printf '%s\n' "$tocados" \
  | grep -E '^(api/auth/|site/login|site/publica-login|vercel\.json$)' || true)"
if [ -n "$sensibles" ]; then
  echo "Rutas sensibles tocadas:"
  printf '%s\n' "$sensibles" | sed 's/^/  /'
  if printf '%s\n' "${CUERPO_PR:-}" | grep -qiE 'pass [0-9]+|npm run check|fail 0'; then
    echo "OK: la descripcion trae la salida de las pruebas."
  else
    rojo=1
    echo
    echo "HALLAZGO: este PR toca autenticacion y su descripcion no trae evidencia."
    echo "  docs/operations/coordinacion-agentes.md §1: la carga de la prueba es"
    echo "  de quien cambia. Pegar en la descripcion:"
    echo "    - la salida de 'npm run check' con el conteo real (pass N, fail 0)"
    echo "    - la peticion medida, con su codigo de respuesta"
    echo "  Al medir el login mandar 'Origin: https://dataseed.cl': sin esa"
    echo "  cabecera son 403 por same-origin y parece una regresion inexistente."
    echo
  fi
fi

# ---------------------------------------------------------------- invariante 5
# La compuerta no se desarma a si misma.
for f in .github/workflows/ci.yml scripts/ci/scan-secrets.sh .gitattributes; do
  if [ ! -f "$f" ]; then
    rojo=1
    echo "HALLAZGO: falta $f. La compuerta no se desarma en un PR."
    echo
  fi
done

if [ "$rojo" -ne 0 ]; then
  echo "Guardia en ROJO."
  echo "Esto no es un test que se arregla cambiando el test: son decisiones"
  echo "cerradas con su documento. Si una tiene que cambiar, cambiala en el"
  echo "documento primero y explicalo en el PR."
  exit 1
fi

[ "$aviso" -ne 0 ] && echo "Guardia con avisos, sin bloqueo."
echo "OK: ningun invariante tocado."
