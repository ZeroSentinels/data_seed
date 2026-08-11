
## 2026-08-11 03:35 -04 (America/Santiago)
- **Solicitud:** Usuario reporta (captura de franja derecha del dashboard): (1) dar espacio a las "burbujas" (tarjetas/gráficos) del lado derecho, igual que el lado izquierdo tiene su aire; (2) que cuando se abra la barra lateral derecha (chat drawer) se siga pudiendo hacer scroll en la página.
- **Resultado:** Build v51 (dpl_BQ8cdaKTUcpDnayQNuFDdK38vBQR, FINAL READY): (1) `body` ahora tiene `padding-right:24px` (además del padding-left dinámico de la sidebar) — las tarjetas ya no quedan pegadas al borde derecho. (2) Se eliminó `body.chat-open{overflow:hidden}` (y su toggle en `chatSetOpen`) — con el drawer del chat abierto el fondo sigue scrolleando; el overlay transparente solo captura clics para cerrar.
- **Estado:** completada.
- **Verificación:** `node --check` OK; navegador real: con chat abierto (`chatPanel.open:true`) `window.scrollTo(0,600)` funciona (`scrollY` 0→600, `body.overflow:visible`), `body.paddingRight:24px`; `browser_vision`: tarjetas con margen derecho, contenido scrolleado hacia abajo visible, rail izquierdo intacto.
- **Pendientes:** Ninguno.
