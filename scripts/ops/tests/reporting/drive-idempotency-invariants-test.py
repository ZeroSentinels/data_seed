#!/usr/bin/env python3
from pathlib import Path

source = Path('/opt/data/automations/daily-area-reporting/daily-area-reports.js').read_text(encoding='utf-8')
assert "remote.mimeType !== DOCX_MIME" in source
assert "gapi(['drive', 'download', remote.id, '--output', verifyPath]" in source
assert "sha256File(verifyPath) === sha256File(localPath)" in source
assert source.count('verifyRemoteDocument(remote, localPath)') >= 2
assert 'Drive contiene ${found.length} archivos activos' in source
assert 'remote.sha256 = localSha256' in source
print('drive_idempotency_invariants_ok')
