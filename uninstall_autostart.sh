#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UID_NUM="$(id -u)"
LA_DIR="$HOME/Library/LaunchAgents"

BACK_ID="com.fazendaideal.backend"
FRONT_ID="com.fazendaideal.frontend"
BACK_PLIST="$LA_DIR/$BACK_ID.plist"
FRONT_PLIST="$LA_DIR/$FRONT_ID.plist"

launchctl bootout "gui/$UID_NUM" "$BACK_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID_NUM" "$FRONT_PLIST" >/dev/null 2>&1 || true
launchctl remove "$BACK_ID" >/dev/null 2>&1 || true
launchctl remove "$FRONT_ID" >/dev/null 2>&1 || true

rm -f "$BACK_PLIST" "$FRONT_PLIST"

echo "Auto-start removido."

