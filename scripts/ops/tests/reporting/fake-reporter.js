#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = process.env.DATASEED_TASK_TRACKING_REPO_DIR;
if (process.env.FAIL_REPORTER === '1') {
  console.error('ERROR: fallo de reportes simulado');
  process.exit(7);
}
if (!root) throw new Error('DATASEED_TASK_TRACKING_REPO_DIR ausente');
const taskLog = fs.readFileSync(path.join(root, 'task-log.md'), 'utf8');
const summary = fs.readFileSync(path.join(root, 'daily-summary.md'), 'utf8');
const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const get = type => parts.find(item => item.type === type).value;
const today = `${get('year')}-${get('month')}-${get('day')}`;
const entries = taskLog.split('<!-- ENTRADAS -->')[1] || '';
if (!/^##\s+/m.test(entries)) throw new Error('el task-log fue limpiado antes de generar reportes');
if (!summary.includes(`## Resumen ${today}`)) throw new Error('el resumen diario no existe antes de generar reportes');
console.log('VERDE — prueba de integración: áreas seleccionadas, reportes Drive y correos simulados con task-log todavía presente.');
