# Backup operativo no sensible — DataSeed / Demeter

- Generado UTC: 2026-07-06 09:00:21 UTC
- Generado America/Santiago: 2026-07-06 05:00:21 -04
- Alcance: estado operativo no sensible para recuperación crítica.
- Política: no se respaldan credenciales, tokens, secretos OAuth, contraseñas, sesiones de mensajería, bases de datos runtime, logs completos, caches ni adjuntos. Scripts/documentos adicionales requieren aprobación explícita; ante duda se omiten.
- Rama objetivo: `main` en `https://github.com/contacto101/data_seed.git`.

Los datos respaldados son semillas operativas: identidad, configuración resumida, cron jobs sanitizados, skills instalados, scripts seguros de restauración y ciclos grandes completados.

## Seguimiento de tareas y alcance del backup

- El `task-log.md` es volátil: se actualiza durante el día y se limpia a las 05:00 AM America/Santiago.
- El `daily-summary.md` conserva el resumen diario y debe consultarse para tareas diarias, pendientes y bloqueos.
- El backup diario de las 05:00 AM NO copia `task-log.md` ni `daily-summary.md`; solo deja esta referencia para consultarlos en el repo de tracking.
- Este backup sí copia `backups/COMPLETED_CYCLES.md`, que contiene únicamente ciclos grandes completados.
- Repo/branch de tracking: `/opt/data/data_seed_tasklog_worktree` / `feat/task-tracking-system`.
- Daily summary: `daily-summary.md` (61.9 KB, sha256 b1646d07790527a7).
- Task log actual: `task-log.md` (213.0 B, sha256 1512ddaa0df19af1).
- Ciclos grandes completados fuente: `backups/COMPLETED_CYCLES.md` (594.0 B, sha256 6fd18874fbd0ad90).

Regla operativa: el log diario registra detalles; el resumen diario consolida tareas y pendientes; el backup de las 05:00 AM solo guarda ciclos grandes completados y una referencia hacia el resumen diario.

## Identidad operativa

- Agente operativo: Demeter.
- Proyecto: DataSeed.
- Runtime técnico: Hermes Agent.
- Perfil activo esperado: `default`.
- Directorio persistente esperado: `/opt/data`.

## Estado técnico

- Host: `Linux-6.8.0-124-generic-x86_64-with-glibc2.41`
- Python: `3.13.5`
- Hermes home: `/opt/data`
- Backup repo dir: `/opt/data/data_seed_daily_backup`
- Backup branch: `main`
- Hermes binary: `/opt/hermes/.venv/bin/hermes`
- Disk snapshot:
  `Filesystem      Size  Used Avail Use% Mounted on`
  `/dev/sda1        96G   16G   80G  17% /opt/data`

## Configuración Hermes sanitizada

- Config path: `/opt/data/config.yaml` (17.8 KB, sha256 1f4976130991156d)
- Model provider: `openai-codex`
- Model default: `gpt-5.5`
- Agent max_turns: `60`
- Agent reasoning_effort: `xhigh`
- Display personality: `concise`
- Display show_reasoning: `false`
- Terminal backend: `local`
- Terminal cwd: `.`
- Top-level toolsets: `hermes-cli`

## Cron jobs configurados y estado

Total jobs: 4. Sensitive fields excluded: prompt, deliver, delivery targets.

- `ea05ea193912` [active]
  - Nombre: Demeter Daily Operations (5:00 AM Chile)
  - Schedule: 0 9 * * *
  - Next run UTC: 2026-07-07T09:00:00+00:00
  - Last run UTC/status: 2026-07-05T09:00:20.265161+00:00 / ok
  - Mode: no-agent
  - Script: daily-operations-wrapper.sh
- `0fffb87e5be9` [active]
  - Nombre: DataSeed Agent Factory Funnel Revenue Builder/Tester
  - Schedule: 0 */2 * * *
  - Next run UTC: 2026-07-06T10:00:00+00:00
  - Last run UTC/status: 2026-07-06T08:00:33.972128+00:00 / error
  - Mode: agent
  - Workdir: /opt/data
  - Skills: hermes-agent, kanban-agent-workflows, spike
  - Enabled toolsets: web, search, browser, file, terminal, session_search, skills
