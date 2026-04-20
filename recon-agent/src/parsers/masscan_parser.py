from __future__ import annotations

from pathlib import Path


def parse(file_path: Path) -> dict:
    if not file_path.exists():
        return {"assets": [], "findings": [], "errors": [f"Missing file: {file_path}"]}

    assets: list[dict] = []
    findings: list[dict] = []
    for line in file_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        text = line.strip()
        if not text.startswith("open "):
            continue
        parts = text.split()
        if len(parts) < 4:
            continue
        protocol, port, host = parts[1], parts[2], parts[3]
        assets.append({"type": "ip", "value": host, "source_tool": "masscan"})
        findings.append(
            {
                "asset": host,
                "source_tool": "masscan",
                "category": "port",
                "evidence": {"protocol": protocol, "port": int(port)},
                "severity": "info",
                "status": "new",
            }
        )
    return {"assets": assets, "findings": findings, "errors": []}
