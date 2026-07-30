# DataSeed — Sistema estandarizado de reportes por área

## Objetivo

Crear una fuente única y comparable para que cada área comunique salud, resultados, riesgos, dependencias y decisiones requeridas sin convertir el reporte en una lista de actividad.

## Hallazgos de la investigación

El estándar combina prácticas publicadas por Asana, Atlassian, Smartsheet y GitLab:

1. **Abrir con la salud general** usando VERDE/AMARILLO/ROJO y una justificación breve.
2. **Distinguir estado de progreso:** el estado muestra dónde estamos ahora; el progreso compara lo logrado contra el plan.
3. **Usar pocos KPI ejecutivos:** cada área puede seguir muchas métricas, pero solo eleva las más importantes.
4. **Definir dueño y fuente canónica:** cada KPI, riesgo, acción y decisión debe tener responsable; cada cifra debe enlazar a su origen.
5. **Reportar logros, próximos hitos, riesgos y bloqueos**, no solo tareas realizadas.
6. **Explicitar dependencias y decisiones interáreas** con responsable y fecha límite.
7. **Mantener formato y cadencia constantes** para hacer comparables los periodos.
8. **No inventar datos:** si falta una cifra, usar `N/D`, explicar la causa y asignar una acción de remediación.

## Fuentes consultadas

- Asana — *How Project Status Reports Work: 8 Steps + Template*: https://asana.com/resources/how-project-status-reports
- Atlassian/Confluence — *Project Status Report Template*: https://www.atlassian.com/software/confluence/templates/project-status
- Smartsheet — *Project Status Report Templates*: https://www.smartsheet.com/content/project-status-templates
- GitLab Handbook — *KPIs*: https://handbook.gitlab.com/handbook/company/kpis/

Consulta realizada: 2026-07-30.

## Estructura en Drive

- `00_Estandar_y_Guia`: guía, plantilla base y convenciones.
- `01_Direccion_y_Estrategia`
- `02_Producto`
- `03_Ingenieria_y_Tecnologia`
- `04_Datos_e_Inteligencia_Artificial`
- `05_Ventas`
- `06_Marketing_y_Growth`
- `07_Exito_del_Cliente_y_Soporte`
- `08_Operaciones`
- `09_Finanzas`
- `10_Personas_y_Cultura`
- `11_Legal_Riesgos_y_Seguridad`

Cada carpeta de área contiene una plantilla especializada y un reporte de prueba con datos sintéticos.

## Cadencia recomendada

- **Diaria:** solo alertas, bloqueos, riesgos o decisiones urgentes. Debe ser breve y por excepción.
- **Semanal:** reporte operativo estándar de cada área.
- **Mensual:** consolidado ejecutivo con tendencias, presupuesto y capacidad.
- **Trimestral:** estrategia, OKR, escenarios y material para directorio/inversionistas.

La futura automatización diaria debería generar **un solo reporte por excepción**, no repetir once informes completos si no hubo cambios relevantes.

## Semáforo RAG

- **VERDE:** en línea con la meta; no requiere intervención fuera del área.
- **AMARILLO:** existe desviación o riesgo material; hay plan de mitigación y puede requerir apoyo.
- **ROJO:** meta incumplida, incidente crítico o bloqueo sin solución; requiere decisión o intervención ejecutiva.
- **N/D:** faltan datos confiables; nunca convertir ausencia de evidencia en VERDE.

## Reglas de calidad

1. Máximo 5 KPI ejecutivos por reporte.
2. Toda cifra incluye fuente canónica y fecha de corte.
3. Todo riesgo incluye probabilidad, impacto, dueño y mitigación.
4. Toda decisión requerida incluye decisor y fecha límite.
5. Toda dependencia interárea incluye área requerida, entrega esperada y fecha.
6. El resumen ejecutivo no supera 5 viñetas.
7. Los reportes de prueba llevan `modo_datos: MUESTRA_SINTETICA` y no deben usarse para decisiones reales.
8. No incluir secretos, credenciales, datos personales innecesarios ni información restringida.

## Convención de nombres

- Plantilla: `PLANTILLA__<AREA>__v1.md`
- Reporte: `YYYY-MM-DD__<AREA>__REPORTE__v1.md`
- Fecha: ISO 8601 (`YYYY-MM-DD`).
- Versionar solo cuando cambia la estructura; la fecha identifica cada ejecución.

## Flujo de elaboración

1. Recopilar KPI desde fuentes canónicas.
2. Validar fecha de corte y calidad de datos.
3. Asignar semáforo y explicar por qué.
4. Redactar resumen, logros, próximos hitos, riesgos y dependencias.
5. Identificar decisiones requeridas.
6. Revisar seguridad y confidencialidad.
7. Publicar en la carpeta del área.
8. Enlazar el reporte en el consolidado ejecutivo cuando corresponda.
