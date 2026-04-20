from __future__ import annotations

import unittest
from unittest.mock import patch

from src.planner.ai_planner import _parse_ollama_stream_payload, _provider_order, plan_with_ai


class TestAiPlanner(unittest.TestCase):
    def test_domain_flow_order_with_fallback(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "amass": "/usr/bin/amass",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/bin/nuclei",
            "ffuf": "/usr/bin/ffuf",
        }
        wordlists = {"recommended_for_recon": {"web_content": ["/tmp/list.txt"]}}

        with patch("src.planner.ai_planner._llm_decisions", side_effect=RuntimeError("offline")):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists=wordlists,
                completed_signatures=set(),
            )

        self.assertTrue(result["enabled"])
        self.assertEqual(result["llm_source"], "fallback")

        tools = [step.tool for step in result["steps"]]
        self.assertEqual(tools[:4], ["subfinder", "amass", "nmap", "nuclei"])

    def test_ip_flow_order_with_fallback(self) -> None:
        available_tools = {
            "nmap": "/usr/bin/nmap",
            "masscan": "/usr/bin/masscan",
            "nuclei": "/usr/bin/nuclei",
        }

        with patch("src.planner.ai_planner._llm_decisions", side_effect=RuntimeError("offline")):
            result = plan_with_ai(
                target="1.1.1.1",
                target_type="ip",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        tools = [step.tool for step in result["steps"]]
        self.assertEqual(tools, ["nmap", "masscan", "nuclei"])

    def test_llm_selection_is_normalized_to_ip_flow(self) -> None:
        available_tools = {
            "nmap": "/usr/bin/nmap",
            "masscan": "/usr/bin/masscan",
            "nuclei": "/usr/bin/nuclei",
            "ffuf": "/usr/bin/ffuf",
        }

        llm_payload = {
            "analyze_target_type": {
                "agent": "analyze_target_type",
                "target_type": "ip",
                "confidence": 1.0,
                "reason": "test",
            },
            "select_recon_tools": {
                "agent": "select_recon_tools",
                "strategy": "test",
                "selected_tools": ["ffuf", "nuclei", "masscan", "nmap"],
            },
            "parameter_optimization": {
                "agent": "parameter_optimization",
                "web_wordlist": "/tmp/list.txt",
                "nmap_timing": "-T4",
                "masscan_rate": 2000,
                "ffuf_match_codes": "200,301",
                "ffuf_threads": 25,
                "gobuster_threads": 20,
            },
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_payload):
            result = plan_with_ai(
                target="1.1.1.1",
                target_type="ip",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        tools = [step.tool for step in result["steps"]]
        self.assertEqual(tools, ["nmap", "masscan", "nuclei"])

    def test_invalid_optimization_values_are_coerced(self) -> None:
        available_tools = {
            "nmap": "/usr/bin/nmap",
            "masscan": "/usr/bin/masscan",
            "nuclei": "/usr/bin/nuclei",
        }

        llm_payload = {
            "analyze_target_type": {
                "agent": "analyze_target_type",
                "target_type": "ip",
                "confidence": 1.0,
                "reason": "test",
            },
            "select_recon_tools": {
                "agent": "select_recon_tools",
                "strategy": "test",
                "selected_tools": ["nmap", "masscan", "nuclei"],
            },
            "parameter_optimization": {
                "agent": "parameter_optimization",
                "web_wordlist": "/tmp/list.txt",
                "nmap_timing": "FAST",
                "masscan_rate": "abc",
                "ffuf_match_codes": "200,301",
                "ffuf_threads": "bad",
                "gobuster_threads": "bad",
            },
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_payload):
            result = plan_with_ai(
                target="1.1.1.1",
                target_type="ip",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        commands = [step.command for step in result["steps"]]
        self.assertTrue(any("-T3" in cmd for cmd in commands if "nmap" in cmd))
        self.assertTrue(any("--rate 500" in cmd for cmd in commands if "masscan" in cmd))

    def test_llm_output_json_is_present(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/bin/nuclei",
        }

        with patch("src.planner.ai_planner._llm_decisions", side_effect=RuntimeError("offline")):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        llm_output = result.get("llm_output", {})
        self.assertEqual(llm_output.get("status"), "fallback")
        self.assertEqual(llm_output.get("is_live_llm"), False)
        self.assertIn("generated_at", llm_output)
        self.assertIn("parsed_json_raw", llm_output)
        self.assertIn("parsed_json_normalized", llm_output)
        self.assertIn("execution_orchestration", result.get("phases", {}))
        orchestration = result["phases"]["execution_orchestration"]
        self.assertIn(orchestration.get("mode"), {"sequential", "parallel"})

    def test_provider_is_set_from_llm_result(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "nmap": "/usr/bin/nmap",
        }

        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder", "nmap"],
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
            },
            "raw_response": "{}",
            "model": "gemini-2.0-flash",
            "provider": "google_ai",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        self.assertEqual(result["llm_source"], "google_ai")
        self.assertEqual(result["llm_output"]["provider"], "google_ai")
        self.assertEqual(result["llm_output"]["status"], "ok")

    @patch.dict("os.environ", {"AI_PROVIDER": "google"}, clear=False)
    def test_provider_order_google_first(self) -> None:
        self.assertEqual(_provider_order()[0], "google_ai")

    @patch.dict("os.environ", {"AI_PROVIDER": "ollama"}, clear=False)
    def test_provider_order_ollama_first(self) -> None:
        self.assertEqual(_provider_order()[0], "ollama")

    def test_parse_ollama_stream_payload(self) -> None:
        payload = (
            '{"response":"","thinking":"Hi","done":false}\n'
            '{"response":"{\\"analyze_target_type\\":{} }","done":true}\n'
        )
        response_text, thinking_text = _parse_ollama_stream_payload(payload)
        self.assertIn("analyze_target_type", response_text)
        self.assertIn("Hi", thinking_text)

    def test_execution_orchestration_sequential_clamps_parallel(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
        }
        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder"],
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
                "execution_orchestration": {
                    "agent": "orchestrator",
                    "mode": "sequential",
                    "max_parallel": 8,
                    "reason": "test",
                },
            },
            "raw_response": "{}",
            "model": "deepseek-r1:8b",
            "provider": "ollama",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        orchestration = result["phases"]["execution_orchestration"]
        self.assertEqual(orchestration["mode"], "sequential")
        self.assertEqual(orchestration["max_parallel"], 1)

    def test_domain_flow_injects_required_nuclei_when_available(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "amass": "/usr/bin/amass",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/bin/nuclei",
        }
        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder", "amass", "nmap"],
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
                "execution_orchestration": {
                    "agent": "orchestrator",
                    "mode": "parallel",
                    "max_parallel": 4,
                    "reason": "test",
                },
            },
            "raw_response": "{}",
            "model": "deepseek-r1:8b",
            "provider": "ollama",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        tools = [step.tool for step in result["steps"]]
        self.assertIn("nuclei", tools)

    def test_domain_flow_injects_ffuf_and_gobuster_when_available(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "amass": "/usr/bin/amass",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/bin/nuclei",
            "ffuf": "/usr/bin/ffuf",
            "gobuster": "/usr/bin/gobuster",
        }
        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder", "amass", "nmap", "nuclei"],
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
                "execution_orchestration": {
                    "agent": "orchestrator",
                    "mode": "parallel",
                    "max_parallel": 4,
                    "reason": "test",
                },
            },
            "raw_response": "{}",
            "model": "deepseek-r1:8b",
            "provider": "ollama",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        tools = [step.tool for step in result["steps"]]
        self.assertIn("ffuf", tools)
        self.assertIn("gobuster", tools)

    def test_command_override_sets_ai_primary_with_static_fallback(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/bin/nuclei",
        }
        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder", "nmap"],
                    "command_overrides": {
                        "subfinder": "subfinder -d example.com -silent -o data/raw/subfinder.txt -all",
                    },
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
                "execution_orchestration": {
                    "agent": "orchestrator",
                    "mode": "sequential",
                    "max_parallel": 1,
                    "reason": "test",
                },
            },
            "raw_response": "{}",
            "model": "deepseek-r1:8b",
            "provider": "ollama",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        subfinder_step = next(step for step in result["steps"] if step.tool == "subfinder")
        self.assertEqual(subfinder_step.command_source, "ai")
        self.assertIn("-all", subfinder_step.command)
        self.assertIn("subfinder -d example.com", subfinder_step.fallback_command)

    def test_invalid_nmap_override_is_rejected_to_static(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/bin/nuclei",
        }
        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder", "nmap"],
                    "command_overrides": {
                        "nmap": "nmap -sS -T4 -p- --script vuln -oN output.txt",
                    },
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
                "execution_orchestration": {
                    "agent": "orchestrator",
                    "mode": "sequential",
                    "max_parallel": 1,
                    "reason": "test",
                },
            },
            "raw_response": "{}",
            "model": "deepseek-r1:8b",
            "provider": "ollama",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        nmap_step = next(step for step in result["steps"] if step.tool == "nmap")
        self.assertEqual(nmap_step.command_source, "static")
        self.assertIn("data/raw/nmap.xml", nmap_step.command)

    def test_invalid_ffuf_override_without_fuzz_is_rejected_to_static(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "ffuf": "/usr/bin/ffuf",
            "nuclei": "/usr/bin/nuclei",
        }
        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder", "ffuf"],
                    "command_overrides": {
                        "ffuf": "ffuf -u http://invalid/{wordlist} -w /tmp/list.txt -o data/raw/ffuf.json",
                    },
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
                "execution_orchestration": {
                    "agent": "orchestrator",
                    "mode": "sequential",
                    "max_parallel": 1,
                    "reason": "test",
                },
            },
            "raw_response": "{}",
            "model": "deepseek-r1:8b",
            "provider": "ollama",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        ffuf_step = next(step for step in result["steps"] if step.tool == "ffuf")
        self.assertEqual(ffuf_step.command_source, "static")
        self.assertIn("/FUZZ", ffuf_step.command)

    def test_domain_nmap_static_scans_collected_subdomains(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "nmap": "/usr/bin/nmap",
            "nuclei": "/usr/bin/nuclei",
        }

        with patch("src.planner.ai_planner._llm_decisions", side_effect=RuntimeError("offline")):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        nmap_step = next(step for step in result["steps"] if step.tool == "nmap")
        self.assertIn("data/state/subdomains_all.txt", nmap_step.command)
        self.assertIn("-iL", nmap_step.command)

    def test_domain_ffuf_single_host_ai_override_is_rejected_to_static(self) -> None:
        available_tools = {
            "subfinder": "/usr/bin/subfinder",
            "ffuf": "/usr/bin/ffuf",
            "nuclei": "/usr/bin/nuclei",
        }
        llm_wrapped = {
            "phases": {
                "analyze_target_type": {
                    "agent": "analyze_target_type",
                    "target_type": "domain",
                    "confidence": 1.0,
                    "reason": "test",
                },
                "select_recon_tools": {
                    "agent": "select_recon_tools",
                    "strategy": "test",
                    "selected_tools": ["subfinder", "ffuf"],
                    "command_overrides": {
                        "ffuf": "ffuf -u https://example.com/FUZZ -w /tmp/list.txt -o data/raw/ffuf.json -of json",
                    },
                },
                "parameter_optimization": {
                    "agent": "parameter_optimization",
                    "web_wordlist": "/tmp/list.txt",
                    "nmap_timing": "-T4",
                    "masscan_rate": 1000,
                    "ffuf_match_codes": "200,301",
                    "ffuf_threads": 40,
                    "gobuster_threads": 30,
                },
                "execution_orchestration": {
                    "agent": "orchestrator",
                    "mode": "sequential",
                    "max_parallel": 1,
                    "reason": "test",
                },
            },
            "raw_response": "{}",
            "model": "deepseek-r1:8b",
            "provider": "ollama",
        }

        with patch("src.planner.ai_planner._llm_decisions", return_value=llm_wrapped):
            result = plan_with_ai(
                target="example.com",
                target_type="domain",
                available_tools=available_tools,
                wordlists={},
                completed_signatures=set(),
            )

        ffuf_step = next(step for step in result["steps"] if step.tool == "ffuf")
        self.assertEqual(ffuf_step.command_source, "static")
        self.assertIn("data/state/subdomains_all.txt:DOMAIN", ffuf_step.command)


if __name__ == "__main__":
    unittest.main()
