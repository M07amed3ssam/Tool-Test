from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from src.orchestrator.scheduler import run_plan


class _Step:
    def __init__(
        self,
        step: int,
        tool: str,
        command: str,
        signature: str,
        command_source: str = "static",
        fallback_command: str = "",
    ) -> None:
        self.step = step
        self.tool = tool
        self.command = command
        self.signature = signature
        self.command_source = command_source
        self.fallback_command = fallback_command
        self.status = "pending"


class TestSchedulerOrchestration(unittest.TestCase):
    def test_dry_run_writes_unified_execution_results(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            steps = [
                _Step(1, "subfinder", "echo sub", "sig1"),
                _Step(2, "nmap", "echo nmap", "sig2"),
            ]

            results = run_plan(
                steps=steps,
                base_dir=base_dir,
                execute=False,
                orchestration_mode="parallel",
                max_parallel=2,
            )

            self.assertEqual(len(results), 2)
            self.assertEqual(results[0].status, "dry_run")

            payload_path = base_dir / "data" / "state" / "execution_results.json"
            self.assertTrue(payload_path.exists())
            payload = json.loads(payload_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["mode"], "parallel")
            self.assertEqual(payload["total_steps"], 2)
            self.assertEqual(payload["success_count"], 0)
            self.assertEqual(payload["dry_run_count"], 2)

    def test_parallel_mode_executes_batches_and_tracks_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            steps = [
                _Step(1, "subfinder", "printf 'one'", "sig1"),
                _Step(2, "amass", "printf 'two'", "sig2"),
                _Step(3, "nuclei", "printf 'three'", "sig3"),
            ]

            results = run_plan(
                steps=steps,
                base_dir=base_dir,
                execute=True,
                retries=0,
                orchestration_mode="parallel",
                max_parallel=2,
                timeout_seconds=30,
            )

            self.assertEqual([r.step for r in results], [1, 2, 3])
            self.assertTrue(all(r.mode == "parallel" for r in results))
            self.assertTrue(all(r.return_code == 0 for r in results))
            self.assertEqual(results[2].batch, 2)

            payload_path = base_dir / "data" / "state" / "execution_results.json"
            payload = json.loads(payload_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["success_count"], 3)
            self.assertEqual(payload["failed_count"], 0)

    def test_non_retriable_error_stops_retries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            steps = [
                _Step(1, "amass", "sh -c \"echo 'sudo: a password is required' 1>&2; exit 1\"", "sig-amass"),
            ]

            results = run_plan(
                steps=steps,
                base_dir=base_dir,
                execute=True,
                retries=2,
                backoff_seconds=1,
                orchestration_mode="sequential",
                timeout_seconds=30,
            )

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].status, "failed")
            self.assertEqual(results[0].attempts, 1)
            self.assertIn("a password is required", results[0].errors or "")

    def test_timeout_stops_retries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            steps = [
                _Step(1, "nuclei", "sh -c \"sleep 2\"", "sig-timeout"),
            ]

            results = run_plan(
                steps=steps,
                base_dir=base_dir,
                execute=True,
                retries=2,
                backoff_seconds=1,
                orchestration_mode="sequential",
                timeout_seconds=1,
            )

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].status, "failed")
            self.assertEqual(results[0].attempts, 1)
            self.assertIn("timed out", results[0].errors or "")

    def test_hybrid_ai_command_falls_back_to_static(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            steps = [
                _Step(
                    1,
                    "subfinder",
                    "sh -c \"echo ai_failed 1>&2; exit 1\"",
                    "sig-hybrid",
                    command_source="ai",
                    fallback_command="printf 'fallback_ok'",
                ),
            ]

            results = run_plan(
                steps=steps,
                base_dir=base_dir,
                execute=True,
                retries=0,
                orchestration_mode="sequential",
                timeout_seconds=30,
            )

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].status, "done")
            self.assertTrue(results[0].fallback_used)
            self.assertEqual(results[0].command_source, "static")
            self.assertEqual(results[0].primary_command, "sh -c \"echo ai_failed 1>&2; exit 1\"")

    def test_hybrid_nmap_soft_failure_falls_back_to_static(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            steps = [
                _Step(
                    1,
                    "nmap",
                    "sh -c \"echo 'WARNING: No targets were specified, so 0 hosts scanned.' 1>&2; echo 'Nmap done: 0 IP addresses (0 hosts up) scanned'; exit 0\"",
                    "sig-hybrid-nmap",
                    command_source="ai",
                    fallback_command="printf 'nmap-fallback'",
                ),
            ]

            results = run_plan(
                steps=steps,
                base_dir=base_dir,
                execute=True,
                retries=0,
                orchestration_mode="sequential",
                timeout_seconds=30,
            )

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].status, "done")
            self.assertTrue(results[0].fallback_used)
            self.assertEqual(results[0].command_source, "static")

    def test_hybrid_ffuf_soft_failure_falls_back_to_static(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp)
            steps = [
                _Step(
                    1,
                    "ffuf",
                    "sh -c \"echo 'Keyword FUZZ defined, but not found in headers, method, URL or POST data.' 1>&2; exit 0\"",
                    "sig-hybrid-ffuf",
                    command_source="ai",
                    fallback_command="printf 'ffuf-fallback'",
                ),
            ]

            results = run_plan(
                steps=steps,
                base_dir=base_dir,
                execute=True,
                retries=0,
                orchestration_mode="sequential",
                timeout_seconds=30,
            )

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].status, "done")
            self.assertTrue(results[0].fallback_used)
            self.assertEqual(results[0].command_source, "static")

if __name__ == "__main__":
    unittest.main()
