import { loadSessionJSONL, getSessionPath } from '../storage/session-manager.js';
import { getCurrentSessionId } from '../storage/session-state.js';
/**
 * MCP tool definition for check_question_answers
 */
export const CHECK_ANSWERS_TOOL_DEF = {
    name: "check_question_answers",
    description: "Poll for answers to pending blocking questions. Supports long polling with configurable timeout.",
    inputSchema: {
        type: "object",
        properties: {
            question_ids: {
                type: "array",
                items: { type: "string" },
                description: "Specific question IDs to check. If empty or not provided, checks all pending questions."
            },
            wait_seconds: {
                type: "number",
                description: "Long poll timeout in seconds (default: 60, max: 300)",
                default: 60,
                maximum: 300
            }
        }
    }
};
/**
 * Sleep utility for polling
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Poll for answered questions with timeout
 *
 * @param sessionId Current session ID
 * @param questionIds Filter by specific IDs (empty = all)
 * @param timeoutMs Maximum time to poll in milliseconds
 * @returns Array of answered questions (only from this session)
 */
async function pollForAnswers(sessionId, questionIds, timeoutMs) {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    while (Date.now() - startTime < timeoutMs) {
        // Load all entries from this session's JSONL file
        const sessionPath = getSessionPath(sessionId);
        const entries = await loadSessionJSONL(sessionPath);
        // Filter to answered questions
        const answered = entries
            .filter((entry) => {
            const isQuestion = entry.type === 'question';
            const isAnswered = entry.status === 'answered';
            const matchesFilter = questionIds.length === 0 || questionIds.includes(entry.id);
            return isQuestion && isAnswered && matchesFilter;
        })
            .map((entry) => entry);
        // If we found answers, return immediately
        if (answered.length > 0) {
            return answered;
        }
        // Calculate remaining time
        const elapsed = Date.now() - startTime;
        const remaining = timeoutMs - elapsed;
        // If less than poll interval remaining, do one final check after waiting
        if (remaining > 0 && remaining < pollInterval) {
            await sleep(remaining);
            // Final check
            const finalEntries = await loadSessionJSONL(sessionPath);
            return finalEntries
                .filter((entry) => {
                const isQuestion = entry.type === 'question';
                const isAnswered = entry.status === 'answered';
                const matchesFilter = questionIds.length === 0 || questionIds.includes(entry.id);
                return isQuestion && isAnswered && matchesFilter;
            })
                .map((entry) => entry);
        }
        // Wait before next poll
        if (remaining >= pollInterval) {
            await sleep(pollInterval);
        }
    }
    // Timeout reached, no answers found
    return [];
}
/**
 * Handler for check_question_answers tool
 *
 * Checks for answered questions with optional long polling.
 * If wait_seconds > 0, polls every 5 seconds until answers found or timeout.
 *
 * @param args Input arguments conforming to CheckAnswersInput
 * @returns Output conforming to CheckAnswersOutput
 */
export async function checkQuestionAnswersHandler(args) {
    // Validate and parse input
    const input = (args || {});
    // Validate question_ids if provided
    let questionIds = [];
    if (input.question_ids !== undefined) {
        if (!Array.isArray(input.question_ids)) {
            throw new Error('Invalid input: question_ids must be an array');
        }
        questionIds = input.question_ids.filter(id => typeof id === 'string' && id.trim());
    }
    // Validate and cap wait_seconds (max 300 = 5 minutes)
    let waitSeconds = input.wait_seconds ?? 60;
    if (typeof waitSeconds !== 'number' || waitSeconds < 0) {
        waitSeconds = 60;
    }
    waitSeconds = Math.min(waitSeconds, 300);
    // Get current session ID
    const sessionId = getCurrentSessionId();
    // Load pending questions from this session
    let answeredQuestions;
    if (waitSeconds > 0) {
        // Long polling mode
        answeredQuestions = await pollForAnswers(sessionId, questionIds, waitSeconds * 1000);
    }
    else {
        // Immediate check (no polling, only this session's questions)
        const sessionPath = getSessionPath(sessionId);
        const entries = await loadSessionJSONL(sessionPath);
        answeredQuestions = entries
            .filter((entry) => {
            const isQuestion = entry.type === 'question';
            const isAnswered = entry.status === 'answered';
            const matchesFilter = questionIds.length === 0 || questionIds.includes(entry.id);
            return isQuestion && isAnswered && matchesFilter;
        })
            .map((entry) => entry);
    }
    // Get count of remaining pending questions in this session
    const sessionPath = getSessionPath(sessionId);
    const allEntries = await loadSessionJSONL(sessionPath);
    const pendingCount = allEntries.filter((entry) => entry.type === 'question' && entry.status === 'pending').length;
    // Format answers
    const answers = answeredQuestions
        .filter(q => q.answer && q.answered_at) // Safety check
        .map(q => ({
        question_id: q.id,
        question: q.question,
        answer: q.answer,
        answered_at: q.answered_at
    }));
    return {
        answers,
        pending_count: pendingCount
    };
}
