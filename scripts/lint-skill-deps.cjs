#!/usr/bin/env node
/**
 * lint-skill-deps.cjs
 *
 * Two checks:
 *
 * a) Frontmatter to body consistency:
 *    For each commands/gsd/*.md, parse requires: and walk the body for
 *    references to other GSD skills (pattern: /gsd:<stem> or gsd:<stem>).
 *    Fail if a skill body references a skill not listed in requires:.
 *
 * b) Profile closure satisfaction:
 *    Load PROFILES from install-profiles.cjs. For each non-full profile,
 *    compute closure(profile.base) using the manifest. If any skill in
 *    the closure references a skill NOT in the closure, fail.
 *
 * Usage:
 *   node scripts/lint-skill-deps.cjs               # scans commands/gsd/
 *   node scripts/lint-skill-deps.cjs --dir <path>  # scan a custom dir (testing)
 *
 * Exits 0 if all pass; exits 1 if any violation.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROFILES_MODULE = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'install-profiles.cjs');
const { PROFILES, loadSkillsManifest, resolveProfile } = require(PROFILES_MODULE);

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

let commandsDir = path.join(__dirname, '..', 'commands', 'gsd');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && args[i + 1]) {
    commandsDir = args[i + 1];
    i++;
  }
}

// ---------------------------------------------------------------------------
// Reference extraction from skill body
// ---------------------------------------------------------------------------

function extractBodyReferences(body) {
  const refs = new Set();
  const re = /(?:\/?)gsd:([a-z0-9_-]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    refs.add(m[1]);
  }
  return refs;
}

function extractBody(content) {
  const fmEnd = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/m);
  if (!fmEnd) return content;
  return content.slice(fmEnd[0].length);
}

// ---------------------------------------------------------------------------
// Check a: frontmatter to body consistency
// ---------------------------------------------------------------------------

function checkFrontmatterBodyConsistency(manifest, allStems) {
  const violations = [];

  for (const [stem, declared] of manifest) {
    if (stem.startsWith('_calls_agents_')) continue;
    const filePath = path.join(commandsDir, stem + '.md');
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const body = extractBody(content);
    const referenced = extractBodyReferences(body);
    const declaredSet = new Set(declared);
    for (const ref of referenced) {
      if (ref === stem) continue;
      if (!allStems.has(ref)) {
        violations.push({
          stem,
          filePath,
          undeclared: ref,
          message: 'body references unknown skill gsd:' + ref,
        });
        continue;
      }
      if (!declaredSet.has(ref)) {
        violations.push({
          stem,
          filePath,
          undeclared: ref,
          message: 'body references gsd:' + ref + ' but requires: does not list it',
        });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Check b: profile closure satisfaction
// ---------------------------------------------------------------------------

function checkProfileClosure(manifest) {
  const violations = [];

  for (const profileName of Object.keys(PROFILES)) {
    const base = PROFILES[profileName];
    if (base === '*') continue;
    const resolved = resolveProfile({ modes: [profileName], manifest });
    if (resolved.skills === '*') continue;

    const closure = resolved.skills;
    for (const stem of closure) {
      const deps = manifest.get(stem) || [];
      for (const dep of deps) {
        if (!closure.has(dep)) {
          violations.push({
            profile: profileName,
            stem,
            missingDep: dep,
            message: 'profile "' + profileName + '" includes "' + stem + '" which requires "' + dep + '", but "' + dep + '" is not in the closure',
          });
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const manifest = loadSkillsManifest(commandsDir);
const allStems = new Set(
  [...manifest.keys()].filter((k) => !k.startsWith('_calls_agents_'))
);

const consistencyViolations = checkFrontmatterBodyConsistency(manifest, allStems);
const closureViolations = checkProfileClosure(manifest);

const totalViolations = consistencyViolations.length + closureViolations.length;

if (totalViolations === 0) {
  const checked = manifest.size;
  process.stdout.write('ok lint-skill-deps: ' + checked + ' skill(s) checked, 0 violations\n');
  process.exit(0);
}

process.stderr.write('\nERROR lint-skill-deps: ' + totalViolations + ' violation(s) found\n\n');

if (consistencyViolations.length > 0) {
  process.stderr.write('Frontmatter to body consistency violations (' + consistencyViolations.length + '):\n\n');
  for (const v of consistencyViolations) {
    process.stderr.write('  ' + v.filePath + '\n');
    process.stderr.write('    ' + v.message + '\n\n');
  }
  process.stderr.write('Fix: add missing deps to requires: in the skill frontmatter.\n\n');
}

if (closureViolations.length > 0) {
  process.stderr.write('Profile closure violations (' + closureViolations.length + '):\n\n');
  for (const v of closureViolations) {
    process.stderr.write('  ' + v.message + '\n');
  }
  process.stderr.write('\nFix: add the missing skills to the profile base set in install-profiles.cjs.\n\n');
}

process.exit(1);
