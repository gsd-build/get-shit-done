#!/usr/bin/env bash
# base64-scan.sh — Detect base64-obfuscated prompt injection in source files
#
# Extracts base64 blobs >= 40 chars, decodes them, and checks decoded content
# against the same injection patterns used by prompt-injection-scan.sh.
#
# Usage:
#   scripts/base64-scan.sh --diff origin/main   # CI mode: scan changed files
#   scripts/base64-scan.sh --file path/to/file   # Scan a single file
#   scripts/base64-scan.sh --dir agents/          # Scan all files in a directory
#
# Exit codes:
#   0 = clean
#   1 = findings detected
#   2 = usage error
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_BLOB_LENGTH=40

# ─── Injection Patterns (decoded content) ────────────────────────────────────
# Subset of patterns — if someone base64-encoded something, check for the
# most common injection indicators.
DECODED_PATTERNS=(
  'ignore[[:space:]]+(all[[:space:]]+)?previous[[:space:]]+instructions'
  'you[[:space:]]+are[[:space:]]+now[[:space:]]+'
  'system[[:space:]]+prompt'
  '</?system>'
  '</?assistant>'
  '\[SYSTEM\]'
  '\[INST\]'
  '<<SYS>>'
  'override[[:space:]]+(system|safety|security)'
  'pretend[[:space:]]+(you|to)[[:space:]]'
  'act[[:space:]]+as[[:space:]]+(a|an|if)'
  'jailbreak'
  'bypass[[:space:]]+(safety|content|security)'
  'eval[[:space:]]*\('
  'exec[[:space:]]*\('
  'rm[[:space:]]+-rf'
  'curl[[:space:]].*\|[[:space:]]*sh'
  'wget[[:space:]].*\|[[:space:]]*sh'
)

# ─── Ignorelist ──────────────────────────────────────────────────────────────

IGNOREFILE=".base64scanignore"
IGNORED_PATTERNS=()

load_ignorelist() {
  if [[ -f "$IGNOREFILE" ]]; then
    while IFS= read -r line; do
      # Skip comments and empty lines
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      IGNORED_PATTERNS+=("$line")
    done < "$IGNOREFILE"
  fi
}

is_ignored() {
  local blob="$1"
  if [[ ${#IGNORED_PATTERNS[@]} -eq 0 ]]; then
    return 1
  fi
  for pattern in "${IGNORED_PATTERNS[@]}"; do
    if [[ "$blob" == "$pattern" ]]; then
      return 0
    fi
  done
  return 1
}

# ─── Skip Rules ──────────────────────────────────────────────────────────────

should_skip_file() {
  local file="$1"
  # Skip binary files
  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|*.eot|*.otf) return 0 ;;
    *.zip|*.tar|*.gz|*.bz2|*.xz|*.7z) return 0 ;;
    *.pdf|*.doc|*.docx|*.xls|*.xlsx) return 0 ;;
  esac
  # Skip lockfiles and node_modules
  case "$file" in
    */node_modules/*) return 0 ;;
    */package-lock.json) return 0 ;;
    */yarn.lock) return 0 ;;
    */pnpm-lock.yaml) return 0 ;;
  esac
  # Skip the scan scripts themselves and test files
  case "$file" in
    */base64-scan.sh) return 0 ;;
    */security-scan.test.cjs) return 0 ;;
  esac
  return 1
}

is_data_uri() {
  local context="$1"
  # data:image/png;base64,... or data:application/font-woff;base64,...
  echo "$context" | grep -qE 'data:[a-zA-Z]+/[a-zA-Z0-9.+-]+;base64,' 2>/dev/null
}

# ─── File Collection ─────────────────────────────────────────────────────────

collect_files() {
  local mode="$1"
  shift

  case "$mode" in
    --diff)
      local base="${1:-origin/main}"
      git diff --name-only --diff-filter=ACMR "$base"...HEAD 2>/dev/null \
        | grep -vE '\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|otf|zip|tar|gz|pdf)$' || true
      ;;
    --file)
      if [[ -f "$1" ]]; then
        echo "$1"
      else
        echo "Error: file not found: $1" >&2
        exit 2
      fi
      ;;
    --dir)
      local dir="$1"
      if [[ ! -d "$dir" ]]; then
        echo "Error: directory not found: $dir" >&2
        exit 2
      fi
      find "$dir" -type f ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/dist/*' \
        ! -name '*.png' ! -name '*.jpg' ! -name '*.gif' ! -name '*.woff*' 2>/dev/null || true
      ;;
    --stdin)
      cat
      ;;
    *)
      echo "Usage: $0 --diff [base] | --file <path> | --dir <path> | --stdin" >&2
      exit 2
      ;;
  esac
}

# ─── Scanner ─────────────────────────────────────────────────────────────────

extract_and_check_blobs() {
  local file="$1"
  local found=0
  local line_num=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))

    # Skip data URIs — legitimate base64 usage
    if is_data_uri "$line"; then
      continue
    fi

    # Extract base64-like blobs (alphanumeric + / + = padding, >= MIN_BLOB_LENGTH)
    local blobs
    blobs=$(echo "$line" | grep -oE '[A-Za-z0-9+/]{'"$MIN_BLOB_LENGTH"',}={0,3}' 2>/dev/null || true)

    if [[ -z "$blobs" ]]; then
      continue
    fi

    while IFS= read -r blob; do
      [[ -z "$blob" ]] && continue

      # Check ignorelist
      if [[ ${#IGNORED_PATTERNS[@]} -gt 0 ]] && is_ignored "$blob"; then
        continue
      fi

      # Try to decode — if it fails, not valid base64
      local decoded
      decoded=$(echo "$blob" | base64 -d 2>/dev/null || echo "")

      if [[ -z "$decoded" ]]; then
        continue
      fi

      # Check if decoded content is mostly printable text (not random binary)
      local printable_ratio
      local total_chars=${#decoded}
      if [[ $total_chars -eq 0 ]]; then
        continue
      fi

      # Count printable ASCII characters
      local printable_count
      printable_count=$(echo -n "$decoded" | tr -cd '[:print:]' | wc -c | tr -d ' ')
      # Skip if less than 70% printable (likely binary data, not obfuscated text)
      if [[ $((printable_count * 100 / total_chars)) -lt 70 ]]; then
        continue
      fi

      # Scan decoded content against injection patterns
      for pattern in "${DECODED_PATTERNS[@]}"; do
        if echo "$decoded" | grep -iqE "$pattern" 2>/dev/null; then
          if [[ $found -eq 0 ]]; then
            echo "FAIL: $file"
            found=1
          fi
          echo "  line $line_num: base64 blob decodes to suspicious content"
          echo "    blob: ${blob:0:60}..."
          echo "    decoded: ${decoded:0:120}"
          echo "    matched: $pattern"
          break
        fi
      done
    done <<< "$blobs"
  done < "$file"

  return $found
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: $0 --diff [base] | --file <path> | --dir <path>" >&2
    exit 2
  fi

  load_ignorelist

  local mode="$1"
  shift

  local files
  files=$(collect_files "$mode" "$@")

  if [[ -z "$files" ]]; then
    echo "base64-scan: no files to scan"
    exit 0
  fi

  local total=0
  local failed=0

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if should_skip_file "$file"; then
      continue
    fi
    total=$((total + 1))
    if ! extract_and_check_blobs "$file"; then
      failed=$((failed + 1))
    fi
  done <<< "$files"

  echo ""
  echo "base64-scan: scanned $total files, $failed with findings"

  if [[ $failed -gt 0 ]]; then
    exit 1
  fi
  exit 0
}

main "$@"
