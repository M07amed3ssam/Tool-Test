# AI-Orchestrated Recon Project Plan

## 1) Project Goal
Build an autonomous reconnaissance orchestration system that:
- Accepts an authorized target (domain, IP/CIDR, or application endpoint).
- Selects and runs only available recon tools.
- Normalizes all outputs into one unified JSON schema.
- Adapts next steps based on discovered assets.
- Produces clear reports and dashboard-ready data.

## 2) Scope and Constraints
- In-scope targets must be explicitly authorized.
- Tool usage must be verified before execution.
- No duplicate scans for already completed target-step pairs.
- Execution order follows: enum -> scan -> vulnerability checks.
- Errors are handled with retry/fallback logic.
- Final consolidated output file: `Full_data.json`.

## 3) Target Functional Requirements
- Input validation for domain/IP/application.
- Dynamic planning engine (rules-first, AI-assisted optional).
- Execution orchestrator (sequential and parallel modes).
- Output normalization pipeline (tool output -> common schema).
- Adaptive loop to discover and enqueue new assets.
- Reporting layer with summary, findings, risk scoring.

## 4) Proposed System Architecture
- Input Module
  - Validates target format.
  - Classifies target type.

- Decision Engine
  - Maps target type to tool chain.
  - Chooses parameters and fallback tools.

- Orchestrator
  - Runs commands.
  - Captures stdout/stderr, exit codes, timing.
  - Tracks completed tasks to avoid duplication.

- Normalizer
  - Converts each tool output to standard JSON objects.
  - Merges into one data model.

- Adaptive Planner
  - Detects newly discovered assets.
  - Appends follow-up tasks without repeating old work.

- Reporter
  - Generates final JSON and human-readable summary.

## 5) Suggested Repository Structure
```
recon-agent/
  README.md
  config/
    tools.yaml
    workflow.yaml
  data/
    raw/
    normalized/
    state/
  src/
    input/
      validator.py
      classifier.py
    planner/
      rules_engine.py
      ai_planner.py
    orchestrator/
      executor.py
      scheduler.py
      retry_handler.py
    parsers/
      nmap_parser.py
      masscan_parser.py
      subfinder_parser.py
      amass_parser.py
      nuclei_parser.py
      ffuf_parser.py
      gobuster_parser.py
    normalizer/
      schema.py
      merger.py
    adaptive/
      feedback_loop.py
    reporting/
      summary.py
      risk_scoring.py
      exporter.py
    main.py
  tests/
  Full_data.json
```

## 6) Unified Data Schema (Core)
Each finding should include:
- `finding_id`
- `asset` (domain/ip/url)
- `source_tool`
- `category` (subdomain/port/service/vuln/path)
- `evidence`
- `severity` (info/low/medium/high/critical)
- `timestamp`
- `status` (new/confirmed/ignored)

Top-level structure:
- `target`
- `scan_metadata`
- `assets`
- `findings`
- `errors`
- `execution_history`

## 7) Workflow Plan by Phase

### Phase 1: Foundation (Week 1)
- Define schema and config format.
- Implement input validation and target classification.
- Add tool discovery (`command -v`) and capability map.

Deliverables:
- Input module complete.
- Tool availability checker complete.
- Initial schema draft complete.

### Phase 2: Rule-Based Planning (Week 2)
- Implement deterministic planning rules:
  - Domain: subfinder/amass -> nmap -> nuclei -> ffuf/gobuster.
  - IP/CIDR: masscan -> nmap -> nuclei (if web services found).
- Add dedup keys per step (target + tool + params hash).

Deliverables:
- Planner returns ordered executable steps.
- Dedup logic integrated.

### Phase 3: Execution Engine (Week 3)
- Implement command runner with timeout/retry.
- Save raw outputs per tool.
- Add fallback behavior when tool fails.

Deliverables:
- Orchestrator with robust error handling.
- Raw output persistence and execution logs.

### Phase 4: Parsing + Normalization (Week 4)
- Build parsers for all available tools.
- Map parsed output into unified schema.
- Merge and resolve duplicates.

Deliverables:
- Normalizer pipeline.
- First complete `Full_data.json` generation.

### Phase 5: Adaptive Feedback Loop (Week 5)
- Detect new assets (subdomains, open ports, live hosts, paths).
- Queue only new follow-up steps.
- Stop conditions for convergence.

Deliverables:
- Adaptive planner integrated with orchestrator.
- Proven non-duplicative iterative scan cycle.

### Phase 6: Reporting and QA (Week 6)
- Generate summary and risk scoring.
- Export JSON + optional HTML/PDF summary.
- Add tests for parser correctness and planning logic.

Deliverables:
- Final reporting output.
- Test coverage for critical paths.

## 8) Toolchain Strategy (Installed Tools)
Verified recon tools:
- nmap
- masscan
- subfinder
- amass
- nuclei
- ffuf
- gobuster

Execution strategy by target type:
- Domain:
  1. `subfinder`, `amass` (enumeration)
  2. `nmap` (service fingerprinting on resolved hosts)
  3. `nuclei` (template-based vulnerability checks)
  4. `ffuf`/`gobuster` (web content discovery)

- IP/CIDR:
  1. `masscan` (fast port discovery)
  2. `nmap` (deep service scan on discovered ports)
  3. `nuclei` (where HTTP/HTTPS services are detected)

## 9) Error Handling and Fallback Rules
- If one enum tool fails, continue with other enum tool.
- If mass scan fails, fallback directly to targeted nmap on known hosts.
- If parser fails for one tool, keep raw output and mark parser error.
- Retry policy: max 2 retries with backoff for transient failures.

## 10) Success Criteria
- End-to-end run completes without manual intervention.
- No duplicated execution for identical step keys.
- `Full_data.json` always generated, even with partial failures.
- New discoveries trigger adaptive follow-up steps.
- Report clearly summarizes findings and risk levels.

## 11) Immediate Next Implementation Tasks
1. Create the code skeleton folders/files from this plan.
2. Implement `tool_discovery` and `input_validator` first.
3. Define JSON schema and write one parser (`nmap`) as template.
4. Build planner rules for domain and IP workflows.
5. Integrate orchestrator with logging and retries.
