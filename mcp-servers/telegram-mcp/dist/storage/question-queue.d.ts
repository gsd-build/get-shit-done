/**
 * Pending question structure
 * Persists to per-session JSONL files in .planning/telegram-sessions/
 */
export interface PendingQuestion {
    type?: string;
    id: string;
    session_id: string;
    question: string;
    context?: string;
    conversation_id?: string;
    status: "pending" | "answered";
    created_at: string;
    answer?: string;
    answered_at?: string;
}
/**
 * Append new question to session queue
 * @param sessionId Session UUID
 * @param question Question details (question text and optional context)
 * @returns Full question object with generated fields
 */
export declare function appendQuestion(sessionId: string, question: {
    question: string;
    context?: string;
    conversation_id?: string;
}): Promise<PendingQuestion>;
/**
 * Load pending questions for specific session
 * @param sessionId Session UUID
 * @returns Array of pending questions
 */
export declare function loadPendingQuestions(sessionId: string): Promise<PendingQuestion[]>;
/**
 * Load all pending questions across all sessions
 * Used by Telegram bot to show all pending questions
 * @returns Array of pending questions with session_id attached
 */
export declare function loadAllPendingQuestions(): Promise<Array<PendingQuestion & {
    session_id: string;
}>>;
/**
 * Mark question as answered
 * Updates question in-place within session file and appends answer event
 * @param sessionId Session UUID
 * @param questionId Question UUID
 * @param answer User's answer
 */
export declare function markAnswered(sessionId: string, questionId: string, answer: string): Promise<void>;
/**
 * Get single pending question by ID
 * @param questionId Question UUID
 * @param sessionId Optional session UUID to search in specific session
 * @returns Question or null if not found
 */
export declare function getPendingById(questionId: string, sessionId?: string): Promise<PendingQuestion | null>;
/**
 * Load all session entries with a matching conversation_id, sorted chronologically.
 * Used to reconstruct multi-message conversations for Haiku analysis.
 * @param sessionId Session UUID
 * @param conversationId Conversation UUID to filter by
 * @returns Sorted array of matching session entries
 */
export declare function loadConversationMessages(sessionId: string, conversationId: string): Promise<import('./session-manager.js').SessionEntry[]>;
/**
 * Group all session entries by conversation_id.
 * Entries without a conversation_id are grouped under the key "ungrouped".
 * @param sessionId Session UUID
 * @returns Map of conversationId -> entries[] sorted chronologically
 */
export declare function getConversationEntries(sessionId: string): Promise<Map<string, import('./session-manager.js').SessionEntry[]>>;
/**
 * DEPRECATED: Load all pending questions (backward compat wrapper)
 * Use loadPendingQuestions(sessionId) or loadAllPendingQuestions() instead
 * @deprecated Will be removed in 10.1-03
 */
export declare function loadPendingQuestionsLegacy(): Promise<PendingQuestion[]>;
/**
 * DEPRECATED: Append question without explicit session (backward compat wrapper)
 * Use appendQuestion(sessionId, question) instead
 * @deprecated Will be removed in 10.1-03
 */
export declare function appendQuestionLegacy(question: {
    question: string;
    context?: string;
}): Promise<PendingQuestion>;
/**
 * DEPRECATED: Mark answered without explicit session (backward compat wrapper)
 * Use markAnswered(sessionId, questionId, answer) instead
 * @deprecated Will be removed in 10.1-03
 */
export declare function markAnsweredLegacy(questionId: string, answer: string): Promise<void>;
/**
 * DEPRECATED: Archive answered question (backward compat - now a no-op)
 * Answered questions now stay in session files, not archived separately
 * @deprecated Will be removed in 10.1-03
 */
export declare function archiveQuestion(question: PendingQuestion): Promise<void>;
