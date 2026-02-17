import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSessionPath, loadSessionJSONL, appendToSession, discoverSessions } from './session-manager.js';
import { withLock } from './file-lock.js';
// Base directory for question storage
// Use PROJECT_ROOT env var or traverse up to find project root
function getProjectRoot() {
    if (process.env.PROJECT_ROOT) {
        return process.env.PROJECT_ROOT;
    }
    // Traverse up from mcp-servers/telegram-mcp to project root
    const currentDir = process.cwd();
    if (currentDir.includes('mcp-servers/telegram-mcp')) {
        return path.resolve(currentDir, '../..');
    }
    return currentDir;
}
/**
 * Atomic write using temp file + rename
 */
async function writeAtomic(filePath, content) {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, filePath);
}
/**
 * Append new question to session queue
 * @param sessionId Session UUID
 * @param question Question details (question text and optional context)
 * @returns Full question object with generated fields
 */
export async function appendQuestion(sessionId, question) {
    const fullQuestion = {
        type: 'question', // Add type field for session entry
        id: randomUUID(),
        session_id: sessionId,
        question: question.question,
        context: question.context,
        conversation_id: question.conversation_id,
        status: 'pending',
        created_at: new Date().toISOString(),
    };
    // Use appendToSession which already handles locking
    await appendToSession(sessionId, fullQuestion);
    return fullQuestion;
}
/**
 * Load pending questions for specific session
 * @param sessionId Session UUID
 * @returns Array of pending questions
 */
export async function loadPendingQuestions(sessionId) {
    const sessionPath = getSessionPath(sessionId);
    const entries = await loadSessionJSONL(sessionPath);
    return entries
        .filter((entry) => entry.type === 'question' && entry.status === 'pending')
        .map((entry) => entry);
}
/**
 * Load all pending questions across all sessions
 * Used by Telegram bot to show all pending questions
 * @returns Array of pending questions with session_id attached
 */
export async function loadAllPendingQuestions() {
    const sessions = await discoverSessions();
    const allPending = [];
    for (const session of sessions) {
        const pending = await loadPendingQuestions(session.id);
        allPending.push(...pending.map(q => ({ ...q, session_id: session.id })));
    }
    return allPending;
}
/**
 * Mark question as answered
 * Updates question in-place within session file and appends answer event
 * @param sessionId Session UUID
 * @param questionId Question UUID
 * @param answer User's answer
 */
export async function markAnswered(sessionId, questionId, answer) {
    const sessionPath = getSessionPath(sessionId);
    await withLock(sessionPath, async () => {
        // Load all entries from session
        const entries = await loadSessionJSONL(sessionPath);
        // Find and update the question entry
        let updated = false;
        const updatedEntries = entries.map((entry) => {
            if (entry.type === 'question' && entry.id === questionId) {
                updated = true;
                return {
                    ...entry,
                    status: 'answered',
                    answer,
                    answered_at: new Date().toISOString()
                };
            }
            return entry;
        });
        if (!updated) {
            throw new Error(`Question not found in session ${sessionId}: ${questionId}`);
        }
        // Append answer event
        const answerEvent = {
            type: 'answer',
            question_id: questionId,
            answer,
            answered_at: new Date().toISOString()
        };
        updatedEntries.push(answerEvent);
        // Atomic rewrite of session file
        const content = updatedEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
        await writeAtomic(sessionPath, content);
    });
}
/**
 * Get single pending question by ID
 * @param questionId Question UUID
 * @param sessionId Optional session UUID to search in specific session
 * @returns Question or null if not found
 */
export async function getPendingById(questionId, sessionId) {
    if (sessionId) {
        // Search only in specified session
        const pending = await loadPendingQuestions(sessionId);
        return pending.find(q => q.id === questionId) || null;
    }
    // Search all sessions
    const allPending = await loadAllPendingQuestions();
    return allPending.find(q => q.id === questionId) || null;
}
/**
 * Load all session entries with a matching conversation_id, sorted chronologically.
 * Used to reconstruct multi-message conversations for Haiku analysis.
 * @param sessionId Session UUID
 * @param conversationId Conversation UUID to filter by
 * @returns Sorted array of matching session entries
 */
