#!/usr/bin/env bash
set -euo pipefail

CFG="config/methodologies_pack.json"
REPO="$(node -p "require('./${CFG}').repo")"
TAG="$(node -p "require('./${CFG}').tag")"
ASSET="$(node -p "require('./${CFG}').asset")"

if [[ -z "$TAG" || -z "$ASSET" ]]; then
  echo "❌ Set config/methodologies_pack.json tag + asset (pinned release)."
  exit 1
fi

URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"
WORK=".cache/methodologies-pack/${TAG}"
TAR="${WORK}/${ASSET}"
DEST="public/methodologies"

rm -rf "$WORK"
mkdir -p "$WORK"

echo "[pack] downloading: $URL"
curl -fL --http1.1 --retry 6 --retry-all-errors --retry-delay 1 \
  "$URL" -o "$TAR"

echo "[pack] extracting"
tar -xzf "$TAR" -C "$WORK"

# Expect tarball root: methodologies-pack/
if [[ ! -d "$WORK/methodologies-pack/methodologies" ]]; then
  echo "❌ Pack missing expected root (methodologies-pack/methodologies)"
  find "$WORK" -maxdepth 3 -type d | sed 's/^/[pack] /'
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$WORK/methodologies-pack/methodologies/" "$DEST/"
else
  cp -R "$WORK/methodologies-pack/methodologies/." "$DEST/"
fi

# Optional: store provenance somewhere app can show later
mkdir -p public/_provenance
cp -f "$WORK/methodologies-pack/PROVENANCE.json" public/_provenance/methodologies_PROVENANCE.json

echo "✅ methodologies copied to $DEST"
