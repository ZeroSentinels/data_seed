# Task tracking DataSeed / Demeter

## Estado

Activo en branch `feat/task-tracking-system`.

## Archivos

- `task-log.md`: log vivo del día, volátil.
- `daily-summary.md`: resumen diario generado a las 05:00 America/Santiago.
- `backups/COMPLETED_CYCLES.md`: solo hitos grandes completados.

## Regla

El backup diario no copia `task-log.md` ni `daily-summary.md`; solo los referencia. El detalle operativo diario vive en la rama de tracking.

## Formato canónico de entrada (obligatorio, sin excepción)

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

Referencia operativa: `backups/reporting/AUTOMATIZACION_UNIFICADA_DE_REPORTES.md` (sección "Formato canónico de entrada").

## Script

Copia sanitizada: `scripts/ops/daily-task-log-cleanup.sh`.

## Validación

El cleanup debe considerar vacío el bloque completo solo si al quitar whitespace no queda contenido. No usar una línea en blanco como criterio de vacío.
