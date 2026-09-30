#!/usr/bin/env bash
# One-time (and re-runnable) setup of the GitHub secrets used by
# .github/workflows/deploy.yml. See docs/ci-cd.md.
#
#   bash scripts/setup-github-secrets.sh
#
# What it does, against the prasadxa/sahayak repo:
#   1. creates or updates the `production` environment (PUT is idempotent) so
#      that only the `main` branch may deploy to it (deployment branch policy)
#   2. sets these environment secrets on `production`:
#        CALLMISSED_API_KEY     read from .env.local
#        CONVEX_DEPLOY_KEY      prompted, hidden input
#        CLOUDFLARE_API_TOKEN   prompted, hidden input
#        CLOUDFLARE_ACCOUNT_ID  fixed account id below
#   3. prints the names it set (never the values)
#
# Leaving a prompt empty keeps the existing secret. Values go to `gh secret set`
# on stdin, so they never show up in argv, shell history or this terminal.
# Needs bash (macOS /bin/bash 3.2 is fine) and gh >= 2.30.

set -euo pipefail

REPO="${REPO:-prasadxa/sahayak}"
GH_USER="${GH_USER:-prasadxa}"
ENV_NAME="production"
CLOUDFLARE_ACCOUNT_ID_VALUE="337c662fed500c2dff530141baaf75c9"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
info() { printf '%s\n' "$*"; }

command -v gh >/dev/null 2>&1 || die "the GitHub CLI (gh) is not installed. See https://cli.github.com/"
# The deploy key and API token are typed at hidden prompts, so we need a terminal.
{ : </dev/tty; } 2>/dev/null || die "run this from an interactive terminal (it prompts for secrets)."

# --- 1. gh must be logged in as $GH_USER, and that account must be active ----
auth_status="$(gh auth status --hostname github.com 2>&1 || true)"
if ! printf '%s\n' "$auth_status" | grep -Eq "account ${GH_USER}( |\$)"; then
  die "gh is not logged in as ${GH_USER}. Run: gh auth login --hostname github.com (as ${GH_USER})"
fi
active_user="$(gh api user --jq .login 2>/dev/null || true)"
if [ "$active_user" != "$GH_USER" ]; then
  die "the active gh account is '${active_user:-unknown}', not ${GH_USER}. Run: gh auth switch -u ${GH_USER}  (then re-run this script)"
fi
gh repo view "$REPO" --json name >/dev/null 2>&1 || die "cannot access ${REPO} as ${GH_USER}."
info "gh: using account ${GH_USER} on ${REPO}"

# --- 2. production environment, deployable from main only --------------------
# PUT creates the environment or updates it in place. Custom branch policies
# (instead of "protected branches only") let us allow exactly `main`.
printf '%s' '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
  | gh api --silent -X PUT "repos/${REPO}/environments/${ENV_NAME}" --input - >/dev/null \
  || die "could not create or update the ${ENV_NAME} environment on ${REPO}."
info "environment: ${ENV_NAME} (created or updated; custom deployment branch policies)"

policies_path="repos/${REPO}/environments/${ENV_NAME}/deployment-branch-policies"
has_main_policy="$(gh api "$policies_path" --paginate \
  --jq '.branch_policies[] | select(.name == "main" and ((.type // "branch") == "branch")) | .id' 2>/dev/null || true)"
if [ -n "$has_main_policy" ]; then
  info "branch policy: main (already present)"
else
  # A duplicate is answered with "already exists" (or a 303 to the existing
  # policy); both mean the policy is in place.
  if policy_out="$(gh api --silent -X POST "$policies_path" -f name=main -f type=branch 2>&1)"; then
    info "branch policy: main (created)"
  elif printf '%s\n' "$policy_out" | grep -qiE 'already exists|HTTP 303'; then
    info "branch policy: main (already present)"
  else
    printf '%s\n' "$policy_out" >&2
    die "could not add the 'main' deployment branch policy to ${ENV_NAME}."
  fi
fi

existing="$(gh secret list --repo "$REPO" --env "$ENV_NAME" --json name --jq '.[].name' 2>/dev/null || true)"
has_secret() { printf '%s\n' "$existing" | grep -qx "$1"; }

