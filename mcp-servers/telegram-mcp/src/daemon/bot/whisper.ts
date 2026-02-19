/**
 * Voice transcription by running whisper.cpp directly.
 *
 * Bypasses whisper-node's broken tsToArray parser (which calls lines.shift()
 * and drops the first — often only — transcript line). Instead we:
 *   1. Resolve the whisper.cpp binary path via the whisper-node package location
 *   2. Run the binary with child_process.exec (explicit cwd, no chdir needed)
 *   3. Parse stdout ourselves with a simple regex
 *
 * Audio pipeline:
 *   Telegram .oga file → /tmp/voice-{uuid}.oga
 *   ffmpeg convert     → /tmp/voice-{uuid}.wav (16kHz mono, whisper requirement)
 *   whisper.cpp/main   → transcript string
 */

import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import https from 'https';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { createLogger } from '../../shared/logger.js';

// fluent-ffmpeg + installer bundled in package.json
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const log = createLogger('whisper');
const execAsync = promisify(exec);

// ─── Binary path resolution ─────────────────────────────────────────────────

/**
 * Resolve the absolute path to the whisper.cpp directory bundled inside
 * the whisper-node npm package.
 *
 * whisper-node's shell.js is at: <pkg>/dist/shell.js
 * The whisper.cpp binary is at: <pkg>/lib/whisper.cpp/main
 */
function getWhisperCppDir(): string {
  const require = createRequire(import.meta.url);
  const shellPath = require.resolve('whisper-node/dist/shell.js');
  // shellPath: …/node_modules/whisper-node/dist/shell.js
  // binary:    …/node_modules/whisper-node/lib/whisper.cpp/
  return path.join(path.dirname(shellPath), '..', 'lib', 'whisper.cpp');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    const handleResponse = (response: import('http').IncomingMessage) => {
      // Follow redirects
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    };
    https.get(url, handleResponse).on('error', (err) => {
      fs.unlink(destPath).catch(() => {});
      reject(err);
    });
  });
}

async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .format('wav')
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Parse whisper.cpp stdout into a transcript string.
 *
 * whisper.cpp outputs lines like:
 *   [00:00:00.000 --> 00:00:02.500]   Hello world.
 *
 * We extract the text after the timestamp bracket on EVERY line (not skipping
 * the first, which whisper-node's tsToArray incorrectly discards).
 */
function parseWhisperOutput(stdout: string): string {
  const matches = stdout.matchAll(/\[\d+:\d+:\d+\.\d+\s*-->\s*\d+:\d+:\d+\.\d+\]\s+(.*)/g);
  const parts: string[] = [];
  for (const match of matches) {
    const text = match[1]?.trim();
    if (text) parts.push(text);
  }
  return parts.join(' ').trim();
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Transcribe a Telegram voice message (OGA format) to text.
 *
 * Downloads the file, converts it with ffmpeg, then runs whisper.cpp/main
 * directly to avoid whisper-node's broken output parser.
 *
 * @param fileLink  HTTPS URL returned by bot.telegram.getFileLink()
 * @returns Transcript text, or an error message string (never throws)
 */
export async function transcribeVoice(fileLink: string): Promise<string> {
  const id = randomUUID();
  const tempOga = path.join(os.tmpdir(), `voice-${id}.oga`);
  const tempWav = path.join(os.tmpdir(), `voice-${id}.wav`);

  try {
    log.info({ fileLink: fileLink.slice(0, 60) }, 'Starting voice transcription');

    // 1. Download
    await downloadFile(fileLink, tempOga);
    log.info('Voice file downloaded');

    // 2. Convert to 16kHz mono WAV (whisper.cpp requirement)
    await convertToWav(tempOga, tempWav);
    log.info('Voice file converted to WAV');

    // 3. Run whisper.cpp binary directly with explicit cwd (no process.chdir needed)
    const whisperCppDir = getWhisperCppDir();
    const modelPath = path.join(os.homedir(), '.cache', 'whisper', 'ggml-base.bin');

    log.info({ whisperCppDir, modelPath }, 'Running whisper.cpp binary');

    const { stdout, stderr } = await execAsync(
      `./main -l auto -m "${modelPath}" -f "${tempWav}"`,
      { cwd: whisperCppDir }
    );

    if (stderr) {
      log.debug({ stderr: stderr.slice(0, 200) }, 'whisper.cpp stderr (usually progress info)');
    }

    // 4. Parse output
    const transcript = parseWhisperOutput(stdout) || '[No speech detected]';
    log.info({ transcriptLength: transcript.length, transcript: transcript.slice(0, 80) }, 'Transcription complete');
    return transcript;

  } catch (err: any) {
    const message = `[Transcription failed: ${err.message}]`;
    log.error({ err: err.message }, 'Voice transcription error');
    return message;
  } finally {
    // Clean up temp files (best-effort)
    await fs.unlink(tempOga).catch(() => {});
    await fs.unlink(tempWav).catch(() => {});
  }
}