- `2caf9a63f6d7` [active]
  - Nombre: DataSeed Agent Factory Funnel Revenue Validator
  - Schedule: 30 */2 * * *
  - Next run UTC: 2026-07-06T10:30:00+00:00
  - Last run UTC/status: 2026-07-06T08:30:34.237030+00:00 / error
  - Mode: agent
  - Workdir: /opt/data
  - Skills: hermes-agent, kanban-agent-workflows, spike
  - Enabled toolsets: web, search, browser, file, terminal, session_search, skills
- `56f0366edcb7` [active]
  - Nombre: DataSeed Agent Factory Funnel Market Alert (Background Only)
  - Schedule: every 60m
  - Next run UTC: 2026-07-06T09:52:18.064400+00:00
  - Last run UTC/status: 2026-07-06T08:52:18.064400+00:00 / ok
  - Mode: no-agent
  - Script: agent-factory-funnel-alert.sh

## Skills instalados

- `apple-notes` (apple/apple-notes) — Manage Apple Notes via memo CLI: create, search, edit.
- `apple-reminders` (apple/apple-reminders) — Apple Reminders via remindctl: add, list, complete.
- `findmy` (apple/findmy) — Track Apple devices/AirTags via FindMy.app on macOS.
- `imessage` (apple/imessage) — Send and receive iMessages/SMS via the imsg CLI on macOS.
- `ai-coding-agent-orchestration` (autonomous-ai-agents/ai-coding-agent-orchestration) — Use when delegating software work to external AI coding CLIs such as Claude Code, Codex, or OpenCode, including one-shot, background, interactive, PR review, and parallel worktree workflows.
- `claude-code` (autonomous-ai-agents/claude-code) — Delegate coding to Claude Code CLI (features, PRs).
- `codex` (autonomous-ai-agents/codex) — Delegate coding to OpenAI Codex CLI (features, PRs).
- `hermes-agent` (autonomous-ai-agents/hermes-agent) — Configure, extend, or contribute to Hermes Agent.
- `opencode` (autonomous-ai-agents/opencode) — Delegate coding to OpenCode CLI (features, PR review).
- `computer-use` (computer-use) — |
- `architecture-diagram` (creative/architecture-diagram) — Dark-themed SVG architecture/cloud/infra diagrams as HTML.
- `ascii-art` (creative/ascii-art) — ASCII art: pyfiglet, cowsay, boxes, image-to-ascii.
- `ascii-video` (creative/ascii-video) — ASCII video: convert video/audio to colored ASCII MP4/GIF.
- `baoyu-infographic` (creative/baoyu-infographic) — Infographics: 21 layouts x 21 styles (信息图, 可视化).
- `claude-design` (creative/claude-design) — Design one-off HTML artifacts (landing, deck, prototype).
- `comfyui` (creative/comfyui) — Generate images, video, and audio with ComfyUI — install, launch, manage nodes/models, run workflows with parameter injection. Uses the official comfy-cli for lifecycle and direct REST/WebSocket API for execution.
- `design-md` (creative/design-md) — Author/validate/export Google
- `excalidraw` (creative/excalidraw) — Hand-drawn Excalidraw JSON diagrams (arch, flow, seq).
- `humanizer` (creative/humanizer) — Humanize text: strip AI-isms and add real voice.
- `impeccable` (creative/impeccable) — Safe Hermes adaptation of Impeccable: use with ui-ux-pro-max for production-grade frontend/UI design, critique, audit, polish, layout, typography, motion, accessibility, responsive behavior, UX copy, design systems, and anti-AI-slop review. Excludes upstream live-browser scripts, hooks, and auto-install commands that were blocked by Hermes security scan.
- `lightweight-creative-prototyping` (creative/lightweight-creative-prototyping) — Use when producing quick creative artifacts without a full specialized pipeline: throwaway HTML mockups, Claude-designed pages, and terminal ASCII art.
- `manim-video` (creative/manim-video) — Manim CE animations: 3Blue1Brown math/algo videos.
- `p5js` (creative/p5js) — p5.js sketches: gen art, shaders, interactive, 3D.
- `popular-web-designs` (creative/popular-web-designs) — 54 real design systems (Stripe, Linear, Vercel) as HTML/CSS.
- `pretext` (creative/pretext) — Use when building creative browser demos with @chenglou/pretext — DOM-free text layout for ASCII art, typographic flow around obstacles, text-as-geometry games, kinetic typography, and text-powered generative art. Produces single-file HTML demos by default.
- `sketch` (creative/sketch) — Throwaway HTML mockups: 2-3 design variants to compare.
- `songwriting-and-ai-music` (creative/songwriting-and-ai-music) — Songwriting craft and Suno AI music prompts.
- `touchdesigner-mcp` (creative/touchdesigner-mcp) — Control a running TouchDesigner instance via twozero MCP — create operators, set parameters, wire connections, execute Python, build real-time visuals. 36 native tools.
- `jupyter-live-kernel` (data-science/jupyter-live-kernel) — Iterative Python via live Jupyter kernel (hamelnb).
- `deployment-platform-verification` (devops/deployment-platform-verification) — Verify deployment-platform connections (Vercel, Netlify, Render, cloud deploy APIs) safely using real API calls without exposing secrets.
- `kanban-agent-workflows` (devops/kanban-agent-workflows) — Use when orchestrating Kanban-style multi-agent work: board setup, task decomposition, worker prompts, status transitions, and recovery.
- `operational-recovery-backups` (devops/operational-recovery-backups) — Build and maintain safe operational recovery backups for Hermes/DataSeed: cron job reconstruction, non-secret GitHub snapshots, rollback docs, script inclusion policies, graphify knowledge graph backup, and unified cleanup-then-backup daily operations.
- `safe-mcp-api-integrations` (devops/safe-mcp-api-integrations) — Build and configure MCP API integrations with a safety proxy that preserves operational access while blocking irreversible actions.
- `whatsapp-gateway-config` (devops/whatsapp-gateway-config) — WhatsApp gateway configuration for Hermes Agent — require_mention, dm_policy, group_policy, allow_from, mention_patterns, group_sessions_per_user, and all platform-specific settings.
- `dogfood` (dogfood) — Exploratory QA of web apps: find bugs, evidence, reports.
- `himalaya` (email/himalaya) — Himalaya CLI: IMAP/SMTP email from terminal.
- `codebase-inspection` (github/codebase-inspection) — Inspect codebases w/ pygount: LOC, languages, ratios.
- `github-auth` (github/github-auth) — GitHub auth setup: HTTPS tokens, SSH keys, gh CLI login.
- `github-code-review` (github/github-code-review) — Review PRs: diffs, inline comments via gh or REST.
- `github-issues` (github/github-issues) — Create, triage, label, assign GitHub issues via gh or REST.
- `github-pr-workflow` (github/github-pr-workflow) — GitHub PR lifecycle: branch, commit, open, CI, merge.
- `github-repo-management` (github/github-repo-management) — Clone/create/fork repos; manage remotes, releases.
- `audio-music-media-workflows` (media/audio-music-media-workflows) — Use when creating, transforming, searching, or analyzing lightweight audio/music/media assets: songwriting prompts, local song generation, audio feature visualization, and GIF retrieval.
- `gif-search` (media/gif-search) — Search/download GIFs from Tenor via curl + jq.
- `heartmula` (media/heartmula) — HeartMuLa: Suno-like song generation from lyrics + tags.
- `songsee` (media/songsee) — Audio spectrograms/features (mel, chroma, MFCC) via CLI.
- `youtube-content` (media/youtube-content) — YouTube transcripts to summaries, threads, blogs.
- `evaluating-llms-harness` (mlops/evaluation/lm-evaluation-harness) — lm-eval-harness: benchmark LLMs (MMLU, GSM8K, etc.).
- `weights-and-biases` (mlops/evaluation/weights-and-biases) — W&B: log ML experiments, sweeps, model registry, dashboards.
- `huggingface-hub` (mlops/huggingface-hub) — HuggingFace hf CLI: search/download/upload models, datasets.
- `llama-cpp` (mlops/inference/llama-cpp) — llama.cpp local GGUF inference + HF Hub model discovery.
- `obliteratus` (mlops/inference/obliteratus) — OBLITERATUS: abliterate LLM refusals (diff-in-means).
- `serving-llms-vllm` (mlops/inference/vllm) — vLLM: high-throughput LLM serving, OpenAI API, quantization.
- `audiocraft-audio-generation` (mlops/models/audiocraft) — AudioCraft: MusicGen text-to-music, AudioGen text-to-sound.
- `segment-anything-model` (mlops/models/segment-anything) — SAM: zero-shot image segmentation via points, boxes, masks.
- `obsidian` (note-taking/obsidian) — Read, search, create, and edit notes in the Obsidian vault.
- `airtable` (productivity/airtable) — Airtable REST API via curl. Records CRUD, filters, upserts.
- `apple-platform-automation` (productivity/apple-platform-automation) — Use when automating Apple/macOS apps and services from Hermes: Notes, Reminders, Messages, Find My, and visual computer-use workflows.
- `google-workspace` (productivity/google-workspace) — Gmail, Calendar, Drive, Docs, Sheets via gws CLI or Python.
- `maps` (productivity/maps) — Geocode, POIs, routes, timezones via OpenStreetMap/OSRM.
- `nano-pdf` (productivity/nano-pdf) — Edit PDF text/typos/titles via nano-pdf CLI (NL prompts).
- `notion` (productivity/notion) — Notion API + ntn CLI: pages, databases, markdown, Workers.
- `ocr-and-documents` (productivity/ocr-and-documents) — Extract text from PDFs/scans (pymupdf, marker-pdf).
- `petdex` (productivity/petdex) — Install and select animated petdex mascots for Hermes.
- `powerpoint` (productivity/powerpoint) — Create, read, edit .pptx decks, slides, notes, templates.
- `teams-meeting-pipeline` (productivity/teams-meeting-pipeline) — Operate the Teams meeting summary pipeline via Hermes CLI — summarize meetings, inspect pipeline status, replay jobs, manage Microsoft Graph subscriptions.
- `godmode` (red-teaming/godmode) — Jailbreak LLMs: Parseltongue, GODMODE, ULTRAPLINIAN.
- `arxiv` (research/arxiv) — Search arXiv papers by keyword, author, category, or ID.
- `blogwatcher` (research/blogwatcher) — Monitor blogs and RSS/Atom feeds via blogwatcher-cli tool.
- `llm-wiki` (research/llm-wiki) — Karpathy
- `polymarket` (research/polymarket) — Query Polymarket: markets, prices, orderbooks, history.
- `research-paper-writing` (research/research-paper-writing) — Write ML papers for NeurIPS/ICML/ICLR: design→submit.
- `openhue` (smart-home/openhue) — Control Philips Hue lights, scenes, rooms via OpenHue CLI.
- `xurl` (social-media/xurl) — X/Twitter via xurl CLI: post, search, DM, media, v2 API.
- `hermes-agent-skill-authoring` (software-development/hermes-agent-skill-authoring) — Author in-repo SKILL.md: frontmatter, validator, structure, and writing-quality principles.
- `knowledge-graph-codebase-navigation` (software-development/knowledge-graph-codebase-navigation) — Build and use local knowledge graphs for codebase/navigation tasks, especially via Graphify, MCP, and agent skills.
- `live-documentation-mcp` (software-development/live-documentation-mcp) — Configure and use live documentation sources such as Context7 for coding agents via MCP or CLI fallback.
- `node-inspect-debugger` (software-development/node-inspect-debugger) — Debug Node.js via --inspect + Chrome DevTools Protocol CLI.
- `plan` (software-development/plan) — Plan mode: write an actionable markdown plan to .hermes/plans/, no execution. Bite-sized tasks, exact paths, complete code.
- `python-debugpy` (software-development/python-debugpy) — Debug Python: pdb REPL + debugpy remote (DAP).
- `requesting-code-review` (software-development/requesting-code-review) — Pre-commit review: security scan, quality gates, auto-fix.
- `simplify-code` (software-development/simplify-code) — Parallel 3-agent cleanup of recent code changes.
- `software-debugging-and-quality` (software-development/software-debugging-and-quality) — Use when improving software correctness: root-cause debugging, TDD, debugger attachment, pre-commit review, simplification passes, and throwaway validation spikes.
- `spike` (software-development/spike) — Throwaway experiments to validate an idea before build.
- `systematic-debugging` (software-development/systematic-debugging) — 4-phase root cause debugging: understand bugs before fixing.
- `test-driven-development` (software-development/test-driven-development) — TDD: enforce RED-GREEN-REFACTOR, tests before code.
- `ui-ux-pro-max` (ui-ux-pro-max) — UI/UX design intelligence for web and mobile. Includes 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across 10 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, and HTML/CSS). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, and check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, and mobile app. Elements: button, modal, navbar, sidebar, card, table, form, and chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, and flat design. Topics: color systems, accessibility, animation, layout, typography, font pairing, spacing, interaction states, shadow, and gradient. Integrations: shadcn/ui MCP for component search and examples.
- `yuanbao` (yuanbao) — Yuanbao (元宝) groups: @mention users, query info/members.

