from __future__ import annotations

from .schema import build_finding


def merge_parsed(parsed_payloads: list[dict]) -> dict:
    assets_seen: set[tuple[str, str]] = set()
    finding_ids_seen: set[str] = set()

    assets: list[dict] = []
    findings: list[dict] = []
    errors: list[str] = []

    for payload in parsed_payloads:
        for err in payload.get("errors", []):
            errors.append(str(err))

        for asset in payload.get("assets", []):
            key = (str(asset.get("type", "")), str(asset.get("value", "")))
            if key in assets_seen:
                continue
            assets_seen.add(key)
            assets.append(asset)

        for finding_raw in payload.get("findings", []):
            finding = build_finding(finding_raw).to_dict()
            fid = finding["finding_id"]
            if fid in finding_ids_seen:
                continue
            finding_ids_seen.add(fid)
            findings.append(finding)

    return {"assets": assets, "findings": findings, "errors": errors}
