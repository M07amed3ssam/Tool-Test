from __future__ import annotations

import unittest

from app.scans.engine import build_final_report_payload, filter_plan, resolve_orchestration


class _Step:
    def __init__(self, step: int, tool: str) -> None:
        self.step = step
        self.tool = tool


class TestScanEngine(unittest.TestCase):
    def test_filter_plan_respects_tools_and_limit(self) -> None:
        steps = [_Step(1, "subfinder"), _Step(2, "nmap"), _Step(3, "nuclei")]
        filtered = filter_plan(steps=steps, only_tools=["nmap", "nuclei"], max_steps=1)

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0].tool, "nmap")
        self.assertEqual(filtered[0].step, 1)

    def test_resolve_orchestration_uses_ai_phase_when_auto(self) -> None:
        mode, max_parallel = resolve_orchestration(
            requested_mode="auto",
            requested_max_parallel=0,
            decision_phases={"execution_orchestration": {"mode": "parallel", "max_parallel": 4}},
        )

        self.assertEqual(mode, "parallel")
        self.assertEqual(max_parallel, 4)

    def test_build_final_report_payload_maps_counts(self) -> None:
        full_data = {
            "target": {"value": "example.com", "type": "domain"},
            "scan_metadata": {"generated_at": "2026-04-17T00:00:00+00:00"},
            "findings": [
                {
                    "category": "subdomain",
                    "asset": "api.example.com",
                    "severity": "info",
                    "source_tool": "subfinder",
                    "status": "new",
                    "evidence": {},
                },
                {
                    "category": "vuln",
                    "asset": "api.example.com",
                    "severity": "high",
                    "source_tool": "nuclei",
                    "status": "new",
                    "evidence": {"title": "sample high finding"},
                },
            ],
        }
        ai_report = {"findings": [{"details": "Fix exposed high-risk issues first."}]}

        payload = build_final_report_payload(full_data, ai_report)

        self.assertEqual(payload["metadata"]["domain"], "example.com")
        self.assertEqual(payload["summary"]["counts"]["total_subdomains"], 1)
        self.assertEqual(payload["summary"]["counts"]["vulnerabilities_total"], 2)
        self.assertEqual(len(payload["high_severity_vulnerabilities"]), 1)

    def test_build_final_report_payload_has_dashboard_required_keys(self) -> None:
        full_data = {
            "target": {"value": "example.com", "type": "domain"},
            "scan_metadata": {"generated_at": "2026-04-17T00:00:00+00:00"},
            "findings": [
                {
                    "category": "subdomain",
                    "asset": "api.example.com",
                    "severity": "info",
                    "source_tool": "subfinder",
                    "status": "new",
                    "evidence": {},
                },
                {
                    "category": "service",
                    "asset": "api.example.com",
                    "severity": "medium",
                    "source_tool": "nmap",
                    "status": "new",
                    "evidence": {"port": 443},
                },
                {
                    "category": "path",
                    "asset": "https://api.example.com/admin",
                    "severity": "low",
                    "source_tool": "ffuf",
                    "status": "new",
                    "evidence": {"status": 403},
                },
            ],
        }

        payload = build_final_report_payload(full_data, {"findings": []})

        self.assertIn("summary", payload)
        self.assertIn("counts", payload["summary"])
        counts = payload["summary"]["counts"]
        for key in [
            "total_subdomains",
            "live_hosts",
            "open_ports",
            "unique_urls",
            "vulnerabilities_total",
            "critical",
            "high",
            "medium",
            "low",
            "info",
        ]:
            self.assertIn(key, counts)

        self.assertIsInstance(payload["critical_severity_vulnerabilities"], list)
        self.assertIsInstance(payload["high_severity_vulnerabilities"], list)
        self.assertIsInstance(payload["medium_severity_vulnerabilities"], list)
        self.assertIsInstance(payload["low_severity_vulnerabilities"], list)
        self.assertIsInstance(payload["subdomains"], list)
        self.assertIsInstance(payload["ports"], list)

        self.assertIn("recommendations", payload)
        self.assertIn("immediate", payload["recommendations"])
        self.assertTrue(payload["recommendations"]["immediate"])


if __name__ == "__main__":
    unittest.main()
