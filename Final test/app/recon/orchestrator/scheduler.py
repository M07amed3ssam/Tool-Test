from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import json
import subprocess

from .executor import CommandExecutor, ExecutionResult
from .retry_handler import run_with_retry


class _NonRetriableError(RuntimeError):
    pass


def _is_non_retriable_error(error_text: str) -> bool:
    lowered = error_text.lower()
    return (
        "sudo: a password is required" in lowered
        or "sudo: no password was provided" in lowered
        or "permission denied" in lowered
    )


def _is_ai_soft_failure(tool: str, result: ExecutionResult) -> bool:
    stderr_text = (result.stderr or "").lower()
    stdout_text = (result.stdout or "").lower()

    if tool == "nmap":
        if "no targets were specified" in stderr_text:
            return True
        if "0 ip addresses (0 hosts up) scanned" in stdout_text:
            return True

    if tool == "ffuf":
        if "keyword fuzz defined, but not found" in stderr_text:
            return True
        if "keyword fuzz defined, but not found" in stdout_text:
            return True

    if tool == "amass":
        amass_soft_markers = (
            "no root domains were provided",
            "no root domain names were provided",
            "must provide at least one domain name",
            "no target domains provided",
            "no names were discovered",
            "context deadline exceeded",
        )
        if any(marker in stderr_text for marker in amass_soft_markers):
            return True
        if any(marker in stdout_text for marker in amass_soft_markers):
            return True

    return False


def _failed_result(
    *,
    tool: str,
    step: int,
    command: str,
    command_source: str,
    primary_command: str,
    fallback_used: bool,
    mode: str,
    batch: int,
    attempts: int,
    error: str,
) -> ExecutionResult:
    ts = datetime.now(timezone.utc).isoformat()
    return ExecutionResult(
        tool=tool,
        step=step,
        command=command,
        command_source=command_source,
        primary_command=primary_command,
        fallback_used=fallback_used,
        mode=mode,
        batch=batch,
        status="failed",
        attempts=attempts,
        stdout="",
        stderr=error,
        output_summary="Command failed after retries",
        errors=error,
        return_code=1,
        started_at=ts,
        finished_at=ts,
    )


def _cancelled_result(
    *,
    tool: str,
    step: int,
    command: str,
    command_source: str,
    primary_command: str,
    mode: str,
    batch: int,
) -> ExecutionResult:
    ts = datetime.now(timezone.utc).isoformat()
    return ExecutionResult(
        tool=tool,
        step=step,
        command=command,
        command_source=command_source,
        primary_command=primary_command,
        fallback_used=False,
        mode=mode,
        batch=batch,
        status="cancelled",
        attempts=0,
        stdout="",
        stderr="",
        output_summary="Cancelled before execution",
        errors="Cancelled by user",
        return_code=1,
        started_at=ts,
        finished_at=ts,
    )


def _tool_stage(tool: str) -> int:
    if tool in {"subfinder", "amass"}:
        return 1
    if tool in {"nmap", "masscan"}:
        return 2
    if tool in {"ffuf", "gobuster"}:
        return 3
    if tool == "nuclei":
        return 4
    return 2


def _parallel_batches(steps: list) -> list[list]:
    by_stage: dict[int, list] = {}
    for step in steps:
        stage = _tool_stage(getattr(step, "tool", ""))
        by_stage.setdefault(stage, []).append(step)

    return [by_stage[stage] for stage in sorted(by_stage.keys())]


def _duration_seconds(started_at: str, finished_at: str) -> float | None:
    if not started_at or not finished_at:
        return None
    try:
        start_dt = datetime.fromisoformat(started_at)
        finish_dt = datetime.fromisoformat(finished_at)
        return round((finish_dt - start_dt).total_seconds(), 3)
    except ValueError:
        return None


