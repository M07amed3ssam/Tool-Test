from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
import os

from .risk_scoring import severity_counts
from app.recon.planner.ai_planner import _load_env_file, _provider_order, _run_provider


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
        "- Produce a Final_report.json object for the dashboard.\n"
        "- Preserve metadata, summary.counts, subdomains, ports, and list sizes.\n"
        "- Enrich vulnerability entries with description, remediation, impact, cve, mitre_link, references.\n"
        "- Return JSON only (no markdown, no commentary).\n"
        "Output JSON schema:\n"
        "{\n"
        '  "metadata": {"domain": "...", "target_type": "...", "scan_start": "..."},\n'
        '  "summary": {"counts": {...}},\n'
        '  "critical_severity_vulnerabilities": [...],\n'
        '  "high_severity_vulnerabilities": [...],\n'
        '  "medium_severity_vulnerabilities": [...],\n'
        '  "low_severity_vulnerabilities": [...],\n'
        '  "subdomains": [...],\n'
        '  "ports": [...],\n'
        '  "recommendations": {"immediate": [...], "short_term": [...], "medium_term": [...]}\n'
        "}\n\n"
        "full_data.json:\n"
        f"{payload}"
    )


def build_reporting_prompt_with_draft(full_data: dict, draft_report: dict) -> str:
    payload = json.dumps(full_data, ensure_ascii=False)
    draft_payload = json.dumps(draft_report, ensure_ascii=False)
    return (
        "You are a cybersecurity reporting AI.\n"
        "- Receive full_data.json and draft_report.json.\n"
        "- Enrich the draft report with missing context (description, remediation, impact, CVEs).\n"
        "- Preserve metadata, summary.counts, subdomains, ports, and list ordering.\n"
        "- Do NOT delete or add items to vulnerability lists; only enhance fields.\n"
        "- Return JSON only (no markdown).\n\n"
        "draft_report.json:\n"
        f"{draft_payload}\n\n"
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


def _llm_reporting_enabled() -> bool:
    flag = os.environ.get("REPORTING_LLM_ENABLED", "").strip().lower()
    return flag in {"1", "true", "yes", "on"}


def _looks_like_final_report(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False

    required_lists = [
        "critical_severity_vulnerabilities",
        "high_severity_vulnerabilities",
        "medium_severity_vulnerabilities",
        "low_severity_vulnerabilities",
        "subdomains",
        "ports",
    ]

    if "metadata" not in payload or "summary" not in payload:
        return False

    summary = payload.get("summary")
    if not isinstance(summary, dict) or not isinstance(summary.get("counts"), dict):
        return False

    for key in required_lists:
        if not isinstance(payload.get(key), list):
            return False

    if not isinstance(payload.get("recommendations"), dict):
        return False

    return True


def _vulnerability_key(item: dict) -> str:
    if not isinstance(item, dict):
        return ""

    for key in ("id", "title"):
        value = str(item.get(key, "")).strip().lower()
        if value:
            return value
    return ""


def _merge_vulnerability_entry(base: dict, enriched: dict) -> dict:
    merged = dict(base)
    if not isinstance(enriched, dict):
        return merged

    if not merged.get("id") and enriched.get("id"):
        merged["id"] = enriched.get("id")
    if not merged.get("title") and enriched.get("title"):
        merged["title"] = enriched.get("title")

    for field in [
        "description",
        "remediation",
        "impact",
        "cve",
        "mitre_link",
        "references",
        "cvss",
        "cwe",
        "raw",
        "evidence",
    ]:
        if field in enriched and enriched[field] not in {None, ""}:
            merged[field] = enriched[field]

    affected_hosts = enriched.get("affected_hosts")
    if isinstance(affected_hosts, list) and affected_hosts:
        merged["affected_hosts"] = affected_hosts
    elif isinstance(affected_hosts, str) and affected_hosts.strip():
        merged["affected_hosts"] = [affected_hosts.strip()]

    return merged


def _merge_vulnerability_lists(base_list: list, llm_list: object) -> list:
    if not isinstance(llm_list, list):
        return base_list

    llm_index = {}
    for item in llm_list:
        if not isinstance(item, dict):
            continue
        key = _vulnerability_key(item)
        if key:
            llm_index[key] = item

    merged_list: list = []
    for base_item in base_list:
        if not isinstance(base_item, dict):
            merged_list.append(base_item)
            continue
        key = _vulnerability_key(base_item)
        if key and key in llm_index:
            merged_list.append(_merge_vulnerability_entry(base_item, llm_index[key]))
        else:
            merged_list.append(base_item)
    return merged_list


def _merge_recommendations(base: dict, enriched: object) -> dict:
    merged = deepcopy(base) if isinstance(base, dict) else {"immediate": [], "short_term": [], "medium_term": []}
    if not isinstance(enriched, dict):
        return merged

    for key in ["immediate", "short_term", "medium_term"]:
        values = enriched.get(key)
        if isinstance(values, list) and values:
            merged[key] = values
    return merged


def merge_llm_report(base_report: dict, llm_report: dict | None) -> dict:
    if not isinstance(base_report, dict):
        return base_report

    if not isinstance(llm_report, dict):
        return base_report

    merged = deepcopy(base_report)

    for key in [
        "critical_severity_vulnerabilities",
        "high_severity_vulnerabilities",
        "medium_severity_vulnerabilities",
        "low_severity_vulnerabilities",
    ]:
        merged[key] = _merge_vulnerability_lists(merged.get(key, []), llm_report.get(key))

    merged["recommendations"] = _merge_recommendations(
        merged.get("recommendations", {}),
        llm_report.get("recommendations"),
    )

    return merged


def generate_llm_report(full_data: dict, draft_report: dict) -> dict:
    if not _llm_reporting_enabled():
        return {
            "enabled": False,
            "report": None,
            "errors": ["REPORTING_LLM_ENABLED is not set"],
        }

    _load_env_file()
    prompt = build_reporting_prompt_with_draft(full_data, draft_report)
    errors: list[str] = []

    for provider in _provider_order():
        try:
            response = _run_provider(provider, prompt)
            report = response.get("phases")
            if isinstance(report, dict) and _looks_like_final_report(report):
                return {
                    "enabled": True,
                    "report": report,
                    "provider": response.get("provider"),
                    "model": response.get("model"),
                    "raw_response": response.get("raw_response", ""),
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "errors": errors,
                }
            errors.append(f"{provider}: invalid report schema")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{provider}: {exc}")

    return {
        "enabled": True,
        "report": None,
        "errors": errors,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }