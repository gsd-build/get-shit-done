/**
 * Voice transcription via whisper-node with cwd bug fix.
 *
 * whisper-node changes process.cwd() when imported, corrupting path resolution.
 * Fix: save and restore cwd around the whisper call, and lazy-load the module.
 *
 * Audio pipeline:
 *   Telegram .oga file → /tmp/voice-{uuid}.oga
 *   ffmpeg convert     → /tmp/voice-{uuid}.wav (16kHz mono, whisper requirement)
 *   whisper-node       → transcript string
 */
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import https from 'https';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { createLogger } from '../../shared/logger.js';
// fluent-ffmpeg + installer bundled in package.json
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const log = createLogger('whisper');
// ─── Helpers ───────────────────────────────────────────────────────────────────
async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(destPath);
        const handleResponse = (response) => {
            // Follow redirects
            if (response.statusCode &&
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location) {
                downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => file.close(() => resolve()));
            file.on('error', reject);
        };
        https.get(url, handleResponse).on('error', (err) => {
            fs.unlink(destPath).catch(() => { });
            reject(err);
        });
    });
}
async function convertToWav(inputPath, outputPath) {
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
 * Lazy-load whisper-node to avoid cwd corruption at import time.
 * whisper-node calls process.chdir() internally during module initialization.
 */
async function getWhisperFn() {
    // @ts-ignore — whisper-node ships no TypeScript types
    const mod = await import('whisper-node');
    return (mod.default ?? mod);
}
// ─── Public API ────────────────────────────────────────────────────────────────
/**
 * Transcribe a Telegram voice message (OGA format) to text.
 *
 * Downloads the file, converts it with ffmpeg, transcribes with whisper-node
 * using a cwd save/restore guard to prevent path corruption, then cleans up.
 *
 * @param fileLink  HTTPS URL returned by bot.telegram.getFileLink()
 * @returns Transcript text, or an error message string (never throws)
 */
export async function transcribeVoice(fileLink) {
    const id = randomUUID();
    const tempOga = path.join(os.tmpdir(), `voice-${id}.oga`);
    const tempWav = path.join(os.tmpdir(), `voice-${id}.wav`);
    try {
        log.info({ fileLink: fileLink.slice(0, 60) }, 'Starting voice transcription');
        // 1. Download
        await downloadFile(fileLink, tempOga);
        log.info('Voice file downloaded');
        // 2. Convert to 16kHz mono WAV
        await convertToWav(tempOga, tempWav);
        log.info('Voice file converted to WAV');
        // 3. Transcribe with cwd save/restore (whisper-node cwd bug fix)
        const savedCwd = process.cwd();
        process.chdir(os.tmpdir());
        let transcript;
        try {
            const whisper = await getWhisperFn();
            const result = await whisper(tempWav, {
                modelName: 'base.en',
                whisperOptions: {
                    language: 'en',
                    word_timestamps: false,
                },
            });
            // whisper-node returns an array of { speech: string } segment objects
            transcript = Array.isArray(result)
                ? result
                    .map((seg) => seg.speech ?? '')
                    .join(' ')
                    .trim()
                : String(result).trim();
            transcript = transcript || '[No speech detected]';
        }
        finally {
            // Always restore cwd — even if transcription fails
            process.chdir(savedCwd);
        }
        log.info({ transcriptLength: transcript.length }, 'Transcription complete');
        return transcript;
    }
    catch (err) {
        const message = `[Transcription failed: ${err.message}]`;
        log.error({ err: err.message }, 'Voice transcription error');
        return message;
    }
    finally {
        // Clean up temp files (best-effort)
        await fs.unlink(tempOga).catch(() => { });
        await fs.unlink(tempWav).catch(() => { });
    }
}
