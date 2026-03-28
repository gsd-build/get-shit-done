#!/usr/bin/env bash
# secret-scan.sh — Check files for accidentally committed secrets/credentials
#
# Usage:
#   scripts/secret-scan.sh --diff origin/main   # CI mode: scan changed files
#   scripts/secret-scan.sh --file path/to/file   # Scan a single file
#   scripts/secret-scan.sh --dir agents/          # Scan all files in a directory
#
# Exit codes:
#   0 = clean
#   1 = findings detected
#   2 = usage error
set -euo pipefail

# ─── Secret Patterns ─────────────────────────────────────────────────────────
# Format: "LABEL:::REGEX"
# Each entry is a human label paired with a POSIX extended regex.

SECRET_PATTERNS=(
  # AWS
  "AWS Access Key:::AKIA[0-9A-Z]{16}"
  "AWS Secret Key:::aws_secret_access_key[[:space:]]*=[[:space:]]*[A-Za-z0-9/+=]{40}"

  # OpenAI / Anthropic / AI providers
  "OpenAI API Key:::sk-[A-Za-z0-9]{20,}"
  "Anthropic API Key:::sk-ant-[A-Za-z0-9_-]{20,}"

  # GitHub
  "GitHub PAT:::ghp_[A-Za-z0-9]{36}"
  "GitHub OAuth:::gho_[A-Za-z0-9]{36}"
  "GitHub App Token:::ghs_[A-Za-z0-9]{36}"
  "GitHub Fine-grained PAT:::github_pat_[A-Za-z0-9_]{20,}"

  # Stripe
  "Stripe Secret Key:::sk_live_[A-Za-z0-9]{24,}"
  "Stripe Publishable Key:::pk_live_[A-Za-z0-9]{24,}"

  # Generic patterns
  "Private Key Header:::-----BEGIN[[:space:]]+(RSA|EC|DSA|OPENSSH)?[[:space:]]*PRIVATE[[:space:]]+KEY-----"
  "Generic API Key Assignment:::api[_-]?key[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9_-]{20,}['\"]"
  "Generic Secret Assignment:::secret[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9_-]{20,}['\"]"
  "Generic Token Assignment:::token[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9_-]{20,}['\"]"
  "Generic Password Assignment:::password[[:space:]]*[:=][[:space:]]*['\"][^'\"]{8,}['\"]"

  # Slack
  "Slack Bot Token:::xoxb-[0-9]{10,}-[A-Za-z0-9]{20,}"
  "Slack Webhook:::hooks\.slack\.com/services/T[A-Z0-9]{8,}/B[A-Z0-9]{8,}/[A-Za-z0-9]{24}"

  # Google
  "Google API Key:::AIza[A-Za-z0-9_-]{35}"

  # NPM
  "NPM Token:::npm_[A-Za-z0-9]{36}"

  # .env file content (key=value with sensitive-looking keys)
  "Env Variable Leak:::(DATABASE_URL|DB_PASSWORD|REDIS_URL|MONGO_URI|JWT_SECRET|SESSION_SECRET|ENCRYPTION_KEY)[[:space:]]*=[[:space:]]*[^[:space:]]{8,}"
)

# ─── Ignorelist ──────────────────────────────────────────────────────────────

IGNOREFILE=".secretscanignore"
IGNORED_FILES=()

load_ignorelist() {
  if [[ -f "$IGNOREFILE" ]]; then
    while IFS= read -r line; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      IGNORED_FILES+=("$line")
    done < "$IGNOREFILE"
  fi
}

is_ignored() {
  local file="$1"
  if [[ ${#IGNORED_FILES[@]} -eq 0 ]]; then
    return 1
  fi
  for pattern in "${IGNORED_FILES[@]}"; do
    # Support glob-style matching
    # shellcheck disable=SC2254
    case "$file" in
      $pattern) return 0 ;;
    esac
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
    */secret-scan.sh) return 0 ;;
    */security-scan.test.cjs) return 0 ;;
  esac
  return 1
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

scan_file() {
  local file="$1"
  local found=0

  if is_ignored "$file"; then
    return 0
  fi

  for entry in "${SECRET_PATTERNS[@]}"; do
    local label="${entry%%:::*}"
    local pattern="${entry#*:::}"

    local matches
    matches=$(grep -nE -e "$pattern" "$file" 2>/dev/null || true)
    if [[ -n "$matches" ]]; then
      if [[ $found -eq 0 ]]; then
        echo "FAIL: $file"
        found=1
      fi
      echo "$matches" | while IFS= read -r line; do
        echo "  [$label] $line"
      done
    fi
  done

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
    echo "secret-scan: no files to scan"
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
    if ! scan_file "$file"; then
      failed=$((failed + 1))
    fi
  done <<< "$files"

  echo ""
  echo "secret-scan: scanned $total files, $failed with findings"

  if [[ $failed -gt 0 ]]; then
    exit 1
  fi
  exit 0
}

main "$@"
