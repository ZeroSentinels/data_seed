# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-08-11 14:15 -04 (America/Santiago)
- **Solicitud:** El usuario pide que los errores del cron diario no vuelvan a ocurrir: "cada vez que se hace una modificación grande en los proyectos, se rompe el cronjob diario". Endurecer el pipeline para que sea resiliente a cambios grandes.
- **Resultado:** Se instalaron 3 salvaguardas en los scripts operativos: (1) `github_api_commit.py` ahora valida que `task-log.md` tenga header `# Task Log - Demeter` + marcador `<!-- ENTRADAS -->` antes de publicar y RECHAZA el commit si faltan (flag `--allow-broken-tasklog` solo para reconstrucción deliberada) — imposible volver a publicar un task-log roto por accidente; (2) `daily-task-log-cleanup.sh` ya no "salta" silenciosamente si falta el marcador: antepone header + marcador preservando el contenido, loguea WARNING y continúa el resumen; (3) `demeter_daily_backup.py` se auto-recupera si `git pull --ff-only` falla por divergencia: realinea a `origin/BRANCH` solo si working tree limpio + reset permitido + todos los commits locales son duplicados exactos (mismo árbol+mensaje) de commits remotos; si hay commits únicos → HUMAN_REQUIRED, nunca reset automático. Las 3 protecciones se probaron aisladas (rechazo de task-log roto, reparación del cleanup con resumen 1 tarea, recovery con repo git simulado incluido el caso de commit único rehusado) y el backup real corrió OK publicando los scripts endurecidos (commit `8b23284` a main).
- **Estado:** completada.
- **Verificación:** `python3 -m py_compile` + `bash -n` OK en los 3 scripts; tests aislados en `/opt/data/tmp-tl-test` (eliminado): validación rechaza `roto.md` y acepta `sano.md`; cleanup repara y genera resumen con conteo 1; recovery simulado: HEAD==origin/main tras divergencia de duplicados y rechazo HUMAN_REQUIRED con commit único; backup real OK `8b23284`.
- **Pendientes:** Observar la corrida real de mañana 05:00 Chile (12-08) para confirmar el comportamiento end-to-end con las salvaguardas activas.

## 2026-08-11 13:20 -04 (America/Santiago)
- **Solicitud:** Cierre del incidente del cron de reporte diario: usuario autoriza hacer el merge de la divergencia git que hacía fallar el backup operativo (`git pull --ff-only origin main` no fast-forward).
- **Resultado:** Diagnóstico: el repo de backup `/opt/data/data_seed_daily_backup` (main) estaba ahead 1 / behind 3: el commit local `2924bf1` ("docs: formato canónico obligatorio de entradas en task-log.md") era un duplicado exacto del remoto `3480f01` (mismos árbol `e11c1c4a...`, mismo mensaje, creado por dos vías). Working tree limpio → `git reset --hard origin/main` (aprobado por el usuario) dejó main en `19bd19f`, `git pull --ff-only` = "Already up to date". Backup completo re-ejecutado OK (commit `9a133d3` a main); pipeline completo `daily-operations.sh` → ✅ VERDE (grafo OK, resumen 22/0/0/2, áreas OK, limpieza OK, backup OK commit `ebcc655`).
- **Estado:** completada.
- **Verificación:** `git status -sb` en backup repo = `## main...origin/main` sin ahead/behind; `git pull --ff-only origin main` = "Already up to date"; `demeter_daily_backup.py` exit 0 con commit `9a133d3`; pipeline VERDE con los 5 pasos OK.
- **Pendientes:** Ninguno — el cron de las 05:00 quedó operativo (la causa del ROJO era la divergencia, ya resuelta).
