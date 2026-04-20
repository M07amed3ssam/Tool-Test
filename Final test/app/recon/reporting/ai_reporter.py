from __future__ import annotations

import json

from .risk_scoring import severity_counts


_RISK_PRIORITY = {"high": 3, "medium": 2, "low": 1}
_SENSITIVE_PORTS = {21, 22, 23, 25, 110, 143, 3389, 445, 1433, 3306, 5432, 6379, 27017}
_HIGH_RISK_KEYWORDS = (
    "critical",
    "rce",
    "remote code execution",
    "sql",
    "xss",
    "lfi",
    "rfi",
    "ssrf",
    "auth bypass",
    "traversal",
    "exposed",
)


def _to_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _safe_text(value: object, default: str = "") -> str:
    text = str(value).strip() if value is not None else ""
    return text if text else default


def _shorten(text: str, limit: int = 160) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def score_finding_risk(finding: dict) -> tuple[str, str]:
    severity = _safe_text(finding.get("severity"), "info").lower()
    category = _safe_text(finding.get("category"), "unknown").lower()
    evidence = finding.get("evidence", {})
    if not isinstance(evidence, dict):
        evidence = {}

    if severity in {"critical", "high"}:
        return "high", f"Scanner severity is {severity}."
    if severity == "medium":
        return "medium", "Scanner severity is medium."
    if severity == "low":
        return "low", "Scanner severity is low."

    if category == "vuln":
        raw = _safe_text(evidence.get("raw"), "").lower()
        if any(keyword in raw for keyword in _HIGH_RISK_KEYWORDS):
            return "high", "Vulnerability evidence contains high-impact keywords."
        return "medium", "Unclassified vulnerability treated as medium risk by policy."

    if category == "service":
        port = _to_int(evidence.get("port"))
        if port in _SENSITIVE_PORTS:
            return "medium", f"Exposed sensitive service port {port}."
        return "low", "Open service discovered with informational severity."

    if category == "path":
        status = _to_int(evidence.get("status"))
        if status in {200, 401, 403}:
            return "low", f"Web path responded with status {status}."
        return "low", "Web path discovery is informational by default."

    return "low", "Informational reconnaissance finding."


def _collect_open_ports(findings: list[dict]) -> list[int]:
    ports: set[int] = set()
    for finding in findings:
        if _safe_text(finding.get("category"), "").lower() != "service":
            continue
        evidence = finding.get("evidence", {})
        if not isinstance(evidence, dict):
            continue
        port = _to_int(evidence.get("port"))
        if port is not None:
            ports.add(port)
    return sorted(ports)


def _build_risk_scores(findings: list[dict]) -> list[dict]:
    risk_scores: list[dict] = []
    for finding in findings:
        risk_level, rationale = score_finding_risk(finding)
        evidence = finding.get("evidence", {})
        preview = ""
        if isinstance(evidence, dict):
            preview = _safe_text(evidence.get("raw"), "")
        if not preview:
            preview = json.dumps(evidence, ensure_ascii=False) if isinstance(evidence, dict) else _safe_text(evidence, "")

        risk_scores.append(
            {
                "finding_id": _safe_text(finding.get("finding_id"), "unknown"),
                "asset": _safe_text(finding.get("asset"), "unknown"),
                "source_tool": _safe_text(finding.get("source_tool"), "unknown"),
                "category": _safe_text(finding.get("category"), "unknown"),
                "severity": _safe_text(finding.get("severity"), "info").lower(),
                "risk": risk_level,
                "rationale": rationale,
                "evidence_preview": _shorten(preview, 200),
            }
        )

    risk_scores.sort(key=lambda item: _RISK_PRIORITY.get(_safe_text(item.get("risk"), "low"), 1), reverse=True)
    return risk_scores


def _build_key_findings(risk_scores: list[dict], limit: int) -> list[dict]:
    key_items: list[dict] = []
    for item in risk_scores[:limit]:
        key_items.append(
            {
                "finding_id": item["finding_id"],
                "title": f"{item['category']} via {item['source_tool']}",
                "asset": item["asset"],
                "risk": item["risk"],
                "details": item["evidence_preview"],
            }
        )
    return key_items


