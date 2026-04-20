from __future__ import annotations

from pathlib import Path
import re

LINE_RE = re.compile(r"^(\S+)\s+\(Status:\s*(\d+)\)")


def parse(file_path: Path) -> dict:
    if not file_path.exists():
        return {"assets": [], "findings": [], "errors": [f"Missing file: {file_path}"]}

    findings: list[dict] = []

    for line in file_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        match = LINE_RE.search(line.strip())
        if not match:
            continue
        path, status = match.group(1), match.group(2)
        findings.append(
            {
                "asset": path,
                "source_tool": "gobuster",
                "category": "path",
                "evidence": {"status": int(status)},
                "severity": "info",
                "status": "new",
            }
        )

    return {"assets": [], "findings": findings, "errors": []}
