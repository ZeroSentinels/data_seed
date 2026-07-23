# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-07-22 22:35:39 -04 — Recuperación del gateway de WhatsApp

**Estado:** ✅ Finalizada exitosamente

**Solicitud:** Diagnosticar y recuperar el gateway de WhatsApp de Demeter, que no estaba funcionando.

**Causa raíz:** WhatsApp estaba configurado con `dm_policy: open` y `group_policy: open`. La versión activa de Hermes exige ahora una aceptación explícita para permitir ese alcance abierto; como faltaba esa aceptación, el gateway fallaba la validación de arranque y entraba en un ciclo continuo de reinicios. Por eso el servicio de WhatsApp no quedaba disponible.

**Qué se hizo:** Se revisaron procesos, salud y logs del gateway y del bridge. Se respaldó `/opt/data/.env` en `/opt/data/.env.bak-whatsapp-20260723T023434Z` y se agregó `WHATSAPP_ALLOW_ALL_USERS=true`, manteniendo el comportamiento abierto que ya tenía la instalación. El supervisor s6 levantó automáticamente el gateway y el bridge. No fue necesario reemparejar WhatsApp ni modificar `require_mention`.

**Verificación:** `/health` del bridge devolvió HTTP 200, `status=connected` y cola vacía; el API local devolvió HTTP 200; los procesos se mantuvieron estables durante comprobaciones sucesivas. El gateway recibió un mensaje real de WhatsApp a las 02:34:52 UTC y envió la respuesta correspondiente a las 02:34:58 UTC, 5,7 segundos después.
