// allow-test-rule: source-text-is-the-product
// The command and workflow .md files are the deployed product - testing their
// text content tests the deployed contract (same rationale as forensics.test.cjs).

/**
 * GSD Feedback Command Tests (#2331)
 *
 * Validates the /gsd-feedback command and its workflow exist, follow expected
 * structural patterns, and correctly implement the issue-filing pipeline.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const commandPath = path.join(repoRoot, "commands", "gsd", "feedback.md");
const workflowPath = path.join(repoRoot, "get-shit-done", "workflows", "feedback.md");

describe("feedback command", () => {
  test("command file exists", () => {
    assert.ok(fs.existsSync(commandPath), "commands/gsd/feedback.md should exist");
  });

  test("command has correct frontmatter", () => {
    const content = fs.readFileSync(commandPath, "utf-8");
    assert.ok(content.includes("name: gsd:feedback"), "should have correct command name");
    assert.ok(content.includes("type: prompt"), "should have type: prompt");
    assert.ok(content.includes("argument-hint"), "should have argument-hint");
  });

  test("command references workflow in execution_context", () => {
    const content = fs.readFileSync(commandPath, "utf-8");
    assert.ok(
      content.includes("workflows/feedback.md"),
      "should reference the feedback workflow"
    );
  });

  test("command has success_criteria section", () => {
    const content = fs.readFileSync(commandPath, "utf-8");
    assert.ok(content.includes("<success_criteria>"), "should have success_criteria");
  });

  test("command has critical_rules section", () => {
    const content = fs.readFileSync(commandPath, "utf-8");
    assert.ok(content.includes("<critical_rules>"), "should have critical_rules");
  });

  test("command lists all three issue types in success_criteria", () => {
    const content = fs.readFileSync(commandPath, "utf-8");
    assert.ok(content.includes("bug"), "should mention bug issue type");
    assert.ok(content.includes("feature"), "should mention feature issue type");
    assert.ok(content.includes("question"), "should mention question issue type");
  });
});

describe("feedback workflow", () => {
  test("workflow file exists", () => {
    assert.ok(fs.existsSync(workflowPath), "get-shit-done/workflows/feedback.md should exist");
  });

  test("workflow collects all required fields", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(content.includes("ISSUE_TYPE"), "should collect ISSUE_TYPE");
    assert.ok(content.includes("ISSUE_TITLE"), "should collect ISSUE_TITLE");
    assert.ok(content.includes("ISSUE_BODY"), "should collect ISSUE_BODY");
  });

  test("workflow supports all three issue types", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(content.includes("bug"), "should handle bug type");
    assert.ok(content.includes("feature"), "should handle feature type");
    assert.ok(content.includes("question"), "should handle question type");
  });

  test("workflow files issue to gsd-build/get-shit-done, not the current repo", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.match(
      content,
      /gh issue create[\s\S]{0,250}--repo\s+gsd-build\/get-shit-done/,
      "gh issue create must use --repo gsd-build/get-shit-done"
    );
  });

  test("workflow checks label in gsd-build/get-shit-done, not the current repo", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.match(
      content,
      /gh label list[\s\S]{0,250}--repo\s+gsd-build\/get-shit-done/,
      "gh label list must target gsd-build/get-shit-done"
    );
  });

  test("workflow invokes forensics via file reference, not slash command", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(
      content.includes("workflows/forensics.md"),
      "should invoke forensics via @-file reference to workflows/forensics.md"
    );
    assert.match(
      content,
      /@~\/\.claude\/get-shit-done\/workflows\/forensics\.md/,
      "forensics invocation must use @~/.claude/get-shit-done/workflows/forensics.md"
    );
  });

  test("workflow LABEL_FLAG variable is properly quoted/braced", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(
      content.includes("${LABEL_FLAG}"),
      "LABEL_FLAG must be braced as ${LABEL_FLAG} to prevent word-splitting"
    );
    assert.ok(
      !content.match(/^\s+\$LABEL_FLAG\s*$/m),
      "bare $LABEL_FLAG on its own line should not appear"
    );
  });

  test("workflow URL fallback does not use python3", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const fallbackStart = content.indexOf("Fallback — pre-filled browser URL");
    const fallbackEnd = content.indexOf("Last resort — copy-paste markdown");
    const urlFallbackSection = content.slice(fallbackStart, fallbackEnd);
    assert.ok(
      !urlFallbackSection.includes("python3"),
      "URL fallback must not use python3 (not guaranteed on Windows)"
    );
  });

  test("workflow URL fallback has cross-platform browser open", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(content.includes("xdg-open"), "should handle Linux browser open");
    assert.ok(
      content.includes("CYGWIN") || content.includes("MINGW") || content.includes("MSYS") || content.includes("cmd.exe"),
      "should handle Windows browser open"
    );
  });

  test("workflow offers gh CLI as primary filing method", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(content.includes("gh issue create"), "should use gh CLI as primary method");
  });

  test("workflow has copy-paste fallback", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(
      content.includes("copy-paste") || content.includes("Last resort"),
      "should have a copy-paste fallback"
    );
  });

  test("workflow enforces ask-once principle", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(
      content.includes("ask once") || content.includes("once"),
      "should document ask-once principle for diagnostics"
    );
  });

  test("workflow redacts home directory from diagnostics", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(
      content.includes("Redact") || content.includes("redact"),
      "should include path redaction for diagnostics"
    );
  });

  test("workflow attaches GSD version to issue body", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(
      content.includes("VERSION") || content.includes("GSD version"),
      "should attach GSD version to the issue body"
    );
  });
});
