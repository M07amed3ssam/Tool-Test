from __future__ import annotations

import argparse
import unittest

from main import _resolve_orchestration


class TestMainOrchestrationFlags(unittest.TestCase):
    def test_auto_uses_ai_orchestration(self) -> None:
        args = argparse.Namespace(orchestration_mode="auto", max_parallel=0)
        mode, max_parallel = _resolve_orchestration(
            args,
            {"execution_orchestration": {"mode": "parallel", "max_parallel": 4}},
        )
        self.assertEqual(mode, "parallel")
        self.assertEqual(max_parallel, 4)

    def test_sequential_forces_single_parallel(self) -> None:
        args = argparse.Namespace(orchestration_mode="sequential", max_parallel=8)
        mode, max_parallel = _resolve_orchestration(
            args,
            {"execution_orchestration": {"mode": "parallel", "max_parallel": 6}},
        )
        self.assertEqual(mode, "sequential")
        self.assertEqual(max_parallel, 1)


if __name__ == "__main__":
    unittest.main()