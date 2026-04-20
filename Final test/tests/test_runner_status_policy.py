from __future__ import annotations

import unittest

from app.scans.models import ScanStatus
from app.scans.runner import _resolve_final_status


class _Result:
    def __init__(self, tool: str, status: str) -> None:
        self.tool = tool
        self.status = status


class TestRunnerStatusPolicy(unittest.TestCase):
    def test_amass_only_failure_is_completed(self) -> None:
        results = [_Result(tool="amass", status="failed")]

        final_status = _resolve_final_status(results, ScanStatus.RUNNING)

        self.assertEqual(final_status, ScanStatus.COMPLETED)

    def test_non_amass_failure_without_success_is_failed(self) -> None:
        results = [_Result(tool="nmap", status="failed")]

        final_status = _resolve_final_status(results, ScanStatus.RUNNING)

        self.assertEqual(final_status, ScanStatus.FAILED)

    def test_amass_failure_with_success_is_completed(self) -> None:
        results = [
            _Result(tool="amass", status="failed"),
            _Result(tool="nmap", status="done"),
        ]

        final_status = _resolve_final_status(results, ScanStatus.RUNNING)

        self.assertEqual(final_status, ScanStatus.COMPLETED)

    def test_cancelling_status_forces_cancelled(self) -> None:
        results = [_Result(tool="nmap", status="done")]

        final_status = _resolve_final_status(results, ScanStatus.CANCELLING)

        self.assertEqual(final_status, ScanStatus.CANCELLED)

    def test_all_cancelled_results_to_cancelled(self) -> None:
        results = [
            _Result(tool="subfinder", status="cancelled"),
            _Result(tool="amass", status="cancelled"),
        ]

        final_status = _resolve_final_status(results, ScanStatus.RUNNING)

        self.assertEqual(final_status, ScanStatus.CANCELLED)


if __name__ == "__main__":
    unittest.main()
