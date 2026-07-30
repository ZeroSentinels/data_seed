# Regla de salida de los reportes DataSeed

## Formato obligatorio

- Los **reportes finales** deben publicarse como documentos editables (`.docx` en Google Drive, o Google Docs cuando la operación de destino lo permita).
- No publicar reportes finales como archivos `.md`.
- Los archivos `.md` se conservan exclusivamente como **guías internas y plantillas estructurales** para que Demeter mantenga el mismo estándar entre áreas y periodos.

## Fuente obligatoria de estructura

- Todo reporte DataSeed, ya sea automático o solicitado directamente, debe cargar desde el repositorio `backups/reporting/` la plantilla base, esta regla de salida y la plantilla específica del área.
- Si cualquiera de esos archivos falta, está vacío o no contiene su estructura obligatoria, la generación debe terminar con error sin publicar un documento alternativo.
- El reporte y su manifiesto deben registrar nombre y huella SHA-256 de las plantillas usadas.

## Estructura que debe conservarse

1. Resumen ejecutivo.
2. Salud general VERDE/AMARILLO/ROJO/N/D.
3. KPI con resultado, meta, tendencia, fuente y dueño.
4. Logros y evidencia.
5. Próximos hitos.
6. Riesgos y mitigaciones.
7. Dependencias interárea.
8. Decisiones requeridas.
9. Calidad y limitaciones de los datos.

## Convención

- Guía interna: `PLANTILLA__<AREA>__v1.md`
- Reporte final: `YYYY-MM-DD__<AREA>__REPORTE__v1.docx`

Corrección incorporada: 2026-07-30.
