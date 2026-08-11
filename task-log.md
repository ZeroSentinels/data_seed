
## 2026-08-11 04:30 -04 (America/Santiago)
- **Solicitud:** Usuario muestra captura (img_d1c0595aff5a.jpg) de la franja izquierda del dashboard: "No se agregó el aire aquí en el lado izquierdo" — el contenido quedaba pegado al borde derecho del rail (solo 3-5px), mientras la derecha tenía 24px de aire (v51).
- **Resultado:** Build v55 (dpl_EZAkErd8YedEddMGdAVNNp3Yfy9W, FINAL READY). Causa raíz: `body{padding-left:44px}` era exactamente el ancho del rail colapsado, por lo que el contenido arrancaba justo en la línea divisoria sin aire. Fix: aire simétrico de 24px en ambos lados — colapsado `body{padding-left:68px}` (44 rail + 24 aire), expandido `body.sb-open{padding-left:284px}` (260 + 24), móvil ≤900px `68px` / `264px` (240 + 24). Verificado que no hay otros offsets fijos dependientes del rail (`.controls` está en flujo normal, sin `left` fijo).
- **Estado:** completada.
- **Verificación:** Navegador real por computed styles y getBoundingClientRect: colapsado → rail 44px, body padding-left 68px, gap entre rail y `.controls` = 24px; expandido → rail 260px, padding-left 284px, gap = 24px. Aire simétrico izquierdo/derecho (24px/24px) en ambos estados.
- **Pendientes:** Ninguno.
