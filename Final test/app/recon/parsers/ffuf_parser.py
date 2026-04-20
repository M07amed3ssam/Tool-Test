from __future__ import annotations

from pathlib import Path
import json


def parse(file_path: Path) -> dict:
    if not file_path.exists():
        return {"assets": [], "findings": [], "errors": [f"Missing file: {file_path}"]}

    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"assets": [], "findings": [], "errors": [f"Invalid ffuf JSON: {exc}"]}

    assets: list[dict] = []
    findings: list[dict] = []

    for result in payload.get("results", []):
        url = result.get("url", "")
        status = result.get("status")
        length = result.get("length")

        if url:
            assets.append({"type": "url", "value": url, "source_tool": "ffuf"})

        findings.append(
            {
                "asset": url or "unknown",
                "source_tool": "ffuf",
                "category": "path",
                "evidence": {"status": status, "length": length},
                "severity": "info",
                "status": "new",
            }
        )

    return {"assets": assets, "findings": findings, "errors": []}
