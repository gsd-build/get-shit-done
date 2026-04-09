#!/usr/bin/env bash
# Release monitor for gsd-build/get-shit-done
# Checks every 15 minutes, writes new release info to a signal file

REPO="gsd-build/get-shit-done"
SIGNAL_FILE="/tmp/gsd-new-release.json"
STATE_FILE="/tmp/gsd-monitor-last-tag"
LOG_FILE="/tmp/gsd-monitor.log"

# Initialize with current latest
echo "v1.25.1" > "$STATE_FILE"
rm -f "$SIGNAL_FILE"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Monitor started. Watching $REPO for releases newer than v1.25.1"
log "Checking every 15 minutes..."

while true; do
  sleep 900  # 15 minutes

  LAST_KNOWN=$(cat "$STATE_FILE" 2>/dev/null)
  
  # Get latest release tag
  LATEST=$(gh release list -R "$REPO" --limit 1 2>/dev/null | awk '{print $1}')
  
  if [ -z "$LATEST" ]; then
    log "WARNING: Failed to fetch releases (network issue?)"
    continue
  fi

  if [ "$LATEST" != "$LAST_KNOWN" ]; then
    log "NEW RELEASE DETECTED: $LATEST (was: $LAST_KNOWN)"
    
    # Fetch release notes
    RELEASE_BODY=$(gh release view "$LATEST" -R "$REPO" --json tagName,name,body 2>/dev/null)
    
    # Write signal file for the agent to pick up
    echo "$RELEASE_BODY" > "$SIGNAL_FILE"
    echo "$LATEST" > "$STATE_FILE"
    
    log "Signal file written to $SIGNAL_FILE"
    # Exit so the agent can process it, then restart
    exit 0
  else
    log "No new release. Latest is still $LATEST"
  fi
done
