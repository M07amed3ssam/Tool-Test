from __future__ import annotations

import argparse
import json
from pathlib import Path

from .adaptive.feedback_loop import suggest_next_actions
from .input.classifier import classify_and_validate
from .normalizer.merger import merge_parsed
from .normalizer.schema import FullData, now_iso
from .orchestrator.scheduler import run_plan
from .planner.ai_planner import plan_with_ai
from .planner.rules_engine import build_plan
from .reporting.exporter import export_json, export_text
from .reporting.ai_reporter import generate_ai_report
from .reporting.summary import generate_summary

from .parsers import (
    amass_parser,
    ffuf_parser,
    gobuster_parser,
    masscan_parser,
    nmap_parser,
    nuclei_parser,
    subfinder_parser,
)


def _line_count(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip())


def _build_nuclei_status(project_root: Path, plan: list, results: list, execute: bool) -> dict:
    nuclei_in_plan = any(step.tool == "nuclei" for step in plan)
    nuclei_result = next((res for res in results if "nuclei " in res.command), None) if execute else None
    findings_path = project_root / "data" / "raw" / "nuclei.txt"
    existing_findings_count = _line_count(findings_path)
    findings_count = existing_findings_count if (nuclei_in_plan or nuclei_result is not None) else 0

    status = {
        "planned": nuclei_in_plan,
        "executed": execute and nuclei_result is not None,
        "findings_file": "data/raw/nuclei.txt",
        "findings_count": findings_count,
        "stale_previous_findings_count": existing_findings_count if findings_count == 0 else 0,
        "state": "not_planned",
        "message": "Nuclei was not part of this run plan.",
        "return_code": None,
        "summary": "",
        "errors": None,
    }

    if nuclei_in_plan and not execute:
        status["state"] = "planned_not_executed"
        status["message"] = "Nuclei step was planned but not executed (dry run mode)."

    if execute and nuclei_result is not None:
        status["return_code"] = nuclei_result.return_code
        status["summary"] = nuclei_result.output_summary
        status["errors"] = nuclei_result.errors

        if nuclei_result.return_code != 0:
            status["state"] = "failed"
            status["message"] = "Nuclei execution failed. Check errors for details."
        elif findings_count == 0:
            status["state"] = "completed_no_matches"
            status["message"] = "Nuclei completed successfully with zero matches. Empty findings file is expected."
        else:
            status["state"] = "completed_with_matches"
            status["message"] = "Nuclei completed successfully and wrote findings."

    return status


def _parse_csv_set(value: str) -> set[str]:
    if not value.strip():
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


def _filter_plan(steps: list, only_tools: set[str], max_steps: int) -> list:
    filtered = [step for step in steps if not only_tools or step.tool in only_tools]
    if max_steps > 0:
        filtered = filtered[:max_steps]

    for idx, step in enumerate(filtered, start=1):
        step.step = idx
    return filtered


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _available_tool_map(payload: dict) -> dict[str, str]:
    tools = {}
    for item in payload.get("tools", []):
        if item.get("available"):
            tools[str(item.get("name"))] = str(item.get("path", ""))
    return tools


