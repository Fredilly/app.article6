#!/usr/bin/env bash
set -euo pipefail
GOLDEN="public/methodologies/UNFCCC/Forestry/AR-AM0014/v03-0/rules.rich.json"
[[ -f "$GOLDEN" ]] || { echo "❌ Missing golden rich file: $GOLDEN"; exit 1; }
echo "✅ Golden rich present: $GOLDEN"
