#!/usr/bin/env bash
# Barrido de secretos y de nombres de infraestructura sobre LINEAS AGREGADAS.
#
# Por que solo lo agregado: este repositorio es publico y tiene historia. Un
# barrido del arbol completo dejaria CI en rojo permanente por contenido viejo,
# y un CI que siempre falla no lo lee nadie. Esto vigila lo que entra.
#
# Que NO es: un reemplazo del secret scanning de GitHub, que en repositorios
# publicos es gratuito y valida contra los proveedores. Si el repositorio pasa a
# privado, esa red desaparece salvo que se contrate GitHub Advanced Security.
# Este script sigue corriendo igual, pero cubre menos.
#
# Nombres de infraestructura: los patrones de abajo son de CLASE, no de
# instancia -- escribir el hostname real aca lo publicaria, que es exactamente
# lo que se quiere evitar. Para vigilar nombres concretos, definir el secreto de
# repositorio INFRA_DENYLIST con una expresion por linea; se suman a la lista.
set -euo pipefail

base="${1:-}"
rojo=0

if [ -n "$base" ] && git rev-parse --verify --quiet "$base^{commit}" >/dev/null; then
  rango="$base...HEAD"
elif git rev-parse --verify --quiet HEAD~1 >/dev/null; then
  rango="HEAD~1...HEAD"
else
  echo "Sin base de comparacion: no hay nada que barrer."
  exit 0
fi

echo "Barriendo lineas agregadas en $rango"

# El pathspec positivo ':/' es obligatorio: una lista compuesta SOLO de
# ':(exclude)' no matchea nada, y el barrido pasaria en verde sin haber mirado
# un solo archivo. Medido: sin ':/' este script daba OK sobre un diff de 9
# lineas agregadas.
agregadas="$(git diff --unified=0 "$rango" -- ':/' \
  ':(exclude)graphify-out/**' ':(exclude)*.png' ':(exclude)*.ico' \
  | grep -E '^\+' | grep -Ev '^\+\+\+' || true)"
# El segundo grep lleva -E a proposito. En expresion regular BASICA, '\+' es el
# cuantificador GNU "uno o mas", no un signo mas literal: '^\+\+\+' matcheaba
# toda linea agregada y el barrido se quedaba sin nada que mirar. Medido con un
# PAT plantado: sin -E daba OK; con -E lo detecta.

if [ -z "$agregadas" ]; then
  echo "OK: sin lineas agregadas que barrer."
  exit 0
fi

# nombre <TAB> expresion extendida
#
# Falso positivo medido en site/publica-buscador.html: "Mayor a $10.000.000"
# (monto en pesos con separador de miles) matcheaba "Direccion IP privada"
# porque "10.000.000" calza con 10\.[0-9]{1,3}\.[0-9]{1,3}. Se agrego "$" al
# conjunto de caracteres excluidos antes del patron: una IP real nunca va
# precedida de un signo de moneda.
reglas=$(cat <<'REGLAS'
PAT de GitHub	(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}
PAT fino de GitHub	github_pat_[A-Za-z0-9_]{30,}
Clave de OpenAI/Anthropic/DeepSeek	sk-[A-Za-z0-9_-]{16,}
Token de agente de vault	av_agt_[A-Za-z0-9]{8,}
Clave privada	BEGIN [A-Z ]*PRIVATE KEY
Credencial en URL	[a-z][a-z0-9+.-]*://[^/[:space:]:@]+:[^/[:space:]@]+@
Asignacion de secreto	(api[_-]?key|apikey|secret|password|passwd|token|bearer)["']?[[:space:]]*[:=][[:space:]]*["'][^"']{16,}
Direccion IP privada	(^|[^0-9.$])(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)[0-9]{1,3}\.[0-9]{1,3}
Hostname numerico de servidor	srv[0-9]{6,}
Nombre de vault	[a-z0-9]+-vault\b
REGLAS
)

while IFS=$'\t' read -r nombre patron; do
  [ -z "${nombre:-}" ] && continue
  hits="$(printf '%s\n' "$agregadas" | grep -niE "$patron" || true)"
  if [ -n "$hits" ]; then
    rojo=1
    echo
    echo "HALLAZGO: $nombre"
    # Se imprime el numero de linea del diff y la linea ENMASCARADA: nunca el valor.
    # Se enmascara ANTES de imprimir. Los registros de Actions de un repositorio
    # publico son publicos: un hallazgo que imprime el valor lo publica una
    # segunda vez. Se cubren cadenas largas, direcciones IP y hostnames.
    printf '%s\n' "$hits" | head -20 \
      | sed -E 's/[0-9]{1,3}(\.[0-9]{1,3}){3}/<ip>/g' \
      | sed -E 's/[A-Za-z0-9_-]{12,}/<enmascarado>/g' \
      | sed -E 's/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+){2,}/<host>/g' \
      | sed 's/^/    /'
  fi
done <<< "$reglas"

if [ -n "${INFRA_DENYLIST:-}" ]; then
  while IFS= read -r patron; do
    [ -z "$patron" ] && continue
    if printf '%s\n' "$agregadas" | grep -qE "$patron"; then
      rojo=1
      echo
      echo "HALLAZGO: nombre de infraestructura de la lista privada (patron oculto)"
      printf '%s\n' "$agregadas" | grep -niE "$patron" | head -10 \
        | sed -E 's/[A-Za-z0-9_.-]{6,}/<enmascarado>/g' | sed 's/^/    /'
    fi
  done <<< "$INFRA_DENYLIST"
fi

if [ "$rojo" -ne 0 ]; then
  echo
  echo "Barrido en ROJO. Si es un falso positivo, ajustar la regla en este archivo"
  echo "y decir en el PR por que. No se saltea con --no-verify."
  exit 1
fi

echo "OK: sin hallazgos en las lineas agregadas."
