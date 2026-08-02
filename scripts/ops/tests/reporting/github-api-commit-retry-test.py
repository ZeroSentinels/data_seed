#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


MODULE_CANDIDATES = [
    Path(__file__).resolve().parents[2] / "github_api_commit.py",
    Path("/opt/data/scripts/github_api_commit.py"),
]
MODULE_PATH = next((path for path in MODULE_CANDIDATES if path.is_file()), MODULE_CANDIDATES[0])
spec = importlib.util.spec_from_file_location("github_api_commit", MODULE_PATH)
assert spec is not None and spec.loader is not None
github_api_commit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(github_api_commit)


class GitHubApiCommitRetryTests(unittest.TestCase):
    def test_rebuilds_commit_on_latest_remote_head_after_non_fast_forward(self) -> None:
        heads = [
            ("old-head", "old-tree"),
            ("advanced-head", "advanced-tree"),
        ]
        get_head_calls = 0
        patch_calls = 0
        commit_parents: list[str] = []
        base_trees: list[str] = []

        def fake_get_head(env, owner, repo, branch):
            nonlocal get_head_calls
            result = heads[min(get_head_calls, len(heads) - 1)]
            get_head_calls += 1
            return result

        def fake_api(env, method, path, payload=None):
            nonlocal patch_calls
            if method == "POST" and path.endswith("/git/trees"):
                assert payload is not None
                base_trees.append(payload["base_tree"])
                return {"sha": f"new-tree-{len(base_trees)}"}
            if method == "POST" and path.endswith("/git/commits"):
                assert payload is not None
                commit_parents.append(payload["parents"][0])
                return {"sha": f"{len(commit_parents)}" * 40}
            if method == "PATCH" and "/git/refs/heads/" in path:
                assert payload is not None
                patch_calls += 1
                if patch_calls == 1:
                    raise github_api_commit.GitHubAPIError(
                        status=422,
                        method="PATCH",
                        path=path,
                        detail="Update is not a fast forward",
                    )
                return {"object": {"sha": payload["sha"]}}
            raise AssertionError(f"unexpected API call: {method} {path}")

        with tempfile.TemporaryDirectory(prefix="github-api-commit-test-") as tmp:
            repo = Path(tmp)
            (repo / ".git").mkdir()
            (repo / "task-log.md").write_text("entry\n", encoding="utf-8")
            with (
                mock.patch.object(github_api_commit, "parse_repo", return_value=("owner", "repo")),
                mock.patch.object(github_api_commit, "require_agent_vault_proxy", return_value={}),
                mock.patch.object(github_api_commit, "create_blob", return_value="blob-sha"),
                mock.patch.object(github_api_commit, "get_head", side_effect=fake_get_head),
                mock.patch.object(github_api_commit, "api", side_effect=fake_api),
                mock.patch("time.sleep"),
            ):
                result = github_api_commit.commit_files(
                    repo,
                    "feat/task-tracking-system",
                    "test retry",
                    ["task-log.md"],
                    None,
                )

        self.assertIn("2222222", result)
        self.assertEqual(get_head_calls, 2)
        self.assertEqual(patch_calls, 2)
        self.assertEqual(base_trees, ["old-tree", "advanced-tree"])
        self.assertEqual(commit_parents, ["old-head", "advanced-head"])

    def test_aborts_cleanup_when_remote_task_log_changed(self) -> None:
        with tempfile.TemporaryDirectory(prefix="github-api-precondition-test-") as tmp:
            repo = Path(tmp)
            (repo / ".git").mkdir()
            (repo / "task-log.md").write_text("cleaned\n", encoding="utf-8")
            with (
                mock.patch.object(github_api_commit, "parse_repo", return_value=("owner", "repo")),
                mock.patch.object(github_api_commit, "require_agent_vault_proxy", return_value={}),
                mock.patch.object(github_api_commit, "create_blob", return_value="blob-sha"),
                mock.patch.object(github_api_commit, "get_head", return_value=("head", "tree")),
                mock.patch.object(
                    github_api_commit,
                    "get_remote_file",
                    return_value=(b"new concurrent entry\n", "new-remote-blob"),
                ),
                mock.patch.object(github_api_commit, "api") as mocked_api,
            ):
                with self.assertRaises(github_api_commit.RemoteFileChanged):
                    github_api_commit.commit_files(
                        repo,
                        "feat/task-tracking-system",
                        "cleanup",
                        ["task-log.md"],
                        None,
                        expected_remote_files={"task-log.md": "snapshot-blob"},
                    )

        mocked_api.assert_not_called()

    def test_materializes_remote_files_and_records_blob_shas(self) -> None:
        responses = [
            (b"# Task Log\n", "task-blob"),
            (b"# Daily Summary\n", "summary-blob"),
        ]
        with tempfile.TemporaryDirectory(prefix="github-api-materialize-test-") as tmp:
            source = Path(tmp) / "source"
            output = Path(tmp) / "output"
            (source / ".git").mkdir(parents=True)
            with (
                mock.patch.object(github_api_commit, "parse_repo", return_value=("owner", "repo")),
                mock.patch.object(github_api_commit, "require_agent_vault_proxy", return_value={}),
                mock.patch.object(github_api_commit, "get_remote_file", side_effect=responses),
            ):
                result = github_api_commit.materialize_files(
                    source,
                    "feat/task-tracking-system",
                    ["task-log.md", "daily-summary.md"],
                    None,
                    output,
                )
            state = json.loads((output / ".dataseed-remote-files.json").read_text(encoding="utf-8"))

        self.assertIn("materialized 2 files", result)
        self.assertEqual(state["files"], {"task-log.md": "task-blob", "daily-summary.md": "summary-blob"})


if __name__ == "__main__":
    unittest.main()
