
## 2026-08-11 04:55 -04 (America/Santiago)
- **Solicitud:** Usuario reporta con captura (img_86454ab8598e.jpg): la respuesta del agente en el chat llega rara y cortada (JSON crudo `{"tipo":"texto","respuesta":"..."} ` truncado a mitad) ante la petición "Dame un gráfico para sorprender al gerente basado en la información del MCP y de la BOQ", y el fondo transparente del chat molesta.
- **Resultado:** Build v56 (dpl_CzZALvKXDjYqWi646sNR9n72fqMm, FINAL READY). Dos causas raíz: (1) `api/chat.js` llamaba al agente con `max_tokens:700` — el JSON largo con 3 opciones se truncaba, `extraerJSON` fallaba y el fallback devolvía el JSON crudo cortado como texto; fix: `max_tokens:1600` + `extraerJSON` robusto que rescata `"respuesta"` de un JSON truncado (regex con escapes) antes de intentar el parseo del bloque. (2) `#chatPanel` usaba `background:var(--surface2)` = `rgba(0,255,65,0.06)` → panel casi transparente dejando ver el dashboard detrás; fix: `background:var(--bg)` (sólido).
- **Estado:** completada.
- **Verificación:** `node --check` OK, check-html-js OK; deploy READY; curl al endpoint `/api/chat` devuelve JSON válido parseado; navegador real: `#chatPanel` computed `backgroundColor: rgb(5,14,6)` (sólido, opaco) y `browser_vision` confirma que no se filtra contenido del dashboard detrás del panel.
- **Pendientes:** Ninguno.
