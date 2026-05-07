#!/usr/bin/env bash
# preflight-secrets-check.sh — Pre-deploy gate for Firebase Functions secrets.
#
# Purpose: Block any `firebase deploy --only functions` when one or more
# `defineSecret('NAME')` declarations in functions/src/ resolve to either:
#   - a `PENDING_SET_*` Firebase placeholder (never provisioned), or
#   - an empty value
#
# Without this gate, Firebase will happily deploy functions whose secret
# values are placeholder strings — every cryptographic operation that depends
# on the secret will silently use the placeholder as its key. ADR-0017
# documents the 15-day window where exactly this happened to
# HCQ_SIGNATURE_HMAC_KEY. ADR-0018 introduces this script as the preventive
# control.
#
# Usage:
#   bash scripts/preflight-secrets-check.sh
#   bash scripts/preflight-secrets-check.sh --allow-pending-secrets   # emergency override
#
# Exit codes:
#   0 — all declared secrets have a real value (or override flag passed)
#   1 — at least one declared secret is unprovisioned
#   2 — environmental error (firebase CLI missing, not authenticated, etc.)
#
# Reference: docs/adr/ADR-0018-deploy-gate-secret-status-check.md

set -u

PROJECT_ID="hmatologia2"
ALLOW_PENDING=0
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
GREEN=$'\033[0;32m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

for arg in "$@"; do
  case "$arg" in
    --allow-pending-secrets) ALLOW_PENDING=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "${RED}Unknown flag: $arg${RESET}" >&2
      exit 2
      ;;
  esac
done

# Resolve repo root so the script works no matter where it's invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_SRC="$REPO_ROOT/functions/src"

if [ ! -d "$FUNCTIONS_SRC" ]; then
  echo "${RED}ERROR:${RESET} cannot locate functions/src at $FUNCTIONS_SRC" >&2
  exit 2
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "${RED}ERROR:${RESET} firebase CLI not found in PATH" >&2
  exit 2
fi

echo "${BOLD}preflight-secrets-check${RESET} — project ${PROJECT_ID}"
echo "scanning $FUNCTIONS_SRC for defineSecret() declarations..."

# 1. Discover every secret name referenced via defineSecret('NAME') in functions/src.
#    grep -rho extracts only the matching part across all .ts files.
DECLARED_RAW="$(grep -rho "defineSecret(['\"][A-Z0-9_]\+['\"])" "$FUNCTIONS_SRC" 2>/dev/null \
  | sed -E "s/defineSecret\(['\"]([A-Z0-9_]+)['\"]\)/\1/" \
  | sort -u)"

if [ -z "$DECLARED_RAW" ]; then
  echo "${YELLOW}No defineSecret() calls found in functions/src — nothing to check.${RESET}"
  exit 0
fi

DECLARED_COUNT="$(printf '%s\n' "$DECLARED_RAW" | wc -l | tr -d ' ')"
echo "found ${DECLARED_COUNT} declared secret(s):"
printf '  - %s\n' $DECLARED_RAW

# 2. For each declared secret, fetch the latest value via firebase CLI and
#    classify it. We use `functions:secrets:access` which prints the raw value
#    on stdout (no JSON wrapper) and writes errors to stderr.
MISSING=()
ERRORED=()

while IFS= read -r SECRET; do
  [ -z "$SECRET" ] && continue
  # 2>/dev/null suppresses noise; we capture stdout only.
  VALUE="$(firebase functions:secrets:access "$SECRET" --project "$PROJECT_ID" 2>/dev/null || true)"
  if [ -z "$VALUE" ]; then
    ERRORED+=("$SECRET")
    continue
  fi
  # Strip trailing whitespace/newlines that some shells inject.
  VALUE_TRIMMED="$(printf '%s' "$VALUE" | tr -d '[:space:]')"
  if [ -z "$VALUE_TRIMMED" ]; then
    MISSING+=("$SECRET (empty)")
  elif [[ "$VALUE_TRIMMED" == PENDING_SET_* ]]; then
    MISSING+=("$SECRET (placeholder: $VALUE_TRIMMED)")
  fi
done <<< "$DECLARED_RAW"

# 3. Report.
if [ "${#ERRORED[@]}" -gt 0 ]; then
  echo
  echo "${YELLOW}WARNING:${RESET} could not read the following secret(s) (missing permission, secret not yet created, or auth expired):"
  for s in "${ERRORED[@]}"; do echo "  - $s"; done
  # Treat unreadable secrets as missing — better to fail loud than ship a placeholder.
  MISSING+=("${ERRORED[@]}")
fi

if [ "${#MISSING[@]}" -eq 0 ]; then
  echo
  echo "${GREEN}OK${RESET} — all ${DECLARED_COUNT} declared secret(s) have real values. Safe to deploy."
  exit 0
fi

echo
echo "${RED}${BOLD}BLOCKED${RESET} — ${#MISSING[@]} secret(s) are unprovisioned or unreadable:"
for s in "${MISSING[@]}"; do
  echo "  ${RED}*${RESET} $s"
done
echo
echo "${BOLD}To fix:${RESET}"
for s in "${MISSING[@]}"; do
  NAME="${s%% *}"
  echo "  firebase functions:secrets:set ${NAME} --project ${PROJECT_ID}"
done
echo
echo "Reference: docs/adr/ADR-0018-deploy-gate-secret-status-check.md"
echo "Reference: docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md (the incident this prevents)"

if [ "$ALLOW_PENDING" -eq 1 ]; then
  echo
  echo "${YELLOW}${BOLD}OVERRIDE:${RESET}${YELLOW} --allow-pending-secrets passed. Proceeding despite missing secrets.${RESET}"
  echo "${YELLOW}This MUST be logged in the deploy notes and reviewed within 24h.${RESET}"
  exit 0
fi

exit 1
