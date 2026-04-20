from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import sys

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from main import _build_nuclei_status
from orchestrator.executor import ExecutionResult


class _Step:
    def __init__(self, tool: str) -> None:
        self.tool = tool


class TestMainNucleiStatus(unittest.TestCase):
    def test_dry_run_with_existing_findings_is_not_marked_completed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            raw = project_root / "data" / "raw"
            raw.mkdir(parents=True, exist_ok=True)
            (raw / "nuclei.txt").write_text("existing finding\n", encoding="utf-8")

            plan = [_Step("nuclei")]
            dry_run_result = ExecutionResult(
                command="nuclei -u https://example.com -o data/raw/nuclei.txt",
                output_summary="Dry run: command not executed",
                errors=None,
                return_code=0,
                started_at="",
                finished_at="",
            )

            status = _build_nuclei_status(
                project_root=project_root,
                plan=plan,
                results=[dry_run_result],
                execute=False,
            )

            self.assertEqual(status["state"], "planned_not_executed")
            self.assertFalse(status["executed"])
            self.assertIsNone(status["return_code"])

    def test_not_planned_hides_stale_findings_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            raw = project_root / "data" / "raw"
            raw.mkdir(parents=True, exist_ok=True)
            (raw / "nuclei.txt").write_text("old finding\n", encoding="utf-8")

            plan = [_Step("subfinder")]
            status = _build_nuclei_status(
                project_root=project_root,
                plan=plan,
                results=[],
                execute=False,
            )

            self.assertEqual(status["state"], "not_planned")
            self.assertEqual(status["findings_count"], 0)
            self.assertEqual(status["stale_previous_findings_count"], 1)


if __name__ == "__main__":
    unittest.main()
