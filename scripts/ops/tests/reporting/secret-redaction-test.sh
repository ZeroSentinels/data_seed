#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
cp -a /opt/data/data_seed_daily_backup/backups/reporting "$TMP/templates"
cp /opt/data/dataseed-reportes-drive-staging-docx/00_Estandar_y_Guia/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md "$TMP/templates/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md"
python3 - "$TMP/task-log.md" "$TMP/expected-secrets.txt" <<'PY'
from pathlib import Path
import sys
aws = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP'
asia = 'AS' + 'IA' + 'QRSTUVWXYZABCDEF'
aws_secret = 'wJalrXUtnFEMI' + '/K7MDENG/bPxRfiCYEXAMPLEKEY'
aws_session = 'IQoJb3JpZ2luX2VjE' + 'SyntheticSessionTokenForTestingOnly1234567890'
google = 'AI' + 'za' + '12345678901234567890123456789012345'
jwt = 'ey' + 'JhbGciOiJIUzI1NiJ9' + '.eyJzdWIiOiIxMjM0NTY3ODkwIn0' + '.signatureplaceholder'
pem_marker = '-----BEGIN PRI' + 'VATE KEY----- datos-sinteticos -----END PRI' + 'VATE KEY-----'
client = 'super' + 'secretvalue'
quoted = 'correct horse battery staple'
text = f'''# Task Log - Demeter

---

<!-- ENTRADAS -->

## 2099-01-01 10:00 - Verificar redacción de secretos

**Estado:** ✅ Finalizada y verificada

**Área sugerida:** Legal, Riesgos y Seguridad

**Solicitud:** Sanitizar CLIENT_SECRET={client}, password="{quoted}", {aws}, {asia}, AWS_ACCESS_KEY_ID="{asia}", AWS_SECRET_ACCESS_KEY={aws_secret}, AWS_SESSION_TOKEN="{aws_session}", {google} y {jwt}.

**Qué se hizo:** Se validó que CLIENT_SECRET={client}, password="{quoted}", {aws}, {asia}, AWS_ACCESS_KEY_ID="{asia}", AWS_SECRET_ACCESS_KEY={aws_secret}, AWS_SESSION_TOKEN="{aws_session}", {google}, {jwt} y {pem_marker} no lleguen al reporte.

**Verificación:** La salida debe contener únicamente marcadores [REDACTED], incluso para JSON como {{"AWS_ACCESS_KEY_ID":"{asia}","AWS_SECRET_ACCESS_KEY":"{aws_secret}","AWS_SESSION_TOKEN":"{aws_session}"}}.

**Pendiente:** Ninguno.
'''
Path(sys.argv[1]).write_text(text, encoding='utf-8')
Path(sys.argv[2]).write_text('\n'.join([client, quoted, 'horse battery staple', aws, asia, aws_secret, aws_session, google, jwt.split('.')[0], 'datos-sinteticos']) + '\n', encoding='utf-8')
PY
DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-07 >/dev/null
DOCX="$(python3 -c 'from pathlib import Path; p=list(Path("'$TMP'/output/2099-01-07").glob("*.docx")); assert len(p)==1; print(p[0])')"
python3 -c 'import sys,zipfile; print(zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode())' "$DOCX" > "$TMP/document.xml"
while IFS= read -r secret; do
  if grep -Fq "$secret" "$TMP/document.xml"; then
    printf 'secret_redaction_failed leaked=%s\n' "$secret" >&2
    exit 1
  fi
done < "$TMP/expected-secrets.txt"
grep -Fq '[REDACTED]' "$TMP/document.xml"
printf 'secret_redaction_ok\n'
