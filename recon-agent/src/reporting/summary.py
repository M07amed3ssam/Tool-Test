from __future__ import annotations

from .risk_scoring import severity_counts


def generate_summary(target: str, findings: list[dict], assets: list[dict], errors: list[str]) -> str:
    counts = severity_counts(findings)
    lines = [
        f"Target: {target}",
        f"Assets discovered: {len(assets)}",
        f"Findings: {len(findings)}",
        "Severity counts:",
        f"  info: {counts['info']}",
        f"  low: {counts['low']}",
        f"  medium: {counts['medium']}",
        f"  high: {counts['high']}",
        f"  critical: {counts['critical']}",
        f"Errors: {len(errors)}",
    ]
    return "\n".join(lines)
