#!/usr/bin/env bash
# ==============================================================================
# set-github-variables.sh — Configure GitHub Actions Variables
# ==============================================================================
# Sets or updates repository/environment variables in GitHub Actions for Vite builds.
# Reads key-values from a .env file or prompts interactively.
#
# Requirements:
#   - GitHub CLI (`gh`) installed (https://cli.github.com)
#   - Authenticated with `gh auth login`
#
# Usage:
#   ./scripts/set-github-variables.sh [--from-env .env] [--env production] [--repo owner/repo]
# ==============================================================================
set -euo pipefail

from_env=''
env_name=''
repo_args=()

while [ $# -gt 0 ]; do
  case "$1" in
    --from-env)
      [ $# -ge 2 ] || { echo "Error: --from-env requires a file path." >&2; exit 1; }
      from_env="$2"
      shift 2
      ;;
    --env)
      [ $# -ge 2 ] || { echo "Error: --env requires an environment name (e.g. production)." >&2; exit 1; }
      env_name="$2"
      shift 2
      ;;
    --repo)
      [ $# -ge 2 ] || { echo "Error: --repo requires owner/repo." >&2; exit 1; }
      repo_args=(--repo "$2")
      shift 2
      ;;
    -h | --help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is not installed. Install it from https://cli.github.com" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

repo=$(gh repo view "${repo_args[@]}" --json nameWithOwner -q .nameWithOwner)
echo "=================================================================="
echo "Configuring GitHub Actions Variables for repository: $repo"
[ -n "$env_name" ] && echo "Target Environment: $env_name"
echo "=================================================================="

set_gh_var() {
  local var_name="$1"
  local var_value="$2"
  
  if [ -z "$var_value" ]; then
    echo "[-] Skipping empty variable $var_name"
    return 0
  fi

  local extra_flags=()
  if [ -n "$env_name" ]; then
    extra_flags=(--env "$env_name")
  fi

  echo "[+] Setting $var_name in GitHub Actions..."
  gh variable set "$var_name" "${repo_args[@]}" "${extra_flags[@]}" --body "$var_value"
}

if [ -n "$from_env" ]; then
  if [ ! -f "$from_env" ]; then
    echo "Error: File $from_env not found." >&2
    exit 1
  fi
  echo "Reading variables from $from_env..."
  while IFS='=' read -r key value || [ -n "$key" ]; do
    # Trim leading/trailing whitespace
    key=$(echo "$key" | xargs)
    # Ignore comments and empty lines
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    # Only process VITE_ or public variables
    if [[ "$key" =~ ^VITE_ ]]; then
      value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" | xargs)
      set_gh_var "$key" "$value"
    fi
  done < "$from_env"
else
  echo ""
  echo "Interactive Mode: Enter values to configure in GitHub (press Enter to skip/keep unchanged)."
  echo ""

  # 1. VITE_REST_API_BASE_URL
  current_api=$(gh variable list "${repo_args[@]}" --json name,value -q '.[] | select(.name == "VITE_REST_API_BASE_URL") | .value' 2>/dev/null || true)
  echo "Current VITE_REST_API_BASE_URL: ${current_api:-(not set)}"
  read -r -p "New VITE_REST_API_BASE_URL (e.g. https://api.exemplo.com/api): " api_val
  [ -n "$api_val" ] && set_gh_var "VITE_REST_API_BASE_URL" "$api_val"

  # 2. VITE_GA4_MEASUREMENT_ID
  current_ga4=$(gh variable list "${repo_args[@]}" --json name,value -q '.[] | select(.name == "VITE_GA4_MEASUREMENT_ID") | .value' 2>/dev/null || true)
  echo "Current VITE_GA4_MEASUREMENT_ID: ${current_ga4:-(not set)}"
  while true; do
    read -r -p "New VITE_GA4_MEASUREMENT_ID (G-XXXXXXXXXX, or Enter to skip): " ga4_val
    [ -z "$ga4_val" ] && break
    if [[ "$ga4_val" =~ ^[Gg]-[A-Za-z0-9]+$ ]]; then
      ga4_val=$(printf '%s' "$ga4_val" | tr '[:lower:]' '[:upper:]')
      set_gh_var "VITE_GA4_MEASUREMENT_ID" "$ga4_val"
      break
    fi
    echo "Invalid GA4 format (must start with G-, e.g. G-ABC1234567)." >&2
  done

  # 3. VITE_APP_TITLE
  current_title=$(gh variable list "${repo_args[@]}" --json name,value -q '.[] | select(.name == "VITE_APP_TITLE") | .value' 2>/dev/null || true)
  echo "Current VITE_APP_TITLE: ${current_title:-(not set)}"
  read -r -p "New VITE_APP_TITLE (or Enter to skip): " title_val
  [ -n "$title_val" ] && set_gh_var "VITE_APP_TITLE" "$title_val"
fi

echo ""
echo "Done! You can verify settings at: https://github.com/$repo/settings/variables/actions"
