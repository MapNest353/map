#!/bin/bash
set -e

VERSION_FILE="js/version.js"

CURRENT=$(grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' "$VERSION_FILE" | head -1)
IFS=. read -r MAJOR MINOR PATCH <<< "${CURRENT#v}"
NEW_VERSION="v${MAJOR}.${MINOR}.$((PATCH + 1))"
UPDATED=$(date '+%d %b %Y, %H:%M:%S')

python3 - "$VERSION_FILE" "$NEW_VERSION" "$UPDATED" <<'PY'
from pathlib import Path
import re, sys

p = Path(sys.argv[1])
version = sys.argv[2]
updated = sys.argv[3]

s = p.read_text()
s = re.sub(r'window\.MAPNEST_VERSION\s*=\s*"[^"]*"', f'window.MAPNEST_VERSION = "{version}"', s)
s = re.sub(r'window\.MAPNEST_UPDATED\s*=\s*"[^"]*"', f'window.MAPNEST_UPDATED = "{updated}"', s)
p.write_text(s)
PY

git add .
git commit -m "Publish $NEW_VERSION"
git push origin main

echo
echo "========================================"
echo " MapNest published"
echo " Version: $NEW_VERSION"
echo " Updated: $UPDATED"
echo "========================================"
