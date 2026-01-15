<purpose>
Ensure .planning/metrics.json exists for backward compatibility. Auto-generate from ROADMAP.md if missing.
</purpose>

<process>
<step name="ensure_metrics_exists">
**Ensure .planning/metrics.json exists:**

```bash
# Check if metrics exists
if [ ! -f ".planning/metrics.json" ]; then
    echo "⏳ Generating metrics.json from ROADMAP.md..."

    # Create from template
    cp ~/.claude/get-shit-done/templates/metrics.json .planning/metrics.json

    # Parse ROADMAP.md for data
    PROJECT_NAME=$(head -1 .planning/PROJECT.md 2>/dev/null | sed 's/^# //' || echo "")
    PHASES_TOTAL=$(grep -c "^## Phase" .planning/ROADMAP.md 2>/dev/null || true)
    PHASES_TOTAL=${PHASES_TOTAL:-0}

    # Get current phase from STATE.md or default to 1
    CURRENT_PHASE=$(grep "current_phase:" .planning/STATE.md 2>/dev/null | grep -oE '[0-9]+' || echo "1")

    # Count phases marked complete in ROADMAP
    PHASES_COMPLETE=$(grep -c "Status.*Complete" .planning/ROADMAP.md 2>/dev/null || true)
    PHASES_COMPLETE=${PHASES_COMPLETE:-0}

    # Update metrics
    jq --arg pname "$PROJECT_NAME" \
       --arg ptotal "$PHASES_TOTAL" \
       --arg cphase "$CURRENT_PHASE" \
       --arg pcomplete "$PHASES_COMPLETE" \
       '.project_name = $pname |
        .overall_progress.phases_total = ($ptotal | tonumber) |
        .current_phase.number = ($cphase | tonumber) |
        .overall_progress.phases_complete = ($pcomplete | tonumber) |
        .overall_progress.percentage = (if .overall_progress.phases_total > 0 then ((.overall_progress.phases_complete / .overall_progress.phases_total) * 100 | floor) else 0 end) |
        .last_updated = now | todate |
        .current_phase.status = "in_progress"' \
       .planning/metrics.json > .planning/metrics.tmp && \
       mv .planning/metrics.tmp .planning/metrics.json

    echo "✅ metrics.json created"
fi
```
</step>
</process>
