#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = '/opt/data/automations/daily-area-reporting';
const DEFAULT_STATE_DIR = path.join(ROOT, 'state');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'output');
const TRACKING_REPO = process.env.DATASEED_TASK_TRACKING_REPO_DIR || '/opt/data/data_seed_tasklog_worktree';
const TASK_LOG = path.join(TRACKING_REPO, 'task-log.md');
const DAILY_SUMMARY = path.join(TRACKING_REPO, 'daily-summary.md');
const GAPI_PY = '/opt/hermes/.venv/bin/python';
const GAPI_SCRIPT = '/opt/data/skills/productivity/google-workspace/scripts/google_api.py';
const DRIVE_ROOT = '12nCWotIEOW4EMkCW0dHKKmSAEKrzGMpp';
const CANONICAL_TEMPLATE_ROOT = '/opt/data/data_seed_daily_backup/backups/reporting';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
let STATE_DIR = DEFAULT_STATE_DIR;
let OUTPUT_DIR = DEFAULT_OUTPUT_DIR;
let TEMPLATE_ROOT = CANONICAL_TEMPLATE_ROOT;
const VERSION = '1.3.0';

const DEFAULT_RECIPIENTS = [
  { email: 'matias@dataseed.cl', name: 'Matias' },
  { email: 'arturo.barea@dataseed.cl', name: 'Arturo' },
  { email: 'daniel.caignet@dataseed.cl', name: 'Daniel' },
  { email: 'eli.gamboa@dataseed.cl', name: 'Eli' },
  { email: 'javier.rodriguez@dataseed.cl', name: 'Javier' },
];
const ALLOWED_RECIPIENTS = new Set([...DEFAULT_RECIPIENTS.map(item => item.email), 'demeter@dataseed.cl']);

const AREAS = [
  {
    key: 'direccion', display: 'Dirección y Estrategia', slug: 'DIRECCION_Y_ESTRATEGIA',
    folderId: '1zemqigF_8BJHmta_DQnEnuzRPQrCsZth',
    keywords: ['direccion', 'estrategia', 'estrategico', 'okr', 'prioridad', 'gobernanza', 'decision ejecutiva', 'plan de negocio'],
  },
  {
    key: 'producto', display: 'Producto', slug: 'PRODUCTO',
    folderId: '1k1OCtcgoKAHJ7heP5rJVzcvz35qpbDVf',
    keywords: ['producto', 'feature', 'funcionalidad', 'roadmap', 'experiencia de usuario', ' ux ', ' ui ', 'prototipo', 'requisito de producto'],
  },
  {
    key: 'ingenieria', display: 'Ingeniería y Tecnología', slug: 'INGENIERIA_Y_TECNOLOGIA',
    folderId: '14WhiFFbmvnHJfkY7gFUP9X3R00riuo5e',
    keywords: ['ingenieria', 'tecnologia', 'codigo', 'repositorio', 'github', 'branch', 'commit', ' push ', 'pull request', ' api ', 'backend', 'frontend', 'deploy', 'despliegue', 'docker', 'traefik', 'bug', 'prueba tecnica', 'test de codigo'],
  },
  {
    key: 'datos_ia', display: 'Datos e Inteligencia Artificial', slug: 'DATOS_E_IA',
    folderId: '1pwc9wg8uF3a1-WRjSuiZI7mc16bXgfnz',
    keywords: ['datos', 'inteligencia artificial', ' ia ', ' ai ', 'llm', 'modelo', 'machine learning', 'analitica', 'analytics', 'graphify', 'grafo de conocimiento', 'dataset'],
  },
  {
    key: 'ventas', display: 'Ventas', slug: 'VENTAS',
    folderId: '1gTp4RPL0x1hSogZEcJgvUUFHp3GnAqF-',
    keywords: ['ventas', 'venta', 'lead', 'prospecto', 'pipeline comercial', 'oportunidad comercial', 'cliente potencial', 'revenue', 'cotizacion', 'propuesta comercial'],
  },
  {
    key: 'marketing', display: 'Marketing y Growth', slug: 'MARKETING_Y_GROWTH',
    folderId: '1Az8_shQpqKzv5t-DvVK0gC0Sk951Yv5a',
    keywords: ['marketing', 'growth', 'campana', 'seo', 'contenido', 'social media', 'marca', 'branding', 'copy', 'landing', 'conversion', 'adquisicion'],
  },
  {
    key: 'cliente', display: 'Éxito del Cliente y Soporte', slug: 'EXITO_DEL_CLIENTE_Y_SOPORTE',
    folderId: '1YFPQLZrs5XUYKZ7mWnyxqAFJfC_4cNjr',
    keywords: ['exito del cliente', 'customer success', 'soporte', 'ticket', 'incidencia de cliente', 'onboarding', 'satisfaccion', 'retencion', 'churn', 'consulta de cliente'],
  },
  {
    key: 'operaciones', display: 'Operaciones', slug: 'OPERACIONES',
    folderId: '1mx-lKtxP5ojTfbT8ZiTn7WSMICMOdIbH',
    keywords: ['operaciones', 'operativo', 'cronjob', ' cron ', 'backup', 'tasklog', 'task-log', 'automatizacion', 'proceso', 'reporte', 'reportes', 'google drive', ' drive ', 'correo', 'gmail', 'compartir carpeta', 'permiso de drive', 'documentacion operativa', 'recuperacion', 'monitoreo'],
  },
  {
    key: 'finanzas', display: 'Finanzas', slug: 'FINANZAS',
    folderId: '1gznNrI1kaas_YPRDia9JK4rzYFBeyEl2',
    keywords: ['finanzas', 'financiero', 'presupuesto', 'factura', 'pago', 'cobro', 'runway', 'coste', 'costo', 'gasto', 'ingreso', 'tesoreria'],
  },
  {
    key: 'personas', display: 'Personas y Cultura', slug: 'PERSONAS_Y_CULTURA',
    folderId: '1sZCv8rm-FOfuXSOoMJELPDNZkmWUpnED',
    keywords: ['personas y cultura', 'recursos humanos', ' rrhh ', 'contratacion', 'hiring', 'equipo', 'rol', 'cultura', 'capacitacion', 'desempeno', 'integrante'],
  },
  {
    key: 'legal', display: 'Legal, Riesgos y Seguridad', slug: 'LEGAL_RIESGOS_Y_SEGURIDAD',
    folderId: '1ONK7lYjx0nDcVAqKsv_-inpp0TeRVApS',
    keywords: ['legal', 'riesgo', 'seguridad', 'ciberseguridad', 'cumplimiento', 'compliance', 'contrato', 'privacidad', 'proteccion de datos', 'vulnerabilidad', 'autenticacion', 'autorizacion', 'secreto', 'credencial'],
  },
];

