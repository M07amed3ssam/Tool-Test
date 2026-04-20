from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path

from app.db.database import SessionLocal
from app.recon.adaptive.feedback_loop import suggest_next_actions
from app.recon.input.classifier import classify_and_validate
from app.recon.input.tool_discovery import discover_tools
from app.recon.normalizer.merger import merge_parsed
from app.recon.normalizer.schema import FullData, now_iso
from app.recon.orchestrator.scheduler import run_plan
from app.recon.planner.ai_planner import plan_with_ai
from app.recon.planner.rules_engine import build_plan
from app.recon.reporting.ai_reporter import generate_ai_report
from app.recon.reporting.exporter import export_json, export_text
from app.recon.reporting.summary import generate_summary
from app.reports import models as report_models
from app.reports import utils as report_utils
from app.scans.engine import (
    available_tool_map,
    build_final_report_payload,
    build_nuclei_status,
    filter_plan,
    parse_outputs,
    resolve_orchestration,
)
from app.scans.models import ScanArtifact, ScanFinding, ScanJob, ScanLog, ScanStatus
from app.scans.utils import (
    DEFAULT_TOOL_NAMES,
    ensure_scan_workspace,
    guess_content_type,
    load_tools_inventory,
    load_wordlists_inventory,
    parse_iso_datetime,
    slugify_name,
    to_relative_posix,
)


class ScanExecutionManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._threads: dict[int, threading.Thread] = {}
        self._cancel_events: dict[int, threading.Event] = {}

    def start_job(self, scan_job_id: int) -> bool:
        with self._lock:
            thread = self._threads.get(scan_job_id)
            if thread and thread.is_alive():
                return False

            cancel_event = threading.Event()
            self._cancel_events[scan_job_id] = cancel_event
            worker = threading.Thread(
                target=self._run_job,
                args=(scan_job_id, cancel_event),
                name=f"scan-job-{scan_job_id}",
                daemon=True,
            )
            self._threads[scan_job_id] = worker
            worker.start()
            return True

    def cancel_job(self, scan_job_id: int) -> None:
        with self._lock:
            event = self._cancel_events.get(scan_job_id)
            if event is None:
                event = threading.Event()
                self._cancel_events[scan_job_id] = event
            event.set()

    def is_running(self, scan_job_id: int) -> bool:
        with self._lock:
            thread = self._threads.get(scan_job_id)
            return bool(thread and thread.is_alive())

    def _cleanup_job(self, scan_job_id: int) -> None:
        with self._lock:
            self._threads.pop(scan_job_id, None)
            self._cancel_events.pop(scan_job_id, None)

    def _run_job(self, scan_job_id: int, cancel_event: threading.Event) -> None:
        db = SessionLocal()
        try:
            _execute_scan_job(db=db, scan_job_id=scan_job_id, cancel_event=cancel_event)
        finally:
            db.close()
            self._cleanup_job(scan_job_id)


scan_execution_manager = ScanExecutionManager()


def _set_job_failed(db, scan_job: ScanJob, message: str) -> None:
    scan_job.status = ScanStatus.FAILED
    scan_job.error_message = message
    scan_job.progress = 100
    scan_job.finished_at = datetime.now(timezone.utc)
    db.commit()


def _resolve_final_status(results: list, current_status: ScanStatus) -> ScanStatus:
    status_values = [item.status for item in results]
    has_done = any(status == "done" for status in status_values)
    has_failed = any(status == "failed" for status in status_values)
    has_cancelled = any(status == "cancelled" for status in status_values)
    failed_tools = {
        str(getattr(item, "tool", "")).strip().lower()
        for item in results
        if getattr(item, "status", "") == "failed"
    }

    if current_status == ScanStatus.CANCELLING:
        return ScanStatus.CANCELLED

    if has_cancelled and not has_done and not has_failed:
        return ScanStatus.CANCELLED

    if has_failed and not has_done:
        if failed_tools and failed_tools.issubset({"amass"}):
            return ScanStatus.COMPLETED
        return ScanStatus.FAILED

    return ScanStatus.COMPLETED


