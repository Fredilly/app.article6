#!/usr/bin/env bash
set -euo pipefail

PIN_FILE="config/methodologies_source.json"
REPO="$(node -p "require('./${PIN_FILE}').repo")"
REF="$(node -p "require('./${PIN_FILE}').ref")"
PINNED_SHA="$(node -p "require('./${PIN_FILE}').pinned_sha || ''")"

WORK=".cache/article6-methodologies"
SRC_PATH="methodologies"
DEST="public/methodologies"

echo "[sync] repo=$REPO ref=$REF pinned_sha=${PINNED_SHA:-<none>}"

rm -rf "$WORK"
mkdir -p "$(dirname "$WORK")"

git clone --filter=blob:none --no-checkout "https://github.com/${REPO}.git" "$WORK" >/dev/null
cd "$WORK"

# Prefer pinned sha if set; otherwise REF
TARGET="${PINNED_SHA:-$REF}"
git fetch --depth=1 origin "$TARGET" >/dev/null
git sparse-checkout init --cone >/dev/null
git sparse-checkout set "$SRC_PATH" >/dev/null
git checkout --detach FETCH_HEAD >/dev/null

cd - >/dev/null

rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a --delete "$WORK/$SRC_PATH/" "$DEST/"

echo "[sync] copied $WORK/$SRC_PATH -> $DEST"
