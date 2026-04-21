from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
import re
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


ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
CVE_RE = re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE)
URL_RE = re.compile(r"https?://[^\s\]\[\)\(\"']+", re.IGNORECASE)
VULNERABILITY_HINT_RE = re.compile(r"\bvuln(?:erability)?\b|\bcve-\d{4}-\d{4,7}\b", re.IGNORECASE)

SEVERITY_IMPACT = {
    "critical": {"confidentiality": "High", "integrity": "High", "availability": "High"},
    "high": {"confidentiality": "High", "integrity": "Medium", "availability": "Medium"},
    "medium": {"confidentiality": "Medium", "integrity": "Low", "availability": "Low"},
    "low": {"confidentiality": "Low", "integrity": "Low", "availability": "Low"},
    "info": {"confidentiality": "Unknown", "integrity": "Unknown", "availability": "Unknown"},
}


def _strip_ansi(value: object) -> str:
    text = str(value) if value is not None else ""
    return ANSI_ESCAPE_RE.sub("", text)


def _shorten(value: str, max_len: int = 220) -> str:
    text = value.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def _as_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _extract_cves(text: str) -> list[str]:
    return sorted({match.upper() for match in CVE_RE.findall(text)})


def _extract_urls(text: str) -> list[str]:
    return sorted({match for match in URL_RE.findall(text)})


def _normalize_host(asset: str, evidence: dict) -> str:
    for key in ("url", "host", "domain", "ip"):
        value = evidence.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return asset or "unknown"


def _finding_is_vulnerability(finding: dict) -> bool:
    category = str(finding.get("category", "")).lower()
    if category == "vuln":
        return True

    evidence = finding.get("evidence", {}) if isinstance(finding.get("evidence"), dict) else {}
    combined_text = " ".join(
        [
            str(finding.get("asset", "")),
            str(evidence.get("title", "")),
            str(evidence.get("template", "")),
            str(evidence.get("raw", "")),
            str(evidence.get("vulnerability", "")),
        ]
    )
    return bool(VULNERABILITY_HINT_RE.search(_strip_ansi(combined_text)))


def _build_vulnerability_entry(finding: dict) -> dict:
    evidence = finding.get("evidence", {}) if isinstance(finding.get("evidence"), dict) else {}
    severity = str(finding.get("severity", "info")).lower()
    severity_title = severity.capitalize() if severity in {"critical", "high", "medium", "low", "info"} else "Info"

    raw_text = _strip_ansi(str(evidence.get("raw", ""))).strip()
    template = _strip_ansi(str(evidence.get("template", ""))).strip()
    explicit_title = _strip_ansi(str(evidence.get("title", ""))).strip()
    vulnerability_key = _strip_ansi(str(evidence.get("vulnerability", ""))).strip()

    title = explicit_title or template or vulnerability_key
    if not title and raw_text:
        title = raw_text.splitlines()[0]
    if not title:
        title = "Security finding"
    title = _shorten(title, 180)

    asset = str(finding.get("asset", "unknown"))
    affected_host = _normalize_host(asset, evidence)
    cves = _extract_cves(" ".join([title, raw_text, affected_host]))
    references = _extract_urls(raw_text)
    mitre_links = [f"https://cve.mitre.org/cgi-bin/cvename.cgi?name={cve}" for cve in cves]

    description = _shorten(
        raw_text or f"Potential {severity_title.lower()} severity security finding discovered on {affected_host}.",
        420,
    )

    remediation = {
        "critical": "Patch immediately, restrict external exposure, and validate exploitation risk.",
        "high": "Prioritize remediation in the current patch cycle and verify compensating controls.",
        "medium": "Schedule remediation and hardening, then confirm with a targeted re-scan.",
        "low": "Document and harden configuration during routine maintenance.",
        "info": "Review finding context and confirm whether additional hardening is needed.",
    }.get(severity, "Review and remediate according to internal security policy.")

    finding_id = str(finding.get("finding_id", "")).strip()
    identifier = cves[0] if cves else (finding_id[:24] if finding_id else title.lower().replace(" ", "-")[:24])

    return {
        "id": identifier,
        "title": title,
        "description": description,
        "severity": severity_title,
        "cvss": None,
        "cve": cves,
        "mitre_link": mitre_links,
        "cwe": None,
        "affected_hosts": [affected_host],
        "evidence": raw_text or _strip_ansi(json.dumps(evidence, ensure_ascii=False)),
        "tool": str(finding.get("source_tool", "unknown")),
        "first_seen": finding.get("timestamp"),
        "impact": SEVERITY_IMPACT.get(severity, SEVERITY_IMPACT["info"]),
        "remediation": remediation,
        "references": references,
        "raw": json.dumps(evidence, ensure_ascii=False),
        "source_tool": str(finding.get("source_tool", "unknown")),
        "asset": asset,
        "status": str(finding.get("status", "new")),
    }


