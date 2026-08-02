#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path

root = Path(os.environ["DATASEED_CANONICAL_REPO_DIR"])
out = root / "graphify-out"
out.mkdir(parents=True, exist_ok=True)
(out / "multibranch_manifest.json").write_text(
    json.dumps(
        {
            "repo": "contacto101/data_seed",
            "mode": "deduplicated-multibranch",
            "branches": {"main": {}, "feat/one": {}, "feat/two": {}},
            "nodes": 7,
            "links": 9,
            "communities": 2,
        }
    ),
    encoding="utf-8",
)
print("fake graph updated")
