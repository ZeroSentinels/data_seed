# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-07-22 22:35:39 -04 — Recuperación del gateway de WhatsApp

**Estado:** ✅ Finalizada exitosamente

**Solicitud:** Diagnosticar y recuperar el gateway de WhatsApp de Demeter, que no estaba funcionando.

**Acciones:** Se revisaron procesos, salud y logs del gateway y del bridge. El gateway estaba en un ciclo de reinicios porque la configuración mantenía `dm_policy` y `group_policy` en `open`, pero la versión activa de Hermes ahora exige una aceptación explícita para ese alcance. Se respaldó `/opt/data/.env` y se agregó `WHATSAPP_ALLOW_ALL_USERS=true`, preservando el comportamiento abierto que ya tenía la instalación. El supervisor s6 levantó nuevamente el gateway y el bridge sin requerir reemparejamiento.

**Verificación:** `/health` del bridge devolvió `status=connected` y cola vacía; el API local devolvió HTTP 200; los procesos se mantuvieron estables durante comprobaciones sucesivas. El gateway recibió un mensaje real de WhatsApp a las 02:34:52 UTC y envió la respuesta correspondiente a las 02:34:58 UTC.