function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function readRequiredTemplate(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Plantilla obligatoria no encontrada: ${file}`);
  }
  const content = fs.readFileSync(file, 'utf8');
  if (!content.trim()) throw new Error(`Plantilla obligatoria vacia: ${file}`);
  return content;
}

function numberedSections(markdown) {
  const sections = {};
  for (const match of markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)) sections[match[1]] = match[2].trim();
  return sections;
}

function bulletsUnderHeading(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'm'));
  if (!match) return [];
  return [...match[1].matchAll(/^[-*]\s+(.+)$/gm)].map(item => item[1].trim()).filter(Boolean);
}

function orderedItemsUnderHeading(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'm'));
  if (!match) return {};
  const items = {};
  for (const item of match[1].matchAll(/^(\d+)\.\s+(.+)$/gm)) items[item[1]] = item[2].trim();
  return items;
}

function loadReportTemplate(area) {
  const basePath = path.join(TEMPLATE_ROOT, 'PLANTILLA_BASE__REPORTE_DE_AREA__v1.md');
  const rulePath = path.join(TEMPLATE_ROOT, 'REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md');
  const areaPath = path.join(TEMPLATE_ROOT, 'areas', `PLANTILLA__${area.slug}__v1.md`);
  const baseContent = readRequiredTemplate(basePath);
  const ruleContent = readRequiredTemplate(rulePath);
  const areaContent = readRequiredTemplate(areaPath);
  const suggestedKpis = bulletsUnderHeading(areaContent, 'KPI sugeridos').slice(0, 5);
  if (!suggestedKpis.length) throw new Error(`Plantilla de area sin KPI sugeridos: ${areaPath}`);
  const baseSections = numberedSections(baseContent);
  const areaSections = numberedSections(areaContent);
  for (let number = 1; number <= 11; number += 1) {
    if (!baseSections[String(number)]) throw new Error(`Plantilla base incompleta: falta seccion ${number} en ${basePath}`);
  }
  for (let number = 1; number <= 9; number += 1) {
    if (!areaSections[String(number)]) throw new Error(`Plantilla de area incompleta: falta seccion ${number} en ${areaPath}`);
  }
  if (!/^## Fuente obligatoria de estructura$/m.test(ruleContent)
      || !/^## Estructura que debe conservarse$/m.test(ruleContent)
      || !/documentos editables/i.test(ruleContent)
      || !/No publicar reportes finales como archivos `\.md`/i.test(ruleContent)) {
    throw new Error(`Regla de salida invalida: ${rulePath}`);
  }
  const ruleStructure = orderedItemsUnderHeading(ruleContent, 'Estructura que debe conservarse');
  const ruleRequirements = {
    1: /resumen ejecutivo/i,
    2: /salud general.*verde.*amarillo.*rojo.*n\/d/i,
    3: /kpi.*resultado.*meta.*variaci[oó]n.*tendencia.*fuente.*due[nñ]o/i,
    4: /logros.*evidencia/i,
    5: /pr[oó]ximos? hitos?/i,
    6: /riesgos?.*mitigaciones?/i,
    7: /dependencias?.*inter[aá]rea/i,
    8: /decisiones?.*requeridas?/i,
    9: /calidad.*limitaciones?.*datos/i,
  };
  for (const [number, requirement] of Object.entries(ruleRequirements)) {
    if (!ruleStructure[number] || !requirement.test(ruleStructure[number])) throw new Error(`Regla de salida invalida: falta estructura ${number} en ${rulePath}`);
  }
  const sectionTitles = { ...baseSections, ...areaSections };
  return {
    root: TEMPLATE_ROOT,
    baseFile: path.relative(TEMPLATE_ROOT, basePath),
    areaFile: path.relative(TEMPLATE_ROOT, areaPath),
    ruleFile: path.relative(TEMPLATE_ROOT, rulePath),
    baseSha256: sha256Text(baseContent),
    areaSha256: sha256Text(areaContent),
    ruleSha256: sha256Text(ruleContent),
    suggestedKpis,
    sectionTitles,
  };
}

function sectionHeading(report, number) {
  return `${number}. ${report.template.sectionTitles[String(number)]}`;
}

function parseArgs(argv) {
  const out = { dryRun: false, test: false, testId: null, reportDate: null, recipients: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--test') out.test = true;
    else if (arg === '--test-id') out.testId = argv[++i];
    else if (arg === '--report-date') out.reportDate = argv[++i];
    else if (arg === '--recipients') {
      const value = argv[++i];
      if (!value) throw new Error('--recipients requiere una lista');
      out.recipients = value.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
      if (!out.recipients.length) throw new Error('--recipients requiere al menos un destinatario');
    } else throw new Error(`Argumento no reconocido: ${arg}`);
  }
  if (out.reportDate && !/^\d{4}-\d{2}-\d{2}$/.test(out.reportDate)) throw new Error('Fecha invalida; use YYYY-MM-DD');
  if (out.testId && !/^\d{6}$/.test(out.testId)) throw new Error('Test ID invalido; use HHMMSS');
  if (out.testId && !out.test) throw new Error('--test-id requiere --test');
  if (out.test && !out.dryRun) throw new Error('--test requiere --dry-run; Drive solo admite reportes finales');
  for (const email of out.recipients || []) {
    if (!ALLOWED_RECIPIENTS.has(email)) throw new Error(`Destinatario no autorizado: ${email}`);
  }
  return out;
}

function configureRuntimePaths(args) {
  const overrides = [
    ['DATASEED_REPORT_TEMPLATE_ROOT', value => { TEMPLATE_ROOT = path.resolve(value); }],
    ['DATASEED_REPORT_OUTPUT_ROOT', value => { OUTPUT_DIR = path.resolve(value); }],
    ['DATASEED_REPORT_STATE_ROOT', value => { STATE_DIR = path.resolve(value); }],
  ];
  for (const [name, apply] of overrides) {
    const value = process.env[name];
    if (!value) continue;
    if (!args.dryRun) throw new Error(`${name} solo se permite con --dry-run`);
    apply(value);
  }
}

function chileParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function isoDate(parts) { return `${parts.year}-${parts.month}-${parts.day}`; }

function previousDate(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return prev.toISOString().slice(0, 10);
}

function nextDate(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + 86400000).toISOString().slice(0, 10);
}

function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function meaningfulPending(text) {
  const value = String(text || '').trim();
  const normalized = normalize(value).replace(/[.!;:,]+$/g, '').trim();
  if (/^(?:ningun[oa]s?|sin pendientes?|no (?:hay )?pendientes?|no aplica|n\/?a|n\/?d|-)$/i.test(normalized)) return '';
  return value;
}

function sanitize(text, max = 900) {
  let value = String(text || '');
  value = value
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi, '[REDACTED]')
    .replace(/https?:\/\/[^/@\s]+:[^/@\s]+@/gi, 'https://***@')
    .replace(/\b(?:gh[pousr]_|github_pat_|av_agt_|sk-)[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{35}\b/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi, 'Bearer [REDACTED]')
    .replace(/["']?\b(password|passwd|secret|token|api[_ -]?key|client[_ -]?secret|private[_ -]?key|aws[_ -]?(?:secret[_ -]?access[_ -]?key|access[_ -]?key[_ -]?id|session[_ -]?token)|google[_ -]?(?:api[_ -]?)?key)["']?\s*[:=]\s*"[^"]*"/gi, '$1: [REDACTED]')
    .replace(/["']?\b(password|passwd|secret|token|api[_ -]?key|client[_ -]?secret|private[_ -]?key|aws[_ -]?(?:secret[_ -]?access[_ -]?key|access[_ -]?key[_ -]?id|session[_ -]?token)|google[_ -]?(?:api[_ -]?)?key)["']?\s*[:=]\s*'[^']*'/gi, '$1: [REDACTED]')
    .replace(/["']?\b(password|passwd|secret|token|api[_ -]?key|client[_ -]?secret|private[_ -]?key|aws[_ -]?(?:secret[_ -]?access[_ -]?key|access[_ -]?key[_ -]?id|session[_ -]?token)|google[_ -]?(?:api[_ -]?)?key)["']?\s*[:=]\s*[^\s,;]+/gi, '$1: [REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  if (value.length > max) value = `${value.slice(0, max - 1)}…`;
  return value;
}

function hashTask(task) {
  const identity = {
    date: task.date,
    title: task.title,
    request: task.request,
    outcome: task.outcome,
    verification: task.verification,
    pending: task.pending,
    state: task.state,
  };
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

function extractSummaryBlock(text, summaryDate) {
  const marker = `## Resumen ${summaryDate}`;
  const start = text.indexOf(marker);
  if (start < 0) return '';
  const rest = text.slice(start + marker.length);
  const nextMatch = rest.match(/^## Resumen \d{4}-\d{2}-\d{2}/m);
  const end = nextMatch ? start + marker.length + nextMatch.index : text.length;
  return text.slice(start, end);
}

function fieldMap(block) {
  const lines = block.split('\n');
  const fields = {};
  let current = null;
  for (const line of lines) {
    const match = line.match(/^(?:[-*+]\s+)?\*\*([^*]+):\*\*\s*(.*)$/);
    if (match) {
      current = match[1].trim();
      fields[current] = match[2].trim();
    } else if (current && line.trim() && !/^#{1,6}\s/.test(line) && !/^[-*_]{3,}\s*$/.test(line.trim())) {
      fields[current] = `${fields[current]} ${line.trim()}`.trim();
    }
  }
  return fields;
}

function parseTasks(section) {
  const heading = /^#{2,3}\s+(\d{4}-\d{2}-\d{2}[^\n]*)$/gm;
  const matches = [...section.matchAll(heading)];
  const tasks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const head = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : section.length;
    const block = section.slice(start, end);
    const fields = fieldMap(block);
    const state = sanitize(fields.Estado || '', 400);
    const terminal = /✅|❌|finalizada|finalizado|completada|completado|exitosamente|con error|fallida|fallido/i.test(state)
      && !/en progreso|in_progress|activa|pendiente de completar/i.test(state);
    if (!terminal) continue;
    let title = fields.Tarea || '';
    if (!title) {
      const em = head.indexOf('—');
      const hy = head.indexOf(' - ');
      title = em >= 0 ? head.slice(em + 1) : (hy >= 0 ? head.slice(hy + 3) : head.slice(10));
    }
    const outcome = fields['Qué se hizo'] || fields.Acción || fields.Resultado || fields.Solicitud || title;
    const verification = fields.Verificación || '';
    const pending = meaningfulPending(fields.Pendiente || fields.Pendientes || '');
    const request = fields.Solicitud || fields.Tarea || title;
    const task = {
      date: head.slice(0, 10), title: sanitize(title, 400), request: sanitize(request, 700),
      outcome: sanitize(outcome, 1000), verification: sanitize(verification, 700),
      pending: sanitize(pending, 600), state,
    };
    task.fingerprint = hashTask(task);
    tasks.push(task);
  }
  return tasks;
}

