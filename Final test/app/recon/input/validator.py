from __future__ import annotations

from dataclasses import dataclass, asdict
import ipaddress
import re
from urllib.parse import urlparse

DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+\.?$"
)


@dataclass
class ValidationResult:
    valid: bool
    target_type: str
    normalized_target: str
    errors: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def _is_domain(value: str) -> bool:
    return bool(DOMAIN_RE.match(value))


def _normalize_url(value: str) -> str:
    parsed = urlparse(value)
    return parsed.geturl().rstrip("/")


def classify_target(target: str) -> str:
    value = target.strip()

    try:
        ipaddress.ip_address(value)
        return "ip"
    except ValueError:
        pass

    try:
        ipaddress.ip_network(value, strict=False)
        return "ip"
    except ValueError:
        pass

    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return "application"

    if _is_domain(value):
        return "domain"

    return "unknown"


def validate_target(target: str) -> ValidationResult:
    errors: list[str] = []
    value = target.strip()

    if not value:
        return ValidationResult(False, "unknown", "", ["Target cannot be empty"])

    target_type = classify_target(value)

    if target_type == "ip":
        try:
            if "/" in value:
                ipaddress.ip_network(value, strict=False)
            else:
                ipaddress.ip_address(value)
        except ValueError:
            errors.append("Invalid IP or CIDR format")

    elif target_type == "domain":
        if not _is_domain(value):
            errors.append("Invalid domain format")

    elif target_type == "application":
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append("Application target must be a full http(s) URL")

    else:
        errors.append("Target must be a domain, IP/CIDR, or application URL")

    normalized = _normalize_url(value) if target_type == "application" else value.lower()
    return ValidationResult(valid=not errors, target_type=target_type, normalized_target=normalized, errors=errors)
