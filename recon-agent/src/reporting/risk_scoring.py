from __future__ import annotations


def severity_counts(findings: list[dict]) -> dict:
    counts = {"info": 0, "low": 0, "medium": 0, "high": 0, "critical": 0}
    for finding in findings:
        sev = str(finding.get("severity", "info")).lower()
        if sev not in counts:
            sev = "info"
        counts[sev] += 1
    return counts
