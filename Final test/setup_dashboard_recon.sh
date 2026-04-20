#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

DB_NAME=""
DB_USER=""
DB_PASSWORD=""
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
APP_URL=""
APP_HOST=""
APP_PORT_VALUE=""
BIND_HOST="${BIND_HOST:-}"
VENV_DIR="${VENV_DIR:-.venv}"

MYSQL_ROOT_USER="${MYSQL_ROOT_USER:-root}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"
SKIP_DB_BOOTSTRAP="${SKIP_DB_BOOTSTRAP:-0}"
RELOAD="${RELOAD:-1}"
SEED_ADMIN="${SEED_ADMIN:-1}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"

log() {
  printf '[setup_dashboard_recon] %s\n' "$*"
}

warn() {
  printf '[setup_dashboard_recon] WARNING: %s\n' "$*" >&2
}

die() {
  printf '[setup_dashboard_recon] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  ./setup_dashboard_recon.sh --db-name NAME --db-user USER --db-password PASS --app-url URL [options]

Required:
  --db-name NAME         MySQL database name
  --db-user USER         MySQL application user
  --db-password PASS     MySQL application user password
  --app-url URL          Public URL for app startup (example: http://142.93.122.74:8000)

Optional:
  --db-host HOST         MySQL host (default: localhost)
  --db-port PORT         MySQL port (default: 3306)
  --help                 Show this message

Environment variables:
  VENV_DIR               Virtualenv path (default: .venv)
  MYSQL_ROOT_USER        Root/admin user used to create db/user (default: root)
  MYSQL_ROOT_PASSWORD    Root/admin password for MySQL bootstrap
  SKIP_DB_BOOTSTRAP=1    Skip creating db/user and only run app startup
  SKIP_MIGRATIONS=1      Skip alembic migrations
  RELOAD=0               Disable uvicorn autoreload
  SEED_ADMIN=0           Disable admin seeding
  BIND_HOST              Force uvicorn bind host (default derived from app-url)
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

validate_identifier() {
  local value="$1"
  local label="$2"
  [[ "$value" =~ ^[A-Za-z0-9_]+$ ]] || die "$label must contain only letters, numbers, and underscore"
}

sql_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\'/\'\'}"
  printf '%s' "$value"
}

url_encode() {
  local value="$1"
  python3 - "$value" <<'PY'
import sys
from urllib.parse import quote_plus

print(quote_plus(sys.argv[1]))
PY
}

ensure_secret_key() {
  if [[ -n "${SECRET_KEY:-}" && ${#SECRET_KEY} -ge 32 ]]; then
    return
  fi

  if [[ -f .env ]] && grep -Eq '^SECRET_KEY=["\x27]?.{32,}["\x27]?$' .env; then
    return
  fi

  log "SECRET_KEY is missing or too short. Generating a new one in .env"

  local generated
  generated="$(python3 - <<'PY'
import base64
import secrets

token = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
print(token)
PY
)"

  [[ -n "$generated" ]] || die "Failed to generate SECRET_KEY"

  if [[ -f .env ]] && grep -q '^SECRET_KEY=' .env; then
    sed -i "s|^SECRET_KEY=.*|SECRET_KEY=\"$generated\"|" .env
  else
    printf '\nSECRET_KEY="%s"\n' "$generated" >> .env
  fi
}

install_requirements_if_needed() {
  local dry_run_file
  dry_run_file="$(mktemp)"

  if python -m pip install --dry-run -r requirements.txt >"$dry_run_file" 2>&1; then
    if grep -q "Would install" "$dry_run_file"; then
      log "Installing missing or mismatched Python requirements"
      python -m pip install -r requirements.txt
    else
      log "Python requirements are already satisfied"
    fi
  else
    warn "pip dry-run check failed. Installing requirements directly"
    python -m pip install -r requirements.txt
  fi

  rm -f "$dry_run_file"
}

ensure_virtualenv() {
  if [[ ! -d "$VENV_DIR" ]]; then
    log "Creating virtual environment in $VENV_DIR"
    python3 -m venv "$VENV_DIR"
  fi

  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
}

run_migrations() {
  if [[ "$SKIP_MIGRATIONS" == "1" ]]; then
    warn "Skipping migrations because SKIP_MIGRATIONS=1"
    return
  fi

  log "Applying database migrations"
  alembic upgrade head
}

start_server() {
  local cmd=(python -m uvicorn app.main:app --host "$BIND_HOST" --port "$APP_PORT_VALUE")
  if [[ "$RELOAD" == "1" ]]; then
    cmd+=(--reload)
  fi

  log "Starting FastAPI server on ${BIND_HOST}:${APP_PORT_VALUE}"
  exec "${cmd[@]}"
}

parse_app_url() {
  local url="$1"
  mapfile -t APP_URL_PARTS < <(python3 - "$url" <<'PY'
import sys
from urllib.parse import urlparse

raw = sys.argv[1]
parsed = urlparse(raw)
if parsed.scheme not in {"http", "https"}:
    raise SystemExit("APP_URL must start with http:// or https://")
if not parsed.hostname:
    raise SystemExit("APP_URL must include a hostname")

port = parsed.port or (443 if parsed.scheme == "https" else 80)
print(parsed.hostname)
print(port)
PY
)

  [[ "${#APP_URL_PARTS[@]}" -eq 2 ]] || die "Invalid --app-url value: $url"
  APP_HOST="${APP_URL_PARTS[0]}"
  APP_PORT_VALUE="${APP_URL_PARTS[1]}"
}

write_env_var() {
  local key="$1"
  local value="$2"

  if [[ -f .env ]] && grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" .env
  else
    printf '%s="%s"\n' "$key" "$value" >> .env
  fi
}

bootstrap_mysql_if_needed() {
  if [[ "$SKIP_DB_BOOTSTRAP" == "1" ]]; then
    warn "Skipping database bootstrap because SKIP_DB_BOOTSTRAP=1"
    return
  fi

  require_command mysql

  local mysql_pw_args=()
  if [[ -n "$MYSQL_ROOT_PASSWORD" ]]; then
    mysql_pw_args=("-p${MYSQL_ROOT_PASSWORD}")
  fi

  local escaped_password
  escaped_password="$(sql_escape "$DB_PASSWORD")"

  local sql
  sql=$(cat <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${escaped_password}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${escaped_password}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${escaped_password}';
ALTER USER '${DB_USER}'@'%' IDENTIFIED BY '${escaped_password}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
EOF
)

  log "Bootstrapping MySQL database and user on ${DB_HOST}:${DB_PORT}"
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$MYSQL_ROOT_USER" "${mysql_pw_args[@]}" -e "$sql" || {
    die "Failed to create/update MySQL database or user. Set MYSQL_ROOT_PASSWORD if required."
  }
}

resolve_bind_host() {
  if [[ -n "$BIND_HOST" ]]; then
    return
  fi

  case "$APP_HOST" in
    localhost|127.0.0.1|0.0.0.0)
      BIND_HOST="$APP_HOST"
      ;;
    *)
      BIND_HOST="0.0.0.0"
      ;;
  esac
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --db-name)
        DB_NAME="${2:-}"
        shift 2
        ;;
      --db-user)
        DB_USER="${2:-}"
        shift 2
        ;;
      --db-password)
        DB_PASSWORD="${2:-}"
        shift 2
        ;;
      --app-url)
        APP_URL="${2:-}"
        shift 2
        ;;
      --db-host)
        DB_HOST="${2:-}"
        shift 2
        ;;
      --db-port)
        DB_PORT="${2:-}"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
  done

  [[ -n "$DB_NAME" ]] || die "Missing required option: --db-name"
  [[ -n "$DB_USER" ]] || die "Missing required option: --db-user"
  [[ -n "$DB_PASSWORD" ]] || die "Missing required option: --db-password"
  [[ -n "$APP_URL" ]] || die "Missing required option: --app-url"
}

main() {
  parse_args "$@"

  require_command python3
  validate_identifier "$DB_NAME" "Database name"
  validate_identifier "$DB_USER" "Database user"
  [[ "$DB_PORT" =~ ^[0-9]+$ ]] || die "DB port must be numeric"

  parse_app_url "$APP_URL"
  resolve_bind_host

  bootstrap_mysql_if_needed

  local encoded_user
  local encoded_password
  encoded_user="$(url_encode "$DB_USER")"
  encoded_password="$(url_encode "$DB_PASSWORD")"

  export DATABASE_URL="mysql+pymysql://${encoded_user}:${encoded_password}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  write_env_var "DATABASE_URL" "$DATABASE_URL"

  log "Configured DATABASE_URL for MySQL"
  ensure_virtualenv
  python -m pip install --upgrade pip >/dev/null
  install_requirements_if_needed
  ensure_secret_key
  run_migrations

  if [[ "$SEED_ADMIN" == "1" ]]; then
    python seed_admin.py || warn "Admin seeding failed. Continuing startup"
  fi

  start_server
}

main "$@"