function loadTasks(today) {
  const summaryText = fs.existsSync(DAILY_SUMMARY) ? fs.readFileSync(DAILY_SUMMARY, 'utf8') : '';
  const summaryBlock = extractSummaryBlock(summaryText, today);
  if (summaryBlock) {
    const detailPos = summaryBlock.indexOf('### Detalle de tareas');
    const detail = detailPos >= 0 ? summaryBlock.slice(detailPos + '### Detalle de tareas'.length) : summaryBlock;
    const tasks = parseTasks(detail);
    if (tasks.length) return { tasks, source: DAILY_SUMMARY, sourceKind: `Resumen ${today}` };
  }
  if (!fs.existsSync(TASK_LOG)) throw new Error(`No existe la fuente ${TASK_LOG}`);
  const log = fs.readFileSync(TASK_LOG, 'utf8');
  const marker = '<!-- ENTRADAS -->';
  const pos = log.indexOf(marker);
  const section = pos >= 0 ? log.slice(pos + marker.length) : log;
  return { tasks: parseTasks(section), source: TASK_LOG, sourceKind: 'Task log vivo (recuperacion)' };
}

function classifyTask(task) {
  const haystack = ` ${normalize([task.title, task.request, task.outcome, task.verification, task.pending].join(' '))} `;
  let best = null;
  for (const area of AREAS) {
    let score = 0;
    const hits = [];
    const display = normalize(area.display);
    if (haystack.includes(display)) { score += 15; hits.push(area.display); }
    for (const keyword of area.keywords) {
      const needle = normalize(keyword);
      if (needle && haystack.includes(needle)) {
        score += needle.includes(' ') ? 4 : 2;
        hits.push(keyword.trim());
      }
    }
    if (!best || score > best.score) best = { area, score, hits };
  }
  if (!best || best.score === 0) {
    const area = AREAS.find(a => a.key === 'operaciones');
    return { area, score: 0, hits: ['clasificacion de respaldo'] };
  }
  return best;
}

