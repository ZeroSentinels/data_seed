# Chart Harness — Arquitectura y hallazgos (PoC 2026-08-10)

## Problema

Cuando el agente genera gráficos "on the fly" para un cliente, el LLM puede inventar tipos de gráfico, cortar nombres, sacar barras del marco o romper el layout. La pregunta era cómo empaquetar la generación para: (a) minimizar latencia, (b) garantizar que nada se rompa nunca.

## Decisión de arquitectura (validada en PoC)

**Patrón: LLM-as-planner + ejecutor determinista (spec-driven rendering).**
El agente NUNCA escribe HTML ni opciones de ECharts. Genera un **spec JSON corto** (~300 tokens → respuesta 3-5× más rápida que regenerar un HTML de 1 MB), que el arnés valida contra un schema y renderiza con helpers predefinidos.

Capas:
1. **Agente (Demeter)**: petición del cliente → spec JSON (`type`, `title`, `categories`, `series`, `options`).
2. **Validador** (`validarSpecArnés`): whitelist de tipos, límites (≤20 categorías, ≤6 en pie/donut, ≤2 series, nombres ≤60 chars, valores numéricos). Spec inválido → **fallback determinista a tabla** (nunca se pierde información, nunca gráfico roto).
3. **Render** (`renderSpecArnés` + helpers): solo helpers ECharts con grid/axis/truncado predefinidos. Nombres completos en el eje (truncado elegante "…" + tooltip completo), `grid.right` reservado para etiquetas, eje X con 15% de respiro (`max: v.max*1.15`).

## Integración backend/frontend (decisión final)

El arnés NO es una página de prueba separada: **se integra como backend de render dentro del frontend de la PoC** (`poc-electrored.html`). La página despliega:

- **Frontend completo** del dashboard (KPIs, 4 charts, Top 3, tabla, roadmap, consultas, sidebar, chat Demeter) — todo lo que ve el cliente.
- **Sección "🤖 Generado por petición"** (oculta por defecto) que se activa con `?spec=<urlencoded-json>` en la URL: el validador + render del arnés dibujan el gráfico pedido (bar-h, bar-v, line, pie ≤6, donut ≤6) o el fallback tabla si el spec es inválido.
- El agente responde a una petición del cliente generando el spec y entregando la URL con `?spec=` — el render ocurre 100% client-side, sin servidor.

URL pública (entorno aislado PoC): https://dataseed-chart-harness.vercel.app (index.html = poc-electrored.html con arnés integrado).

## Catálogo de tipos soportados

| type | uso | límites |
|---|---|---|
| `bar-h` | comparación de categorías | ≤20 cat |
| `bar-v` | tendencia corta | ≤12 cat |
| `line` | series temporales | ≤2 series |
| `pie` | proporciones | **≤6 cat** |
| `donut` | proporciones con centro | ≤6 cat |
| `table` | fallback universal | — |

Contrato mínimo: `{ type, title?, subtitle?, categories[], series[{name?, values[]}], options? }`.

## Entregables (PoC desplegada)

- **Frontend integrado**: `/opt/data/dashboards/poc-electrored.html` — dashboard completo + arnés (validador `validarSpecArnés` + render `renderSpecArnés` + sección "Generado por petición" con `?spec=`).
- **URL pública (Vercel, entorno aislado)**: https://dataseed-chart-harness.vercel.app
  - Raíz: `index.html` = PoC completa con arnés integrado (verificado sha256 idéntico al local).
  - Petición directa: `?spec=<urlencoded-json>` → renderiza el gráfico pedido o fallback tabla.
- **Seguridad**: el proyecto `dataseed-chart-harness` es el ÚNICO con SSO desactivado (solo para la demo pública de la PoC). Verificado por escaneo del HTML servido: 0 tokens, 0 API keys, 0 emails, 0 RUTs, 0 credenciales. Los proyectos `data-seed` y `dataseed-tablero-construccion` NO fueron modificados (mantienen su protección).
- **Deploy**: script `/opt/data/harness/deploy_harness.py` (template `deploy_vercel_inline.py` de la skill vercel-deployments).

## Verificación end-to-end (real, 2026-08-10)

- Local (navegador): bar-h OK, pie OK (5 cat), line OK, spec inválido (`pie-3d` inventado) → **RECHAZADO + tabla**, nombres largos → truncado elegante. Spec por `?spec=` renderiza (pie 3 cat OK).
- Vercel: `POST /v13/deployments` → READY; `https://dataseed-chart-harness.vercel.app/` HTTP 200 (1.4 MB, base64 por el proxy del entorno; contiene el harness completo); `?spec=` HTTP 200. `deploy_harness.py` NO está en producción (redeploy solo con `index.html`).
- Alias: `dataseed-chart-harness.vercel.app` (proyecto `prj_LN32EKzSWjJLxAICcGYL6gl51eIq`).
- Nota entorno: el navegador de este VPS no navega HTTPS (CA del proxy); la verificación de Vercel fue vía `curl -sk --cacert /opt/agent-vault-ca.pem` (el proxy devuelve bodies base64 — decodificar antes de grep).

## Frameworks evaluados online (evidencia, 2026-08-10)

| repo | ⭐ | licencia | aporte | veredicto |
|---|---|---|---|---|
| microsoft/lida | 3.3k | MIT | generate/evaluate/repair de visualizaciones; error rate <3.5% | referencial; genera código Python (matplotlib/altair) y ejecuta código; requiere OpenAI |
| vega/vega-lite | 5.4k | BSD-3 | gramática declarativa + validación de schema (spec inválido no renderiza) | referencial para el concepto de validación |
| vanna-ai/vanna | 23.8k | MIT | text-to-SQL agentic + charts | para SQL, no visualización |
| Canner/wren-engine (WrenAI) | 17.2k | Apache-2.0 | GenBI text-to-SQL gobernado | para SQL, no visualización |
| hyungkwonko/chart-llm | 138 | — | Vega-Lite NL generation | académico |
| hustcc/mcp-echarts | 257 | — | spec de charts vía MCP | evaluado antes: wrapper sin validación |

Conclusión: no se instaló ningún framework externo; el arnés propio (validador + helpers + fallback) resuelve el problema sin dependencias nuevas, consistente con el criterio "gratis y sin otra IA".

## Latencia / siguiente paso

- El spec JSON (~300 tokens) es el único payload generado por el agente → el HTML base (1 MB) se cachea; el render es 100% client-side.
- Próximo paso propuesto: endpoint que reciba spec → valide → devuelva el HTML renderizado (o reemplace `?spec=`), + caché del HTML base.
