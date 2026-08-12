# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-08-12 13:40 -04 (America/Santiago)
- **Solicitud:** Consulta en vivo Mercado Público: (1) OC totales de B BRAUN MEDICAL SPA (RUT 96.756.540-7) + 3 ejemplos con detalle; (2) total adjudicado el 28/07/2026 + 1 ejemplo; (3) reportar cuota gastada.
- **Resultado:** RUT resuelto en vivo → código 47740, B BRAUN MEDICAL SPA. OC en vivo (mp_ordenes_vivo, codigo_proveedor=47740): 55 OC, listado sin truncar. 3 ejemplos con mp_oc_vivo: 1057489-9260-SE26 (Hospital del Salvador, insumos terapia reemplazo renal, Recepción Conforme, neto $1.880.000 / total $2.237.200); 948355-1658-AG26 (Fondo Hospital DIPRECA, compra ágil filtros de papel, Enviada a proveedor, neto $1.160.000 / total $1.380.400); 1549-3458-SE26 (Hospital San José, glucosa 5% 250ml, Aceptada, neto $428.400 / total $509.796). Adjudicadas 28/07/2026 (mp_licitaciones_vivo, estado=adjudicada, fecha=28072026): 259 en total, respuesta TRUNCADA a 200 (devueltas 200/259) → sin monto agregado representativo, se reportó solo el conteo y un ejemplo puntual: 948355-24-LE26 (adhesivo tisular, Fondo Hospital DIPRECA, adjudicada 28/07/2026 a B BRAUN, $25.000.000 estimado, 8 oferentes). Cuota: 7 hits gastados en esta consulta (usados 24h: 19 → 26), 1 throttled 429 (no cuenta en contador), disponibles on-demand 9.974.
- **Estado:** completada.
- **Verificación:** Datos crudos de API v1 en vivo (as_of: consulta en vivo a ChileCompra, NO snapshot); cada OC y licitación confirmada por mp_oc_vivo/mp_licitacion_vivo (encontrada=true). Truncado de adjudicadas declarado explícitamente al usuario (no se promedió muestra no representativa).
- **Pendientes:** Monto total adjudicado del 28/07/2026 requiere ingesta masiva o ~259 consultas puntuales (1 hit c/u); no se ejecutó por costo de cuota.

## 2026-08-12 13:28 -04 (America/Santiago)
- **Solicitud:** Verificar estado de cuota ChileCompra antes de una tanda de consultas en vivo; ejecutar 1 consulta en vivo (948355-24-LE26) y confirmar que el contador se mueve.
- **Resultado:** Cuota antes: 1/10.000 usados en 24h, 9.999 disponibles on-demand. Consulta viva 948355-24-LE26 OK: licitación ADJUDICADA (2026-07-28, Decreto N° 1872, 8 oferentes), Fondo Hospital DIPRECA, adhesivo tisular (UNSPSC 42295400), MontoEstimado $25.000.000 CLP, 1.270 tubos adjudicados a B BRAUN MEDICAL SPA a $14.700/tubo. Cuota después: 2/10.000 usados, 9.998 on-demand — se movió +1 exacto.
- **Estado:** completada.
- **Verificación:** Relectura independiente de mp_cuota_estado post-consulta: usados_ultimas_24h=2, disponibles_on_demand=9998 (estable), hits_anotados_en_esta_sesion=2, throttled_429=0. Origen del contador: ledger local /data/mp/data/cuota (escribible, 0 fallos de anotación); hits_historicos_en_el_snapshot (4.374) NO entra en el contador.
- **Pendientes:** Ninguno. Nota: contador es local (no mide otros clientes con el mismo ticket) y los 429 no cuentan en él (supuesto sin medir); existe además límite de tasa corto plazo no documentado (sonda P-21).
