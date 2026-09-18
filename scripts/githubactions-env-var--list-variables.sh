#!/usr/bin/env bash
# Lista as variables do GitHub Actions do repositório — as VITE_* que o
# workflow de build injeta no Vite (ver .env.example e o roadmap, M5).
#
# Serve de conferência antes de um deploy: é aqui que se vê se o app tem,
# por exemplo, VITE_GA4_MEASUREMENT_ID definida e com que valor. Variables
# guardam valor visível; secrets, não — por isso --secrets lista só os
# nomes, que é tudo o que a API devolve.
#
# Cada app que usa o appshell tem as suas próprias variables, então rode a
# partir da raiz do repositório do app (o gh usa o remote dali).
#
# Uso: scripts/githubactions-env-var--list-variables.sh [opções]
#   --repo dono/repo   outro repositório, em vez do remote atual
#   --env <ambiente>   variables de um Environment (ex.: production)
#   --secrets          lista também os nomes dos secrets
#   --json             saída em JSON, para usar em outro script
set -euo pipefail

repo_args=()
env_args=()
ambiente=''
com_secrets=false
formato='table'

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)
      [ $# -ge 2 ] || { echo "--repo exige dono/repo" >&2; exit 1; }
      repo_args=(--repo "$2")
      shift 2
      ;;
    --env)
      [ $# -ge 2 ] || { echo "--env exige o nome do ambiente" >&2; exit 1; }
      ambiente="$2"
      env_args=(--env "$2")
      shift 2
      ;;
    --secrets)
      com_secrets=true
      shift
      ;;
    --json)
      formato='json'
      shift
      ;;
    -h | --help)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1 (use --help)" >&2
      exit 1
      ;;
  esac
done

command -v gh >/dev/null || {
  echo "gh não encontrado. Instale o GitHub CLI: https://cli.github.com" >&2
  exit 1
}
gh auth status >/dev/null 2>&1 || {
  echo "gh sem autenticação. Rode: gh auth login" >&2
  exit 1
}

repo=$(gh repo view "${repo_args[@]}" --json nameWithOwner -q .nameWithOwner)

if [ "$formato" = 'json' ]; then
  gh variable list "${repo_args[@]}" "${env_args[@]}" --json name,value,updatedAt
  exit 0
fi

echo "Repositório: $repo${ambiente:+  (environment: $ambiente)}"
echo
# Sem nada definido o gh devolve saída vazia (e, em alguns casos, erro):
# nenhum dos dois é falha do script, é só "ainda não há nada aqui".
listar() {
  local vazio="$1" saida
  shift
  saida=$("$@" 2>/dev/null) || true
  if [ -n "$saida" ]; then echo "$saida"; else echo "  ($vazio)"; fi
}

echo "Variables:"
listar nenhuma gh variable list "${repo_args[@]}" "${env_args[@]}"

if [ "$com_secrets" = true ]; then
  echo
  echo "Secrets (só os nomes — o valor nunca sai do GitHub):"
  listar nenhum gh secret list "${repo_args[@]}" "${env_args[@]}"
fi

echo
echo "Detalhes e edição: https://github.com/$repo/settings/variables/actions"
