# PRD: Hello World CLI

## Overview

A minimal Node.js CLI tool that prints a configurable greeting message.

## Requirements

1. **GREET-01**: Running `node hello.js` prints "Hello, World!" to stdout
2. **GREET-02**: Running `node hello.js --name Alice` prints "Hello, Alice!" to stdout
3. **GREET-03**: Running `node hello.js --help` shows usage information

## Technical Constraints

- Plain JavaScript (no build step)
- No external dependencies
- Single file implementation

## Success Criteria

- All three commands produce correct output
- Exit code 0 on success
