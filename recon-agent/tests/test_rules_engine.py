from __future__ import annotations

import unittest

from src.planner.rules_engine import build_plan


class TestRulesEngine(unittest.TestCase):
    def test_domain_plan_uses_available_tools(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/local/bin/nuclei",
        }
        wordlists = {"recommended_for_recon": {"web_content": ["/tmp/list.txt"]}}

        steps = build_plan("example.com", "domain", available_tools, wordlists, set())
        tools = [step.tool for step in steps]

        self.assertIn("subfinder", tools)
        self.assertIn("nmap", tools)
        self.assertIn("nuclei", tools)
        self.assertNotIn("amass", tools)
        self.assertNotIn("ffuf", tools)

    def test_skip_completed_signatures(self) -> None:
        available_tools = {"nmap": "/usr/bin/nmap"}
        wordlists = {}

        initial = build_plan("1.1.1.1", "ip", available_tools, wordlists, set())
        completed = {initial[0].signature}
        final = build_plan("1.1.1.1", "ip", available_tools, wordlists, completed)

        self.assertEqual(len(final), 0)


if __name__ == "__main__":
    unittest.main()
