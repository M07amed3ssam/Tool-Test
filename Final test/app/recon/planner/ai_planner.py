from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from hashlib import sha256
import importlib
import json
import os
from pathlib import Path
from urllib import error as urlerror
from urllib.parse import urlparse
from urllib import request as urlrequest

try:
    OpenAI = getattr(importlib.import_module("openai"), "OpenAI", None)
except Exception:  # noqa: BLE001
    OpenAI = None

try:
    google_pkg = importlib.import_module("google")
    GoogleGenAI = getattr(google_pkg, "genai", None)
    if GoogleGenAI is None:
        GoogleGenAI = importlib.import_module("google.genai")
except Exception:  # noqa: BLE001
    GoogleGenAI = None


@dataclass
class PlanStep:
    step: int
    tool: str
    command: str
    command_source: str = "static"
    fallback_command: str = ""
    static_command: str = ""
    status: str = "pending"
    reason: str = ""
    signature: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def _sig(tool: str, command: str) -> str:
    return sha256(f"{tool}|{command}".encode("utf-8")).hexdigest()


def _pick_wordlist(wordlists: dict, key: str, fallback: str) -> str:
    items = wordlists.get("recommended_for_recon", {}).get(key, [])
    return items[0] if items else fallback


def _add_step(
    steps: list[PlanStep],
    tool: str,
    command: str,
    reason: str,
    completed_signatures: set[str],
    *,
    command_source: str = "static",
    fallback_command: str = "",
    signature_command: str | None = None,
) -> None:
    canonical_command = signature_command if signature_command else command
    signature = _sig(tool, canonical_command)
    if signature in completed_signatures:
        return
    steps.append(
        PlanStep(
            step=len(steps) + 1,
            tool=tool,
            command=command,
            command_source=command_source,
            fallback_command=fallback_command,
            static_command=canonical_command,
            status="pending",
            reason=reason,
            signature=signature,
        )
    )


def _extract_json_object(text: str) -> dict:
    payload = text.strip()
    if payload.startswith("```"):
        lines = payload.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        payload = "\n".join(lines)

    start = payload.find("{")
    end = payload.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in LLM response")

    return json.loads(payload[start : end + 1])


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if value and ((value[0] == '"' and value[-1] == '"') or (value[0] == "'" and value[-1] == "'")):
            value = value[1:-1]

        if key and key not in os.environ:
            os.environ[key] = value


def _preferred_order(target_type: str) -> list[str]:
    if target_type == "domain":
        # Domain -> Subdomain Enum -> Port Scan -> Vuln Scan (+ web content discovery)
        return ["subfinder", "amass", "nmap", "nuclei", "ffuf", "gobuster"]
    if target_type == "ip":
        # IP -> Nmap -> Masscan -> Vulnerability Check
        return ["nmap", "masscan", "nuclei"]
    if target_type == "application":
        return ["nuclei", "ffuf", "gobuster"]
    return []


def _normalize_selected_tools(
    target_type: str,
    selected_tools: list[str],
    available_tools: dict[str, str],
) -> list[str]:
    order = _preferred_order(target_type)
    allowed = set(available_tools.keys())
    selected_set = {tool for tool in selected_tools if tool in allowed}

    # If LLM returns empty or invalid selection, fallback to full valid flow from available tools.
    if not selected_set:
        return [tool for tool in order if tool in allowed]

    # Enforce minimal flow completeness by target type when tools are available.
    if target_type == "domain":
        if "subfinder" in allowed:
            selected_set.add("subfinder")
        elif "amass" in allowed:
            selected_set.add("amass")
        if "nmap" in allowed:
            selected_set.add("nmap")
        if "nuclei" in allowed:
            selected_set.add("nuclei")
        if "ffuf" in allowed:
            selected_set.add("ffuf")
        if "gobuster" in allowed:
            selected_set.add("gobuster")
    elif target_type == "ip":
        for tool in ("nmap", "masscan", "nuclei"):
            if tool in allowed:
                selected_set.add(tool)
    elif target_type == "application":
        for tool in ("nuclei", "ffuf"):
            if tool in allowed:
                selected_set.add(tool)

    return [tool for tool in order if tool in selected_set]


def _coerce_int(value: object, default: int, low: int, high: int) -> int:
    try:
        parsed = int(str(value).strip())
    except Exception:  # noqa: BLE001
        return default
    return max(low, min(high, parsed))


def _coerce_nmap_timing(value: object, default: str) -> str:
    timing = str(value).strip()
    if timing in {"-T0", "-T1", "-T2", "-T3", "-T4", "-T5"}:
        return timing
    return default


def _coerce_execution_mode(value: object, default: str = "sequential") -> str:
    mode = str(value).strip().lower()
    if mode in {"sequential", "parallel"}:
        return mode
    return default


