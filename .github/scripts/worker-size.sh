#!/usr/bin/env bash
# Measures the built worker (.open-next, from `npm run cf:build`) with
# `wrangler deploy --dry-run` and compares the gzipped size with
# WORKER_GZIP_LIMIT_MIB (default 3, the Workers Free limit).
#
#   bash .github/scripts/worker-size.sh warn|fail [extra wrangler args, e.g. --env production]
#
#   warn: over the limit (or no size line) -> ::warning::, exit 0   (ci.yml)
#   fail: over the limit (or no size line) -> ::error::,   exit 1   (deploy.yml gate)
#
# Writes a size table to $GITHUB_STEP_SUMMARY and gzip_mib=<n> to
# $GITHUB_OUTPUT when those are set. Uploads nothing.
set -euo pipefail

mode="${1:-}"
case "$mode" in
  warn | fail) shift ;;
  *) echo "usage: $0 warn|fail [wrangler args...]" >&2; exit 2 ;;
esac

limit_mib="${WORKER_GZIP_LIMIT_MIB:-3}"
tmp="${RUNNER_TEMP:-$(mktemp -d)}"
out_dir="$tmp/worker-dry-run"
log="$tmp/worker-dry-run.log"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
output="${GITHUB_OUTPUT:-/dev/null}"

report() { # title message
  if [ "$mode" = fail ]; then
    echo "::error title=$1::$2"
    exit 1
  fi
  echo "::warning title=$1::$2"
}

# OPEN_NEXT_DEPLOY=true: run plain `wrangler deploy` instead of letting it hand
# off to `opennextjs-cloudflare deploy`.
OPEN_NEXT_DEPLOY=true WRANGLER_SEND_METRICS=false \
  npx wrangler deploy --dry-run --outdir "$out_dir" "$@" 2>&1 | tee "$log"

# Wrangler prints e.g. "Total Upload: 15093.23 KiB / gzip: 3071.95 KiB".
line="$(grep -E 'Total Upload: .* gzip: ' "$log" | tail -n 1 || true)"
if [ -z "$line" ]; then
  report "Worker size" "Could not find the size line in the wrangler dry-run output."
  exit 0
fi
total_kib="$(printf '%s\n' "$line" | sed -E 's/.*Total Upload: ([0-9.]+) KiB.*/\1/')"
gzip_kib="$(printf '%s\n' "$line" | sed -E 's/.*gzip: ([0-9.]+) KiB.*/\1/')"
gzip_mib="$(awk -v k="$gzip_kib" 'BEGIN { printf "%.2f", k / 1024 }')"
total_mib="$(awk -v k="$total_kib" 'BEGIN { printf "%.2f", k / 1024 }')"

echo "Worker size: ${total_mib} MiB raw, ${gzip_mib} MiB gzipped (limit ${limit_mib} MiB)"
echo "gzip_mib=${gzip_mib}" >> "$output"
{
  echo "### Worker bundle size"
  echo ""
  echo "| Raw | Gzipped | Limit |"
  echo "| --- | --- | --- |"
  echo "| ${total_mib} MiB | **${gzip_mib} MiB** | ${limit_mib} MiB |"
} >> "$summary"

if awk -v k="$gzip_kib" -v l="$limit_mib" 'BEGIN { exit !(k > l * 1024) }'; then
  report "Worker size" "Gzipped worker is ${gzip_mib} MiB, over the ${limit_mib} MiB limit (Workers Free). Deploys need Workers Paid (10 MiB, then raise WORKER_GZIP_LIMIT_MIB) or a smaller bundle."
fi
