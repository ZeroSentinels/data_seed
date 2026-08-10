# Automatización diaria de reportes por área — DataSeed

## Objetivo

Convertir las tareas terminales registradas en `task-log.md` o consolidadas en `daily-summary.md` en reportes diarios editables por área, publicarlos en la carpeta correspondiente de Google Drive y enviar un índice ejecutivo por correo con enlaces y highlights.

Esta automatización forma parte del **cronjob unificado de las 05:00 Chile**. El task-log se conserva hasta que los documentos y correos queden confirmados; solo entonces se limpia y continúa el backup.

## Contrato de artefactos

- **Google Drive:** exclusivamente reportes diarios editables por área; no se publican guías, plantillas, scripts ni documentación técnica.
- **Repositorio GitHub:** código en `scripts/ops/` y documentación técnica, reglas y plantillas internas en `backups/reporting/`.
- **Uso obligatorio de plantillas:** tanto el cronjob como cualquier generación solicitada directamente deben cargar `PLANTILLA_BASE__REPORTE_DE_AREA__v1.md`, `REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md` y `areas/PLANTILLA__<AREA>__v1.md` desde el repositorio. Si falta una, el reporte falla sin publicar ni limpiar el task-log.
- **Trazabilidad:** cada documento y manifiesto registra nombres y SHA-256 completos de las plantillas utilizadas.
- Los reportes finales son documentos `.docx` editables desde Google Docs.
- La convención de nombre es `YYYY-MM-DD__<AREA>__REPORTE__v1.docx`.
- Se crea un reporte únicamente para las áreas que tengan tareas terminales nuevas.
- Cada tarea se asigna a exactamente un área principal.
- Si no existen tareas nuevas, el proceso permanece silencioso.

## Fuente y periodo

1. El cron genera primero `## Resumen <fecha>` sin limpiar el task-log.
2. El generador usa ese resumen y mantiene `task-log.md` como fuente de recuperación.
3. Solo entran tareas terminales: completadas con éxito o finalizadas con error.
4. Un registro global de huellas evita reprocesar tareas si el task-log no fue limpiado.
5. Periodo operativo: desde las 05:00 del día informado hasta las 05:00 del día siguiente, hora `America/Santiago`.

## Formato canónico de entrada en task-log.md (obligatorio)

Toda entrada escrita por Demeter en `task-log.md` usa campos con negrita y prefijo de lista. Sin excepción:

```md
## YYYY-MM-DD HH:MM -04 (America/Santiago)
- **Solicitud:** <qué se pidió>
- **Resultado:** <qué se hizo y cómo terminó>
- **Estado:** completada | ❌ con error | 🔄 activa | ⏳ a la espera de autorización
- **Verificación:** <evidencia concreta y verificable>
- **Pendientes:** <pendientes o "Ninguno">
```

Reglas:

- Los nombres de campo SIEMPRE llevan `**` y `:` — nunca `- Solicitud:` sin asteriscos. Una entrada sin negrita es invisible para el conteo del resumen y para el reporter de áreas (`terminal=false` → cero reportes y cero correos).
- `**Estado:**` debe contener un marcador terminal (`completada`, `finalizada`, `✅`, `❌`, `con error`, `fallida`) para generar reporte; solo `a la espera de autorización` cuenta como pendiente, no terminal.
- La cabecera fechada mantiene el formato `## YYYY-MM-DD HH:MM -04 (America/Santiago)`; el prefijo de fecha es la fecha de la tarea para el parser.
- Al cerrar la entrada, verificar: `grep -c '\*\*Estado:\*\*' task-log.md` debe coincidir con el número de entradas.

Incidencia registrada: entradas sin `**` entre 2026-08-06 y 2026-08-08 produjeron resúmenes con conteo 0/0/0/0 y ausencia total de documentos Drive y correos, pese a que el detalle de tareas estaba presente. El formato anterior a 2026-08-06 (con `**Campo:**`) sí generaba reportes y correos normalmente.

## Áreas

1. Dirección y Estrategia
2. Producto
3. Ingeniería y Tecnología
4. Datos e Inteligencia Artificial
5. Ventas
6. Marketing y Growth
7. Éxito del Cliente y Soporte
8. Operaciones
9. Finanzas
10. Personas y Cultura
11. Legal, Riesgos y Seguridad

## Reporte por área

Cada documento contiene:

