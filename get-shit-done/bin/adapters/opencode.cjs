'use strict';

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI_NAME = 'opencode';

function classifyError(err) {
  if (err.signal === 'SIGTERM') return 'TIMEOUT';
  // err.status = exit code from execSync; err.code = exit code (number) from exec
  const exitCode = err.status || (typeof err.code === 'number' ? err.code : undefined);
  if (err.code === 'ENOENT' || exitCode === 127) return 'NOT_FOUND';
  if (exitCode === 126) return 'PERMISSION';
  return 'EXIT_ERROR';
}

function extractOpenCodeResponse(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    if (typeof parsed === 'string') return parsed;
    if (parsed.response) return parsed.response;
    if (parsed.text) return parsed.text;
    return stdout.trim();
  } catch (_) {
    return stdout.trim();
  }
}

function detect() {
  try {
    const stdout = execSync(`${CLI_NAME} --version`, {
      timeout: 10000,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { available: true, version: stdout.trim(), error: null };
  } catch (err) {
    return { available: false, version: null, error: classifyError(err) };
  }
}

function invoke(prompt, options) {
  const timeout = (options && options.timeout) || 120000;
  const model = options && options.model;
  const tmpFile = path.join(os.tmpdir(), `gsd-${CLI_NAME}-${Date.now()}.txt`);
  const start = Date.now();

  try {
    fs.writeFileSync(tmpFile, prompt, 'utf-8');

    let cmd = `cat "${tmpFile}" | opencode run --format json`;
    if (model) {
      cmd += ` -m "${model}"`;
    }

    const stdout = execSync(cmd, {
      timeout,
      stdio: 'pipe',
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    const duration = Date.now() - start;
    const text = extractOpenCodeResponse(stdout);

    return {
      text,
      cli: CLI_NAME,
      duration,
      exitCode: 0,
      error: null,
      errorType: null,
    };
  } catch (err) {
    const duration = Date.now() - start;
    // Only check exitCode for success/failure, NOT stderr content
    // OpenCode/Bun emits CPU warnings to stderr that are not errors
    return {
      text: null,
      cli: CLI_NAME,
      duration,
      exitCode: err.status || 1,
      error: err.message,
      errorType: classifyError(err),
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore cleanup errors */ }
  }
}

function invokeAsync(prompt, options) {
  const timeout = (options && options.timeout) || 120000;
  const model = options && options.model;
  const tmpFile = path.join(os.tmpdir(), `gsd-${CLI_NAME}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  const start = Date.now();

  try {
    fs.writeFileSync(tmpFile, prompt, 'utf-8');
  } catch (writeErr) {
    return Promise.resolve({
      text: null,
      cli: CLI_NAME,
      duration: 0,
      exitCode: 1,
      error: writeErr.message,
      errorType: 'WRITE_ERROR',
    });
  }

  let cmd = `cat "${tmpFile}" | opencode run --format json`;
  if (model) {
    cmd += ` -m "${model}"`;
  }

  return new Promise(function (resolve) {
    exec(cmd, {
      timeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }, function (err, stdout) {
      const duration = Date.now() - start;
      try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore cleanup errors */ }

      if (err) {
        resolve({
          text: null,
          cli: CLI_NAME,
          duration,
          exitCode: err.code || 1,
          error: err.message,
          errorType: classifyError(err),
        });
      } else {
        const text = extractOpenCodeResponse(stdout);

        resolve({
          text,
          cli: CLI_NAME,
          duration,
          exitCode: 0,
          error: null,
          errorType: null,
        });
      }
    });
  });
}

module.exports = { detect, invoke, invokeAsync, CLI_NAME, classifyError };
