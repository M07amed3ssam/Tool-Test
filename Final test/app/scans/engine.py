from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Iterable

from app.recon.parsers import (
    amass_parser,
    ffuf_parser,
    gobuster_parser,
    masscan_parser,
    nmap_parser,
    nuclei_parser,
    subfinder_parser,
)


def available_tool_map(payload: dict) -> dict[str, str]:
    tools = {}
    for item in payload.get("tools", []):
        if item.get("available"):
            tools[str(item.get("name"))] = str(item.get("path", ""))
    return tools


def filter_plan(steps: list, only_tools: Iterable[str], max_steps: int) -> list:
    only_tools_set = {item for item in only_tools if item}
    filtered = [step for step in steps if not only_tools_set or step.tool in only_tools_set]
    if max_steps > 0:
        filtered = filtered[:max_steps]

    for idx, step in enumerate(filtered, start=1):
        step.step = idx
    return filtered


def resolve_orchestration(
    requested_mode: str,
    requested_max_parallel: int,
    decision_phases: dict | None,
) -> tuple[str, int]:
    phase = decision_phases.get("execution_orchestration", {}) if isinstance(decision_phases, dict) else {}
    ai_mode = str(phase.get("mode", "")).strip().lower()

    try:
        ai_max_parallel = int(str(phase.get("max_parallel", "2")).strip())
    except ValueError:
        ai_max_parallel = 2

    if requested_mode in {"sequential", "parallel"}:
        mode = requested_mode
    elif ai_mode in {"sequential", "parallel"}:
        mode = ai_mode
    else:
        mode = "sequential"

    max_parallel = requested_max_parallel if requested_max_parallel > 0 else ai_max_parallel
    max_parallel = max(1, min(8, max_parallel))
    if mode == "sequential":
        max_parallel = 1

    return mode, max_parallel


def parse_outputs(run_root: Path) -> list[dict]:
    parser_map = [
        (run_root / "data" / "raw" / "subfinder.txt", subfinder_parser.parse),
        (run_root / "data" / "raw" / "amass.txt", amass_parser.parse),
        (run_root / "data" / "raw" / "masscan.txt", masscan_parser.parse),
        (run_root / "data" / "raw" / "nmap.xml", nmap_parser.parse),
        (run_root / "data" / "raw" / "nuclei.txt", nuclei_parser.parse),
        (run_root / "data" / "raw" / "ffuf.json", ffuf_parser.parse),
        (run_root / "data" / "raw" / "gobuster.txt", gobuster_parser.parse),
    ]

    parsed: list[dict] = []
    for file_path, parser in parser_map:
        if file_path.exists():
            parsed.append(parser(file_path))
    return parsed


def _line_count(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip())


def build_nuclei_status(run_root: Path, plan: list, results: list, execute: bool) -> dict:
    nuclei_in_plan = any(step.tool == "nuclei" for step in plan)
    nuclei_result = next((res for res in results if "nuclei " in res.command), None) if execute else None
    findings_path = run_root / "data" / "raw" / "nuclei.txt"
    existing_findings_count = _line_count(findings_path)
    findings_count = existing_findings_count if (nuclei_in_plan or nuclei_result is not None) else 0

    status = {
        "planned": nuclei_in_plan,
        "executed": execute and nuclei_result is not None,
        "findings_file": "data/raw/nuclei.txt",
        "findings_count": findings_count,
        "stale_previous_findings_count": existing_findings_count if findings_count == 0 else 0,
        "state": "not_planned",
        "message": "Nuclei was not part of this run plan.",
        "return_code": None,
        "summary": "",
        "errors": None,
    }

    if nuclei_in_plan and not execute:
        status["state"] = "planned_not_executed"
        status["message"] = "Nuclei step was planned but not executed (dry run mode)."

    if execute and nuclei_result is not None:
        status["return_code"] = nuclei_result.return_code
        status["summary"] = nuclei_result.output_summary
        status["errors"] = nuclei_result.errors

        if nuclei_result.return_code != 0:
            status["state"] = "failed"
            status["message"] = "Nuclei execution failed. Check errors for details."
        elif findings_count == 0:
            status["state"] = "completed_no_matches"
            status["message"] = "Nuclei completed successfully with zero matches. Empty findings file is expected."
        else:
            status["state"] = "completed_with_matches"
            status["message"] = "Nuclei completed successfully and wrote findings."

    return status


