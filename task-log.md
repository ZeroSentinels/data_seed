
## 2026-08-11 05:50 -04 (America/Santiago)
- **Solicitud:** Usuario pide quitar la cruz (✕) del header del panel del chat.
- **Resultado:** Build v59 (dpl_AUiMpQeuFNVVcc58iG38wtjncci7, FINAL READY). Eliminado `<span class="x" id="chatClose">✕</span>` del `#chatHead` y su listener en initChat; el header queda solo con el punto verde de estado + "Demeter · ajustes PoC". El cierre del chat sigue disponible por clic fuera (overlay) y tecla Escape.
- **Estado:** completada.
- **Verificación:** check-html-js OK, deploy READY; navegador real: `chatClose` no existe (`cruz:false`), header texto "Demeter · ajustes PoC"; cierre funcional con Escape (`cerradoConEscape:true`) y con clic en overlay (`cerradoConOverlay:true`).
- **Pendientes:** Ninguno.
