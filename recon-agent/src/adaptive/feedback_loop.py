from __future__ import annotations


def suggest_next_actions(findings: list[dict], executed_tools: list[str]) -> list[str]:
    actions: list[str] = []

    has_open_web_service = any(
        f.get("category") == "service"
        and str((f.get("evidence") or {}).get("service", "")).lower() in {"http", "https", "http-alt"}
        for f in findings
    )

    has_subdomains = any(f.get("category") == "subdomain" for f in findings)

    if has_subdomains and "nmap" not in executed_tools:
        actions.append("Run nmap against discovered subdomains/hosts")

    if has_open_web_service and "nuclei" not in executed_tools:
        actions.append("Run nuclei against discovered web services")

    if not actions:
        actions.append("No new adaptive action required")

    return actions