- Metadatos, periodo, corte, responsable, confidencialidad y procedencia.
- Resumen ejecutivo de hasta cinco puntos.
- Estado VERDE/AMARILLO/ROJO/N/D con justificación.
- KPI con resultado, meta, variación, tendencia, fuente y dueño; los campos no medidos se marcan `N/D`.
- Resultados y verificaciones.
- Próximos pasos sugeridos.
- Riesgos, dependencias y decisiones.
- Calidad y frescura de datos.
- Trazabilidad mínima mediante huellas no reversibles.

## Comunicación

Se envía un correo individual a los cinco integrantes autorizados. Los destinatarios están limitados por allowlist; `demeter@dataseed.cl` queda habilitado únicamente como buzón técnico controlado. El correo funciona como índice breve e incluye:

- Estado y highlights por área.
- Enlace editable de cada reporte.
- Próximos pasos o pendientes relevantes.
- Canal de dudas y sugerencias por WhatsApp.

El documento en Drive es la fuente de verdad; el correo evita duplicar el detalle completo.

## Generación solicitada directamente

Una petición manual o ad hoc debe usar el mismo ejecutable `scripts/ops/daily-area-reports.js`; no se debe redactar un reporte desde cero ni copiar una estructura anterior. El ejecutable carga la plantilla base, la regla y la plantilla del área desde la ruta canónica `backups/reporting/`, valida cada archivo de forma independiente y registra sus SHA-256 completos en el documento y el manifiesto. La ruta canónica solo puede sustituirse durante un `--dry-run` aislado.

## Cronjob unificado y orden transaccional

Existe un solo cronjob operativo a las 05:00 `America/Santiago`. El scheduler lo invoca a las 08:00 y 09:00 UTC para cubrir horario de verano e invierno; `daily-operations-wrapper.sh` permite actuar únicamente entre 05:00 y 05:04 Chile.

Orden obligatorio:

1. Actualizar el grafo multibranch en el repositorio de GitHub.
2. Generar y publicar el resumen diario sin limpiar `task-log.md`.
3. Seleccionar el área principal de cada tarea terminal nueva.
4. Generar y publicar los reportes editables en Drive.
5. Enviar correos individuales con enlaces y highlights, y verificarlos en Gmail Sent.
6. Limpiar y publicar `task-log.md` solo si los pasos 2–5 terminaron correctamente.
7. Ejecutar el backup operativo en el repositorio de GitHub.

Si resumen, clasificación, Drive o correo fallan, el proceso termina con error y preserva el task-log para recuperación; la limpieza nunca se adelanta a la distribución.

## Idempotencia y seguridad

- Un documento fechado solo se reutiliza si su MIME y SHA-256 coinciden exactamente con el archivo local; duplicados por nombre o contenido distinto detienen el proceso.
- La fecha de generación, el corte, el snapshot sanitizado de tareas y el snapshot validado de plantillas —con sus SHA-256— quedan fijados en el estado para que un reintento sea independiente de cambios posteriores en las fuentes y produzca el mismo documento.
- Gmail Sent se consulta antes de cada envío para evitar correos duplicados.
- El manifiesto se guarda antes de enviar correos. Luego el estado pasa a `committing`, se persisten las huellas procesadas y solo entonces pasa a `complete`; un reintento desde `committing` reconstruye la misma transacción fijada.
- `--test` requiere `--dry-run`: ningún artefacto de prueba se carga en Drive.
- Las tareas se redactan contra patrones de credenciales, incluidos secretos genéricos, JWT, claves AWS permanentes o temporales (`AKIA`, `ASIA`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`), claves Google y bloques PEM, antes de entrar al documento.
- No se incluyen secretos, tokens, contraseñas ni detalles de seguridad explotables.
- Las operaciones de Google usan exclusivamente `google_api.py`.

## Fuentes metodológicas

- Google Meet, “Take notes for me”: notas organizadas en un documento, email con enlace, resumen y siguientes pasos.
  - https://support.google.com/meet/answer/14754931?hl=en
- Atlassian: resumen conciso, salud, logros recientes, próximos pasos y riesgos.
  - https://www.atlassian.com/software/confluence/templates/project-status
- Asana: combinar estado actual, progreso, bloqueos, próximos hitos y acciones.
  - https://asana.com/resources/how-project-status-reports
- GitLab Communication: comunicación asíncrona, conclusiones por escrito y fuente única de verdad.
  - https://handbook.gitlab.com/handbook/communication/

Consulta metodológica: 2026-07-30.