def _to_scan_log(scan_job_id: int, result) -> ScanLog:
    return ScanLog(
        scan_job_id=scan_job_id,
        step=result.step,
        tool=result.tool,
        command=result.command,
        command_source=result.command_source,
        primary_command=result.primary_command,
        fallback_used=result.fallback_used,
        mode=result.mode,
        batch=result.batch,
        status=result.status,
        attempts=result.attempts,
        output_summary=result.output_summary,
        stdout=result.stdout,
        stderr=result.stderr,
        errors=result.errors,
        return_code=result.return_code,
        started_at=parse_iso_datetime(result.started_at),
        finished_at=parse_iso_datetime(result.finished_at),
    )


def _persist_artifacts(db, scan_job: ScanJob, run_root: Path) -> list[ScanArtifact]:
    db.query(ScanArtifact).filter(ScanArtifact.scan_job_id == scan_job.id).delete()
    db.commit()

    records: list[ScanArtifact] = []
    files: list[tuple[str, str, Path]] = []

    file_map = {
        "full_data": run_root / "Full_data.json",
        "final_report": run_root / "Final_report.json",
        "state_last_run": run_root / "data" / "state" / "last_run.json",
        "state_execution_results": run_root / "data" / "state" / "execution_results.json",
        "state_ai_report": run_root / "data" / "state" / "ai_report.json",
        "state_summary": run_root / "data" / "state" / "summary.txt",
        "state_llm_output": run_root / "data" / "state" / "llm_output.json",
        "raw_nuclei_status": run_root / "data" / "raw" / "nuclei_status.json",
    }

    for key, path in file_map.items():
        if path.exists() and path.is_file():
            files.append((key, "json" if path.suffix == ".json" else "text", path))

    raw_dir = run_root / "data" / "raw"
    if raw_dir.exists():
        for path in sorted(raw_dir.glob("*")):
            if not path.is_file():
                continue
            key = f"raw_{path.stem}"
            kind = "json" if path.suffix == ".json" else "raw"
            files.append((key, kind, path))

    for artifact_key, artifact_type, path in files:
        relative_path = to_relative_posix(path, run_root)
        record = ScanArtifact(
            scan_job_id=scan_job.id,
            artifact_key=artifact_key,
            artifact_type=artifact_type,
            file_name=path.name,
            file_path=relative_path,
            content_type=guess_content_type(path),
            size_bytes=path.stat().st_size,
        )
        db.add(record)
        records.append(record)

    db.commit()
    return records


def _persist_findings(db, scan_job_id: int, findings: list[dict]) -> int:
    db.query(ScanFinding).filter(ScanFinding.scan_job_id == scan_job_id).delete()
    db.commit()

    total = 0
    for finding in findings:
        record = ScanFinding(
            scan_job_id=scan_job_id,
            finding_id=str(finding.get("finding_id", ""))[:64],
            asset=str(finding.get("asset", "unknown"))[:512],
            source_tool=str(finding.get("source_tool", "unknown"))[:128],
            category=str(finding.get("category", "unknown"))[:64],
            severity=str(finding.get("severity", "info")).lower()[:16],
            status=str(finding.get("status", "new"))[:32],
            evidence=finding.get("evidence", {}),
            finding_timestamp=parse_iso_datetime(finding.get("timestamp")),
        )
        db.add(record)
        total += 1

    db.commit()
    return total


def _create_report_record(db, scan_job: ScanJob, run_root: Path, domain: str) -> int | None:
    source_final = run_root / "Final_report.json"
    source_full = run_root / "Full_data.json"
    if not source_final.exists() or not source_full.exists():
        return None

    report_name = f"{slugify_name(scan_job.scan_name)}-{scan_job.id}"
    file_paths = report_utils.copy_report_files(str(run_root), scan_job.user_id, report_name)
    report_record = report_models.Report(
        user_id=scan_job.user_id,
        report_name=report_name,
        domain=domain,
        final_file=file_paths["final_file"],
        full_file=file_paths["full_file"],
    )
    db.add(report_record)
    db.commit()
    db.refresh(report_record)
    return report_record.id


