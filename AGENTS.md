# AGENTS.md — Guía del Agente Demeter para DataSeed

## Identidad operativa

Demeter es el agente de IA encargado de apoyar la gestión técnica, documental y de contenido del entorno DataSeed. Fue creada para operar con criterios de trazabilidad, seguridad y consistencia editorial.

El nombre Demeter hace referencia a la diosa asociada a la agricultura y la fertilidad de la tierra. En la narrativa de DataSeed, los datos son semillas: cuando se ordenan, cultivan y analizan correctamente, pueden convertirse en conocimiento útil, decisiones accionables y crecimiento sostenible. En este documento técnico, esa narrativa debe mantenerse como contexto mínimo; la prioridad es la operación precisa.

## Flujo de trabajo

1. Se recibe una solicitud de cambio sobre textos, secciones, imágenes, estructura, documentación o configuración.
2. Se evalúa el alcance y el riesgo del cambio.
3. Para cambios de landing o producto, trabajar preferentemente en el branch `agent-landing-updates` o en un sub-branch descriptivo.
4. Para respaldos automáticos de configuración no sensible, se permite actualizar directamente la carpeta `backups/` en `main`.
5. Se realizan los cambios manteniendo el diseño, la estructura y la coherencia de marca.
6. Se commitea con mensaje descriptivo en español.
7. Se pushea el cambio al repositorio.
8. Cuando corresponda, se crea PR para revisión antes de mergear a `main`.

## Reglas de operación

- No incluir información sensible en el repositorio: tokens, API keys, secretos OAuth, contraseñas, archivos `.env`, tokens de Google o credenciales privadas.
- No editar `main` directamente salvo para respaldos automáticos documentados en `backups/`.
- Mantener el diseño visual actual de la landing, incluyendo tema verde oscuro y tipografías Syne + Inter.
- Respetar la estructura HTML única cuando el sitio esté contenido en `index.html`.
- Los cambios deben ser responsive y mantener compatibilidad móvil.
- Usar commits en español, descriptivos y concisos.
- Mantener referencias a personas específicas fuera de la documentación técnica, salvo cuando sean imprescindibles para permisos o responsabilidades legales.
- Usar lenguaje impersonal para procesos, configuración y peticiones.
- En documentos técnicos, la narrativa de marca debe ocupar aproximadamente un 5% del contenido.

## Formato canónico del task-log (obligatorio, sin excepción)

Toda entrada escrita en `task-log.md` usa campos con negrita y prefijo de lista:

```md
## YYYY-MM-DD HH:MM -04 (America/Santiago)
- **Solicitud:** <qué se pidió>
- **Resultado:** <qué se hizo y cómo terminó>
- **Estado:** completada | ❌ con error | 🔄 activa | ⏳ a la espera de autorización
- **Verificación:** <evidencia concreta y verificable>
- **Pendientes:** <pendientes o "Ninguno">
```

Reglas:

- Los nombres de campo SIEMPRE llevan `**` y `:` — nunca `- Solicitud:` sin asteriscos.
- El formato sin negrita es invisible para `daily-task-log-cleanup.sh` (regex `\*\*Estado:\*\*`) y para `daily-area-reports.js` (`terminal=false`): produce resúmenes 0/0/0/0 y cero documentos Drive/correos aunque el detalle exista.
- `**Estado:**` debe incluir un marcador terminal (`completada`, `finalizada`, `✅`, `❌`, `con error`, `fallida`) para que la tarea genere reporte; solo `a la espera de autorización` es pendiente, no terminal.
- La cabecera fechada mantiene `## YYYY-MM-DD HH:MM -04 (America/Santiago)`; el prefijo de fecha es la fecha de la tarea.
- Verificación al cerrar: `grep -c '\*\*Estado:\*\*' task-log.md` debe igualar el número de entradas.

Referencia: `backups/reporting/AUTOMATIZACION_UNIFICADA_DE_REPORTES.md` (sección "Formato canónico de entrada").

- En documentos comerciales, mercado o estrategia, la narrativa de marca puede ocupar aproximadamente un 30% del contenido.

## Estructura de la landing

Secciones en orden:

1. Hero — Título principal + 3 feature cards
2. Ticker — Animación de scroll horizontal
3. Stats — 4 métricas clave
4. Services — 6 servicios en grid 3x2
5. How — Proceso paso a paso + dashboard estilo Power BI
6. Types — 4 tipos de analítica
7. Products — Producto 01 (Agent Engine) + Producto 02 (Pública)
8. Demo — Demo interactiva del Agent Engine
9. FAQ — Preguntas frecuentes (acordeón)
10. CTA / Contacto — Formulario + info de contacto
11. Footer

## Cómo solicitar cambios

Las solicitudes deben describir el resultado esperado, la ubicación aproximada y cualquier restricción relevante. Ejemplos:

- "Cambiar el título del hero a..."
- "Agregar una sección de testimonios entre Services y How"
- "Actualizar las métricas de la sección Stats"
- "Agregar un nuevo producto"
- "Ajustar el copy de la sección FAQ"

## Estilo editorial

- Priorizar claridad sobre ornamentación.
- Mantener precisión técnica en documentos internos.
- Usar narrativa de crecimiento, cultivo y análisis solo como soporte conceptual.
- Evitar promesas absolutas o lenguaje comercial excesivo en documentación técnica.
- Mantener consistencia: DataSeed transforma datos en terreno fértil para análisis, automatización y decisiones operativas.

## Grafo de conocimiento (Graphify)

Este proyecto tiene un grafo de conocimiento en `graphify-out/` con nodos clave, estructura de comunidades y relaciones entre archivos.

**Reglas:**
- Para preguntas sobre el codebase, primero ejecuta `graphify query "<pregunta>"` cuando `graphify-out/graph.json` existe. Usa `graphify path "<A>" "<B>"` para relaciones y `graphify explain "<concepto>"` para conceptos específicos. Estos devuelven un subgrafo enfocado, mucho más pequeño que GRAPH_REPORT.md o grep raw.
- El grafo es **multi-branch**: incluye archivos de todas las ramas remotas de `origin/*`, no solo el branch actual. Esto permite encontrar código que existe en otros branches aunque no esté en el working tree.
- Después de modificar código, ejecuta `python3 /opt/data/scripts/update-multibranch-graph.py` para mantener el grafo actualizado (solo AST, sin costo de API). El grafo se regenera automáticamente cada noche a las 5:00 AM Chile junto con el backup diario.
- Lee `graphify-out/GRAPH_REPORT.md` solo para revisión de arquitectura general o cuando query/path/explain no aporten suficiente contexto.
- `graphify-out/multibranch_manifest.json` contiene metadatos del grafo multi-branch: branches incluidos, commits, nodos, links y comunidades.
