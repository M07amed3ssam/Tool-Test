from __future__ import annotations

import unittest

from src.reporting.ai_reporter import build_reporting_prompt, generate_ai_report


class TestAiReporter(unittest.TestCase):
    def test_generate_ai_report_structure_and_risk_levels(self) -> None:
        full_data = {
            "target": {"value": "example.com", "type": "domain", "validated": True},
            "assets": [
                {"type": "domain", "value": "api.example.com", "source_tool": "subfinder"},
                {"type": "ip", "value": "1.2.3.4", "source_tool": "nmap"},
            ],
            "findings": [
                {
                    "finding_id": "f1",
                    "asset": "https://api.example.com",
                    "source_tool": "nuclei",
                    "category": "vuln",
                    "evidence": {"raw": "[high] SQL injection candidate"},
                    "severity": "high",
                    "status": "new",
                },
                {
                    "finding_id": "f2",
                    "asset": "1.2.3.4",
                    "source_tool": "nmap",
                    "category": "service",
                    "evidence": {"port": 3389, "protocol": "tcp", "service": "ms-wbt-server"},
                    "severity": "info",
                    "status": "new",
                },
                {
                    "finding_id": "f3",
                    "asset": "https://api.example.com/admin",
                    "source_tool": "ffuf",
                    "category": "path",
                    "evidence": {"status": 200, "length": 1337},
                    "severity": "info",
                    "status": "new",
                },
            ],
            "errors": ["timeout on one step"],
            "execution_history": [
                {"tool": "nmap", "status": "failed", "duration_seconds": 30.5},
            ],
        }

        report = generate_ai_report(full_data)

        self.assertIn("summary", report)
        self.assertIn("findings", report)
        self.assertIn("risk_scores", report)
        self.assertIn("visualization_recommendations", report)
        self.assertGreater(len(report["visualization_recommendations"]), 0)
        self.assertIn("Open ports", report["summary"])

        by_id = {item["finding_id"]: item for item in report["risk_scores"]}
        self.assertEqual(by_id["f1"]["risk"], "high")
        self.assertEqual(by_id["f2"]["risk"], "medium")
        self.assertEqual(by_id["f3"]["risk"], "low")

    def test_generate_ai_report_handles_empty_findings(self) -> None:
        full_data = {
            "target": {"value": "example.com", "type": "domain", "validated": True},
            "assets": [],
            "findings": [],
            "errors": [],
            "execution_history": [],
        }

        report = generate_ai_report(full_data)
        self.assertEqual(report["risk_scores"], [])
        self.assertEqual(report["findings"], [])
        self.assertIn("produced no findings", report["summary"])

    def test_prompt_contains_required_output_contract(self) -> None:
        prompt = build_reporting_prompt({"target": {"value": "example.com"}, "findings": []})
        self.assertIn("You are a cybersecurity reporting AI.", prompt)
        self.assertIn('"summary"', prompt)
        self.assertIn('"risk_scores"', prompt)
        self.assertIn("full_data.json", prompt)


if __name__ == "__main__":
    unittest.main()