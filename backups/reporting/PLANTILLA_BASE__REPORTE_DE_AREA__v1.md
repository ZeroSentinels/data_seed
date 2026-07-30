---
empresa: DataSeed
tipo: reporte_de_area
area: "<AREA>"
periodo: "<YYYY-MM-DD a YYYY-MM-DD>"
fecha_corte: "<YYYY-MM-DDTHH:MM:SSZ>"
fecha_publicacion: "<YYYY-MM-DD>"
responsable: "<NOMBRE_O_ROL>"
revisores: []
cadencia: "diaria|semanal|mensual|trimestral"
estado_general: "VERDE|AMARILLO|ROJO|N/D"
confidencialidad: "interna|restringida"
modo_datos: "REAL|MUESTRA_SINTETICA"
version_plantilla: "1.0"
---

# Reporte de <AREA> — <PERIODO>

> Si `modo_datos` es `MUESTRA_SINTETICA`, este documento es demostrativo y no sirve para decisiones reales.

## 1. Resumen ejecutivo

- <Resultado o cambio más importante>
- <Desviación o riesgo principal>
- <Decisión o apoyo requerido>

## 2. Salud general

- **Estado:** <VERDE|AMARILLO|ROJO|N/D>
- **Motivo:** <Explicación verificable en 1–3 frases>
- **Cambio desde el periodo anterior:** <mejora|sin cambio|empeora|sin comparación>

## 3. KPI ejecutivos

| KPI | Resultado | Meta | Variación | Tendencia | Fuente canónica | Dueño |
|---|---:|---:|---:|---|---|---|
| <KPI 1> | <valor> | <meta> | <delta> | ↑/→/↓ | <URL o sistema> | <rol> |
| <KPI 2> | <valor> | <meta> | <delta> | ↑/→/↓ | <URL o sistema> | <rol> |

## 4. Logros y evidencia

- **Logro:** <resultado, no actividad>
  - Evidencia: <enlace o identificador>
  - Impacto: <cliente, ingreso, coste, riesgo o velocidad>

## 5. Hitos y próximos compromisos

| Hito/compromiso | Fecha | Estado | Dueño | Criterio de finalización |
|---|---|---|---|---|
| <hito> | <YYYY-MM-DD> | <pendiente|en curso|hecho> | <rol> | <condición medible> |

## 6. Riesgos e incidencias

| Riesgo/incidencia | Probabilidad | Impacto | Estado | Mitigación | Dueño | Fecha límite |
|---|---|---|---|---|---|---|
| <riesgo> | baja/media/alta | bajo/medio/alto | abierto/mitigado/cerrado | <acción> | <rol> | <YYYY-MM-DD> |

## 7. Dependencias y solicitudes interárea

| Área requerida | Solicitud/entrega | Motivo | Responsable receptor | Fecha necesaria | Estado |
|---|---|---|---|---|---|
| <área> | <entrega concreta> | <impacto> | <rol> | <YYYY-MM-DD> | pendiente/en curso/hecho |

## 8. Decisiones requeridas

| Decisión | Opciones | Recomendación | Decisor | Fecha límite | Impacto de no decidir |
|---|---|---|---|---|---|
| <decisión> | <A/B> | <opción y por qué> | <rol> | <YYYY-MM-DD> | <consecuencia> |

## 9. Calidad de datos

- **Cobertura:** <completa|parcial|N/D>
- **Última actualización de fuentes:** <fecha/hora>
- **Limitaciones:** <sesgos, retrasos o datos faltantes>
- **Acción correctiva:** <acción, dueño y fecha>

## 10. Enlaces y fuentes

- <Dashboard, documento, ticket o sistema canónico>

## 11. Registro de cambios

- <YYYY-MM-DD> — <autor/rol> — <cambio>
