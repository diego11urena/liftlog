#!/bin/sh
# Runs the Liftlog server as a macOS LaunchAgent: starts at login, restarts if it stops.
# Usage: sh server/install-service.sh      (re-run after moving the project; `npm run build` after code changes)
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/com.liftlog.server.plist"
LOG="$HOME/Library/Logs/liftlog-server.log"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.liftlog.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--experimental-strip-types</string>
    <string>--disable-warning=ExperimentalWarning</string>
    <string>server/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.liftlog.server" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Liftlog server installed. Log: $LOG"
