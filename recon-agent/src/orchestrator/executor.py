from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import os
from pathlib import Path
import subprocess


@dataclass
class ExecutionResult:
    tool: str = ""
    step: int = 0
    command: str = ""
    command_source: str = "static"
    primary_command: str = ""
    fallback_used: bool = False
    mode: str = "sequential"
    batch: int = 0
    status: str = "pending"
    attempts: int = 0
    stdout: str = ""
    stderr: str = ""
    output_summary: str = ""
    errors: str | None = None
    return_code: int = 0
    started_at: str = ""
    finished_at: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class CommandExecutor:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        (self.base_dir / "data" / "state").mkdir(parents=True, exist_ok=True)

    def execute(
        self,
        command: str,
        timeout_seconds: int = 900,
        *,
        tool: str = "",
        step: int = 0,
        mode: str = "sequential",
        batch: int = 0,
        attempts: int = 1,
        command_source: str = "static",
        primary_command: str = "",
        fallback_used: bool = False,
    ) -> ExecutionResult:
        started = datetime.now(timezone.utc).isoformat()
        proc = subprocess.run(
            command,
            shell=True,
            cwd=self.base_dir,
            preexec_fn=os.setsid,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env={
                **os.environ,
                "SUDO_ASKPASS": "/bin/false",
                "DEBIAN_FRONTEND": "noninteractive",
            },
        )
        finished = datetime.now(timezone.utc).isoformat()

        stdout = (proc.stdout or "").strip()
        stderr = (proc.stderr or "").strip()

        summary = stdout.splitlines()[:8]
        output_summary = " | ".join(summary) if summary else (stderr.splitlines()[0] if stderr else "No output")
        errors = stderr if stderr else None

        return ExecutionResult(
            tool=tool,
            step=step,
            command=command,
            command_source=command_source,
            primary_command=primary_command or command,
            fallback_used=fallback_used,
            mode=mode,
            batch=batch,
            status="done" if proc.returncode == 0 else "failed",
            attempts=attempts,
            stdout=stdout,
            stderr=stderr,
            output_summary=output_summary,
            errors=errors,
            return_code=proc.returncode,
            started_at=started,
            finished_at=finished,
        )
