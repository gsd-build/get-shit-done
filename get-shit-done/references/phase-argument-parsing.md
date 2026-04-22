# Phase Argument Parsing

Parse and normalize phase arguments for commands that operate on phases.

## Extraction

From `$ARGUMENTS`:
- Extract phase number (first numeric argument)
- Extract flags (prefixed with `--`)
- Remaining text is description (for insert/add commands)

## Using gsd-tools

The `find-phase` command handles normalization and validation in one step:

```bash
PHASE_INFO=$(gsd-sdk query find-phase "${PHASE}")
```

Returns JSON with:
- `found`: true/false
- `directory`: Full path to phase directory
- `phase_number`: Normalized number (e.g., "06", "06.1")
- `phase_name`: Name portion (e.g., "foundation")
- `plans`: Array of PLAN.md files
- `summaries`: Array of SUMMARY.md files

## Manual Normalization (Legacy)

Zero-pad integer phases to 2 digits. Preserve decimal suffixes.

```bash
# Normalize phase number
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  # Integer: 8 → 08
  PHASE=$(printf "%02d" "$PHASE")
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  # Decimal: 2.1 → 02.1
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

## Validation

Use `roadmap get-phase` to validate phase exists:

```bash
PHASE_CHECK=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick found)
if [ "$PHASE_CHECK" = "false" ]; then
  echo "ERROR: Phase ${PHASE} not found in roadmap"
  exit 1
fi
```

## Directory Lookup

Use `find-phase` for directory lookup:

```bash
PHASE_DIR=$(gsd-sdk query find-phase "${PHASE}" --raw)
```
