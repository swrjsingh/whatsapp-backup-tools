#!/usr/bin/env bash
# Read-only: captures the frontmost window (switch to WhatsApp Desktop first).
# Saves into logs/ui-compare/desktop-2.26.41.28/ with a timestamp prefix.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/logs/ui-compare/desktop-2.26.41.28"
mkdir -p "$OUT"
label="${1:-screen}"
ts="$(date +%Y%m%d-%H%M%S)"
path="$OUT/${ts}-${label}.png"
screencapture -x "$path"
echo "Saved $path"
