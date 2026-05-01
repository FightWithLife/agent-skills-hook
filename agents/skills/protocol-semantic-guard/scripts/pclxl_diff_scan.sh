#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: pclxl_diff_scan.sh [--repo PATH] [--cached]

Lists changed files and highlights paths that are likely PCL XL/PJL related.
Run from a git repo root or pass --repo.
USAGE
}

repo=""
cached=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      repo="$2"
      shift 2
      ;;
    --cached)
      cached=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$repo" ]]; then
  repo="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -z "$repo" ]]; then
    echo "Not in a git repo. Use --repo PATH." >&2
    exit 1
  fi
fi

diff_args=()
if [[ $cached -eq 1 ]]; then
  diff_args+=(--cached)
fi

mapfile -t files < <(git -C "$repo" diff --name-only "${diff_args[@]}")

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No changed files in diff."
  exit 0
fi

echo "Changed files:"
printf ' - %s\n' "${files[@]}"

re='(^|/)(PCL_XL|PCLXL|pclxl|pcl6|PCL6|PJL|pjl|pl)(/|_)'
maybe=()
for f in "${files[@]}"; do
  if [[ "$f" =~ $re ]]; then
    maybe+=("$f")
  fi
done

echo
if [[ ${#maybe[@]} -gt 0 ]]; then
  echo "Potential PCL XL/PJL-related files (path match):"
  printf ' - %s\n' "${maybe[@]}"
else
  echo "No path matches found. If protocol behavior changed, still run the manual check."
fi

echo
echo "Protocol-check reminder:"
echo " - Map changes to operators/attributes and verify in docs/tech (and docs/tech_zh if needed)."