SET=()
KEPT=()
MISSING=()

# set_secret NAME VALUE_VAR: pipes the value of the variable named VALUE_VAR to
# `gh secret set` on stdin (process substitution keeps SET in this shell and
# adds no trailing newline).
set_secret() {
  gh secret set "$1" --repo "$REPO" --env "$ENV_NAME" < <(printf '%s' "${!2}") >/dev/null
  SET+=("$1")
}

# --- 3a. CALLMISSED_API_KEY from .env.local ----------------------------------
cm_key=""
if [ -f "$ENV_FILE" ]; then
  # Last CALLMISSED_API_KEY= line; strip CR, surrounding quotes and whitespace.
  cm_key="$(grep -E '^[[:space:]]*(export[[:space:]]+)?CALLMISSED_API_KEY=' "$ENV_FILE" | tail -n 1 \
    | sed -E 's/^[[:space:]]*(export[[:space:]]+)?CALLMISSED_API_KEY=//' | tr -d '\r' \
    | sed -E 's/^[[:space:]]+|[[:space:]]+$//g; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')" || true
fi
if [ -n "$cm_key" ]; then
  set_secret CALLMISSED_API_KEY cm_key
elif has_secret CALLMISSED_API_KEY; then
  info "note: CALLMISSED_API_KEY not found in .env.local; keeping the existing GitHub secret."
  KEPT+=(CALLMISSED_API_KEY)
else
  info "note: CALLMISSED_API_KEY not found in .env.local. The deploy fails unless the sahayak worker already has it (npx wrangler secret put CALLMISSED_API_KEY --env production)."
  MISSING+=(CALLMISSED_API_KEY)
fi
unset cm_key

# --- 3b. prompted secrets (hidden input) --------------------------------------
# prompt_secret NAME "hint"
prompt_secret() {
  local name="$1" hint="$2" value="" keep_hint=""
  if has_secret "$name"; then keep_hint=" (Enter to keep the existing value)"; fi
  printf '%s\n' "$hint"
  IFS= read -r -s -p "${name}${keep_hint}: " value </dev/tty || value=""
  printf '\n'
  value="$(printf '%s' "$value" | tr -d '\r' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  if [ -z "$value" ]; then
    if has_secret "$name"; then KEPT+=("$name"); else MISSING+=("$name"); info "  skipped: ${name} is still unset."; fi
    return 0
  fi
  if [ "$name" = "CONVEX_DEPLOY_KEY" ]; then
    case "$value" in
      prod:*\|*|dev:*\|*) ;;
      *) info "  warning: this does not look like a prod:... or dev:... deploy key; deploy.yml will reject it." ;;
    esac
  fi
  set_secret "$name" value
  value=""
}

prompt_secret CONVEX_DEPLOY_KEY \
  "Convex deploy key: dashboard.convex.dev -> sahayak -> Production (or the dev deployment) -> Deployment Settings -> General -> Generate ... Deploy Key. See docs/ci-cd.md."
prompt_secret CLOUDFLARE_API_TOKEN \
  "Cloudflare API token: dash.cloudflare.com/profile/api-tokens -> Create token -> 'Edit Cloudflare Workers' template, scoped to account ${CLOUDFLARE_ACCOUNT_ID_VALUE}."

# --- 3c. account id (not really secret, but kept with the others) -------------
set_secret CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ACCOUNT_ID_VALUE

# --- 4. report (names only) ---------------------------------------------------
info ""
info "Environment '${ENV_NAME}' on ${REPO}:"
[ "${#SET[@]}" -gt 0 ] && info "  set:     ${SET[*]}"
[ "${#KEPT[@]}" -gt 0 ] && info "  kept:    ${KEPT[*]}"
[ "${#MISSING[@]}" -gt 0 ] && info "  missing: ${MISSING[*]}"
info ""
info "Deployments to '${ENV_NAME}' are limited to the main branch."
info "Optional repo variable: NEXT_PUBLIC_SITE_URL (an https origin; defaults to https://sahayak.rough-cell-383c.workers.dev)."
info "Next: push to main or run the Deploy workflow on main (gh workflow run deploy.yml --repo ${REPO} --ref main)."
