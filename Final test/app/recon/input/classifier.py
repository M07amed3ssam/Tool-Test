from __future__ import annotations

from .validator import ValidationResult, validate_target


def classify_and_validate(target: str) -> ValidationResult:
    return validate_target(target)
