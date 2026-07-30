#!/usr/bin/env python3
from pathlib import Path
import re

root = Path('/opt/data/data_seed_daily_backup/backups/reporting')
base = (root / 'PLANTILLA_BASE__REPORTE_DE_AREA__v1.md').read_text(encoding='utf-8')
rule = (root / 'REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md').read_text(encoding='utf-8')
sections = {int(n) for n in re.findall(r'^##\s+(\d+)\.\s+', base, flags=re.M)}
assert sections == set(range(1, 12)), sections
rule_body_match = re.search(r'^## Estructura que debe conservarse\s*$([\s\S]*?)(?=^##\s+|\Z)', rule, flags=re.M)
assert rule_body_match, 'missing rule structure section'
rule_items = {int(n): text for n, text in re.findall(r'^(\d+)\.\s+(.+)$', rule_body_match.group(1), flags=re.M)}
assert set(rule_items) == set(range(1, 10)), rule_items
requirements = {
    1: r'resumen ejecutivo',
    2: r'salud general.*verde.*amarillo.*rojo.*n/d',
    3: r'kpi.*resultado.*meta.*variaci[oó]n.*tendencia.*fuente.*due[nñ]o',
    4: r'logros.*evidencia',
    5: r'pr[oó]ximos? hitos?',
    6: r'riesgos?.*mitigaciones?',
    7: r'dependencias?.*inter[aá]rea',
    8: r'decisiones?.*requeridas?',
    9: r'calidad.*limitaciones?.*datos',
}
for number, pattern in requirements.items():
    assert re.search(pattern, rule_items[number], flags=re.I), (number, rule_items[number])
area_files = sorted((root / 'areas').glob('PLANTILLA__*__v1.md'))
assert len(area_files) == 11, len(area_files)
for area_file in area_files:
    content = area_file.read_text(encoding='utf-8')
    area_sections = {int(n) for n in re.findall(r'^##\s+(\d+)\.\s+', content, flags=re.M)}
    assert area_sections == set(range(1, 10)), (area_file.name, area_sections)
    match = re.search(r'^## KPI sugeridos\s*$([\s\S]*?)(?=^##\s+|\Z)', content, flags=re.M)
    assert match, area_file.name
    kpis = re.findall(r'^-\s+(.+)$', match.group(1), flags=re.M)
    assert 1 <= len(kpis) <= 5, (area_file.name, len(kpis))
print(f'template_catalog_ok areas={len(area_files)} base_sections={len(sections)} rule_items={len(rule_items)}')