def build_final_report_payload(full_data: dict, ai_report: dict) -> dict:
    findings = full_data.get("findings", []) if isinstance(full_data.get("findings"), list) else []
    target = full_data.get("target", {}) if isinstance(full_data.get("target"), dict) else {}
    metadata = full_data.get("scan_metadata", {}) if isinstance(full_data.get("scan_metadata"), dict) else {}

    severity_lists = {
        "critical": [],
        "high": [],
        "medium": [],
        "low": [],
    }

    subdomains = sorted({str(item.get("asset", "")) for item in findings if item.get("category") == "subdomain" and item.get("asset")})
    unique_urls = sorted(
        {
            str(item.get("asset", ""))
            for item in findings
            if item.get("category") in {"path", "url"} and item.get("asset")
        }
    )

    open_ports = []
    for finding in findings:
        if finding.get("category") != "service":
            continue
        evidence = finding.get("evidence", {}) if isinstance(finding.get("evidence"), dict) else {}
        port = evidence.get("port")
        if isinstance(port, int):
            open_ports.append(port)
        elif isinstance(port, str) and port.isdigit():
            open_ports.append(int(port))

    for finding in findings:
        severity = str(finding.get("severity", "info")).lower()
        if severity not in severity_lists:
            continue

        evidence = finding.get("evidence", {}) if isinstance(finding.get("evidence"), dict) else {}
        title = str(evidence.get("title") or evidence.get("template") or evidence.get("raw") or "Security finding")
        if len(title) > 180:
            title = title[:177] + "..."

        severity_lists[severity].append(
            {
                "title": title,
                "severity": severity.capitalize(),
                "asset": str(finding.get("asset", "unknown")),
                "source_tool": str(finding.get("source_tool", "unknown")),
                "status": str(finding.get("status", "new")),
            }
        )

    severity_counts = Counter(str(item.get("severity", "info")).lower() for item in findings)
    findings_total = len(findings)

    recommendations = ai_report.get("findings", []) if isinstance(ai_report.get("findings"), list) else []
    immediate = [str(item.get("details", "")).strip() for item in recommendations[:5] if str(item.get("details", "")).strip()]
    if not immediate:
        immediate = ["Review and remediate high-risk findings first."]

    return {
        "metadata": {
            "domain": str(target.get("value", "")),
            "target_type": str(target.get("type", "unknown")),
            "scan_start": metadata.get("generated_at"),
            "planner": metadata.get("planner", "rules_engine_v1"),
            "orchestration_mode": metadata.get("orchestration_mode", "sequential"),
        },
        "summary": {
            "counts": {
                "total_subdomains": len(subdomains),
                "live_hosts": len({str(item.get("asset", "")) for item in findings if item.get("category") == "service"}),
                "open_ports": len(set(open_ports)),
                "unique_urls": len(unique_urls),
                "vulnerabilities_total": findings_total,
                "critical": severity_counts.get("critical", 0),
                "high": severity_counts.get("high", 0),
                "medium": severity_counts.get("medium", 0),
                "low": severity_counts.get("low", 0),
                "info": severity_counts.get("info", 0),
            }
        },
        "critical_severity_vulnerabilities": severity_lists["critical"],
        "high_severity_vulnerabilities": severity_lists["high"],
        "medium_severity_vulnerabilities": severity_lists["medium"],
        "low_severity_vulnerabilities": severity_lists["low"],
        "subdomains": subdomains,
        "ports": sorted(set(open_ports)),
        "recommendations": {
            "immediate": immediate,
            "short_term": ["Validate medium-risk findings and tighten exposure controls."],
            "medium_term": ["Automate recurring authorized scans and trend risk over time."],
        },
    }
