from __future__ import annotations

from pathlib import Path
import re

SEVERITY_RE = re.compile(r"\[(info|low|medium|high|critical)\]", re.IGNORECASE)
URL_RE = re.compile(r"https?://\S+")


def parse(file_path: Path) -> dict:
    if not file_path.exists():
        return {"assets": [], "findings": [], "errors": [f"Missing file: {file_path}"]}

    assets: list[dict] = []
    findings: list[dict] = []

    for line in file_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        text = line.strip()
        if not text:
            continue

        sev_match = SEVERITY_RE.search(text)
        url_match = URL_RE.search(text)
        severity = sev_match.group(1).lower() if sev_match else "info"
        asset = url_match.group(0) if url_match else "unknown"

        findings.append(
            {
                "asset": asset,
                "source_tool": "nuclei",
                "category": "vuln",
                "evidence": {"raw": text},
                "severity": severity,
                "status": "new",
            }
        )
        if url_match:
            assets.append({"type": "url", "value": asset, "source_tool": "nuclei"})

    return {"assets": assets, "findings": findings, "errors": []}
