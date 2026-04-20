from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from hashlib import sha256


@dataclass
class Finding:
    finding_id: str
    asset: str
    source_tool: str
    category: str
    evidence: dict
    severity: str
    timestamp: str
    status: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class FullData:
    target: dict
    scan_metadata: dict
    assets: list[dict]
    findings: list[dict]
    errors: list[str]
    execution_history: list[dict]

    def to_dict(self) -> dict:
        return asdict(self)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_finding(raw: dict) -> Finding:
    asset = str(raw.get("asset", "unknown"))
    source_tool = str(raw.get("source_tool", "unknown"))
    category = str(raw.get("category", "unknown"))
    evidence = raw.get("evidence", {}) or {}
    severity = str(raw.get("severity", "info")).lower()
    status = str(raw.get("status", "new")).lower()

    digest = sha256(f"{asset}|{source_tool}|{category}|{evidence}".encode("utf-8")).hexdigest()

    return Finding(
        finding_id=digest,
        asset=asset,
        source_tool=source_tool,
        category=category,
        evidence=evidence,
        severity=severity,
        timestamp=now_iso(),
        status=status,
    )
