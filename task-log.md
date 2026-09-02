# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-09-01 22:34 -04 (America/Santiago)
- **Solicitud:** Implementar aislamiento real entre chats de WhatsApp (Daniel, audio 2026-09-02): cada número DM y cada grupo debe tener su propio perfil de Hermes; CLI compartido y separado por sesión; todo usuario nuevo que escriba debe recibir perfil aislado automáticamente. Motivo: cruce de información del DM de Mati con el grupo de Richard (incidente 2026-08-11).
- **Resultado:** Aislamiento por perfiles implementado: (1) 9 perfiles creados (`daniel`, `mati`, `wa56955123259`, `wa56992354255`, `wa5352437119`, `wa56976406976`, `g120363426338264382`, `g120363410342471725`, `g120363406765196561`) con memoria propia vacía (memoria de Daniel clonada por `--clone` movida a `*.clone-backup` en perfiles ajenos); (2) `gateway.multiplex_profiles: true` + 9 rutas `profile_routes` (chat_id → perfil) escritas como lista YAML real en `config.yaml`; (3) auto-provisioner `/opt/data/scripts/provision_new_chats.py` (detecta session keys nuevas en state.db, crea perfil `wa<num>`/`g<id>` + ruta + backup, solo DMs autorizados en `allow_from`), cronjob `3d3a4d137152` cada 10 min vía `provision_new_chats_wrapper.sh` (silencio si no hay novedades); (4) skill `whatsapp-gateway-config` actualizado con el procedimiento y pitfall del string JSON.
- **Estado:** ⏳ a la espera de autorización (falta reiniciar el gateway para activar multiplexing — interrumpe sesiones activas; requiere OK explícito de Daniel).
- **Verificación:** `hermes config check` exitoso (Config version 33 ✓); `python3 -m py_compile` OK; test `test_provision.py` OK (detección de DM autorizado nuevo y grupo nuevo); `--check-only` reporta 0 pendientes; `yaml.safe_load` confirma 9 rutas como lista de dicts; backups `config.yaml.bak-aislamiento-20260902` y `.bak-routes-20260902`.
- **Pendientes:** Reinicio del gateway (comando: `hermes gateway restart` o `kill -HUP <PID>`, PID actual 191575) y validación post-reinicio: mensaje de prueba en DM de Mati debe caer en `profiles/mati/state.db` y `session_search` de ese perfil no debe ver sesiones del default. Luego limpiar `*.clone-backup` de memories tras confirmación.

## 2026-09-01 23:05 -04 (America/Santiago)
- **Solicitud:** Corregir la memoria antigua de los chats (Daniel, 2026-09-02): Arturo preguntó en el grupo principal `120363426338264382@g.us` "revisa el chat y resume las tareas" y el agente respondió con contenido del task-log del 11-08 y un session_search del DM de Daniel, en vez de resumir el chat actual. Cada perfil debe tener su extracto de memoria filtrado para su usuario.
- **Resultado:** (1) Incidente diagnosticado: a las 02:23 el agente (aún en perfil default compartido) respondió a Arturo con task-log 2026-08-11 + session_search, no con el resumen del chat; (2) memorias filtradas por perfil escritas en los 7 perfiles ajenos (`mati`, `wa*` ×4, `g*` ×3): cada MEMORY.md/USER.md contiene identidad del canal, REGLA ANTI-CRUCE y para grupos la regla explícita "cuando pidan resumir el chat, resumir SOLO la conversación actual de este grupo, no task-log ni otras sesiones"; (3) perfil `daniel` conserva la memoria global original; (4) código temporal de test (`test_provision.py`) borrado por pedido explícito (no dejar rutas que permitan romper el sistema); (5) auto-provisioner y cron `3d3a4d137152` se mantienen operativos (confirmado por Daniel); directorios `tmp-tasklog-*` NO se tocan (confirmado por Daniel).
- **Estado:** ⏳ a la espera de autorización (reinicio del gateway sigue pendiente; sin reinicio el multiplexing no está activo y los perfiles nuevos no se usan).
- **Verificación:** `ls` de `profiles/*/memories/` confirma MEMORY.md/USER.md nuevos en los 7 perfiles (877/860/859/1131 bytes) y ausencia de archivos sueltos en `tmp-tl-test/`; backups `*.clone-backup` intactos.
- **Pendientes:** Reinicio del gateway (PID 191575) y validación end-to-end: mensaje de prueba de Arturo en el grupo principal debe resumir SOLO la sesión actual del grupo (perfil `g120363426338264382`), no el task-log; verificar que `session_search` del perfil del grupo no vea sesiones del default.