def _result_to_unified(result: ExecutionResult) -> dict:
    return {
        "step": result.step,
        "tool": result.tool,
        "command_source": result.command_source,
        "primary_command": result.primary_command,
        "fallback_used": result.fallback_used,
        "mode": result.mode,
        "batch": result.batch,
        "status": result.status,
        "attempts": result.attempts,
        "command": result.command,
        "return_code": result.return_code,
        "started_at": result.started_at,
        "finished_at": result.finished_at,
        "duration_seconds": _duration_seconds(result.started_at, result.finished_at),
        "output_summary": result.output_summary,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "errors": result.errors,
    }


def _write_execution_results(base_dir: Path, mode: str, execute: bool, results: list[ExecutionResult]) -> None:
    state_dir = base_dir / "data" / "state"
    state_dir.mkdir(parents=True, exist_ok=True)

    success_count = sum(1 for item in results if item.status == "done")
    failed_count = sum(1 for item in results if item.status == "failed")
    dry_run_count = sum(1 for item in results if item.status == "dry_run")
    cancelled_count = sum(1 for item in results if item.status == "cancelled")

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "executed": execute,
        "mode": mode,
        "total_steps": len(results),
        "success_count": success_count,
        "failed_count": failed_count,
        "dry_run_count": dry_run_count,
        "cancelled_count": cancelled_count,
        "results": [_result_to_unified(item) for item in results],
    }
    (state_dir / "execution_results.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _execute_single_step(
    *,
    executor: CommandExecutor,
    step,
    retries: int,
    backoff_seconds: int,
    timeout_seconds: int,
    mode: str,
    batch: int,
) -> ExecutionResult:
    attempts = 0
    primary_command = getattr(step, "command", "")
    command_source = getattr(step, "command_source", "static")
    fallback_command = getattr(step, "fallback_command", "")

    def _run_command(command: str, source: str, fallback_used: bool) -> ExecutionResult:
        nonlocal attempts
        attempts += 1
        result = executor.execute(
            command,
            timeout_seconds=timeout_seconds,
            tool=step.tool,
            step=step.step,
            mode=mode,
            batch=batch,
            attempts=attempts,
            command_source=source,
            primary_command=primary_command or command,
            fallback_used=fallback_used,
        )
        if result.return_code != 0:
            error_text = result.errors or "Unknown command error"
            if _is_non_retriable_error(error_text):
                raise _NonRetriableError(error_text)
            raise RuntimeError(error_text)
        if source == "ai" and _is_ai_soft_failure(step.tool, result):
            raise RuntimeError("AI command soft-failure detected; falling back to static command")
        return result

    has_hybrid_fallback = command_source == "ai" and bool(fallback_command.strip()) and fallback_command != primary_command

    if has_hybrid_fallback:
        try:
            result = _run_command(primary_command, "ai", False)
            step.status = "done"
            return result
        except Exception as primary_exc:  # noqa: BLE001
            def _run_fallback() -> ExecutionResult:
                return _run_command(fallback_command, "static", True)

            try:
                result = run_with_retry(
                    _run_fallback,
                    retries=retries,
                    backoff_seconds=backoff_seconds,
                    non_retriable_exceptions=(_NonRetriableError, subprocess.TimeoutExpired),
                )
                step.status = "done"
                return result
            except Exception as fallback_exc:  # noqa: BLE001
                step.status = "failed"
                return _failed_result(
                    tool=step.tool,
                    step=step.step,
                    command=fallback_command,
                    command_source="static",
                    primary_command=primary_command,
                    fallback_used=True,
                    mode=mode,
                    batch=batch,
                    attempts=max(1, attempts),
                    error=f"AI command failed: {primary_exc}; static fallback failed: {fallback_exc}",
                )

    def _run() -> ExecutionResult:
        return _run_command(primary_command, command_source, False)

    try:
        result = run_with_retry(
            _run,
            retries=retries,
            backoff_seconds=backoff_seconds,
            non_retriable_exceptions=(_NonRetriableError, subprocess.TimeoutExpired),
        )
        step.status = "done"
        return result
    except Exception as exc:  # noqa: BLE001
        step.status = "failed"
        return _failed_result(
            tool=step.tool,
            step=step.step,
            command=primary_command,
            command_source=command_source,
            primary_command=primary_command,
            fallback_used=False,
            mode=mode,
            batch=batch,
            attempts=max(1, attempts),
            error=str(exc),
        )


