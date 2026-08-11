
## 2026-08-11 00:40 -04 (America/Santiago)
- **Solicitud:** Usuario reporta que "la gráfica lateral no se actualizó con la nueva estructura" — la barra lateral de navegación seguía apuntando a secciones que ya no existen o quedaron ocultas por el rediseño a galería de miniaturas.
- **Resultado:** La sidebar tenía un link muerto "Por fecha" (sec-fechas: la sección ya no existe en el HTML base, su gráfica vive como miniatura en la galería) y no enlazaba a la nueva galería. Se reemplazó el link por "Galería de gráficas" (`data-sec="galeria" href="#galeria"`) y se agregó la clase `section` al contenedor `#galeria` para que el scroll-spy del sidebar la marque como activa al navegar. Deploy v38 (dpl_44S8QXS4t8zD4Ap2TNG7fRaEMya9, FINAL READY).
- **Estado:** completada.
- **Verificación:** node --check OK; prod v38 por curl: `data-sec="galeria"` ×1 presente, link `sec-fechas" href` ×0; navegador real: galería con 6 miniaturas renderizadas y navegación de sidebar correcta.
- **Pendientes:** Revisar si el agente remoto vuelve a insertar links a secciones ocultas al crear secciones nuevas (su prompt ya indica que SECCIONES_CONTEXTO es índice descriptivo; verificar que no agregue nav-links a secciones que el frontend convierte en miniaturas).