export async function loadConversationMessages(sessionId, conversationId) {
    const sessionPath = getSessionPath(sessionId);
    const entries = await loadSessionJSONL(sessionPath);
    const matching = entries.filter((entry) => entry.conversation_id === conversationId);
    // Sort chronologically by timestamp (use created_at, answered_at, or timestamp)
    matching.sort((a, b) => {
        const aTime = a.created_at || a.answered_at || a.timestamp || '';
        const bTime = b.created_at || b.answered_at || b.timestamp || '';
        return aTime.localeCompare(bTime);
    });
    return matching;
}
/**
 * Group all session entries by conversation_id.
 * Entries without a conversation_id are grouped under the key "ungrouped".
 * @param sessionId Session UUID
 * @returns Map of conversationId -> entries[] sorted chronologically
 */
export async function getConversationEntries(sessionId) {
    const sessionPath = getSessionPath(sessionId);
    const entries = await loadSessionJSONL(sessionPath);
    const grouped = new Map();
    for (const entry of entries) {
        const key = entry.conversation_id || 'ungrouped';
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(entry);
    }
    // Sort each group chronologically
    for (const [key, group] of grouped) {
        group.sort((a, b) => {
            const aTime = a.created_at || a.answered_at || a.timestamp || '';
            const bTime = b.created_at || b.answered_at || b.timestamp || '';
            return aTime.localeCompare(bTime);
        });
        grouped.set(key, group);
    }
    return grouped;
}
/**
 * TEMPORARY BACKWARD COMPATIBILITY LAYER
 * These functions will be removed in plan 10.1-03 when proper session management is added
 * to the MCP server and tools.
 */
// Get temporary session ID based on process PID (for compatibility until 10.1-03)
function getTempSessionId() {
    // Use PID as temporary session identifier
    // This maintains single-instance behavior until proper session management is added
    return `pid-${process.pid}`;
}
/**
 * DEPRECATED: Load all pending questions (backward compat wrapper)
 * Use loadPendingQuestions(sessionId) or loadAllPendingQuestions() instead
 * @deprecated Will be removed in 10.1-03
 */
export async function loadPendingQuestionsLegacy() {
    // For now, return all pending questions across all sessions
    // This maintains bot compatibility until 10.1-03 implements proper session filtering
    const allPending = await loadAllPendingQuestions();
    return allPending;
}
/**
 * DEPRECATED: Append question without explicit session (backward compat wrapper)
 * Use appendQuestion(sessionId, question) instead
 * @deprecated Will be removed in 10.1-03
 */
export async function appendQuestionLegacy(question) {
    const sessionId = getTempSessionId();
    // Create session if it doesn't exist
    const { createSession } = await import('./session-manager.js');
    const sessions = await discoverSessions();
    const sessionExists = sessions.some(s => s.id === sessionId);
    if (!sessionExists) {
        // Create temporary session for this process
        const actualSessionId = await createSession(`MCP Server PID ${process.pid}`);
        // Note: we can't easily rename it to match pid-${process.pid}, so we'll just use it
        return appendQuestion(actualSessionId, question);
    }
    return appendQuestion(sessionId, question);
}
/**
 * DEPRECATED: Mark answered without explicit session (backward compat wrapper)
 * Use markAnswered(sessionId, questionId, answer) instead
 * @deprecated Will be removed in 10.1-03
 */
export async function markAnsweredLegacy(questionId, answer) {
    // Find the question across all sessions
    const question = await getPendingById(questionId);
    if (!question) {
        throw new Error(`Question not found: ${questionId}`);
    }
    // Use the question's session_id
    await markAnswered(question.session_id, questionId, answer);
}
/**
 * DEPRECATED: Archive answered question (backward compat - now a no-op)
 * Answered questions now stay in session files, not archived separately
 * @deprecated Will be removed in 10.1-03
 */
export async function archiveQuestion(question) {
    // No-op: questions are now kept in session files after being answered
    // The markAnswered function updates them in-place
    console.warn('[question-queue] archiveQuestion is deprecated - questions stay in session files');
}
