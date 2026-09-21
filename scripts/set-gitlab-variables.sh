#!/usr/bin/env bash
# ==============================================================================
# set-gitlab-variables.sh — Configure GitLab CI/CD Variables
# ==============================================================================
# Sets or updates project-level CI/CD variables in GitLab for Vite builds.
# Reads key-values from a .env file or prompts interactively.
#
# Requirements:
#   - GitLab CLI (`glab`) installed (https://gitlab.com/gitlab-org/cli)
#   - Authenticated with `glab auth login`
#   (Or GITLAB_TOKEN environment variable set for REST API fallback)
#
# Usage:
#   ./scripts/set-gitlab-variables.sh [--repo group/project] [--from-env .env] [--env production]
# ==============================================================================
set -euo pipefail

repo_arg=''
from_env=''
env_scope='*'

while [ $# -gt 0 ]; do
  case "$1" in
    --repo | -R)
      [ $# -ge 2 ] || { echo "Error: --repo requires group/project." >&2; exit 1; }
      repo_arg="$2"
      shift 2
      ;;
    --from-env)
      [ $# -ge 2 ] || { echo "Error: --from-env requires a file path." >&2; exit 1; }
      from_env="$2"
      shift 2
      ;;
    --env)
      [ $# -ge 2 ] || { echo "Error: --env requires an environment scope." >&2; exit 1; }
      env_scope="$2"
      shift 2
      ;;
    -h | --help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v glab >/dev/null 2>&1; then
  echo "Error: GitLab CLI (glab) is not installed. Install from https://gitlab.com/gitlab-org/cli" >&2
  exit 1
fi

if ! glab auth status >/dev/null 2>&1; then
  echo "Error: glab is not authenticated. Run: glab auth login" >&2
  exit 1
fi

glab_flags=()
if [ -n "$repo_arg" ]; then
  glab_flags=(-R "$repo_arg")
fi

echo "=================================================================="
echo "Configuring GitLab CI/CD Variables (Scope: $env_scope)"
echo "=================================================================="

set_gl_var() {
  local var_name="$1"
  local var_value="$2"
  
  if [ -z "$var_value" ]; then
    echo "[-] Skipping empty variable $var_name"
    return 0
  fi

  echo "[+] Setting $var_name in GitLab CI/CD..."
  # Use glab variable set with masked=false for public VITE_ vars
  glab variable set "$var_name" "$var_value" "${glab_flags[@]}" --scope "$env_scope" --masked=false --protected=false || \
  glab variable update "$var_name" "$var_value" "${glab_flags[@]}" --scope "$env_scope" --masked=false --protected=false
}

if [ -n "$from_env" ]; then
  if [ ! -f "$from_env" ]; then
    echo "Error: File $from_env not found." >&2
    exit 1
  fi
  echo "Reading variables from $from_env..."
  while IFS='=' read -r key value || [ -n "$key" ]; do
    key=$(echo "$key" | xargs)
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    if [[ "$key" =~ ^VITE_ ]]; then
      value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" | xargs)
      set_gl_var "$key" "$value"
    fi
  done < "$from_env"
else
  echo ""
  echo "Interactive Mode: Enter values for GitLab CI/CD (press Enter to skip)."
  echo ""

  read -r -p "VITE_REST_API_BASE_URL (e.g. https://api.exemplo.com/api): " api_val
  [ -n "$api_val" ] && set_gl_var "VITE_REST_API_BASE_URL" "$api_val"

  while true; do
    read -r -p "VITE_GA4_MEASUREMENT_ID (G-XXXXXXXXXX, or Enter to skip): " ga4_val
    [ -z "$ga4_val" ] && break
    if [[ "$ga4_val" =~ ^[Gg]-[A-Za-z0-9]+$ ]]; then
      ga4_val=$(printf '%s' "$ga4_val" | tr '[:lower:]' '[:upper:]')
      set_gl_var "VITE_GA4_MEASUREMENT_ID" "$ga4_val"
      break
    fi
    echo "Invalid GA4 format (must start with G-, e.g. G-ABC1234567)." >&2
  done

  read -r -p "VITE_APP_TITLE (or Enter to skip): " title_val
  [ -n "$title_val" ] && set_gl_var "VITE_APP_TITLE" "$title_val"
fi

echo ""
echo "Done! GitLab CI/CD variables configured."