function groupTasks(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const classification = classifyTask(task);
    const classifiedTask = { ...task, classification };
    if (!groups.has(classification.area.key)) groups.set(classification.area.key, { area: classification.area, tasks: [] });
    groups.get(classification.area.key).tasks.push(classifiedTask);
  }
  return [...groups.values()].sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area));
}

function statusFor(tasks) {
  const failures = tasks.filter(t => /❌|con error|fallida|fallido/i.test(t.state)).length;
  const pending = tasks.filter(t => /⚠️|espera|bloquead/i.test(t.state)).length;
  if (failures) return { label: 'ROJO', reason: `${failures} tarea(s) terminal(es) registraron error o fallo.` };
  if (pending) return { label: 'AMARILLO', reason: `${pending} tarea(s) dejaron una accion, dependencia o decision pendiente.` };
  if (tasks.length && tasks.every(t => /✅|verificada|exitosamente|completada|completado|finalizada|finalizado/i.test(t.state))) {
    return { label: 'VERDE', reason: 'Todas las tareas incluidas terminaron con evidencia de cierre; no hay bloqueo registrado en la fuente.' };
  }
  return { label: 'N/D', reason: 'La evidencia disponible no permite asignar salud con suficiente confianza.' };
}

function buildReport(group, context, template) {
  const tasks = group.tasks;
  const health = statusFor(tasks);
  const success = tasks.filter(t => !/❌|con error|fallida|fallido/i.test(t.state)).length;
  const failures = tasks.length - success;
  const verified = tasks.filter(t => t.verification || /verificada|verificado/i.test(t.state)).length;
  const pending = tasks.filter(t => t.pending).map(t => t.pending);
  const dependencies = tasks.filter(t => /dependenc|interarea|otra area|espera de/i.test(`${t.request} ${t.outcome} ${t.pending}`));
  const decisions = tasks.filter(t => /decision|autoriz|aprobacion|aprobación/i.test(`${t.request} ${t.outcome} ${t.pending}`));
  const highlights = [
    `${tasks.length} tarea(s) terminal(es) consolidada(s); ${success} cierre(s) correcto(s) y ${failures} con error.`,
    ...tasks.slice(0, 3).map(t => t.title),
  ].slice(0, 4);
  if (pending.length) highlights.push(`${pending.length} pendiente(s) histórico(s) registrado(s) al cierre; validar vigencia.`);
  return {
    area: group.area, tasks, template, health, success, failures, verified, pending, dependencies, decisions,
    highlights: highlights.slice(0, 5), reportDate: context.reportDate,
    period: context.reportDate === context.today
      ? `${context.reportDate} 00:00 a ${context.cutoff} (corte parcial de prueba)`
      : `${context.reportDate} 05:00 a ${nextDate(context.reportDate)} 05:00 (America/Santiago)`,
    cutoff: context.cutoff, generatedAt: context.generatedAt, source: context.source, sourceKind: context.sourceKind,
  };
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function runXml(text, options = {}) {
  const props = [];
  if (options.bold) props.push('<w:b/>');
  if (options.italic) props.push('<w:i/>');
  if (options.color) props.push(`<w:color w:val="${options.color}"/>`);
  if (options.size) props.push(`<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>`);
  if (options.font) props.push(`<w:rFonts w:ascii="${esc(options.font)}" w:hAnsi="${esc(options.font)}"/>`);
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function paragraph(text, style = 'Normal', options = {}) {
  const props = style ? [`<w:pStyle w:val="${style}"/>`] : [];
  if (options.numbered) props.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
  if (options.keepNext) props.push('<w:keepNext/>');
  if (options.shading) props.push(`<w:shd w:val="clear" w:color="auto" w:fill="${options.shading}"/>`);
  if (options.border) props.push(`<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${options.border}"/></w:pBdr>`);
  const run = runXml(text, options.run || {});
  return `<w:p><w:pPr>${props.join('')}</w:pPr>${run}</w:p>`;
}

function cellXml(text, width, header = false, label = false) {
  const fill = header ? '1F5E49' : (label ? 'E8F2EE' : 'FFFFFF');
  const color = header ? 'FFFFFF' : '17211D';
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${runXml(text, { bold: header || label, color, size: 17 })}</w:p></w:tc>`;
}

function tableXml(rows, labelFirst = false) {
  if (!rows.length) return '';
  const cols = Math.max(...rows.map(r => r.length));
  const total = 9000;
  const base = Math.floor(total / cols);
  const widths = Array.from({ length: cols }, (_, i) => i === cols - 1 ? total - base * (cols - 1) : base);
  const grid = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  const body = rows.map((row, ri) => `<w:tr>${widths.map((w, ci) => cellXml(row[ci] || '', w, ri === 0, labelFirst && ci === 0 && ri > 0)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C8C1"/><w:left w:val="single" w:sz="4" w:color="B8C8C1"/><w:bottom w:val="single" w:sz="4" w:color="B8C8C1"/><w:right w:val="single" w:sz="4" w:color="B8C8C1"/><w:insideH w:val="single" w:sz="4" w:color="D7E2DD"/><w:insideV w:val="single" w:sz="4" w:color="D7E2DD"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function reportDocumentXml(report) {
  const statusColors = report.health.label === 'VERDE'
    ? { fill: 'DFF2E8', border: '2E7D5B', text: '1D5B43' }
    : report.health.label === 'ROJO'
      ? { fill: 'FCE1E1', border: 'B42318', text: '8B1A12' }
      : report.health.label === 'AMARILLO'
        ? { fill: 'FFF3CD', border: 'B7791F', text: '5F4B00' }
        : { fill: 'E9ECEF', border: '6C757D', text: '343A40' };
  const blocks = [];
  blocks.push(paragraph('DATASEED  ·  REPORTE DIARIO DE ÁREA', 'Brand', { keepNext: true }));
  blocks.push(paragraph(`Reporte diario — ${report.area.display}`, 'Title', { keepNext: true }));
  blocks.push(paragraph('Documento operativo generado desde tareas registradas. El documento en Drive es la fuente de verdad.', 'Callout', { shading: 'E8F2EE', border: '2E7D5B', run: { color: '143F32' } }));
  blocks.push(tableXml([
    ['Campo', 'Valor'],
    ['Área', report.area.display], ['Fecha informada', report.reportDate], ['Periodo', report.period],
    ['Corte', report.cutoff], ['Responsable', 'Demeter · DataSeed'], ['Cadencia', 'Diaria'],
    ['Confidencialidad', 'Interna'], ['Modo de datos', 'DATOS_REALES_OPERATIVOS'], ['Fuente', report.sourceKind],
    ['Plantilla base', `${report.template.baseFile} · SHA-256 ${report.template.baseSha256}`],
    ['Plantilla de área', `${report.template.areaFile} · SHA-256 ${report.template.areaSha256}`],
    ['Regla de salida', `${report.template.ruleFile} · SHA-256 ${report.template.ruleSha256}`],
    ['Version', VERSION],
  ], true));
  blocks.push(paragraph(`${report.health.label} — ${report.health.reason}`, 'Status', { shading: statusColors.fill, border: statusColors.border, run: { bold: true, color: statusColors.text } }));

  blocks.push(paragraph(sectionHeading(report, 1), 'Heading1', { keepNext: true }));
  for (const item of report.highlights) blocks.push(paragraph(item, 'Normal', { numbered: true }));

  blocks.push(paragraph(sectionHeading(report, 2), 'Heading1', { keepNext: true }));
  blocks.push(paragraph(`Estado: ${report.health.label}. ${report.health.reason}`));

  blocks.push(paragraph(sectionHeading(report, 3), 'Heading1', { keepNext: true }));
  blocks.push(tableXml([
    ['KPI', 'Resultado', 'Meta', 'Variación', 'Tendencia', 'Fuente', 'Dueño'],
    ['Tareas terminales', String(report.tasks.length), 'N/D', 'N/D', 'N/D', 'task-log', 'N/D'],
    ['Cierres correctos', String(report.success), 'N/D', 'N/D', 'N/D', 'Estado de tarea', 'N/D'],
    ['Cierres con error', String(report.failures), '0', 'N/D', 'N/D', 'Estado de tarea', 'N/D'],
    ['Con verificación explícita', `${report.verified}/${report.tasks.length}`, `${report.tasks.length}/${report.tasks.length}`, 'N/D', 'N/D', 'Verificación', 'N/D'],
    ['Siguientes pasos registrados', String(report.pending.length), 'N/D', 'N/D', 'N/D', 'Pendiente', 'N/D'],
  ]));
  blocks.push(paragraph(`KPI sugeridos por la plantilla de ${report.area.display}. Se usa N/D cuando el task-log no contiene una medición verificable.`));
  const suggestedKpiRows = [['KPI sugerido', 'Resultado', 'Meta', 'Variación', 'Tendencia', 'Fuente', 'Dueño']];
  for (const kpi of report.template.suggestedKpis) suggestedKpiRows.push([kpi, 'N/D', 'N/D', 'N/D', 'N/D', 'No medido en task-log', 'N/D']);
  blocks.push(tableXml(suggestedKpiRows));

  blocks.push(paragraph(sectionHeading(report, 4), 'Heading1', { keepNext: true }));
  const taskRows = [['Tarea', 'Resultado', 'Evidencia', 'Estado']];
  for (const task of report.tasks) taskRows.push([task.title, task.outcome, task.verification || 'Sin verificacion separada; revisar estado de cierre.', task.state]);
  blocks.push(tableXml(taskRows));

  blocks.push(paragraph(sectionHeading(report, 5), 'Heading1', { keepNext: true }));
  if (report.pending.length) {
    blocks.push(paragraph('Los siguientes compromisos fueron registrados al cerrar las tareas; validar responsable y fecha antes de ejecutarlos.'));
    const milestoneRows = [['Hito/compromiso', 'Fecha', 'Estado', 'Dueño', 'Criterio de finalización']];
    for (const item of report.pending) milestoneRows.push([item, 'N/D', 'Pendiente de validación', 'N/D', 'Confirmar cierre con evidencia verificable']);
    blocks.push(tableXml(milestoneRows));
  } else blocks.push(paragraph('No se registraron próximos compromisos obligatorios.'));

  blocks.push(paragraph(sectionHeading(report, 6), 'Heading1', { keepNext: true }));
  const riskRows = [['Riesgo/incidencia', 'Probabilidad', 'Impacto', 'Estado', 'Mitigación', 'Dueño', 'Fecha límite']];
  if (report.failures) riskRows.push([`${report.failures} cierre(s) con error`, 'N/D', 'N/D', 'Abierto', 'Diagnosticar y asignar recuperación', 'N/D', 'N/D']);
  if (report.pending.length) riskRows.push(['Pendientes históricos pueden perder vigencia', 'N/D', 'N/D', 'Abierto', 'Revalidar cada pendiente antes de actuar', 'N/D', 'N/D']);
  if (riskRows.length === 1) riskRows.push(['Sin riesgos materiales registrados', 'N/D', 'N/D', 'N/D', 'Mantener monitoreo', 'N/D', 'N/D']);
  blocks.push(tableXml(riskRows));

  blocks.push(paragraph(sectionHeading(report, 7), 'Heading1', { keepNext: true }));
  if (report.dependencies.length) {
    const dependencyRows = [['Área requerida', 'Solicitud/entrega', 'Motivo', 'Responsable receptor', 'Fecha necesaria', 'Estado']];
    for (const task of report.dependencies) dependencyRows.push(['N/D', task.pending || task.request, task.title, 'N/D', 'N/D', 'Pendiente de validación']);
    blocks.push(tableXml(dependencyRows));
  } else blocks.push(paragraph('No se identificaron dependencias interárea explícitas en la fuente.'));

  blocks.push(paragraph(sectionHeading(report, 8), 'Heading1', { keepNext: true }));
  if (report.decisions.length) {
    const decisionRows = [['Decisión', 'Opciones', 'Recomendación', 'Decisor', 'Fecha límite', 'Impacto de no decidir']];
    for (const task of report.decisions) decisionRows.push([task.pending || task.request, 'N/D', 'Revisar evidencia y resolver explícitamente', 'N/D', 'N/D', 'N/D']);
    blocks.push(tableXml(decisionRows));
  } else blocks.push(paragraph('No se registraron decisiones pendientes explícitas.'));

  blocks.push(paragraph(sectionHeading(report, 9), 'Heading1', { keepNext: true }));
  blocks.push(paragraph(`Cobertura: ${report.tasks.length} tarea(s) terminal(es) nueva(s) encontradas en ${report.sourceKind}.`, 'Normal', { numbered: true }));
  blocks.push(paragraph(`Corte: ${report.cutoff}.`, 'Normal', { numbered: true }));
  blocks.push(paragraph('Limitación: el reporte refleja exclusivamente información registrada en el task-log; no inventa KPI financieros, comerciales ni de producto.', 'Normal', { numbered: true }));
  blocks.push(paragraph(`Huellas de trazabilidad: ${report.tasks.map(t => t.fingerprint.slice(0, 12)).join(', ')}.`, 'Normal', { numbered: true }));

  blocks.push(paragraph(sectionHeading(report, 10), 'Heading1', { keepNext: true }));
  blocks.push(paragraph(`Fuente operativa: ${report.sourceKind}.`, 'Normal', { numbered: true }));
  blocks.push(paragraph('Repositorio canónico: task-log.md y daily-summary.md en feat/task-tracking-system.', 'Normal', { numbered: true }));

  blocks.push(paragraph(sectionHeading(report, 11), 'Heading1', { keepNext: true }));
  blocks.push(paragraph(`${report.reportDate} — Demeter — reporte generado con ${report.template.baseFile}, ${report.template.areaFile} y ${report.template.ruleFile}; SHA-256 ${report.template.baseSha256} / ${report.template.areaSha256} / ${report.template.ruleSha256}.`, 'Normal', { numbered: true }));
  blocks.push(paragraph('Documento diario DataSeed · Comunicación asíncrona orientada a decisiones', 'FooterNote'));
  blocks.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${blocks.join('')}</w:body></w:document>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="17211D"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Brand"><w:name w:val="Brand"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="2E7D5B"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:caps/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="240"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:color w:val="143F32"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="280" w:after="120"/><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="5" w:color="B8C8C1"/></w:pBdr></w:pPr><w:rPr><w:b/><w:color w:val="143F32"/><w:sz w:val="27"/><w:szCs w:val="27"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Status"><w:name w:val="Status"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="180"/><w:ind w:left="140" w:right="140"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Callout"><w:name w:val="Callout"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="180"/><w:ind w:left="180" w:right="180"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="FooterNote"><w:name w:val="Footer Note"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="320"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="6B7D75"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style></w:styles>`;

const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>DataSeed Daily Area Reporting</Application><AppVersion>${VERSION}</AppVersion><Company>DataSeed</Company></Properties>`;

function coreXml(report) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(`Reporte diario — ${report.area.display} — ${report.reportDate}`)}</dc:title><dc:creator>Demeter DataSeed</dc:creator><cp:lastModifiedBy>Demeter DataSeed</cp:lastModifiedBy><dc:description>Reporte diario por area generado desde el task-log operativo.</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${report.generatedAt}</dcterms:created></cp:coreProperties>`;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (const byte of buf) c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function createZip(entries, outputPath, generatedAt) {
  const localParts = []; const centralParts = []; let offset = 0;
  const now = chileParts(new Date(generatedAt)); const year = Number(now.year); const month = Number(now.month); const day = Number(now.day);
  const hour = Number(now.hour); const minute = Number(now.minute); const second = Number(now.second);
  const dosTime = ((hour << 11) | (minute << 5) | Math.floor(second / 2)) & 0xFFFF;
  const dosDate = (((Math.max(1980, year) - 1980) << 9) | (month << 5) | day) & 0xFFFF;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8'); const data = Buffer.from(entry.data, 'utf8'); const crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034B50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8); local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014B50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10); central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralDir = Buffer.concat(centralParts); const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054B50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(centralDir.length, 12); eocd.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, Buffer.concat([...localParts, centralDir, eocd]));
}

function writeDocx(report, outputPath) {
  createZip([
    { name: '[Content_Types].xml', data: contentTypesXml }, { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/document.xml', data: reportDocumentXml(report) }, { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/numbering.xml', data: numberingXml }, { name: 'word/_rels/document.xml.rels', data: documentRelsXml },
    { name: 'docProps/core.xml', data: coreXml(report) }, { name: 'docProps/app.xml', data: appXml },
  ], outputPath, report.generatedAt);
  const buf = fs.readFileSync(outputPath);
  if (buf.length < 5000 || buf.readUInt32LE(0) !== 0x04034B50 || buf.readUInt32LE(buf.length - 22) !== 0x06054B50) throw new Error(`DOCX invalido: ${outputPath}`);
}

function parseJsonOutput(stdout, label) {
  const text = String(stdout || '').trim();
  if (text === 'No messages found.' || text === 'No files found.') return [];
  try { return JSON.parse(text); } catch { throw new Error(`${label}: respuesta no JSON: ${sanitize(text, 400)}`); }
}

function gapi(args, label) {
  const result = spawnSync(GAPI_PY, [GAPI_SCRIPT, ...args], { encoding: 'utf8', timeout: 120000, env: process.env });
  if (result.error) throw new Error(`${label}: ${sanitize(result.error.message, 400)}`);
  if (result.status !== 0) throw new Error(`${label}: exit ${result.status}: ${sanitize(result.stderr || result.stdout, 600)}`);
  return parseJsonOutput(result.stdout, label);
}

function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`; fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); fs.renameSync(tmp, file);
}
function loadJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

function findDriveFile(area, name) {
  const safeName = name.replace(/'/g, "\\'");
  const query = `'${area.folderId}' in parents and name = '${safeName}' and trashed = false`;
  const found = gapi(['drive', 'search', query, '--raw-query', '--max', '5'], `buscar ${name}`);
  if (!Array.isArray(found) || !found.length) return null;
  if (found.length > 1) throw new Error(`Drive contiene ${found.length} archivos activos con el nombre ${name}; resolver duplicados antes de continuar`);
  return found[0];
}

function verifyRemoteDocument(remote, localPath) {
  if (!remote || !remote.id || !remote.webViewLink || remote.mimeType !== DOCX_MIME) return false;
  const verifyPath = path.join(path.dirname(localPath), `.verify-${remote.id}-${process.pid}.docx`);
  try {
    const downloaded = gapi(['drive', 'download', remote.id, '--output', verifyPath], `verificar contenido remoto ${remote.name || remote.id}`);
    if (downloaded.status !== 'downloaded' || !fs.existsSync(verifyPath)) return false;
    return sha256File(verifyPath) === sha256File(localPath);
  } finally {
    try { fs.unlinkSync(verifyPath); } catch { /* archivo temporal ausente */ }
  }
}

function emailAlreadySent(recipient, subject) {
  const query = `in:sent to:${recipient} subject:"${subject}"`;
  const found = gapi(['gmail', 'search', query, '--max', '5'], `verificar correo ${recipient}`);
  return Array.isArray(found) && found.some(item => item.to === recipient && item.subject === subject && Array.isArray(item.labels) && item.labels.includes('SENT'));
}

function recipientList(args) {
  if (!args.recipients) return DEFAULT_RECIPIENTS;
  return args.recipients.map(email => ({ email, name: email.split('@')[0].split('.')[0].replace(/^./, c => c.toUpperCase()) }));
}

function buildEmail(name, reports, links, context, test) {
  const lines = [
    `Hola ${name},`, '',
    test ? 'Esta es una prueba controlada de la automatización diaria de reportes DataSeed.' : 'Ya están disponibles los reportes diarios de DataSeed.',
    `Periodo: ${reports[0]?.period || `${context.reportDate} a ${context.today}`}.`, '',
    'Highlights y enlaces:', '',
  ];
  for (const report of reports) {
    lines.push(`${report.area.display} — ${report.health.label}`);
    for (const item of report.highlights.slice(0, 4)) lines.push(`- ${item}`);
    lines.push(`Documento: ${links[report.area.key].webViewLink}`, '');
  }
  lines.push(
    'Los documentos en Drive son la fuente de verdad y contienen evidencia, riesgos, dependencias y siguientes pasos.', '',
    'Cualquier duda o sugerencia, escríbeme por WhatsApp.', '',
    'Saludos,', 'Demeter DataSeed',
  );
  return lines.join('\n');
}

function loadPinnedTasks(state) {
  if (!Array.isArray(state.taskSnapshot) || !state.taskSnapshot.length) return null;
  const tasks = state.taskSnapshot.map(task => ({ ...task }));
  const fingerprints = tasks.map(task => task.fingerprint);
  if (tasks.some(task => !task.fingerprint || hashTask(task) !== task.fingerprint)) throw new Error('Snapshot de tareas invalido o alterado');
  if (new Set(fingerprints).size !== fingerprints.length) throw new Error('Snapshot de tareas contiene huellas duplicadas');
  if (!Array.isArray(state.taskFingerprints) || state.taskFingerprints.length !== fingerprints.length
      || state.taskFingerprints.some(fingerprint => !fingerprints.includes(fingerprint))) {
    throw new Error('Snapshot de tareas no coincide con sus huellas fijadas');
  }
  if (state.taskSnapshotSha256 && state.taskSnapshotSha256 !== sha256Text(JSON.stringify(state.taskSnapshot))) {
    throw new Error('Snapshot de tareas no coincide con su SHA-256 fijado');
  }
  return tasks;
}

function validatePinnedTemplate(template, area, expectedSha256) {
  if (!template || !Array.isArray(template.suggestedKpis) || !template.suggestedKpis.length || !template.sectionTitles) {
    throw new Error(`Snapshot de plantilla invalido para ${area.display}`);
  }
  if (template.baseFile !== 'PLANTILLA_BASE__REPORTE_DE_AREA__v1.md'
      || template.ruleFile !== 'REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md'
      || template.areaFile !== path.join('areas', `PLANTILLA__${area.slug}__v1.md`)) {
    throw new Error(`Snapshot de plantilla usa archivos inesperados para ${area.display}`);
  }
  for (const key of ['baseSha256', 'areaSha256', 'ruleSha256']) {
    if (!/^[a-f0-9]{64}$/.test(template[key] || '')) throw new Error(`Snapshot de plantilla sin SHA-256 completo para ${area.display}`);
  }
  for (let number = 1; number <= 11; number += 1) {
    if (!template.sectionTitles[String(number)]) throw new Error(`Snapshot de plantilla incompleto para ${area.display}: seccion ${number}`);
  }
  const actualSha256 = sha256Text(JSON.stringify(template));
  if (expectedSha256 && actualSha256 !== expectedSha256) throw new Error(`Snapshot de plantilla alterado para ${area.display}`);
  return actualSha256;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  configureRuntimePaths(args);
  const now = chileParts(); const today = isoDate(now); const reportDate = args.reportDate || previousDate(today);
  const observedCutoff = `${today}T${now.hour}:${now.minute}:${now.second} America/Santiago`;
  fs.mkdirSync(STATE_DIR, { recursive: true }); fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const processedPath = path.join(STATE_DIR, 'processed-task-fingerprints.json');
  const processed = new Set(loadJson(processedPath, { fingerprints: [] }).fingerprints || []);
  const testStamp = args.test ? (args.testId || `${now.hour}${now.minute}${now.second}`) : '';
  const runKey = args.test ? `test-${reportDate}-${testStamp}` : reportDate;
  const statePath = path.join(STATE_DIR, `${runKey}.json`);
  const batchDir = path.join(OUTPUT_DIR, runKey);
  const manifestPath = path.join(batchDir, 'manifest.json');
  const state = loadJson(statePath, { version: VERSION, runKey, reportDate, test: args.test, reports: {}, emails: {}, status: 'running' });
  if (state.status === 'complete') {
    if (!fs.existsSync(manifestPath)) throw new Error(`Estado completo sin manifiesto obligatorio: ${manifestPath}`);
    const missing = (state.taskFingerprints || []).filter(fingerprint => !processed.has(fingerprint));
    if (missing.length) {
      const repaired = new Set([...processed, ...missing]);
      saveJson(processedPath, { version: VERSION, updatedAt: new Date().toISOString(), fingerprints: [...repaired].sort() });
    }
    return;
  }

  let loaded;
  let freshTasks = loadPinnedTasks(state);
  if (freshTasks) {
    loaded = { source: state.source, sourceKind: state.sourceKind };
  } else {
    loaded = loadTasks(today);
    freshTasks = args.test ? loaded.tasks : loaded.tasks.filter(task => !processed.has(task.fingerprint));
  }
  if (!state.taskSnapshot && Array.isArray(state.taskFingerprints) && state.taskFingerprints.length) {
    const pinned = new Set(state.taskFingerprints);
    const available = loaded.tasks.filter(task => pinned.has(task.fingerprint));
    if (available.length !== pinned.size) throw new Error('No se pudieron reconstruir todas las tareas fijadas del reintento');
    freshTasks = available;
  }
  if (!freshTasks.length) return;

  state.version = VERSION;
  state.status = state.status === 'committing' ? 'committing' : 'running';
  state.cutoff = state.cutoff || observedCutoff;
  state.generatedAt = state.generatedAt || new Date().toISOString();
  state.today = state.today || today;
  state.source = state.source || loaded.source;
  state.sourceKind = state.sourceKind || loaded.sourceKind;
  if (!state.taskSnapshot) {
    state.taskFingerprints = freshTasks.map(task => task.fingerprint);
    state.taskSnapshot = freshTasks.map(task => ({ ...task }));
    state.taskSnapshotSha256 = sha256Text(JSON.stringify(state.taskSnapshot));
  }
  saveJson(statePath, state);

  const groups = groupTasks(freshTasks);
  const context = { today: state.today, reportDate, cutoff: state.cutoff, generatedAt: state.generatedAt, source: state.source, sourceKind: state.sourceKind };
  state.templateSnapshots = state.templateSnapshots || {};
  state.templateSnapshotSha256 = state.templateSnapshotSha256 || {};
  const reports = groups.map(group => {
    const template = state.templateSnapshots[group.area.key] || loadReportTemplate(group.area);
    const snapshotSha256 = validatePinnedTemplate(template, group.area, state.templateSnapshotSha256[group.area.key]);
    state.templateSnapshots[group.area.key] = template;
    state.templateSnapshotSha256[group.area.key] = snapshotSha256;
    return buildReport(group, context, template);
  });
  saveJson(statePath, state);

  fs.mkdirSync(batchDir, { recursive: true });
  const links = {};
  for (const report of reports) {
    const name = `${reportDate}__${report.area.slug}__REPORTE__v1.docx`;
    const localPath = path.join(batchDir, name);
    writeDocx(report, localPath);
    const localSha256 = sha256File(localPath);
    if (args.dryRun) {
      links[report.area.key] = { id: null, name, webViewLink: `LOCAL:${localPath}`, mimeType: DOCX_MIME, sha256: localSha256 };
      continue;
    }
    let remote = state.reports[report.area.key] || findDriveFile(report.area, name);
    if (remote) {
      if (!verifyRemoteDocument(remote, localPath)) throw new Error(`Documento remoto ${name} no coincide en MIME o SHA-256 con el reporte generado`);
    } else {
      const uploaded = gapi(['drive', 'upload', localPath, '--parent', report.area.folderId], `subir ${name}`);
      if (uploaded.status !== 'uploaded' || !uploaded.id || !uploaded.webViewLink || uploaded.mimeType !== DOCX_MIME) throw new Error(`Carga no confirmada para ${name}`);
      remote = uploaded;
      if (!verifyRemoteDocument(remote, localPath)) throw new Error(`La verificacion posterior a la carga fallo para ${name}`);
    }
    remote.sha256 = localSha256;
    links[report.area.key] = remote;
    state.reports[report.area.key] = remote;
    saveJson(statePath, state);
  }

  const recipients = recipientList(args);
  const manifest = {
    version: VERSION, mode: args.dryRun ? 'dry-run' : 'production',
    reportDate, source: loaded.source, sourceKind: loaded.sourceKind,
    taskCount: freshTasks.length, areas: reports.map(r => ({
      key: r.area.key,
      display: r.area.display,
      health: r.health.label,
      taskCount: r.tasks.length,
      template: r.template,
      document: links[r.area.key],
    })),
    recipients: args.dryRun ? [] : recipients.map(r => r.email), driveRoot: DRIVE_ROOT,
  };
  saveJson(manifestPath, manifest);

  if (!args.dryRun) {
    const subject = `Reportes diarios DataSeed - ${reportDate}`;
    for (const recipient of recipients) {
      if (state.emails[recipient.email]?.verified || emailAlreadySent(recipient.email, subject)) {
        state.emails[recipient.email] = { verified: true, skippedAsExisting: true }; saveJson(statePath, state); continue;
      }
      const body = buildEmail(recipient.name, reports, links, context, false);
      const sent = gapi(['gmail', 'send', '--to', recipient.email, '--from', '"Demeter DataSeed" <demeter@dataseed.cl>', '--subject', subject, '--body', body], `enviar correo ${recipient.email}`);
      if (sent.status !== 'sent' || !sent.id) throw new Error(`Envio no confirmado para ${recipient.email}`);
      const verified = emailAlreadySent(recipient.email, subject);
      if (!verified) throw new Error(`El correo a ${recipient.email} no aparecio en Gmail Sent`);
      state.emails[recipient.email] = { verified: true, messageId: sent.id, threadId: sent.threadId || sent.id }; saveJson(statePath, state);
    }
    const merged = new Set([...processed, ...freshTasks.map(t => t.fingerprint)]);
    state.status = 'committing'; saveJson(statePath, state);
    saveJson(processedPath, { version: VERSION, updatedAt: new Date().toISOString(), fingerprints: [...merged].sort() });
    state.status = 'complete'; state.completedAt = new Date().toISOString(); saveJson(statePath, state);
  }

  console.log(`${args.test ? 'PRUEBA VERDE' : args.dryRun ? 'DRY-RUN VERDE' : 'VERDE'} — Reportes diarios DataSeed ${reportDate}: ${freshTasks.length} tarea(s), ${reports.length} area(s), ${args.dryRun ? 0 : reports.length} documento(s), ${args.dryRun ? 0 : recipients.length} correo(s).`);
}

try { main(); } catch (error) {
  console.error(`ROJO — Fallo en reportes diarios DataSeed: ${sanitize(error && error.message ? error.message : String(error), 900)}`);
  process.exit(1);
}
