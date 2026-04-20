from __future__ import annotations

from pathlib import Path


def parse(file_path: Path) -> dict:
    if not file_path.exists():
        return {"assets": [], "findings": [], "errors": [f"Missing file: {file_path}"]}

    assets: list[dict] = []
    findings: list[dict] = []
    for line in file_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        subdomain = line.strip()
        if not subdomain:
            continue
        assets.append({"type": "domain", "value": subdomain, "source_tool": "amass"})
        findings.append(
            {
                "asset": subdomain,
                "source_tool": "amass",
                "category": "subdomain",
                "evidence": {"subdomain": subdomain},
                "severity": "info",
                "status": "new",
            }
        )
    return {"assets": assets, "findings": findings, "errors": []}
