#!/usr/bin/env bash
# release-pack.sh — bump pack version, tag, validate, dry-run publish.
#
# Usage:
#   tools/release/release-pack.sh --version=YYYY.MM.N
#
# After this script succeeds, the maintainer runs `npm publish --access=restricted`
# manually to push the release to npm. This intentional separation prevents
# accidental publishes from automation.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

new_version=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version=*) new_version="${1#*=}"; shift ;;
    --help|-h) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$new_version" ]; then
  echo "error: --version=YYYY.MM.N required" >&2
  exit 2
fi
if ! [[ "$new_version" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]+$ ]]; then
  echo "error: version must match YYYY.MM.N (got '$new_version')" >&2
  exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree dirty. Commit before releasing." >&2
  exit 1
fi

echo "==> running full validator suite..."
bash tools/ci/_run-all.sh

echo "==> bumping VERSION pack field to $new_version..."
sed -i.bak -E "s/^pack:.*/pack: $new_version/" VERSION
rm -f VERSION.bak

echo "==> mirroring version into package.json..."
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = '$new_version';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"

echo "==> committing version bump..."
git add VERSION package.json
git commit -m "[U] release: pack v$new_version"

echo "==> tagging v$new_version..."
git tag -a "v$new_version" -m "IC pack release $new_version"

echo "==> npm pack --dry-run preview..."
npm pack --dry-run 2>&1 | head -40

echo
echo "==> Release prepared."
echo "    Tag: v$new_version (local; not pushed)"
echo "    Next steps:"
echo "      1. Review the npm pack --dry-run output above for unexpected files."
echo "      2. git push origin main && git push origin v$new_version"
echo "      3. npm publish --access=restricted    (manual; not automated)"
