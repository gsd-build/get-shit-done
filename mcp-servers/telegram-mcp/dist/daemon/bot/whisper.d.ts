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
/**
 * Transcribe a Telegram voice message (OGA format) to text.
 *
 * Downloads the file, converts it with ffmpeg, then runs whisper.cpp/main
 * directly to avoid whisper-node's broken output parser.
 *
 * @param fileLink  HTTPS URL returned by bot.telegram.getFileLink()
 * @returns Transcript text, or an error message string (never throws)
 */
export declare function transcribeVoice(fileLink: string): Promise<string>;
