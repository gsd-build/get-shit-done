'use strict';

/**
 * iOS Scaffold Safety Tests (#2023)
 *
 * Validates that GSD guidance:
 * 1. Does NOT instruct using Package.swift + .executableTarget as the primary
 *    build system for iOS apps (which produces a macOS CLI, not an iOS app).
 * 2. DOES contain XcodeGen guidance (project.yml + xcodegen generate) for iOS
 *    app scaffolding.
 * 3. Documents SwiftUI API availability (iOS 16 vs 17 compatibility).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const IOS_SCAFFOLD_REF = path.join(
  __dirname, '..', 'get-shit-done', 'references', 'ios-scaffold.md'
);
const EXECUTOR_AGENT = path.join(
  __dirname, '..', 'agents', 'gsd-executor.md'
);
const UNIVERSAL_ANTI_PATTERNS = path.join(
  __dirname, '..', 'get-shit-done', 'references', 'universal-anti-patterns.md'
);

describe('ios-scaffold.md reference exists and contains XcodeGen guidance', () => {
  test('reference file exists at get-shit-done/references/ios-scaffold.md', () => {
    assert.ok(
      fs.existsSync(IOS_SCAFFOLD_REF),
      `Expected iOS scaffold reference at ${IOS_SCAFFOLD_REF}`
    );
  });

  test('reference prohibits Package.swift as primary build system for iOS apps', () => {
    const content = fs.readFileSync(IOS_SCAFFOLD_REF, 'utf-8');
    const prohibitsPackageSwift =
      content.includes('Package.swift') &&
      (
        content.includes('NEVER') ||
        content.includes('never') ||
        content.includes('prohibited') ||
        content.includes('do not') ||
        content.includes('Do not') ||
        content.includes('must not')
      );
    assert.ok(
      prohibitsPackageSwift,
      'ios-scaffold.md must explicitly prohibit Package.swift as the primary build system for iOS apps'
    );
  });

  test('reference prohibits .executableTarget for iOS apps', () => {
    const content = fs.readFileSync(IOS_SCAFFOLD_REF, 'utf-8');
    const prohibitsExecutableTarget =
      content.includes('executableTarget') &&
      (
        content.includes('NEVER') ||
        content.includes('never') ||
        content.includes('prohibited') ||
        content.includes('do not') ||
        content.includes('Do not') ||
        content.includes('must not')
      );
    assert.ok(
      prohibitsExecutableTarget,
      'ios-scaffold.md must explicitly prohibit .executableTarget for iOS app targets'
    );
  });

  test('reference requires project.yml (XcodeGen spec) for iOS app scaffolding', () => {
    const content = fs.readFileSync(IOS_SCAFFOLD_REF, 'utf-8');
    assert.ok(
      content.includes('project.yml'),
      'ios-scaffold.md must require project.yml as the XcodeGen spec file'
    );
  });

  test('reference requires xcodegen generate command', () => {
    const content = fs.readFileSync(IOS_SCAFFOLD_REF, 'utf-8');
    assert.ok(
      content.includes('xcodegen generate') || content.includes('xcodegen'),
      'ios-scaffold.md must require the xcodegen generate command to create .xcodeproj'
    );
  });

  test('reference documents iOS deployment target compatibility', () => {
    const content = fs.readFileSync(IOS_SCAFFOLD_REF, 'utf-8');
    const hasApiCompatibility =
      content.includes('iOS 16') ||
      content.includes('iOS 17') ||
      content.includes('deployment target') ||
      content.includes('NavigationSplitView') ||
      content.includes('availability') ||
      content.includes('SwiftUI API');
    assert.ok(
      hasApiCompatibility,
      'ios-scaffold.md must document SwiftUI API availability and iOS deployment target compatibility'
    );
  });
});

describe('gsd-executor.md references ios-scaffold guidance', () => {
  test('executor agent references ios-scaffold.md', () => {
    const content = fs.readFileSync(EXECUTOR_AGENT, 'utf-8');
    assert.ok(
      content.includes('ios-scaffold.md') || content.includes('ios-scaffold'),
      'gsd-executor.md must reference ios-scaffold.md for iOS app scaffold guidance'
    );
  });
});

describe('universal-anti-patterns.md documents iOS SPM anti-pattern', () => {
  test('universal-anti-patterns.md documents Package.swift misuse for iOS apps', () => {
    const content = fs.readFileSync(UNIVERSAL_ANTI_PATTERNS, 'utf-8');
    const hasAntiPattern =
      (content.includes('Package.swift') || content.includes('SPM')) &&
      (content.includes('iOS') || content.includes('ios'));
    assert.ok(
      hasAntiPattern,
      'universal-anti-patterns.md must document the Package.swift/SPM misuse anti-pattern for iOS apps'
    );
  });
});
