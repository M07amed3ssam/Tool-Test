from __future__ import annotations

import time
from typing import Callable, TypeVar

T = TypeVar("T")


def run_with_retry(
    fn: Callable[[], T],
    retries: int = 2,
    backoff_seconds: int = 2,
    non_retriable_exceptions: tuple[type[Exception], ...] = (),
) -> T:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if non_retriable_exceptions and isinstance(exc, non_retriable_exceptions):
                raise RuntimeError(f"Operation failed after {attempt + 1} attempts: {last_error}")
            if attempt == retries:
                break
            time.sleep(backoff_seconds * (attempt + 1))
    raise RuntimeError(f"Operation failed after {retries + 1} attempts: {last_error}")
