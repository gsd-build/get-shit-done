#!/bin/bash
# Run trigger evaluation for a single skill in an isolated environment
# Usage: ./evals/run-skill-eval.sh <skill-name>

set -e

SKILL="$1"
if [ -z "$SKILL" ]; then
  echo "Usage: $0 <skill-name>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SKILL_CREATOR="/Users/annon/.claude/plugins/cache/claude-plugins-official/skill-creator/205b6e0b3036/skills/skill-creator"
EVAL_SET="$PROJECT_DIR/evals/trigger-evals/$SKILL/eval-queries.json"
SKILL_PATH="$PROJECT_DIR/evals/shims/$SKILL"
RESULTS_DIR="$PROJECT_DIR/evals/trigger-evals/$SKILL/results"

if [ ! -f "$EVAL_SET" ]; then
  echo "Error: No eval set at $EVAL_SET"
  exit 1
fi

if [ ! -f "$SKILL_PATH/SKILL.md" ]; then
  echo "Error: No SKILL.md at $SKILL_PATH"
  exit 1
fi

mkdir -p "$RESULTS_DIR"

# Create an isolated temp project so the test skill doesn't compete with real GSD skills
TEMP_PROJECT=$(mktemp -d)
mkdir -p "$TEMP_PROJECT/.claude/commands"
# Initialize as git repo (claude -p may need it)
git init "$TEMP_PROJECT" -q

# Copy minimal context so claude knows this is a project
echo "# Test Project" > "$TEMP_PROJECT/README.md"

echo "=== Running eval for $SKILL (isolated at $TEMP_PROJECT) ==="

# Run eval with the temp project as root
cd "$TEMP_PROJECT"
PYTHONPATH="$SKILL_CREATOR" python3 -m scripts.run_eval \
  --eval-set "$EVAL_SET" \
  --skill-path "$SKILL_PATH" \
  --runs-per-query 3 \
  --num-workers 10 \
  --timeout 30 \
  --verbose 2>&1 | tee "$RESULTS_DIR/baseline-eval.log"

cd "$PROJECT_DIR"
rm -rf "$TEMP_PROJECT"

echo "=== Done: $SKILL ==="
