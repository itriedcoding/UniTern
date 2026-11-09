#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
ARTIFACTS="release"

echo "→ Building UniTern ${VERSION}"
npm run build

echo "→ Building the demo game"
rm -rf dist-demo
node cli/unitern.mjs build templates/platformer --out "$PWD/dist-demo"

echo "→ Packaging artifacts"
rm -rf "$ARTIFACTS"
mkdir -p "$ARTIFACTS"

npm pack --pack-destination "$ARTIFACTS" > /dev/null

(cd dist/editor && zip -qr "../../${ARTIFACTS}/unitern-editor-${VERSION}.zip" .)
(cd templates && zip -qr "../${ARTIFACTS}/unitern-starter-template-${VERSION}.zip" starter)
mv dist-demo/index.html "${ARTIFACTS}/unitern-demo-skyward-run-${VERSION}.html"
rm -rf dist-demo templates/platformer/dist-demo

if git rev-parse --git-dir > /dev/null 2>&1; then
  git archive --format=zip --prefix="unitern-${VERSION}/" -o "${ARTIFACTS}/unitern-${VERSION}-source.zip" HEAD
fi

if command -v sha256sum > /dev/null 2>&1; then
  (cd "$ARTIFACTS" && sha256sum ./* > SHA256SUMS.txt)
else
  (cd "$ARTIFACTS" && shasum -a 256 ./* > SHA256SUMS.txt)
fi

echo
echo "  Release artifacts in ${ARTIFACTS}/"
ls -lh "$ARTIFACTS"
