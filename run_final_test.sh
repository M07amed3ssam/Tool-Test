#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$ROOT_DIR/Final test"
VENV_DIR=""
PYTHON_BIN=""
PKG_MANAGER="none"
PKG_INDEX_REFRESHED=0
SKIP_SYSTEM_DEPS=0
RECREATE_VENV=0
PYTEST_ARGS=()


log() {
  printf '[run_final_test] %s\n' "$*"
}


warn() {
  printf '[run_final_test] WARNING: %s\n' "$*" >&2
}


die() {
  printf '[run_final_test] ERROR: %s\n' "$*" >&2
  exit 1
}


usage() {
  cat <<'EOF'
Usage:
  ./run_final_test.sh [options] [-- pytest_args]

Options:
  --project-dir PATH       Project folder (default: ./Final test)
  --venv-dir PATH          Virtualenv path (default: <project-dir>/.venv)
  --skip-system-deps       Do not install OS packages
  --recreate-venv          Delete and recreate virtualenv before install
  --help, -h               Show this help

Examples:
  ./run_final_test.sh
  ./run_final_test.sh -- --maxfail=1 -vv
  ./run_final_test.sh --project-dir "/opt/Last-Version/Final test"

What this script does:
  1) Installs missing Python runtime packages on fresh Linux servers
  2) Creates/activates a virtualenv
  3) Installs requirements + pytest
  4) Runs pytest for the Final test project
EOF
}


has_cmd() {
  command -v "$1" >/dev/null 2>&1
}


run_root() {
  if [[ "$EUID" -eq 0 ]]; then
    "$@"
    return
  fi

  if has_cmd sudo; then
    sudo "$@"
    return
  fi

  die "Root privileges are required for package installation (use root or install sudo)."
}


detect_pkg_manager() {
  if has_cmd apt-get; then
    PKG_MANAGER="apt"
  elif has_cmd dnf; then
    PKG_MANAGER="dnf"
  elif has_cmd yum; then
    PKG_MANAGER="yum"
  elif has_cmd pacman; then
    PKG_MANAGER="pacman"
  else
    PKG_MANAGER="none"
  fi
}


install_packages() {
  local packages=("$@")
  if [[ "${#packages[@]}" -eq 0 ]]; then
    return 0
  fi

  if [[ "$PKG_MANAGER" == "none" ]]; then
    return 1
  fi

  case "$PKG_MANAGER" in
    apt)
      if [[ "$PKG_INDEX_REFRESHED" -eq 0 ]]; then
        log "Refreshing apt package index"
        run_root apt-get update -y
        PKG_INDEX_REFRESHED=1
      fi
      log "Installing apt packages: ${packages[*]}"
      run_root apt-get install -y "${packages[@]}"
      ;;
    dnf)
      log "Installing dnf packages: ${packages[*]}"
      run_root dnf install -y "${packages[@]}"
      ;;
    yum)
      log "Installing yum packages: ${packages[*]}"
      run_root yum install -y "${packages[@]}"
      ;;
    pacman)
      if [[ "$PKG_INDEX_REFRESHED" -eq 0 ]]; then
        log "Refreshing pacman package index"
        run_root pacman -Sy --noconfirm
        PKG_INDEX_REFRESHED=1
      fi
      log "Installing pacman packages: ${packages[*]}"
      run_root pacman -S --noconfirm --needed "${packages[@]}"
      ;;
  esac
}


install_python_runtime_if_needed() {
  if has_cmd python3; then
    return
  fi

  [[ "$SKIP_SYSTEM_DEPS" -eq 0 ]] || die "python3 is missing and --skip-system-deps was set."

  detect_pkg_manager

  case "$PKG_MANAGER" in
    apt)
      install_packages python3 python3-pip python3-venv
      ;;
    dnf|yum)
      install_packages python3 python3-pip
      ;;
    pacman)
      install_packages python python-pip
      ;;
    *)
      die "No supported package manager found to install python3."
      ;;
  esac
}


install_venv_support_if_needed() {
  if "$PYTHON_BIN" -m venv --help >/dev/null 2>&1; then
    return
  fi

  [[ "$SKIP_SYSTEM_DEPS" -eq 0 ]] || die "python venv module is missing and --skip-system-deps was set."

  detect_pkg_manager
  case "$PKG_MANAGER" in
    apt)
      install_packages python3-venv
      ;;
    *)
      warn "Could not map venv package for $PKG_MANAGER."
      ;;
  esac

  "$PYTHON_BIN" -m venv --help >/dev/null 2>&1 || die "python venv support is still unavailable."
}


ensure_python_bin() {
  install_python_runtime_if_needed

  if has_cmd python3; then
    PYTHON_BIN="python3"
  elif has_cmd python; then
    PYTHON_BIN="python"
  else
    die "Python is not available."
  fi

  install_venv_support_if_needed
}


prepare_virtualenv() {
  if [[ "$RECREATE_VENV" -eq 1 && -d "$VENV_DIR" ]]; then
    log "Recreating virtualenv at $VENV_DIR"
    rm -rf "$VENV_DIR"
  fi

  if [[ ! -d "$VENV_DIR" ]]; then
    log "Creating virtualenv at $VENV_DIR"
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  fi

  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
}


install_python_dependencies() {
  log "Upgrading pip"
  python -m pip install --upgrade pip

  log "Installing project requirements"
  python -m pip install -r requirements.txt

  log "Installing pytest"
  python -m pip install pytest
}


run_tests() {
  local cmd=(python -m pytest -q)
  if [[ "${#PYTEST_ARGS[@]}" -gt 0 ]]; then
    cmd+=("${PYTEST_ARGS[@]}")
  fi

  log "Running Final test suite"
  "${cmd[@]}"
}


parse_args() {
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --project-dir)
        PROJECT_DIR="${2:-}"
        shift 2
        ;;
      --venv-dir)
        VENV_DIR="${2:-}"
        shift 2
        ;;
      --skip-system-deps)
        SKIP_SYSTEM_DEPS=1
        shift
        ;;
      --recreate-venv)
        RECREATE_VENV=1
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      --)
        shift
        if [[ "$#" -gt 0 ]]; then
          PYTEST_ARGS+=("$@")
        fi
        break
        ;;
      *)
        PYTEST_ARGS+=("$1")
        shift
        ;;
    esac
  done
}


main() {
  parse_args "$@"

  [[ -d "$PROJECT_DIR" ]] || die "Project directory not found: $PROJECT_DIR"
  [[ -f "$PROJECT_DIR/requirements.txt" ]] || die "requirements.txt not found in: $PROJECT_DIR"

  if [[ -z "$VENV_DIR" ]]; then
    VENV_DIR="$PROJECT_DIR/.venv"
  fi

  ensure_python_bin

  cd "$PROJECT_DIR"
  prepare_virtualenv
  install_python_dependencies
  run_tests
}


main "$@"