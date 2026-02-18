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
/**
 * Transcribe a Telegram voice message (OGA format) to text.
 *
 * Downloads the file, converts it with ffmpeg, transcribes with whisper-node
 * using a cwd save/restore guard to prevent path corruption, then cleans up.
 *
 * @param fileLink  HTTPS URL returned by bot.telegram.getFileLink()
 * @returns Transcript text, or an error message string (never throws)
 */
export declare function transcribeVoice(fileLink: string): Promise<string>;
