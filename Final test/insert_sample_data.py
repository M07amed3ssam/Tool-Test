"""One-time importer to seed dashboard reports from recon-agent sample data.

Examples:
    python insert_sample_data.py --email admin@example.com
    python insert_sample_data.py --email admin@example.com --recon-root ../recon-agent
    python insert_sample_data.py --email admin@example.com --full-data-path ../recon-agent/Full_data.json
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from app.auth.models import User
from app.db.database import SessionLocal
from app.recon.normalizer.merger import merge_parsed
from app.recon.reporting.ai_reporter import generate_ai_report
from app.reports import utils as report_utils
from app.reports.models import Report
from app.scans.engine import build_final_report_payload, parse_outputs
from app.scans.utils import slugify_name
from load_env import load_dotenv


DEFAULT_RECON_ROOT = Path(__file__).resolve().parent.parent / "recon-agent"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import recon-agent sample data so it appears in the dashboard Reports page.",
    )
    parser.add_argument(
        "--email",
        required=True,
        help="Email of the dashboard user who should own the imported report.",
    )
    parser.add_argument(
        "--recon-root",
        default=str(DEFAULT_RECON_ROOT),
        help="Path to recon-agent root (default: ../recon-agent).",
    )
    parser.add_argument(
        "--full-data-path",
        default="",
        help="Optional explicit path to Full_data.json. If omitted, uses <recon-root>/Full_data.json.",
    )
    parser.add_argument(
        "--report-name",
        default="",
        help="Optional report name. Defaults to sample-<domain>.",
    )
    parser.add_argument(
        "--domain",
        default="",
        help="Optional domain override. Useful when Full_data.json is missing target metadata.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate source and print intended action without writing files or database rows.",
    )
    return parser.parse_args()


def _read_json_file(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RuntimeError(f"Could not read JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in file: {path}") from exc

    if not isinstance(payload, dict):
        raise RuntimeError(f"Expected a JSON object in file: {path}")
    return payload


def _safe_string(value: object) -> str:
    text = str(value).strip() if value is not None else ""
    return text


def _domain_from_url(value: str) -> str:
    parsed = urlparse(value)
    return _safe_string(parsed.hostname)


def _infer_domain_from_assets(assets: list[dict]) -> str:
    for item in assets:
        if not isinstance(item, dict):
            continue
        if _safe_string(item.get("type")).lower() != "domain":
            continue
        domain = _safe_string(item.get("value"))
        if domain:
            return domain

    for item in assets:
        if not isinstance(item, dict):
            continue
        if _safe_string(item.get("type")).lower() != "url":
            continue
        host = _domain_from_url(_safe_string(item.get("value")))
        if host:
            return host

    return ""


def _normalize_full_data(payload: dict, domain_override: str) -> tuple[dict, str]:
    full_data = dict(payload)

    assets = full_data.get("assets", [])
    findings = full_data.get("findings", [])
    errors = full_data.get("errors", [])
    execution_history = full_data.get("execution_history", [])

    full_data["assets"] = assets if isinstance(assets, list) else []
    full_data["findings"] = findings if isinstance(findings, list) else []
    full_data["errors"] = errors if isinstance(errors, list) else []
    full_data["execution_history"] = execution_history if isinstance(execution_history, list) else []

    target = full_data.get("target", {})
    if not isinstance(target, dict):
        target = {}

    target_value = _safe_string(domain_override) or _safe_string(target.get("value"))
    if not target_value:
        target_value = _infer_domain_from_assets(full_data["assets"])
    if not target_value:
        raise RuntimeError("Could not determine domain from Full_data.json. Provide --domain.")

    target_type = _safe_string(target.get("type")) or "domain"
    validated = target.get("validated", True)
    target["value"] = target_value
    target["type"] = target_type
    target["validated"] = bool(validated)
    full_data["target"] = target

    scan_metadata = full_data.get("scan_metadata", {})
    if not isinstance(scan_metadata, dict):
        scan_metadata = {}

    scan_metadata.setdefault("generated_at", datetime.now(timezone.utc).isoformat())
    scan_metadata.setdefault("executed", False)
    scan_metadata.setdefault("planner", "import_script_v1")
    scan_metadata.setdefault("planner_source", "import")
    scan_metadata.setdefault("orchestration_mode", "sequential")
    scan_metadata.setdefault("max_parallel", 1)
    scan_metadata.setdefault("tools_used", [])
    scan_metadata.setdefault("tool_status", {})
    full_data["scan_metadata"] = scan_metadata

    return full_data, target_value


def _build_full_data_from_raw(recon_root: Path, domain_override: str) -> tuple[dict, str]:
    parsed_outputs = parse_outputs(recon_root)
    if not parsed_outputs:
        raise RuntimeError(
            f"No recon artifacts found under {recon_root / 'data' / 'raw'}. "
            "Provide --full-data-path or verify recon-agent data files exist."
        )

    merged = merge_parsed(parsed_outputs)
    assets = merged.get("assets", []) if isinstance(merged.get("assets", []), list) else []
    findings = merged.get("findings", []) if isinstance(merged.get("findings", []), list) else []
    errors = merged.get("errors", []) if isinstance(merged.get("errors", []), list) else []

    domain = _safe_string(domain_override) or _infer_domain_from_assets(assets)
    if not domain:
        raise RuntimeError("Could not determine domain from parsed artifacts. Provide --domain.")

    tools_used = sorted(
        {
            _safe_string(item.get("source_tool"))
            for item in findings
            if isinstance(item, dict) and _safe_string(item.get("source_tool"))
        }
    )

    full_data = {
        "target": {
            "value": domain,
            "type": "domain",
            "validated": True,
        },
        "scan_metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "executed": False,
            "planner": "import_script_v1",
            "planner_source": "import",
            "orchestration_mode": "sequential",
            "max_parallel": 1,
            "tools_used": tools_used,
            "tool_status": {},
        },
        "assets": assets,
        "findings": findings,
        "errors": errors,
        "execution_history": [],
    }

    return full_data, domain


def _resolve_full_data(args: argparse.Namespace) -> tuple[dict, str, Path]:
    if args.full_data_path:
        full_data_path = Path(args.full_data_path).expanduser().resolve()
        if not full_data_path.exists():
            raise RuntimeError(f"--full-data-path does not exist: {full_data_path}")
        full_data = _read_json_file(full_data_path)
        normalized, domain = _normalize_full_data(full_data, args.domain)
        return normalized, domain, full_data_path

    recon_root = Path(args.recon_root).expanduser().resolve()
    if not recon_root.exists() or not recon_root.is_dir():
        raise RuntimeError(f"--recon-root does not exist or is not a directory: {recon_root}")

    full_data_path = recon_root / "Full_data.json"
    if full_data_path.exists():
        full_data = _read_json_file(full_data_path)
        normalized, domain = _normalize_full_data(full_data, args.domain)
        return normalized, domain, full_data_path

    normalized, domain = _build_full_data_from_raw(recon_root, args.domain)
    return normalized, domain, recon_root / "data" / "raw"


def _resolve_report_name(domain: str, override: str) -> str:
    if _safe_string(override):
        return slugify_name(override)
    return slugify_name(f"sample-{domain}")


def _get_user_by_email(db, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise RuntimeError(f"No user found with email: {email}")
    return user


def run_import(args: argparse.Namespace) -> int:
    # Load .env values once so database config is available consistently.
    load_dotenv()
    db = SessionLocal()

    try:
        user = _get_user_by_email(db, args.email)
        full_data, domain, source_path = _resolve_full_data(args)
        report_name = _resolve_report_name(domain=domain, override=args.report_name)

        ai_report = generate_ai_report(full_data)
        final_report = build_final_report_payload(full_data, ai_report)

        existing_report = (
            db.query(Report)
            .filter(Report.user_id == user.id, Report.report_name == report_name)
            .first()
        )

        if args.dry_run:
            action = "update" if existing_report else "create"
            print("Dry run successful")
            print(f"User: {user.email} (id={user.id})")
            print(f"Source: {source_path}")
            print(f"Report name: {report_name}")
            print(f"Domain: {domain}")
            print(f"Action: {action}")
            return 0

        with tempfile.TemporaryDirectory(prefix="report-import-") as temp_dir:
            source_dir = Path(temp_dir)
            (source_dir / "Full_data.json").write_text(
                json.dumps(full_data, indent=2),
                encoding="utf-8",
            )
            (source_dir / "Final_report.json").write_text(
                json.dumps(final_report, indent=2),
                encoding="utf-8",
            )

            file_paths = report_utils.copy_report_files(
                source_dir=str(source_dir),
                user_id=user.id,
                report_name=report_name,
            )

        if existing_report:
            existing_report.domain = domain
            existing_report.final_file = file_paths["final_file"]
            existing_report.full_file = file_paths["full_file"]
            db_report = existing_report
            action = "updated"
        else:
            db_report = Report(
                user_id=user.id,
                report_name=report_name,
                domain=domain,
                final_file=file_paths["final_file"],
                full_file=file_paths["full_file"],
            )
            db.add(db_report)
            action = "created"

        db.commit()
        db.refresh(db_report)

        print(f"Report {action} successfully")
        print(f"Report ID: {db_report.id}")
        print(f"User: {user.email} (id={user.id})")
        print(f"Report name: {db_report.report_name}")
        print(f"Domain: {db_report.domain}")
        print(f"Final file: {db_report.final_file}")
        print(f"Full file: {db_report.full_file}")
        print("Refresh the dashboard Reports page to see this entry.")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


def main() -> int:
    args = parse_args()
    return run_import(args)


if __name__ == "__main__":
    raise SystemExit(main())