def _build_subdomains(findings: list[dict], assets: list[dict]) -> list[dict]:
    domains = set()
    for finding in findings:
        if str(finding.get("category", "")).lower() == "subdomain" and finding.get("asset"):
            domains.add(str(finding["asset"]))

    for asset in assets:
        if str(asset.get("type", "")).lower() == "domain" and asset.get("value"):
            domains.add(str(asset["value"]))

    return [{"domain": domain} for domain in sorted(domains)]


def _build_ports(findings: list[dict]) -> list[dict]:
    seen = set()
    ports: list[dict] = []
    for finding in findings:
        category = str(finding.get("category", "")).lower()
        if category not in {"service", "port"}:
            continue

        evidence = finding.get("evidence", {}) if isinstance(finding.get("evidence"), dict) else {}
        port = _as_int(evidence.get("port"))
        if port is None:
            continue

        host = str(finding.get("asset", "unknown"))
        protocol = str(evidence.get("protocol", "tcp"))
        key = (host, port, protocol)
        if key in seen:
            continue
        seen.add(key)

        ports.append(
            {
                "host": host,
                "ip": host if all(part.isdigit() for part in host.split(".")) and host.count(".") == 3 else None,
                "port": port,
                "protocol": protocol,
                "service": str(evidence.get("service", "unknown")),
                "product": evidence.get("product"),
                "version": evidence.get("version"),
                "state": str(evidence.get("state", "open")),
                "banner": evidence.get("banner"),
            }
        )

    ports.sort(key=lambda item: (item["host"], item["port"], item["protocol"]))
    return ports


def _build_immediate_recommendations(vuln_entries: list[dict], ai_report: dict) -> list[str]:
    prioritized = [item for item in vuln_entries if str(item.get("severity", "")).lower() in {"critical", "high"}]
    prioritized = prioritized[:5]
    recommendations = [
        f"{item.get('severity')}: {item.get('title')} on {item.get('affected_hosts', ['unknown'])[0]}"
        for item in prioritized
    ]

    if recommendations:
        return recommendations

    ai_items = ai_report.get("findings", []) if isinstance(ai_report.get("findings"), list) else []
    fallback = [str(item.get("details", "")).strip() for item in ai_items[:5] if str(item.get("details", "")).strip()]
    if fallback:
        return fallback

    return ["Review and remediate high-risk findings first."]


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
    assets = full_data.get("assets", []) if isinstance(full_data.get("assets"), list) else []

    severity_lists = {
        "critical": [],
        "high": [],
        "medium": [],
        "low": [],
    }

    subdomains = _build_subdomains(findings, assets)
    unique_urls = sorted(
        {
            str(item.get("value", ""))
            for item in assets
            if str(item.get("type", "")).lower() == "url" and item.get("value")
        }
    )
    unique_urls.extend(
        [
            str(item.get("asset", ""))
            for item in findings
            if item.get("category") in {"path", "url"} and item.get("asset")
        ]
    )
    unique_urls = sorted({item for item in unique_urls if item})

    ports = _build_ports(findings)
    vulnerability_findings = [finding for finding in findings if _finding_is_vulnerability(finding)]

    for finding in vulnerability_findings:
        severity = str(finding.get("severity", "info")).lower()
        if severity not in severity_lists:
            continue

        severity_lists[severity].append(_build_vulnerability_entry(finding))

    severity_counts = Counter(str(item.get("severity", "info")).lower() for item in findings)
    vuln_severity_counts = Counter(str(item.get("severity", "info")).lower() for item in vulnerability_findings)
    findings_total = len(vulnerability_findings)

    all_vuln_entries = [*severity_lists["critical"], *severity_lists["high"], *severity_lists["medium"], *severity_lists["low"]]
    immediate = _build_immediate_recommendations(all_vuln_entries, ai_report)

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
                "live_hosts": len({item["host"] for item in ports}),
                "open_ports": len({item["port"] for item in ports}),
                "unique_urls": len(unique_urls),
                "vulnerabilities_total": findings_total,
                "critical": severity_counts.get("critical", 0),
                "high": severity_counts.get("high", 0),
                "medium": severity_counts.get("medium", 0),
                "low": severity_counts.get("low", 0),
                "info": severity_counts.get("info", 0),
                "vulnerabilities_by_severity": {
                    "critical": vuln_severity_counts.get("critical", 0),
                    "high": vuln_severity_counts.get("high", 0),
                    "medium": vuln_severity_counts.get("medium", 0),
                    "low": vuln_severity_counts.get("low", 0),
                },
            }
        },
        "critical_severity_vulnerabilities": severity_lists["critical"],
        "high_severity_vulnerabilities": severity_lists["high"],
        "medium_severity_vulnerabilities": severity_lists["medium"],
        "low_severity_vulnerabilities": severity_lists["low"],
        "subdomains": subdomains,
        "ports": ports,
        "recommendations": {
            "immediate": immediate,
            "short_term": ["Validate medium-risk findings and tighten exposure controls."],
            "medium_term": ["Automate recurring authorized scans and trend risk over time."],
        },
    }