def _load_completed_signatures(project_root: Path) -> set[str]:
    state_path = project_root / "data" / "state" / "completed_steps.json"
    if not state_path.exists():
        return set()
    try:
        data = json.loads(state_path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return set(str(x) for x in data)
    except json.JSONDecodeError:
        pass
    return set()


def _resolve_orchestration(args, decision_phases: dict) -> tuple[str, int]:
    phase = decision_phases.get("execution_orchestration", {}) if isinstance(decision_phases, dict) else {}
    ai_mode = str(phase.get("mode", "")).strip().lower()

    try:
        ai_max_parallel = int(str(phase.get("max_parallel", "2")).strip())
    except ValueError:
        ai_max_parallel = 2

    if args.orchestration_mode in {"sequential", "parallel"}:
        mode = args.orchestration_mode
    elif ai_mode in {"sequential", "parallel"}:
        mode = ai_mode
    else:
        mode = "sequential"

    if args.max_parallel > 0:
        max_parallel = args.max_parallel
    else:
        max_parallel = ai_max_parallel

    max_parallel = max(1, min(8, max_parallel))
    if mode == "sequential":
        max_parallel = 1

    return mode, max_parallel


def _parse_outputs(project_root: Path) -> list[dict]:
    parser_map = [
        (project_root / "data" / "raw" / "subfinder.txt", subfinder_parser.parse),
        (project_root / "data" / "raw" / "amass.txt", amass_parser.parse),
        (project_root / "data" / "raw" / "masscan.txt", masscan_parser.parse),
        (project_root / "data" / "raw" / "nmap.xml", nmap_parser.parse),
        (project_root / "data" / "raw" / "nuclei.txt", nuclei_parser.parse),
        (project_root / "data" / "raw" / "ffuf.json", ffuf_parser.parse),
        (project_root / "data" / "raw" / "gobuster.txt", gobuster_parser.parse),
    ]

    parsed: list[dict] = []
    for file_path, parser in parser_map:
        if file_path.exists():
            parsed.append(parser(file_path))
    return parsed


def main() -> int:
    here = Path(__file__).resolve()
    project_root = here.parents[1]
    workspace_root = here.parents[2]

    parser = argparse.ArgumentParser(description="Rule-based recon orchestrator")
    parser.add_argument("--target", required=True, help="Authorized target (domain, IP/CIDR, URL)")
    parser.add_argument("--execute", action="store_true", help="Execute planned commands")
    parser.add_argument(
        "--ack-authorized",
        action="store_true",
        help="Acknowledge that you are authorized to test the provided target",
    )
    parser.add_argument(
        "--available-tools",
        default=str(workspace_root / "available_tools.json"),
        help="Path to tools inventory JSON",
    )
    parser.add_argument(
        "--available-wordlists",
        default=str(workspace_root / "available_wordlists.json"),
        help="Path to wordlists inventory JSON",
    )
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--backoff", type=int, default=2)
    parser.add_argument("--timeout", type=int, default=9000)
    parser.add_argument(
        "--only-tools",
        default="",
        help="Comma-separated allowlist of tools to include in this run",
    )
    parser.add_argument(
        "--max-steps",
        type=int,
        default=0,
        help="Max number of plan steps to execute (0 means all)",
    )
    parser.add_argument(
        "--planner-engine",
        choices=["rules", "ai"],
        default="rules",
        help="Decision engine for plan generation",
    )
    parser.add_argument(
        "--orchestration-mode",
        choices=["auto", "sequential", "parallel"],
        default="auto",
        help="Execution orchestration mode (auto uses AI phase when available)",
    )
    parser.add_argument(
        "--max-parallel",
        type=int,
        default=0,
        help="Maximum concurrent tools when parallel mode is active (0 = auto)",
    )
    parser.add_argument(
        "--ignore-completed",
        action="store_true",
        help="Ignore completed step signatures and rebuild full plan",
    )
    args = parser.parse_args()

    if args.execute and not args.ack_authorized:
        payload = {
            "phase": "result",
            "available_tools": [],
            "plan": [],
            "execution_log": [],
            "next_actions": ["Re-run with --ack-authorized if you are approved to test this target"],
            "errors": ["Execution requires explicit authorization acknowledgement"],
        }
        print(json.dumps(payload, indent=2))
        return 1

    validation = classify_and_validate(args.target)
    if not validation.valid:
        payload = {
            "phase": "result",
            "available_tools": [],
            "plan": [],
            "execution_log": [],
            "next_actions": ["Fix invalid target input"],
            "errors": validation.errors,
        }
        print(json.dumps(payload, indent=2))
        return 1

    tools_payload = _load_json(Path(args.available_tools))
    wordlists_payload = _load_json(Path(args.available_wordlists))
    available_tools = _available_tool_map(tools_payload)

    selected_tools = _parse_csv_set(args.only_tools)
    if selected_tools:
        available_tools = {k: v for k, v in available_tools.items() if k in selected_tools}

    if not available_tools:
        payload = {
            "phase": "result",
            "available_tools": [],
            "plan": [],
            "execution_log": [],
            "next_actions": ["Adjust --only-tools or refresh available_tools.json"],
            "errors": ["No tools available after filtering"],
        }
        print(json.dumps(payload, indent=2))
        return 1

    completed = set() if args.ignore_completed else _load_completed_signatures(project_root)
    decision_phases: dict = {}
    planner_warning = ""
    planner_source = "local"
    planner_llm_output: dict = {}

    if args.planner_engine == "ai":
        ai_plan = plan_with_ai(
            target=validation.normalized_target,
            target_type=validation.target_type,
            available_tools=available_tools,
            wordlists=wordlists_payload,
            completed_signatures=completed,
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
            completed,
        )
    plan = _filter_plan(plan, selected_tools, args.max_steps)
    orchestration_mode, max_parallel = _resolve_orchestration(args, decision_phases)

    results = run_plan(
        steps=plan,
        base_dir=project_root,
        execute=args.execute,
        retries=args.retries,
        backoff_seconds=args.backoff,
        timeout_seconds=args.timeout,
        orchestration_mode=orchestration_mode,
        max_parallel=max_parallel,
    )

    nuclei_status = _build_nuclei_status(project_root, plan, results, args.execute)
    export_json(project_root / "data" / "raw" / "nuclei_status.json", nuclei_status)

    parsed_outputs = _parse_outputs(project_root)
    merged = merge_parsed(parsed_outputs)

    executed_tools = [step.tool for step in plan if step.status == "done"]
    next_actions = suggest_next_actions(merged["findings"], executed_tools)

    execution_history = [res.to_dict() for res in results]
    summary_text = generate_summary(
        target=validation.normalized_target,
        findings=merged["findings"],
        assets=merged["assets"],
        errors=merged["errors"],
    )

    full_data = FullData(
        target={
            "value": validation.normalized_target,
            "type": validation.target_type,
            "validated": validation.valid,
        },
        scan_metadata={
            "generated_at": now_iso(),
            "executed": args.execute,
            "planner": "ai_decision_engine_v1" if args.planner_engine == "ai" else "rules_engine_v1",
            "planner_source": planner_source,
            "planner_warning": planner_warning,
            "orchestration_mode": orchestration_mode,
            "max_parallel": max_parallel,
            "ignore_completed": args.ignore_completed,
            "decision_phases": decision_phases,
            "tools_used": executed_tools,
            "tool_status": {
                "nuclei": nuclei_status,
            },
        },
        assets=merged["assets"],
        findings=merged["findings"],
        errors=merged["errors"],
        execution_history=execution_history,
    ).to_dict()

    export_json(project_root / "Full_data.json", full_data)
    export_text(project_root / "data" / "state" / "summary.txt", summary_text)
    export_json(project_root / "data" / "state" / "ai_report.json", generate_ai_report(full_data))

    if args.planner_engine == "ai":
        export_json(
            project_root / "data" / "state" / "llm_output.json",
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
        "phase": "execution" if args.execute else "planning",
        "available_tools": sorted(list(available_tools.keys())),
        "target": {
            "value": validation.normalized_target,
            "type": validation.target_type,
        },
        "execution_options": {
            "execute": args.execute,
            "max_steps": args.max_steps,
            "only_tools": sorted(list(selected_tools)),
            "planner_engine": args.planner_engine,
            "orchestration_mode": orchestration_mode,
            "max_parallel": max_parallel,
            "ignore_completed": args.ignore_completed,
            "retries": args.retries,
            "timeout": args.timeout,
        },
        "planner": {
            "engine": args.planner_engine,
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
        "execution_results_path": "data/state/execution_results.json",
        "ai_report_path": "data/state/ai_report.json",
        "next_actions": next_actions,
    }

    export_json(project_root / "data" / "state" / "last_run.json", runtime_payload)
    print(json.dumps(runtime_payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
