#!/usr/bin/env node
/**
 * Whisper Model Installer
 *
 * Automatically downloads Whisper models for voice transcription.
 * Called by install-orchestrator.js during installation.
 *
 * Model selection:
 * - base.en: English-only, 244MB (proven in Phase 8/08.1)
 * - base: Multilingual (including Russian), ~300MB
 *
 * Storage path: ~/.cache/whisper/ggml-{model}.bin
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const MODELS = ['base.en']; // Start with English only
const WHISPER_CACHE_DIR = path.join(os.homedir(), '.cache', 'whisper');
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000; // 2 seconds, exponential backoff
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Hugging Face URLs for Whisper models
const MODEL_URLS = {
  'base.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  'base': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'tiny.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  'tiny': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  'small.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
  'small': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin'
};

/**
 * Check if model exists and is valid
 */
function checkModelExists(model) {
  const modelPath = path.join(WHISPER_CACHE_DIR, `ggml-${model}.bin`);

  if (!fs.existsSync(modelPath)) {
    return { exists: false, path: modelPath };
  }

  const stats = fs.statSync(modelPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(1);

  // Models should be >100MB (base.en is ~244MB)
  if (stats.size < 100 * 1024 * 1024) {
    return { exists: false, path: modelPath, corrupt: true, size: sizeMB };
  }

  return { exists: true, path: modelPath, size: sizeMB };
}

/**
 * Download file from URL with progress tracking
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let lastProgressUpdate = Date.now();

    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }

      totalBytes = parseInt(response.headers['content-length'], 10);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;

        // Update progress every 2 seconds
        const now = Date.now();
        if (now - lastProgressUpdate > 2000) {
          const percentComplete = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(1);
          const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r       Progress: ${percentComplete}% (${downloadedMB}/${totalMB} MB)`);
          lastProgressUpdate = now;
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        process.stdout.write('\r       Progress: 100.0%                    \n');
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });

    // Timeout handling
    request.setTimeout(DOWNLOAD_TIMEOUT, () => {
      request.destroy();
      file.close();
      fs.unlink(destPath, () => {});
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Download model with retry logic
 */
async function downloadModel(model, attempt = 1) {
  const modelCheck = checkModelExists(model);

  if (modelCheck.exists) {
    console.log(`       ✓ Whisper ${model}: already installed (${modelCheck.size}MB)`);
    return true;
  }

  if (modelCheck.corrupt) {
    console.log(`       ⚠️  Whisper ${model}: corrupted file detected (${modelCheck.size}MB), re-downloading...`);
    fs.unlinkSync(modelCheck.path);
  }

  const modelUrl = MODEL_URLS[model];
  if (!modelUrl) {
    console.error(`       ❌ Unknown model: ${model}`);
    console.error(`       Available models: ${Object.keys(MODEL_URLS).join(', ')}`);
    return false;
  }

  try {
    console.log(`       ⬇️  Downloading Whisper model: ${model} (attempt ${attempt}/${MAX_RETRIES})...`);
    console.log(`       Source: ${modelUrl}`);

    // Direct download from Hugging Face
    await downloadFile(modelUrl, modelCheck.path);

    // Verify download
    const verifyCheck = checkModelExists(model);
    if (verifyCheck.exists) {
      console.log(`       ✅ Whisper ${model}: downloaded successfully (${verifyCheck.size}MB)`);
      return true;
    } else {
      throw new Error('Model file not found after download');
    }

  } catch (error) {
    if (attempt < MAX_RETRIES) {
      // Exponential backoff
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      console.error(`       ❌ Download failed: ${error.message}`);
      console.log(`       🔄 Retrying in ${delay / 1000} seconds...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return downloadModel(model, attempt + 1);
    } else {
      // All retries exhausted
      console.error(`       ❌ Failed to download after ${MAX_RETRIES} attempts`);
      console.error('');
      console.error('       💡 Manual installation:');
      console.error(`       1. Download from: ${modelUrl}`);
      console.error(`       2. Place at: ${modelCheck.path}`);
      console.error('');

      return false;
    }
  }
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(WHISPER_CACHE_DIR)) {
    fs.mkdirSync(WHISPER_CACHE_DIR, { recursive: true });
  }
}

/**
 * Main installation function
 */
async function installWhisperModels() {
  ensureCacheDir();

  let allSucceeded = true;

  for (const model of MODELS) {
    const success = await downloadModel(model);
    if (!success) {
      allSucceeded = false;
    }
  }

  if (!allSucceeded) {
    console.error('       ⚠️  Some models failed to download');
    console.error('       Voice transcription may not work until models are installed');
  }

  return allSucceeded;
}

// Main entry point
if (require.main === module) {
  installWhisperModels()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('       ❌ Installation error:', error.message);
      process.exit(1);
    });
} else {
  // Called via require() from install-orchestrator
  module.exports = installWhisperModels;
}
