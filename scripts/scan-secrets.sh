#!/usr/bin/env bash
# Fails if a credential or an env file is about to enter git history.
# Run before every push.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

fail=0

tracked_env=$(git ls-files | grep -E '(^|/)\.env' || true)
if [ -n "$tracked_env" ]; then
  echo "FAIL: env files are tracked by git:"
  echo "$tracked_env"
  fail=1
fi

# Key shapes: Anthropic, OpenAI, GitHub, Perfect Corp / YouCam, AWS, generic bearer.
patterns='sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{40,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|Bearer [A-Za-z0-9_-]{30,}'
hits=$(git ls-files -z | xargs -0 grep -nIE "$patterns" 2>/dev/null | grep -v '^scripts/scan-secrets.sh:' || true)
if [ -n "$hits" ]; then
  echo "FAIL: credential-shaped strings found in tracked files:"
  echo "$hits"
  fail=1
fi

staged=$(git diff --cached --name-only | grep -E '(^|/)\.env' || true)
if [ -n "$staged" ]; then
  echo "FAIL: env files are staged:"
  echo "$staged"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: no env files tracked, no credential-shaped strings in tracked files."
fi
exit "$fail"
