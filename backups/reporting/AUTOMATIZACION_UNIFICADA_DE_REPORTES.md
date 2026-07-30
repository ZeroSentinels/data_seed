# Automatización diaria de reportes por área — DataSeed

## Objetivo

Convertir las tareas terminales registradas en `task-log.md` o consolidadas en `daily-summary.md` en reportes diarios editables por área, publicarlos en la carpeta correspondiente de Google Drive y enviar un índice ejecutivo por correo con enlaces y highlights.

Esta automatización forma parte del **cronjob unificado de las 05:00 Chile**. El task-log se conserva hasta que los documentos y correos queden confirmados; solo entonces se limpia y continúa el backup.

## Contrato de artefactos

- **Google Drive:** exclusivamente reportes diarios editables por área; no se publican guías, plantillas, scripts ni documentación técnica.
- **Repositorio GitHub:** código en `scripts/ops/` y documentación técnica, reglas y plantillas internas en `backups/reporting/`.
- **Uso obligatorio de plantillas:** tanto el cronjob como cualquier generación solicitada directamente deben cargar `PLANTILLA_BASE__REPORTE_DE_AREA__v1.md`, `REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md` y `areas/PLANTILLA__<AREA>__v1.md` desde el repositorio. Si falta una, el reporte falla sin publicar ni limpiar el task-log.
- **Trazabilidad:** cada documento y manifiesto registra nombres y SHA-256 de las plantillas utilizadas.
- Los reportes finales son documentos `.docx` editables desde Google Docs.
- Se crea un reporte únicamente para las áreas que tengan tareas terminales nuevas.
- Cada tarea se asigna a exactamente un área principal.
- Si no existen tareas nuevas, el proceso permanece silencioso.

## Fuente y periodo

1. El cron genera primero `## Resumen <fecha>` sin limpiar el task-log.
2. El generador usa ese resumen y mantiene `task-log.md` como fuente de recuperación.
3. Solo entran tareas terminales: completadas con éxito o finalizadas con error.
4. Un registro global de huellas evita reprocesar tareas si el task-log no fue limpiado.
5. Periodo operativo: desde las 05:00 del día informado hasta las 05:00 del día siguiente, hora `America/Santiago`.

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
- Indicadores operativos basados en evidencia del task-log.
- Resultados y verificaciones.
- Próximos pasos sugeridos.
- Riesgos, dependencias y decisiones.
- Calidad y frescura de datos.
- Trazabilidad mínima mediante huellas no reversibles.

## Comunicación

Se envía un correo individual a los cinco integrantes autorizados. El correo funciona como índice breve e incluye:

- Estado y highlights por área.
- Enlace editable de cada reporte.
- Próximos pasos o pendientes relevantes.
- Canal de dudas y sugerencias por WhatsApp.

El documento en Drive es la fuente de verdad; el correo evita duplicar el detalle completo.

## Generación solicitada directamente

Una petición manual o ad hoc debe usar el mismo ejecutable `scripts/ops/daily-area-reports.js`; no se debe redactar un reporte desde cero ni copiar una estructura anterior. El ejecutable carga la plantilla base, la regla y la plantilla del área desde `backups/reporting/`, valida sus secciones y registra sus SHA-256 en el documento y el manifiesto.

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

- Un documento fechado no se duplica si ya existe en su carpeta.
- Gmail Sent se consulta antes de cada envío para evitar correos duplicados.
- El estado se guarda después de cada carga y cada correo.
- Las tareas se redactan contra patrones de credenciales antes de entrar al documento.
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
