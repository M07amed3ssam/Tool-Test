# Recon Agent

Autonomous, rule-based recon orchestration project for authorized targets.

## Features
- Target validation and classification (domain/IP/CIDR/application URL)
- Tool discovery from local host
- Rule-based plan generation using only installed tools
- AI decision engine with phase-based planning (target analysis, tool selection, parameter optimization)
- Sequential or parallel execution with retry handling
- Parsing and normalization into unified JSON
- Adaptive suggestions for next scan steps
- JSON and text reporting

## Safety
Use this project only on assets you are explicitly authorized to test.

## Quick Start
1. Ensure these files exist in the workspace root:
   - `available_tools.json`
   - `available_wordlists.json`
2. Run planner only (no scan execution):

```bash
python src/main.py --target example.com
```

3. Run and execute plan:

```bash
python src/main.py --target example.com --execute --ack-authorized
```

## Safer Scoped Execution
Run only selected tools and limit the number of steps:

```bash
python src/main.py \
   --target example.com \
   --execute \
   --ack-authorized \
   --only-tools subfinder,amass \
   --max-steps 2 \
   --timeout 180
```

### Useful Flags
- `--ack-authorized`: required for command execution mode.
- `--only-tools`: comma-separated tool allowlist.
- `--max-steps`: limits planned/executed steps.
- `--orchestration-mode`: `auto`, `sequential`, or `parallel`.
- `--max-parallel`: max concurrent tools in parallel mode.
- `--ignore-completed`: force re-running steps even if they were previously marked completed.
- `--timeout`: timeout per command in seconds.
- `--retries` and `--backoff`: retry control for failed steps.
- `--planner-engine`: `rules` (default) or `ai`.

## AI Planner Providers
The AI planner can use HuggingFace Router, Google AI (Gemini), and local Ollama models.

1. Install dependencies:

```bash
pip install openai
pip install google-genai
```

2. Create a local `.env` file in `recon-agent/`:

```bash
HF_TOKEN="your_hf_token"
HF_MODEL="deepseek-ai/DeepSeek-R1:novita"
HF_TIMEOUT="45"
GOOGLE_API_KEY="your_google_api_key"
GOOGLE_MODEL="gemini-3-flash-preview"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="deepseek-r1:8b"
OLLAMA_NUM_CTX="4096"
OLLAMA_NUM_PREDICT="256"
OLLAMA_MAX_NUM_PREDICT="4096"
OLLAMA_JSON_RETRIES="2"
OLLAMA_TIMEOUT="120"
OLLAMA_STREAM="true"
OLLAMA_RESPONSE_FORMAT="json_schema"
AI_PROVIDER="auto"
```

Provider selection behavior:
- `AI_PROVIDER=auto`: try HuggingFace, then Google AI, then Ollama.
- `AI_PROVIDER=huggingface`: prefer HuggingFace, then Google, then Ollama fallback.
- `AI_PROVIDER=google`: prefer Google, then HuggingFace, then Ollama fallback.
- `AI_PROVIDER=ollama`: prefer local Ollama first.

3. Run with AI planner:

```bash
python src/main.py --target example.com --planner-engine ai
```

If token/network/model is unavailable, the planner automatically falls back to local deterministic decisions and records a warning in `data/state/last_run.json`.

## Hybrid Command Mode
- AI selects phases/tools/optimization as before.
- AI can optionally suggest per-tool command overrides.
- Runtime executes AI command first when available, and automatically falls back to the static safe command template if AI command fails.
- Execution metadata includes `command_source`, `primary_command`, and `fallback_used` in `data/state/execution_results.json`.

## Output
- `Full_data.json`
- `data/state/last_run.json`
- `data/state/execution_results.json` (unified execution/orchestration results with stdout/stderr)
- `data/state/llm_output.json` (AI planner raw/parsed LLM response JSON)
- `data/state/ai_report.json` (AI-ready reporting JSON: summary, findings, risk scores, visualization recommendations)
- `data/state/summary.txt`
- `data/raw/nuclei_status.json` (explicit nuclei run state, including `completed_no_matches`)
