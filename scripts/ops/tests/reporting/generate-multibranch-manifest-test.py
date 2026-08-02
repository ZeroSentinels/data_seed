#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_CANDIDATES = [
    Path(__file__).resolve().parents[3] / "generate-multibranch-graph.py",
    Path("/opt/data/scripts/generate-multibranch-graph.py"),
]
MODULE_PATH = next((path for path in MODULE_CANDIDATES if path.is_file()), MODULE_CANDIDATES[0])
spec = importlib.util.spec_from_file_location("generate_multibranch_graph", MODULE_PATH)
assert spec is not None and spec.loader is not None
generate_multibranch_graph = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = generate_multibranch_graph
spec.loader.exec_module(generate_multibranch_graph)


class MultibranchManifestTests(unittest.TestCase):
    def test_writes_current_branch_and_graph_metrics_to_generated_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix="multibranch-manifest-test-") as tmp:
            snapshot = Path(tmp)
            graph_dir = snapshot / "graphify-out"
            graph_dir.mkdir()
            (graph_dir / "graph.json").write_text(
                json.dumps(
                    {
                        "nodes": [
                            {"id": "a", "community": 1},
                            {"id": "b", "community": 1},
                            {"id": "c", "community": 2},
                        ],
                        "links": [{"source": "a", "target": "b"}, {"source": "b", "target": "c"}],
                    }
                ),
                encoding="utf-8",
            )
            manifest = {
                "repo": "contacto101/data_seed",
                "mode": "deduplicated-multibranch",
                "branches": {"main": {"commit": "abc"}, "feat/example": {"commit": "def"}},
            }

            output = generate_multibranch_graph.write_multibranch_manifest(snapshot, manifest)
            data = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(data["branches"], manifest["branches"])
        self.assertEqual(data["nodes"], 3)
        self.assertEqual(data["links"], 2)
        self.assertEqual(data["communities"], 2)
        self.assertIn("generated_at", data)


if __name__ == "__main__":
    unittest.main()
