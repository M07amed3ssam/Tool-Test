# Recon-Agent Work Analysis

## Purpose
This document explains how recon-agent works in this workspace, what AI actually does, how tools are executed, how reports are generated, what model is used, whether output matches Final_report.json, execution mode (sequential/parallel), and key limitations.

## 1) High-Level Flow
Main runtime flow in the app:

1. Validate/classify target (domain, IP/CIDR, application URL).
2. Build plan using `rules` or `ai` planner.
3. Resolve orchestration mode (`auto`, `sequential`, `parallel`).
4. Execute tools with retries/timeouts.
5. Parse raw outputs.
6. Merge into normalized `Full_data.json`.
7. Generate deterministic `ai_report.json`.
8. Build dashboard `Final_report.json` from `full_data + ai_report`.

Code references:
- `app/scans/runner.py`
- `app/scans/engine.py`
- `app/recon/planner/rules_engine.py`
- `app/recon/planner/ai_planner.py`
- `app/recon/orchestrator/scheduler.py`

## 2) AI Role in Recon-Agent
AI is primarily used for **planning**, not direct vulnerability reasoning in final report text.

AI planner responsibilities:
- Analyze target type context.
- Select recon tools.
- Optimize parameters.
- Optionally generate per-tool command overrides.
- Suggest orchestration settings.

If provider/model fails, planner falls back to deterministic local policy.

Code references:
- `app/recon/planner/ai_planner.py` (`plan_with_ai`, `_llm_decisions`, `_fallback_decisions`)

## 3) Tool Execution: Static or AI-Based?
Execution is **hybrid**:

- Rules planner -> static commands.
- AI planner -> may set `command_source = "ai"` for a step.
- Runtime validates and executes AI command when safe.
- If AI command fails or soft-fails, runtime falls back to static command.

So the system is not fully autonomous command execution; it keeps static safety fallback behavior.

Code references:
- `app/recon/planner/rules_engine.py`
- `app/recon/planner/ai_planner.py` (`_sanitize_ai_command`, `_pick_step_command`, `_enforce_domain_scope_for_tool`)
- `app/recon/orchestrator/scheduler.py` (`has_hybrid_fallback`, soft-failure fallback)

## 4) Report Generation: Static or AI-Based?
Current report generation is **deterministic/static logic**.

- `generate_ai_report()` computes risk scores, summary, and chart recommendations using code rules.
- `build_reporting_prompt()` is now exported to a runtime artifact for traceability (not executed by an LLM by default).
- Dashboard `Final_report.json` is built by a static mapping in scan engine, now emitting richer vulnerability objects.

Code references:
- `app/recon/reporting/ai_reporter.py`
- `app/scans/runner.py`
- `app/scans/engine.py` (`build_final_report_payload`)

## 5) Which AI Model Is Used?
Model/provider are environment-driven and runtime-dependent.

Configured in this project (`Final test/.env`):
- `AI_PROVIDER="auto"`
- `GOOGLE_MODEL="gemini-3-flash-preview"`
- HF and Ollama settings are present but commented in this env file.

Provider order in `auto` mode:
1. `huggingface_router`
2. `google_ai`
3. `ollama`

Actual model can differ per run:
- Some runs use live model.
- Some runs show fallback with `is_live_llm = false` when provider/network/credits fail.

Where to verify per run:
- `app/data/scans/<user>/<scan_id>/data/state/llm_output.json`
- `app/data/scans/<user>/<scan_id>/data/state/last_run.json`
- `app/data/scans/<user>/<scan_id>/data/state/reporting_prompt.txt`

Code references:
- `app/recon/planner/ai_planner.py` (`_provider_order`, `_run_huggingface`, `_run_google`, `_run_ollama`)

## 6) Final Report View (Dashboard)
Data flow for the final report page:

1. Frontend calls `getFinalReport(reportId)`.
2. Backend route `/reports/{report_id}/final` resolves report path.
3. Backend reads `Final_report.json` from `app/data/reports/<user_id>/<report_name>/Final_report.json`.
4. Frontend renders summary + severity sections.

Code references:
- `security-dashboard/src/services/reportService.js`
- `app/reports/routes.py`
- `app/reports/utils.py`
- `security-dashboard/src/pages/FinalReport.jsx`

## 7) Does Current Generator Match Your Final_report.json?
Target file you asked about:
- `security-dashboard/public/data/reports/1/test/Final_report.json`

Verdict: **Mostly matches (richer fields now emitted), with some heuristic gaps.**

What matches:
- Top-level structure keys exist in both, such as:
  - `metadata`
  - `summary.counts`
  - severity buckets (`critical_severity_vulnerabilities`, etc.)
  - `subdomains`, `ports`, `recommendations`

What may still differ:
- Some rich fields are heuristically inferred from raw evidence (for example: `cve`, `mitre_link`, `impact`).
- Parser outputs are still mostly raw lines, so descriptive fields can be generic when evidence is sparse.
- Port objects now include `host`, `ip`, `protocol`, `service`, but host resolution is limited by the raw scan source.

Practical UI implication:
- `FinalReport.jsx` expects fields such as `affected_hosts`, `description`, `impact`, and `remediation`.
- The new builder emits these fields, so the dashboard should show populated details for vulnerability findings.

## 8) Sequential or Parallel?
Both are supported.

- Requested mode can be set by user (`sequential` or `parallel`).
- If `auto`, resolver can use planner decision phase.
- Parallel execution is **staged by tool category**, not fully free-form all-at-once.

Stage grouping logic:
- Stage 1: `subfinder`, `amass`
- Stage 2: `nmap`, `masscan`
- Stage 3: `ffuf`, `gobuster`
- Stage 4: `nuclei`

Code references:
- `app/scans/engine.py` (`resolve_orchestration`)
- `app/recon/orchestrator/scheduler.py` (`_tool_stage`, `_parallel_batches`, `run_plan`)

## 9) Key Limitations
1. LLM availability dependency
- AI planning may fall back due API/network/credit issues.

2. Heuristic enrichment limits
- CVE extraction, impact, and remediation are inferred from limited raw evidence when parsers do not provide structured data.

3. Counting semantics
- `vulnerabilities_total` now counts vulnerability-like findings only, not all recon findings.

4. Parser richness limits
- Nuclei parser stores mostly raw line evidence.
- Nmap/ffuf categories often default to informational severities.

5. Staged parallelism tradeoff
- Improves safety/dependency order, but can delay downstream stages.

## 10) Direct Answers to Your Questions
- How recon-agent works: hybrid deterministic scan pipeline with optional AI planning layer.
- AI role: planning/orchestration/command optimization, with fallback.
- Tools static or AI-based: hybrid; static commands always available as fallback.
- Report generation static or AI: static deterministic code logic; reporting prompt is exported for traceability.
- Which AI model is used: env/provider-order controlled; actual run model is in `llm_output.json`.
- Final report view: frontend -> `/reports/{id}/final` -> file read from `app/data/reports/.../Final_report.json`.
- Match with your `Final_report.json`: mostly yes (shape + rich vulnerability fields), with some heuristics.
- Sequential or parallel: both; parallel is staged.
- Limitations: provider fallback, heuristic enrichment, parser simplification, staged execution tradeoffs.

---

## Suggested Follow-Up
If you want, I can next add parser enhancements (nuclei JSON, nmap script parsing) so `cve`, `references`, and `affected_hosts` become fully structured rather than heuristic.