def _provider_order() -> list[str]:
    configured = os.environ.get("AI_PROVIDER", "auto").strip().lower()
    mapping = {
        "huggingface": "huggingface_router",
        "huggingface_router": "huggingface_router",
        "hf": "huggingface_router",
        "google": "google_ai",
        "google_ai": "google_ai",
        "gemini": "google_ai",
        "ollama": "ollama",
        "local": "ollama",
    }

    if configured in {"", "auto"}:
        return ["huggingface_router", "google_ai", "ollama"]

    ordered: list[str] = []
    for item in [part.strip() for part in configured.split(",") if part.strip()]:
        resolved = mapping.get(item)
        if resolved and resolved not in ordered:
            ordered.append(resolved)

    if not ordered:
        return ["huggingface_router", "google_ai", "ollama"]

    for provider in ["huggingface_router", "google_ai", "ollama"]:
        if provider not in ordered:
            ordered.append(provider)
    return ordered


def _required_output_artifacts() -> dict[str, list[str]]:
    return {
        "subfinder": ["data/raw/subfinder.txt"],
        "amass": ["data/raw/amass.txt"],
        "masscan": ["data/raw/masscan.txt"],
        "nmap": ["data/raw/nmap.txt", "data/raw/nmap.xml"],
        "nuclei": ["data/raw/nuclei.txt"],
        "ffuf": ["data/raw/ffuf.json"],
        "gobuster": ["data/raw/gobuster.txt"],
    }


def _build_selection_prompt(target: str, target_type: str, available_tools: dict[str, str], web_wordlist: str) -> str:
    return (
        "You are a recon decision engine. Return only JSON for phase-1 tool selection. "
        "Hard constraints: for domain use flow Domain -> Subdomain Enum -> Port Scan -> Vuln Scan. "
        "For IP use flow IP -> Nmap -> Masscan -> Vulnerability Check. "
        "Keep selected_tools subset of available_tools. "
        "Do not generate commands in this phase. "
        "JSON schema: {"
        "\"analyze_target_type\":{\"agent\":\"analyze_target_type\",\"target_type\":\"...\",\"confidence\":0..1,\"reason\":\"...\"},"
        "\"select_recon_tools\":{\"agent\":\"select_recon_tools\",\"strategy\":\"...\",\"selected_tools\":[\"...\"]},"
        "\"execution_orchestration\":{\"agent\":\"orchestrator\",\"mode\":\"sequential|parallel\",\"max_parallel\":number,\"reason\":\"...\"}"
        "}. "
        f"Input target={target}; target_type={target_type}; available_tools={sorted(list(available_tools.keys()))}; "
        f"default_web_wordlist={web_wordlist}."
    )


def _build_command_prompt(
    target: str,
    target_type: str,
    selected_tools: list[str],
    web_wordlist: str,
) -> str:
    output_artifacts = json.dumps(_required_output_artifacts(), sort_keys=True)
    return (
        "You are a recon command generator. Return only JSON for phase-2 command generation. "
        "Build parameter_optimization and command_overrides only for selected_tools. "
        "Each command must be a full shell command and include required output artifact paths exactly as specified. "
        "Keep commands safe and scoped to reconnaissance only. "
        "JSON schema: {"
        "\"parameter_optimization\":{\"agent\":\"parameter_optimization\",\"web_wordlist\":\"...\",\"nmap_timing\":\"-T3|-T4\",\"masscan_rate\":number,\"ffuf_match_codes\":\"...\",\"ffuf_threads\":number,\"gobuster_threads\":number},"
        "\"command_overrides\":{\"tool\":\"full shell command\"}"
        "}. "
        f"Input target={target}; target_type={target_type}; selected_tools={selected_tools}; "
        f"default_web_wordlist={web_wordlist}; required_output_artifacts={output_artifacts}."
    )


def _run_huggingface(prompt: str) -> dict:
    if OpenAI is None:
        raise RuntimeError("openai package is not installed")

    hf_token = os.environ.get("HF_TOKEN", "").strip()
    if not hf_token:
        raise RuntimeError("HF_TOKEN is not set")

    model = os.environ.get("HF_MODEL", "deepseek-ai/DeepSeek-R1:novita")
    hf_timeout = _coerce_int(os.environ.get("HF_TIMEOUT", "45"), 45, 5, 300)

    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=hf_token,
        timeout=hf_timeout,
    )

    completion = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
    )

    content = completion.choices[0].message.content or ""
    decisions = _extract_json_object(content)
    return {
        "phases": decisions,
        "raw_response": content,
        "model": model,
        "provider": "huggingface_router",
    }


def _run_google(prompt: str) -> dict:
    if GoogleGenAI is None:
        raise RuntimeError("google-genai package is not installed")

    google_api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")

    model = os.environ.get("GOOGLE_MODEL", "gemini-3-flash-preview")
    client = GoogleGenAI.Client(api_key=google_api_key)
    response = client.models.generate_content(model=model, contents=prompt)
    content = getattr(response, "text", "") or ""
    if not content.strip():
        raise RuntimeError("Google AI response text is empty")

    decisions = _extract_json_object(content)
    return {
        "phases": decisions,
        "raw_response": content,
        "model": model,
        "provider": "google_ai",
    }


def _parse_ollama_stream_payload(payload: str) -> tuple[str, str]:
    response_parts: list[str] = []
    thinking_parts: list[str] = []

    for raw_line in payload.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        item = json.loads(line)
        if not isinstance(item, dict):
            continue
        response_parts.append(str(item.get("response", "")))
        thinking_parts.append(str(item.get("thinking", "")))

    return "".join(response_parts), "".join(thinking_parts)


