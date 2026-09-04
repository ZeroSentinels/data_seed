# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-09-04 14:19 -04 (America/Santiago)
- **Solicitud:** Encargo de Daniel vía Claude Code (incoming/tarea_demeter.txt): llevar a preview el branch preview/buscador-licitaciones (buscador de licitaciones de Pública) — aplicar bundle de git, pushear branch, generar preview de Vercel, verificar con curl y avisar a Daniel por correo.
- **Resultado:** Bundle verificado y aplicado sobre origin/main (commit 1160ca4 sobre cf3ef02; diff = vercel.json +14 y 6 archivos nuevos site/publica-buscador*); branch pusheado a contacto101/data_seed; la integración Vercel-GitHub generó el preview de la rama (deployment READY, target preview, main no tocado); correo enviado a daniel.caignet@dataseed.cl con enlace, branch y nota de preview interno.
- **Estado:** completada.
- **Verificación:** curl del preview confirmó HTTP 200 en /publica-buscador con HTML real (título "Pública by DataSeed | Buscador de Licitaciones Públicas") en el alias data-seed-git-preview-buscador-licitaciones-dataseed-s-projects.vercel.app; correo confirmado en Gmail Sent (id 1a06da529bee7165).
- **Pendientes:** ninguno. Sin merge a main ni deploy a producción (por diseño).

## 2026-09-04 15:06 -04 (America/Santiago)
- **Solicitud:** Daniel: "el preview del browser de Pública no se ve" (preview Vercel del branch preview/buscador-licitaciones, creado 14:19).
- **Resultado:** Diagnóstico y reparación del browser de Hermes: `browser_navigate` fallaba con `net::ERR_CERT_AUTHORITY_INVALID` porque el daemon agent-browser de este perfil corría con `AGENT_BROWSER_PROXY` (MITM del Vault) sin config de bypass — el `config.json` de la reparación 2026-08-10 existía solo en el home del perfil default. Fix: crear `/opt/data/profiles/daniel/home/.agent-browser/config.json` con `{"proxyBypass": "*", "proxy": ""}` y reiniciar el daemon (kill por PID exacto). Verificado: dataseed.cl y `https://data-seed-git-preview-buscador-licitaciones-dataseed-s-projects.vercel.app/publica-buscador` cargan (título "Pública by DataSeed | Buscador de Licitaciones Públicas", buscador + sugerencias, sin errores JS). Nota: al buscar no se muestran resultados — la UI indica "Muestra fija de ejemplo — la búsqueda real la resuelve el servidor" (preview estático, por diseño). Skill hermes-browser-setup actualizado con el pitfall multi-perfil.
- **Estado:** completada.
- **Verificación:** browser_navigate HTTP 200 + snapshot del preview; screenshot del preview enviado a Daniel; cero errores JS en consola; skill patcheado (1 reemplazo verificado).
- **Pendientes:** ninguno. (El fix persiste en disco; si el contenedor se recrea y el home del perfil se regenera sin `.agent-browser/`, reaparece el síntoma.)
