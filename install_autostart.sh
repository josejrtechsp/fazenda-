#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UID_NUM="$(id -u)"
LA_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$ROOT/.runlogs"

BACK_ID="com.fazendaideal.backend"
FRONT_ID="com.fazendaideal.frontend"
BACK_PLIST="$LA_DIR/$BACK_ID.plist"
FRONT_PLIST="$LA_DIR/$FRONT_ID.plist"

mkdir -p "$LA_DIR" "$LOG_DIR"

cat > "$BACK_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$BACK_ID</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$ROOT/backend" &amp;&amp; exec ./.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT/backend</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd-backend.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-backend.err.log</string>
</dict>
</plist>
EOF

cat > "$FRONT_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$FRONT_ID</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/npm</string>
    <string>run</string>
    <string>dev</string>
    <string>--</string>
    <string>--host</string>
    <string>127.0.0.1</string>
    <string>--port</string>
    <string>5173</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT/frontend</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd-frontend.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-frontend.err.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$UID_NUM" "$BACK_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID_NUM" "$FRONT_PLIST" >/dev/null 2>&1 || true

launchctl bootstrap "gui/$UID_NUM" "$BACK_PLIST"
launchctl bootstrap "gui/$UID_NUM" "$FRONT_PLIST"
launchctl kickstart -k "gui/$UID_NUM/$BACK_ID"
launchctl kickstart -k "gui/$UID_NUM/$FRONT_ID"

sleep 2

echo "Auto-start ativado."
echo "Backend:  http://127.0.0.1:8001/health"
echo "Frontend: http://127.0.0.1:5173/#login"
echo "Logs:"
echo "  $LOG_DIR/launchd-backend.out.log"
echo "  $LOG_DIR/launchd-backend.err.log"
echo "  $LOG_DIR/launchd-frontend.out.log"
echo "  $LOG_DIR/launchd-frontend.err.log"