def _ollama_full_decision_schema() -> dict:
    return {
        "type": "object",
        "required": [
            "analyze_target_type",
            "select_recon_tools",
            "parameter_optimization",
            "execution_orchestration",
        ],
        "properties": {
            "analyze_target_type": {
                "type": "object",
                "required": ["agent", "target_type", "confidence", "reason"],
                "properties": {
                    "agent": {"type": "string"},
                    "target_type": {"type": "string"},
                    "confidence": {"type": "number"},
                    "reason": {"type": "string"},
                },
            },
            "select_recon_tools": {
                "type": "object",
                "required": ["agent", "strategy", "selected_tools"],
                "properties": {
                    "agent": {"type": "string"},
                    "strategy": {"type": "string"},
                    "selected_tools": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "command_overrides": {
                        "type": "object",
                        "additionalProperties": {"type": "string"},
                    },
                },
            },
            "parameter_optimization": {
                "type": "object",
                "required": [
                    "agent",
                    "web_wordlist",
                    "nmap_timing",
                    "masscan_rate",
                    "ffuf_match_codes",
                    "ffuf_threads",
                    "gobuster_threads",
                ],
                "properties": {
                    "agent": {"type": "string"},
                    "web_wordlist": {"type": "string"},
                    "nmap_timing": {"type": "string"},
                    "masscan_rate": {"type": "number"},
                    "ffuf_match_codes": {"type": "string"},
                    "ffuf_threads": {"type": "number"},
                    "gobuster_threads": {"type": "number"},
                },
            },
            "execution_orchestration": {
                "type": "object",
                "required": ["agent", "mode", "max_parallel", "reason"],
                "properties": {
                    "agent": {"type": "string"},
                    "mode": {"type": "string"},
                    "max_parallel": {"type": "number"},
                    "reason": {"type": "string"},
                },
            },
        },
    }


