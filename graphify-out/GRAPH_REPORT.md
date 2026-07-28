# Graph Report - data_seed_secure_multitenant_auth  (2026-07-28)

## Corpus Check
- 76 files · ~54,681 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 548 nodes · 798 edges · 58 communities (46 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3c55dc21`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]

## God Nodes (most connected - your core abstractions)
1. `build_backup_md()` - 14 edges
2. `Backup operativo no sensible — DataSeed / Demeter` - 14 edges
3. `AuthorizationError` - 13 edges
4. `build_snapshot()` - 13 edges
5. `Design System — DataSeed` - 12 edges
6. `copy_safe_cron_scripts()` - 11 edges
7. `update_repo_files()` - 11 edges
8. `fail()` - 11 edges
9. `SupabaseRequestError` - 10 edges
10. `run()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `createLogoutHandler()` --calls--> `parseCookies()`  [EXTRACTED]
  api/auth/logout.js → api/auth/_lib/cookies.js
- `authenticateRequest()` --calls--> `parseCookies()`  [EXTRACTED]
  api/auth/_lib/session.js → api/auth/_lib/cookies.js
- `createLogoutHandler()` --calls--> `getHeader()`  [EXTRACTED]
  api/auth/logout.js → api/auth/_lib/http.js
- `authenticateRequest()` --calls--> `getHeader()`  [EXTRACTED]
  api/auth/_lib/session.js → api/auth/_lib/http.js
- `createLoginHandler()` --calls--> `sendJson()`  [EXTRACTED]
  api/auth/login.js → api/auth/_lib/http.js

## Import Cycles
- 1-file cycle: `scripts/ops/demeter_daily_backup.py -> scripts/ops/demeter_daily_backup.py`

## Communities (58 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (43): env, membershipA, membershipB, env, config, createLoginHandler(), identity, config (+35 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (55): datetime, assert_no_secret_values(), backup_outputs_summary(), build_backup_md(), build_completed_cycles_md(), build_python_compat_wrapper(), build_restore_guide(), build_restore_sh() (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (40): 10. Anti-Patterns (prohibido), 11. Checklist pre-entrega, 1. Identidad de Marca, 2. Paleta de Colores, 3. Tipografías, 4. Espaciado y Grid, 5. Componentes, 6. Iconografía (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.21
Nodes (20): CompletedProcess, branch_commit(), BranchEntry, build_snapshot(), canonical_path_score(), copy_outputs(), FileEntry, files_from_branch() (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.21
Nodes (10): StreamReader, StreamWriter, _completion_payload(), _cors_headers(), DemoProxy, _deterministic_guardrail_reply(), _rate_limit_check(), Return a safe canned reply for clearly out-of-scope or risky prompts. (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.32
Nodes (16): api(), commit_files(), create_blob(), fail(), get_head(), github_path(), github_placeholder_auth_header(), main() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (14): Archivos actualizados por este backup, Archivos operativos clave observados, Backup operativo no sensible — DataSeed / Demeter, Configuración Hermes sanitizada, Cron jobs configurados y estado, Estado técnico, Exclusiones estrictas, Grafo de conocimiento del proyecto (Graphify) (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (13): applySavedTheme(), parseResponse(), publicLoginError(), redirectExistingSession(), requestRecovery(), setFieldError(), setLoading(), setStatus() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (7): config, createPortalHandler(), escapeHtml(), portalHtml(), setSecurityHeaders(), identity, identity

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (12): Commits realizados, Correcciones post-primera-validación, Definition of Done — Cumplido, Estructura final en main, Graphify resultado final, Lecciones aprendidas, Objetivo, Push realizados (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (9): AGENT.md — Guía del Agente Demeter para DataSeed, Cómo solicitar cambios, Estilo editorial, Estructura activa del repositorio, Estructura de la landing, Flujo de trabajo, Grafo de conocimiento (Graphify), Identidad operativa (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (9): engines, node, name, private, scripts, check, test, type (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (8): ¿Es solo una consultora BI?, Estado, FAQ comercial DataSeed, ¿La demo usa datos reales?, Preguntas base, ¿Qué es Agent Engine?, ¿Qué es Pública by DataSeed?, ¿Qué hace DataSeed?

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (8): Archivos livianos versionados, Artefactos regenerables ignorados, Criterios de calidad, Estado, Generación multi-branch deduplicada, Graphify en DataSeed, Observación, Uso

### Community 14 - "Community 14"
Cohesion: 0.25
Nodes (7): Archivo, Comercial, Fuentes maestras, Operaciones, Producto, Seguridad, Índice maestro de documentación DataSeed

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (7): AGENT.md — Guía del Agente Demeter para DataSeed, Cómo solicitar cambios, Estilo editorial, Estructura de la landing, Flujo de trabajo, Identidad operativa, Reglas de operación

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (7): Branches activos, Checkpoints, Inventario de branches DataSeed, Ramas duplicadas borradas (con checkpoint), Regla operativa, Resumen, Rollback

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (7): Cliente ideal inicial, Diferenciales, Estado, Promesa, Próxima acción, Pública by DataSeed, Resumen ejecutivo

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (7): Estado, Fase 1 — Ordenar el repositorio, Fase 2 — Producto demostrable, Fase 3 — Pública MVP, Fase 4 — Plataforma privada, Fase 5 — Operación robusta, Roadmap DataSeed

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): Activación, Aislamiento multi-tenant, Arquitectura, Estado, Plan de autenticación DataSeed, Variables de entorno, Verificación automatizada

### Community 20 - "Community 20"
Cohesion: 0.52
Nodes (6): config, extractAssistantMessage(), genericBusy(), handler(), sendJson(), validateMessages()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (6): Checkpoint de limpieza de branches DataSeed, Fecha / ID, Ramas borradas, Ramas conservadas, Rollback rápido, Validación esperada post-limpieza

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (6): Archivos incluidos, Backup diario operativo, Estado, Excluido, Pipeline, Script canónico

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (6): Antes de merge, Commit base, Después de push pero antes de merge, Rollback — reorganización de información, Si falla cron, Si falla landing

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (6): Archivos, Estado, Regla, Script, Task tracking DataSeed / Demeter, Validación

### Community 25 - "Community 25"
Cohesion: 0.52
Nodes (6): disable_direct_git_credentials(), ensure_git_identity(), normalize_agent_vault_git_env(), push_tracking_branch(), setup_brokered_git_env(), daily-task-log-cleanup.sh script

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (6): Casos demo permitidos, DataSeed Agent Engine, Estado, Fuente técnica, Propuesta, Próxima acción

### Community 27 - "Community 27"
Cohesion: 0.29
Nodes (6): Estrategia de producto DataSeed, Fuente, Líneas activas, Narrativa, Posicionamiento, Tesis central

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (6): Compatibilidad temporal, DataSeed Repository Map, Estructura activa, Fuentes maestras, Graphify, Recuperación

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): Archivos seguros de este backup, Guía de restauración crítica — DataSeed / Demeter, Nunca commitear, Pasos de recuperación, Principios

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (5): Estado, Estructura, Landing copy DataSeed, Mensaje central, Reglas de edición

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (5): CTA, Para Pública by DataSeed, Pitch corto, Pitch ejecutivo, Sales pitch DataSeed

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (5): Estado, Puntos reutilizables, Reporte ejecutivo para stakeholders — síntesis, Síntesis, Uso recomendado

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (5): Cronjobs Hermes — DataSeed, Estado observado, Impacto de la reorganización, Migración recomendada después de merge, Rollback

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (5): Fuente maestra, Operación de Demeter, Próxima acción, Reglas clave, Rol

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (5): Fuente maestra, Principio, Restauración operativa, Rutas nuevas, Verificación rápida

### Community 36 - "Community 36"
Cohesion: 0.53
Nodes (4): disable_direct_git_credentials(), normalize_agent_vault_git_env(), setup_brokered_git_env(), daily-operations.sh script

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (5): Activación pendiente de infraestructura, Autenticación multi-tenant segura — Plan ejecutado, Decisión, Entregables, Objetivo

### Community 38 - "Community 38"
Cohesion: 0.33
Nodes (5): Fuente técnica, Guardrails de demo pública, Principios, Tópicos permitidos, Verificación sugerida

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): Estado, Hallazgo principal, Regla activa, Revisión de riesgo — portal/reportes públicos, Riesgos

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (3): migrationUrl, resourceTables, tenantTables

### Community 41 - "Community 41"
Cohesion: 0.50
Nodes (3): Archivo DataSeed, Regla, Subdirectorios

### Community 43 - "Community 43"
Cohesion: 0.40
Nodes (4): headers, redirects, rewrites, $schema

## Knowledge Gaps
- **234 isolated node(s):** `defaultProvider`, `config`, `config`, `config`, `config` (+229 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthorizationError` connect `Community 0` to `Community 8`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `defaultProvider`, `config`, `config` to the rest of the system?**
  _246 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06886338393187708 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09025974025974026 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._