def _build_visualization_recommendations() -> list[dict]:
    return [
        {
            "chart": "severity_distribution_bar",
            "purpose": "Show scanner severity distribution (info/low/medium/high/critical).",
            "data": ["findings.severity"],
        },
        {
            "chart": "risk_level_donut",
            "purpose": "Highlight actionable risk levels (low/medium/high).",
            "data": ["risk_scores.risk"],
        },
        {
            "chart": "open_ports_histogram",
            "purpose": "Visualize exposed ports to prioritize service hardening.",
            "data": ["findings where category=service -> evidence.port"],
        },
        {
            "chart": "findings_by_tool_stacked_bar",
            "purpose": "Compare which tools generated findings and their risk levels.",
            "data": ["findings.source_tool", "risk_scores.risk"],
        },
        {
            "chart": "execution_status_timeline",
            "purpose": "Track execution failures/timeouts by step and duration.",
            "data": ["execution_history.status", "execution_history.duration_seconds"],
        },
    ]


def _build_summary(full_data: dict, risk_scores: list[dict], open_ports: list[int]) -> str:
    target = full_data.get("target", {}) if isinstance(full_data.get("target", {}), dict) else {}
    target_value = _safe_text(target.get("value"), "unknown-target")

    findings = full_data.get("findings", []) if isinstance(full_data.get("findings", []), list) else []
    assets = full_data.get("assets", []) if isinstance(full_data.get("assets", []), list) else []
    errors = full_data.get("errors", []) if isinstance(full_data.get("errors", []), list) else []

    sev_counts = severity_counts(findings)
    vuln_count = sum(1 for finding in findings if _safe_text(finding.get("category"), "").lower() == "vuln")

    risk_counts = {"low": 0, "medium": 0, "high": 0}
    for item in risk_scores:
        risk = _safe_text(item.get("risk"), "low").lower()
        if risk in risk_counts:
            risk_counts[risk] += 1

    open_ports_text = ", ".join(str(port) for port in open_ports[:15]) if open_ports else "none"

    if not findings:
        return (
            f"Target {target_value} produced no findings in this run. "
            f"Assets discovered: {len(assets)}. "
            f"Execution errors recorded: {len(errors)}."
        )

    return (
        f"Target {target_value} produced {len(findings)} findings across {len(assets)} assets. "
        f"Vulnerability findings: {vuln_count}. "
        f"Open ports: {len(open_ports)} ({open_ports_text}). "
        f"Severity distribution: info={sev_counts['info']}, low={sev_counts['low']}, medium={sev_counts['medium']}, "
        f"high={sev_counts['high']}, critical={sev_counts['critical']}. "
        f"Actionable risk levels: high={risk_counts['high']}, medium={risk_counts['medium']}, low={risk_counts['low']}. "
        f"Execution errors recorded: {len(errors)}."
    )


def build_reporting_prompt(full_data: dict) -> str:
    payload = json.dumps(full_data, ensure_ascii=False)
    return (
        "You are a cybersecurity reporting AI.\n"
        "- Receive full_data.json with all recon results.\n"
        "- Summarize vulnerabilities, open ports, and findings.\n"
        "- Assign risk scores (low, medium, high) for each finding.\n"
        "- Suggest charts or visualizations for dashboard.\n"
        "Output JSON:\n"
        "{\n"
        '  "summary": "...",\n'
        '  "findings": [...],\n'
        '  "risk_scores": [...],\n'
        '  "visualization_recommendations": [...]\n'
        "}\n\n"
        "full_data.json:\n"
        f"{payload}"
    )


def generate_ai_report(full_data: dict, *, max_findings: int = 25) -> dict:
    findings = full_data.get("findings", []) if isinstance(full_data.get("findings", []), list) else []
    risk_scores = _build_risk_scores(findings)
    open_ports = _collect_open_ports(findings)

    return {
        "summary": _build_summary(full_data, risk_scores, open_ports),
        "findings": _build_key_findings(risk_scores, limit=max_findings),
        "risk_scores": risk_scores,
        "visualization_recommendations": _build_visualization_recommendations(),
    }