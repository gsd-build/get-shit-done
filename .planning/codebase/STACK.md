# Technology Stack

**Analysis Date:** 2025-01-14

## Languages

**Primary:**
- JavaScript - All application code (CLI installer, utilities, extensions)

**Secondary:**
- JSON - Configuration files and package manifests

## Runtime

**Environment:**
- Node.js >=16.7.0 - Required runtime for all components
- No additional requirements

**Package Manager:**
- npm - Package management via package.json files
- Lockfile: Not specified in analysis

## Frameworks

**Core:**
- Node.js CLI framework - Command-line interface and installation scripts
- VS Code extension framework - Editor integration for OpenCode

**Testing:**
- Custom test framework - Manual integration testing with OpenCodeIntegrationTester class

**Build/Dev:**
- Not detected - No build tools or bundlers found

## Key Dependencies

**Critical:**
- @opencode-ai/plugin v1.1.13 - Core OpenCode integration functionality
- @types/node ^16.0.0 - TypeScript definitions for Node.js
- @types/vscode ^1.0.0 - TypeScript definitions for VSCode API

**Infrastructure:**
- Not detected - No database clients, HTTP servers, or external service clients

## Configuration

**Environment:**
- Environment variables for editor detection (OPENCODE_CONFIG_DIR, CLAUDE_CONFIG_DIR)
- No .env files detected

**Build:**
- No build configuration files detected

## Platform Requirements

**Development:**
- Any platform with Node.js support (Linux, macOS, Windows)
- No additional tooling required

**Production:**
- Distributed as npm package
- Installed globally via npm install -g
- Runs in user's Node.js environment

---

*Stack analysis: 2025-01-14*
*Update after major dependency changes*