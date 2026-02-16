// Lazy-load whisper-node to avoid cwd corruption at module load time
// (whisper-node changes process.cwd() when imported, breaking path resolution)
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const https = require('https');
const path = require('path');
const os = require('os');

const WHISPER_MODEL = 'base.en'; // 244M params, best accuracy/speed balance

/**
 * Download file from URL to local path
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(destPath);
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(destPath).catch(() => {});
      reject(err);
    });
  });
}

/**
 * Convert audio file to 16kHz mono WAV (Whisper requirement)
 */
async function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .format('wav')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Transcribe audio file using local Whisper model
 * @param {string} audioUrl - URL to download audio from
 * @returns {string} - Transcribed text
 */
async function transcribeAudio(audioUrl) {
  // Lazy-load whisper-node here to avoid cwd corruption at module load time
  const whisper = require('whisper-node');

  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const tempOga = path.join(tempDir, `telegram_${timestamp}.oga`);
  const tempWav = path.join(tempDir, `telegram_${timestamp}.wav`);

  try {
    // 1. Download audio file
    await downloadFile(audioUrl, tempOga);

    // 2. Convert to 16kHz mono WAV
    await convertToWav(tempOga, tempWav);

    // 3. Transcribe with Whisper
    const transcript = await whisper(tempWav, {
      modelName: WHISPER_MODEL,
      whisperOptions: {
        language: 'en',
        word_timestamps: false
      }
    });

    // Join speech segments
    const text = transcript.map(t => t.speech).join(' ').trim();

    return text || '[No speech detected]';
  } catch (error) {
    console.error('Transcription error:', error.message);
    throw new Error(`Transcription failed: ${error.message}`);
  } finally {
    // Cleanup temp files
    await fs.unlink(tempOga).catch(() => {});
    await fs.unlink(tempWav).catch(() => {});
  }
}

/**
 * Check if Whisper model is available
 */
async function checkWhisperModel() {
  const modelPaths = [
    path.join(os.homedir(), '.cache', 'whisper', `ggml-${WHISPER_MODEL}.bin`),
    path.join(__dirname, 'node_modules', 'whisper-node', 'lib', 'whisper.cpp', 'models', `ggml-${WHISPER_MODEL}.bin`)
  ];

  for (const modelPath of modelPaths) {
    try {
      await fs.access(modelPath);
      return { available: true, path: modelPath };
    } catch {}
  }

  return {
    available: false,
    message: 'Whisper model not found. Run: npx whisper-node download'
  };
}

module.exports = {
  transcribeAudio,
  downloadFile,
  convertToWav,
  checkWhisperModel,
  WHISPER_MODEL
};
