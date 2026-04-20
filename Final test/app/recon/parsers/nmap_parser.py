from __future__ import annotations

from pathlib import Path
import xml.etree.ElementTree as ET


def parse(file_path: Path) -> dict:
    if not file_path.exists():
        return {"assets": [], "findings": [], "errors": [f"Missing file: {file_path}"]}

    if file_path.suffix.lower() != ".xml":
        return {"assets": [], "findings": [], "errors": ["Nmap parser expects XML output"]}

    assets: list[dict] = []
    findings: list[dict] = []

    try:
        root = ET.parse(file_path).getroot()
    except ET.ParseError as exc:
        return {"assets": [], "findings": [], "errors": [f"Invalid XML: {exc}"]}

    for host in root.findall("host"):
        addr = host.find("address")
        if addr is None:
            continue
        ip = addr.attrib.get("addr", "")
        if not ip:
            continue
        assets.append({"type": "ip", "value": ip, "source_tool": "nmap"})

        for port in host.findall("ports/port"):
            state = port.find("state")
            service = port.find("service")
            if state is None or state.attrib.get("state") != "open":
                continue
            portid = port.attrib.get("portid")
            protocol = port.attrib.get("protocol", "tcp")
            name = service.attrib.get("name", "unknown") if service is not None else "unknown"

            findings.append(
                {
                    "asset": ip,
                    "source_tool": "nmap",
                    "category": "service",
                    "evidence": {
                        "port": int(portid) if portid and portid.isdigit() else portid,
                        "protocol": protocol,
                        "service": name,
                    },
                    "severity": "info",
                    "status": "new",
                }
            )

    return {"assets": assets, "findings": findings, "errors": []}