def run_plan(
    steps: list,
    base_dir: Path,
    execute: bool,
    retries: int = 2,
    backoff_seconds: int = 2,
    timeout_seconds: int = 900,
    orchestration_mode: str = "sequential",
    max_parallel: int = 2,
    result_callback=None,
    cancel_requested=None,
) -> list[ExecutionResult]:
    results: list[ExecutionResult] = []
    mode = orchestration_mode if orchestration_mode in {"sequential", "parallel"} else "sequential"
    parallel_workers = max(1, max_parallel)

    if not execute:
        for step in steps:
            result = ExecutionResult(
                tool=step.tool,
                step=step.step,
                command=step.command,
                command_source=getattr(step, "command_source", "static"),
                primary_command=getattr(step, "command", ""),
                fallback_used=False,
                mode=mode,
                batch=1,
                status="dry_run",
                attempts=0,
                stdout="",
                stderr="",
                output_summary="Dry run: command not executed",
                errors=None,
                return_code=0,
                started_at="",
                finished_at="",
            )
            results.append(result)
            if result_callback is not None:
                result_callback(result)
        _write_execution_results(base_dir, mode, execute, results)
        return results

    executor = CommandExecutor(base_dir)

    if mode == "parallel":
        batches = _parallel_batches(steps)
        should_cancel = False
        for batch_index, batch_steps in enumerate(batches, start=1):
            if should_cancel or (cancel_requested is not None and cancel_requested()):
                should_cancel = True
                for step in sorted(batch_steps, key=lambda item: item.step):
                    step.status = "cancelled"
                    result = _cancelled_result(
                        tool=step.tool,
                        step=step.step,
                        command=step.command,
                        command_source=getattr(step, "command_source", "static"),
                        primary_command=getattr(step, "command", ""),
                        mode=mode,
                        batch=batch_index,
                    )
                    results.append(result)
                    if result_callback is not None:
                        result_callback(result)
                continue

            workers = min(parallel_workers, len(batch_steps))
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = [
                    pool.submit(
                        _execute_single_step,
                        executor=executor,
                        step=step,
                        retries=retries,
                        backoff_seconds=backoff_seconds,
                        timeout_seconds=timeout_seconds,
                        mode=mode,
                        batch=batch_index,
                    )
                    for step in batch_steps
                ]

                batch_results: list[ExecutionResult] = []
                for future in as_completed(futures):
                    item = future.result()
                    batch_results.append(item)
                    if result_callback is not None:
                        result_callback(item)
                batch_results.sort(key=lambda item: item.step)
                results.extend(batch_results)
    else:
        for step in steps:
            if cancel_requested is not None and cancel_requested():
                step.status = "cancelled"
                result = _cancelled_result(
                    tool=step.tool,
                    step=step.step,
                    command=step.command,
                    command_source=getattr(step, "command_source", "static"),
                    primary_command=getattr(step, "command", ""),
                    mode=mode,
                    batch=1,
                )
                results.append(result)
                if result_callback is not None:
                    result_callback(result)
                continue

            result = _execute_single_step(
                executor=executor,
                step=step,
                retries=retries,
                backoff_seconds=backoff_seconds,
                timeout_seconds=timeout_seconds,
                mode=mode,
                batch=1,
            )
            results.append(result)
            if result_callback is not None:
                result_callback(result)

    results.sort(key=lambda item: item.step)

    completed = [step.signature for step in steps if step.status == "done" and step.signature]
    state_path = base_dir / "data" / "state" / "completed_steps.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)
    existing: list[str] = []
    if state_path.exists():
        try:
            existing = json.loads(state_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = []

    merged = sorted(set(existing + completed))
    state_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    _write_execution_results(base_dir, mode, execute, results)

    return results