def _ollama_selection_schema() -> dict:
    return {
        "type": "object",
        "required": [
            "analyze_target_type",
            "select_recon_tools",
            "execution_orchestration",
        ],
        "properties": {
            "analyze_target_type": {
                "type": "object",
                "required": ["agent", "target_type", "confidence", "reason"],
                "properties": {
                    "agent": {"type": "string"},
                    "target_type": {"type": "string"},
                    "confidence": {"type": "number"},
                    "reason": {"type": "string"},
                },
            },
            "select_recon_tools": {
                "type": "object",
                "required": ["agent", "strategy", "selected_tools"],
                "properties": {
                    "agent": {"type": "string"},
                    "strategy": {"type": "string"},
                    "selected_tools": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
            "execution_orchestration": {
                "type": "object",
                "required": ["agent", "mode", "max_parallel", "reason"],
                "properties": {
                    "agent": {"type": "string"},
                    "mode": {"type": "string"},
                    "max_parallel": {"type": "number"},
                    "reason": {"type": "string"},
                },
            },
        },
    }


def _ollama_command_schema() -> dict:
    return {
        "type": "object",
        "required": [
            "parameter_optimization",
            "command_overrides",
        ],
        "properties": {
            "parameter_optimization": {
                "type": "object",
                "required": [
                    "agent",
                    "web_wordlist",
                    "nmap_timing",
                    "masscan_rate",
                    "ffuf_match_codes",
                    "ffuf_threads",
                    "gobuster_threads",
                ],
                "properties": {
                    "agent": {"type": "string"},
                    "web_wordlist": {"type": "string"},
                    "nmap_timing": {"type": "string"},
                    "masscan_rate": {"type": "number"},
                    "ffuf_match_codes": {"type": "string"},
                    "ffuf_threads": {"type": "number"},
                    "gobuster_threads": {"type": "number"},
                },
            },
            "command_overrides": {
                "type": "object",
                "additionalProperties": {"type": "string"},
            },
        },
    }


def _run_ollama_once(
    prompt: str,
    base_url: str,
    model: str,
    timeout: int,
    num_ctx: int,
    num_predict: int,
    stream: bool,
    response_format: str,
    response_schema: dict | None = None,
) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "options": {
            "num_ctx": num_ctx,
            "num_predict": num_predict,
        },
        "stream": stream,
    }

    if response_schema is not None:
        payload["format"] = response_schema
    elif response_format in {"schema", "json_schema"}:
        payload["format"] = _ollama_full_decision_schema()
    elif response_format == "json":
        payload["format"] = "json"

    req = urlrequest.Request(
        f"{base_url.rstrip('/')}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=timeout) as resp:
            raw_payload = resp.read().decode("utf-8", errors="ignore")
    except urlerror.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Ollama HTTP {exc.code}: {details or exc.reason}") from exc
    except urlerror.URLError as exc:
        raise RuntimeError(f"Ollama connection error: {exc.reason}") from exc

    response_text = ""
    thinking_text = ""

    try:
        response_text, thinking_text = _parse_ollama_stream_payload(raw_payload)
    except json.JSONDecodeError:
        try:
            single = json.loads(raw_payload)
            if isinstance(single, dict):
                response_text = str(single.get("response", ""))
                thinking_text = str(single.get("thinking", ""))
        except json.JSONDecodeError:
            pass

    content = response_text.strip() or thinking_text.strip() or raw_payload.strip()
    if not content:
        raise RuntimeError("Ollama response is empty")
    return content


def _run_ollama(prompt: str, response_schema: dict | None = None) -> dict:
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip()
    model = os.environ.get("OLLAMA_MODEL", "deepseek-r1:8b").strip()
    if not model:
        raise RuntimeError("OLLAMA_MODEL is not set")

    timeout = _coerce_int(os.environ.get("OLLAMA_TIMEOUT", "120"), 120, 5, 3600)
    num_ctx = _coerce_int(os.environ.get("OLLAMA_NUM_CTX", "4096"), 4096, 256, 65536)
    num_predict = _coerce_int(os.environ.get("OLLAMA_NUM_PREDICT", "256"), 256, 1, 8192)
    max_num_predict = _coerce_int(os.environ.get("OLLAMA_MAX_NUM_PREDICT", "4096"), 4096, 1, 16384)
    json_retries = _coerce_int(os.environ.get("OLLAMA_JSON_RETRIES", "2"), 2, 0, 8)
    stream_value = os.environ.get("OLLAMA_STREAM", "true").strip().lower()
    stream = stream_value not in {"0", "false", "no"}
    response_format = os.environ.get("OLLAMA_RESPONSE_FORMAT", "json").strip().lower()

    current_num_predict = num_predict
    last_parse_error: Exception | None = None
    content = ""
    for _ in range(json_retries + 1):
        content = _run_ollama_once(
            prompt=prompt,
            base_url=base_url,
            model=model,
            timeout=timeout,
            num_ctx=num_ctx,
            num_predict=current_num_predict,
            stream=stream,
            response_format=response_format,
            response_schema=response_schema,
        )
        try:
            decisions = _extract_json_object(content)
            return {
                "phases": decisions,
                "raw_response": content,
                "model": model,
                "provider": "ollama",
            }
        except Exception as exc:  # noqa: BLE001
            last_parse_error = exc
            if current_num_predict >= max_num_predict:
                break
            current_num_predict = min(max_num_predict, current_num_predict * 2)

    if last_parse_error is None:
        raise RuntimeError("Ollama response parsing failed")
    raise RuntimeError(f"Ollama JSON parse failed after retries: {last_parse_error}")


def _run_provider(provider: str, prompt: str, response_schema: dict | None = None) -> dict:
    if provider == "huggingface_router":
        return _run_huggingface(prompt)
    if provider == "google_ai":
        return _run_google(prompt)
    if provider == "ollama":
        return _run_ollama(prompt, response_schema=response_schema)
    raise RuntimeError(f"Unsupported provider: {provider}")


def _default_parameter_optimization(target_type: str, web_wordlist: str) -> dict:
    return {
        "agent": "parameter_optimization",
        "web_wordlist": web_wordlist,
        "nmap_timing": "-T3" if target_type == "ip" else "-T4",
        "masscan_rate": 500 if target_type == "ip" else 1000,
        "ffuf_match_codes": "200,204,301,302,307,401,403",
        "ffuf_threads": 40,
        "gobuster_threads": 30,
    }


def _normalize_orchestration(orchestration: dict, target_type: str) -> dict:
    orchestration.setdefault("agent", "orchestrator")
    orchestration.setdefault("mode", "parallel" if target_type in {"domain", "ip"} else "sequential")
    orchestration.setdefault("max_parallel", 3 if target_type in {"domain", "ip"} else 1)
    orchestration.setdefault("reason", "AI-selected run strategy based on tool dependencies and target type.")
    orchestration["mode"] = _coerce_execution_mode(orchestration.get("mode"), "sequential")
    orchestration["max_parallel"] = _coerce_int(orchestration.get("max_parallel"), 2, 1, 8)
    if orchestration["mode"] == "sequential":
        orchestration["max_parallel"] = 1
    return orchestration


def _normalize_command_overrides(raw_overrides: object) -> dict[str, str]:
    if not isinstance(raw_overrides, dict):
        return {}

    return {
        str(tool): str(cmd)
        for tool, cmd in raw_overrides.items()
        if isinstance(tool, str) and str(tool).strip()
    }


def _normalize_selection_phase(decisions: dict, target_type: str, available_tools: dict[str, str]) -> dict:
    analyze = decisions.setdefault("analyze_target_type", {})
    analyze.setdefault("agent", "analyze_target_type")
    analyze.setdefault("target_type", target_type)
    analyze.setdefault("confidence", 0.8)
    analyze.setdefault("reason", "AI analysis of provided target.")

    select_phase = decisions.setdefault("select_recon_tools", {})
    select_phase.setdefault("agent", "select_recon_tools")
    select_phase.setdefault("strategy", "ai_tool_selection")
    selected = select_phase.get("selected_tools", [])
    if not isinstance(selected, list):
        selected = []

    selected_tools = _normalize_selected_tools(
        target_type=target_type,
        selected_tools=[str(tool) for tool in selected],
        available_tools=available_tools,
    )
    select_phase["selected_tools"] = selected_tools

    orchestration = decisions.setdefault("execution_orchestration", {})
    decisions["execution_orchestration"] = _normalize_orchestration(orchestration, target_type)
    return decisions


def _normalize_parameter_phase(decisions: dict, target_type: str, web_wordlist: str) -> tuple[dict, dict[str, str]]:
    defaults = _default_parameter_optimization(target_type, web_wordlist)
    optim = decisions.get("parameter_optimization", {})
    if not isinstance(optim, dict):
        optim = {}

    normalized_optim = {
        "agent": str(optim.get("agent", defaults["agent"])),
        "web_wordlist": str(optim.get("web_wordlist", defaults["web_wordlist"])),
        "nmap_timing": _coerce_nmap_timing(optim.get("nmap_timing", defaults["nmap_timing"]), defaults["nmap_timing"]),
        "masscan_rate": _coerce_int(optim.get("masscan_rate", defaults["masscan_rate"]), defaults["masscan_rate"], 100, 100000),
        "ffuf_match_codes": str(optim.get("ffuf_match_codes", defaults["ffuf_match_codes"])),
        "ffuf_threads": _coerce_int(optim.get("ffuf_threads", defaults["ffuf_threads"]), defaults["ffuf_threads"], 1, 200),
        "gobuster_threads": _coerce_int(
            optim.get("gobuster_threads", defaults["gobuster_threads"]),
            defaults["gobuster_threads"],
            1,
            200,
        ),
    }

    raw_overrides = decisions.get("command_overrides", {})
    if not isinstance(raw_overrides, dict):
        nested = decisions.get("select_recon_tools", {})
        if isinstance(nested, dict):
            raw_overrides = nested.get("command_overrides", {})
    command_overrides = _normalize_command_overrides(raw_overrides)
    return normalized_optim, command_overrides


def _fallback_decisions(target_type: str, available_tools: dict[str, str], wordlists: dict) -> dict:
    available = set(available_tools.keys())
    web_wordlist = _pick_wordlist(
        wordlists,
        "web_content",
        "/usr/share/wordlists/dirb/common.txt",
    )

    if target_type == "domain":
        preferred = ["subfinder", "amass", "nmap", "nuclei", "ffuf", "gobuster"]
        strategy = "domain_to_subdomain_port_and_vuln"
    elif target_type == "ip":
        preferred = ["nmap", "masscan", "nuclei"]
        strategy = "ip_to_nmap_masscan_and_vuln"
    elif target_type == "application":
        preferred = ["nuclei", "ffuf", "gobuster"]
        strategy = "application_vuln_and_content_discovery"
    else:
        preferred = []
        strategy = "unsupported_target"

    selected = [tool for tool in preferred if tool in available]
    default_optim = _default_parameter_optimization(target_type, web_wordlist)

    return {
        "analyze_target_type": {
            "agent": "analyze_target_type",
            "target_type": target_type,
            "confidence": 0.95 if strategy != "unsupported_target" else 0.25,
            "reason": "Local fallback decision based on validated target type.",
        },
        "select_recon_tools": {
            "agent": "select_recon_tools",
            "strategy": strategy,
            "selected_tools": selected,
            "command_overrides": {},
        },
        "parameter_optimization": {
            "agent": "parameter_optimization",
            "web_wordlist": default_optim["web_wordlist"],
            "nmap_timing": default_optim["nmap_timing"],
            "masscan_rate": default_optim["masscan_rate"],
            "ffuf_match_codes": default_optim["ffuf_match_codes"],
            "ffuf_threads": default_optim["ffuf_threads"],
            "gobuster_threads": default_optim["gobuster_threads"],
        },
        "execution_orchestration": _normalize_orchestration(
            {
                "agent": "orchestrator",
                "mode": "parallel" if target_type in {"domain", "ip"} else "sequential",
                "max_parallel": 3 if target_type in {"domain", "ip"} else 1,
                "reason": "Local fallback orchestration policy based on target type.",
            },
            target_type,
        ),
    }


def _llm_decisions(target: str, target_type: str, available_tools: dict[str, str], wordlists: dict) -> dict:
    _load_env_file()
    web_wordlist = _pick_wordlist(
        wordlists,
        "web_content",
        "/usr/share/wordlists/dirb/common.txt",
    )

    selection_prompt = _build_selection_prompt(target, target_type, available_tools, web_wordlist)

    errors: list[str] = []
    for provider in _provider_order():
        try:
            selection_result = _run_provider(provider, selection_prompt, response_schema=_ollama_selection_schema())
            selection_decisions = selection_result.get("phases", {})
            if not isinstance(selection_decisions, dict):
                raise RuntimeError("Selection phase did not return JSON object")

            selection_decisions = _normalize_selection_phase(selection_decisions, target_type, available_tools)
            selected_tools = selection_decisions.get("select_recon_tools", {}).get("selected_tools", [])
            if not isinstance(selected_tools, list):
                selected_tools = []

            command_prompt = _build_command_prompt(
                target=target,
                target_type=target_type,
                selected_tools=[str(tool) for tool in selected_tools],
                web_wordlist=web_wordlist,
            )
            command_result = _run_provider(provider, command_prompt, response_schema=_ollama_command_schema())
            command_decisions = command_result.get("phases", {})
            if not isinstance(command_decisions, dict):
                raise RuntimeError("Command phase did not return JSON object")

            optim, command_overrides = _normalize_parameter_phase(command_decisions, target_type, web_wordlist)
            selected_tool_set = {str(tool) for tool in selected_tools}
            filtered_overrides = {
                tool: cmd
                for tool, cmd in command_overrides.items()
                if not selected_tool_set or tool in selected_tool_set
            }

            phases = {
                "analyze_target_type": selection_decisions.get("analyze_target_type", {}),
                "select_recon_tools": {
                    **selection_decisions.get("select_recon_tools", {}),
                    "command_overrides": filtered_overrides,
                },
                "parameter_optimization": optim,
                "execution_orchestration": selection_decisions.get("execution_orchestration", {}),
            }

            raw_response = json.dumps(
                {
                    "selection_pass": selection_result.get("raw_response", ""),
                    "command_pass": command_result.get("raw_response", ""),
                }
            )
            model = str(command_result.get("model") or selection_result.get("model") or "")

            return {
                "phases": phases,
                "raw_response": raw_response,
                "model": model,
                "provider": str(selection_result.get("provider", provider)),
            }
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{provider}: {exc}")

    raise RuntimeError("; ".join(errors) if errors else "No LLM provider available")


def _build_domain_subdomains_prepare_snippet(target: str, max_targets: int = 0) -> str:
    limit_clause = f" | head -n {max_targets}" if max_targets > 0 else ""
    return (
        "cat data/raw/subfinder.txt data/raw/amass.txt 2>/dev/null "
        "| tr -d \"\\r\" | sed \"/^\\s*$/d\" | sort -u"
        f"{limit_clause}"
        " > data/state/subdomains_all.txt; "
        f"if [ ! -s data/state/subdomains_all.txt ]; then echo {target} > data/state/subdomains_all.txt; fi; "
    )


def _build_nmap_domain_command(target: str, nmap_timing: str) -> str:
    prepare = _build_domain_subdomains_prepare_snippet(target, max_targets=0)
    return (
        f"sh -c '{prepare}"
        f"nmap -sV -Pn {nmap_timing} -iL data/state/subdomains_all.txt -oN data/raw/nmap.txt -oX data/raw/nmap.xml'"
    )


def _build_ffuf_domain_command(target: str, web_wordlist: str, ffuf_match_codes: str, ffuf_threads: int) -> str:
    prepare = _build_domain_subdomains_prepare_snippet(target, max_targets=0)
    return (
        f"sh -c '{prepare}"
        f"ffuf -u https://DOMAIN/FUZZ -w data/state/subdomains_all.txt:DOMAIN -w {web_wordlist}:FUZZ "
        f"-mc {ffuf_match_codes} -t {ffuf_threads} -o data/raw/ffuf.json -of json'"
    )


def _build_gobuster_domain_command(target: str, web_wordlist: str, gobuster_threads: int) -> str:
    prepare = _build_domain_subdomains_prepare_snippet(target, max_targets=0)
    return (
        f"sh -c '{prepare}"
        ": > data/raw/gobuster.txt; "
        "while read -r host; do "
        "[ -z \"$host\" ] && continue; "
        f"gobuster dir -u \"https://$host\" -w {web_wordlist} -t {gobuster_threads} -o data/state/gobuster_tmp.txt >/dev/null 2>&1 || true; "
        "if [ -s data/state/gobuster_tmp.txt ]; then cat data/state/gobuster_tmp.txt >> data/raw/gobuster.txt; fi; "
        "done < data/state/subdomains_all.txt; "
        "rm -f data/state/gobuster_tmp.txt'"
    )


def _build_nuclei_domain_command(target: str) -> str:
    nuclei_max_targets = _coerce_int(os.environ.get("NUCLEI_MAX_TARGETS", "100"), 100, 0, 100000)
    prepare = _build_domain_subdomains_prepare_snippet(target, max_targets=nuclei_max_targets)

    return (
        f"sh -c '{prepare}"
        "sed \"s#^#https://#\" data/state/subdomains_all.txt > data/state/nuclei_targets.txt; "
        "nuclei -l data/state/nuclei_targets.txt -severity low,medium,high,critical -o data/raw/nuclei.txt'"
    )


def _sanitize_ai_command(tool: str, candidate: object) -> str:
    if candidate is None:
        return ""

    command = str(candidate).strip()
    if not command or len(command) > 4096:
        return ""

    lowered = command.lower()

    blocked_tokens = [
        "rm -rf",
        "mkfs",
        "shutdown",
        "reboot",
        "poweroff",
        "dd if=",
        "> /dev/sd",
    ]
    if any(token in lowered for token in blocked_tokens):
        return ""

    if tool.lower() not in lowered:
        return ""

    expected_tokens = _required_output_artifacts().get(tool.lower(), [])
    if expected_tokens and not all(token in command for token in expected_tokens):
        return ""

    # ffuf requires FUZZ token in URL/headers/body and JSON output format for parser compatibility.
    if tool.lower() == "ffuf":
        if "FUZZ" not in command:
            return ""
        if "-of json" not in lowered:
            return ""

    return command


def _pick_step_command(tool: str, static_command: str, command_overrides: dict[str, str]) -> tuple[str, str, str]:
    ai_command = _sanitize_ai_command(tool, command_overrides.get(tool, ""))
    if ai_command:
        return ai_command, "ai", static_command
    return static_command, "static", ""


def _enforce_domain_scope_for_tool(
    tool: str,
    command: str,
    command_source: str,
    fallback_command: str,
    static_command: str,
) -> tuple[str, str, str]:
    if command_source != "ai":
        return command, command_source, fallback_command

    lowered = command.lower()
    if tool == "nmap":
        valid = "-il" in lowered and "data/state/subdomains_all.txt" in command
    elif tool == "ffuf":
        valid = (
            "data/state/subdomains_all.txt:domain" in lowered
            and "https://domain/fuzz" in lowered
            and "-of json" in lowered
        )
    elif tool == "gobuster":
        valid = "data/state/subdomains_all.txt" in command
    else:
        valid = True

    if valid:
        return command, command_source, fallback_command

    return static_command, "static", ""


def _build_steps(
    target: str,
    target_type: str,
    selected_tools: list[str],
    optim: dict,
    command_overrides: dict[str, str],
    completed_signatures: set[str],
) -> list[PlanStep]:
    steps: list[PlanStep] = []

    nmap_timing = _coerce_nmap_timing(
        optim.get("nmap_timing", "-T3" if target_type == "ip" else "-T4"),
        "-T3" if target_type == "ip" else "-T4",
    )
    masscan_rate = _coerce_int(
        optim.get("masscan_rate", 500 if target_type == "ip" else 1000),
        500 if target_type == "ip" else 1000,
        100,
        100000,
    )
    web_wordlist = str(optim.get("web_wordlist", "/usr/share/wordlists/dirb/common.txt"))
    ffuf_match_codes = str(optim.get("ffuf_match_codes", "200,204,301,302,307,401,403"))
    ffuf_threads = _coerce_int(optim.get("ffuf_threads", 40), 40, 1, 200)
    gobuster_threads = _coerce_int(optim.get("gobuster_threads", 30), 30, 1, 200)

    if target_type == "domain":
        if "subfinder" in selected_tools:
            static_command = f"subfinder -d {target} -silent -o data/raw/subfinder.txt"
            command, command_source, fallback_command = _pick_step_command("subfinder", static_command, command_overrides)
            _add_step(
                steps,
                "subfinder",
                command,
                "AI decision: passive subdomain enumeration.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "amass" in selected_tools:
            static_command = f"amass enum -passive -d {target} -o data/raw/amass.txt"
            command, command_source, fallback_command = _pick_step_command("amass", static_command, command_overrides)
            _add_step(
                steps,
                "amass",
                command,
                "AI decision: expand subdomain coverage.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "nmap" in selected_tools:
            static_command = _build_nmap_domain_command(target, nmap_timing)
            command, command_source, fallback_command = _pick_step_command("nmap", static_command, command_overrides)
            command, command_source, fallback_command = _enforce_domain_scope_for_tool(
                "nmap",
                command,
                command_source,
                fallback_command,
                static_command,
            )
            _add_step(
                steps,
                "nmap",
                command,
                "AI decision: service and port discovery phase.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "nuclei" in selected_tools:
            static_command = _build_nuclei_domain_command(target)
            command, command_source, fallback_command = _pick_step_command("nuclei", static_command, command_overrides)
            _add_step(
                steps,
                "nuclei",
                command,
                "AI decision: vulnerability scan over discovered subdomains.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "ffuf" in selected_tools:
            static_command = _build_ffuf_domain_command(target, web_wordlist, ffuf_match_codes, ffuf_threads)
            command, command_source, fallback_command = _pick_step_command("ffuf", static_command, command_overrides)
            command, command_source, fallback_command = _enforce_domain_scope_for_tool(
                "ffuf",
                command,
                command_source,
                fallback_command,
                static_command,
            )
            _add_step(
                steps,
                "ffuf",
                command,
                "AI optimization: focused web content discovery.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "gobuster" in selected_tools:
            static_command = _build_gobuster_domain_command(target, web_wordlist, gobuster_threads)
            command, command_source, fallback_command = _pick_step_command("gobuster", static_command, command_overrides)
            command, command_source, fallback_command = _enforce_domain_scope_for_tool(
                "gobuster",
                command,
                command_source,
                fallback_command,
                static_command,
            )
            _add_step(
                steps,
                "gobuster",
                command,
                "AI optimization: directory brute-force fallback.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )

    elif target_type == "ip":
        if "nmap" in selected_tools:
            static_command = f"nmap -sV -Pn {nmap_timing} {target} -oN data/raw/nmap.txt -oX data/raw/nmap.xml"
            command, command_source, fallback_command = _pick_step_command("nmap", static_command, command_overrides)
            _add_step(
                steps,
                "nmap",
                command,
                "AI decision: first pass service detection on IP target.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "masscan" in selected_tools:
            static_command = f"masscan -p1-65535 {target} --rate {masscan_rate} -oL data/raw/masscan.txt"
            command, command_source, fallback_command = _pick_step_command("masscan", static_command, command_overrides)
            _add_step(
                steps,
                "masscan",
                command,
                "AI decision: high-speed sweep after initial nmap context.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "nuclei" in selected_tools:
            static_command = f"nuclei -u http://{target} -severity low,medium,high,critical -o data/raw/nuclei.txt"
            command, command_source, fallback_command = _pick_step_command("nuclei", static_command, command_overrides)
            _add_step(
                steps,
                "nuclei",
                command,
                "AI decision: vulnerability checks on exposed HTTP services.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )

    elif target_type == "application":
        app_target = target if urlparse(target).scheme else f"https://{target}"
        if "nuclei" in selected_tools:
            static_command = f"nuclei -u {app_target} -severity low,medium,high,critical -o data/raw/nuclei.txt"
            command, command_source, fallback_command = _pick_step_command("nuclei", static_command, command_overrides)
            _add_step(
                steps,
                "nuclei",
                command,
                "AI decision: application vulnerability templates.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "ffuf" in selected_tools:
            static_command = (
                f"ffuf -u {app_target.rstrip('/')}/FUZZ -w {web_wordlist} "
                f"-mc {ffuf_match_codes} -t {ffuf_threads} -o data/raw/ffuf.json -of json"
            )
            command, command_source, fallback_command = _pick_step_command("ffuf", static_command, command_overrides)
            _add_step(
                steps,
                "ffuf",
                command,
                "AI optimization: route/content discovery for application target.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )
        if "gobuster" in selected_tools:
            static_command = (
                f"gobuster dir -u {app_target} -w {web_wordlist} "
                f"-t {gobuster_threads} -o data/raw/gobuster.txt"
            )
            command, command_source, fallback_command = _pick_step_command("gobuster", static_command, command_overrides)
            _add_step(
                steps,
                "gobuster",
                command,
                "AI optimization: backup directory coverage.",
                completed_signatures,
                command_source=command_source,
                fallback_command=fallback_command,
                signature_command=static_command,
            )

    return steps


def plan_with_ai(*args, **kwargs) -> dict:
    target: str = kwargs["target"]
    target_type: str = kwargs["target_type"]
    available_tools: dict[str, str] = kwargs["available_tools"]
    wordlists: dict = kwargs["wordlists"]
    completed_signatures: set[str] = kwargs.get("completed_signatures") or set()

    llm_source = "fallback"
    warning = ""
    llm_output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider": "huggingface_router",
        "model": "",
        "raw_response": "",
        "parsed_json_raw": {},
        "parsed_json_normalized": {},
        "is_live_llm": False,
        "status": "fallback",
        "error": "",
    }

    try:
        llm_decisions = _llm_decisions(target, target_type, available_tools, wordlists)
        if "phases" in llm_decisions and isinstance(llm_decisions.get("phases"), dict):
            phases = llm_decisions["phases"]
            llm_output["model"] = str(llm_decisions.get("model", ""))
            llm_output["raw_response"] = str(llm_decisions.get("raw_response", ""))
            llm_output["provider"] = str(llm_decisions.get("provider", "huggingface_router"))
        else:
            # Backward-compatibility path for tests/mocks that return only phase JSON.
            phases = llm_decisions

        llm_source = str(llm_output.get("provider", "huggingface_router"))
        llm_output["is_live_llm"] = True
        llm_output["status"] = "ok"
    except Exception as exc:  # noqa: BLE001
        phases = _fallback_decisions(target_type, available_tools, wordlists)
        warning = f"LLM planning fallback active: {exc}"
        llm_output["error"] = str(exc)

    llm_output["parsed_json_raw"] = json.loads(json.dumps(phases))

    orchestration = phases.setdefault("execution_orchestration", {})
    orchestration.setdefault("agent", "orchestrator")
    orchestration.setdefault("mode", "parallel" if target_type in {"domain", "ip"} else "sequential")
    orchestration.setdefault("max_parallel", 3 if target_type in {"domain", "ip"} else 1)
    orchestration.setdefault("reason", "AI-selected run strategy based on tool dependencies and target type.")
    orchestration["mode"] = _coerce_execution_mode(orchestration.get("mode"), "sequential")
    orchestration["max_parallel"] = _coerce_int(orchestration.get("max_parallel"), 2, 1, 8)
    if orchestration["mode"] == "sequential":
        orchestration["max_parallel"] = 1

    raw_selected_tools = phases.get("select_recon_tools", {}).get("selected_tools", [])
    if not isinstance(raw_selected_tools, list):
        raw_selected_tools = []

    raw_command_overrides = phases.get("select_recon_tools", {}).get("command_overrides", {})
    if not isinstance(raw_command_overrides, dict):
        raw_command_overrides = {}
    command_overrides = {str(tool): str(cmd) for tool, cmd in raw_command_overrides.items()}

    selected_tools = _normalize_selected_tools(
        target_type=target_type,
        selected_tools=[str(tool) for tool in raw_selected_tools],
        available_tools=available_tools,
    )
    phases.setdefault("select_recon_tools", {})["selected_tools"] = selected_tools
    phases.setdefault("select_recon_tools", {})["command_overrides"] = command_overrides
    llm_output["parsed_json_normalized"] = json.loads(json.dumps(phases))

    optim = phases.get("parameter_optimization", {})
    steps = _build_steps(
        target=target,
        target_type=target_type,
        selected_tools=selected_tools,
        optim=optim,
        command_overrides=command_overrides,
        completed_signatures=completed_signatures,
    )

    return {
        "enabled": True,
        "engine": "ai_decision_engine_v1",
        "llm_source": llm_source,
        "warning": warning,
        "llm_output": llm_output,
        "phases": phases,
        "steps": steps,
    }
