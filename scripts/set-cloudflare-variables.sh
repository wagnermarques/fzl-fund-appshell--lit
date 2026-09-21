#!/usr/bin/env bash
# ==============================================================================
# set-cloudflare-variables.sh — Configure Cloudflare Pages Variables
# ==============================================================================
# Sets or updates environment variables / secrets for a Cloudflare Pages project.
# Reads key-values from a .env file or prompts interactively.
#
# Requirements:
#   - Wrangler CLI (`npx wrangler` or `npm install -g wrangler`)
#   - Logged in via `npx wrangler login` or CLOUDFLARE_API_TOKEN set.
#
# Usage:
#   ./scripts/set-cloudflare-variables.sh [--project my-pwa-app] [--from-env .env] [--env production]
# ==============================================================================
set -euo pipefail

project_name=''
from_env=''
env_type='production'

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      [ $# -ge 2 ] || { echo "Error: --project requires a project name." >&2; exit 1; }
      project_name="$2"
      shift 2
      ;;
    --from-env)
      [ $# -ge 2 ] || { echo "Error: --from-env requires a file path." >&2; exit 1; }
      from_env="$2"
      shift 2
      ;;
    --env)
      [ $# -ge 2 ] || { echo "Error: --env requires an environment (production/preview)." >&2; exit 1; }
      env_type="$2"
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

if [ -z "$project_name" ]; then
  # Default to package.json name if available
  if [ -f "package.json" ]; then
    pkg_name=$(node -e "try { console.log(JSON.parse(require('fs').readFileSync('package.json')).name) } catch { }" 2>/dev/null || true)
    if [ -n "$pkg_name" ]; then
      read -r -p "Cloudflare Pages project name [default: $pkg_name]: " input_name
      project_name="${input_name:-$pkg_name}"
    fi
  fi
  if [ -z "$project_name" ]; then
    read -r -p "Enter Cloudflare Pages project name: " project_name
  fi
fi

if [ -z "$project_name" ]; then
  echo "Error: Project name is required." >&2
  exit 1
fi

echo "=================================================================="
echo "Configuring Cloudflare Pages for Project: $project_name ($env_type)"
echo "=================================================================="

set_cf_var() {
  local var_name="$1"
  local var_value="$2"
  
  if [ -z "$var_value" ]; then
    echo "[-] Skipping empty variable $var_name"
    return 0
  fi

  echo "[+] Uploading $var_name to Cloudflare Pages project $project_name..."
  # Use wrangler pages secret put
  printf '%s' "$var_value" | npx wrangler pages secret put "$var_name" --project-name "$project_name"
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
      set_cf_var "$key" "$value"
    fi
  done < "$from_env"
else
  echo ""
  echo "Interactive Mode: Enter values for Cloudflare Pages (press Enter to skip)."
  echo ""

  read -r -p "VITE_REST_API_BASE_URL (e.g. https://api.exemplo.com/api): " api_val
  [ -n "$api_val" ] && set_cf_var "VITE_REST_API_BASE_URL" "$api_val"

  while true; do
    read -r -p "VITE_GA4_MEASUREMENT_ID (G-XXXXXXXXXX, or Enter to skip): " ga4_val
    [ -z "$ga4_val" ] && break
    if [[ "$ga4_val" =~ ^[Gg]-[A-Za-z0-9]+$ ]]; then
      ga4_val=$(printf '%s' "$ga4_val" | tr '[:lower:]' '[:upper:]')
      set_cf_var "VITE_GA4_MEASUREMENT_ID" "$ga4_val"
      break
    fi
    echo "Invalid GA4 format (must start with G-, e.g. G-ABC1234567)." >&2
  done

  read -r -p "VITE_APP_TITLE (or Enter to skip): " title_val
  [ -n "$title_val" ] && set_cf_var "VITE_APP_TITLE" "$title_val"
fi

echo ""
echo "Done! Cloudflare Pages secrets and variables configured for $project_name."