def _execute_scan_job(db, scan_job_id: int, cancel_event: threading.Event) -> None:
    scan_job = db.query(ScanJob).filter(ScanJob.id == scan_job_id).first()
    if not scan_job:
        return

    try:
        scan_job.status = ScanStatus.RUNNING
        scan_job.started_at = datetime.now(timezone.utc)
        scan_job.finished_at = None
        scan_job.error_message = None
        scan_job.progress = 0
        db.commit()

        run_root = ensure_scan_workspace(scan_job.user_id, scan_job.id)
        scan_job.artifacts_dir = str(run_root.resolve())
        db.commit()

        validation = classify_and_validate(scan_job.target)
        if not validation.valid:
            _set_job_failed(db, scan_job, "; ".join(validation.errors) or "Invalid target")
            return

        scan_job.target_type = validation.target_type
        db.commit()

        tools_payload = load_tools_inventory()
        wordlists_payload = load_wordlists_inventory()
        available_tools = available_tool_map(tools_payload)

        if not available_tools:
            discovered = discover_tools(DEFAULT_TOOL_NAMES)
            available_tools = {item["name"]: item.get("path", "") for item in discovered if item.get("available")}

        if scan_job.only_tools:
            only_tool_set = {item for item in scan_job.only_tools if isinstance(item, str) and item.strip()}
            available_tools = {name: path for name, path in available_tools.items() if name in only_tool_set}

        if not available_tools:
            _set_job_failed(db, scan_job, "No available recon tools after applying filters")
            return

        planner_warning = ""
        planner_source = "local"
        planner_llm_output: dict = {}
        decision_phases: dict = {}

        if scan_job.planner_engine == "ai":
            ai_plan = plan_with_ai(
                target=validation.normalized_target,
                target_type=validation.target_type,
                available_tools=available_tools,
                wordlists=wordlists_payload,
                completed_signatures=set(),
            )
            plan = ai_plan.get("steps", [])
            decision_phases = ai_plan.get("phases", {})
            planner_warning = ai_plan.get("warning", "")
            planner_source = ai_plan.get("llm_source", "fallback")
            planner_llm_output = ai_plan.get("llm_output", {})
        else:
            plan = build_plan(
                validation.normalized_target,
                validation.target_type,
                available_tools,
                wordlists_payload,
                set(),
            )

        plan = filter_plan(
            steps=plan,
            only_tools=scan_job.only_tools or [],
            max_steps=scan_job.max_steps,
        )

        if not plan:
            _set_job_failed(db, scan_job, "Planner returned an empty execution plan")
            return

        orchestration_mode, max_parallel = resolve_orchestration(
            requested_mode=scan_job.orchestration_mode,
            requested_max_parallel=scan_job.max_parallel,
            decision_phases=decision_phases,
        )
        scan_job.orchestration_mode = orchestration_mode
        scan_job.max_parallel = max_parallel
        db.commit()

        total_steps = len(plan)
        completed_steps = 0

        def _is_cancel_requested() -> bool:
            db.refresh(scan_job)
            return cancel_event.is_set() or scan_job.status in {ScanStatus.CANCELLING, ScanStatus.CANCELLED}

        def _on_result(result) -> None:
            nonlocal completed_steps
            completed_steps += 1
            log_entry = _to_scan_log(scan_job.id, result)
            db.add(log_entry)
            if total_steps > 0:
                scan_job.progress = min(99, int((completed_steps / total_steps) * 100))
            db.commit()

        results = run_plan(
            steps=plan,
            base_dir=run_root,
            execute=True,
            retries=scan_job.retries,
            backoff_seconds=scan_job.backoff,
            timeout_seconds=scan_job.timeout,
            orchestration_mode=orchestration_mode,
            max_parallel=max_parallel,
            result_callback=_on_result,
            cancel_requested=_is_cancel_requested,
        )

        nuclei_status = build_nuclei_status(run_root, plan, results, execute=True)
        export_json(run_root / "data" / "raw" / "nuclei_status.json", nuclei_status)

        parsed_outputs = parse_outputs(run_root)
        merged = merge_parsed(parsed_outputs)

        executed_tools = [step.tool for step in plan if step.status == "done"]
        next_actions = suggest_next_actions(merged.get("findings", []), executed_tools)

        execution_history = [res.to_dict() for res in results]
        summary_text = generate_summary(
            target=validation.normalized_target,
            findings=merged.get("findings", []),
            assets=merged.get("assets", []),
            errors=merged.get("errors", []),
        )

        full_data = FullData(
            target={
                "value": validation.normalized_target,
                "type": validation.target_type,
                "validated": validation.valid,
            },
            scan_metadata={
                "generated_at": now_iso(),
                "executed": True,
                "planner": "ai_decision_engine_v1" if scan_job.planner_engine == "ai" else "rules_engine_v1",
                "planner_source": planner_source,
                "planner_warning": planner_warning,
                "orchestration_mode": orchestration_mode,
                "max_parallel": max_parallel,
                "decision_phases": decision_phases,
                "tools_used": executed_tools,
                "tool_status": {
                    "nuclei": nuclei_status,
                },
            },
            assets=merged.get("assets", []),
            findings=merged.get("findings", []),
            errors=merged.get("errors", []),
            execution_history=execution_history,
        ).to_dict()

        ai_report = generate_ai_report(full_data)
        final_report = build_final_report_payload(full_data, ai_report)

        export_json(run_root / "Full_data.json", full_data)
        export_json(run_root / "Final_report.json", final_report)
        export_text(run_root / "data" / "state" / "summary.txt", summary_text)
        export_json(run_root / "data" / "state" / "ai_report.json", ai_report)

        if scan_job.planner_engine == "ai":
            export_json(
                run_root / "data" / "state" / "llm_output.json",
                {
                    "target": validation.normalized_target,
                    "target_type": validation.target_type,
                    "source": planner_source,
                    "warning": planner_warning,
                    "is_live_llm": bool(planner_llm_output.get("is_live_llm", False)),
                    "generated_at": planner_llm_output.get("generated_at", now_iso()),
                    "llm_output": planner_llm_output,
                },
            )

        runtime_payload = {
            "phase": "execution",
            "available_tools": sorted(list(available_tools.keys())),
            "target": {
                "value": validation.normalized_target,
                "type": validation.target_type,
            },
            "execution_options": {
                "planner_engine": scan_job.planner_engine,
                "orchestration_mode": orchestration_mode,
                "max_parallel": max_parallel,
                "max_steps": scan_job.max_steps,
                "only_tools": sorted(list(scan_job.only_tools or [])),
                "retries": scan_job.retries,
                "timeout": scan_job.timeout,
            },
            "planner": {
                "engine": scan_job.planner_engine,
                "source": planner_source,
                "warning": planner_warning,
                "decision_phases": decision_phases,
                "llm_output": planner_llm_output,
            },
            "tool_status": {
                "nuclei": nuclei_status,
            },
            "plan": [step.to_dict() for step in plan],
            "execution_log": [
                {
                    "step": res.step,
                    "tool": res.tool,
                    "command": res.command,
                    "command_source": getattr(res, "command_source", "static"),
                    "primary_command": getattr(res, "primary_command", res.command),
                    "fallback_used": getattr(res, "fallback_used", False),
                    "status": res.status,
                    "attempts": res.attempts,
                    "mode": res.mode,
                    "batch": res.batch,
                    "output_summary": res.output_summary,
                    "errors": res.errors,
                }
                for res in results
            ],
            "next_actions": next_actions,
        }
        export_json(run_root / "data" / "state" / "last_run.json", runtime_payload)

        findings_count = _persist_findings(db, scan_job.id, merged.get("findings", []))
        _persist_artifacts(db, scan_job, run_root)

        report_id = _create_report_record(
            db=db,
            scan_job=scan_job,
            run_root=run_root,
            domain=validation.normalized_target,
        )

        has_failed = any(item.status == "failed" for item in results)
        failed_tool_steps = [
            {
                "step": item.step,
                "tool": item.tool,
                "error": str(item.errors) if item.errors else None,
            }
            for item in results
            if item.status == "failed"
        ]
        final_status = _resolve_final_status(results, scan_job.status)

        error_messages = [str(item.errors) for item in results if item.errors]
        merged_errors = [str(item) for item in merged.get("errors", [])]
        combined_errors = error_messages + merged_errors

        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }
        for finding in merged.get("findings", []):
            severity = str(finding.get("severity", "info")).lower()
            if severity in severity_counts:
                severity_counts[severity] += 1

        scan_job.status = final_status
        scan_job.progress = 100
        scan_job.error_message = "; ".join(combined_errors[:3]) if combined_errors else None
        scan_job.finished_at = datetime.now(timezone.utc)
        scan_job.scan_summary = {
            "assets_count": len(merged.get("assets", [])),
            "findings_count": findings_count,
            "errors_count": len(combined_errors),
            "severity_counts": severity_counts,
            "next_actions": next_actions,
            "report_id": report_id,
            "has_partial_failures": has_failed,
            "failed_tool_steps": failed_tool_steps,
        }
        db.commit()

    except Exception as exc:  # noqa: BLE001
        _set_job_failed(db, scan_job, f"Scan execution failed: {exc}")