## Archivos operativos clave observados

No se copia el contenido de estos archivos; solo tamaño y huella para validación.

- `config.yaml`: 17.8 KB, sha256 1f4976130991156d
- `memories/MEMORY.md`: 2.0 KB, sha256 607170d225fb9f59
- `memories/USER.md`: 1.3 KB, sha256 02a1208d1eb2b93f
- `channel_directory.json`: 1.0 KB, sha256 7096799e32ad6e75
- `gateway_state.json`: 545.0 B, sha256 60fdf0b56be2eb5a
- `cron/jobs.json`: 15.2 KB, sha256 a36e20d04aba58c6

## Grafo de conocimiento del proyecto (Graphify)

El grafo de Graphify mapea las relaciones entre archivos, funciones y conceptos del proyecto.
Se genera con `scripts/generate-multibranch-graph.py`, que crea un snapshot temporal de todos los branches remotos, deduplica archivos idénticos bajo `_shared/` y copia al repo solo los artefactos livianos versionables.

- Directorio del grafo: `graphify-out/`
- Archivos incluidos en este backup: `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`
- Archivos grandes NO incluidos (regenerables): `graph.html`, `graph.json`, `cache/`, snapshots multibranch temporales
- Para regenerar: `cd /opt/data/data_seed && python3 scripts/generate-multibranch-graph.py`
- Reporte del grafo: `graphify-out/GRAPH_REPORT.md` (incluido en este backup)

