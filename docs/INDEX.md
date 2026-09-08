# Índice maestro de documentación DataSeed

Este índice conecta la información activa e histórica del repo. Si un documento no está listado aquí, debe considerarse pendiente de clasificación.

## Fuentes maestras

| Documento | Estado | Responsable lógico | Tema | Rama/origen | Siguiente acción |
|---|---|---|---|---|---|
| `AGENTS.md` | Activo | Demeter | Guía operativa del agente | `main` | Mantener como única guía raíz |
| `docs/product/design-system.md` | Activo | Diseño/DataSeed | Identidad visual | `main` → `docs/product/` | Usar antes de cambios UI |
| `backups/RESTORE_GUIDE.md` | Activo | Operaciones | Recuperación crítica | `main` | Mantener alineado con scripts |
| `docs/operations/rollback.md` | Activo | Operaciones | Rollback reorganización | `refactor/repo-information-architecture` | Usar ante falla |

## Producto

| Documento | Estado | Responsable lógico | Tema | Rama/origen | Siguiente acción |
|---|---|---|---|---|---|
| `docs/product/agent-engine.md` | Activo | Producto | Agent Engine | Landing + demo proxy | Convertir en ficha comercial/técnica |
| `docs/product/design-system.md` | Activo | Diseño | Identidad visual DataSeed | `main` → `docs/product/` | Usar antes de cualquier cambio UI |
| `docs/product/publica.md` | Activo | Producto | Pública by DataSeed | `agent-landing-updates/docs/publica-ai-product-strategy.md` | Validar MVP ChileCompra |
| `docs/product/roadmap.md` | Borrador activo | Producto/Ops | Roadmap | Grafo multi-branch | Priorizar fases |
| `docs/product/strategy.md` | Activo | Dirección | Tesis estratégica | Stakeholder report + Pública strategy | Convertir en narrativa ejecutiva |

## Comercial

| Documento | Estado | Responsable lógico | Tema | Rama/origen | Siguiente acción |
|---|---|---|---|---|---|
| `docs/commercial/landing-copy.md` | Activo | Comercial/UX | Copy landing | `site/index.html` | Mantener sincronizado con landing |
| `docs/commercial/stakeholder-report.md` | Histórico útil | Dirección | Reporte ejecutivo | `agent-landing-updates/docs/reports/...` | Usar como base de pitch |
| `docs/commercial/faq.md` | Activo | Comercial | Objeciones/FAQ | Landing | Revisar trimestralmente |
| `docs/commercial/sales-pitch.md` | Activo | Comercial | Pitch ventas | Síntesis repo | Ajustar por cliente |

## Operaciones

| Documento | Estado | Responsable lógico | Tema | Rama/origen | Siguiente acción |
|---|---|---|---|---|---|
| `docs/operations/demeter.md` | Activo | Demeter/Ops | Rol y operación | `AGENTS.md` | Mantener impersonal y seguro |
| `docs/operations/task-tracking.md` | Activo | Ops | Task log/daily summary | `feat/task-tracking-system` | Validar cron a diario |
| `docs/operations/daily-backup.md` | Activo | Ops | Backup 05:00 Chile | `backups/BACKUP.md` | Alinear outputs |
| `docs/operations/restore.md` | Activo | Ops | Restauración | `backups/RESTORE_GUIDE.md` | Mantener con restore.sh |
| `docs/operations/cronjobs.md` | Activo | Ops | Cronjobs Hermes | `cronjob list` | Migrar rutas tras merge |
| `docs/operations/graphify.md` | Activo | Ops/Arquitectura | Grafo de conocimiento | `graphify-out/GRAPH_REPORT.md` | Regenerar tras cambios |
| `docs/operations/branch-inventory.md` | Activo | Ops/Arquitectura | Inventario y estado de branches | `git for-each-ref` | Revisar antes de cerrar ramas |
| `docs/operations/rollback.md` | Activo | Ops | Rollback | Plan operativo | Usar antes de revertir |

## Seguridad

| Documento | Estado | Responsable lógico | Tema | Rama/origen | Siguiente acción |
|---|---|---|---|---|---|
| `docs/security/secret-policy.md` | Activo | Seguridad/Ops | Secretos prohibidos | `AGENTS.md` + backups | Revisar antes de push |
| `docs/security/demo-guardrails.md` | Activo | Seguridad/Producto | Guardrails demo pública | `scripts/web/dataseed_demo_proxy.py` | Probar prompts riesgosos |
| `docs/security/auth-plan.md` | Histórico útil | Seguridad/Producto | Firebase/GCP Auth | `agent-landing-updates/docs/auth-login-plan.md` | Revalidar con admin GCP |
| `docs/security/public-demo-risk-review.md` | Histórico útil | Seguridad | Riesgos portal/reportes | `agent-landing-updates/docs/security-daily-report-portal-review.md` | No publicar JSON privado |
| `docs/security/service-role-key-decision.md` | **Cerrado** | Seguridad/Auth | ¿Va `SUPABASE_SERVICE_ROLE_KEY` en Vercel? **No.** Decisión de producto tomada: Pública freemium self-serve, portal de Dataseed por invitación; el alta va por `provision_self_serve_org()` (`security definer`), sin la clave | Pedido de Matías 2026-09-08, cerrado el mismo día | Ejecutar el trabajo pendiente del doc; empieza en `site/login.js:137` |
| `docs/security/dnsaid-readiness.md` | Activo | Seguridad | Evaluación DNS-AID (no adoptar) | Revisión pasiva 2026-08-30 | Reevaluar solo si cambian criterios |
| `docs/security/agent-readiness-audit-2026-08-30.md` | Activo | Seguridad/SEO | Canonical, redirects, metadatos, Content-Signal, Markdown for Agents pendiente | `vercel.json` + `site/index.html` | Validar redirects en preview antes de mergear |

## Archivo

- `archive/legacy/AGENT.md`: guía antigua conservada; `AGENTS.md` es la fuente activa.
- `archive/testing/`: archivos de prueba movidos fuera de raíz.
