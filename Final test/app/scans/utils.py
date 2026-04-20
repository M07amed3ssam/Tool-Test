import json
import mimetypes
import os
import re
from pathlib import Path
from typing import Any, Dict


DEFAULT_TOOL_NAMES = ["nmap", "masscan", "subfinder", "amass", "nuclei", "ffuf", "gobuster"]
BASE_SCANS_DIR = Path("app/data/scans")


def backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def workspace_root() -> Path:
    return Path(__file__).resolve().parents[3]


def ensure_scan_workspace(user_id: int, scan_job_id: int) -> Path:
    run_root = BASE_SCANS_DIR / str(user_id) / str(scan_job_id)
    for rel_path in ["data/raw", "data/state", "data/normalized"]:
        (run_root / rel_path).mkdir(parents=True, exist_ok=True)
    return run_root


def load_json_file(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def load_tools_inventory() -> Dict[str, Any]:
    env_path = os.getenv("RECON_TOOLS_FILE", "").strip()
    candidates = []
    if env_path:
        candidates.append(Path(env_path))
    candidates.extend([
        backend_root() / "available_tools.json",
        workspace_root() / "available_tools.json",
    ])

    for candidate in candidates:
        payload = load_json_file(candidate)
        if payload:
            return payload
    return {}


def load_wordlists_inventory() -> Dict[str, Any]:
    env_path = os.getenv("RECON_WORDLISTS_FILE", "").strip()
    candidates = []
    if env_path:
        candidates.append(Path(env_path))
    candidates.extend([
        backend_root() / "available_wordlists.json",
        workspace_root() / "available_wordlists.json",
    ])

    for candidate in candidates:
        payload = load_json_file(candidate)
        if payload:
            return payload

    return {
        "recommended_for_recon": {
            "dns_subdomains": ["/usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt"],
            "web_content": ["/usr/share/seclists/Discovery/Web-Content/common.txt"],
            "usernames": ["/usr/share/seclists/Usernames/Names/names.txt"],
        }
    }


def slugify_name(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip().lower())
    normalized = normalized.strip("-.")
    return normalized or "scan"


def guess_content_type(path: Path) -> str:
    content_type, _ = mimetypes.guess_type(str(path))
    return content_type or "application/octet-stream"


def to_relative_posix(path: Path, relative_to: Path) -> str:
    try:
        return path.resolve().relative_to(relative_to.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def parse_iso_datetime(value: Any):
    if not isinstance(value, str) or not value.strip():
        return None

    fixed = value.strip().replace("Z", "+00:00")
    try:
        from datetime import datetime

        return datetime.fromisoformat(fixed)
    except ValueError:
        return None
