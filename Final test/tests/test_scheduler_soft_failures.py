from __future__ import annotations

import unittest

from app.recon.orchestrator.executor import ExecutionResult
from app.recon.orchestrator.scheduler import _is_ai_soft_failure


class TestSchedulerSoftFailures(unittest.TestCase):
    def test_amass_missing_root_domain_is_soft_failure(self) -> None:
        result = ExecutionResult(
            tool="amass",
            status="failed",
            stderr="No root domains were provided",
            return_code=1,
        )

        self.assertTrue(_is_ai_soft_failure("amass", result))

    def test_amass_context_deadline_is_soft_failure(self) -> None:
        result = ExecutionResult(
            tool="amass",
            status="failed",
            stderr="context deadline exceeded",
            return_code=1,
        )

        self.assertTrue(_is_ai_soft_failure("amass", result))

    def test_amass_unexpected_error_is_not_soft_failure(self) -> None:
        result = ExecutionResult(
            tool="amass",
            status="failed",
            stderr="permission denied",
            return_code=1,
        )

        self.assertFalse(_is_ai_soft_failure("amass", result))


if __name__ == "__main__":
    unittest.main()
