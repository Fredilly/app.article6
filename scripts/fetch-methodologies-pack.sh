#!/usr/bin/env bash
set -euo pipefail

CFG="config/methodologies_pack.json"
REPO="$(node -p "require('./${CFG}').repo")"
TAG="$(node -p "require('./${CFG}').tag")"
ASSET="$(node -p "const c=require('./${CFG}'); c.asset || ''")"
REF="$(node -p "const c=require('./${CFG}'); c.ref || ''")"
TAG_SHA="${TAG#methodologies-pack-}"
PIN_SHA="${REF:-$TAG_SHA}"

if [[ -z "$TAG" || -z "$PIN_SHA" ]]; then
  echo "❌ Set config/methodologies_pack.json tag plus asset or ref."
  exit 1
fi

if [[ -n "$ASSET" ]]; then
  URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"
fi
WORK=".cache/methodologies-pack/${TAG}"
TAR_NAME="${ASSET:-${TAG}.tar.gz}"
TAR="${WORK}/${TAR_NAME}"
DEST="public/methodologies"
PROV_DEST="public/_provenance/methodologies_PROVENANCE.json"

if [[ -d "$DEST" && -f "$PROV_DEST" ]]; then
  EXISTING_SHA="$(node -p "try { const p = require('./${PROV_DEST}'); typeof p.sha === 'string' ? p.sha : '' } catch { '' }")"
  if [[ -n "$EXISTING_SHA" && "${EXISTING_SHA}" == "${PIN_SHA}"* ]] && find "$DEST" -mindepth 1 -print -quit >/dev/null 2>&1; then
    echo "[pack] using existing pinned methodologies in $DEST (${EXISTING_SHA})"
    exit 0
  fi
fi

rm -rf "$WORK"
mkdir -p "$WORK"

if [[ -n "$ASSET" ]]; then
  echo "[pack] downloading: $URL"
  curl -fL --http1.1 --retry 6 --retry-all-errors --retry-delay 1 \
    "$URL" -o "$TAR"

  echo "[pack] extracting"
  tar -xzf "$TAR" -C "$WORK"

  PACK_METHODS_DIR="$(find "$WORK" -mindepth 2 -maxdepth 4 -type d -name methodologies | head -n 1)"
  if [[ -z "$PACK_METHODS_DIR" ]]; then
    echo "❌ Pack missing methodologies directory"
    find "$WORK" -maxdepth 4 -type d | sed 's/^/[pack] /'
    exit 1
  fi
  PACK_ROOT="$(dirname "$PACK_METHODS_DIR")"
else
  REPO_DIR="$WORK/repo"
  echo "[pack] sparse-cloning ${REPO}@${REF}"
  git clone --depth 1 --filter=blob:none --sparse "https://github.com/${REPO}.git" "$REPO_DIR"
  if ! git -C "$REPO_DIR" checkout --detach "$REF" >/dev/null 2>&1; then
    git -C "$REPO_DIR" fetch --depth 1 origin "$REF"
    git -C "$REPO_DIR" checkout --detach FETCH_HEAD
  fi
  git -C "$REPO_DIR" sparse-checkout set methodologies
  PACK_METHODS_DIR="$REPO_DIR/methodologies"
  PACK_ROOT="$REPO_DIR"
fi

rm -rf "$DEST"
mkdir -p "$DEST"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "${PACK_METHODS_DIR}/" "$DEST/"
else
  cp -R "${PACK_METHODS_DIR}/." "$DEST/"
fi

mkdir -p public/_provenance
if [[ -f "${PACK_ROOT}/PROVENANCE.json" ]]; then
  cp -f "${PACK_ROOT}/PROVENANCE.json" "$PROV_DEST"
else
  GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  cat > "$PROV_DEST" <<EOF
{
  "repo": "${REPO}",
  "sha": "${PIN_SHA}",
  "generated_at": "${GENERATED_AT}",
  "provenance": {
    "tag": "${TAG}",
    "source": "archive"
  }
}
EOF
fi

echo "✅ methodologies copied to $DEST"
