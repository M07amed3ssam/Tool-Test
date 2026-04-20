from __future__ import annotations

import json
from pathlib import Path
import shutil


def discover_tools(tool_names: list[str]) -> list[dict]:
    discovered: list[dict] = []
    for name in tool_names:
        path = shutil.which(name)
        discovered.append({"name": name, "available": bool(path), "path": path or ""})
    return discovered


def save_discovery(output_path: Path, tools: list[dict]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"tools": tools}
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
