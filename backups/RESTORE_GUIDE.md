# Guía de restauración crítica — DataSeed / Demeter

Esta guía permite reconstruir el estado operativo no sensible de Demeter después de un reinicio crítico o pérdida del contenedor.

## Principios

- El repositorio contiene únicamente material no sensible.
- Los secretos nunca se restauran desde GitHub.
- Las credenciales se reconfiguran manualmente desde fuentes autorizadas.
- Los prompts completos de cron y los destinos de entrega no se guardan en este backup.
- Los scripts/documentos adicionales solo se guardan como copia dura con aprobación explícita y escaneo básico de secretos. Si hay duda, no se copian; quedan listados como pendientes de revisión.
- `task-log.md` y `daily-summary.md` no se copian al backup diario; el backup solo referencia dónde consultarlos.
- Las tareas solo pasan al backup cuando son ciclos grandes completados y están registradas en `backups/COMPLETED_CYCLES.md`.

## Pasos de recuperación

1. Preparar el entorno persistente esperado:

```bash
mkdir -p /opt/data
cd /opt/data
```

2. Clonar el repositorio de recuperación:

```bash
git clone https://github.com/contacto101/data_seed.git /opt/data/data_seed
cd /opt/data/data_seed
```

3. Revisar el snapshot operativo:

```bash
less backups/BACKUP.md
```

4. Revisar ciclos grandes completados:

```bash
less backups/COMPLETED_CYCLES.md
```

5. Instalar o validar Hermes Agent según la documentación oficial.

6. Configurar secretos fuera del repositorio:

- GitHub token o credenciales git.
- OAuth de proveedores LLM.
- Credenciales de Google/Firebase si aplican.
- Tokens de APIs externas como ChileCompra o HubSpot.
- Sesiones de WhatsApp/gateway si se requiere continuidad de mensajería.

7. Validar configuración y gateway:

```bash
/opt/hermes/.venv/bin/hermes config check || true
/opt/hermes/.venv/bin/hermes doctor || true
/opt/hermes/.venv/bin/hermes cron list || true
```

8. Reconstituir cron jobs:

- Usar la sección de cron jobs de `backups/BACKUP.md` para nombres, horarios, scripts, skills y workdirs.
- Pedir al operador humano los prompts completos y destinos cuando estén excluidos.
- Mantener los backups y watchdogs como no-agent cuando sea posible para reducir riesgo de filtrar secretos.

9. Consultar seguimiento diario si hace falta:

- `daily-summary.md` en el branch `feat/task-tracking-system`: resumen diario, pendientes y bloqueos.
- `task-log.md` en el branch `feat/task-tracking-system`: detalle vivo del día antes de la limpieza diaria.

10. Ejecutar verificación segura:

```bash
bash backups/restore.sh
```

## Archivos seguros de este backup

- `backups/BACKUP.md`: snapshot operativo sanitizado.
- `backups/COMPLETED_CYCLES.md`: solo ciclos grandes completados; no contiene el log diario ni el resumen diario.
- `backups/RESTORE_GUIDE.md`: esta guía.
- `backups/restore.sh`: verificación segura post-restore.
- `scripts/ops/demeter_daily_backup.py`: rutina canónica que genera el backup diario.
- `scripts/ops/daily-operations.sh`: pipeline unificado grafo → resumen → reportes/correos → limpieza → backup.
- `scripts/ops/daily-operations-wrapper.sh`: wrapper horario America/Santiago para cron.
- `scripts/ops/daily-task-log-cleanup.sh`: limpieza de `task-log.md` y resumen diario, copia sanitizada aprobada.
- `scripts/ops/daily-area-reports.js`: clasificación por área, documentos Drive, correos e idempotencia.
- `backups/reporting/`: guía técnica, regla de salida y plantillas internas; Drive queda reservado para reportes.
- `scripts/demeter_daily_backup.py`, `scripts/daily-operations.sh`, `scripts/daily-operations-wrapper.sh`: wrappers temporales de compatibilidad para rutas antiguas.
- `scripts/cron/`: scripts referenciados por cron, solo si existen en `/opt/data/scripts`, tienen extensión segura (`.py`, `.sh`, `.bash`), pasan escaneo básico de secretos y fueron aprobados explícitamente en `/opt/data/backup_hardcopy_allowlist.txt`.

## Nunca commitear

- `.env`
- `.git-credentials`
- `auth.json`
- `google_token.json`
- `google_client_secret.json`
- `creds.json`
- `state.db` y derivados WAL/SHM
- sesiones de mensajería
- logs completos
- caches o adjuntos de usuario
- `task-log.md` y `daily-summary.md` dentro del backup diario
