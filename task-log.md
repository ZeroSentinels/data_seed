# Task Log - Demeter

> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago).
> No editar manualmente fuera del flujo automático.

---

<!-- ENTRADAS -->

## 2026-09-03 11:05 -04 (America/Santiago)
- **Solicitud:** Análisis pasivo de ciberseguridad del sistema Demeter/DataSeed (sin ataques directos): listar brechas potenciales.
- **Resultado:** Auditoría de solo lectura completada (sin modificar nada). Hallazgos redactados (huellas SHA-256, sin valores): (1) GITHUB_TOKEN vigente duplicado en 38 archivos (`.env` de todos los perfiles + backups, mayoría modo 644); (2) AGENT_VAULT_TOKEN vigente en 10 `.env` modo 644 + 28 copias del token anterior en backups 644; (3) `state.db` del perfil daniel (99 MB + WAL) en modo 644, world-readable; (4) tokens GitHub anteriores (rotados) presentes en transcripciones de `state.db` global y del perfil; (5) keys de proveedores (ANTHROPIC/OPENAI/GROQ/MISTRAL/OPENROUTER/GOOGLE/DEEPSEEK/GITHUB/API_SERVER_KEY/HERMES_PASSWORD) heredadas en environ de todo el árbol de procesos, incluidos s6-log; (6) logs de gateway con modos 777/744; (7) token GitHub previo documentado en `skills/autonomous-ai-agents/hermes-agent/references/native-mcp.md`; (8) api_server escucha 0.0.0.0:8642 (público) con toolset restringido a solo `mercado_publico` (OK verificado); sin túneles cloudflared/ngrok activos; sin `.git-credentials`/`.netrc` en el host.
- **Estado:** completada. (remediación ⏳ a la espera de autorización)
- **Verificación:** fingerprints SHA-256 comparados entre archivos y contra `state.db` (strings); token GitHub vigente NO encontrado fuera de `.env` (remediación del audit 2026-08-06 vigente); config `platform_toolsets.api_server` verificado con solo `mercado_publico`; puertos en LISTEN desde `/proc/net/tcp`.
- **Pendientes:** a la espera de autorización: chmod 600 a `.env`/`state.db`/logs expuestos; rotar/limpiar GITHUB_TOKEN y copias de backups; purgar token previo de `native-mcp.md`; decidir limpieza de tokens históricos en `state.db`.
