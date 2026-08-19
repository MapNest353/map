#!/bin/bash

cd "$(dirname "$0")"

VERSION_FILE="js/version.js"

CURRENT=$(grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' "$VERSION_FILE" | head -1)

if [ -z "$CURRENT" ]; then
    CURRENT="v1.0.0"
fi

MAJOR=$(echo "$CURRENT" | cut -d. -f1 | tr -d 'v')
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)

PATCH=$((PATCH + 1))

NEW_VERSION="v${MAJOR}.${MINOR}.${PATCH}"

UPDATED=$(date '+%d %b %Y, %H:%M:%S')

cat > "$VERSION_FILE" <<EOF
window.MAPNEST_VERSION = "$NEW_VERSION";
window.MAPNEST_UPDATED = "$UPDATED";
EOF

git add .

git commit -m "Publish $NEW_VERSION"

git push

echo ""
echo "========================================"
echo " MapNest published"
echo " Version: $NEW_VERSION"
echo " Updated: $UPDATED"
echo "========================================"
echo ""
echo "Live site:"
echo "https://mapnest353.github.io/map/Map.html"