## Archivos actualizados por este backup

- `backups/BACKUP.md`
- `backups/COMPLETED_CYCLES.md`
- `backups/RESTORE_GUIDE.md`
- `backups/restore.sh`
- `scripts/demeter_daily_backup.py`
- `scripts/daily-operations.sh`
- `scripts/daily-operations-wrapper.sh`
- `scripts/ops/demeter_daily_backup.py`
- `scripts/ops/daily-operations.sh`
- `scripts/ops/daily-operations-wrapper.sh`
- `scripts/ops/daily-task-log-cleanup.sh`
- `scripts/ops/github_api_commit.py`
- `scripts/github_api_commit.py`
- `scripts/generate-multibranch-graph.py`
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/manifest.json`
- `graphify-out/.graphify_labels.json`

## Scripts de cron seguros incluidos

- No hay scripts adicionales copiados como copia dura.

## Scripts/documentos pendientes de aprobación humana

- `daily-operations-wrapper.sh`: pendiente; existe pero NO se copia como copia dura sin aprobación explícita en `/opt/data/backup_hardcopy_allowlist.txt`.
- `agent-factory-funnel-alert.sh`: pendiente; existe pero NO se copia como copia dura sin aprobación explícita en `/opt/data/backup_hardcopy_allowlist.txt`.

## Exclusiones estrictas

No se exportan ni se copian:

- `.env`, `.git-credentials`, `auth.json`, `google_token.json`, `google_client_secret.json`, `creds.json`.
- Sesiones de WhatsApp, Telegram, Discord u otras plataformas.
- `state.db`, bases de datos runtime, WAL/SHM, caches, adjuntos, audios, imágenes o documentos de usuario.
- Prompts completos de cron, destinos de entrega, chat identifiers, nombres de contactos o datos personales.
- Logs completos o dumps de conversaciones.
- `task-log.md` y `daily-summary.md`: no se copian al backup; se consultan en el branch de tracking (`feat/task-tracking-system`).

## Restauración

1. Consultar `backups/RESTORE_GUIDE.md`.
2. Ejecutar `backups/restore.sh` solo para verificación segura; no restaura secretos.
3. Reconfigurar credenciales y OAuth manualmente desde fuentes autorizadas.
4. Reconstituir cron jobs desde esta sección y desde instrucciones humanas autorizadas para prompts/destinos excluidos.
