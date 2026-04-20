from __future__ import annotations

import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from app.recon.orchestrator.executor import ExecutionResult
from app.recon.orchestrator.scheduler import run_plan


class _Step:
    def __init__(self, step: int, tool: str, command: str) -> None:
        self.step = step
        self.tool = tool
        self.command = command
        self.command_source = "static"
        self.signature = f"{tool}:{step}"
        self.status = "pending"


class TestSchedulerProgress(unittest.TestCase):
    def test_parallel_callback_emits_after_each_finished_step(self) -> None:
        steps = [
            _Step(step=1, tool="nmap", command="slow-cmd"),
            _Step(step=2, tool="masscan", command="fast-cmd"),
        ]

        slow_release = threading.Event()
        fast_finished = threading.Event()
        fast_callback_seen = threading.Event()
        run_finished = threading.Event()
        callback_steps: list[int] = []
        errors: list[Exception] = []

        def fake_execute_single_step(*, step, **kwargs):
            del kwargs
            if step.command == "slow-cmd":
                slow_release.wait(timeout=5)
            else:
                fast_finished.set()

            step.status = "done"
            return ExecutionResult(
                tool=step.tool,
                step=step.step,
                command=step.command,
                command_source="static",
                primary_command=step.command,
                fallback_used=False,
                mode="parallel",
                batch=1,
                status="done",
                attempts=1,
                stdout="",
                stderr="",
                output_summary="ok",
                errors=None,
                return_code=0,
                started_at="2026-04-19T00:00:00+00:00",
                finished_at="2026-04-19T00:00:01+00:00",
            )

        def on_result(result: ExecutionResult) -> None:
            callback_steps.append(result.step)
            if result.command == "fast-cmd":
                fast_callback_seen.set()

        def run_worker(base_dir: Path) -> None:
            try:
                run_plan(
                    steps=steps,
                    base_dir=base_dir,
                    execute=True,
                    retries=0,
                    backoff_seconds=0,
                    timeout_seconds=1,
                    orchestration_mode="parallel",
                    max_parallel=2,
                    result_callback=on_result,
                )
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                run_finished.set()

        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir)
            with patch(
                "app.recon.orchestrator.scheduler._execute_single_step",
                side_effect=fake_execute_single_step,
            ):
                thread = threading.Thread(target=run_worker, args=(base_dir,), daemon=True)
                thread.start()

                self.assertTrue(fast_finished.wait(timeout=1.5))
                self.assertTrue(
                    fast_callback_seen.wait(timeout=1.5),
                    "Fast-step callback should be emitted before slow step completes.",
                )
                self.assertFalse(run_finished.is_set())

                slow_release.set()
                thread.join(timeout=3)

        self.assertFalse(thread.is_alive())
        self.assertEqual(errors, [])
        self.assertCountEqual(callback_steps, [1, 2])


if __name__ == "__main__":
    unittest.main()