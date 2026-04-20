from __future__ import annotations

from dataclasses import dataclass, asdict
from hashlib import sha256
from urllib.parse import urlparse


@dataclass
class PlanStep:
    step: int
    tool: str
    command: str
    status: str = "pending"
    reason: str = ""
    signature: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def _sig(tool: str, command: str) -> str:
    return sha256(f"{tool}|{command}".encode("utf-8")).hexdigest()


def _pick_wordlist(wordlists: dict, key: str, fallback: str) -> str:
    items = wordlists.get("recommended_for_recon", {}).get(key, [])
    return items[0] if items else fallback


def _build_nuclei_domain_command(target: str) -> str:
    return (
        f"sh -c 'cat data/raw/subfinder.txt data/raw/amass.txt 2>/dev/null "
        "| tr -d \"\\r\" | sed \"/^\\s*$/d\" | sort -u > data/state/subdomains_all.txt; "
        f"if [ ! -s data/state/subdomains_all.txt ]; then echo {target} > data/state/subdomains_all.txt; fi; "
        "sed \"s#^#https://#\" data/state/subdomains_all.txt > data/state/nuclei_targets.txt; "
        "nuclei -l data/state/nuclei_targets.txt -severity low,medium,high,critical -o data/raw/nuclei.txt'"
    )


def _add_step(
    steps: list[PlanStep],
    tool: str,
    command: str,
    reason: str,
    completed_signatures: set[str],
) -> None:
    signature = _sig(tool, command)
    if signature in completed_signatures:
        return
    steps.append(
        PlanStep(
            step=len(steps) + 1,
            tool=tool,
            command=command,
            status="pending",
            reason=reason,
            signature=signature,
        )
    )


def build_plan(
    target: str,
    target_type: str,
    available_tools: dict[str, str],
    wordlists: dict,
    completed_signatures: set[str] | None = None,
) -> list[PlanStep]:
    completed = completed_signatures or set()
    steps: list[PlanStep] = []

    web_wordlist = _pick_wordlist(
        wordlists,
        "web_content",
        "/usr/share/wordlists/dirb/common.txt",
    )

    if target_type == "domain":
        if "subfinder" in available_tools:
            _add_step(
                steps,
                "subfinder",
                f"subfinder -d {target} -silent -o data/raw/subfinder.txt",
                "Passive subdomain enumeration.",
                completed,
            )
        if "amass" in available_tools:
            _add_step(
                steps,
                "amass",
                f"amass enum -passive -d {target} -o data/raw/amass.txt",
                "Additional passive subdomain enumeration.",
                completed,
            )
        if "nuclei" in available_tools:
            _add_step(
                steps,
                "nuclei",
                _build_nuclei_domain_command(target),
                "Vulnerability checks against all discovered subdomains.",
                completed,
            )
        if "nmap" in available_tools:
            _add_step(
                steps,
                "nmap",
                f"nmap -sV -Pn {target} -oN data/raw/nmap.txt -oX data/raw/nmap.xml",
                "Service discovery.",
                completed,
            )
        if "ffuf" in available_tools:
            _add_step(
                steps,
                "ffuf",
                (
                    f"ffuf -u https://{target}/FUZZ -w {web_wordlist} "
                    "-mc 200,204,301,302,307,401,403 -o data/raw/ffuf.json -of json"
                ),
                "Web content discovery.",
                completed,
            )
        if "gobuster" in available_tools:
            _add_step(
                steps,
                "gobuster",
                f"gobuster dir -u https://{target} -w {web_wordlist} -o data/raw/gobuster.txt",
                "Directory brute-force fallback/coverage.",
                completed,
            )

    elif target_type == "ip":
        if "masscan" in available_tools:
            _add_step(
                steps,
                "masscan",
                f"masscan -p1-65535 {target} --rate 1000 -oL data/raw/masscan.txt",
                "Fast port sweep.",
                completed,
            )
        if "nmap" in available_tools:
            _add_step(
                steps,
                "nmap",
                f"nmap -sV -Pn {target} -oN data/raw/nmap.txt -oX data/raw/nmap.xml",
                "Service fingerprinting.",
                completed,
            )
        if "nuclei" in available_tools:
            _add_step(
                steps,
                "nuclei",
                f"nuclei -u http://{target} -severity low,medium,high,critical -o data/raw/nuclei.txt",
                "HTTP-targeted vulnerability checks if web services are exposed.",
                completed,
            )

    elif target_type == "application":
        parsed = urlparse(target)
        app_target = target if parsed.scheme else f"https://{target}"
        if "nuclei" in available_tools:
            _add_step(
                steps,
                "nuclei",
                f"nuclei -u {app_target} -severity low,medium,high,critical -o data/raw/nuclei.txt",
                "Application vulnerability checks.",
                completed,
            )
        if "ffuf" in available_tools:
            _add_step(
                steps,
                "ffuf",
                (
                    f"ffuf -u {app_target.rstrip('/')}/FUZZ -w {web_wordlist} "
                    "-mc 200,204,301,302,307,401,403 -o data/raw/ffuf.json -of json"
                ),
                "Application route/content discovery.",
                completed,
            )
        if "gobuster" in available_tools:
            _add_step(
                steps,
                "gobuster",
                f"gobuster dir -u {app_target} -w {web_wordlist} -o data/raw/gobuster.txt",
                "Application directory discovery fallback.",
                completed,
            )

    return steps
